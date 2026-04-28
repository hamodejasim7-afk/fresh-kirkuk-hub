
-- Allow accountants to UPDATE driver/accountant roles (swap between driver/accountant)
CREATE POLICY "Accountants update driver/accountant roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'accountant'::app_role)
  AND role IN ('driver'::app_role, 'accountant'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'accountant'::app_role)
  AND role IN ('driver'::app_role, 'accountant'::app_role)
);
