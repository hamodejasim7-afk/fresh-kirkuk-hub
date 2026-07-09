import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Store {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logo_url: string | null;
  is_open: boolean | null;
  status: string;
  sort_order: number | null;
}

export function useStores(opts: { onlyActive?: boolean } = {}) {
  const { onlyActive = true } = opts;
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("stores")
      .select("id, name, slug, address, logo_url, is_open, status, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (onlyActive) q = q.eq("status", "active");
    const { data, error } = await q;
    if (!error && data) setStores(data as Store[]);
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => { load(); }, [load]);

  return { stores, loading, reload: load };
}
