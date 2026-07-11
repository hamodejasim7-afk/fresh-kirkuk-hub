
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;

CREATE POLICY "product-images super admin write"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'product-images' AND (public.is_super_admin() OR public.has_role(auth.uid(), 'admin'::public.app_role)))
WITH CHECK (bucket_id = 'product-images' AND (public.is_super_admin() OR public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "product-images store admin write"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'products'
  AND public.is_store_admin_of(((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'products'
  AND public.is_store_admin_of(((storage.foldername(name))[2])::uuid)
);
