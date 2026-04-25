
-- 1) إصلاح سياسة إنشاء الطلبات: السماح للـ public role أيضاً وتخفيف قيود الطول
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
TO public, anon, authenticated
WITH CHECK (
  status = 'new'
  AND driver_id IS NULL
  AND archived_at IS NULL
  AND length(customer_name) BETWEEN 1 AND 100
  AND length(customer_phone) BETWEEN 5 AND 30
  AND length(customer_address) BETWEEN 3 AND 1000
  AND total_iqd >= 0
);

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
ON public.order_items
FOR INSERT
TO public, anon, authenticated
WITH CHECK (
  quantity > 0
  AND price_iqd >= 0
  AND length(product_name) BETWEEN 1 AND 200
);

-- 2) إضافة سياسة للمدير لقراءة الطلبات المؤرشفة أيضاً (السياسة الحالية تستثني المؤرشفة من الواجهة فقط)
-- (لا حاجة لتغيير لأن سياسة "Admins can view all orders" تقرأ كل شيء)
