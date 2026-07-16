
-- Tighten EXECUTE grants on SECURITY DEFINER functions.
-- Trigger-only functions: revoke from PUBLIC entirely (already are, safe to be explicit).
REVOKE ALL ON FUNCTION public.apply_loyalty_stamp(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_order_when_closed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_orders_apply_stamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_set_pricing_category() FROM PUBLIC, anon, authenticated;

-- RLS-helper functions: only authenticated users need EXECUTE; drop anon access.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_store_admin_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_admin_of(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin_or_accountant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.auth_store_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_store_id() TO authenticated;

REVOKE ALL ON FUNCTION public.can_manage_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_recent_new_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_recent_new_order(uuid) TO authenticated;

-- Customer order tracking: anon customers look up their own orders by phone.
-- Keep EXECUTE for anon/authenticated (function limits to 5 latest rows per phone),
-- but add explicit input validation to block enumeration via empty/short phone.
CREATE OR REPLACE FUNCTION public.get_orders_by_phone(_phone text)
 RETURNS TABLE(id uuid, status text, total_iqd numeric, created_at timestamp with time zone, customer_name text, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.status::text, o.total_iqd, o.created_at, o.customer_name,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'product_name', oi.product_name,
             'quantity', oi.quantity,
             'price_iqd', oi.price_iqd
           ))
           FROM public.order_items oi WHERE oi.order_id = o.id
         ), '[]'::jsonb) AS items
  FROM public.orders o
  WHERE _phone IS NOT NULL
    AND length(btrim(_phone)) BETWEEN 6 AND 30
    AND o.customer_phone = btrim(_phone)
  ORDER BY o.created_at DESC
  LIMIT 5;
$function$;

REVOKE ALL ON FUNCTION public.get_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_by_phone(text) TO anon, authenticated;

-- Explicit orders DELETE guard: only store admins (for their store) or accountants may delete.
-- The existing "store admin manages own orders" (ALL) already covers this; this policy makes
-- the intent explicit and adds an accountant path.
DROP POLICY IF EXISTS "Admins and accountants can delete orders" ON public.orders;
CREATE POLICY "Admins and accountants can delete orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (store_id = public.auth_store_id())
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );
