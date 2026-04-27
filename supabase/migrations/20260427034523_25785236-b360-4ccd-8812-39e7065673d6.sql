-- Helper: admin or accountant
CREATE OR REPLACE FUNCTION public.is_admin_or_accountant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','accountant')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_accountant(uuid) FROM anon;

-- ============ ORDERS ============
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins/accountants view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins/accountants update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()));

-- delete remains admin-only (already exists: "Admins can delete orders")

-- ============ ORDER ITEMS ============
DROP POLICY IF EXISTS "Admins view all order items" ON public.order_items;
CREATE POLICY "Admins/accountants view order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()));

DROP POLICY IF EXISTS "Admins manage order items" ON public.order_items;
CREATE POLICY "Admins manage order items (full)"
  ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants update order items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants insert order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'accountant'));

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins/accountants manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()))
  WITH CHECK (public.is_admin_or_accountant(auth.uid()));

-- ============ CATEGORIES ============
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins/accountants manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()))
  WITH CHECK (public.is_admin_or_accountant(auth.uid()));

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins/accountants view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()));

-- profile management remains admin-only (existing "Admins can manage all profiles")

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins/accountants view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin_or_accountant(auth.uid()));

-- Accountants can insert/delete DRIVER roles only (not admin/accountant)
CREATE POLICY "Accountants manage driver roles - insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'accountant') AND role = 'driver');

CREATE POLICY "Accountants manage driver roles - delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'accountant') AND role = 'driver');
