-- Granular per-staff permissions
CREATE TABLE public.staff_permissions (
  user_id UUID NOT NULL PRIMARY KEY,
  manage_orders BOOLEAN NOT NULL DEFAULT true,
  manage_pricing BOOLEAN NOT NULL DEFAULT true,
  manage_products BOOLEAN NOT NULL DEFAULT true,
  manage_categories BOOLEAN NOT NULL DEFAULT true,
  manage_drivers BOOLEAN NOT NULL DEFAULT true,
  view_reports BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- Each user can read their own permissions
CREATE POLICY "Users view own permissions"
ON public.staff_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all permissions
CREATE POLICY "Admins view all permissions"
ON public.staff_permissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins manage all permissions
CREATE POLICY "Admins manage permissions"
ON public.staff_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER staff_permissions_set_updated_at
BEFORE UPDATE ON public.staff_permissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.staff_permissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_permissions;