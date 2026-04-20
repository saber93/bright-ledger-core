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
      accounting_periods: {
        Row: {
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          entity_number: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          record_id: string | null
          summary: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          entity_number?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          entity_number?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          account_id: string | null
          bill_id: string
          created_at: string
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          bill_id: string
          created_at?: string
          description: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_line1: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_refunds: {
        Row: {
          amount: number
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          credit_note_id: string
          id: string
          method: string
          paid_at: string
          reference: string | null
          register_id: string | null
          session_id: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          credit_note_id: string
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
          register_id?: string | null
          session_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          credit_note_id?: string
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
          register_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_refunds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_refunds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_refunds_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_refunds_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pos_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_refunds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_session_events: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          reference: string | null
          session_id: string
          type: Database["public"]["Enums"]["cash_event_type"]
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          reference?: string | null
          session_id: string
          type: Database["public"]["Enums"]["cash_event_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          reference?: string | null
          session_id?: string
          type?: Database["public"]["Enums"]["cash_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          company_id: string
          counted_cash: number | null
          created_at: string
          expected_cash: number
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_cash: number
          register_id: string
          status: Database["public"]["Enums"]["cash_session_status"]
          updated_at: string
          variance: number | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          counted_cash?: number | null
          created_at?: string
          expected_cash?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_cash?: number
          register_id: string
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
          variance?: number | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          counted_cash?: number | null
          created_at?: string
          expected_cash?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_cash?: number
          register_id?: string
          status?: Database["public"]["Enums"]["cash_session_status"]
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pos_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          fiscal_year_start: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fiscal_year_start?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          fiscal_year_start?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_collection_policies: {
        Row: {
          auto_reminders_enabled: boolean
          auto_statements_enabled: boolean
          batch_limit: number
          company_id: string
          created_at: string
          created_by: string | null
          default_reply_to: string | null
          final_after_due_days: number
          final_template_key: string
          friendly_before_due_days: number
          friendly_template_key: string
          id: string
          invoice_template_key: string
          max_retry_attempts: number
          overdue_after_due_days: number
          overdue_template_key: string
          retry_delay_minutes: number
          sender_display_name: string | null
          statement_run_day: number
          statement_template_key: string
          throttle_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_reminders_enabled?: boolean
          auto_statements_enabled?: boolean
          batch_limit?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          default_reply_to?: string | null
          final_after_due_days?: number
          final_template_key?: string
          friendly_before_due_days?: number
          friendly_template_key?: string
          id?: string
          invoice_template_key?: string
          max_retry_attempts?: number
          overdue_after_due_days?: number
          overdue_template_key?: string
          retry_delay_minutes?: number
          sender_display_name?: string | null
          statement_run_day?: number
          statement_template_key?: string
          throttle_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_reminders_enabled?: boolean
          auto_statements_enabled?: boolean
          batch_limit?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          default_reply_to?: string | null
          final_after_due_days?: number
          final_template_key?: string
          friendly_before_due_days?: number
          friendly_template_key?: string
          id?: string
          invoice_template_key?: string
          max_retry_attempts?: number
          overdue_after_due_days?: number
          overdue_template_key?: string
          retry_delay_minutes?: number
          sender_display_name?: string | null
          statement_run_day?: number
          statement_template_key?: string
          throttle_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_collection_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          joined_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          accounting_enabled: boolean
          accounting_lock_date: string | null
          accounting_lock_reason: string | null
          bill_prefix: string
          cash_sessions_enabled: boolean
          company_id: string
          created_at: string
          date_format: string
          id: string
          inventory_enabled: boolean
          invoice_prefix: string
          online_payments_enabled: boolean
          online_store_enabled: boolean
          pos_allow_price_override: boolean
          pos_enabled: boolean
          quick_expenses_enabled: boolean
          refunds_enabled: boolean
          stock_tracking_enabled: boolean
          tax_reporting_enabled: boolean
          updated_at: string
        }
        Insert: {
          accounting_enabled?: boolean
          accounting_lock_date?: string | null
          accounting_lock_reason?: string | null
          bill_prefix?: string
          cash_sessions_enabled?: boolean
          company_id: string
          created_at?: string
          date_format?: string
          id?: string
          inventory_enabled?: boolean
          invoice_prefix?: string
          online_payments_enabled?: boolean
          online_store_enabled?: boolean
          pos_allow_price_override?: boolean
          pos_enabled?: boolean
          quick_expenses_enabled?: boolean
          refunds_enabled?: boolean
          stock_tracking_enabled?: boolean
          tax_reporting_enabled?: boolean
          updated_at?: string
        }
        Update: {
          accounting_enabled?: boolean
          accounting_lock_date?: string | null
          accounting_lock_reason?: string | null
          bill_prefix?: string
          cash_sessions_enabled?: boolean
          company_id?: string
          created_at?: string
          date_format?: string
          id?: string
          inventory_enabled?: boolean
          invoice_prefix?: string
          online_payments_enabled?: boolean
          online_store_enabled?: boolean
          pos_allow_price_override?: boolean
          pos_enabled?: boolean
          quick_expenses_enabled?: boolean
          refunds_enabled?: boolean
          stock_tracking_enabled?: boolean
          tax_reporting_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_allocations: {
        Row: {
          amount: number
          created_at: string
          credit_note_id: string
          id: string
          note: string | null
          target_invoice_id: string | null
          target_type: Database["public"]["Enums"]["credit_allocation_target"]
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_note_id: string
          id?: string
          note?: string | null
          target_invoice_id?: string | null
          target_type: Database["public"]["Enums"]["credit_allocation_target"]
        }
        Update: {
          amount?: number
          created_at?: string
          credit_note_id?: string
          id?: string
          note?: string | null
          target_invoice_id?: string | null
          target_type?: Database["public"]["Enums"]["credit_allocation_target"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_allocations_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_allocations_target_invoice_id_fkey"
            columns: ["target_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          id: string
          line_total: number
          position: number
          product_id: string | null
          quantity: number
          source_line_id: string | null
          source_line_type: string | null
          tax_amount: number
          tax_rate: number
          tax_rate_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          id?: string
          line_total?: number
          position?: number
          product_id?: string | null
          quantity?: number
          source_line_id?: string | null
          source_line_type?: string | null
          tax_amount?: number
          tax_rate?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          product_id?: string | null
          quantity?: number
          source_line_id?: string | null
          source_line_type?: string | null
          tax_amount?: number
          tax_rate?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_allocated: number
          company_id: string
          created_at: string
          created_by: string | null
          credit_note_number: string
          currency: string
          customer_id: string | null
          id: string
          issue_date: string
          notes: string | null
          reason: string | null
          restock: boolean
          source_invoice_id: string | null
          source_pos_order_id: string | null
          source_type: Database["public"]["Enums"]["credit_note_source"]
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_allocated?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          credit_note_number: string
          currency?: string
          customer_id?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          reason?: string | null
          restock?: boolean
          source_invoice_id?: string | null
          source_pos_order_id?: string | null
          source_type?: Database["public"]["Enums"]["credit_note_source"]
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_allocated?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          currency?: string
          customer_id?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          reason?: string | null
          restock?: boolean
          source_invoice_id?: string | null
          source_pos_order_id?: string | null
          source_type?: Database["public"]["Enums"]["credit_note_source"]
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_source_pos_order_id_fkey"
            columns: ["source_pos_order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_balance: {
        Row: {
          balance: number
          company_id: string
          currency: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          company_id: string
          currency?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          company_id?: string
          currency?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_balance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          amount_paid: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_deliveries: {
        Row: {
          attempt_count: number
          bounced_at: string | null
          channel: string
          clicked_at: string | null
          company_id: string
          complained_at: string | null
          dedupe_key: string | null
          delivered_at: string | null
          document_id: string
          document_number: string | null
          document_type: string
          error: string | null
          event_type: string
          id: string
          last_attempt_at: string | null
          last_error_kind: string | null
          last_event_at: string | null
          last_event_summary: string | null
          last_event_type: string | null
          message: string | null
          metadata: Json
          next_retry_at: string | null
          opened_at: string | null
          processed_at: string | null
          provider_message_id: string | null
          provider_name: string
          queued_at: string
          recipient: string | null
          recipient_email_normalized: string | null
          recipient_name: string | null
          rejected_at: string | null
          scheduled_for: string | null
          send_mode: string
          sent_at: string
          sent_by: string | null
          share_token_id: string | null
          source_href: string | null
          stage_key: string | null
          status: string
          subject: string | null
          suppressed_at: string | null
          template_key: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          bounced_at?: string | null
          channel: string
          clicked_at?: string | null
          company_id: string
          complained_at?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          document_id: string
          document_number?: string | null
          document_type: string
          error?: string | null
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error_kind?: string | null
          last_event_at?: string | null
          last_event_summary?: string | null
          last_event_type?: string | null
          message?: string | null
          metadata?: Json
          next_retry_at?: string | null
          opened_at?: string | null
          processed_at?: string | null
          provider_message_id?: string | null
          provider_name?: string
          queued_at?: string
          recipient?: string | null
          recipient_email_normalized?: string | null
          recipient_name?: string | null
          rejected_at?: string | null
          scheduled_for?: string | null
          send_mode?: string
          sent_at?: string
          sent_by?: string | null
          share_token_id?: string | null
          source_href?: string | null
          stage_key?: string | null
          status?: string
          subject?: string | null
          suppressed_at?: string | null
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          bounced_at?: string | null
          channel?: string
          clicked_at?: string | null
          company_id?: string
          complained_at?: string | null
          dedupe_key?: string | null
          delivered_at?: string | null
          document_id?: string
          document_number?: string | null
          document_type?: string
          error?: string | null
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error_kind?: string | null
          last_event_at?: string | null
          last_event_summary?: string | null
          last_event_type?: string | null
          message?: string | null
          metadata?: Json
          next_retry_at?: string | null
          opened_at?: string | null
          processed_at?: string | null
          provider_message_id?: string | null
          provider_name?: string
          queued_at?: string
          recipient?: string | null
          recipient_email_normalized?: string | null
          recipient_name?: string | null
          rejected_at?: string | null
          scheduled_for?: string | null
          send_mode?: string
          sent_at?: string
          sent_by?: string | null
          share_token_id?: string | null
          source_href?: string | null
          stage_key?: string | null
          status?: string
          subject?: string | null
          suppressed_at?: string | null
          template_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_deliveries_share_token_id_fkey"
            columns: ["share_token_id"]
            isOneToOne: false
            referencedRelation: "document_share_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      document_delivery_events: {
        Row: {
          company_id: string
          created_at: string
          delivery_id: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          provider_message_id: string | null
          provider_name: string
          severity: string
          summary: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_id: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          provider_message_id?: string | null
          provider_name?: string
          severity?: string
          summary?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          provider_message_id?: string | null
          provider_name?: string
          severity?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_delivery_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "document_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      document_delivery_outbox: {
        Row: {
          attempt_count: number
          company_id: string
          created_at: string
          dedupe_key: string | null
          delivery_id: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_error_kind: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          processed_at: string | null
          send_mode: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          company_id: string
          created_at?: string
          dedupe_key?: string | null
          delivery_id: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_error_kind?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          processed_at?: string | null
          send_mode?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          company_id?: string
          created_at?: string
          dedupe_key?: string | null
          delivery_id?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_error_kind?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          processed_at?: string | null
          send_mode?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_delivery_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_delivery_outbox_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "document_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      document_delivery_suppressions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          email_normalized: string
          id: string
          is_active: boolean
          reason: string | null
          scope: string
          source: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email: string
          email_normalized: string
          id?: string
          is_active?: boolean
          reason?: string | null
          scope?: string
          source?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          email_normalized?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          scope?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_delivery_suppressions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_email_templates: {
        Row: {
          body_template: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          payment_instructions: string | null
          subject_template: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_template: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          payment_instructions?: string | null
          subject_template: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_template?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          payment_instructions?: string | null
          subject_template?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_share_tokens: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          document_id: string
          document_type: string
          expires_at: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          document_id: string
          document_type: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_type?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_share_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          account_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          position: number
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          position?: number
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      online_order_lines: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          position: number
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          position?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          position?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "online_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "online_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      online_orders: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          placed_at: string
          shipping_address_line1: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["online_order_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          placed_at?: string
          shipping_address_line1?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["online_order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          placed_at?: string
          shipping_address_line1?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["online_order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          currency: string | null
          id: string
          payment_id: string | null
          provider: string
          provider_ref: string | null
          raw_payload: Json | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          currency?: string | null
          id?: string
          payment_id?: string | null
          provider: string
          provider_ref?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          payment_id?: string | null
          provider?: string
          provider_ref?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          party_id: string
          party_type: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          party_id: string
          party_type: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          party_id?: string
          party_type?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_lines: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          is_service: boolean
          line_total: number
          list_price: number
          note: string | null
          order_id: string
          position: number
          price_override_reason: string | null
          product_id: string | null
          quantity: number
          tax_amount: number
          tax_rate: number
          tax_rate_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          id?: string
          is_service?: boolean
          line_total?: number
          list_price?: number
          note?: string | null
          order_id: string
          position?: number
          price_override_reason?: string | null
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_rate?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          is_service?: boolean
          line_total?: number
          list_price?: number
          note?: string | null
          order_id?: string
          position?: number
          price_override_reason?: string | null
          product_id?: string | null
          quantity?: number
          tax_amount?: number
          tax_rate?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_lines_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          branch_id: string
          cashier_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_total: number
          id: string
          invoice_id: string | null
          notes: string | null
          order_number: string
          register_id: string
          session_id: string | null
          status: Database["public"]["Enums"]["pos_order_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          branch_id: string
          cashier_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_number: string
          register_id: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["pos_order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_number?: string
          register_id?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["pos_order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pos_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payments: {
        Row: {
          amount: number
          change_due: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["pos_payment_method"]
          order_id: string
          reference: string | null
        }
        Insert: {
          amount?: number
          change_due?: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["pos_payment_method"]
          order_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          change_due?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["pos_payment_method"]
          order_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_registers: {
        Row: {
          branch_id: string
          code: string
          company_id: string
          created_at: string
          default_warehouse_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          code: string
          company_id: string
          created_at?: string
          default_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          code?: string
          company_id?: string
          created_at?: string
          default_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_registers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_registers_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          company_id: string
          cost_price: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_published: boolean
          name: string
          reorder_point: number
          sale_price: number
          sku: string
          tax_rate: number
          type: Database["public"]["Enums"]["product_type"]
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_published?: boolean
          name: string
          reorder_point?: number
          sale_price?: number
          sku: string
          tax_rate?: number
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_published?: boolean
          name?: string
          reorder_point?: number
          sale_price?: number
          sku?: string
          tax_rate?: number
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_company_id: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_company_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_company_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_expenses: {
        Row: {
          account_id: string | null
          amount: number
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          date: string
          description: string
          expense_number: string
          id: string
          paid: boolean
          payable_account_id: string | null
          payment_method: Database["public"]["Enums"]["quick_expense_method"]
          receipt_url: string | null
          supplier_id: string | null
          tax_amount: number
          tax_rate_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description: string
          expense_number: string
          id?: string
          paid?: boolean
          payable_account_id?: string | null
          payment_method?: Database["public"]["Enums"]["quick_expense_method"]
          receipt_url?: string | null
          supplier_id?: string | null
          tax_amount?: number
          tax_rate_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          description?: string
          expense_number?: string
          id?: string
          paid?: boolean
          payable_account_id?: string | null
          payment_method?: Database["public"]["Enums"]["quick_expense_method"]
          receipt_url?: string | null
          supplier_id?: string | null
          tax_amount?: number
          tax_rate_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_expenses_payable_account_id_fkey"
            columns: ["payable_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_expenses_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          order_id: string
          position: number
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          order_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          order_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          company_id: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          occurred_at: string
          product_id: string
          quantity: number
          reference: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          product_id: string
          quantity: number
          reference?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          product_id?: string
          quantity?: number
          reference?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bills: {
        Row: {
          amount_paid: number
          bill_number: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          supplier_id: string
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          bill_number: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          supplier_id: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          bill_number?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          account_id: string | null
          company_id: string
          created_at: string
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_inclusive: boolean
          name: string
          rate: number
          type: Database["public"]["Enums"]["tax_rate_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_inclusive?: boolean
          name: string
          rate?: number
          type?: Database["public"]["Enums"]["tax_rate_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_inclusive?: boolean
          name?: string
          rate?: number
          type?: Database["public"]["Enums"]["tax_rate_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line1: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      accounting_ledger_adjustment_raw: {
        Row: {
          account_id: string | null
          branch_id: string | null
          company_id: string | null
          counterparty_id: string | null
          counterparty_name: string | null
          counterparty_type: string | null
          credit: number | null
          debit: number | null
          description: string | null
          document_id: string | null
          document_number: string | null
          document_type: string | null
          journal_date: string | null
          journal_key: string | null
          line_key: string | null
          payment_method: string | null
          posted_at: string | null
          reference: string | null
          sort_order: number | null
          source_href: string | null
          source_id: string | null
          source_type: string | null
        }
        Relationships: []
      }
      accounting_ledger_lines: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          amount: number | null
          branch_id: string | null
          company_id: string | null
          counterparty_id: string | null
          counterparty_name: string | null
          counterparty_type: string | null
          credit: number | null
          debit: number | null
          description: string | null
          document_id: string | null
          document_number: string | null
          document_type: string | null
          entry_side: string | null
          journal_date: string | null
          journal_key: string | null
          line_key: string | null
          payment_method: string | null
          posted_at: string | null
          reference: string | null
          sort_order: number | null
          source_href: string | null
          source_id: string | null
          source_type: string | null
        }
        Relationships: []
      }
      accounting_ledger_operational_raw: {
        Row: {
          account_id: string | null
          branch_id: string | null
          company_id: string | null
          counterparty_id: string | null
          counterparty_name: string | null
          counterparty_type: string | null
          credit: number | null
          debit: number | null
          description: string | null
          document_id: string | null
          document_number: string | null
          document_type: string | null
          journal_date: string | null
          journal_key: string | null
          line_key: string | null
          payment_method: string | null
          posted_at: string | null
          reference: string | null
          sort_order: number | null
          source_href: string | null
          source_id: string | null
          source_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accounting_account_balances: {
        Args: { _as_of: string; _branch_id?: string; _company_id: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance_net: number
          credit_balance: number
          debit_balance: number
        }[]
      }
      accounting_account_id: {
        Args: { _code: string; _company_id: string }
        Returns: string
      }
      accounting_account_ledger: {
        Args: {
          _account_id: string
          _branch_id?: string
          _company_id: string
          _from: string
          _to: string
        }
        Returns: {
          counterparty_name: string
          credit: number
          debit: number
          description: string
          document_id: string
          document_number: string
          document_type: string
          journal_date: string
          journal_key: string
          line_key: string
          opening_balance: number
          payment_method: string
          posted_at: string
          reference: string
          running_balance: number
          source_href: string
          source_type: string
        }[]
      }
      accounting_assert_period_unlocked: {
        Args: {
          _company_id: string
          _context?: string
          _effective_date: string
        }
        Returns: undefined
      }
      accounting_cash_account_id: {
        Args: { _company_id: string; _method: string }
        Returns: string
      }
      accounting_close_period: {
        Args: { _company_id: string; _period_start: string; _reason?: string }
        Returns: {
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "accounting_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_list_periods: {
        Args: {
          _company_id: string
          _months_back?: number
          _months_forward?: number
        }
        Returns: {
          close_reason: string
          closed_at: string
          closed_by: string
          id: string
          label: string
          period_end: string
          period_start: string
          reopen_reason: string
          reopened_at: string
          reopened_by: string
          status: string
        }[]
      }
      accounting_period_end: {
        Args: { _effective_date: string }
        Returns: string
      }
      accounting_period_start: {
        Args: { _effective_date: string }
        Returns: string
      }
      accounting_period_state: {
        Args: { _company_id: string; _effective_date: string }
        Returns: {
          is_locked: boolean
          label: string
          period_end: string
          period_start: string
          reason: string
          status: string
        }[]
      }
      accounting_reopen_period: {
        Args: { _company_id: string; _period_start: string; _reason?: string }
        Returns: {
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "accounting_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_reverse_payment: {
        Args: { _payment_id: string; _reason: string }
        Returns: {
          amount: number
          bill_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          party_id: string
          party_type: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_source_trace: {
        Args: {
          _company_id: string
          _document_ids?: string[]
          _document_type?: string
          _source_hrefs?: string[]
        }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          amount: number
          branch_id: string
          company_id: string
          counterparty_id: string
          counterparty_name: string
          counterparty_type: string
          credit: number
          debit: number
          description: string
          document_id: string
          document_number: string
          document_type: string
          entry_side: string
          journal_date: string
          journal_key: string
          line_key: string
          payment_method: string
          posted_at: string
          reference: string
          sort_order: number
          source_href: string
          source_id: string
          source_type: string
        }[]
      }
      accounting_sync_lock_mirror: {
        Args: { _company_id: string }
        Returns: undefined
      }
      accounting_trial_balance: {
        Args: {
          _branch_id?: string
          _company_id: string
          _from: string
          _to: string
        }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          closing_credit: number
          closing_debit: number
          opening_credit: number
          opening_debit: number
          period_credit: number
          period_debit: number
        }[]
      }
      accounting_void_bill: {
        Args: { _bill_id: string; _reason: string }
        Returns: {
          amount_paid: number
          bill_number: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          supplier_id: string
          tax_total: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "supplier_bills"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_void_credit_note: {
        Args: { _credit_note_id: string; _reason: string }
        Returns: {
          amount_allocated: number
          company_id: string
          created_at: string
          created_by: string | null
          credit_note_number: string
          currency: string
          customer_id: string | null
          id: string
          issue_date: string
          notes: string | null
          reason: string | null
          restock: boolean
          source_invoice_id: string | null
          source_pos_order_id: string | null
          source_type: Database["public"]["Enums"]["credit_note_source"]
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "credit_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_void_invoice: {
        Args: { _invoice_id: string; _reason: string }
        Returns: {
          amount_paid: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finance_assert_role: {
        Args: {
          _action: string
          _company_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: undefined
      }
      finance_audit_summary: {
        Args: {
          _action: string
          _after: Json
          _before: Json
          _table_name: string
        }
        Returns: string
      }
      finance_bypass_token: { Args: never; Returns: string }
      finance_integrity_warnings: {
        Args: { _company_id: string }
        Returns: {
          document_number: string
          journal_date: string
          kind: string
          message: string
          severity: string
          source_href: string
          source_id: string
          source_type: string
        }[]
      }
      finance_log_event: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _company_id: string
          _entity_number?: string
          _entity_type?: string
          _metadata?: Json
          _record_id: string
          _summary?: string
          _table_name: string
        }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _company_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role:
        | "owner"
        | "accountant"
        | "sales_manager"
        | "inventory_manager"
        | "store_manager"
        | "staff"
        | "cashier"
      bill_status:
        | "draft"
        | "received"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      cash_event_type:
        | "opening"
        | "sale"
        | "refund"
        | "cash_in"
        | "cash_out"
        | "payout"
        | "closing"
      cash_session_status: "open" | "closed"
      credit_allocation_target: "invoice" | "customer_credit" | "cash_refund"
      credit_note_source: "invoice" | "pos" | "manual"
      credit_note_status:
        | "draft"
        | "issued"
        | "partially_settled"
        | "settled"
        | "void"
      invoice_status:
        | "draft"
        | "sent"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      online_order_status:
        | "pending"
        | "paid"
        | "fulfilled"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_direction: "in" | "out"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "card"
        | "online_gateway"
        | "check"
        | "other"
      payment_status:
        | "pending"
        | "completed"
        | "failed"
        | "refunded"
        | "cancelled"
      pos_order_status:
        | "draft"
        | "held"
        | "completed"
        | "refunded"
        | "partially_refunded"
        | "cancelled"
      pos_payment_method:
        | "cash"
        | "card"
        | "transfer"
        | "credit"
        | "mixed"
        | "other"
      product_type: "goods" | "service" | "digital"
      quick_expense_method:
        | "cash"
        | "bank"
        | "card"
        | "petty_cash"
        | "unpaid"
        | "other"
      sales_order_status:
        | "draft"
        | "quotation"
        | "confirmed"
        | "fulfilled"
        | "invoiced"
        | "cancelled"
      stock_movement_type: "in" | "out" | "transfer" | "adjustment"
      tax_rate_type: "sales" | "purchase" | "both"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: [
        "owner",
        "accountant",
        "sales_manager",
        "inventory_manager",
        "store_manager",
        "staff",
        "cashier",
      ],
      bill_status: [
        "draft",
        "received",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      cash_event_type: [
        "opening",
        "sale",
        "refund",
        "cash_in",
        "cash_out",
        "payout",
        "closing",
      ],
      cash_session_status: ["open", "closed"],
      credit_allocation_target: ["invoice", "customer_credit", "cash_refund"],
      credit_note_source: ["invoice", "pos", "manual"],
      credit_note_status: [
        "draft",
        "issued",
        "partially_settled",
        "settled",
        "void",
      ],
      invoice_status: [
        "draft",
        "sent",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      online_order_status: [
        "pending",
        "paid",
        "fulfilled",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_direction: ["in", "out"],
      payment_method: [
        "cash",
        "bank_transfer",
        "card",
        "online_gateway",
        "check",
        "other",
      ],
      payment_status: [
        "pending",
        "completed",
        "failed",
        "refunded",
        "cancelled",
      ],
      pos_order_status: [
        "draft",
        "held",
        "completed",
        "refunded",
        "partially_refunded",
        "cancelled",
      ],
      pos_payment_method: [
        "cash",
        "card",
        "transfer",
        "credit",
        "mixed",
        "other",
      ],
      product_type: ["goods", "service", "digital"],
      quick_expense_method: [
        "cash",
        "bank",
        "card",
        "petty_cash",
        "unpaid",
        "other",
      ],
      sales_order_status: [
        "draft",
        "quotation",
        "confirmed",
        "fulfilled",
        "invoiced",
        "cancelled",
      ],
      stock_movement_type: ["in", "out", "transfer", "adjustment"],
      tax_rate_type: ["sales", "purchase", "both"],
    },
  },
} as const
