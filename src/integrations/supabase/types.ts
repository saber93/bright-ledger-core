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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          record_id?: string | null
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
          channel: string
          company_id: string
          document_id: string
          document_type: string
          error: string | null
          id: string
          recipient: string | null
          sent_at: string
          sent_by: string | null
          status: string
        }
        Insert: {
          channel: string
          company_id: string
          document_id: string
          document_type: string
          error?: string | null
          id?: string
          recipient?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          channel?: string
          company_id?: string
          document_id?: string
          document_type?: string
          error?: string | null
          id?: string
          recipient?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_deliveries_company_id_fkey"
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
      [_ in never]: never
    }
    Functions: {
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
