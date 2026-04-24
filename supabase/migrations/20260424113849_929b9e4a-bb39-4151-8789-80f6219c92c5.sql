-- Fix function search_path warnings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tighten public INSERT policies: prevent setting admin-only fields at creation time
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND driver_id IS NULL
    AND archived_at IS NULL
    AND length(customer_name) BETWEEN 1 AND 100
    AND length(customer_phone) BETWEEN 5 AND 25
    AND length(customer_address) BETWEEN 3 AND 500
    AND total_iqd >= 0
  );

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
  ON public.order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    quantity > 0
    AND price_iqd >= 0
    AND length(product_name) BETWEEN 1 AND 200
  );