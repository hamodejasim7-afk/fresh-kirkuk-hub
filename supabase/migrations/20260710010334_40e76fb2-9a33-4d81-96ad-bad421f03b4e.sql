
-- =========================================================
-- SECURITY HARDENING: Multi-tenant isolation
-- =========================================================

-- 1) Cleanup legacy 'admin' rows for users already migrated
--    to super_admin / store_admin. These rows were the cause
--    of cross-tenant access through has_role(uid,'admin').
DELETE FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id
      AND ur2.role IN ('super_admin','store_admin')
  );

-- 2) PRODUCTS: drop cross-tenant policy (store-scoped one already exists)
DROP POLICY IF EXISTS "Admins/accountants manage products" ON public.products;
CREATE POLICY "accountants manage products"
  ON public.products FOR ALL TO authenticated
  USING (has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'accountant'));

-- 3) CATEGORIES
DROP POLICY IF EXISTS "Admins/accountants manage categories" ON public.categories;
CREATE POLICY "accountants manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'accountant'));

-- 4) ORDERS
DROP POLICY IF EXISTS "Admins/accountants view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins/accountants update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "accountants view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'accountant'));
CREATE POLICY "accountants update all orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'accountant'));

-- 5) ORDER_ITEMS: scope by parent order's store_id
DROP POLICY IF EXISTS "Admins manage order items (full)" ON public.order_items;
DROP POLICY IF EXISTS "Admins/accountants view order items" ON public.order_items;
DROP POLICY IF EXISTS "Accountants insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Accountants update order items" ON public.order_items;

CREATE POLICY "super admin manages order items"
  ON public.order_items FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "store users manage own store order items"
  ON public.order_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.store_id IS NOT NULL
        AND o.store_id = public.auth_store_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.store_id IS NOT NULL
        AND o.store_id = public.auth_store_id()
    )
  );

CREATE POLICY "accountants manage order items"
  ON public.order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'accountant'));

-- 6) PROFILES: strip cross-tenant admin policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins/accountants view profiles" ON public.profiles;

CREATE POLICY "super admin manages all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "accountants view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'accountant'));

-- 7) USER_ROLES
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins/accountants view roles" ON public.user_roles;

CREATE POLICY "super admin manages roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "accountants view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'accountant'));

-- 8) STAFF_PERMISSIONS
DROP POLICY IF EXISTS "Admins manage permissions" ON public.staff_permissions;
DROP POLICY IF EXISTS "Admins view all permissions" ON public.staff_permissions;

CREATE POLICY "super admin manages permissions"
  ON public.staff_permissions FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 9) CUSTOMERS: add store scoping
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);

DROP POLICY IF EXISTS "Staff view customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;

-- super admin: all
CREATE POLICY "super admin manages customers"
  ON public.customers FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- accountants: keep global (per approved spec)
CREATE POLICY "accountants manage customers"
  ON public.customers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'accountant'));

-- store users: only rows for their store (or legacy NULL until backfill)
CREATE POLICY "store users view own store customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    (store_id IS NOT NULL AND store_id = public.auth_store_id())
    OR (store_id IS NULL AND public.auth_store_id() IS NOT NULL)
  );

CREATE POLICY "store users insert own store customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_store_id() IS NOT NULL
    AND (store_id = public.auth_store_id())
  );

CREATE POLICY "store users update own store customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    (store_id IS NOT NULL AND store_id = public.auth_store_id())
    OR (store_id IS NULL AND public.auth_store_id() IS NOT NULL)
  )
  WITH CHECK (
    store_id = public.auth_store_id()
  );

CREATE POLICY "store admins delete own store customers"
  ON public.customers FOR DELETE TO authenticated
  USING (
    store_id IS NOT NULL AND public.is_store_admin_of(store_id)
  );
