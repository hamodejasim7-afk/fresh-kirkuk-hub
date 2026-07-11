
DROP POLICY IF EXISTS "accountants view profiles" ON public.profiles;
CREATE POLICY "accountants view own-store profiles" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(),'accountant')
    AND store_id IS NOT NULL
    AND store_id = public.auth_store_id()
  );

DROP POLICY IF EXISTS "accountants view roles" ON public.user_roles;
CREATE POLICY "accountants view own-store roles" ON public.user_roles
  FOR SELECT USING (
    has_role(auth.uid(),'accountant')
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      WHERE target.id = user_roles.user_id
        AND target.store_id IS NOT NULL
        AND target.store_id = public.auth_store_id()
    )
  );
