import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreBranding {
  id: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  icon_url: string | null;
}

/**
 * Loads branding for a specific store by id.
 * Used on public pages (loyalty cards, order-scoped screens) so the UI always
 * reflects the store the underlying record belongs to — never a store selected
 * in LocalStorage or the current auth context.
 */
export function useStoreBranding(storeId: string | null | undefined) {
  const [branding, setBranding] = useState<StoreBranding | null>(null);
  const [loading, setLoading] = useState<boolean>(!!storeId);

  useEffect(() => {
    let alive = true;
    if (!storeId) {
      setBranding(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("stores")
      .select("id, name, logo_url, cover_url, icon_url")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setBranding((data as StoreBranding | null) ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [storeId]);

  return { branding, loading };
}
