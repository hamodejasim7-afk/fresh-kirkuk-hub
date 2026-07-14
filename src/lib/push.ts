import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // The app SW is registered by @/pwa/register on prod; ready waits for it.
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribeToPush(opts: {
  userId: string;
  storeId: string | null;
}): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error("PUSH_UNSUPPORTED");
  if (!VAPID_PUBLIC_KEY) throw new Error("VAPID_PUBLIC_KEY_MISSING");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("PERMISSION_DENIED");

  const reg = await getRegistration();
  if (!reg) throw new Error("NO_SERVICE_WORKER");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const payload = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: opts.userId,
      store_id: opts.storeId,
      endpoint: sub.endpoint,
      subscription: payload as unknown as Record<string, unknown>,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
  return sub;
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
