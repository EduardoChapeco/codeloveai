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
        ]
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
        ]
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
            foreignKeyName: "community_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
        ]
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
        ]
      }
      extension_files: {
        Row: {
          created_at: string
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
            foreignKeyName: "extension_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          display_order: number
          extension_mode: string
          features: Json
          highlight_label: string | null
          hourly_limit: number | null
          id: string
          is_active: boolean
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
          display_order?: number
          extension_mode?: string
          features?: Json
          highlight_label?: string | null
          hourly_limit?: number | null
          id?: string
          is_active?: boolean
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
          display_order?: number
          extension_mode?: string
          features?: Json
          highlight_label?: string | null
          hourly_limit?: number | null
          id?: string
          is_active?: boolean
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
        ]
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
          custom_mode_prompt: string | null
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
          meta_description: string | null
          meta_title: string | null
          modules: Json | null
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
          custom_mode_prompt?: string | null
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
          meta_description?: string | null
          meta_title?: string | null
          modules?: Json | null
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
          custom_mode_prompt?: string | null
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
          meta_description?: string | null
          meta_title?: string | null
          modules?: Json | null
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
        ]
      }
      user_brain_projects: {
        Row: {
          brain_owner: string
          created_at: string
          id: string
          last_message_at: string | null
          lovable_project_id: string
          lovable_workspace_id: string
          status: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          brain_owner?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lovable_project_id: string
          lovable_workspace_id: string
          status?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          brain_owner?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lovable_project_id?: string
          lovable_workspace_id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
