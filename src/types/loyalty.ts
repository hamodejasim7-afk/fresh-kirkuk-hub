export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  area: string | null;
  qr_code: string;
  total_stamps: number;
  gift_count: number;
  lifetime_orders: number;
  store_id: string | null;
  created_at: string;
  updated_at: string;
}


export const STAMPS_PER_GIFT = 10;
