-- Allow public self-registration of loyalty customers (name, phone, optional area only)
CREATE POLICY "Public can self-register loyalty" ON public.customers
FOR INSERT TO anon, authenticated
WITH CHECK (
  full_name IS NOT NULL AND length(full_name) >= 2
  AND phone IS NOT NULL AND length(phone) >= 10
  AND total_stamps = 0
  AND gift_count = 0
  AND lifetime_orders = 0
);

GRANT INSERT ON public.customers TO anon;
GRANT SELECT ON public.customers TO anon;