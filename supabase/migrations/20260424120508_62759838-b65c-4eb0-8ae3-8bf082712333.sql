-- Store settings (single row)
CREATE TABLE public.store_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  is_open BOOLEAN NOT NULL DEFAULT true,
  closed_message TEXT NOT NULL DEFAULT 'المتجر مغلق مؤقتاً — سنعود قريباً إن شاء الله 🌿',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = true)
);

INSERT INTO public.store_settings (id) VALUES (true);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous) can read store status
CREATE POLICY "Anyone can read store settings"
  ON public.store_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update store settings"
  ON public.store_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Block new orders while the store is closed
CREATE OR REPLACE FUNCTION public.block_order_when_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open BOOLEAN;
BEGIN
  SELECT is_open INTO v_open FROM public.store_settings WHERE id = true;
  IF v_open IS NOT TRUE THEN
    RAISE EXCEPTION 'STORE_CLOSED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_block_when_closed
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.block_order_when_closed();

-- Realtime updates so customers see changes instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;