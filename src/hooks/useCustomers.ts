import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listCustomers } from "@/services/loyalty";
import type { Customer } from "@/types/loyalty";

/**
 * @param storeId Optional store filter. Store users can leave this undefined
 *   (RLS scopes them). Super admin should pass the currently-selected store's
 *   id so the panel doesn't fan out across every tenant.
 */
export function useCustomers(opts: { storeId?: string | null } = {}) {
  const { storeId } = opts;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await listCustomers();
      const filtered = storeId ? rows.filter((c) => (c as { store_id?: string | null }).store_id === storeId) : rows;
      setCustomers(filtered);
    } catch {
      // ignore — surfaced by callers when they mutate
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    reload();
    if (channelRef.current) return;
    const ch = supabase
      .channel("customers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        () => reload(),
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [reload]);

  return { customers, loading, reload };
}
