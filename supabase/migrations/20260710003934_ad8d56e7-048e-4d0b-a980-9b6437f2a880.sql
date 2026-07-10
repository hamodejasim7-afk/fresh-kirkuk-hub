
-- Phase 5.1: extend app_role enum (values must be committed before they can be used)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'store_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inventory_manager';

-- Phase 5.1: stores.icon_url (logo_url + cover_url already exist)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS icon_url TEXT;
