import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Store } from "@/hooks/useStores";

const STORAGE_KEY = "fresh:selectedStoreId";

interface StoreCtx {
  currentStore: Store | null;
  loading: boolean;
  activeStores: Store[];
  selectStore: (id: string) => void;
  clearStore: () => void;
  reload: () => Promise<void>;
}

const StoreContext = createContext<StoreCtx>({
  currentStore: null,
  loading: true,
  activeStores: [],
  selectStore: () => {},
  clearStore: () => {},
  reload: async () => {},
});

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [activeStores, setActiveStores] = useState<Store[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stores")
      .select("id, name, slug, address, logo_url, is_open, status, sort_order")
      .eq("status", "active")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    const rows = (data ?? []) as Store[];
    setActiveStores(rows);

    // Validate stored id: if missing or invalid, fall back to first active store.
    setSelectedId((prev) => {
      if (prev && rows.some((s) => s.id === prev)) return prev;
      if (rows.length > 0) {
        try { localStorage.setItem(STORAGE_KEY, rows[0].id); } catch {}
        return rows[0].id;
      }
      return null;
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectStore = useCallback((id: string) => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
    setSelectedId(id);
  }, []);

  const clearStore = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSelectedId(null);
  }, []);

  const currentStore = useMemo(
    () => activeStores.find((s) => s.id === selectedId) ?? null,
    [activeStores, selectedId],
  );

  return (
    <StoreContext.Provider
      value={{ currentStore, loading, activeStores, selectStore, clearStore, reload: load }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
