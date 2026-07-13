DROP POLICY IF EXISTS "fresh public read" ON storage.objects;
DROP POLICY IF EXISTS "fresh stores public read" ON storage.objects;

CREATE POLICY "fresh stores public read"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'fresh'
  AND (storage.foldername(name))[1] = 'stores'
);