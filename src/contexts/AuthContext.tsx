import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Legacy role kept for backward compatibility with existing consumers
// (ProtectedRoute, useStaffPermissions, existing panels). super_admin and
// store_admin are mapped to "admin" for legacy checks.
export type Role = "admin" | "accountant" | "driver" | null;

// Full role set used by the new user-management surface.
export type AppRole =
  | "super_admin"
  | "store_admin"
  | "admin" // legacy, still valid
  | "accountant"
  | "driver"
  | "employee"
  | "cashier"
  | "inventory_manager";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  /** Legacy primary role (admin | accountant | driver | null). super_admin/store_admin → "admin". */
  role: Role;
  /** All roles the user holds (raw values). */
  roles: AppRole[];
  /** profiles.store_id for the current user, if any. */
  storeId: string | null;
  isSuperAdmin: boolean;
  isStoreAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  roles: [],
  storeId: null,
  isSuperAdmin: false,
  isStoreAdmin: false,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

const toLegacy = (roles: AppRole[]): Role => {
  if (roles.includes("super_admin") || roles.includes("store_admin") || roles.includes("admin")) return "admin";
  if (roles.includes("accountant")) return "accountant";
  if (roles.includes("driver")) return "driver";
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserMeta = async (userId: string): Promise<boolean> => {
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("store_id").eq("id", userId).maybeSingle(),
    ]);
    const nextRoles = ((roleRows ?? []).map((r: { role: string }) => r.role) as AppRole[]);
    const nextStoreId = (profile as { store_id: string | null } | null)?.store_id ?? null;

    // Block store-scoped users only when their store is inactive.
    // Super admins (no store_id, or super_admin role) are never blocked.
    const isSuper =
      nextRoles.includes("super_admin") ||
      (nextRoles.includes("admin") && nextStoreId === null);

    if (!isSuper && nextStoreId && nextRoles.length > 0) {
      const { data: store } = await supabase
        .from("stores")
        .select("status")
        .eq("id", nextStoreId)
        .maybeSingle();
      if (store && store.status === "inactive") {
        toast.error("تم إيقاف متجرك مؤقتاً، يرجى التواصل مع المدير العام");
        await supabase.auth.signOut();
        setRoles([]);
        setStoreId(null);
        setSession(null);
        setUser(null);
        return false;
      }
    }

    setRoles(nextRoles);
    setStoreId(nextStoreId);
    return true;
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer Supabase calls to avoid deadlock
        setTimeout(() => fetchUserMeta(newSession.user.id), 0);
      } else {
        setRoles([]);
        setStoreId(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchUserMeta(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setStoreId(null);
  };

  const refresh = async () => {
    if (user) await fetchUserMeta(user.id);
  };

  const isSuperAdmin =
    roles.includes("super_admin") ||
    // Legacy compatibility: an admin with no assigned store is a super admin.
    (roles.includes("admin") && storeId === null);
  const isStoreAdmin =
    roles.includes("store_admin") ||
    (roles.includes("admin") && storeId !== null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role: toLegacy(roles),
        roles,
        storeId,
        isSuperAdmin,
        isStoreAdmin,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
