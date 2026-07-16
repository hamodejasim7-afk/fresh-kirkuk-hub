
-- 1) Orders: broaden admin update access
DROP POLICY IF EXISTS "store admin manages own orders" ON public.orders;
CREATE POLICY "store admin manages own orders"
ON public.orders
FOR ALL
TO authenticated
USING (
  is_super_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR store_id = auth_store_id()
)
WITH CHECK (
  is_super_admin()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR store_id = auth_store_id()
);

-- 2) Products: only expose available products publicly
DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;
CREATE POLICY "Anyone can view available products"
ON public.products
FOR SELECT
TO public
USING (is_available = true);
