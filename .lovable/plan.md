## Web Push Notifications for New Orders

Deliver background push notifications to Super Admin + Store Admins when a new order arrives, using the standard Web Push protocol (VAPID). Works on Android Chrome/Edge PWA and iOS 16.4+ (installed to Home Screen). In-browser toasts stay as they are.

---

## 1. VAPID keys

- Generate the keypair **locally, once**, with `npx web-push generate-vapid-keys`. You paste the output into the two secret prompts.
- Store server-side private key via `add_secret`: `VAPID_PRIVATE_KEY`, plus `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` (a `mailto:` string).
- Public key also exposed to the frontend as `VITE_VAPID_PUBLIC_KEY` in `.env` (public keys are safe to commit to env).

You'll be asked to paste those three values after approval.

## 2. Database (migration)

New table `public.push_subscriptions`:

- `user_id uuid` → `profiles(id)` on delete cascade
- `store_id uuid` → `stores(id)` on delete cascade, nullable (super-admin can have store_id NULL = "all stores")
- `endpoint text UNIQUE NOT NULL` (extracted from subscription for dedup + cleanup on 410)
- `subscription jsonb NOT NULL`
- `user_agent text`
- `created_at`, `updated_at`

GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` ALL. No anon.

RLS:
- Users manage only their own rows (`auth.uid() = user_id`) for SELECT/INSERT/UPDATE/DELETE.
- Edge function reads via service role, bypassing RLS.

Indexes on `store_id` and `user_id`.

## 3. Edge function `send-push-notification`

- `verify_jwt = false` (called by DB webhook with a shared header secret we verify manually).
- Accepts either a Supabase DB webhook payload (`{ type: "INSERT", record: {...} }`) or a plain `{ order_id }` for manual test.
- Auth: requires header `x-webhook-secret` matching secret `ORDER_WEBHOOK_SECRET` (generated via `generate_secret`).
- Logic:
  1. Load order with `store_id`, `customer_name`, `total_iqd`, join `stores(name, logo_url)`.
  2. Query recipients: all `push_subscriptions` where `store_id = order.store_id` OR `user_id` has role `super_admin` in `user_roles` (super admin rows can have `store_id NULL`, but we also include super admins regardless).
  3. Build payload: `{ title: "🔔 طلب جديد — {store}", body: "{customer} • {total} د.ع", icon: store.logo_url || "/icon-192.png", data: { url: "/admin", order_id } }`.
  4. Send via `npm:web-push@3` with VAPID.
  5. On 404/410 response, delete that subscription row.
- CORS headers included on all responses.

Sketch:

```ts
import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("ORDER_WEBHOOK_SECRET"))
    return new Response("unauthorized", { status: 401, headers: corsHeaders });

  const body = await req.json();
  const record = body.record ?? body;              // webhook OR direct call
  const orderId = record.id ?? body.order_id;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order } = await admin
    .from("orders")
    .select("id, store_id, customer_name, total_iqd, stores(name, logo_url)")
    .eq("id", orderId).single();

  // recipients: subs for this store + super_admin subs
  const { data: superAdmins } = await admin.from("user_roles").select("user_id").eq("role","super_admin");
  const superIds = (superAdmins ?? []).map(r => r.user_id);
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .or(`store_id.eq.${order.store_id},user_id.in.(${superIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);

  const payload = JSON.stringify({
    title: `🔔 طلب جديد — ${order.stores?.name ?? ""}`,
    body: `${order.customer_name} • ${order.total_iqd.toLocaleString("ar-IQ")} د.ع`,
    icon: order.stores?.logo_url ?? "/icon-192.png",
    data: { url: "/admin", order_id: order.id },
  });

  await Promise.all((subs ?? []).map(async (s) => {
    try { await webpush.sendNotification(s.subscription as any, payload); }
    catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410)
        await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));

  return new Response(JSON.stringify({ ok: true, sent: subs?.length ?? 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
```

## 4. DB webhook (manual step by you)

Lovable Cloud webhooks are configured in the Backend UI (I can't create them via tool). After the function is deployed I'll give you the exact steps:

- Table: `orders`, event: `INSERT`
- Method: POST to the `send-push-notification` function URL
- Header: `x-webhook-secret: <ORDER_WEBHOOK_SECRET>`

## 5. Frontend — subscribe UI

New file `src/lib/push.ts`:
- `isPushSupported()`, `getExistingSubscription()`, `subscribeToPush(storeId)`, `unsubscribeFromPush()`.
- Uses `navigator.serviceWorker.ready`, then `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY) })`.
- Upserts row into `push_subscriptions` (endpoint as unique key), sets `store_id = null` for super admin, else profile.store_id.

New component `src/components/PushNotificationsToggle.tsx`:
- Shown in Admin only to super_admin / store_admin / admin roles.
- Button: "تفعيل إشعارات الطلبات" → on success shows "✅ الإشعارات مفعّلة على هذا الجهاز" and switches to "إيقاف الإشعارات".
- Handles permission denied + unsupported (iOS < 16.4 / not installed) with helpful message.

Mount into `src/pages/Admin.tsx` header area (near existing controls).

## 6. Service worker

The project currently has no service worker (`useProducts`, `Index.tsx` show no PWA setup). Per the PWA skill: add **manifest + minimal push-only service worker** — not `vite-plugin-pwa`, because we don't want offline caching (would risk stale-cache issues per PWA skill).

- New file `public/sw.js` — plain push handler only, no caching:

```js
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}
  const title = data.title || "طلب جديد";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body, icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png", data: data.data || {}, tag: "new-order",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const hit = all.find(c => c.url.includes(url));
    if (hit) return hit.focus();
    return self.clients.openWindow(url);
  })());
});
```

- New file `public/manifest.webmanifest` (name, icons, `display: "standalone"`, `start_url: "/admin"`).
- New files `public/icon-192.png`, `public/icon-512.png` — generated via imagegen.
- Registration wrapper `src/pwa/registerPush.ts` — registers `/sw.js` only in production and outside Lovable preview iframes (per PWA skill). Called from `src/main.tsx`.
- `index.html`: add `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`.

## 7. Files created / modified

Created:
- `supabase/migrations/<ts>_push_subscriptions.sql`
- `supabase/functions/send-push-notification/index.ts`
- `src/lib/push.ts`
- `src/components/PushNotificationsToggle.tsx`
- `src/pwa/registerPush.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `public/icon-192.png`, `public/icon-512.png`

Modified:
- `src/main.tsx` — call `registerPush()`
- `src/pages/Admin.tsx` — mount `<PushNotificationsToggle />`
- `index.html` — manifest + icon meta tags
- `.env` — add `VITE_VAPID_PUBLIC_KEY` (public)
- `src/integrations/supabase/types.ts` — regenerated after migration

## 8. Secrets requested after approval

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` → via `add_secret` (you paste after running `npx web-push generate-vapid-keys` locally; I'll give the command).
- `ORDER_WEBHOOK_SECRET` → via `generate_secret` (random 48 chars, revealed once so you can paste into the webhook header).

## Non-goals

- No offline caching, no `vite-plugin-pwa`, no route prefetching.
- No customer-facing notifications.
- Existing in-app toasts / order polling untouched.
- Historical orders don't trigger notifications; only new INSERTs via webhook.

Reply "go" to proceed. I'll start with migration + secrets prompts, then function, then frontend + SW.
