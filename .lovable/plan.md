## Issue 1 — Stale-version toast / WhatsApp not opening

**Root cause:** The `order_items` INSERT policy contains `EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.status='new' ...)`. That subquery runs under the anon caller's RLS. Anon has an INSERT policy on `orders` but no SELECT policy, so the EXISTS returns false and the item insert is rejected with an RLS error. `submitOrder` catches it, shows "هذه النسخة قديمة…", and skips the WhatsApp redirect.

**Fix (migration):**
- Create `public.is_recent_new_order(_order_id uuid)` SECURITY DEFINER, checks the same conditions (status='new', archived_at IS NULL, created_at > now() - 10min). Grant EXECUTE to anon + authenticated.
- Replace the `order_items` INSERT policy's EXISTS with `public.is_recent_new_order(order_id)` so the check bypasses RLS.
- No change needed to anon SELECT on `orders`; tracking still goes through `get_orders_by_phone`.

## Issue 2 & 3 — Per-store delivery areas

Two tables exist: legacy global `delivery_zones` (used by storefront + `DeliveryZonesPanel`) and per-store `delivery_areas` (used by `StoreSetupWizard`, already has `store_id`, correct RLS). Consolidate on `delivery_areas`.

**Migration:**
- Tighten `delivery_areas` anon SELECT to only active areas of active stores (unchanged effectively; policy already `is_active=true`). Add `updated_at` column + trigger for parity with the panel.
- No destructive change to `delivery_zones` (kept intact so historical orders keep their FK).

**Frontend:**
- `src/hooks/useDeliveryZones.ts`: rewrite to read `delivery_areas` filtered by `storeId` (required arg), map `fee_iqd → price_iqd` shape or expose `fee_iqd` directly. Realtime subscription on `delivery_areas`.
- `src/components/DeliveryZonesPanel.tsx` (admin "أسعار التوصيل" tab):
  - Use `useStoreScope()` for effective `storeId`.
  - Show empty-state prompting to pick a store when super admin has none selected.
  - Insert/update/delete against `delivery_areas`, auto-set `store_id = storeId`.
  - Super admin: show a store label column when viewing (optional; still scoped to selected store — matches existing pattern for other panels).
- `src/pages/Index.tsx` (storefront checkout):
  - Load `delivery_areas` filtered by `selectedStore.id` (active only).
  - Remove `DELIVERY_FEE_IQD` fallback. Delivery fee = `selectedArea.fee_iqd`.
  - If cart non-empty and no area selected, block submit with toast "يرجى اختيار منطقة التوصيل".
  - Save `delivery_area_id` (and keep `delivery_zone_name` populated with the area name for display continuity in admin order cards).
- `src/lib/constants.ts`: drop `DELIVERY_FEE_IQD` export (or keep for legacy but unused).

**Files to modify:**
- new migration (SECURITY DEFINER function + order_items policy swap + delivery_areas updated_at)
- `src/hooks/useDeliveryZones.ts`
- `src/components/DeliveryZonesPanel.tsx`
- `src/pages/Index.tsx`
- `src/lib/constants.ts`

**Non-goals:** No changes to `delivery_zones` table/data. Existing orders keep their historical fee.

Approve to proceed.