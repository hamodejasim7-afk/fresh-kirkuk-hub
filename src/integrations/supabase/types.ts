export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          area: string | null
          created_at: string
          full_name: string
          gift_count: number
          id: string
          lifetime_orders: number
          phone: string
          qr_code: string
          total_stamps: number
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          full_name: string
          gift_count?: number
          id?: string
          lifetime_orders?: number
          phone: string
          qr_code?: string
          total_stamps?: number
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          full_name?: string
          gift_count?: number
          id?: string
          lifetime_orders?: number
          phone?: string
          qr_code?: string
          total_stamps?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_areas: {
        Row: {
          created_at: string | null
          fee_iqd: number
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          store_id: string
        }
        Insert: {
          created_at?: string | null
          fee_iqd?: number
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          store_id: string
        }
        Update: {
          created_at?: string | null
          fee_iqd?: number
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_areas_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_iqd: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_iqd?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_iqd?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          order_id: string
          price_iqd: number
          product_name: string
          quantity: number
          unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          order_id: string
          price_iqd: number
          product_name: string
          quantity: number
          unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          order_id?: string
          price_iqd?: number
          product_name?: string
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          customer_address: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_area_id: string | null
          delivery_fee_iqd: number
          delivery_zone_id: string | null
          delivery_zone_name: string | null
          driver_id: string | null
          id: string
          notes: string | null
          stamp_added: boolean
          status: string
          store_id: string
          total_iqd: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_address: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_area_id?: string | null
          delivery_fee_iqd?: number
          delivery_zone_id?: string | null
          delivery_zone_name?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          stamp_added?: boolean
          status?: string
          store_id: string
          total_iqd?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_area_id?: string | null
          delivery_fee_iqd?: number
          delivery_zone_id?: string | null
          delivery_zone_name?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          stamp_added?: boolean
          status?: string
          store_id?: string
          total_iqd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_area_id_fkey"
            columns: ["delivery_area_id"]
            isOneToOne: false
            referencedRelation: "delivery_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_decimal: boolean
          category: string
          created_at: string
          emoji: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price_iqd: number
          pricing_category: string
          sort_order: number
          stock_qty: number | null
          store_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          allow_decimal?: boolean
          category: string
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price_iqd?: number
          pricing_category?: string
          sort_order?: number
          stock_qty?: number | null
          store_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          allow_decimal?: boolean
          category?: string
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price_iqd?: number
          pricing_category?: string
          sort_order?: number
          stock_qty?: number | null
          store_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          created_at: string
          manage_categories: boolean
          manage_drivers: boolean
          manage_orders: boolean
          manage_pricing: boolean
          manage_products: boolean
          permissions: Json
          updated_at: string
          user_id: string
          view_reports: boolean
        }
        Insert: {
          created_at?: string
          manage_categories?: boolean
          manage_drivers?: boolean
          manage_orders?: boolean
          manage_pricing?: boolean
          manage_products?: boolean
          permissions?: Json
          updated_at?: string
          user_id: string
          view_reports?: boolean
        }
        Update: {
          created_at?: string
          manage_categories?: boolean
          manage_drivers?: boolean
          manage_orders?: boolean
          manage_pricing?: boolean
          manage_products?: boolean
          permissions?: Json
          updated_at?: string
          user_id?: string
          view_reports?: boolean
        }
        Relationships: []
      }
      store_configs: {
        Row: {
          ai_price_update_enabled: boolean | null
          created_at: string | null
          default_delivery_fee: number | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          notification_sound: boolean | null
          order_prefix: string | null
          store_id: string
          tiktok_url: string | null
          updated_at: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          ai_price_update_enabled?: boolean | null
          created_at?: string | null
          default_delivery_fee?: number | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          notification_sound?: boolean | null
          order_prefix?: string | null
          store_id: string
          tiktok_url?: string | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          ai_price_update_enabled?: boolean | null
          created_at?: string | null
          default_delivery_fee?: number | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          notification_sound?: boolean | null
          order_prefix?: string | null
          store_id?: string
          tiktok_url?: string | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "store_configs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          closed_message: string
          id: boolean
          is_open: boolean
          updated_at: string
        }
        Insert: {
          closed_message?: string
          id?: boolean
          is_open?: boolean
          updated_at?: string
        }
        Update: {
          closed_message?: string
          id?: boolean
          is_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          closing_time: string | null
          cover_url: string | null
          created_at: string | null
          currency: string | null
          delivery_enabled: boolean | null
          free_delivery_over: number | null
          icon_url: string | null
          id: string
          is_open: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          minimum_order: number | null
          name: string
          opening_time: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          sort_order: number | null
          status: string
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          closing_time?: string | null
          cover_url?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_enabled?: boolean | null
          free_delivery_over?: number | null
          icon_url?: string | null
          id?: string
          is_open?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          minimum_order?: number | null
          name: string
          opening_time?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          sort_order?: number | null
          status?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          closing_time?: string | null
          cover_url?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_enabled?: boolean | null
          free_delivery_over?: number | null
          icon_url?: string | null
          id?: string
          is_open?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          minimum_order?: number | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          sort_order?: number | null
          status?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_loyalty_stamp: {
        Args: { _order_id: string }
        Returns: {
          out_customer_id: string
          out_gift_awarded: boolean
          out_gift_count: number
          out_total_stamps: number
        }[]
      }
      auth_store_id: { Args: never; Returns: string }
      can_manage_user: { Args: { _target: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_accountant: { Args: { _user_id: string }; Returns: boolean }
      is_store_admin_of: { Args: { _store: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "driver"
        | "accountant"
        | "super_admin"
        | "store_admin"
        | "employee"
        | "cashier"
        | "inventory_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "driver",
        "accountant",
        "super_admin",
        "store_admin",
        "employee",
        "cashier",
        "inventory_manager",
      ],
    },
  },
} as const
