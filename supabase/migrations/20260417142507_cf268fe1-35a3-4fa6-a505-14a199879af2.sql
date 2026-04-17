-- Module flags
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS pos_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_expenses_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_sessions_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_reporting_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunds_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_allow_price_override boolean NOT NULL DEFAULT true;

-- BRANCHES
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  address_line1 text,
  city text,
  country text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_branches_company ON public.branches(company_id);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view branches" ON public.branches FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Owners insert branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE POLICY "Owners update branches" ON public.branches FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE POLICY "Owners delete branches" ON public.branches FOR DELETE TO authenticated USING (has_role(auth.uid(), company_id, 'owner'::app_role));
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POS REGISTERS
CREATE TABLE public.pos_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  default_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_pos_registers_company ON public.pos_registers(company_id);
CREATE INDEX idx_pos_registers_branch ON public.pos_registers(branch_id);
ALTER TABLE public.pos_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view registers" ON public.pos_registers FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Owners insert registers" ON public.pos_registers FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE POLICY "Owners update registers" ON public.pos_registers FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE POLICY "Owners delete registers" ON public.pos_registers FOR DELETE TO authenticated USING (has_role(auth.uid(), company_id, 'owner'::app_role));
CREATE TRIGGER trg_registers_updated BEFORE UPDATE ON public.pos_registers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TAX RATES
CREATE TYPE public.tax_rate_type AS ENUM ('sales', 'purchase', 'both');

CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  rate numeric(8,4) NOT NULL DEFAULT 0,
  type public.tax_rate_type NOT NULL DEFAULT 'both',
  is_inclusive boolean NOT NULL DEFAULT false,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_rates_company ON public.tax_rates(company_id);
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view tax rates" ON public.tax_rates FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Accountants insert tax rates" ON public.tax_rates FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE POLICY "Accountants update tax rates" ON public.tax_rates FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE POLICY "Accountants delete tax rates" ON public.tax_rates FOR DELETE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE TRIGGER trg_tax_rates_updated BEFORE UPDATE ON public.tax_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CASH SESSIONS
CREATE TYPE public.cash_session_status AS ENUM ('open', 'closed');
CREATE TYPE public.cash_event_type AS ENUM ('opening', 'sale', 'refund', 'cash_in', 'cash_out', 'payout', 'closing');

CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  register_id uuid NOT NULL REFERENCES public.pos_registers(id) ON DELETE RESTRICT,
  opened_by uuid,
  closed_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  expected_cash numeric(14,2) NOT NULL DEFAULT 0,
  counted_cash numeric(14,2),
  variance numeric(14,2),
  notes text,
  status public.cash_session_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_sessions_company ON public.cash_sessions(company_id);
CREATE INDEX idx_cash_sessions_register ON public.cash_sessions(register_id);
CREATE UNIQUE INDEX idx_cash_sessions_one_open ON public.cash_sessions(register_id) WHERE status = 'open';
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view cash sessions" ON public.cash_sessions FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Cashiers insert cash sessions" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role]));
CREATE POLICY "Cashiers update cash sessions" ON public.cash_sessions FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role]));
CREATE POLICY "Owners delete cash sessions" ON public.cash_sessions FOR DELETE TO authenticated USING (has_role(auth.uid(), company_id, 'owner'::app_role));
CREATE TRIGGER trg_cash_sessions_updated BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cash_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type public.cash_event_type NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_events_session ON public.cash_session_events(session_id);
ALTER TABLE public.cash_session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view cash events" ON public.cash_session_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.cash_sessions s WHERE s.id = session_id AND has_company_access(auth.uid(), s.company_id)));
CREATE POLICY "Cashiers insert cash events" ON public.cash_session_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.cash_sessions s WHERE s.id = session_id AND has_any_role(auth.uid(), s.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role])));

-- POS ORDERS
CREATE TYPE public.pos_order_status AS ENUM ('draft', 'held', 'completed', 'refunded', 'partially_refunded', 'cancelled');
CREATE TYPE public.pos_payment_method AS ENUM ('cash', 'card', 'transfer', 'credit', 'mixed', 'other');

CREATE TABLE public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  register_id uuid NOT NULL REFERENCES public.pos_registers(id) ON DELETE RESTRICT,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id uuid,
  status public.pos_order_status NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);
CREATE INDEX idx_pos_orders_company ON public.pos_orders(company_id);
CREATE INDEX idx_pos_orders_session ON public.pos_orders(session_id);
CREATE INDEX idx_pos_orders_status ON public.pos_orders(status);
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view pos orders" ON public.pos_orders FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Cashiers insert pos orders" ON public.pos_orders FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role]));
CREATE POLICY "Cashiers update pos orders" ON public.pos_orders FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role]));
CREATE POLICY "Owners delete pos orders" ON public.pos_orders FOR DELETE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE TRIGGER trg_pos_orders_updated BEFORE UPDATE ON public.pos_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pos_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  is_service boolean NOT NULL DEFAULT false,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  list_price numeric(14,2) NOT NULL DEFAULT 0,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  price_override_reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_lines_order ON public.pos_order_lines(order_id);
ALTER TABLE public.pos_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view pos lines" ON public.pos_order_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = order_id AND has_company_access(auth.uid(), o.company_id)));
CREATE POLICY "Cashiers insert pos lines" ON public.pos_order_lines FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role])));
CREATE POLICY "Cashiers update pos lines" ON public.pos_order_lines FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role])));
CREATE POLICY "Cashiers delete pos lines" ON public.pos_order_lines FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role])));

