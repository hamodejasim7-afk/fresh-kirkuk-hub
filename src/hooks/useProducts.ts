import { useEffect, useState, useCallback } from "react";
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

export function useProducts(opts: { onlyAvailable?: boolean } = {}) {
  const { onlyAvailable = false } = opts;
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("products").select("*").order("sort_order", { ascending: true });
    if (onlyAvailable) q = q.eq("is_available", true);
    const { data, error } = await q;
    if (!error && data) setProducts(data as DBProduct[]);
    setLoading(false);
  }, [onlyAvailable]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { products, loading, reload: load };
}
