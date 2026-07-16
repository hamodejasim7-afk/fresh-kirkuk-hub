## Plan: Per-store open/close + store-admin login flow

### Part 1 — Per-store open/close toggle
- **`src/pages/Admin.tsx`**: replace the `store_settings` toggle logic (~lines 1615-1650) so `toggleOpen` updates `stores.is_open` where `id = currentStore.id`. Read `isOpen` from `currentStore.is_open` (via `useStore()`), and disable the toggle when no store is selected. Store Admin already scoped to their own store via `StoreContext`, so no extra permission check needed beyond existing RLS.
- **`src/pages/Index.tsx`**: swap `storeSettings.is_open` references (lines 231, 271-276, 631-635, 699) for `currentStore?.is_open`. Drop the `store_settings` re-fetch on submit; instead re-check `currentStore.is_open` (already realtime via stores subscription in `useStores`), and if false show "المتجر مغلق حالياً".
- **`src/contexts/StoreContext.tsx`**: subscribe to `stores` row updates so `is_open` flips live for customers. (Verify — if `useStores` already handles realtime, skip.)
- **`src/components/StoresPanel.tsx`**: ensure Super Admin's stores list has a quick open/closed switch per row (add if missing).
- **Do NOT touch `store_settings` table** or `useStoreSettings` hook (leave file, just stop consuming `is_open` from it).

### Part 2 — Block login when store is closed/inactive
- **`src/contexts/AuthContext.tsx`**: after `fetchUserMeta` resolves, if the user has `storeId` AND is not `super_admin`, fetch `stores.status, is_open` for that store. If `status = 'inactive'` OR `is_open = false`:
  - `await supabase.auth.signOut()`
  - toast error: "تم إيقاف متجرك مؤقتاً، يرجى التواصل مع المدير العام"
  - clear local auth state
- Super Admin (no `store_id` / has `super_admin` role) bypasses this check.
- Customers (no roles) bypass entirely.
- **Note**: closing a store (`is_open = false`) will now also log out its store admins. If that's too aggressive and you only want `status = 'inactive'` to block login, say so — I'll narrow the check.

### Part 3 — Store Admin auto-select their store
- **`src/contexts/StoreContext.tsx`**: already pins non-super-admin users to `assignedStoreId` via `isPinnedStoreUser`. Verify:
  - selector never opens for pinned users ✓ (already handled)
  - `canSwitchStore = false` for pinned users ✓
  - Add: when pinned and the assigned store isn't in `activeStores` (e.g. inactive), still force-select it by fetching it directly, so the admin panel loads their store instead of falling back to Fresh default.
- **`src/components/StoreSelectorDialog.tsx`**: no change needed — it won't open for pinned users.

### Files to modify
1. `src/pages/Admin.tsx` — toggle uses `stores.is_open`
2. `src/pages/Index.tsx` — read `currentStore.is_open`
3. `src/contexts/AuthContext.tsx` — block login for closed/inactive store admins
4. `src/contexts/StoreContext.tsx` — ensure pinned store loads even if inactive/closed (edge case)
5. `src/components/StoresPanel.tsx` — verify per-row open toggle exists (add if not)

### Not touched
- `store_settings` table and migrations
- `useStoreSettings` hook file
- Customer browsing, order flow, existing RLS

Approve and I'll implement.