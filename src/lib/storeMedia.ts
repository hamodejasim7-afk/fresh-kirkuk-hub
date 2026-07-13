import { supabase } from "@/integrations/supabase/client";

export const STORE_MEDIA_BUCKET = "fresh";

type StoreMediaFields = {
  logo_url: string | null;
  cover_url?: string | null;
  icon_url?: string | null;
};

export function normalizeFreshStorageUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const path = raw.replace(/^\/+/, "").replace(/^fresh\/+/, "");
  return supabase.storage.from(STORE_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function normalizeStoreMediaUrls<T extends StoreMediaFields>(store: T): T {
  return {
    ...store,
    logo_url: normalizeFreshStorageUrl(store.logo_url),
    cover_url: normalizeFreshStorageUrl(store.cover_url),
    icon_url: normalizeFreshStorageUrl(store.icon_url),
  };
}