CREATE TABLE public.pos_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  method public.pos_payment_method NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  change_due numeric(14,2) NOT NULL DEFAULT 0,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_payments_order ON public.pos_payments(order_id);
ALTER TABLE public.pos_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view pos payments" ON public.pos_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = order_id AND has_company_access(auth.uid(), o.company_id)));
CREATE POLICY "Cashiers insert pos payments" ON public.pos_payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role, 'store_manager'::app_role, 'sales_manager'::app_role])));

-- QUICK EXPENSES
CREATE TYPE public.quick_expense_method AS ENUM ('cash', 'bank', 'card', 'petty_cash', 'unpaid', 'other');

CREATE TABLE public.quick_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  expense_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  payment_method public.quick_expense_method NOT NULL DEFAULT 'cash',
  payable_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  description text NOT NULL,
  receipt_url text,
  paid boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'USD',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, expense_number)
);
CREATE INDEX idx_quick_expenses_company ON public.quick_expenses(company_id);
CREATE INDEX idx_quick_expenses_date ON public.quick_expenses(date);
ALTER TABLE public.quick_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view quick expenses" ON public.quick_expenses FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Cashiers insert quick expenses" ON public.quick_expenses FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role]));
CREATE POLICY "Cashiers update quick expenses" ON public.quick_expenses FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'cashier'::app_role]));
CREATE POLICY "Owners delete quick expenses" ON public.quick_expenses FOR DELETE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE TRIGGER trg_quick_expenses_updated BEFORE UPDATE ON public.quick_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CREDIT NOTES
CREATE TYPE public.credit_note_status AS ENUM ('draft', 'issued', 'partially_settled', 'settled', 'void');
CREATE TYPE public.credit_note_source AS ENUM ('invoice', 'pos', 'manual');
CREATE TYPE public.credit_allocation_target AS ENUM ('invoice', 'customer_credit', 'cash_refund');

CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credit_note_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  source_type public.credit_note_source NOT NULL DEFAULT 'invoice',
  source_invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  source_pos_order_id uuid REFERENCES public.pos_orders(id) ON DELETE SET NULL,
  reason text,
  status public.credit_note_status NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  amount_allocated numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  restock boolean NOT NULL DEFAULT false,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, credit_note_number)
);
CREATE INDEX idx_credit_notes_company ON public.credit_notes(company_id);
CREATE INDEX idx_credit_notes_customer ON public.credit_notes(customer_id);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view credit notes" ON public.credit_notes FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Sales insert credit notes" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role]));
CREATE POLICY "Sales update credit notes" ON public.credit_notes FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role]));
CREATE POLICY "Owners delete credit notes" ON public.credit_notes FOR DELETE TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role]));
CREATE TRIGGER trg_credit_notes_updated BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.credit_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  source_line_type text,
  source_line_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_lines_note ON public.credit_note_lines(credit_note_id);
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view credit lines" ON public.credit_note_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_notes c WHERE c.id = credit_note_id AND has_company_access(auth.uid(), c.company_id)));
CREATE POLICY "Sales manage credit lines" ON public.credit_note_lines FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_notes c WHERE c.id = credit_note_id AND has_any_role(auth.uid(), c.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role]))) WITH CHECK (EXISTS (SELECT 1 FROM public.credit_notes c WHERE c.id = credit_note_id AND has_any_role(auth.uid(), c.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role])));

CREATE TABLE public.credit_note_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  target_type public.credit_allocation_target NOT NULL,
  target_invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_alloc_note ON public.credit_note_allocations(credit_note_id);
ALTER TABLE public.credit_note_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view credit allocations" ON public.credit_note_allocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_notes c WHERE c.id = credit_note_id AND has_company_access(auth.uid(), c.company_id)));
CREATE POLICY "Sales manage credit allocations" ON public.credit_note_allocations FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_notes c WHERE c.id = credit_note_id AND has_any_role(auth.uid(), c.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role]))) WITH CHECK (EXISTS (SELECT 1 FROM public.credit_notes c WHERE c.id = credit_note_id AND has_any_role(auth.uid(), c.company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role])));

CREATE TABLE public.customer_credit_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, currency)
);
CREATE INDEX idx_customer_credit_company ON public.customer_credit_balance(company_id);
ALTER TABLE public.customer_credit_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view credit balance" ON public.customer_credit_balance FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Sales manage credit balance" ON public.customer_credit_balance FOR ALL TO authenticated USING (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role])) WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role]));

CREATE TABLE public.cash_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  register_id uuid REFERENCES public.pos_registers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'cash',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_refunds_company ON public.cash_refunds(company_id);
ALTER TABLE public.cash_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view cash refunds" ON public.cash_refunds FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Sales insert cash refunds" ON public.cash_refunds FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner'::app_role, 'accountant'::app_role, 'sales_manager'::app_role]));

-- DOCUMENT DELIVERIES
CREATE TABLE public.document_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  channel text NOT NULL,
  recipient text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_deliveries_company ON public.document_deliveries(company_id);
CREATE INDEX idx_doc_deliveries_doc ON public.document_deliveries(document_type, document_id);
ALTER TABLE public.document_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view doc deliveries" ON public.document_deliveries FOR SELECT TO authenticated USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Members insert doc deliveries" ON public.document_deliveries FOR INSERT TO authenticated WITH CHECK (has_company_access(auth.uid(), company_id));

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members view receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expense-receipts' AND has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Members upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense-receipts' AND has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Members delete receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'expense-receipts' AND has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));