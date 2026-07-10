import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StaffPermissions {
  manage_orders: boolean;
  manage_pricing: boolean;
  manage_products: boolean;
  manage_categories: boolean;
  manage_drivers: boolean;
  view_reports: boolean;
}

export const DEFAULT_PERMISSIONS: StaffPermissions = {
  manage_orders: true,
  manage_pricing: true,
  manage_products: true,
  manage_categories: true,
  manage_drivers: true,
  view_reports: true,
};

const NO_PERMISSIONS: StaffPermissions = {
  manage_orders: false,
  manage_pricing: false,
  manage_products: false,
  manage_categories: false,
  manage_drivers: false,
  view_reports: false,
};

/**
 * Returns granular permissions for the current user.
 * - super_admin / store_admin / legacy admin: all true (backend still enforces via RLS)
 * - accountant: reads staff_permissions; legacy booleans + JSONB extras
 * - other roles: nothing
 *
 * Live-updates when an admin changes permissions.
 */
export const useStaffPermissions = (): {
  perms: StaffPermissions;
  extra: Record<string, boolean>;
  loading: boolean;
} => {
  const { user, role, isSuperAdmin, isStoreAdmin } = useAuth();
  const [perms, setPerms] = useState<StaffPermissions>(DEFAULT_PERMISSIONS);
  const [extra, setExtra] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPerms(DEFAULT_PERMISSIONS);
      setExtra({});
      setLoading(false);
      return;
    }
    if (isSuperAdmin || isStoreAdmin || role === "admin") {
      setPerms(DEFAULT_PERMISSIONS);
      setExtra({});
      setLoading(false);
      return;
    }
    if (role !== "accountant") {
      setPerms(NO_PERMISSIONS);
      setExtra({});
      setLoading(false);
      return;
    }

    let active = true;
    const fetchPerms = async () => {
      const { data } = await supabase
        .from("staff_permissions")
        .select(
          "manage_orders, manage_pricing, manage_products, manage_categories, manage_drivers, view_reports, permissions",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        const { permissions, ...booleans } = data as StaffPermissions & {
          permissions: Record<string, boolean> | null;
        };
        setPerms(booleans as StaffPermissions);
        setExtra(permissions ?? {});
      } else {
        setPerms(DEFAULT_PERMISSIONS);
        setExtra({});
      }
      setLoading(false);
    };
    fetchPerms();

    const channel = supabase
      .channel(`staff-perms-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_permissions", filter: `user_id=eq.${user.id}` },
        () => fetchPerms(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, role, isSuperAdmin, isStoreAdmin]);

  return { perms, extra, loading };
};
