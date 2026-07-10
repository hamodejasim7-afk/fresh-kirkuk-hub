import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STORE_ID } from "@/config/constants";
import type { Customer } from "@/types/loyalty";

/** Resolve the current user's store_id from their profile. */
async function resolveAuthStoreId(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("profiles").select("store_id").eq("id", uid).maybeSingle();
  return (data as { store_id: string | null } | null)?.store_id ?? null;
}


const normalizePhone = (raw: string) => raw.replace(/[^\d]/g, "");

export const validatePhone = (raw: string) => {
  const p = normalizePhone(raw);
  return p.length >= 10 && p.length <= 15;
};

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const p = normalizePhone(phone);
  if (!p) return null;
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", p)
    .maybeSingle();
  if (error) throw error;
  return (data as Customer | null) ?? null;
}

export async function findCustomerByQr(qr: string): Promise<Customer | null> {
  const q = qr.trim();
  if (!q) return null;
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("qr_code", q)
    .maybeSingle();
  if (error) throw error;
  return (data as Customer | null) ?? null;
}

export async function createCustomer(input: {
  full_name: string;
  phone: string;
  area?: string | null;
  store_id?: string | null;
}): Promise<Customer> {
  const full_name = input.full_name.trim();
  const phone = normalizePhone(input.phone);
  if (full_name.length < 2) throw new Error("الاسم قصير جداً");
  if (!validatePhone(phone)) throw new Error("رقم الهاتف غير صالح");

  // Auto-resolve store_id from the caller's profile when not provided,
  // so RLS ("store users insert own store customers") accepts the row.
  let storeId = input.store_id ?? null;
  if (!storeId) {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles").select("store_id").eq("id", uid).maybeSingle();
      storeId = (prof as { store_id: string | null } | null)?.store_id ?? null;
    }
  }

  const payload: {
    full_name: string;
    phone: string;
    area: string | null;
    store_id?: string;
  } = { full_name, phone, area: input.area?.trim() || null };
  if (storeId) payload.store_id = storeId;

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("رقم الهاتف مسجّل مسبقاً");
    throw error;
  }
  return data as Customer;
}


export async function updateCustomer(id: string, patch: Partial<Pick<Customer, "full_name" | "phone" | "area">>) {
  const clean: { full_name?: string; phone?: string; area?: string | null } = {};
  if (patch.full_name !== undefined) clean.full_name = patch.full_name.trim();
  if (patch.phone !== undefined) clean.phone = normalizePhone(patch.phone);
  if (patch.area !== undefined) clean.area = patch.area?.trim() || null;
  const { data, error } = await supabase
    .from("customers")
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Register a manual loyalty order.
 * Inserts an order tagged with the customer + delivered status.
 * The DB trigger `orders_apply_stamp` will atomically add the stamp.
 * Guards against duplicate submissions within a short window client-side too.
 */
export async function registerLoyaltyOrder(customer: Customer, userId: string | null) {
  const key = `loyalty:lastOrder:${customer.id}`;
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last < 5000) {
    throw new Error("تم تسجيل الطلبية للتو، انتظر لحظة");
  }

  // Always use the current authenticated session — never anon — for writes.
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? userId;
  if (!uid) {
    throw new Error("يجب تسجيل الدخول لتسجيل طلبية ولاء");
  }

  // Tag the loyalty order to the staff member's store so store-scoped RLS
  // reads (store_id = auth_store_id()) return it in that store's dashboard.
  // Falls back to DEFAULT_STORE_ID only when the caller has no assigned store.
  const authStoreId = (await resolveAuthStoreId()) ?? DEFAULT_STORE_ID;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      customer_name: customer.full_name,
      customer_phone: customer.phone,
      customer_address: customer.area ?? "بطاقة ولاء - طلبية يدوية",
      status: "delivered",
      total_iqd: 0,
      delivery_fee_iqd: 0,
      created_by: uid,
      notes: "طلبية ولاء يدوية",
      store_id: authStoreId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[registerLoyaltyOrder] insert failed", error);
    throw new Error(error.message || "فشل تسجيل الطلبية");
  }
  sessionStorage.setItem(key, String(Date.now()));
  return data;
}

export async function getLoyaltyStats() {
  const [customers, orders, todayOrders, monthOrders] = await Promise.all([
    supabase.from("customers").select("gift_count", { count: "exact" }),
    supabase.from("orders").select("id", { count: "exact", head: true }).not("customer_id", "is", null),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("customer_id", "is", null)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("customer_id", "is", null)
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  const giftsTotal = (customers.data ?? []).reduce((s, r) => s + (r.gift_count ?? 0), 0);
  return {
    customerCount: customers.count ?? (customers.data?.length ?? 0),
    orderCount: orders.count ?? 0,
    giftsTotal,
    todayOrders: todayOrders.count ?? 0,
    monthOrders: monthOrders.count ?? 0,
  };
}
