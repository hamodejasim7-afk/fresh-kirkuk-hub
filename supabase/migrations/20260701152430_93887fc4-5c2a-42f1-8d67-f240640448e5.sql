
-- 1) customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  area TEXT,
  qr_code TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  total_stamps INTEGER NOT NULL DEFAULT 0,
  gift_count INTEGER NOT NULL DEFAULT 0,
  lifetime_orders INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT ON public.customers TO anon; -- public loyalty card lookup by qr_code / phone
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauth) can read a customer card — needed for public /loyalty/:qr page
CREATE POLICY "Public can view customer cards"
  ON public.customers FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_accountant(auth.uid()) OR public.has_role(auth.uid(),'driver'));

CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()) OR public.has_role(auth.uid(),'driver'))
  WITH CHECK (true);

CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_qr ON public.customers(qr_code);

-- 2) link orders to customers + stamp bookkeeping
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stamp_added BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- 3) atomic stamp application on delivery
CREATE OR REPLACE FUNCTION public.apply_loyalty_stamp(_order_id UUID)
RETURNS TABLE (customer_id UUID, total_stamps INTEGER, gift_count INTEGER, gift_awarded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_already BOOLEAN;
  v_new_stamps INTEGER;
  v_new_gifts INTEGER;
  v_awarded BOOLEAN := false;
BEGIN
  SELECT o.customer_id, o.stamp_added INTO v_customer_id, v_already
  FROM public.orders o WHERE o.id = _order_id FOR UPDATE;

  IF v_customer_id IS NULL THEN RETURN; END IF;
  IF v_already THEN
    RETURN QUERY SELECT c.id, c.total_stamps, c.gift_count, false
    FROM public.customers c WHERE c.id = v_customer_id;
    RETURN;
  END IF;

  UPDATE public.customers
     SET total_stamps = total_stamps + 1,
         lifetime_orders = lifetime_orders + 1
   WHERE id = v_customer_id
   RETURNING total_stamps, gift_count INTO v_new_stamps, v_new_gifts;

  IF v_new_stamps >= 10 THEN
    UPDATE public.customers
       SET total_stamps = 0, gift_count = gift_count + 1
     WHERE id = v_customer_id
     RETURNING total_stamps, gift_count INTO v_new_stamps, v_new_gifts;
    v_awarded := true;
  END IF;

  UPDATE public.orders SET stamp_added = true WHERE id = _order_id;

  RETURN QUERY SELECT v_customer_id, v_new_stamps, v_new_gifts, v_awarded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_loyalty_stamp(UUID) TO authenticated;

-- 4) trigger to auto-apply stamp when order status flips to 'delivered'
CREATE OR REPLACE FUNCTION public.trg_orders_apply_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.customer_id IS NOT NULL
     AND NEW.stamp_added = false THEN
    PERFORM public.apply_loyalty_stamp(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_apply_stamp ON public.orders;
CREATE TRIGGER orders_apply_stamp
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_apply_stamp();

-- 5) realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
