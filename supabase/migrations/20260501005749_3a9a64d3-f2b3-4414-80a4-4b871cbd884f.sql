
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_category text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.auto_set_pricing_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pricing_category IS NULL OR NEW.pricing_category = '' THEN
    NEW.pricing_category := NEW.category;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_pricing_category ON public.products;
CREATE TRIGGER trg_auto_pricing_category
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_pricing_category();

-- Backfill existing rows
UPDATE public.products SET pricing_category = category WHERE pricing_category = '';
