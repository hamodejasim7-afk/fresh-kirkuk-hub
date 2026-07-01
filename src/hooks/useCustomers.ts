import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listCustomers } from "@/services/loyalty";
import type { Customer } from "@/types/loyalty";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await listCustomers();
      setCustomers(rows);
    } catch {
      // ignore — surfaced by callers when they mutate
    } finally {
      setLoading(false);
    }
  }, []);

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
