CREATE POLICY "public can view orders"
ON public.orders
FOR SELECT
TO anon
USING (true);

CREATE POLICY "public can view order items"
ON public.order_items
FOR SELECT
TO anon
USING (true);