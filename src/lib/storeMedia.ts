import { supabase } from "@/integrations/supabase/client";

export const STORE_MEDIA_BUCKET = "fresh";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

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

export function getFreshStoragePath(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "").replace(/^fresh\/+/, "");

  const marker = `/object/public/${STORE_MEDIA_BUCKET}/`;
  const markerIndex = raw.indexOf(marker);
  if (markerIndex === -1) return null;
  const encodedPath = raw.slice(markerIndex + marker.length).split("?")[0];
  try {
    return decodeURIComponent(encodedPath).replace(/^\/+/, "");
  } catch {
    return encodedPath.replace(/^\/+/, "");
  }
}

export async function createFreshSignedUrl(value: string | null | undefined): Promise<string | null> {
  const path = getFreshStoragePath(value);
  if (!path) return normalizeFreshStorageUrl(value);

  const { data, error } = await supabase.storage
    .from(STORE_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) return normalizeFreshStorageUrl(value);
  return data.signedUrl;
}

export function normalizeStoreMediaUrls<T extends StoreMediaFields>(store: T): T {
  return {
    ...store,
    logo_url: normalizeFreshStorageUrl(store.logo_url),
    cover_url: normalizeFreshStorageUrl(store.cover_url),
    icon_url: normalizeFreshStorageUrl(store.icon_url),
  };
}

export async function signStoreMediaUrls<T extends StoreMediaFields>(store: T): Promise<T> {
  const [logoUrl, coverUrl, iconUrl] = await Promise.all([
    createFreshSignedUrl(store.logo_url),
    createFreshSignedUrl(store.cover_url),
    createFreshSignedUrl(store.icon_url),
  ]);

  return {
    ...store,
    logo_url: logoUrl,
    cover_url: coverUrl,
    icon_url: iconUrl,
  };
}

export async function signStoresMediaUrls<T extends StoreMediaFields>(stores: T[]): Promise<T[]> {
  return Promise.all(stores.map(signStoreMediaUrls));
}