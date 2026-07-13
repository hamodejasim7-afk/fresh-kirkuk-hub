# Plan

## Issue 1 — Scope BulkPriceUpdate to current store

**File:** `src/components/BulkPriceUpdate.tsx`

- Use `useStoreScope()` to get the effective `storeId` (Super Admin → selected store from `StoreContext`; store user → their pinned `profiles.store_id`).
- Pass `storeId` into `useProducts({ storeId })` so the in-memory product list is already store-scoped. All matching/updating logic (`applyItems`) then only touches this store's products — no changes needed to the matching loop itself since it iterates `products`.
- `downloadTemplate()`: add `.eq("store_id", storeId)` to the Supabase query. If no `storeId` (Super Admin with no store selected), show a toast asking them to pick a store and abort.
- Guard the whole panel: if `ready && !storeId`, render a short notice ("اختر متجراً أولاً") instead of the upload buttons, so Super Admin can't accidentally run a global update.

No other files touched. Existing behavior for a scoped store admin is preserved.

## Issue 2 — Copy products between stores (Super Admin only)

**New file:** `src/components/CopyProductsDialog.tsx`

- Dialog with three sections:
  1. Source store `<Select>` (from `useStores({ onlyActive: false })`).
  2. Product list for source store — fetched on source-store change, rendered with checkboxes + "select all". Shows name, emoji, price.
  3. Target store `<Select>` (excludes the source store).
- "نسخ المنتجات المحددة" button:
  - Disabled until source, target, and at least one product are selected, and source ≠ target.
  - Fetches existing product names in target store (`select name where store_id = target`).
  - For each selected product: if name already exists in target → collect into a "skipped" list with the warning message; otherwise insert a new row with `{ name, category, emoji, unit, price_iqd, image_url, allow_decimal, sort_order, store_id: target, is_available: true, stock_qty: null }` (let DB generate `id` / `created_at`).
  - Loading state on the button while running; toast per outcome.
- After completion, show inline summary: `تم نسخ X منتج إلى متجر [اسم] بنجاح ✓` plus the list of skipped duplicates.

**File:** `src/components/ProductsPanel.tsx` (I'll open it first to confirm structure)

- Add a "نسخ منتجات" button in the panel header, rendered only when `useAuth().isSuperAdmin` is true. Clicking opens `CopyProductsDialog`.

## Technical notes

- Insert uses the existing RLS on `products`; Super Admin already has write access across stores, so no schema/policy changes needed.
- Duplicate detection is by exact `name` match within the target store (case-sensitive, matches how the price bot already keys products).
- No migrations. No changes to `useProducts`, `useStores`, or `AuthContext`.

## Files to modify / create

1. `src/components/BulkPriceUpdate.tsx` — scope to current store (edit).
2. `src/components/CopyProductsDialog.tsx` — new dialog (create).
3. `src/components/ProductsPanel.tsx` — add Super Admin "نسخ منتجات" button that opens the dialog (edit).

Awaiting your approval before making changes.
