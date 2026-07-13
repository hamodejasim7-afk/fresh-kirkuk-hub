
-- 1) Categories unique per store
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_store_name_unique UNIQUE (store_id, name);

-- 2) Remove blanket anon SELECT policies on orders / order_items
DROP POLICY IF EXISTS "public can view orders" ON public.orders;
DROP POLICY IF EXISTS "public can view order items" ON public.order_items;

-- 3) Phone-lookup RPC for anonymous order tracking
CREATE OR REPLACE FUNCTION public.get_orders_by_phone(_phone text)
RETURNS TABLE (
  id uuid,
  status text,
  total_iqd numeric,
  created_at timestamptz,
  customer_name text,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE o.customer_phone = _phone
  ORDER BY o.created_at DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_orders_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_by_phone(text) TO anon, authenticated;

-- 4) Tighten SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.auth_store_id()              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_store_admin_of(uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_user(uuid)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_loyalty_stamp(uuid)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auth_store_id()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_admin_of(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_loyalty_stamp(uuid)    TO authenticated;
