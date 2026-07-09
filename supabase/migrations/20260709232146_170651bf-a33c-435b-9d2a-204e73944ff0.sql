
-- ============================================
-- Helper functions
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- stores table
-- ============================================
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug = lower(slug)),
  name text NOT NULL,
  logo_url text,
  cover_url text,
  primary_color text DEFAULT '#F97316',
  secondary_color text DEFAULT '#15803D',
  phone text CHECK (phone IS NULL OR phone <> ''),
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp <> ''),
  address text,
  latitude double precision,
  longitude double precision,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','inactive','archived','deleted')),
  opening_time time DEFAULT '08:00',
  closing_time time DEFAULT '22:00',
  minimum_order numeric DEFAULT 0,
  free_delivery_over numeric,
  delivery_enabled boolean DEFAULT true,
  is_open boolean DEFAULT true,
  currency text DEFAULT 'IQD',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_stores_status ON public.stores(status);
CREATE INDEX idx_stores_sort ON public.stores(sort_order);

GRANT SELECT ON public.stores TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Seed default store "Fresh"
INSERT INTO public.stores (id, slug, name, primary_color, secondary_color, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'fresh', 'فريش Fresh', '#F97316', '#15803D', 'active')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Add store_id to existing tables + backfill
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_store ON public.profiles(store_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE RESTRICT;
UPDATE public.products SET store_id = '00000000-0000-0000-0000-000000000001' WHERE store_id IS NULL;
ALTER TABLE public.products ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE RESTRICT;
UPDATE public.categories SET store_id = '00000000-0000-0000-0000-000000000001' WHERE store_id IS NULL;
ALTER TABLE public.categories ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_store ON public.categories(store_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE RESTRICT;
UPDATE public.orders SET store_id = '00000000-0000-0000-0000-000000000001' WHERE store_id IS NULL;
ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_store ON public.orders(store_id);

-- ============================================
-- auth_store_id & is_super_admin (use user_roles)
-- ============================================
CREATE OR REPLACE FUNCTION public.auth_store_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND (p.store_id IS NULL OR p.id IS NULL)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.auth_store_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ============================================
-- store_configs
-- ============================================
CREATE TABLE public.store_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  whatsapp_enabled boolean DEFAULT true,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  order_prefix text DEFAULT 'ORD',
  notification_sound boolean DEFAULT true,
  ai_price_update_enabled boolean DEFAULT true,
  default_delivery_fee numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_configs TO authenticated;
GRANT ALL ON public.store_configs TO service_role;

ALTER TABLE public.store_configs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER store_configs_set_updated_at
  BEFORE UPDATE ON public.store_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE POLICY "super admin manages store configs"
ON public.store_configs FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "store admin manages own config"
ON public.store_configs FOR ALL TO authenticated
USING (store_id = public.auth_store_id())
WITH CHECK (store_id = public.auth_store_id());

INSERT INTO public.store_configs (store_id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (store_id) DO NOTHING;

-- ============================================
-- delivery_areas
-- ============================================
CREATE TABLE public.delivery_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  fee_iqd numeric NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_delivery_areas_store ON public.delivery_areas(store_id);

GRANT SELECT ON public.delivery_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_areas TO authenticated;
GRANT ALL ON public.delivery_areas TO service_role;

ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public view active delivery areas"
ON public.delivery_areas FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE POLICY "super admin manages delivery areas"
ON public.delivery_areas FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "store admin manages own delivery areas"
ON public.delivery_areas FOR ALL TO authenticated
USING (store_id = public.auth_store_id())
WITH CHECK (store_id = public.auth_store_id());

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_area_id uuid REFERENCES public.delivery_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_area ON public.orders(delivery_area_id);

-- ============================================
-- stores RLS
-- ============================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public view active stores"
ON public.stores FOR SELECT TO anon, authenticated
USING (status = 'active');

CREATE POLICY "super admin manages stores"
ON public.stores FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "store admin views own store"
ON public.stores FOR SELECT TO authenticated
USING (id = public.auth_store_id());

-- ============================================
-- Additional RLS on existing tables (added alongside existing policies)
-- ============================================
CREATE POLICY "store admin manages own products"
ON public.products FOR ALL TO authenticated
USING (public.is_super_admin() OR store_id = public.auth_store_id())
WITH CHECK (public.is_super_admin() OR store_id = public.auth_store_id());

CREATE POLICY "store admin manages own orders"
ON public.orders FOR ALL TO authenticated
USING (public.is_super_admin() OR store_id = public.auth_store_id())
WITH CHECK (public.is_super_admin() OR store_id = public.auth_store_id());

CREATE POLICY "store admin manages own categories"
ON public.categories FOR ALL TO authenticated
USING (public.is_super_admin() OR store_id = public.auth_store_id())
WITH CHECK (public.is_super_admin() OR store_id = public.auth_store_id());
