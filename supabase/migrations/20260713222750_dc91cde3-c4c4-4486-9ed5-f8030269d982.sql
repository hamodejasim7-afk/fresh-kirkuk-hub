DROP POLICY IF EXISTS "fresh stores public read" ON storage.objects;
DROP POLICY IF EXISTS "fresh super admin write" ON storage.objects;
DROP POLICY IF EXISTS "fresh store admin write" ON storage.objects;

CREATE POLICY "fresh stores public read"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'fresh'
  AND (storage.foldername(name))[1] = 'stores'
);

CREATE POLICY "fresh super admin write"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'fresh' AND public.is_super_admin())
WITH CHECK (bucket_id = 'fresh' AND public.is_super_admin());

CREATE POLICY "fresh store admin write"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'fresh'
  AND (storage.foldername(name))[1] = 'stores'
  AND public.is_store_admin_of(((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'fresh'
  AND (storage.foldername(name))[1] = 'stores'
  AND public.is_store_admin_of(((storage.foldername(name))[2])::uuid)
);