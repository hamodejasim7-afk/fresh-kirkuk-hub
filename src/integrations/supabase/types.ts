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
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
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
          customer_address: string
          customer_name: string
          customer_phone: string
          delivery_fee_iqd: number
          driver_id: string | null
          id: string
          notes: string | null
          status: string
          total_iqd: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          customer_address: string
          customer_name: string
          customer_phone: string
          delivery_fee_iqd?: number
          driver_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          total_iqd?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          customer_address?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee_iqd?: number
          driver_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          total_iqd?: number
          updated_at?: string
        }
        Relationships: []
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
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string
          manage_categories: boolean
          manage_drivers: boolean
          manage_orders: boolean
          manage_pricing: boolean
          manage_products: boolean
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
          updated_at?: string
          user_id?: string
          view_reports?: boolean
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_accountant: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "driver" | "accountant"
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
      app_role: ["admin", "driver", "accountant"],
    },
  },
} as const
