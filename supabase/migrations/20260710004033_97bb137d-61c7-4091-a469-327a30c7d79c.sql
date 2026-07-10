
-- ============================================================
-- Phase 5.2 — Role architecture, permissions & storage policies
-- Additive only. No existing policy is dropped.
-- ============================================================

-- 1) JSONB permissions column (additive; legacy booleans preserved)
ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Rewrite is_super_admin() to recognise the explicit super_admin role
--    (keeps legacy behaviour: admin + no store still counts).
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND (p.store_id IS NULL OR p.id IS NULL)
    );
$$;

-- 3) New helper: is the caller store_admin (or legacy admin) of a given store?
CREATE OR REPLACE FUNCTION public.is_store_admin_of(_store uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _store IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.store_id = _store
      AND ur.role IN ('store_admin', 'admin')
  );
$$;

-- 4) New helper: can the caller manage the target user?
--    Super admin: always.
--    Store admin: only same-store users who are NOT super_admin/store_admin/admin/accountant.
CREATE OR REPLACE FUNCTION public.can_manage_user(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      _target IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles caller
        JOIN public.profiles target ON target.id = _target
        WHERE caller.id = auth.uid()
          AND caller.store_id IS NOT NULL
          AND caller.store_id = target.store_id
          AND public.is_store_admin_of(caller.store_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = _target
              AND ur.role IN ('super_admin','store_admin','admin','accountant')
          )
      )
    );
$$;

-- 5) Backfill: classify existing admins into super_admin / store_admin
--    (idempotent via unique(user_id, role) + ON CONFLICT DO NOTHING).
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'super_admin'::public.app_role
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin'
  AND (p.store_id IS NULL OR p.id IS NULL)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'store_admin'::public.app_role
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin'
  AND p.store_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Additive RLS on user_roles for store_admin (super_admin already covered
--    by legacy "Admins can manage roles" policy via has_role admin — plus
--    they hold both super_admin AND admin after backfill).
CREATE POLICY "Store admins insert scoped employee roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role IN ('employee','driver','cashier','inventory_manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles target
    WHERE target.id = user_roles.user_id
      AND target.store_id IS NOT NULL
      AND public.is_store_admin_of(target.store_id)
  )
);

CREATE POLICY "Store admins delete scoped employee roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  role IN ('employee','driver','cashier','inventory_manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles target
    WHERE target.id = user_roles.user_id
      AND target.store_id IS NOT NULL
      AND public.is_store_admin_of(target.store_id)
  )
);

CREATE POLICY "Store admins view own-store roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles target
    WHERE target.id = user_roles.user_id
      AND target.store_id IS NOT NULL
      AND public.is_store_admin_of(target.store_id)
  )
);

-- 7) Additive RLS on profiles for store_admin (super_admin covered by
--    legacy "Admins can manage all profiles" via admin role backfill).
CREATE POLICY "Store admins view own-store profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  store_id IS NOT NULL
  AND public.is_store_admin_of(store_id)
);

CREATE POLICY "Store admins update own-store profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  store_id IS NOT NULL
  AND public.is_store_admin_of(store_id)
)
WITH CHECK (
  store_id IS NOT NULL
  AND public.is_store_admin_of(store_id)
);

-- 8) staff_permissions: read-only visibility for store admins over own-store users.
--    Write access remains super_admin only (via existing "Admins manage permissions"
--    policy — super_admin also holds admin role after backfill, so no change needed).
CREATE POLICY "Store admins view own-store permissions"
ON public.staff_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles target
    WHERE target.id = staff_permissions.user_id
      AND target.store_id IS NOT NULL
      AND public.is_store_admin_of(target.store_id)
  )
);

-- 9) Storage policies for store-branding bucket.
--    Bucket is technically private (workspace blocks public buckets) but we
--    grant public SELECT so getPublicUrl() resolves for customer-facing pages.
CREATE POLICY "store-branding public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'store-branding');

CREATE POLICY "store-branding super admin write"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'store-branding' AND public.is_super_admin())
WITH CHECK (bucket_id = 'store-branding' AND public.is_super_admin());

-- Store admins can manage only their own store's folder: stores/{store_id}/...
CREATE POLICY "store-branding store admin write"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'store-branding'
  AND (storage.foldername(name))[1] = 'stores'
  AND public.is_store_admin_of(((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'store-branding'
  AND (storage.foldername(name))[1] = 'stores'
  AND public.is_store_admin_of(((storage.foldername(name))[2])::uuid)
);
