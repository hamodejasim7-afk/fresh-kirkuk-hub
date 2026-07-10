import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Roles that are allowed to be created via this endpoint.
// admin is legacy but still accepted (super_admin only) for backward compat.
type Role =
  | "super_admin"
  | "store_admin"
  | "admin"
  | "accountant"
  | "driver"
  | "employee"
  | "cashier"
  | "inventory_manager";

const STORE_ADMIN_ALLOWED_ROLES: Role[] = ["employee", "driver", "cashier", "inventory_manager"];
const SUPER_ADMIN_ALLOWED_ROLES: Role[] = [
  "super_admin",
  "store_admin",
  "admin",
  "accountant",
  "driver",
  "employee",
  "cashier",
  "inventory_manager",
];

interface Body {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: Role;
  /** Optional; super_admin may pass any store_id, store_admin's own store is forced. */
  store_id?: string | null;
}

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

    // Resolve caller identity
    const [{ data: isSuperData }, { data: callerRoles }, { data: callerProfile }] =
      await Promise.all([
        admin.rpc("is_super_admin_of", { _user: callerId }).then(() => ({ data: null })).catch(() => ({ data: null })),
        admin.from("user_roles").select("role").eq("user_id", callerId),
        admin.from("profiles").select("store_id").eq("id", callerId).maybeSingle(),
      ]);
    // Prefer explicit check via has_role (RPC that already exists)
    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    const callerStoreId = (callerProfile as { store_id: string | null } | null)?.store_id ?? null;
    const isSuperAdmin =
      roles.includes("super_admin") || (roles.includes("admin") && callerStoreId === null);
    const isStoreAdmin =
      roles.includes("store_admin") || (roles.includes("admin") && callerStoreId !== null);
    // Legacy accountant retains ability to create drivers (backward compat).
    const isAccountant = roles.includes("accountant");

    if (!isSuperAdmin && !isStoreAdmin && !isAccountant) {
      return json({ error: "Forbidden" }, 403);
    }

    const body: Body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const full_name = (body.full_name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const role = body.role as Role | undefined;
    let store_id: string | null = body.store_id ?? null;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "إيميل غير صالح" }, 400);
    if (!password || password.length < 6) return json({ error: "كلمة السر يجب أن تكون 6 أحرف فأكثر" }, 400);
    if (!role) return json({ error: "الدور مطلوب" }, 400);
    if (full_name.length > 100 || phone.length > 25) return json({ error: "بيانات غير صالحة" }, 400);

    // Role-scoping rules
    if (isSuperAdmin) {
      if (!SUPER_ADMIN_ALLOWED_ROLES.includes(role)) return json({ error: "الدور غير صالح" }, 400);
      // super_admin: store_id optional; validate if provided
      if (store_id && !/^[0-9a-f-]{36}$/i.test(store_id)) return json({ error: "معرّف المتجر غير صالح" }, 400);
      // Super admins themselves should not have a store scope
      if (role === "super_admin") store_id = null;
    } else if (isStoreAdmin) {
      if (!callerStoreId) return json({ error: "لا يوجد متجر مخصّص لك" }, 403);
      if (!STORE_ADMIN_ALLOWED_ROLES.includes(role)) {
        return json({ error: "مدير المتجر يستطيع إنشاء موظفين فقط (موظف، سائق، أمين صندوق، مدير مخزون)" }, 403);
      }
      // Force target's store to the caller's store — no cross-store creation
      store_id = callerStoreId;
    } else if (isAccountant) {
      // Backward-compat: accountants may only create drivers, tied to their store if any
      if (role !== "driver") return json({ error: "المحاسب يستطيع إنشاء سائقين فقط" }, 403);
      store_id = callerStoreId;
    }

    // Create user (auto-confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message ?? "فشل إنشاء الحساب" }, 400);
    }
    const newUserId = created.user.id;

    // Upsert profile (trigger will have created a base row) — set store_id here
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        { id: newUserId, full_name, phone, store_id },
        { onConflict: "id" },
      );
    if (profErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: "فشل حفظ الملف الشخصي: " + profErr.message }, 400);
    }

    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: newUserId, role });
    if (roleErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: "فشل تعيين الدور: " + roleErr.message }, 400);
    }

    return json({ success: true, user_id: newUserId });
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
