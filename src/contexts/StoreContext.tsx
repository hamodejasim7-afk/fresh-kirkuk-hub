import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Store } from "@/hooks/useStores";
import { useAuth } from "@/contexts/AuthContext";
import { signStoresMediaUrls } from "@/lib/storeMedia";

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
  /** True when the caller is allowed to change stores (super admin or unauthenticated customer). */
  canSwitchStore: boolean;
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
  canSwitchStore: true,
});

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const { user, isSuperAdmin, storeId: assignedStoreId, loading: authLoading } = useAuth();
  const [activeStores, setActiveStores] = useState<Store[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [isSelectorOpen, setSelectorOpen] = useState(false);

  // Store users (any authenticated non-super-admin) are locked to their profile.store_id.
  const isPinnedStoreUser = !!user && !isSuperAdmin && !!assignedStoreId;
  const canSwitchStore = !isPinnedStoreUser;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stores")
      .select("id, name, slug, address, logo_url, cover_url, icon_url, is_open, status, sort_order, phone, whatsapp")
      .eq("status", "active")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    const rows = await signStoresMediaUrls((data ?? []) as Store[]);
    setActiveStores(rows);

    setSelectedId((prev) => {
      if (prev && rows.some((s) => s.id === prev)) return prev;
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return null;
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Force the pinned store for store users (overrides any localStorage value).
  useEffect(() => {
    if (authLoading) return;
    if (isPinnedStoreUser && assignedStoreId && selectedId !== assignedStoreId) {
      try { localStorage.setItem(STORAGE_KEY, assignedStoreId); } catch {}
      setSelectedId(assignedStoreId);
      setSelectorOpen(false);
    }
  }, [authLoading, isPinnedStoreUser, assignedStoreId, selectedId]);

  // Auto-open selector only for users allowed to switch stores.
  useEffect(() => {
    if (loading || authLoading) return;
    if (!canSwitchStore) { setSelectorOpen(false); return; }
    if (!selectedId && activeStores.length > 0) setSelectorOpen(true);
    else if (selectedId) setSelectorOpen(false);
  }, [loading, authLoading, canSwitchStore, selectedId, activeStores.length]);

  const selectStore = useCallback((id: string) => {
    if (!canSwitchStore) return; // hard guard
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
    setSelectedId(id);
    setSelectorOpen(false);
  }, [canSwitchStore]);

  const clearStore = useCallback(() => {
    if (!canSwitchStore) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSelectedId(null);
  }, [canSwitchStore]);

  const openSelector = useCallback(() => {
    if (!canSwitchStore) return;
    setSelectorOpen(true);
  }, [canSwitchStore]);
  const closeSelector = useCallback(() => {
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
        canSwitchStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
