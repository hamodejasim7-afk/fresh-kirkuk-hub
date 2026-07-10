
-- 1) Backfill: any orphaned customers whose store_id is NULL but who are
--    tied to orders keep the store from their latest order.
UPDATE public.customers c
   SET store_id = sub.store_id
  FROM (
    SELECT DISTINCT ON (o.customer_id) o.customer_id, o.store_id
      FROM public.orders o
     WHERE o.customer_id IS NOT NULL
       AND o.store_id IS NOT NULL
     ORDER BY o.customer_id, o.created_at DESC
  ) sub
 WHERE c.id = sub.customer_id
   AND c.store_id IS NULL;

-- 2) Tighten customers RLS: remove the null-store cross-tenant bridge.
--    Store users may only view/update customers that belong to their store.
--    Super admins keep global access via the existing super-admin policy.
--    Null-store customers become super_admin-only (still readable/managed by the
--    "super admin manages customers" policy) until an admin migrates them.
DROP POLICY IF EXISTS "store users view own store customers" ON public.customers;
DROP POLICY IF EXISTS "store users update own store customers" ON public.customers;

CREATE POLICY "store users view own store customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    store_id IS NOT NULL
    AND auth_store_id() IS NOT NULL
    AND store_id = auth_store_id()
  );

CREATE POLICY "store users update own store customers"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    store_id IS NOT NULL
    AND auth_store_id() IS NOT NULL
    AND store_id = auth_store_id()
  )
  WITH CHECK (store_id = auth_store_id());

-- 3) store_settings: retire legacy admin-role gate; only super_admin may update.
DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;

CREATE POLICY "Super admin updates store settings"
  ON public.store_settings
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
