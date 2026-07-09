import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DBProduct {
  id: string;
  name: string;
  category: string;
  price_iqd: number;
  unit: string;
  emoji: string | null;
  image_url: string | null;
  is_available: boolean;
  stock_qty: number | null;
  sort_order: number;
  allow_decimal?: boolean;
}

export function useProducts(opts: { onlyAvailable?: boolean; storeId?: string | null } = {}) {
  const { onlyAvailable = false, storeId } = opts;
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("products").select("*").order("sort_order", { ascending: true });
    if (onlyAvailable) q = q.eq("is_available", true);
    if (storeId) q = q.eq("store_id", storeId);
    const { data, error } = await q;
    if (!error && data) setProducts(data as DBProduct[]);
    setLoading(false);
  }, [onlyAvailable, storeId]);

  useEffect(() => {
    load();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`products-changes-${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => load()
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return { products, loading, reload: load };
}
