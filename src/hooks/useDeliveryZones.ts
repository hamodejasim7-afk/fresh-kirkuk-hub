import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DELIVERY_FEE_IQD } from "@/lib/constants";

export interface DeliveryZone {
  id: string;
  name: string;
  price_iqd: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Options {
  onlyActive?: boolean;
}

export function useDeliveryZones(opts: Options = {}) {
  const { onlyActive = false } = opts;
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("delivery_zones" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (onlyActive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (!error && data) setZones(data as unknown as DeliveryZone[]);
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("delivery_zones_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_zones" },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { zones, loading, reload: load };
}

export const DEFAULT_DELIVERY_FEE = DELIVERY_FEE_IQD;
