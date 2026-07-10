import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";

/**
 * Effective store scope for a data panel.
 * - Super admin: currentStore.id from StoreContext (whatever they selected), null if none.
 * - Store user: their pinned profiles.store_id (never overridden by the selector).
 * - `ready` is true only once we know the scope (auth + store both loaded).
 */
export function useStoreScope(): { storeId: string | null; ready: boolean; isSuperAdmin: boolean } {
  const { isSuperAdmin, storeId: pinnedStoreId, loading: authLoading } = useAuth();
  const { currentStore, loading: storeLoading } = useStore();

  const ready = !authLoading && !storeLoading;
  const storeId = isSuperAdmin ? (currentStore?.id ?? null) : (pinnedStoreId ?? null);
  return { storeId, ready, isSuperAdmin };
}
