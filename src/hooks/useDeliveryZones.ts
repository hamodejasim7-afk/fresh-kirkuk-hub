import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeliveryZone {
  id: string;
  store_id: string;
  name: string;
  /** Alias of fee_iqd for legacy callers. */
  price_iqd: number;
  fee_iqd: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

interface Options {
  onlyActive?: boolean;
  storeId?: string | null;
}

/**
 * Reads per-store delivery areas from public.delivery_areas.
 * When storeId is null/undefined, returns an empty list (no cross-store leakage).
 */
export function useDeliveryZones(opts: Options = {}) {
  const { onlyActive = false, storeId = null } = opts;
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId) {
      setZones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from("delivery_areas")
      .select("*")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (onlyActive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (!error && data) {
      setZones(
        (data as any[]).map((r) => ({
          id: r.id,
          store_id: r.store_id,
          name: r.name,
          fee_iqd: Number(r.fee_iqd),
          price_iqd: Number(r.fee_iqd),
          is_active: !!r.is_active,
          sort_order: r.sort_order ?? 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      );
    }
    setLoading(false);
  }, [onlyActive, storeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`delivery_areas_changes_${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_areas", filter: `store_id=eq.${storeId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, storeId]);

  return { zones, loading, reload: load };
}
