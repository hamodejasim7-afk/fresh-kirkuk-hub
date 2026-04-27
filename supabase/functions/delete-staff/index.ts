// Admin-only edge function to delete a staff account
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    const { data: isAccountant } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "accountant",
    });
    if (!isAdmin && !isAccountant) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const target = (body.user_id ?? "").trim();
    if (!target || !/^[0-9a-f-]{36}$/i.test(target)) {
      return json({ error: "user_id غير صالح" }, 400);
    }
    if (target === userData.user.id) {
      return json({ error: "لا يمكنك حذف حسابك الخاص" }, 400);
    }

    // Accountants can only delete drivers (not admins or other accountants)
    if (!isAdmin) {
      const { data: targetRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target);
      const roles = (targetRoles ?? []).map((r: { role: string }) => r.role);
      if (roles.some((r) => r === "admin" || r === "accountant")) {
        return json({ error: "المحاسب يستطيع حذف السائقين فقط" }, 403);
      }
    }

    // Unassign any orders first to avoid leaving dangling driver_id
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
