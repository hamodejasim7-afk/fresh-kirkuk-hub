
DROP FUNCTION IF EXISTS public.apply_loyalty_stamp(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.apply_loyalty_stamp(_order_id uuid)
RETURNS TABLE(out_customer_id uuid, out_total_stamps integer, out_gift_count integer, out_gift_awarded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  UPDATE public.customers AS c
     SET total_stamps = c.total_stamps + 1,
         lifetime_orders = c.lifetime_orders + 1
   WHERE c.id = v_customer_id
   RETURNING c.total_stamps, c.gift_count INTO v_new_stamps, v_new_gifts;

  IF v_new_stamps >= 10 THEN
    UPDATE public.customers AS c
       SET total_stamps = 0, gift_count = c.gift_count + 1
     WHERE c.id = v_customer_id
     RETURNING c.total_stamps, c.gift_count INTO v_new_stamps, v_new_gifts;
    v_awarded := true;
  END IF;

  UPDATE public.orders SET stamp_added = true WHERE id = _order_id;

  RETURN QUERY SELECT v_customer_id, v_new_stamps, v_new_gifts, v_awarded;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_loyalty_stamp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_loyalty_stamp(uuid) TO service_role;

-- Recreate the trigger that CASCADE dropped
CREATE OR REPLACE FUNCTION public.trg_orders_apply_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'delivered'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.customer_id IS NOT NULL
     AND NEW.stamp_added = false THEN
    PERFORM public.apply_loyalty_stamp(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_apply_stamp ON public.orders;
CREATE TRIGGER orders_apply_stamp
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_apply_stamp();

REVOKE EXECUTE ON FUNCTION public.trg_orders_apply_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_order_when_closed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_set_pricing_category() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) TO authenticated, service_role;

-- Tighten permissive RLS UPDATE policies on customers
DROP POLICY IF EXISTS "Authenticated update loyalty counters only" ON public.customers;
CREATE POLICY "Authenticated update loyalty counters only"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (
    full_name = (SELECT c2.full_name FROM public.customers c2 WHERE c2.id = customers.id)
    AND phone = (SELECT c2.phone FROM public.customers c2 WHERE c2.id = customers.id)
    AND qr_code = (SELECT c2.qr_code FROM public.customers c2 WHERE c2.id = customers.id)
    AND COALESCE(area, '') = COALESCE((SELECT c2.area FROM public.customers c2 WHERE c2.id = customers.id), '')
  );

DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;
CREATE POLICY "Staff can update customers"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()) OR public.has_role(auth.uid(), 'driver'::public.app_role))
  WITH CHECK (public.is_admin_or_accountant(auth.uid()) OR public.has_role(auth.uid(), 'driver'::public.app_role));

-- Storage: restrict listing on product-images to authenticated users only
DROP POLICY IF EXISTS "Public can list product-images" ON storage.objects;
DROP POLICY IF EXISTS "product-images public list" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product-images" ON storage.objects;
CREATE POLICY "Authenticated can read product-images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');
