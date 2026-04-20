-- ============================================================================
-- GROUP 11: COLLECTIONS AUTOMATION + DELIVERY OBSERVABILITY
-- ============================================================================

ALTER TABLE public.document_deliveries
  ADD COLUMN IF NOT EXISTS provider_name text NOT NULL DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS recipient_email_normalized text,
  ADD COLUMN IF NOT EXISTS send_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS stage_key text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_type text,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_summary text,
  ADD COLUMN IF NOT EXISTS last_error_kind text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS suppressed_at timestamptz;

UPDATE public.document_deliveries
SET recipient_email_normalized = lower(trim(recipient))
WHERE recipient IS NOT NULL
  AND (recipient_email_normalized IS NULL OR recipient_email_normalized = '');

CREATE INDEX IF NOT EXISTS idx_doc_deliveries_company_status
  ON public.document_deliveries(company_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_deliveries_company_stage
  ON public.document_deliveries(company_id, event_type, stage_key, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_deliveries_recipient
  ON public.document_deliveries(company_id, recipient_email_normalized);

CREATE INDEX IF NOT EXISTS idx_doc_deliveries_provider_message
  ON public.document_deliveries(provider_message_id);

CREATE TABLE IF NOT EXISTS public.company_collection_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  auto_reminders_enabled boolean NOT NULL DEFAULT true,
  auto_statements_enabled boolean NOT NULL DEFAULT false,
  friendly_before_due_days integer NOT NULL DEFAULT 3 CHECK (friendly_before_due_days >= 0),
  overdue_after_due_days integer NOT NULL DEFAULT 3 CHECK (overdue_after_due_days >= 0),
  final_after_due_days integer NOT NULL DEFAULT 10 CHECK (final_after_due_days >= 0),
  statement_run_day integer NOT NULL DEFAULT 1 CHECK (statement_run_day BETWEEN 1 AND 28),
  throttle_days integer NOT NULL DEFAULT 4 CHECK (throttle_days >= 0),
  retry_delay_minutes integer NOT NULL DEFAULT 30 CHECK (retry_delay_minutes >= 1),
  max_retry_attempts integer NOT NULL DEFAULT 5 CHECK (max_retry_attempts >= 0),
  batch_limit integer NOT NULL DEFAULT 100 CHECK (batch_limit BETWEEN 1 AND 500),
  sender_display_name text,
  default_reply_to text,
  invoice_template_key text NOT NULL DEFAULT 'invoice_email',
  friendly_template_key text NOT NULL DEFAULT 'reminder_friendly',
  overdue_template_key text NOT NULL DEFAULT 'reminder_overdue',
  final_template_key text NOT NULL DEFAULT 'reminder_final',
  statement_template_key text NOT NULL DEFAULT 'customer_statement',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_company_collection_policies_updated_at ON public.company_collection_policies;
CREATE TRIGGER trg_company_collection_policies_updated_at
  BEFORE UPDATE ON public.company_collection_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_collection_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view collection policies"
  ON public.company_collection_policies
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Finance users insert collection policies"
  ON public.company_collection_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  );

CREATE POLICY "Finance users update collection policies"
  ON public.company_collection_policies
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant']::public.app_role[])
  );

CREATE POLICY "Owners delete collection policies"
  ON public.company_collection_policies
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'owner'::public.app_role));

INSERT INTO public.company_collection_policies (company_id)
SELECT id
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_company_collection_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_collection_policies (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_collection_policy ON public.companies;
CREATE TRIGGER trg_companies_collection_policy
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_company_collection_policy();

CREATE TABLE IF NOT EXISTS public.document_delivery_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  reason text,
  source text NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email_normalized, scope)
);

DROP TRIGGER IF EXISTS trg_document_delivery_suppressions_updated_at ON public.document_delivery_suppressions;
CREATE TRIGGER trg_document_delivery_suppressions_updated_at
  BEFORE UPDATE ON public.document_delivery_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_delivery_suppressions_company
  ON public.document_delivery_suppressions(company_id, is_active, email_normalized);

ALTER TABLE public.document_delivery_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view delivery suppressions"
  ON public.document_delivery_suppressions
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Collections users insert suppressions"
  ON public.document_delivery_suppressions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  );

CREATE POLICY "Collections users update suppressions"
  ON public.document_delivery_suppressions
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  );

CREATE POLICY "Collections users delete suppressions"
  ON public.document_delivery_suppressions
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), company_id, ARRAY['owner','accountant','sales_manager']::public.app_role[])
  );

CREATE TABLE IF NOT EXISTS public.document_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL UNIQUE REFERENCES public.document_deliveries(id) ON DELETE CASCADE,
  send_mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  dedupe_key text,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  processed_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  last_error_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_document_delivery_outbox_updated_at ON public.document_delivery_outbox;
CREATE TRIGGER trg_document_delivery_outbox_updated_at
  BEFORE UPDATE ON public.document_delivery_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_delivery_outbox_pending
  ON public.document_delivery_outbox(company_id, status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_delivery_outbox_dedupe
  ON public.document_delivery_outbox(company_id, dedupe_key);

ALTER TABLE public.document_delivery_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view delivery outbox"
  ON public.document_delivery_outbox
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE TABLE IF NOT EXISTS public.document_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES public.document_deliveries(id) ON DELETE CASCADE,
  provider_name text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  summary text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery
  ON public.document_delivery_events(delivery_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_events_provider
  ON public.document_delivery_events(provider_message_id);

ALTER TABLE public.document_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view delivery events"
  ON public.document_delivery_events
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

DROP TRIGGER IF EXISTS trg_finance_audit_collection_policies ON public.company_collection_policies;
CREATE TRIGGER trg_finance_audit_collection_policies
  AFTER INSERT OR UPDATE OR DELETE ON public.company_collection_policies
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_delivery_suppressions ON public.document_delivery_suppressions;
CREATE TRIGGER trg_finance_audit_delivery_suppressions
  AFTER INSERT OR UPDATE OR DELETE ON public.document_delivery_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();
