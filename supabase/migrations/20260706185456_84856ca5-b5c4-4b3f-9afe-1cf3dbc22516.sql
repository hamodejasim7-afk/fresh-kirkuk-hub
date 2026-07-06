
-- 1. Fix order_items INSERT: bind to a newly-created 'new' order
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

CREATE POLICY "Anyone can create order items for new orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  quantity > 0
  AND price_iqd >= 0
  AND length(product_name) BETWEEN 1 AND 200
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.status = 'new'
      AND o.archived_at IS NULL
      AND o.created_at > now() - interval '10 minutes'
  )
);

-- 2 & 3. Revoke EXECUTE on all SECURITY DEFINER functions from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.apply_loyalty_stamp(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_orders_apply_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_order_when_closed() FROM PUBLIC, anon, authenticated;

-- Keep role-check helpers callable by authenticated (RLS policies invoke them as the user)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) TO authenticated;

-- 4. Stop public listing of product-images bucket (direct public URLs still work via CDN)
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
