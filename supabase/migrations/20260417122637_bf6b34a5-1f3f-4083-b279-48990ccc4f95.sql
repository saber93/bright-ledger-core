
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM (
  'owner',
  'accountant',
  'sales_manager',
  'inventory_manager',
  'store_manager',
  'staff'
);

CREATE TYPE public.account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'income',
  'expense'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE public.bill_status AS ENUM (
  'draft',
  'received',
  'partial',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE public.payment_direction AS ENUM ('in', 'out');

CREATE TYPE public.payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'card',
  'online_gateway',
  'check',
  'other'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'completed',
  'failed',
  'refunded',
  'cancelled'
);

-- =========================================================================
-- UTILITY: updated_at trigger function
-- =========================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================================
-- COMPANIES (tenant root)
-- =========================================================================
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  country TEXT,
  fiscal_year_start DATE DEFAULT (date_trunc('year', now()))::date,
  logo_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- COMPANY MEMBERS
-- =========================================================================
CREATE TABLE public.company_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE INDEX idx_company_members_user ON public.company_members(user_id);
CREATE INDEX idx_company_members_company ON public.company_members(company_id);

CREATE TRIGGER trg_company_members_updated_at
  BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- USER ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
CREATE INDEX idx_user_roles_lookup ON public.user_roles(user_id, company_id);

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  default_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- COMPANY SETTINGS (feature flags + prefs)
-- =========================================================================
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  accounting_enabled BOOLEAN NOT NULL DEFAULT true,
  inventory_enabled BOOLEAN NOT NULL DEFAULT false,
  stock_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
  online_store_enabled BOOLEAN NOT NULL DEFAULT false,
  online_payments_enabled BOOLEAN NOT NULL DEFAULT false,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  bill_prefix TEXT NOT NULL DEFAULT 'BILL-',
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- SECURITY-DEFINER FUNCTIONS (RLS helpers)
-- =========================================================================

-- Has the user got any active membership in this company?
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
  );
$$;

-- Does the user have a specific role in a specific company?
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _company_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = _role
  );
$$;

-- Does the user have ANY of the given roles in the company?
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _company_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = ANY(_roles)
  );
$$;

-- =========================================================================
-- CHART OF ACCOUNTS
-- =========================================================================
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_coa_company ON public.chart_of_accounts(company_id);

CREATE TRIGGER trg_coa_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- CUSTOMERS
-- =========================================================================
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_customers_name ON public.customers(company_id, name);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- SUPPLIERS
-- =========================================================================
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX idx_suppliers_name ON public.suppliers(company_id, name);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- CUSTOMER INVOICES
-- =========================================================================
CREATE TABLE public.customer_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);
CREATE INDEX idx_invoices_company ON public.customer_invoices(company_id);
CREATE INDEX idx_invoices_customer ON public.customer_invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.customer_invoices(company_id, status);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

-- =========================================================================
-- SUPPLIER BILLS
-- =========================================================================
CREATE TABLE public.supplier_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  bill_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.bill_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, bill_number)
);
CREATE INDEX idx_bills_company ON public.supplier_bills(company_id);
CREATE INDEX idx_bills_supplier ON public.supplier_bills(supplier_id);
CREATE INDEX idx_bills_status ON public.supplier_bills(company_id, status);

CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON public.supplier_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bill_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.supplier_bills(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_lines_bill ON public.bill_lines(bill_id);

-- =========================================================================
-- PAYMENTS
-- =========================================================================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction public.payment_direction NOT NULL,
  party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  party_id UUID NOT NULL,
  invoice_id UUID REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  bill_id UUID REFERENCES public.supplier_bills(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  status public.payment_status NOT NULL DEFAULT 'completed',
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_company ON public.payments(company_id);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_payments_bill ON public.payments(bill_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(14,2),
  currency TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_tx_company ON public.payment_transactions(company_id);

-- =========================================================================
-- AUDIT LOGS
-- =========================================================================
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company ON public.audit_logs(company_id, created_at DESC);

-- =========================================================================
-- ENABLE RLS
-- =========================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- COMPANIES: members can see; only owner can update; anyone authenticated can insert (signup flow)
CREATE POLICY "Members view their companies" ON public.companies
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), id));

CREATE POLICY "Authenticated users create companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners update their company" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'owner'));

CREATE POLICY "Owners delete their company" ON public.companies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), id, 'owner'));

-- COMPANY_MEMBERS
CREATE POLICY "Members view memberships in their companies" ON public.company_members
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR user_id = auth.uid());

CREATE POLICY "Owners add members" ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), company_id, 'owner')
    OR (user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.company_members WHERE company_id = company_members.company_id
    ))
  );

CREATE POLICY "Owners update memberships" ON public.company_members
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'owner'));

CREATE POLICY "Owners remove members" ON public.company_members
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'owner'));

-- USER_ROLES
CREATE POLICY "Members view roles in their companies" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id) OR user_id = auth.uid());

CREATE POLICY "Owners assign roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), company_id, 'owner')
    OR (user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE company_id = user_roles.company_id
    ))
  );

CREATE POLICY "Owners update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'owner'));

CREATE POLICY "Owners delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'owner'));

-- PROFILES
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- COMPANY_SETTINGS
CREATE POLICY "Members view settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Owners insert settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), company_id, 'owner'));

CREATE POLICY "Owners update settings" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'owner'));

