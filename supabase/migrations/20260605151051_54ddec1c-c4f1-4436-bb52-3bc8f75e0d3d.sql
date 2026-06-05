
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price_iqd integer NOT NULL DEFAULT 2000,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active delivery zones"
  ON public.delivery_zones FOR SELECT
  USING (is_active = true OR public.is_admin_or_accountant(auth.uid()));

CREATE POLICY "Admins/accountants can insert delivery zones"
  ON public.delivery_zones FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_accountant(auth.uid()));

CREATE POLICY "Admins/accountants can update delivery zones"
  ON public.delivery_zones FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()))
  WITH CHECK (public.is_admin_or_accountant(auth.uid()));

CREATE POLICY "Admins/accountants can delete delivery zones"
  ON public.delivery_zones FOR DELETE
  TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()));

CREATE TRIGGER delivery_zones_set_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_zone_name text,
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

INSERT INTO public.delivery_zones (name, price_iqd, sort_order) VALUES
  ('حي الواسطي', 2000, 1),
  ('حي النصر', 3000, 2),
  ('حي دوميز', 4000, 3),
  ('حي رحيم آوة', 5000, 4)
ON CONFLICT (name) DO NOTHING;
