ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS store_shipping_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS store_payment_provider text,
  ADD COLUMN IF NOT EXISTS store_design_preview_token_hash text,
  ADD COLUMN IF NOT EXISTS store_design_preview_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_design_preview_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_design_preview_created_by uuid,
  ADD COLUMN IF NOT EXISTS store_design_preview_last_used_at timestamptz;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'shipping',
  ADD COLUMN IF NOT EXISTS shipping_method_code text,
  ADD COLUMN IF NOT EXISTS shipping_method_label text,
  ADD COLUMN IF NOT EXISTS shipping_eta text;

CREATE INDEX IF NOT EXISTS idx_online_orders_fulfillment_type
  ON public.online_orders(fulfillment_type);
