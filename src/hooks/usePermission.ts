import { useStaffPermissions, type StaffPermissions } from "@/hooks/useStaffPermissions";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Central permission gate for UI visibility.
 * - Super Admin & Store Admin: always allowed (backend RLS still enforced).
 * - Others: read from staff_permissions.permissions JSONB (Phase 5 primary model)
 *   with fallback to the legacy 6 boolean columns.
 *
 * Backend is always the source of truth; this only controls UI convenience.
 */
export function usePermission(key: keyof StaffPermissions | string): boolean {
  const { isSuperAdmin, isStoreAdmin } = useAuth();
  const { perms, extra } = useStaffPermissions();
  if (isSuperAdmin || isStoreAdmin) return true;
  if (key in perms) return !!(perms as unknown as Record<string, boolean>)[key];
  return !!extra[key];
}
