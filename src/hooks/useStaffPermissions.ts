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

/**
 * Returns granular permissions for the current user.
 * - admin: always all true (bypass)
 * - accountant: reads from staff_permissions row; if missing, defaults to all true
 * - other: all false
 *
 * Updates in real time when an admin changes permissions.
 */
export const useStaffPermissions = (): { perms: StaffPermissions; loading: boolean } => {
  const { user, role } = useAuth();
  const [perms, setPerms] = useState<StaffPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPerms(DEFAULT_PERMISSIONS);
      setLoading(false);
      return;
    }
    if (role === "admin") {
      setPerms(DEFAULT_PERMISSIONS);
      setLoading(false);
      return;
    }
    if (role !== "accountant") {
      // drivers and others have no admin perms
      setPerms({
        manage_orders: false,
        manage_pricing: false,
        manage_products: false,
        manage_categories: false,
        manage_drivers: false,
        view_reports: false,
      });
      setLoading(false);
      return;
    }

    let active = true;
    const fetchPerms = async () => {
      const { data } = await supabase
        .from("staff_permissions")
        .select("manage_orders, manage_pricing, manage_products, manage_categories, manage_drivers, view_reports")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) setPerms(data as StaffPermissions);
      else setPerms(DEFAULT_PERMISSIONS);
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
  }, [user, role]);

  return { perms, loading };
};
