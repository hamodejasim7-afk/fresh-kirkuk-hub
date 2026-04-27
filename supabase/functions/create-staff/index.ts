// Admin-only edge function to create a staff account (admin or driver)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "admin" | "driver" | "accountant";

interface Body {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: Role;
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

    // 1) Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check role using has_role function via service-role
    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    const { data: isAccountantData } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "accountant",
    });
    const isAdmin = !!isAdminData;
    const isAccountant = !!isAccountantData;

    if (!isAdmin && !isAccountant) {
      return json({ error: "Forbidden: admin or accountant only" }, 403);
    }

    // 2) Validate body
    const body: Body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const full_name = (body.full_name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const role = body.role;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "إيميل غير صالح" }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: "كلمة السر يجب أن تكون 6 أحرف فأكثر" }, 400);
    }
    if (role !== "admin" && role !== "driver" && role !== "accountant") {
      return json({ error: "الدور غير صالح" }, 400);
    }
    // Accountants can only create drivers
    if (!isAdmin && role !== "driver") {
      return json({ error: "المحاسب يستطيع إنشاء سائقين فقط" }, 403);
    }
    if (full_name.length > 100 || phone.length > 25) {
      return json({ error: "بيانات غير صالحة" }, 400);
    }

    // 3) Create user (auto-confirmed so they can login immediately)
    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, phone },
      });

    if (createErr || !created?.user) {
      return json(
        { error: createErr?.message ?? "فشل إنشاء الحساب" },
        400,
      );
    }

    const newUserId = created.user.id;

    // 4) Ensure profile exists (trigger should handle, but upsert as safety)
    await admin
      .from("profiles")
      .upsert({ id: newUserId, full_name, phone }, { onConflict: "id" });

    // 5) Assign role
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .insert({ user_id: newUserId, role });

    if (roleInsertErr) {
      // Roll back user creation if role assignment fails
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: "فشل تعيين الدور: " + roleInsertErr.message }, 400);
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
