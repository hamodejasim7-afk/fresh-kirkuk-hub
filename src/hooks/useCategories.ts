import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function useCategories(opts: { onlyActive?: boolean; storeId?: string | null } = {}) {
  const { onlyActive = false, storeId } = opts;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("categories").select("*").order("sort_order").order("name");
    if (onlyActive) q = q.eq("is_active", true);
    if (storeId) q = q.eq("store_id", storeId);
    const { data, error } = await q;
    if (!error && data) setCategories(data as Category[]);
    setLoading(false);
  }, [onlyActive, storeId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("categories-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { categories, loading, reload: load };
}
