
-- 1) Restrict customers public SELECT to anon only, remove anon INSERT
DROP POLICY IF EXISTS "Public can view customer cards" ON public.customers;
DROP POLICY IF EXISTS "Public can self-register loyalty" ON public.customers;

CREATE POLICY "allow_public_card_view"
  ON public.customers
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated staff can also SELECT (needed for admin panel)
CREATE POLICY "Staff view customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) Customers UPDATE: authenticated can update ONLY total_stamps / gift_count
CREATE POLICY "Authenticated update loyalty counters only"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    full_name  = (SELECT c2.full_name  FROM public.customers c2 WHERE c2.id = customers.id)
    AND phone   = (SELECT c2.phone    FROM public.customers c2 WHERE c2.id = customers.id)
    AND qr_code = (SELECT c2.qr_code  FROM public.customers c2 WHERE c2.id = customers.id)
    AND COALESCE(area,'') = COALESCE((SELECT c2.area FROM public.customers c2 WHERE c2.id = customers.id),'')
  );

-- 3) Orders: INSERT/SELECT own for authenticated (additive; storefront anon insert stays)
CREATE POLICY "Authenticated insert own orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated select own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- 4) Fix privilege escalation: accountants can only manage driver roles (not accountant)
DROP POLICY IF EXISTS "Accountants update driver/accountant roles" ON public.user_roles;
CREATE POLICY "Accountants update driver roles only"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'accountant'::app_role) AND role = 'driver'::app_role)
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role) AND role = 'driver'::app_role);

-- 5) Fix driver overreach: constrain status values and financial fields
DROP POLICY IF EXISTS "Drivers can update assigned orders status" ON public.orders;
CREATE POLICY "Drivers can update assigned orders status"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid() AND has_role(auth.uid(), 'driver'::app_role))
  WITH CHECK (
    driver_id = auth.uid()
    AND has_role(auth.uid(), 'driver'::app_role)
    AND status IN ('assigned','on_the_way','delivered','returned')
    AND total_iqd       = (SELECT o.total_iqd       FROM public.orders o WHERE o.id = orders.id)
    AND delivery_fee_iqd= (SELECT o.delivery_fee_iqd FROM public.orders o WHERE o.id = orders.id)
    AND customer_name   = (SELECT o.customer_name   FROM public.orders o WHERE o.id = orders.id)
    AND customer_phone  = (SELECT o.customer_phone  FROM public.orders o WHERE o.id = orders.id)
    AND customer_address= (SELECT o.customer_address FROM public.orders o WHERE o.id = orders.id)
  );

-- 6) Do not block loyalty (manual staff) orders when store is closed
CREATE OR REPLACE FUNCTION public.block_order_when_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_open BOOLEAN;
BEGIN
  -- Skip store-open check for authenticated staff loyalty/manual orders
  IF NEW.created_by IS NOT NULL AND NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT is_open INTO v_open FROM public.store_settings WHERE id = true;
  IF v_open IS NOT TRUE THEN
    RAISE EXCEPTION 'STORE_CLOSED';
  END IF;
  RETURN NEW;
END;
$$;
