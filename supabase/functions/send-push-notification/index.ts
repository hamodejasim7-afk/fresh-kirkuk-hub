// Edge function: send-push-notification
// Triggered by a Supabase Database Webhook on public.orders INSERT.
// Authenticates via a shared header secret (x-webhook-secret).
// Sends Web Push notifications to all subscriptions belonging to admins
// of the order's store, plus every super admin subscription.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const WEBHOOK_SECRET = Deno.env.get("ORDER_WEBHOOK_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatIQD(n: number): string {
  try {
    return new Intl.NumberFormat("ar-IQ").format(n) + " د.ع";
  } catch {
    return `${n} د.ع`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const provided = req.headers.get("x-webhook-secret");
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return json(401, { error: "unauthorized" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  // Accept: Supabase DB webhook {type,record,...} OR direct {order_id}
  const record = body?.record ?? body;
  const orderId: string | undefined = record?.id ?? body?.order_id;
  if (!orderId) return json(400, { error: "missing_order_id" });

  // Load order + store info
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, store_id, customer_name, total_iqd, stores(name, logo_url)")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) {
    console.error("order lookup failed", orderErr);
    return json(404, { error: "order_not_found" });
  }

  // Recipients: subs whose store_id matches OR belonging to any super admin.
  const { data: superAdmins } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  const superIds = (superAdmins ?? []).map((r: { user_id: string }) => r.user_id);

  const parts: string[] = [];
  if (order.store_id) parts.push(`store_id.eq.${order.store_id}`);
  if (superIds.length) parts.push(`user_id.in.(${superIds.join(",")})`);
  parts.push("store_id.is.null"); // any subscription intentionally scoped to "all stores"

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .or(parts.join(","));
  if (subsErr) {
    console.error("subs lookup failed", subsErr);
    return json(500, { error: "subs_lookup_failed" });
  }

  const storeName = (order as any).stores?.name ?? "";
  const logo = (order as any).stores?.logo_url ?? "/icons/icon-192.png";
  const payload = JSON.stringify({
    title: `🔔 طلب جديد${storeName ? ` — ${storeName}` : ""}`,
    body: `${order.customer_name ?? "زبون"} • ${formatIQD(Number(order.total_iqd) || 0)}`,
    icon: logo,
    data: { url: "/admin", order_id: order.id },
    tag: `order-${order.id}`,
  });

  const uniqueSubs = Array.from(
    new Map((subs ?? []).map((s: any) => [s.endpoint, s])).values(),
  );

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    uniqueSubs.map(async (s: any) => {
      try {
        await webpush.sendNotification(s.subscription, payload);
        sent++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
        else console.error("push failed", code, e?.body || e?.message);
      }
    }),
  );

  if (stale.length) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }

  return json(200, { ok: true, recipients: uniqueSubs.length, sent, cleaned: stale.length });
});
