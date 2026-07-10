import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIVILEGED_ROLES = new Set([
  "super_admin",
  "store_admin",
  "admin",
  "accountant",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    let callerId: string;
    if (typeof userClient.auth.getClaims === "function") {
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
      callerId = claimsData.claims.sub as string;
    } else {
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      callerId = userData.user.id;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve caller roles + store scope (mirrors create-staff)
    const [{ data: callerRoles }, { data: callerProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", callerId),
      admin.from("profiles").select("store_id").eq("id", callerId).maybeSingle(),
    ]);
    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    const callerStoreId = (callerProfile as { store_id: string | null } | null)?.store_id ?? null;

    const isSuperAdmin =
      roles.includes("super_admin") || (roles.includes("admin") && callerStoreId === null);
    const isStoreAdmin =
      roles.includes("store_admin") || (roles.includes("admin") && callerStoreId !== null);
    const isAccountant = roles.includes("accountant");

    if (!isSuperAdmin && !isStoreAdmin && !isAccountant) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const target = (body.user_id ?? "").trim();
    if (!target || !/^[0-9a-f-]{36}$/i.test(target)) {
      return json({ error: "user_id غير صالح" }, 400);
    }
    if (target === callerId) {
      return json({ error: "لا يمكنك حذف حسابك الخاص" }, 400);
    }

    // Load target roles + store for scope enforcement
    const [{ data: targetRolesData }, { data: targetProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", target),
      admin.from("profiles").select("store_id").eq("id", target).maybeSingle(),
    ]);
    const targetRoles = (targetRolesData ?? []).map((r: { role: string }) => r.role);
    const targetStoreId = (targetProfile as { store_id: string | null } | null)?.store_id ?? null;
    const targetIsPrivileged = targetRoles.some((r) => PRIVILEGED_ROLES.has(r));

    if (isSuperAdmin) {
      // Super admins may delete anyone (except themselves, already blocked)
    } else if (isStoreAdmin) {
      if (!callerStoreId || targetStoreId !== callerStoreId) {
        return json({ error: "لا يمكنك حذف مستخدم من متجر آخر" }, 403);
      }
      if (targetIsPrivileged) {
        return json({ error: "لا يمكنك حذف مستخدم بصلاحيات إدارية" }, 403);
      }
    } else if (isAccountant) {
      // Backward-compat: accountants may only delete drivers
      if (!targetRoles.every((r) => r === "driver") || targetRoles.length === 0) {
        return json({ error: "المحاسب يستطيع حذف السائقين فقط" }, 403);
      }
    }

    // Unassign any orders first to avoid dangling driver_id
    await admin
      .from("orders")
      .update({ driver_id: null })
      .eq("driver_id", target);

    const { error: delErr } = await admin.auth.admin.deleteUser(target);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
