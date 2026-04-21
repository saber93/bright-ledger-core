ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS store_design_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS store_design_published jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS store_design_draft_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_design_draft_saved_by uuid,
  ADD COLUMN IF NOT EXISTS store_design_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_design_published_by uuid;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS storefront_presentation jsonb NOT NULL DEFAULT '{}'::jsonb;
