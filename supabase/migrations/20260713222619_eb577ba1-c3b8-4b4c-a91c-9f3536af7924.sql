DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'fresh') THEN
    DROP POLICY IF EXISTS "fresh public read" ON storage.objects;
    DROP POLICY IF EXISTS "fresh super admin write" ON storage.objects;
    DROP POLICY IF EXISTS "fresh store admin write" ON storage.objects;

    CREATE POLICY "fresh public read"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'fresh');

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
  END IF;
END $$;