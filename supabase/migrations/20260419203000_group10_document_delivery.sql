-- ============================================================================
-- GROUP 10: DOCUMENT DELIVERY, REMINDERS, AND COLLECTIONS
-- ============================================================================

ALTER TABLE public.document_deliveries
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'send',
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS source_href text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.document_deliveries
  ALTER COLUMN status SET DEFAULT 'pending';

DROP TRIGGER IF EXISTS trg_document_deliveries_updated_at ON public.document_deliveries;
CREATE TRIGGER trg_document_deliveries_updated_at
  BEFORE UPDATE ON public.document_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_doc_deliveries_company_sent
  ON public.document_deliveries(company_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_deliveries_doc_event
  ON public.document_deliveries(document_type, document_id, event_type, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.document_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

CREATE INDEX IF NOT EXISTS idx_document_share_tokens_doc
  ON public.document_share_tokens(company_id, document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_document_share_tokens_expires
  ON public.document_share_tokens(expires_at);

ALTER TABLE public.document_deliveries
  ADD COLUMN IF NOT EXISTS share_token_id uuid REFERENCES public.document_share_tokens(id) ON DELETE SET NULL;

ALTER TABLE public.document_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.document_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  label text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  payment_instructions text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_key)
);

DROP TRIGGER IF EXISTS trg_document_email_templates_updated_at ON public.document_email_templates;
CREATE TRIGGER trg_document_email_templates_updated_at
  BEFORE UPDATE ON public.document_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.document_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view document email templates"
  ON public.document_email_templates
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Finance users insert document email templates"
  ON public.document_email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  );

CREATE POLICY "Finance users update document email templates"
  ON public.document_email_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  );

CREATE POLICY "Finance users delete document email templates"
  ON public.document_email_templates
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  );
