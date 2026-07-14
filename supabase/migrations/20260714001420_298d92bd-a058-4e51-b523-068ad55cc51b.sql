
-- Fix anonymous order_items insert failing due to RLS on the EXISTS subquery.
CREATE OR REPLACE FUNCTION public.is_recent_new_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND o.status = 'new'
      AND o.archived_at IS NULL
      AND o.created_at > now() - interval '10 minutes'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_recent_new_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_recent_new_order(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create order items for new orders" ON public.order_items;
CREATE POLICY "Anyone can create order items for new orders"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  quantity > 0
  AND price_iqd >= 0
  AND length(product_name) BETWEEN 1 AND 200
  AND public.is_recent_new_order(order_id)
);

-- Add updated_at to delivery_areas for parity with the admin panel.
ALTER TABLE public.delivery_areas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS delivery_areas_set_updated_at ON public.delivery_areas;
CREATE TRIGGER delivery_areas_set_updated_at
BEFORE UPDATE ON public.delivery_areas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
