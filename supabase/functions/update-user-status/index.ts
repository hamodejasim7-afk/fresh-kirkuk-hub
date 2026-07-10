import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | "suspend"        // ban 100 years
  | "activate"       // unban
  | "reset_password" // generate recovery link (returned; caller sends via email or shares)
  | "assign_store"   // super_admin only
  | "change_role";   // super_admin only

interface Body {
  user_id?: string;
  action?: Action;
  store_id?: string | null;      // for assign_store
  role?: string;                 // for change_role
  remove_role?: string;          // for change_role (optional)
}

const NEVER_ROLES = ["super_admin", "store_admin", "admin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    let callerId: string;
    if (typeof userClient.auth.getClaims === "function") {
      const { data, error } = await userClient.auth.getClaims(token);
      if (error || !data?.claims?.sub) return json({ error: "Unauthorized" }, 401);
      callerId = data.claims.sub as string;
    } else {
      const { data, error } = await userClient.auth.getUser(token);
      if (error || !data?.user) return json({ error: "Unauthorized" }, 401);
      callerId = data.user.id;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const [{ data: callerRoles }, { data: callerProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", callerId),
      admin.from("profiles").select("store_id").eq("id", callerId).maybeSingle(),
    ]);
    const cRoles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    const cStoreId = (callerProfile as { store_id: string | null } | null)?.store_id ?? null;
    const isSuperAdmin = cRoles.includes("super_admin") || (cRoles.includes("admin") && cStoreId === null);
    const isStoreAdmin = cRoles.includes("store_admin") || (cRoles.includes("admin") && cStoreId !== null);
    if (!isSuperAdmin && !isStoreAdmin) return json({ error: "Forbidden" }, 403);

    const body: Body = await req.json().catch(() => ({}));
    const targetId = (body.user_id ?? "").trim();
    const action = body.action;
    if (!targetId || !/^[0-9a-f-]{36}$/i.test(targetId)) return json({ error: "user_id غير صالح" }, 400);
    if (targetId === callerId) return json({ error: "لا يمكنك تعديل حسابك الخاص من هنا" }, 400);
    if (!action) return json({ error: "action مطلوب" }, 400);

    // Fetch target's roles/store to enforce scoping
    const [{ data: targetRolesData }, { data: targetProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", targetId),
      admin.from("profiles").select("store_id").eq("id", targetId).maybeSingle(),
    ]);
    const tRoles = (targetRolesData ?? []).map((r: { role: string }) => r.role);
    const tStoreId = (targetProfile as { store_id: string | null } | null)?.store_id ?? null;

    // Store admins cannot touch super/store/legacy admins or accountants, and only own-store users.
    const targetIsPrivileged = tRoles.some((r) => NEVER_ROLES.includes(r) || r === "accountant");
    if (!isSuperAdmin) {
      if (!cStoreId || tStoreId !== cStoreId) return json({ error: "لا يمكنك إدارة مستخدم خارج متجرك" }, 403);
      if (targetIsPrivileged) return json({ error: "لا تملك صلاحية إدارة هذا المستخدم" }, 403);
      // Store admins can only suspend/activate/reset own-store employees
      if (action === "assign_store" || action === "change_role") {
        return json({ error: "هذه الصلاحية للمدير العام فقط" }, 403);
      }
    }

    if (action === "suspend") {
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "876000h", // ~100 years
      } as { ban_duration: string });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "activate") {
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      } as { ban_duration: string });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "reset_password") {
      // Fetch target email
      const { data: target, error: getErr } = await admin.auth.admin.getUserById(targetId);
      if (getErr || !target?.user?.email) return json({ error: "لم يتم العثور على المستخدم" }, 404);
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: target.user.email,
      });
      if (linkErr) return json({ error: linkErr.message }, 400);
      return json({
        success: true,
        action_link: linkData?.properties?.action_link ?? null,
      });
    }

    if (action === "assign_store") {
      const store_id = body.store_id ?? null;
      if (store_id !== null && !/^[0-9a-f-]{36}$/i.test(store_id)) return json({ error: "store_id غير صالح" }, 400);
      const { error } = await admin.from("profiles").update({ store_id }).eq("id", targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "change_role") {
      const newRole = (body.role ?? "").trim();
      const removeRole = (body.remove_role ?? "").trim();
      if (!newRole) return json({ error: "role مطلوب" }, 400);
      // Remove specified old role (or none) then add the new one.
      if (removeRole) {
        await admin.from("user_roles").delete().eq("user_id", targetId).eq("role", removeRole);
      }
      const { error } = await admin.from("user_roles").insert({ user_id: targetId, role: newRole });
      if (error && !/duplicate/i.test(error.message)) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "action غير معروف" }, 400);
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