-- CHART_OF_ACCOUNTS
CREATE POLICY "Members view CoA" ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Accountants manage CoA insert" ON public.chart_of_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

CREATE POLICY "Accountants manage CoA update" ON public.chart_of_accounts
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

CREATE POLICY "Accountants manage CoA delete" ON public.chart_of_accounts
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

-- CUSTOMERS
CREATE POLICY "Members view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Members insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Members update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Owners delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

-- SUPPLIERS
CREATE POLICY "Members view suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Members insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Members update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Owners delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

-- CUSTOMER_INVOICES
CREATE POLICY "Members view invoices" ON public.customer_invoices
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Accountants insert invoices" ON public.customer_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[]));

CREATE POLICY "Accountants update invoices" ON public.customer_invoices
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[]));

CREATE POLICY "Accountants delete invoices" ON public.customer_invoices
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

-- INVOICE_LINES (inherit access via parent invoice)
CREATE POLICY "Members view invoice lines" ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_company_access(auth.uid(), i.company_id)
  ));

CREATE POLICY "Accountants insert invoice lines" ON public.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customer_invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_any_role(auth.uid(), i.company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  ));

CREATE POLICY "Accountants update invoice lines" ON public.invoice_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_any_role(auth.uid(), i.company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  ));

CREATE POLICY "Accountants delete invoice lines" ON public.invoice_lines
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_any_role(auth.uid(), i.company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  ));

-- SUPPLIER_BILLS
CREATE POLICY "Members view bills" ON public.supplier_bills
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Accountants insert bills" ON public.supplier_bills
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

CREATE POLICY "Accountants update bills" ON public.supplier_bills
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

CREATE POLICY "Accountants delete bills" ON public.supplier_bills
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

-- BILL_LINES
CREATE POLICY "Members view bill lines" ON public.bill_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_bills b
    WHERE b.id = bill_lines.bill_id
      AND public.has_company_access(auth.uid(), b.company_id)
  ));

CREATE POLICY "Accountants insert bill lines" ON public.bill_lines
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.supplier_bills b
    WHERE b.id = bill_lines.bill_id
      AND public.has_any_role(auth.uid(), b.company_id, ARRAY['owner','accountant']::public.app_role[])
  ));

CREATE POLICY "Accountants update bill lines" ON public.bill_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_bills b
    WHERE b.id = bill_lines.bill_id
      AND public.has_any_role(auth.uid(), b.company_id, ARRAY['owner','accountant']::public.app_role[])
  ));

CREATE POLICY "Accountants delete bill lines" ON public.bill_lines
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_bills b
    WHERE b.id = bill_lines.bill_id
      AND public.has_any_role(auth.uid(), b.company_id, ARRAY['owner','accountant']::public.app_role[])
  ));

-- PAYMENTS
CREATE POLICY "Members view payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Accountants insert payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[]));

CREATE POLICY "Accountants update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

CREATE POLICY "Accountants delete payments" ON public.payments
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[]));

-- PAYMENT_TRANSACTIONS (read only to members)
CREATE POLICY "Members view payment tx" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- AUDIT_LOGS (read only to members)
CREATE POLICY "Members view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- =========================================================================
-- SIGNUP TRIGGER: auto-create company, owner role, settings, profile, CoA
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id UUID;
  _company_name TEXT;
  _display_name TEXT;
BEGIN
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  _company_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    _display_name || '''s Company'
  );

  -- Create company
  INSERT INTO public.companies (name, created_by)
  VALUES (_company_name, NEW.id)
  RETURNING id INTO _company_id;

  -- Membership
  INSERT INTO public.company_members (company_id, user_id)
  VALUES (_company_id, NEW.id);

  -- Owner role
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (NEW.id, _company_id, 'owner');

  -- Profile
  INSERT INTO public.profiles (user_id, display_name, default_company_id)
  VALUES (NEW.id, _display_name, _company_id);

  -- Settings
  INSERT INTO public.company_settings (company_id) VALUES (_company_id);

  -- Seed Chart of Accounts
  INSERT INTO public.chart_of_accounts (company_id, code, name, type) VALUES
    (_company_id, '1000', 'Assets', 'asset'),
    (_company_id, '1100', 'Cash', 'asset'),
    (_company_id, '1200', 'Bank Account', 'asset'),
    (_company_id, '1300', 'Accounts Receivable', 'asset'),
    (_company_id, '1400', 'Inventory', 'asset'),
    (_company_id, '2000', 'Liabilities', 'liability'),
    (_company_id, '2100', 'Accounts Payable', 'liability'),
    (_company_id, '2200', 'Sales Tax Payable', 'liability'),
    (_company_id, '3000', 'Equity', 'equity'),
    (_company_id, '3100', 'Owner Equity', 'equity'),
    (_company_id, '3200', 'Retained Earnings', 'equity'),
    (_company_id, '4000', 'Income', 'income'),
    (_company_id, '4100', 'Sales Revenue', 'income'),
    (_company_id, '4200', 'Service Revenue', 'income'),
    (_company_id, '5000', 'Expenses', 'expense'),
    (_company_id, '5100', 'Cost of Goods Sold', 'expense'),
    (_company_id, '5200', 'Salaries & Wages', 'expense'),
    (_company_id, '5300', 'Rent', 'expense'),
    (_company_id, '5400', 'Utilities', 'expense'),
    (_company_id, '5500', 'Office Supplies', 'expense');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
