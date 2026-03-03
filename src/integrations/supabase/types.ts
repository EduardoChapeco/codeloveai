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
      admin_commissions: {
        Row: {
          commission_amount: number
          commission_percent: number
          created_at: string
          id: string
          payment_id: string | null
          sale_amount: number
          subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          payment_id?: string | null
          sale_amount?: number
          subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          payment_id?: string | null
          sale_amount?: number
          subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          description: string
          id: string
          is_read: boolean
          reference_id: string | null
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "affiliate_bank_info_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_bank_info_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_invoice_items: {
        Row: {
          client_email: string
          client_name: string
          commission_amount: number
          created_at: string
          id: string
          invoice_id: string
          plan: string
          referral_id: string | null
          sale_amount: number
          tenant_id: string | null
        }
        Insert: {
          client_email?: string
          client_name?: string
          commission_amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          plan?: string
          referral_id?: string | null
          sale_amount?: number
          tenant_id?: string | null
        }
        Update: {
          client_email?: string
          client_name?: string
          commission_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          plan?: string
          referral_id?: string | null
          sale_amount?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "affiliate_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_invoice_items_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "affiliate_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          referred_email: string | null
          referred_name: string | null
          referred_user_id: string
          sale_amount: number | null
          subscription_id: string | null
          subscription_plan: string | null
          tenant_id: string | null
        }
        Insert: {
          affiliate_id: string
          commission_amount?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_name?: string | null
          referred_user_id: string
          sale_amount?: number | null
          subscription_id?: string | null
          subscription_plan?: string | null
          tenant_id?: string | null
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_name?: string | null
          referred_user_id?: string
          sale_amount?: number | null
          subscription_id?: string | null
          subscription_plan?: string | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "affiliate_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          bank_info: Json | null
          commission_rate: number
          created_at: string
          discount_percent: number
          display_name: string
          id: string
          pix_key: string | null
          referral_code: string | null
          tenant_id: string | null
          total_earned: number
          type: string
          user_id: string
        }
        Insert: {
          affiliate_code: string
          bank_info?: Json | null
          commission_rate?: number
          created_at?: string
          discount_percent?: number
          display_name?: string
          id?: string
          pix_key?: string | null
          referral_code?: string | null
          tenant_id?: string | null
          total_earned?: number
          type?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string
          bank_info?: Json | null
          commission_rate?: number
          created_at?: string
          discount_percent?: number
          display_name?: string
          id?: string
          pix_key?: string | null
          referral_code?: string | null
          tenant_id?: string | null
          total_earned?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_endpoint_config: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          model: string
          system_prompt: string | null
          tenant_id: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          endpoint_url: string
          id?: string
          is_active?: boolean
          model?: string
          system_prompt?: string | null
          tenant_id?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          model?: string
          system_prompt?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_endpoint_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_endpoint_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_vault: {
        Row: {
          api_key_encrypted: string
          created_at: string
          extra_config: Json | null
          id: string
          is_active: boolean
          label: string
          last_used_at: string | null
          provider: string
          requests_count: number
          updated_at: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          extra_config?: Json | null
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          provider: string
          requests_count?: number
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          extra_config?: Json | null
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          provider?: string
          requests_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          message: string
          model_used: string | null
          response: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          model_used?: string | null
          response?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          model_used?: string | null
          response?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_type: string
          created_at: string
          cron_expression: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          message_template: string
          name: string
          project_id: string
          run_count: number
          tenant_id: string | null
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          cron_expression?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          message_template?: string
          name: string
          project_id: string
          run_count?: number
          tenant_id?: string | null
          trigger_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          cron_expression?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          message_template?: string
          name?: string
          project_id?: string
          run_count?: number
          tenant_id?: string | null
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          created_at: string
          id: string
          result: string | null
          rule_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          result?: string | null
          rule_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          result?: string | null
          rule_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_outputs: {
        Row: {
          brain_project_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          request: string
          response: string
          skill: string
          status: string
          user_id: string
        }
        Insert: {
          brain_project_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          request: string
          response: string
          skill?: string
          status?: string
          user_id: string
        }
        Update: {
          brain_project_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          request?: string
          response?: string
          skill?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_outputs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "loveai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      brainchain_accounts: {
        Row: {
          access_expires_at: string | null
          access_token: string | null
          brain_project_id: string | null
          brain_type: string
          busy_since: string | null
          busy_user_id: string | null
          created_at: string | null
          email: string | null
          error_count: number | null
          id: string
          is_active: boolean | null
          is_busy: boolean | null
          label: string | null
          last_used_at: string | null
          refresh_token: string
          request_count: number | null
          updated_at: string | null
        }
        Insert: {
          access_expires_at?: string | null
          access_token?: string | null
          brain_project_id?: string | null
          brain_type?: string
          busy_since?: string | null
          busy_user_id?: string | null
          created_at?: string | null
          email?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_busy?: boolean | null
          label?: string | null
          last_used_at?: string | null
          refresh_token: string
          request_count?: number | null
          updated_at?: string | null
        }
        Update: {
          access_expires_at?: string | null
          access_token?: string | null
          brain_project_id?: string | null
          brain_type?: string
          busy_since?: string | null
          busy_user_id?: string | null
          created_at?: string | null
          email?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_busy?: boolean | null
          label?: string | null
          last_used_at?: string | null
          refresh_token?: string
          request_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      brainchain_queue: {
        Row: {
          account_id: string | null
          brain_type: string
          completed_at: string | null
          created_at: string | null
          error_msg: string | null
          expires_at: string | null
          id: string
          message: string
          response: string | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          brain_type?: string
          completed_at?: string | null
          created_at?: string | null
          error_msg?: string | null
          expires_at?: string | null
          id?: string
          message: string
          response?: string | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          brain_type?: string
          completed_at?: string | null
          created_at?: string | null
          error_msg?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          response?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brainchain_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "brainchain_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brainchain_usage: {
        Row: {
          account_id: string | null
          brain_type: string
          created_at: string | null
          duration_ms: number | null
          id: string
          queue_id: string | null
          success: boolean | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          brain_type: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          queue_id?: string | null
          success?: boolean | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          brain_type?: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          queue_id?: string | null
          success?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tenant_id: string | null
          tokens_used: number
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tenant_id?: string | null
          tokens_used?: number
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string | null
          tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      cirius_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cirius_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cirius_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cirius_generation_log: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_msg: string | null
          id: string
          input_json: Json | null
          level: string | null
          message: string | null
          metadata: Json | null
          output_json: Json | null
          project_id: string
          retry_count: number | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_msg?: string | null
          id?: string
          input_json?: Json | null
          level?: string | null
          message?: string | null
          metadata?: Json | null
          output_json?: Json | null
          project_id: string
          retry_count?: number | null
          status: string
          step: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_msg?: string | null
          id?: string
          input_json?: Json | null
          level?: string | null
          message?: string | null
          metadata?: Json | null
          output_json?: Json | null
          project_id?: string
          retry_count?: number | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "cirius_generation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cirius_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cirius_integrations: {
        Row: {
          access_token_enc: string | null
          account_id: string | null
          account_login: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_used_at: string | null
          project_ref: string | null
          provider: string
          provider_metadata: Json | null
          refresh_token_enc: string | null
          scopes: string[] | null
          service_key_enc: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          account_id?: string | null
          account_login?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_used_at?: string | null
          project_ref?: string | null
          provider: string
          provider_metadata?: Json | null
          refresh_token_enc?: string | null
          scopes?: string[] | null
          service_key_enc?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          account_id?: string | null
          account_login?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_used_at?: string | null
          project_ref?: string | null
          provider?: string
          provider_metadata?: Json | null
          refresh_token_enc?: string | null
          scopes?: string[] | null
          service_key_enc?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cirius_projects: {
        Row: {
          blueprint_json: Json | null
          brain_project_id: string | null
          brainchain_queue_id: string | null
          created_at: string | null
          current_step: string | null
          custom_domain: string | null
          deploy_config: Json | null
          deployed_at: string | null
          description: string | null
          error_message: string | null
          features: Json | null
          files_fingerprint: string | null
          generation_ended_at: string | null
          generation_engine: string | null
          generation_started_at: string | null
          github_branch: string | null
          github_repo: string | null
          github_url: string | null
          id: string
          lovable_project_id: string | null
          name: string
          netlify_site_id: string | null
          netlify_url: string | null
          orchestrator_project_id: string | null
          org_id: string | null
          prd_json: Json | null
          preview_url: string | null
          progress_pct: number | null
          source_files_json: Json | null
          source_url: string | null
          status: string | null
          supabase_project_id: string | null
          supabase_url: string | null
          tech_stack: Json | null
          template_type: string | null
          updated_at: string | null
          user_id: string
          vercel_project_id: string | null
          vercel_url: string | null
        }
        Insert: {
          blueprint_json?: Json | null
          brain_project_id?: string | null
          brainchain_queue_id?: string | null
          created_at?: string | null
          current_step?: string | null
          custom_domain?: string | null
          deploy_config?: Json | null
          deployed_at?: string | null
          description?: string | null
          error_message?: string | null
          features?: Json | null
          files_fingerprint?: string | null
          generation_ended_at?: string | null
          generation_engine?: string | null
          generation_started_at?: string | null
          github_branch?: string | null
          github_repo?: string | null
          github_url?: string | null
          id?: string
          lovable_project_id?: string | null
          name: string
          netlify_site_id?: string | null
          netlify_url?: string | null
          orchestrator_project_id?: string | null
          org_id?: string | null
          prd_json?: Json | null
          preview_url?: string | null
          progress_pct?: number | null
          source_files_json?: Json | null
          source_url?: string | null
          status?: string | null
          supabase_project_id?: string | null
          supabase_url?: string | null
          tech_stack?: Json | null
          template_type?: string | null
          updated_at?: string | null
          user_id: string
          vercel_project_id?: string | null
          vercel_url?: string | null
        }
        Update: {
          blueprint_json?: Json | null
          brain_project_id?: string | null
          brainchain_queue_id?: string | null
          created_at?: string | null
          current_step?: string | null
          custom_domain?: string | null
          deploy_config?: Json | null
          deployed_at?: string | null
          description?: string | null
          error_message?: string | null
          features?: Json | null
          files_fingerprint?: string | null
          generation_ended_at?: string | null
          generation_engine?: string | null
          generation_started_at?: string | null
          github_branch?: string | null
          github_repo?: string | null
          github_url?: string | null
          id?: string
          lovable_project_id?: string | null
          name?: string
          netlify_site_id?: string | null
          netlify_url?: string | null
          orchestrator_project_id?: string | null
          org_id?: string | null
          prd_json?: Json | null
          preview_url?: string | null
          progress_pct?: number | null
          source_files_json?: Json | null
          source_url?: string | null
          status?: string | null
          supabase_project_id?: string | null
          supabase_url?: string | null
          tech_stack?: Json | null
          template_type?: string | null
          updated_at?: string | null
          user_id?: string
          vercel_project_id?: string | null
          vercel_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cirius_projects_brainchain_queue_id_fkey"
            columns: ["brainchain_queue_id"]
            isOneToOne: false
            referencedRelation: "brainchain_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cirius_projects_orchestrator_project_id_fkey"
            columns: ["orchestrator_project_id"]
            isOneToOne: false
            referencedRelation: "orchestrator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cirius_templates: {
        Row: {
          category: string | null
          created_at: string | null
          default_features: Json | null
          description: string | null
          id: string
          is_premium: boolean | null
          name: string
          preview_url: string | null
          prompt_template: string
          suggested_engine: string | null
          tags: string[] | null
          tech_stack: Json | null
          thumbnail_url: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          default_features?: Json | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          name: string
          preview_url?: string | null
          prompt_template: string
          suggested_engine?: string | null
          tags?: string[] | null
          tech_stack?: Json | null
          thumbnail_url?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          default_features?: Json | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          name?: string
          preview_url?: string | null
          prompt_template?: string
          suggested_engine?: string | null
          tags?: string[] | null
          tech_stack?: Json | null
          thumbnail_url?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          access_token: string | null
          brain_project_id: string | null
          created_at: string | null
          email: string | null
          id: string
          label: string | null
          last_synced_at: string | null
          license_key: string
          refresh_token: string
          uid: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          brain_project_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          label?: string | null
          last_synced_at?: string | null
          license_key: string
          refresh_token: string
          uid?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          brain_project_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          label?: string | null
          last_synced_at?: string | null
          license_key?: string
          refresh_token?: string
          uid?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      code_snapshots: {
        Row: {
          created_at: string
          file_count: number | null
          files_json: Json | null
          fingerprint: string | null
          id: string
          phase: number | null
          project_id: string
          security_issues: Json | null
          seo_score: number | null
          task_id: string | null
        }
        Insert: {
          created_at?: string
          file_count?: number | null
          files_json?: Json | null
          fingerprint?: string | null
          id?: string
          phase?: number | null
          project_id: string
          security_issues?: Json | null
          seo_score?: number | null
          task_id?: string | null
        }
        Update: {
          created_at?: string
          file_count?: number | null
          files_json?: Json | null
          fingerprint?: string | null
          id?: string
          phase?: number | null
          project_id?: string
          security_issues?: Json | null
          seo_score?: number | null
          task_id?: string | null
        }
        Relationships: []
      }
      codecoin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          tenant_id: string | null
          type: string
          user_id: string
          week_start: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          tenant_id?: string | null
          type: string
          user_id: string
          week_start?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          tenant_id?: string | null
          type?: string
          user_id?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codecoin_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codecoin_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      codecoins: {
        Row: {
          balance: number
          id: string
          tenant_id: string | null
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          tenant_id?: string | null
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          tenant_id?: string | null
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "codecoins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codecoins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string
          id: string
          license_id: string | null
          paid_at: string | null
          payout_batch_id: string | null
          status: string
          tenant_id: string | null
          type: string
        }
        Insert: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          license_id?: string | null
          paid_at?: string | null
          payout_batch_id?: string | null
          status?: string
          tenant_id?: string | null
          type: string
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          license_id?: string | null
          paid_at?: string | null
          payout_batch_id?: string | null
          status?: string
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      community_channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean
          is_readonly: boolean
          name: string
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          is_readonly?: boolean
          name: string
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          is_readonly?: boolean
          name?: string
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      community_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_groups: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          icon_url: string | null
          id: string
          is_archived: boolean
          is_private: boolean
          members_count: number
          name: string
          posts_count: number
          rules: string | null
          slug: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_archived?: boolean
          is_private?: boolean
          members_count?: number
          name: string
          posts_count?: number
          rules?: string | null
          slug: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_archived?: boolean
          is_private?: boolean
          members_count?: number
          name?: string
          posts_count?: number
          rules?: string | null
          slug?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          comments_count: number
          content: string
          copy_count: number
          created_at: string
          group_id: string | null
          id: string
          is_archived: boolean
          is_blurred: boolean
          is_deleted: boolean
          is_pinned: boolean
          likes_count: number
          link_preview_description: string | null
          link_preview_image: string | null
          link_preview_title: string | null
          link_url: string | null
          media_urls: string[] | null
          post_type: string
          project_name: string | null
          project_preview_image: string | null
          project_url: string | null
          prompt_text: string | null
          rewarded: boolean
          tenant_id: string | null
          title: string | null
          updated_at: string
          user_id: string
          views_count: number
        }
        Insert: {
          comments_count?: number
          content?: string
          copy_count?: number
          created_at?: string
          group_id?: string | null
          id?: string
          is_archived?: boolean
          is_blurred?: boolean
          is_deleted?: boolean
          is_pinned?: boolean
          likes_count?: number
          link_preview_description?: string | null
          link_preview_image?: string | null
          link_preview_title?: string | null
          link_url?: string | null
          media_urls?: string[] | null
          post_type?: string
          project_name?: string | null
          project_preview_image?: string | null
          project_url?: string | null
          prompt_text?: string | null
          rewarded?: boolean
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          views_count?: number
        }
        Update: {
          comments_count?: number
          content?: string
          copy_count?: number
          created_at?: string
          group_id?: string | null
          id?: string
          is_archived?: boolean
          is_blurred?: boolean
          is_deleted?: boolean
          is_pinned?: boolean
          likes_count?: number
          link_preview_description?: string | null
          link_preview_image?: string | null
          link_preview_title?: string | null
          link_url?: string | null
          media_urls?: string[] | null
          post_type?: string
          project_name?: string | null
          project_preview_image?: string | null
          project_url?: string | null
          prompt_text?: string | null
          rewarded?: boolean
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          reputation: number
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          reputation?: number
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          reputation?: number
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      community_test_feedback: {
        Row: {
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          reaction_type: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          reaction_type?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          reaction_type?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_test_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "community_test_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_test_sessions: {
        Row: {
          closed_at: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          feedbacks_count: number
          id: string
          preview_url: string
          project_name: string | null
          reactions_count: number
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          feedbacks_count?: number
          id?: string
          preview_url: string
          project_name?: string | null
          reactions_count?: number
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          feedbacks_count?: number
          id?: string
          preview_url?: string
          project_name?: string | null
          reactions_count?: number
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_test_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_test_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: string
          contact_id: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          activity_type?: string
          contact_id: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          contact_id?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          created_at: string
          cron_expression: string | null
          failed_count: number | null
          id: string
          media_type: string | null
          media_url: string | null
          message_template: string
          name: string
          schedule_at: string | null
          sent_count: number | null
          status: string
          target_list_id: string | null
          target_tags: string[] | null
          tenant_id: string
          total_recipients: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cron_expression?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_template: string
          name: string
          schedule_at?: string | null
          sent_count?: number | null
          status?: string
          target_list_id?: string | null
          target_tags?: string[] | null
          tenant_id: string
          total_recipients?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cron_expression?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_template?: string
          name?: string
          schedule_at?: string | null
          sent_count?: number | null
          status?: string
          target_list_id?: string | null
          target_tags?: string[] | null
          tenant_id?: string
          total_recipients?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_target_list_id_fkey"
            columns: ["target_list_id"]
            isOneToOne: false
            referencedRelation: "crm_contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_lists: {
        Row: {
          created_at: string
          duplicates_found: number | null
          file_name: string | null
          id: string
          imported_count: number | null
          name: string
          status: string
          tenant_id: string
          total_rows: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicates_found?: number | null
          file_name?: string | null
          id?: string
          imported_count?: number | null
          name: string
          status?: string
          tenant_id: string
          total_rows?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duplicates_found?: number | null
          file_name?: string | null
          id?: string
          imported_count?: number | null
          name?: string
          status?: string
          tenant_id?: string
          total_rows?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          avatar_url: string | null
          city: string | null
          company: string | null
          conversion_value: number | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          is_international: boolean | null
          last_interaction_at: string | null
          metadata: Json | null
          name: string | null
          notes: string | null
          phone: string
          phone_normalized: string
          pipeline_moved_at: string | null
          pipeline_stage: string
          source: string | null
          tags: string[] | null
          tenant_id: string
          total_messages_received: number
          total_messages_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          conversion_value?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_international?: boolean | null
          last_interaction_at?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          phone: string
          phone_normalized: string
          pipeline_moved_at?: string | null
          pipeline_stage?: string
          source?: string | null
          tags?: string[] | null
          tenant_id: string
          total_messages_received?: number
          total_messages_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          conversion_value?: number | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_international?: boolean | null
          last_interaction_at?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          phone?: string
          phone_normalized?: string
          pipeline_moved_at?: string | null
          pipeline_stage?: string
          source?: string | null
          tags?: string[] | null
          tenant_id?: string
          total_messages_received?: number
          total_messages_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_queue: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          media_url: string | null
          message: string
          phone: string
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message: string
          phone: string
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message?: string
          phone?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_message_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_whatsapp_sessions: {
        Row: {
          api_key_encrypted: string | null
          api_provider: string | null
          created_at: string
          id: string
          instance_name: string | null
          is_connected: boolean | null
          last_connected_at: string | null
          last_ping_at: string | null
          session_data: Json | null
          tenant_id: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_provider?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_connected?: boolean | null
          last_connected_at?: string | null
          last_ping_at?: string | null
          session_data?: Json | null
          tenant_id: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_provider?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_connected?: boolean | null
          last_connected_at?: string | null
          last_ping_at?: string | null
          session_data?: Json | null
          tenant_id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_whatsapp_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage: {
        Row: {
          date: string
          id: string
          license_id: string
          messages_used: number
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          date?: string
          id?: string
          license_id: string
          messages_used?: number
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          license_id?: string
          messages_used?: number
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_usage_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments_log: {
        Row: {
          created_at: string
          deployment_id: string | null
          id: string
          lovable_project_id: string
          progress: Json | null
          status: string
          target_name: string | null
          target_url: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deployment_id?: string | null
          id?: string
          lovable_project_id: string
          progress?: Json | null
          status?: string
          target_name?: string | null
          target_url?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deployment_id?: string | null
          id?: string
          lovable_project_id?: string
          progress?: Json | null
          status?: string
          target_name?: string | null
          target_url?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          resend_id: string | null
          sent_by: string | null
          status: string
          subject: string
          template_slug: string | null
          tenant_id: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          resend_id?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_slug?: string | null
          tenant_id?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          resend_id?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_slug?: string | null
          tenant_id?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string
          description: string | null
          html_body: string
          id: string
          is_active: boolean
          name: string
          slug: string
          subject: string
          tenant_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          html_body?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          html_body?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_audit_log: {
        Row: {
          action: string
          created_at: string | null
          extension_key: string | null
          id: string
          ip_address: string | null
          license_key_hash: string | null
          metadata: Json | null
          project_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          extension_key?: string | null
          id?: string
          ip_address?: string | null
          license_key_hash?: string | null
          metadata?: Json | null
          project_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          extension_key?: string | null
          id?: string
          ip_address?: string | null
          license_key_hash?: string | null
          metadata?: Json | null
          project_id?: string | null
        }
        Relationships: []
      }
      extension_catalog: {
        Row: {
          created_at: string
          description: string
          display_order: number
          download_slug: string | null
          features: Json
          hero_color: string
          icon: string
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          requirements: string[]
          screenshots: string[]
          slug: string
          tagline: string
          tenant_id: string | null
          tier: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          download_slug?: string | null
          features?: Json
          hero_color?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          requirements?: string[]
          screenshots?: string[]
          slug: string
          tagline?: string
          tenant_id?: string | null
          tier?: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          download_slug?: string | null
          features?: Json
          hero_color?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          requirements?: string[]
          screenshots?: string[]
          slug?: string
          tagline?: string
          tenant_id?: string | null
          tier?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_files: {
        Row: {
          created_at: string
          extension_id: string | null
          file_url: string
          id: string
          instructions: string
          is_latest: boolean
          tenant_id: string | null
          uploaded_by: string
          version: string
        }
        Insert: {
          created_at?: string
          extension_id?: string | null
          file_url: string
          id?: string
          instructions?: string
          is_latest?: boolean
          tenant_id?: string | null
          uploaded_by: string
          version: string
        }
        Update: {
          created_at?: string
          extension_id?: string | null
          file_url?: string
          id?: string
          instructions?: string
          is_latest?: boolean
          tenant_id?: string | null
          uploaded_by?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_files_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "extension_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_usage_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          function_name: string
          id: string
          ip_address: string | null
          license_key_hash: string | null
          metadata: Json | null
          project_id: string | null
          response_status: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          function_name: string
          id?: string
          ip_address?: string | null
          license_key_hash?: string | null
          metadata?: Json | null
          project_id?: string | null
          response_status?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          function_name?: string
          id?: string
          ip_address?: string | null
          license_key_hash?: string | null
          metadata?: Json | null
          project_id?: string | null
          response_status?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled_for: string
          feature: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_for?: string
          feature: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_for?: string
          feature?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          name: string
          posts_count: number
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          posts_count?: number
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          posts_count?: number
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hashtags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hashtags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string
          description: string
          entry_type: string
          id: string
          payment_id: string | null
          reference_user_id: string | null
          subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          entry_type: string
          id?: string
          payment_id?: string | null
          reference_user_id?: string | null
          subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          entry_type?: string
          id?: string
          payment_id?: string | null
          reference_user_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          active: boolean
          affiliate_id: string | null
          created_at: string
          daily_messages: number | null
          device_id: string | null
          expires_at: string
          hourly_limit: number | null
          hours_used_month: number
          id: string
          key: string
          last_renewed_at: string | null
          last_reset_at: string | null
          last_validated_at: string | null
          messages_used_month: number
          messages_used_today: number
          plan: string
          plan_id: string | null
          plan_type: string
          status: string
          tenant_id: string | null
          token_valid_until: string | null
          trial_expires_at: string | null
          trial_started_at: string | null
          trial_used: boolean
          type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          affiliate_id?: string | null
          created_at?: string
          daily_messages?: number | null
          device_id?: string | null
          expires_at: string
          hourly_limit?: number | null
          hours_used_month?: number
          id?: string
          key: string
          last_renewed_at?: string | null
          last_reset_at?: string | null
          last_validated_at?: string | null
          messages_used_month?: number
          messages_used_today?: number
          plan?: string
          plan_id?: string | null
          plan_type?: string
          status?: string
          tenant_id?: string | null
          token_valid_until?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean
          type?: string
          user_id: string
        }
        Update: {
          active?: boolean
          affiliate_id?: string | null
          created_at?: string
          daily_messages?: number | null
          device_id?: string | null
          expires_at?: string
          hourly_limit?: number | null
          hours_used_month?: number
          id?: string
          key?: string
          last_renewed_at?: string | null
          last_reset_at?: string | null
          last_validated_at?: string | null
          messages_used_month?: number
          messages_used_today?: number
          plan?: string
          plan_id?: string | null
          plan_type?: string
          status?: string
          tenant_id?: string | null
          token_valid_until?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_user_id_profiles_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lovable_accounts: {
        Row: {
          auto_refresh_enabled: boolean
          created_at: string
          id: string
          is_admin_account: boolean | null
          last_verified_at: string | null
          refresh_failure_count: number
          refresh_token_encrypted: string | null
          status: string
          tenant_id: string | null
          token_encrypted: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_refresh_enabled?: boolean
          created_at?: string
          id?: string
          is_admin_account?: boolean | null
          last_verified_at?: string | null
          refresh_failure_count?: number
          refresh_token_encrypted?: string | null
          status?: string
          tenant_id?: string | null
          token_encrypted: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_refresh_enabled?: boolean
          created_at?: string
          id?: string
          is_admin_account?: boolean | null
          last_verified_at?: string | null
          refresh_failure_count?: number
          refresh_token_encrypted?: string | null
          status?: string
          tenant_id?: string | null
          token_encrypted?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lovable_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lovable_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lovable_api_calls_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          id: string
          method: string
          request_meta: Json | null
          response_meta: Json | null
          response_status: number | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          id?: string
          method: string
          request_meta?: Json | null
          response_meta?: Json | null
          response_status?: number | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          id?: string
          method?: string
          request_meta?: Json | null
          response_meta?: Json | null
          response_status?: number | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lovable_api_calls_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lovable_api_calls_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lovable_projects: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          latest_screenshot_url: string | null
          lovable_project_id: string
          name: string | null
          preview_build_commit_sha: string | null
          published_url: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          latest_screenshot_url?: string | null
          lovable_project_id: string
          name?: string | null
          preview_build_commit_sha?: string | null
          published_url?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          latest_screenshot_url?: string | null
          lovable_project_id?: string
          name?: string | null
          preview_build_commit_sha?: string | null
          published_url?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lovable_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lovable_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      loveai_conversations: {
        Row: {
          ai_response: string | null
          brain_message_id: string | null
          brain_type: string
          created_at: string
          id: string
          response_applied: boolean
          status: string
          target_project_id: string | null
          tenant_id: string | null
          user_id: string
          user_message: string
        }
        Insert: {
          ai_response?: string | null
          brain_message_id?: string | null
          brain_type?: string
          created_at?: string
          id?: string
          response_applied?: boolean
          status?: string
          target_project_id?: string | null
          tenant_id?: string | null
          user_id: string
          user_message: string
        }
        Update: {
          ai_response?: string | null
          brain_message_id?: string | null
          brain_type?: string
          created_at?: string
          id?: string
          response_applied?: boolean
          status?: string
          target_project_id?: string | null
          tenant_id?: string | null
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "loveai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loveai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          commission_rate: number
          created_at: string
          currency: string
          demo_credentials: Json | null
          demo_url: string | null
          description: string
          documentation_url: string | null
          features: Json | null
          highlights: string[] | null
          id: string
          is_featured: boolean
          long_description: string | null
          lovable_project_id: string | null
          media_urls: string[] | null
          preview_image_url: string | null
          preview_url: string | null
          price: number
          rating: number
          rating_count: number
          sales_count: number
          screenshots: string[] | null
          seller_id: string
          setup_instructions: string | null
          slug: string
          status: string
          tags: string[] | null
          tech_stack: string[] | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          views_count: number
        }
        Insert: {
          category?: string
          commission_rate?: number
          created_at?: string
          currency?: string
          demo_credentials?: Json | null
          demo_url?: string | null
          description?: string
          documentation_url?: string | null
          features?: Json | null
          highlights?: string[] | null
          id?: string
          is_featured?: boolean
          long_description?: string | null
          lovable_project_id?: string | null
          media_urls?: string[] | null
          preview_image_url?: string | null
          preview_url?: string | null
          price?: number
          rating?: number
          rating_count?: number
          sales_count?: number
          screenshots?: string[] | null
          seller_id: string
          setup_instructions?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          tech_stack?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          views_count?: number
        }
        Update: {
          category?: string
          commission_rate?: number
          created_at?: string
          currency?: string
          demo_credentials?: Json | null
          demo_url?: string | null
          description?: string
          documentation_url?: string | null
          features?: Json | null
          highlights?: string[] | null
          id?: string
          is_featured?: boolean
          long_description?: string | null
          lovable_project_id?: string | null
          media_urls?: string[] | null
          preview_image_url?: string | null
          preview_url?: string | null
          price?: number
          rating?: number
          rating_count?: number
          sales_count?: number
          screenshots?: string[] | null
          seller_id?: string
          setup_instructions?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          tech_stack?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_location_log: {
        Row: {
          accuracy: number | null
          consent_given: boolean | null
          created_at: string
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          purchase_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          consent_given?: boolean | null
          created_at?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          purchase_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          consent_given?: boolean | null
          created_at?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          purchase_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketplace_onboarding: {
        Row: {
          buyer_confirmed_delivery_at: string | null
          buyer_confirmed_project_at: string | null
          buyer_id: string
          buyer_location: Json | null
          created_at: string
          current_step: number
          id: string
          listing_id: string
          location_consent_buyer: boolean | null
          location_consent_seller: boolean | null
          notes: string | null
          payout_released_at: string | null
          purchase_id: string
          seller_id: string
          seller_location: Json | null
          seller_started_at: string | null
          status: string
          total_steps: number
          updated_at: string
        }
        Insert: {
          buyer_confirmed_delivery_at?: string | null
          buyer_confirmed_project_at?: string | null
          buyer_id: string
          buyer_location?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          listing_id: string
          location_consent_buyer?: boolean | null
          location_consent_seller?: boolean | null
          notes?: string | null
          payout_released_at?: string | null
          purchase_id: string
          seller_id: string
          seller_location?: Json | null
          seller_started_at?: string | null
          status?: string
          total_steps?: number
          updated_at?: string
        }
        Update: {
          buyer_confirmed_delivery_at?: string | null
          buyer_confirmed_project_at?: string | null
          buyer_id?: string
          buyer_location?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          listing_id?: string
          location_consent_buyer?: boolean | null
          location_consent_seller?: boolean | null
          notes?: string | null
          payout_released_at?: string | null
          purchase_id?: string
          seller_id?: string
          seller_location?: Json | null
          seller_started_at?: string | null
          status?: string
          total_steps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_onboarding_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "marketplace_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_onboarding_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          onboarding_id: string
          step_number: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          onboarding_id: string
          step_number: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          onboarding_id?: string
          step_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_onboarding_steps_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "marketplace_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_purchases: {
        Row: {
          buyer_id: string
          commission_amount: number
          created_at: string
          id: string
          listing_id: string
          payment_id: string | null
          payment_method: string | null
          price: number
          remixed_project_id: string | null
          seller_amount: number
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          commission_amount: number
          created_at?: string
          id?: string
          listing_id: string
          payment_id?: string | null
          payment_method?: string | null
          price: number
          remixed_project_id?: string | null
          seller_amount: number
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          commission_amount?: number
          created_at?: string
          id?: string
          listing_id?: string
          payment_id?: string | null
          payment_method?: string | null
          price?: number
          remixed_project_id?: string | null
          seller_amount?: number
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_verified_purchase: boolean
          listing_id: string
          purchase_id: string | null
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          listing_id: string
          purchase_id?: string | null
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_verified_purchase?: boolean
          listing_id?: string
          purchase_id?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "marketplace_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_seller_invoices: {
        Row: {
          buyer_confirmed: boolean | null
          buyer_id: string
          commission_amount: number
          created_at: string
          gross_amount: number
          hold_until: string
          id: string
          listing_id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payout_method: string | null
          payout_reference: string | null
          purchase_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_confirmed?: boolean | null
          buyer_id: string
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          hold_until?: string
          id?: string
          listing_id: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          purchase_id: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_confirmed?: boolean | null
          buyer_id?: string
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          hold_until?: string
          id?: string
          listing_id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          purchase_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_seller_invoices_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "marketplace_purchases"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
          subscription_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
          subscription_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      module_catalog: {
        Row: {
          billing_model: string
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          price_per_user_cents: number
          slug: string
        }
        Insert: {
          billing_model?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          price_per_user_cents?: number
          slug: string
        }
        Update: {
          billing_model?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          price_per_user_cents?: number
          slug?: string
        }
        Relationships: []
      }
      note_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          color: string
          created_at: string
          folder: string
          id: string
          pinned: boolean
          tenant_id: string | null
          text: string
          title: string
          ts: number
          updated: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          folder?: string
          id: string
          pinned?: boolean
          tenant_id?: string | null
          text?: string
          title?: string
          ts?: number
          updated?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          folder?: string
          id?: string
          pinned?: boolean
          tenant_id?: string | null
          text?: string
          title?: string
          ts?: number
          updated?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          role: string | null
          source: string | null
          task_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          role?: string | null
          source?: string | null
          task_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string | null
          source?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "orchestrator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestrator_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          project_id: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          project_id: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          project_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestrator_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "orchestrator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestrator_projects: {
        Row: {
          audit_required: boolean
          brain_id: string | null
          brain_skill_profile: string[] | null
          client_prompt: string
          created_at: string
          current_phase: number | null
          current_task_index: number
          ghost_created: boolean
          id: string
          last_error: string | null
          lovable_project_id: string | null
          next_tick_at: string | null
          prd_json: Json | null
          quality_score: number | null
          source_fingerprint: string | null
          status: string
          total_tasks: number
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          audit_required?: boolean
          brain_id?: string | null
          brain_skill_profile?: string[] | null
          client_prompt?: string
          created_at?: string
          current_phase?: number | null
          current_task_index?: number
          ghost_created?: boolean
          id?: string
          last_error?: string | null
          lovable_project_id?: string | null
          next_tick_at?: string | null
          prd_json?: Json | null
          quality_score?: number | null
          source_fingerprint?: string | null
          status?: string
          total_tasks?: number
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          audit_required?: boolean
          brain_id?: string | null
          brain_skill_profile?: string[] | null
          client_prompt?: string
          created_at?: string
          current_phase?: number | null
          current_task_index?: number
          ghost_created?: boolean
          id?: string
          last_error?: string | null
          lovable_project_id?: string | null
          next_tick_at?: string | null
          prd_json?: Json | null
          quality_score?: number | null
          source_fingerprint?: string | null
          status?: string
          total_tasks?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestrator_projects_brain_id_fkey"
            columns: ["brain_id"]
            isOneToOne: false
            referencedRelation: "user_brain_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestrator_tasks: {
        Row: {
          brain_skill: string | null
          brain_type: string | null
          completed_at: string | null
          created_at: string
          depends_on: number[] | null
          id: string
          intent: string
          lovable_message_id: string | null
          metadata: Json | null
          project_id: string
          prompt: string
          prompt_text: string | null
          required_audit_before: boolean
          retry_count: number
          started_at: string | null
          status: string
          stop_condition: string | null
          task_index: number
          title: string
        }
        Insert: {
          brain_skill?: string | null
          brain_type?: string | null
          completed_at?: string | null
          created_at?: string
          depends_on?: number[] | null
          id?: string
          intent?: string
          lovable_message_id?: string | null
          metadata?: Json | null
          project_id: string
          prompt?: string
          prompt_text?: string | null
          required_audit_before?: boolean
          retry_count?: number
          started_at?: string | null
          status?: string
          stop_condition?: string | null
          task_index?: number
          title?: string
        }
        Update: {
          brain_skill?: string | null
          brain_type?: string | null
          completed_at?: string | null
          created_at?: string
          depends_on?: number[] | null
          id?: string
          intent?: string
          lovable_message_id?: string | null
          metadata?: Json | null
          project_id?: string
          prompt?: string
          prompt_text?: string | null
          required_audit_before?: boolean
          retry_count?: number
          started_at?: string | null
          status?: string
          stop_condition?: string | null
          task_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestrator_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "orchestrator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batches: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          status: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      plan_extensions: {
        Row: {
          created_at: string
          extension_id: string
          id: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          extension_id: string
          id?: string
          plan_id: string
        }
        Update: {
          created_at?: string
          extension_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_extensions_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "extension_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_extensions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_cycle: string
          created_at: string
          daily_message_limit: number | null
          description: string | null
          display_name: string | null
          display_order: number
          extension_mode: string
          features: Json
          highlight_label: string | null
          hourly_limit: number | null
          id: string
          is_active: boolean
          is_promotional: boolean
          is_public: boolean
          max_projects: number | null
          modules: Json | null
          monthly_limit: number | null
          name: string
          price: number
          tenant_id: string | null
          trial_enabled: boolean
          trial_minutes: number
          type: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          daily_message_limit?: number | null
          description?: string | null
          display_name?: string | null
          display_order?: number
          extension_mode?: string
          features?: Json
          highlight_label?: string | null
          hourly_limit?: number | null
          id?: string
          is_active?: boolean
          is_promotional?: boolean
          is_public?: boolean
          max_projects?: number | null
          modules?: Json | null
          monthly_limit?: number | null
          name: string
          price?: number
          tenant_id?: string | null
          trial_enabled?: boolean
          trial_minutes?: number
          type?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          daily_message_limit?: number | null
          description?: string | null
          display_name?: string | null
          display_order?: number
          extension_mode?: string
          features?: Json
          highlight_label?: string | null
          hourly_limit?: number | null
          id?: string
          is_active?: boolean
          is_promotional?: boolean
          is_public?: boolean
          max_projects?: number | null
          modules?: Json | null
          monthly_limit?: number | null
          name?: string
          price?: number
          tenant_id?: string | null
          trial_enabled?: boolean
          trial_minutes?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          likes_count: number
          parent_id: string | null
          post_id: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          post_id: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          post_id?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      post_copies: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_copies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_copies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_copies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          hashtag_id: string
          id: string
          post_id: string
          tenant_id: string | null
        }
        Insert: {
          hashtag_id: string
          id?: string
          post_id: string
          tenant_id?: string | null
        }
        Update: {
          hashtag_id?: string
          id?: string
          post_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      project_source_snapshots: {
        Row: {
          last_checked: string
          project_id: string
          snapshot_hash: string | null
        }
        Insert: {
          last_checked?: string
          project_id: string
          snapshot_hash?: string | null
        }
        Update: {
          last_checked?: string
          project_id?: string
          snapshot_hash?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          github_url: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          rating: number
          rating_count: number
          skills: string[] | null
          total_revenue: number
          total_sales: number
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          github_url?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          rating?: number
          rating_count?: number
          skills?: string[] | null
          total_revenue?: number
          total_sales?: number
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          github_url?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          rating?: number
          rating_count?: number
          skills?: string[] | null
          total_revenue?: number
          total_sales?: number
          updated_at?: string
          user_id?: string
          website_url?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      supabase_migration_jobs: {
        Row: {
          created_at: string
          dest_service_role_key_encrypted: string | null
          dest_supabase_url: string | null
          error_log: string | null
          id: string
          last_sync_at: string | null
          project_id: string
          source_supabase_url: string | null
          status: string
          sync_active: boolean
          tables_migrated: Json | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dest_service_role_key_encrypted?: string | null
          dest_supabase_url?: string | null
          error_log?: string | null
          id?: string
          last_sync_at?: string | null
          project_id: string
          source_supabase_url?: string | null
          status?: string
          sync_active?: boolean
          tables_migrated?: Json | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dest_service_role_key_encrypted?: string | null
          dest_supabase_url?: string | null
          error_log?: string | null
          id?: string
          last_sync_at?: string | null
          project_id?: string
          source_supabase_url?: string | null
          status?: string
          sync_active?: boolean
          tables_migrated?: Json | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supabase_migration_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supabase_migration_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      support_brain_config: {
        Row: {
          admin_user_id: string
          brain_project_id: string
          created_at: string
          id: string
          is_active: boolean
          knowledge_version: number
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          brain_project_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          knowledge_version?: number
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          brain_project_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          knowledge_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          priority: string
          status: string
          tenant_id: string | null
          ticket_num: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          tenant_id?: string | null
          ticket_num?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          tenant_id?: string | null
          ticket_num?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_branding: {
        Row: {
          accent_color: string | null
          app_name: string
          community_group_enabled: boolean
          community_group_name: string | null
          community_max_channels: number
          custom_mode_prompt: string | null
          extension_mode: string
          logo_url: string | null
          modules: Json
          primary_color: string
          prompt_suggestions: Json
          secondary_color: string
          tenant_id: string
          trial_minutes: number
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          app_name?: string
          community_group_enabled?: boolean
          community_group_name?: string | null
          community_max_channels?: number
          custom_mode_prompt?: string | null
          extension_mode?: string
          logo_url?: string | null
          modules?: Json
          primary_color?: string
          prompt_suggestions?: Json
          secondary_color?: string
          tenant_id: string
          trial_minutes?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          app_name?: string
          community_group_enabled?: boolean
          community_group_name?: string | null
          community_max_channels?: number
          custom_mode_prompt?: string | null
          extension_mode?: string
          logo_url?: string | null
          modules?: Json
          primary_color?: string
          prompt_suggestions?: Json
          secondary_color?: string
          tenant_id?: string
          trial_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_extensions: {
        Row: {
          activation_cost: number
          created_at: string
          file_url: string
          id: string
          instructions: string
          is_enabled: boolean
          is_latest: boolean
          tenant_id: string
          version: string
        }
        Insert: {
          activation_cost?: number
          created_at?: string
          file_url: string
          id?: string
          instructions?: string
          is_enabled?: boolean
          is_latest?: boolean
          tenant_id: string
          version: string
        }
        Update: {
          activation_cost?: number
          created_at?: string
          file_url?: string
          id?: string
          instructions?: string
          is_enabled?: boolean
          is_latest?: boolean
          tenant_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_extensions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_extensions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invoice_items: {
        Row: {
          admin_commission: number
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          payment_id: string | null
          subscription_id: string | null
          tenant_revenue: number
        }
        Insert: {
          admin_commission?: number
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          payment_id?: string | null
          subscription_id?: string | null
          tenant_revenue?: number
        }
        Update: {
          admin_commission?: number
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          payment_id?: string | null
          subscription_id?: string | null
          tenant_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tenant_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invoice_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invoices: {
        Row: {
          admin_commission: number
          created_at: string
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          tenant_id: string
          tenant_revenue: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          admin_commission?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          tenant_id: string
          tenant_revenue?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          admin_commission?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string
          tenant_revenue?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_landing_sections: {
        Row: {
          config: Json | null
          created_at: string
          cta_link: string | null
          cta_text: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          section_key: string
          subtitle: string | null
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          section_key?: string
          subtitle?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          section_key?: string
          subtitle?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_landing_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_landing_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          billing_model_override: string | null
          created_at: string
          enabled: boolean
          id: string
          module_slug: string
          price_override_cents: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_model_override?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          module_slug: string
          price_override_cents?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_model_override?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          module_slug?: string
          price_override_cents?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_slug_fkey"
            columns: ["module_slug"]
            isOneToOne: false
            referencedRelation: "module_catalog"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          paid_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_wallets: {
        Row: {
          balance: number
          id: string
          tenant_id: string
          total_credited: number
          total_debited: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          tenant_id: string
          total_credited?: number
          total_debited?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          tenant_id?: string
          total_credited?: number
          total_debited?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string
          affiliate_global_split_percent: number | null
          affiliate_id: string | null
          border_radius: string
          branding: Json
          commission_percent: number
          created_at: string
          custom_ai_name: string | null
          custom_mode_prompt: string | null
          custom_orchestrator_name: string | null
          custom_venus_name: string | null
          domain: string | null
          domain_custom: string | null
          extension_mode: string | null
          favicon_url: string | null
          font_family: string
          global_split_percent: number | null
          id: string
          is_active: boolean
          is_domain_approved: boolean
          logo_url: string | null
          marketplace_commission_percent: number | null
          meta_description: string | null
          meta_title: string | null
          modules: Json | null
          monthly_user_cost: number | null
          mp_access_token: string | null
          name: string
          owner_user_id: string | null
          plan_type: string
          platform_fee_per_user: number | null
          primary_color: string
          secondary_color: string
          setup_paid: boolean | null
          setup_paid_at: string | null
          slug: string
          status: string
          terms_template: string | null
          theme_preset: string
          token_cost: number
          trial_minutes: number | null
          updated_at: string
          white_label_plan_id: string | null
        }
        Insert: {
          accent_color?: string
          affiliate_global_split_percent?: number | null
          affiliate_id?: string | null
          border_radius?: string
          branding?: Json
          commission_percent?: number
          created_at?: string
          custom_ai_name?: string | null
          custom_mode_prompt?: string | null
          custom_orchestrator_name?: string | null
          custom_venus_name?: string | null
          domain?: string | null
          domain_custom?: string | null
          extension_mode?: string | null
          favicon_url?: string | null
          font_family?: string
          global_split_percent?: number | null
          id?: string
          is_active?: boolean
          is_domain_approved?: boolean
          logo_url?: string | null
          marketplace_commission_percent?: number | null
          meta_description?: string | null
          meta_title?: string | null
          modules?: Json | null
          monthly_user_cost?: number | null
          mp_access_token?: string | null
          name: string
          owner_user_id?: string | null
          plan_type?: string
          platform_fee_per_user?: number | null
          primary_color?: string
          secondary_color?: string
          setup_paid?: boolean | null
          setup_paid_at?: string | null
          slug: string
          status?: string
          terms_template?: string | null
          theme_preset?: string
          token_cost?: number
          trial_minutes?: number | null
          updated_at?: string
          white_label_plan_id?: string | null
        }
        Update: {
          accent_color?: string
          affiliate_global_split_percent?: number | null
          affiliate_id?: string | null
          border_radius?: string
          branding?: Json
          commission_percent?: number
          created_at?: string
          custom_ai_name?: string | null
          custom_mode_prompt?: string | null
          custom_orchestrator_name?: string | null
          custom_venus_name?: string | null
          domain?: string | null
          domain_custom?: string | null
          extension_mode?: string | null
          favicon_url?: string | null
          font_family?: string
          global_split_percent?: number | null
          id?: string
          is_active?: boolean
          is_domain_approved?: boolean
          logo_url?: string | null
          marketplace_commission_percent?: number | null
          meta_description?: string | null
          meta_title?: string | null
          modules?: Json | null
          monthly_user_cost?: number | null
          mp_access_token?: string | null
          name?: string
          owner_user_id?: string | null
          plan_type?: string
          platform_fee_per_user?: number | null
          primary_color?: string
          secondary_color?: string
          setup_paid?: boolean | null
          setup_paid_at?: string | null
          slug?: string
          status?: string
          terms_template?: string | null
          theme_preset?: string
          token_cost?: number
          trial_minutes?: number | null
          updated_at?: string
          white_label_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_white_label_plan_id_fkey"
            columns: ["white_label_plan_id"]
            isOneToOne: false
            referencedRelation: "white_label_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      token_activations: {
        Row: {
          activated_at: string
          device_info: Json | null
          id: string
          ip_address: string | null
          location: string | null
          tenant_id: string | null
          token_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activated_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          location?: string | null
          tenant_id?: string | null
          token_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activated_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: string | null
          location?: string | null
          tenant_id?: string | null
          token_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_activations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_activations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_activations_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          tenant_id: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          affiliate_id: string | null
          amount: number
          commission_percent: number | null
          created_at: string
          description: string
          id: string
          mp_payment_id: string | null
          status: string
          tenant_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount?: number
          commission_percent?: number | null
          created_at?: string
          description?: string
          id?: string
          mp_payment_id?: string | null
          status?: string
          tenant_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          commission_percent?: number | null
          created_at?: string
          description?: string
          id?: string
          mp_payment_id?: string | null
          status?: string
          tenant_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_brain_projects: {
        Row: {
          brain_owner: string
          brain_skill: string
          brain_skills: string[]
          created_at: string
          id: string
          last_message_at: string | null
          lovable_project_id: string
          lovable_workspace_id: string
          name: string
          skill_phase: number | null
          source_fingerprint: string | null
          status: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          brain_owner?: string
          brain_skill?: string
          brain_skills?: string[]
          created_at?: string
          id?: string
          last_message_at?: string | null
          lovable_project_id: string
          lovable_workspace_id: string
          name?: string
          skill_phase?: number | null
          source_fingerprint?: string | null
          status?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          brain_owner?: string
          brain_skill?: string
          brain_skills?: string[]
          created_at?: string
          id?: string
          last_message_at?: string | null
          lovable_project_id?: string
          lovable_workspace_id?: string
          name?: string
          skill_phase?: number | null
          source_fingerprint?: string | null
          status?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_brain_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_brain_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_followers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_followers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          followers_count: number
          following_count: number
          id: string
          is_public: boolean
          posts_count: number
          social_github: string | null
          social_linkedin: string | null
          social_twitter: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          followers_count?: number
          following_count?: number
          id?: string
          is_public?: boolean
          posts_count?: number
          social_github?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          followers_count?: number
          following_count?: number
          id?: string
          is_public?: boolean
          posts_count?: number
          social_github?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
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
      venus_brain_projects: {
        Row: {
          brain_project_id: string | null
          connected: boolean | null
          created_at: string | null
          id: string
          last_sync: string | null
          lovable_project_id: string
        }
        Insert: {
          brain_project_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          lovable_project_id: string
        }
        Update: {
          brain_project_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          lovable_project_id?: string
        }
        Relationships: []
      }
      venus_github_tokens: {
        Row: {
          created_at: string | null
          gh_token: string
          gh_user: string | null
          id: string
          license_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gh_token: string
          gh_user?: string | null
          id?: string
          license_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gh_token?: string
          gh_user?: string | null
          id?: string
          license_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      venus_licenses: {
        Row: {
          active: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          license_key: string
          plan_name: string | null
          plan_type: string | null
          quota: number | null
          tenant_id: string | null
          used: number | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          license_key: string
          plan_name?: string | null
          plan_type?: string | null
          quota?: number | null
          tenant_id?: string | null
          used?: number | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          license_key?: string
          plan_name?: string | null
          plan_type?: string | null
          quota?: number | null
          tenant_id?: string | null
          used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      venus_notes: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          license_key: string
          project_id: string
          text: string
          ts: number | null
          updated_at: string | null
          x: number | null
          y: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          license_key: string
          project_id: string
          text: string
          ts?: number | null
          updated_at?: string | null
          x?: number | null
          y?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          license_key?: string
          project_id?: string
          text?: string
          ts?: number | null
          updated_at?: string | null
          x?: number | null
          y?: number | null
        }
        Relationships: []
      }
      venus_orch_projects: {
        Row: {
          client_prompt: string | null
          created_at: string | null
          current_task_index: number | null
          id: string
          license_key: string | null
          lovable_project_id: string
          prd: string | null
          status: string | null
          tasks: Json | null
          total_tasks: number | null
          updated_at: string | null
        }
        Insert: {
          client_prompt?: string | null
          created_at?: string | null
          current_task_index?: number | null
          id?: string
          license_key?: string | null
          lovable_project_id: string
          prd?: string | null
          status?: string | null
          tasks?: Json | null
          total_tasks?: number | null
          updated_at?: string | null
        }
        Update: {
          client_prompt?: string | null
          created_at?: string | null
          current_task_index?: number | null
          id?: string
          license_key?: string | null
          lovable_project_id?: string
          prd?: string | null
          status?: string | null
          tasks?: Json | null
          total_tasks?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      venus_rate_limits: {
        Row: {
          action: string
          id: string
          license_key: string
          request_count: number
          window_start: string
        }
        Insert: {
          action: string
          id?: string
          license_key: string
          request_count?: number
          window_start?: string
        }
        Update: {
          action?: string
          id?: string
          license_key?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      venus_tenants: {
        Row: {
          affiliate_url: string | null
          color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          plans_url: string | null
          url: string | null
        }
        Insert: {
          affiliate_url?: string | null
          color?: string | null
          created_at?: string | null
          id: string
          logo_url?: string | null
          name: string
          plans_url?: string | null
          url?: string | null
        }
        Update: {
          affiliate_url?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plans_url?: string | null
          url?: string | null
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          phone_number: string | null
          qr_code: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      white_label_affiliate_bank_info: {
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
            foreignKeyName: "white_label_affiliate_bank_info_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "white_label_affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      white_label_affiliate_invoices: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          paid_at: string | null
          paid_by: string | null
          payment_notes: string | null
          status: string
          total_commission_cents: number
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
          total_commission_cents?: number
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
          total_commission_cents?: number
          total_sales?: number
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "white_label_affiliate_invoices_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "white_label_affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      white_label_affiliates: {
        Row: {
          code: string
          commission_percent: number
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          commission_percent?: number
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          commission_percent?: number
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      white_label_plans: {
        Row: {
          affiliate_global_split_percent: number
          created_at: string
          description: string | null
          global_split_percent: number
          id: string
          is_active: boolean
          monthly_price_cents: number
          name: string
          setup_is_free: boolean
          setup_price_cents: number
          updated_at: string
          yearly_price_cents: number | null
        }
        Insert: {
          affiliate_global_split_percent?: number
          created_at?: string
          description?: string | null
          global_split_percent?: number
          id?: string
          is_active?: boolean
          monthly_price_cents?: number
          name: string
          setup_is_free?: boolean
          setup_price_cents?: number
          updated_at?: string
          yearly_price_cents?: number | null
        }
        Update: {
          affiliate_global_split_percent?: number
          created_at?: string
          description?: string | null
          global_split_percent?: number
          id?: string
          is_active?: boolean
          monthly_price_cents?: number
          name?: string
          setup_is_free?: boolean
          setup_price_cents?: number
          updated_at?: string
          yearly_price_cents?: number | null
        }
        Relationships: []
      }
      white_label_referrals: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          setup_commission_cents: number | null
          subscription_commission_cents: number | null
          tenant_id: string
          total_recurring_earned_cents: number | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          setup_commission_cents?: number | null
          subscription_commission_cents?: number | null
          tenant_id: string
          total_recurring_earned_cents?: number | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          setup_commission_cents?: number | null
          subscription_commission_cents?: number | null
          tenant_id?: string
          total_recurring_earned_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "white_label_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "white_label_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "white_label_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "white_label_referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      white_label_subscriptions: {
        Row: {
          affiliate_wl_code: string | null
          amount_cents: number
          created_at: string
          expires_at: string
          id: string
          owner_user_id: string
          payment_id: string | null
          period: string
          plan_id: string
          starts_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          affiliate_wl_code?: string | null
          amount_cents?: number
          created_at?: string
          expires_at: string
          id?: string
          owner_user_id: string
          payment_id?: string | null
          period?: string
          plan_id: string
          starts_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          affiliate_wl_code?: string | null
          amount_cents?: number
          created_at?: string
          expires_at?: string
          id?: string
          owner_user_id?: string
          payment_id?: string | null
          period?: string
          plan_id?: string
          starts_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "white_label_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "white_label_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "white_label_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "white_label_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelabel_config: {
        Row: {
          app_name: string | null
          colors: Json | null
          created_at: string | null
          extension_key: string
          id: string
          links: Json | null
          logo_url: string | null
          modules: Json | null
          tenant_id: string | null
          theme: string | null
          updated_at: string | null
        }
        Insert: {
          app_name?: string | null
          colors?: Json | null
          created_at?: string | null
          extension_key?: string
          id?: string
          links?: Json | null
          logo_url?: string | null
          modules?: Json | null
          tenant_id?: string | null
          theme?: string | null
          updated_at?: string | null
        }
        Update: {
          app_name?: string | null
          colors?: Json | null
          created_at?: string | null
          extension_key?: string
          id?: string
          links?: Json | null
          logo_url?: string | null
          modules?: Json | null
          tenant_id?: string | null
          theme?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whitelabel_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelabel_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_key_vault_safe: {
        Row: {
          api_key_masked: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          label: string | null
          last_used_at: string | null
          provider: string | null
          requests_count: number | null
          updated_at: string | null
        }
        Insert: {
          api_key_masked?: never
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          label?: string | null
          last_used_at?: string | null
          provider?: string | null
          requests_count?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key_masked?: never
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          label?: string | null
          last_used_at?: string | null
          provider?: string | null
          requests_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lovable_accounts_safe: {
        Row: {
          auto_refresh_enabled: boolean | null
          created_at: string | null
          id: string | null
          is_admin_account: boolean | null
          last_verified_at: string | null
          refresh_failure_count: number | null
          status: string | null
          tenant_id: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_refresh_enabled?: boolean | null
          created_at?: string | null
          id?: string | null
          is_admin_account?: boolean | null
          last_verified_at?: string | null
          refresh_failure_count?: number | null
          status?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_refresh_enabled?: boolean | null
          created_at?: string | null
          id?: string | null
          is_admin_account?: boolean | null
          last_verified_at?: string | null
          refresh_failure_count?: number | null
          status?: string | null
          tenant_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lovable_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lovable_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_jobs_safe: {
        Row: {
          created_at: string | null
          dest_supabase_url: string | null
          error_log: string | null
          id: string | null
          last_sync_at: string | null
          project_id: string | null
          source_supabase_url: string | null
          status: string | null
          sync_active: boolean | null
          tables_migrated: Json | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dest_supabase_url?: string | null
          error_log?: string | null
          id?: string | null
          last_sync_at?: string | null
          project_id?: string | null
          source_supabase_url?: string | null
          status?: string | null
          sync_active?: boolean | null
          tables_migrated?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dest_supabase_url?: string | null
          error_log?: string | null
          id?: string | null
          last_sync_at?: string | null
          project_id?: string | null
          source_supabase_url?: string | null
          status?: string | null
          sync_active?: boolean | null
          tables_migrated?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supabase_migration_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supabase_migration_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants_safe: {
        Row: {
          accent_color: string | null
          affiliate_global_split_percent: number | null
          affiliate_id: string | null
          border_radius: string | null
          branding: Json | null
          commission_percent: number | null
          created_at: string | null
          custom_mode_prompt: string | null
          domain: string | null
          domain_custom: string | null
          extension_mode: string | null
          favicon_url: string | null
          font_family: string | null
          global_split_percent: number | null
          id: string | null
          is_active: boolean | null
          is_domain_approved: boolean | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          modules: Json | null
          name: string | null
          owner_user_id: string | null
          plan_type: string | null
          platform_fee_per_user: number | null
          primary_color: string | null
          secondary_color: string | null
          setup_paid: boolean | null
          setup_paid_at: string | null
          slug: string | null
          status: string | null
          terms_template: string | null
          theme_preset: string | null
          token_cost: number | null
          trial_minutes: number | null
          updated_at: string | null
          white_label_plan_id: string | null
        }
        Insert: {
          accent_color?: string | null
          affiliate_global_split_percent?: number | null
          affiliate_id?: string | null
          border_radius?: string | null
          branding?: Json | null
          commission_percent?: number | null
          created_at?: string | null
          custom_mode_prompt?: string | null
          domain?: string | null
          domain_custom?: string | null
          extension_mode?: string | null
          favicon_url?: string | null
          font_family?: string | null
          global_split_percent?: number | null
          id?: string | null
          is_active?: boolean | null
          is_domain_approved?: boolean | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          modules?: Json | null
          name?: string | null
          owner_user_id?: string | null
          plan_type?: string | null
          platform_fee_per_user?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          setup_paid?: boolean | null
          setup_paid_at?: string | null
          slug?: string | null
          status?: string | null
          terms_template?: string | null
          theme_preset?: string | null
          token_cost?: number | null
          trial_minutes?: number | null
          updated_at?: string | null
          white_label_plan_id?: string | null
        }
        Update: {
          accent_color?: string | null
          affiliate_global_split_percent?: number | null
          affiliate_id?: string | null
          border_radius?: string | null
          branding?: Json | null
          commission_percent?: number | null
          created_at?: string | null
          custom_mode_prompt?: string | null
          domain?: string | null
          domain_custom?: string | null
          extension_mode?: string | null
          favicon_url?: string | null
          font_family?: string | null
          global_split_percent?: number | null
          id?: string | null
          is_active?: boolean | null
          is_domain_approved?: boolean | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          modules?: Json | null
          name?: string | null
          owner_user_id?: string | null
          plan_type?: string | null
          platform_fee_per_user?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          setup_paid?: boolean | null
          setup_paid_at?: string | null
          slug?: string | null
          status?: string | null
          terms_template?: string | null
          theme_preset?: string | null
          token_cost?: number | null
          trial_minutes?: number | null
          updated_at?: string | null
          white_label_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_white_label_plan_id_fkey"
            columns: ["white_label_plan_id"]
            isOneToOne: false
            referencedRelation: "white_label_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_summary: {
        Row: {
          active_days: number | null
          calls_today: number | null
          calls_week: number | null
          first_seen: string | null
          last_seen: string | null
          total_calls: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_feature_access: { Args: { p_feature: string }; Returns: boolean }
      get_user_primary_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      increment_daily_usage: {
        Args: { p_date: string; p_license_id: string }
        Returns: number
      }
      increment_errors: { Args: { acc_id: string }; Returns: number }
      increment_requests: { Args: { acc_id: string }; Returns: number }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member" | "affiliate"
      subscription_plan:
        | "1_day"
        | "7_days"
        | "1_month"
        | "12_months"
        | "lifetime"
      subscription_status: "active" | "expired" | "cancelled"
      tenant_role:
        | "tenant_owner"
        | "tenant_admin"
        | "tenant_member"
        | "tenant_support"
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
      subscription_plan: [
        "1_day",
        "7_days",
        "1_month",
        "12_months",
        "lifetime",
      ],
      subscription_status: ["active", "expired", "cancelled"],
      tenant_role: [
        "tenant_owner",
        "tenant_admin",
        "tenant_member",
        "tenant_support",
      ],
    },
  },
} as const
