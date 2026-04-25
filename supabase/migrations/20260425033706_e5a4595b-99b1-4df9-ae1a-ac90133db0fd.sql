-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_iqd BIGINT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'كغم',
  emoji TEXT,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  stock_qty NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_sort ON public.products(sort_order);

-- Seed initial products from current static list
INSERT INTO public.products (name, category, price_iqd, unit, emoji, sort_order) VALUES
  ('طماطم طازجة', 'خضار وفواكه', 1500, 'كغم', '🍅', 1),
  ('خيار', 'خضار وفواكه', 1250, 'كغم', '🥒', 2),
  ('بطاطا', 'خضار وفواكه', 1000, 'كغم', '🥔', 3),
  ('بصل أحمر', 'خضار وفواكه', 1250, 'كغم', '🧅', 4),
  ('تفاح أحمر', 'خضار وفواكه', 3000, 'كغم', '🍎', 5),
  ('موز', 'خضار وفواكه', 2500, 'كغم', '🍌', 6),
  ('لحم غنم طازج', 'لحوم', 22000, 'كغم', '🥩', 7),
  ('لحم بقر مفروم', 'لحوم', 18000, 'كغم', '🥩', 8),
  ('كباب جاهز', 'لحوم', 20000, 'كغم', '🍢', 9),
  ('سمك كارب طازج', 'أسماك', 9000, 'كغم', '🐟', 10),
  ('سمك زبيدي', 'أسماك', 14000, 'كغم', '🐠', 11),
  ('روبيان', 'أسماك', 25000, 'كغم', '🦐', 12),
  ('دجاج كامل طازج', 'دجاج', 6500, 'حبة', '🍗', 13),
  ('صدور دجاج', 'دجاج', 8500, 'كغم', '🍗', 14),
  ('أفخاذ دجاج', 'دجاج', 7000, 'كغم', '🍗', 15);

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));