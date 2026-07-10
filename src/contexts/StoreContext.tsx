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
  isSelectorOpen: boolean;
  openSelector: () => void;
  closeSelector: () => void;
}

const StoreContext = createContext<StoreCtx>({
  currentStore: null,
  loading: true,
  activeStores: [],
  selectStore: () => {},
  clearStore: () => {},
  reload: async () => {},
  isSelectorOpen: false,
  openSelector: () => {},
  closeSelector: () => {},
});

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [activeStores, setActiveStores] = useState<Store[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [isSelectorOpen, setSelectorOpen] = useState(false);

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

    // Validate stored id; if invalid/missing → clear so the modal opens.
    setSelectedId((prev) => {
      if (prev && rows.some((s) => s.id === prev)) return prev;
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return null;
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open selector when there is no valid store selected.
  useEffect(() => {
    if (loading) return;
    if (!selectedId && activeStores.length > 0) setSelectorOpen(true);
    else if (selectedId) setSelectorOpen(false);
  }, [loading, selectedId, activeStores.length]);

  const selectStore = useCallback((id: string) => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
    setSelectedId(id);
    setSelectorOpen(false);
  }, []);

  const clearStore = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSelectedId(null);
  }, []);

  const openSelector = useCallback(() => setSelectorOpen(true), []);
  const closeSelector = useCallback(() => {
    // Only allow closing when a store is already selected.
    if (selectedId) setSelectorOpen(false);
  }, [selectedId]);

  const currentStore = useMemo(
    () => activeStores.find((s) => s.id === selectedId) ?? null,
    [activeStores, selectedId],
  );

  return (
    <StoreContext.Provider
      value={{
        currentStore, loading, activeStores,
        selectStore, clearStore, reload: load,
        isSelectorOpen, openSelector, closeSelector,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
