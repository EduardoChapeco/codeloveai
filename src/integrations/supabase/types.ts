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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          description: string
          id: string
          is_read: boolean
          reference_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_bank_info: {
        Row: {
          affiliate_id: string
          bank_name: string | null
          created_at: string
          holder_name: string
          id: string
          pix_key: string
          pix_key_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id: string
          bank_name?: string | null
          created_at?: string
          holder_name?: string
          id?: string
          pix_key?: string
          pix_key_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string
          bank_name?: string | null
          created_at?: string
          holder_name?: string
          id?: string
          pix_key?: string
          pix_key_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_bank_info_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_invoices: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          paid_at: string | null
          paid_by: string | null
          payment_notes: string | null
          status: string
          total_commission: number
          total_sales: number
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_notes?: string | null
          status?: string
          total_commission?: number
          total_sales?: number
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_notes?: string | null
          status?: string
          total_commission?: number
          total_sales?: number
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_invoices_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          commission_amount: number | null
          confirmed: boolean
          created_at: string
          id: string
          referred_user_id: string
          sale_amount: number | null
          subscription_id: string | null
          subscription_plan: string | null
        }
        Insert: {
          affiliate_id: string
          commission_amount?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          referred_user_id: string
          sale_amount?: number | null
          subscription_id?: string | null
          subscription_plan?: string | null
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          referred_user_id?: string
          sale_amount?: number | null
          subscription_id?: string | null
          subscription_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          created_at: string
          discount_percent: number
          display_name: string
          id: string
          user_id: string
        }
        Insert: {
          affiliate_code: string
          created_at?: string
          discount_percent?: number
          display_name?: string
          id?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string
          created_at?: string
          discount_percent?: number
          display_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      codecoin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          type: string
          user_id: string
          week_start: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          type: string
          user_id: string
          week_start?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
          week_start?: string | null
        }
        Relationships: []
      }
      codecoins: {
        Row: {
          balance: number
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extension_files: {
        Row: {
          created_at: string
          file_url: string
          id: string
          instructions: string
          is_latest: boolean
          uploaded_by: string
          version: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          instructions?: string
          is_latest?: boolean
          uploaded_by: string
          version: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          instructions?: string
          is_latest?: boolean
          uploaded_by?: string
          version?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          sender_id: string
          subscription_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
          subscription_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          affiliate_code: string | null
          created_at: string
          expires_at: string
          id: string
          payment_id: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Insert: {
          affiliate_code?: string | null
          created_at?: string
          expires_at: string
          id?: string
          payment_id?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Update: {
          affiliate_code?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id?: string
        }
        Relationships: []
      }
      tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin" | "member" | "affiliate"
      subscription_plan: "1_day" | "7_days" | "1_month" | "12_months"
      subscription_status: "active" | "expired" | "cancelled"
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
      app_role: ["admin", "member", "affiliate"],
      subscription_plan: ["1_day", "7_days", "1_month", "12_months"],
      subscription_status: ["active", "expired", "cancelled"],
    },
  },
} as const
