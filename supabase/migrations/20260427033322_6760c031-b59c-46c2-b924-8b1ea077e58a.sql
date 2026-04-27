-- 1. Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
ON public.categories FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins manage categories"
ON public.categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 2. Seed categories from existing products
INSERT INTO public.categories (name, sort_order)
SELECT DISTINCT category, 0
FROM public.products
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT (name) DO NOTHING;

-- 3. Add delivery fee column to orders
ALTER TABLE public.orders
ADD COLUMN delivery_fee_iqd BIGINT NOT NULL DEFAULT 2000;

-- 4. Apply delivery fee to ALL existing orders (update totals)
UPDATE public.orders
SET total_iqd = total_iqd + 2000
WHERE delivery_fee_iqd = 2000;

-- 5. Update INSERT policy on orders to allow delivery_fee
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
TO public
WITH CHECK (
  (status = 'new'::text)
  AND (driver_id IS NULL)
  AND (archived_at IS NULL)
  AND (length(customer_name) >= 1 AND length(customer_name) <= 100)
  AND (length(customer_phone) >= 5 AND length(customer_phone) <= 30)
  AND (length(customer_address) >= 3 AND length(customer_address) <= 1000)
  AND (total_iqd >= 0)
  AND (delivery_fee_iqd >= 0)
);