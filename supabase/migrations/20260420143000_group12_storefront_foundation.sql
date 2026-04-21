ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS store_slug text,
  ADD COLUMN IF NOT EXISTS store_display_name text,
  ADD COLUMN IF NOT EXISTS store_tagline text,
  ADD COLUMN IF NOT EXISTS store_support_email text,
  ADD COLUMN IF NOT EXISTS store_contact_phone text,
  ADD COLUMN IF NOT EXISTS store_announcement text,
  ADD COLUMN IF NOT EXISTS store_default_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_default_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_shipping_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS store_pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_guest_checkout_enabled boolean NOT NULL DEFAULT true;

UPDATE public.company_settings AS cs
SET
  store_slug = COALESCE(
    NULLIF(cs.store_slug, ''),
    lower(regexp_replace(coalesce(c.name, 'store'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(cs.company_id::text, 6)
  ),
  store_display_name = COALESCE(NULLIF(cs.store_display_name, ''), c.name)
FROM public.companies AS c
WHERE c.id = cs.company_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_store_slug
  ON public.company_settings (lower(store_slug))
  WHERE store_slug IS NOT NULL;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_online_orders_customer_id
  ON public.online_orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_online_orders_sales_order_id
  ON public.online_orders(sales_order_id);

CREATE INDEX IF NOT EXISTS idx_online_orders_invoice_id
  ON public.online_orders(invoice_id);

CREATE INDEX IF NOT EXISTS idx_online_orders_payment_transaction_id
  ON public.online_orders(payment_transaction_id);

CREATE TABLE IF NOT EXISTS public.customer_portal_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_via_order_id uuid REFERENCES public.online_orders(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_portal_sessions_company_customer
  ON public.customer_portal_sessions(company_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_portal_sessions_expires
  ON public.customer_portal_sessions(expires_at);

ALTER TABLE public.customer_portal_sessions ENABLE ROW LEVEL SECURITY;
