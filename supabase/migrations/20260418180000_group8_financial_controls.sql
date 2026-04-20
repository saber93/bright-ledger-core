-- ============================================================================
-- GROUP 8: FINANCIAL CONTROLS, PERIOD CLOSE, AND SAFER CORRECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  close_reason text,
  closed_at timestamptz,
  closed_by uuid,
  reopen_reason text,
  reopened_at timestamptz,
  reopened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_company_start
  ON public.accounting_periods(company_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_company_status
  ON public.accounting_periods(company_id, status, period_start DESC);

DROP TRIGGER IF EXISTS trg_accounting_periods_updated_at ON public.accounting_periods;
CREATE TRIGGER trg_accounting_periods_updated_at
  BEFORE UPDATE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view accounting periods" ON public.accounting_periods;
CREATE POLICY "Members view accounting periods" ON public.accounting_periods
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_number text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.supplier_bills
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE OR REPLACE FUNCTION public.finance_bypass_token()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_setting('app.finance_bypass', true);
$$;

CREATE OR REPLACE FUNCTION public.accounting_period_start(_effective_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('month', _effective_date)::date;
$$;

CREATE OR REPLACE FUNCTION public.accounting_period_end(_effective_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (date_trunc('month', _effective_date) + interval '1 month - 1 day')::date;
$$;

CREATE OR REPLACE FUNCTION public.finance_assert_role(
  _company_id uuid,
  _roles public.app_role[],
  _action text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), _company_id, _roles) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = format('You do not have permission to %s.', _action);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_sync_lock_mirror(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lock_date date;
  _lock_reason text;
BEGIN
  SELECT period_end, close_reason
  INTO _lock_date, _lock_reason
  FROM public.accounting_periods
  WHERE company_id = _company_id
    AND status = 'closed'
  ORDER BY period_end DESC
  LIMIT 1;

  UPDATE public.company_settings
  SET
    accounting_lock_date = _lock_date,
    accounting_lock_reason = _lock_reason
  WHERE company_id = _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_period_state(
  _company_id uuid,
  _effective_date date
)
RETURNS TABLE (
  period_start date,
  period_end date,
  status text,
  reason text,
  is_locked boolean,
  label text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  ),
  target AS (
    SELECT
      public.accounting_period_start(_effective_date) AS period_start,
      public.accounting_period_end(_effective_date) AS period_end
  ),
  explicit_period AS (
    SELECT p.*
    FROM public.accounting_periods p
    JOIN target t ON t.period_start = p.period_start
    CROSS JOIN allowed a
    WHERE a.ok = true
      AND p.company_id = _company_id
  ),
  legacy_lock AS (
    SELECT accounting_lock_date, accounting_lock_reason
    FROM public.company_settings
    WHERE company_id = _company_id
  )
  SELECT
    t.period_start,
    t.period_end,
    COALESCE(
      ep.status,
      CASE
        WHEN ll.accounting_lock_date IS NOT NULL AND _effective_date <= ll.accounting_lock_date
          THEN 'closed'
        ELSE 'open'
      END
    ) AS status,
    COALESCE(ep.close_reason, ll.accounting_lock_reason) AS reason,
    COALESCE(
      ep.status = 'closed',
      ll.accounting_lock_date IS NOT NULL AND _effective_date <= ll.accounting_lock_date,
      false
    ) AS is_locked,
    to_char(t.period_start, 'Mon YYYY') AS label
  FROM target t
  CROSS JOIN allowed a
  LEFT JOIN explicit_period ep ON true
  LEFT JOIN legacy_lock ll ON true
  WHERE a.ok = true;
$$;

CREATE OR REPLACE FUNCTION public.accounting_list_periods(
  _company_id uuid,
  _months_back integer DEFAULT 11,
  _months_forward integer DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  period_start date,
  period_end date,
  status text,
  close_reason text,
  closed_at timestamptz,
  closed_by uuid,
  reopen_reason text,
  reopened_at timestamptz,
  reopened_by uuid,
  label text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  ),
  bounds AS (
    SELECT
      (date_trunc('month', CURRENT_DATE) - make_interval(months => GREATEST(_months_back, 0)))::date AS min_start,
      (date_trunc('month', CURRENT_DATE) + make_interval(months => GREATEST(_months_forward, 0)))::date AS max_start
  ),
  calendar AS (
    SELECT
      gs::date AS period_start,
      (gs + interval '1 month - 1 day')::date AS period_end
    FROM bounds,
      generate_series(bounds.min_start, bounds.max_start, interval '1 month') AS gs
  )
  SELECT
    p.id,
    c.period_start,
    c.period_end,
    COALESCE(p.status, 'open') AS status,
    p.close_reason,
    p.closed_at,
    p.closed_by,
    p.reopen_reason,
    p.reopened_at,
    p.reopened_by,
    to_char(c.period_start, 'Mon YYYY') AS label
  FROM calendar c
  CROSS JOIN allowed a
  LEFT JOIN public.accounting_periods p
    ON p.company_id = _company_id
   AND p.period_start = c.period_start
  WHERE a.ok = true
  ORDER BY c.period_start DESC;
$$;

CREATE OR REPLACE FUNCTION public.accounting_assert_period_unlocked(
  _company_id uuid,
  _effective_date date,
  _context text DEFAULT 'transaction'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _period_start date;
  _period_end date;
  _status text;
  _reason text;
  _lock_date date;
  _lock_reason text;
BEGIN
  IF _effective_date IS NULL THEN
    RETURN;
  END IF;

  _period_start := public.accounting_period_start(_effective_date);
  _period_end := public.accounting_period_end(_effective_date);

  SELECT status, close_reason
  INTO _status, _reason
  FROM public.accounting_periods
  WHERE company_id = _company_id
    AND period_start = _period_start
  LIMIT 1;

  IF _status = 'closed' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'Accounting period %s is closed for %s.',
        to_char(_period_start, 'Mon YYYY'),
        _context
      ),
      DETAIL = COALESCE(
        NULLIF(_reason, ''),
        format(
          'Posting is blocked from %s through %s. Reopen the period in Accounting Controls.',
          _period_start,
          _period_end
        )
      );
  END IF;

  SELECT accounting_lock_date, accounting_lock_reason
  INTO _lock_date, _lock_reason
  FROM public.company_settings
  WHERE company_id = _company_id;

  IF _lock_date IS NOT NULL AND _effective_date <= _lock_date THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'Accounting period locked through %s for %s.',
        _lock_date,
        _context
      ),
      DETAIL = COALESCE(
        NULLIF(_lock_reason, ''),
        'Reopen the relevant period in Accounting Controls.'
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_audit_summary(
  _table_name text,
  _action text,
  _before jsonb,
  _after jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _row jsonb := COALESCE(_after, _before);
  _direction text;
  _amount numeric := COALESCE(NULLIF(_row->>'amount', '')::numeric, 0);
  _total numeric := COALESCE(NULLIF(_row->>'total', '')::numeric, 0);
  _number text := COALESCE(
    _row->>'invoice_number',
    _row->>'bill_number',
    _row->>'credit_note_number',
    _row->>'expense_number',
    _row->>'order_number',
    _row->>'reference'
  );
BEGIN
  CASE _table_name
    WHEN 'customer_invoices' THEN
      RETURN format(
        '%s invoice %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_total, 'FM999999999999990.00')
      );
    WHEN 'supplier_bills' THEN
      RETURN format(
        '%s bill %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_total, 'FM999999999999990.00')
      );
    WHEN 'payments' THEN
      _direction := CASE WHEN COALESCE(_row->>'direction', 'in') = 'out' THEN 'outflow' ELSE 'receipt' END;
      RETURN format(
        '%s payment %s of %s.',
        initcap(_action),
        _direction,
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'credit_notes' THEN
      RETURN format(
        '%s credit note %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_total, 'FM999999999999990.00')
      );
    WHEN 'cash_refunds' THEN
      RETURN format(
        '%s cash refund of %s via %s.',
        initcap(_action),
        to_char(_amount, 'FM999999999999990.00'),
        COALESCE(_row->>'method', 'unknown')
      );
    WHEN 'quick_expenses' THEN
      RETURN format(
        '%s quick expense %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'cash_sessions' THEN
      RETURN format('%s cash session %s.', initcap(_action), COALESCE(_row->>'status', 'state'));
    WHEN 'cash_session_events' THEN
      RETURN format(
        '%s cash-session event %s for %s.',
        initcap(_action),
        COALESCE(_row->>'type', 'event'),
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'credit_note_allocations' THEN
      RETURN format(
        '%s credit allocation %s for %s.',
        initcap(_action),
        COALESCE(_row->>'target_type', 'target'),
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'company_settings' THEN
      RETURN format('%s company finance settings.', initcap(_action));
    WHEN 'accounting_periods' THEN
      RETURN format(
        '%s accounting period %s.',
        initcap(_action),
        to_char(COALESCE((_row->>'period_start')::date, CURRENT_DATE), 'Mon YYYY')
      );
    WHEN 'pos_order_lines' THEN
      RETURN format(
        'POS price override on %s to %s.',
        COALESCE(_row->>'description', 'line'),
        to_char(COALESCE(NULLIF(_row->>'unit_price', '')::numeric, 0), 'FM999999999999990.00')
      );
    ELSE
      RETURN format('%s %s.', initcap(_action), replace(_table_name, '_', ' '));
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_log_event(
  _company_id uuid,
  _table_name text,
  _record_id uuid,
  _action text,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL,
  _entity_type text DEFAULT NULL,
  _entity_number text DEFAULT NULL,
  _summary text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    company_id,
    actor_id,
    table_name,
    record_id,
    action,
    before,
    after,
    entity_type,
    entity_number,
    summary,
    metadata
  )
  VALUES (
    _company_id,
    auth.uid(),
    _table_name,
    _record_id,
    _action,
    _before,
    _after,
    COALESCE(_entity_type, _table_name),
    _entity_number,
    COALESCE(_summary, public.finance_audit_summary(_table_name, _action, _before, _after)),
    _metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_capture_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb := COALESCE(to_jsonb(NEW), to_jsonb(OLD));
  _company_id uuid := NULLIF(_row->>'company_id', '')::uuid;
  _record_id uuid := NULLIF(_row->>'id', '')::uuid;
  _entity_number text := COALESCE(
    _row->>'invoice_number',
    _row->>'bill_number',
    _row->>'credit_note_number',
    _row->>'expense_number',
    _row->>'order_number',
    _row->>'reference'
  );
  _action text := lower(TG_OP);
BEGIN
  IF _company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.finance_log_event(
    _company_id,
    TG_TABLE_NAME,
    _record_id,
    _action,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    TG_TABLE_NAME,
    _entity_number,
    NULL,
    NULL
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_posted_invoice_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _status public.invoice_status;
BEGIN
  SELECT status INTO _status
  FROM public.customer_invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  IF public.finance_bypass_token() IS NULL
     AND _status NOT IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Posted invoice lines are immutable. Void the invoice or issue a correcting credit note instead.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_posted_bill_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _status public.bill_status;
BEGIN
  SELECT status INTO _status
  FROM public.supplier_bills
  WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);

  IF public.finance_bypass_token() IS NULL
     AND _status NOT IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Posted bill lines are immutable. Void the bill or issue a correcting supplier adjustment instead.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_posted_credit_note_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _status public.credit_note_status;
BEGIN
  SELECT status INTO _status
  FROM public.credit_notes
  WHERE id = COALESCE(NEW.credit_note_id, OLD.credit_note_id);

  IF public.finance_bypass_token() IS NULL
     AND _status NOT IN ('draft', 'void') THEN
    RAISE EXCEPTION 'Issued credit-note lines are immutable. Void the credit note or create an offsetting correction.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_guard_pos_price_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _order_number text;
  _settings_allow boolean;
  _is_override boolean;
  _summary text;
BEGIN
  SELECT
    o.company_id,
    o.order_number,
    COALESCE(cs.pos_allow_price_override, false)
  INTO _company_id, _order_number, _settings_allow
  FROM public.pos_orders o
  LEFT JOIN public.company_settings cs ON cs.company_id = o.company_id
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  _is_override := COALESCE(NEW.unit_price, OLD.unit_price) <> COALESCE(NEW.list_price, OLD.list_price);

  IF TG_OP <> 'DELETE' AND _is_override THEN
    IF NOT public.has_any_role(
      auth.uid(),
      _company_id,
      ARRAY['owner','accountant','sales_manager','store_manager']::public.app_role[]
    ) THEN
      RAISE EXCEPTION 'POS price overrides require owner, accountant, sales manager, or store manager access.';
    END IF;

    IF NOT _settings_allow
       AND NOT public.has_any_role(auth.uid(), _company_id, ARRAY['owner','accountant']::public.app_role[]) THEN
      RAISE EXCEPTION 'POS price overrides are disabled in Settings → Modules.';
    END IF;

    IF NULLIF(trim(COALESCE(NEW.price_override_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A price override reason is required.';
    END IF;

    _summary := format(
      'POS price override on %s for %s from %.2f to %.2f.',
      COALESCE(_order_number, 'POS order'),
      COALESCE(NEW.description, 'line'),
      COALESCE(NEW.list_price, 0),
      COALESCE(NEW.unit_price, 0)
    );

    PERFORM public.finance_log_event(
      _company_id,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      'price_override',
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      'pos_price_override',
      _order_number,
      _summary,
      jsonb_build_object(
        'order_id', COALESCE(NEW.order_id, OLD.order_id),
        'description', COALESCE(NEW.description, OLD.description),
        'list_price', COALESCE(NEW.list_price, OLD.list_price),
        'unit_price', COALESCE(NEW.unit_price, OLD.unit_price),
        'reason', COALESCE(NEW.price_override_reason, OLD.price_override_reason)
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_customer_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _only_settlement_change boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'cancelled') THEN
      PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'invoice posting');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF public.finance_bypass_token() IS NOT NULL THEN
      PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'invoice correction');
      RETURN NEW;
    END IF;

    IF OLD.status IN ('draft', 'cancelled') THEN
      IF NEW.status NOT IN ('draft', 'cancelled') THEN
        PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'invoice posting');
      END IF;
      RETURN NEW;
    END IF;

    _only_settlement_change :=
      OLD.customer_id IS NOT DISTINCT FROM NEW.customer_id
      AND OLD.invoice_number IS NOT DISTINCT FROM NEW.invoice_number
      AND OLD.issue_date IS NOT DISTINCT FROM NEW.issue_date
      AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date
      AND OLD.currency IS NOT DISTINCT FROM NEW.currency
      AND OLD.subtotal IS NOT DISTINCT FROM NEW.subtotal
      AND OLD.tax_total IS NOT DISTINCT FROM NEW.tax_total
      AND OLD.total IS NOT DISTINCT FROM NEW.total
      AND OLD.notes IS NOT DISTINCT FROM NEW.notes
      AND OLD.cancelled_at IS NOT DISTINCT FROM NEW.cancelled_at
      AND OLD.cancelled_by IS NOT DISTINCT FROM NEW.cancelled_by
      AND OLD.cancellation_reason IS NOT DISTINCT FROM NEW.cancellation_reason;

    IF _only_settlement_change AND NEW.status <> 'cancelled' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Posted invoices are read-only. Use Finance Controls to void the invoice or issue a correcting credit note.';
  END IF;

  IF OLD.status NOT IN ('draft', 'cancelled') THEN
    PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'invoice posting');
    RAISE EXCEPTION 'Posted invoices cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_supplier_bill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _only_settlement_change boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'cancelled') THEN
      PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'bill posting');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF public.finance_bypass_token() IS NOT NULL THEN
      PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'bill correction');
      RETURN NEW;
    END IF;

    IF OLD.status IN ('draft', 'cancelled') THEN
      IF NEW.status NOT IN ('draft', 'cancelled') THEN
        PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'bill posting');
      END IF;
      RETURN NEW;
    END IF;

    _only_settlement_change :=
      OLD.supplier_id IS NOT DISTINCT FROM NEW.supplier_id
      AND OLD.bill_number IS NOT DISTINCT FROM NEW.bill_number
      AND OLD.issue_date IS NOT DISTINCT FROM NEW.issue_date
      AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date
      AND OLD.currency IS NOT DISTINCT FROM NEW.currency
      AND OLD.subtotal IS NOT DISTINCT FROM NEW.subtotal
      AND OLD.tax_total IS NOT DISTINCT FROM NEW.tax_total
      AND OLD.total IS NOT DISTINCT FROM NEW.total
      AND OLD.notes IS NOT DISTINCT FROM NEW.notes
      AND OLD.cancelled_at IS NOT DISTINCT FROM NEW.cancelled_at
      AND OLD.cancelled_by IS NOT DISTINCT FROM NEW.cancelled_by
      AND OLD.cancellation_reason IS NOT DISTINCT FROM NEW.cancellation_reason;

    IF _only_settlement_change AND NEW.status <> 'cancelled' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Posted bills are read-only. Use Finance Controls to void the bill or create an explicit correction.';
  END IF;

  IF OLD.status NOT IN ('draft', 'cancelled') THEN
    PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'bill posting');
    RAISE EXCEPTION 'Posted bills cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _company_id uuid := COALESCE(NEW.company_id, OLD.company_id);
  _effective_date date := COALESCE(NEW.paid_at::date, OLD.paid_at::date, CURRENT_DATE);
  _is_pos_invoice boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(_company_id, _effective_date, 'payment posting');

    IF NEW.bill_id IS NOT NULL THEN
      PERFORM public.finance_assert_role(
        _company_id,
        ARRAY['owner','accountant']::public.app_role[],
        'record supplier payments'
      );
    ELSIF NEW.invoice_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pos_orders WHERE invoice_id = NEW.invoice_id
      ) INTO _is_pos_invoice;

      IF _is_pos_invoice THEN
        PERFORM public.finance_assert_role(
          _company_id,
          ARRAY['owner','accountant','cashier','store_manager','sales_manager']::public.app_role[],
          'record POS settlements'
        );
      ELSE
        PERFORM public.finance_assert_role(
          _company_id,
          ARRAY['owner','accountant','sales_manager']::public.app_role[],
          'record customer payments'
        );
      END IF;
    ELSE
      PERFORM public.finance_assert_role(
        _company_id,
        ARRAY['owner','accountant']::public.app_role[],
        'record standalone payments'
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(_company_id, _effective_date, 'payment posting');
    IF public.finance_bypass_token() IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Completed payments are immutable. Reverse them through Finance Controls.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(_company_id, _effective_date, 'payment posting');
  IF public.finance_bypass_token() IS NOT NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Completed payments cannot be deleted. Reverse them through Finance Controls.';
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'void') THEN
      PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'credit note posting');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF public.finance_bypass_token() IS NOT NULL THEN
      PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'credit note correction');
      RETURN NEW;
    END IF;

    IF OLD.status IN ('draft', 'void') THEN
      IF NEW.status NOT IN ('draft', 'void') THEN
        PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'credit note posting');
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Issued credit notes are immutable. Void or offset them through an explicit workflow instead.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'credit note posting');
  RAISE EXCEPTION 'Issued credit notes cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_integrity_warnings(_company_id uuid)
RETURNS TABLE (
  severity text,
  kind text,
  source_type text,
  source_id uuid,
  document_number text,
  source_href text,
  journal_date date,
  message text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  ),
  ledger_scope AS (
    SELECT l.*
    FROM public.accounting_ledger_lines l
    CROSS JOIN allowed a
    WHERE a.ok = true
      AND l.company_id = _company_id
  ),
  journal_groups AS (
    SELECT
      l.journal_key,
      min(l.source_type) AS source_type,
      min(l.source_id::text)::uuid AS source_id,
      min(l.document_number) AS document_number,
      min(l.source_href) AS source_href,
      min(l.journal_date) AS journal_date,
      ROUND(SUM(l.debit) - SUM(l.credit), 2) AS difference,
      bool_or(l.line_key ILIKE '%adjustment%' OR lower(l.description) LIKE '%fallback%') AS has_fallback
    FROM ledger_scope l
    GROUP BY l.journal_key
  ),
  document_traces AS (
    SELECT l.document_type, l.document_id
    FROM ledger_scope l
    WHERE l.document_type IS NOT NULL
      AND l.document_id IS NOT NULL
    GROUP BY l.document_type, l.document_id
  ),
  source_traces AS (
    SELECT l.source_type, l.source_id
    FROM ledger_scope l
    WHERE l.source_type IS NOT NULL
      AND l.source_id IS NOT NULL
    GROUP BY l.source_type, l.source_id
  )
  SELECT
    'danger'::text,
    'journal_imbalance'::text,
    j.source_type,
    j.source_id,
    j.document_number,
    j.source_href,
    j.journal_date,
    'Journal is out of balance by ' || to_char(j.difference, 'FM999999999999990.00') || '.' AS message
  FROM journal_groups j
  WHERE ABS(j.difference) > 0.005

  UNION ALL

  SELECT
    'warning',
    'fallback_path',
    j.source_type,
    j.source_id,
    j.document_number,
    j.source_href,
    j.journal_date,
    'Ledger used a fallback or adjustment line. Review account mappings for this source.'
  FROM journal_groups j
  WHERE j.has_fallback

  UNION ALL

  SELECT
    'danger',
    'missing_trace',
    'invoice',
    i.id,
    i.invoice_number,
    '/invoices/' || i.id::text,
    i.issue_date,
    'Invoice has no posted ledger lines.'
  FROM public.customer_invoices i
  CROSS JOIN allowed a
  WHERE a.ok = true
    AND i.company_id = _company_id
    AND i.status NOT IN ('draft', 'cancelled')
    AND NOT EXISTS (
      SELECT 1
      FROM document_traces t
      WHERE t.document_type = 'invoice'
        AND t.document_id = i.id
    )

  UNION ALL

  SELECT
    'danger',
    'missing_trace',
    'bill',
    b.id,
    b.bill_number,
    '/bills/' || b.id::text,
    b.issue_date,
    'Supplier bill has no posted ledger lines.'
  FROM public.supplier_bills b
  CROSS JOIN allowed a
  WHERE a.ok = true
    AND b.company_id = _company_id
    AND b.status NOT IN ('draft', 'cancelled')
    AND NOT EXISTS (
      SELECT 1
      FROM document_traces t
      WHERE t.document_type = 'bill'
        AND t.document_id = b.id
    )

  UNION ALL

  SELECT
    'danger',
    'missing_trace',
    'quick_expense',
    e.id,
    e.expense_number,
    '/quick-expenses/' || e.id::text,
    e.date,
    'Quick expense has no posted ledger lines.'
  FROM public.quick_expenses e
  CROSS JOIN allowed a
  WHERE a.ok = true
    AND e.company_id = _company_id
    AND NOT EXISTS (
      SELECT 1
      FROM document_traces t
      WHERE t.document_type = 'quick_expense'
        AND t.document_id = e.id
    )

  UNION ALL

  SELECT
    'danger',
    'missing_trace',
    'credit_note',
    c.id,
    c.credit_note_number,
    '/refunds/' || c.id::text,
    c.issue_date,
    'Credit note has no posted ledger lines.'
  FROM public.credit_notes c
  CROSS JOIN allowed a
  WHERE a.ok = true
    AND c.company_id = _company_id
    AND c.status NOT IN ('draft', 'void')
    AND NOT EXISTS (
      SELECT 1
      FROM document_traces t
      WHERE t.document_type = 'credit_note'
        AND t.document_id = c.id
    )

  UNION ALL

  SELECT
    'danger',
    'missing_trace',
    'payment',
    p.id,
    COALESCE(i.invoice_number, b.bill_number, p.reference, p.id::text),
    CASE
      WHEN p.invoice_id IS NOT NULL THEN '/invoices/' || p.invoice_id::text
      WHEN p.bill_id IS NOT NULL THEN '/bills/' || p.bill_id::text
      ELSE '/payments'
    END,
    p.paid_at::date,
    'Completed payment has no posted ledger lines.'
  FROM public.payments p
  CROSS JOIN allowed a
  LEFT JOIN public.customer_invoices i ON i.id = p.invoice_id
  LEFT JOIN public.supplier_bills b ON b.id = p.bill_id
  WHERE a.ok = true
    AND p.company_id = _company_id
    AND p.status = 'completed'
    AND NOT EXISTS (
      SELECT 1
      FROM source_traces t
      WHERE t.source_type IN ('customer_payment', 'supplier_payment')
        AND t.source_id = p.id
    )

  UNION ALL

  SELECT
    'danger',
    'missing_trace',
    'cash_refund',
    cr.id,
    cn.credit_note_number,
    '/refunds/' || cn.id::text,
    cr.paid_at::date,
    'Cash refund has no posted ledger lines.'
  FROM public.cash_refunds cr
  CROSS JOIN allowed a
  JOIN public.credit_notes cn ON cn.id = cr.credit_note_id
  WHERE a.ok = true
    AND cr.company_id = _company_id
    AND NOT EXISTS (
      SELECT 1
      FROM source_traces t
      WHERE t.source_type = 'cash_refund'
        AND t.source_id = cr.id
    )

  UNION ALL

  SELECT
    'warning',
    'missing_trace',
    'cash_session_event',
    e.id,
    COALESCE(e.reference, e.type::text),
    '/cash-sessions?sessionId=' || e.session_id::text,
    e.created_at::date,
    'Transfer cash-session event has no posted ledger lines.'
  FROM public.cash_session_events e
  CROSS JOIN allowed a
  JOIN public.cash_sessions s ON s.id = e.session_id
  WHERE a.ok = true
    AND s.company_id = _company_id
    AND e.type IN ('cash_in', 'cash_out', 'payout')
    AND NOT EXISTS (
      SELECT 1
      FROM source_traces t
      WHERE t.source_type = 'cash_session_transfer'
        AND t.source_id = e.id
    )
  ORDER BY 1, 7 DESC NULLS LAST, 5;
$$;

CREATE OR REPLACE FUNCTION public.accounting_close_period(
  _company_id uuid,
  _period_start date,
  _reason text DEFAULT NULL
)
RETURNS public.accounting_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized_start date := public.accounting_period_start(_period_start);
  _normalized_end date := public.accounting_period_end(_period_start);
  _row public.accounting_periods;
BEGIN
  PERFORM public.finance_assert_role(
    _company_id,
    ARRAY['owner','accountant']::public.app_role[],
    'close accounting periods'
  );

  INSERT INTO public.accounting_periods (
    company_id,
    period_start,
    period_end,
    status,
    close_reason,
    closed_at,
    closed_by,
    reopened_at,
    reopened_by,
    reopen_reason
  )
  VALUES (
    _company_id,
    _normalized_start,
    _normalized_end,
    'closed',
    NULLIF(trim(COALESCE(_reason, '')), ''),
    now(),
    auth.uid(),
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (company_id, period_start) DO UPDATE
    SET status = 'closed',
        period_end = EXCLUDED.period_end,
        close_reason = EXCLUDED.close_reason,
        closed_at = EXCLUDED.closed_at,
        closed_by = EXCLUDED.closed_by,
        reopened_at = NULL,
        reopened_by = NULL,
        reopen_reason = NULL
  RETURNING * INTO _row;

  PERFORM public.accounting_sync_lock_mirror(_company_id);

  PERFORM public.finance_log_event(
    _company_id,
    'accounting_periods',
    _row.id,
    'period_closed',
    NULL,
    to_jsonb(_row),
    'accounting_period',
    to_char(_row.period_start, 'Mon YYYY'),
    format('Closed accounting period %s.', to_char(_row.period_start, 'Mon YYYY')),
    jsonb_build_object('reason', _row.close_reason)
  );

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reopen_period(
  _company_id uuid,
  _period_start date,
  _reason text DEFAULT NULL
)
RETURNS public.accounting_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized_start date := public.accounting_period_start(_period_start);
  _row public.accounting_periods;
BEGIN
  PERFORM public.finance_assert_role(
    _company_id,
    ARRAY['owner']::public.app_role[],
    'reopen accounting periods'
  );

  UPDATE public.accounting_periods
  SET
    status = 'open',
    reopen_reason = NULLIF(trim(COALESCE(_reason, '')), ''),
    reopened_at = now(),
    reopened_by = auth.uid()
  WHERE company_id = _company_id
    AND period_start = _normalized_start
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Accounting period % is not closed.', to_char(_normalized_start, 'Mon YYYY');
  END IF;

  PERFORM public.accounting_sync_lock_mirror(_company_id);

  PERFORM public.finance_log_event(
    _company_id,
    'accounting_periods',
    _row.id,
    'period_reopened',
    NULL,
    to_jsonb(_row),
    'accounting_period',
    to_char(_row.period_start, 'Mon YYYY'),
    format('Reopened accounting period %s.', to_char(_row.period_start, 'Mon YYYY')),
    jsonb_build_object('reason', _row.reopen_reason)
  );

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_void_invoice(
  _invoice_id uuid,
  _reason text
)
RETURNS public.customer_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice public.customer_invoices;
BEGIN
  SELECT * INTO _invoice
  FROM public.customer_invoices
  WHERE id = _invoice_id;

  IF _invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;

  PERFORM public.finance_assert_role(
    _invoice.company_id,
    ARRAY['owner','accountant']::public.app_role[],
    'void posted invoices'
  );

  PERFORM public.accounting_assert_period_unlocked(_invoice.company_id, _invoice.issue_date, 'invoice void');

  IF _invoice.status = 'cancelled' THEN
    RETURN _invoice;
  END IF;

  IF COALESCE(_invoice.amount_paid, 0) > 0.005 THEN
    RAISE EXCEPTION 'Invoice % has payments applied. Reverse payments before voiding it.', _invoice.invoice_number;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_notes
    WHERE source_invoice_id = _invoice.id
      AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'Invoice % already has refunds or credit notes. Use correcting documents instead of voiding it.', _invoice.invoice_number;
  END IF;

  PERFORM set_config('app.finance_bypass', 'invoice_void', true);

  UPDATE public.customer_invoices
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = NULLIF(trim(COALESCE(_reason, '')), '')
  WHERE id = _invoice.id
  RETURNING * INTO _invoice;

  RETURN _invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_void_bill(
  _bill_id uuid,
  _reason text
)
RETURNS public.supplier_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bill public.supplier_bills;
BEGIN
  SELECT * INTO _bill
  FROM public.supplier_bills
  WHERE id = _bill_id;

  IF _bill.id IS NULL THEN
    RAISE EXCEPTION 'Bill not found.';
  END IF;

  PERFORM public.finance_assert_role(
    _bill.company_id,
    ARRAY['owner','accountant']::public.app_role[],
    'void posted bills'
  );

  PERFORM public.accounting_assert_period_unlocked(_bill.company_id, _bill.issue_date, 'bill void');

  IF _bill.status = 'cancelled' THEN
    RETURN _bill;
  END IF;

  IF COALESCE(_bill.amount_paid, 0) > 0.005 THEN
    RAISE EXCEPTION 'Bill % has payments applied. Reverse payments before voiding it.', _bill.bill_number;
  END IF;

  PERFORM set_config('app.finance_bypass', 'bill_void', true);

  UPDATE public.supplier_bills
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = NULLIF(trim(COALESCE(_reason, '')), '')
  WHERE id = _bill.id
  RETURNING * INTO _bill;

  RETURN _bill;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reverse_payment(
  _payment_id uuid,
  _reason text
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment public.payments;
  _invoice public.customer_invoices;
  _bill public.supplier_bills;
  _new_paid numeric;
  _new_status text;
BEGIN
  SELECT * INTO _payment
  FROM public.payments
  WHERE id = _payment_id;

  IF _payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found.';
  END IF;

  PERFORM public.finance_assert_role(
    _payment.company_id,
    ARRAY['owner','accountant']::public.app_role[],
    'reverse completed payments'
  );

  PERFORM public.accounting_assert_period_unlocked(
    _payment.company_id,
    COALESCE(_payment.paid_at::date, CURRENT_DATE),
    'payment reversal'
  );

  IF _payment.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed payments can be reversed.';
  END IF;

  IF _payment.invoice_id IS NOT NULL AND _payment.direction <> 'in' THEN
    RAISE EXCEPTION 'Customer outflow payments should be corrected through refund workflows, not payment reversal.';
  END IF;

  IF _payment.invoice_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pos_orders WHERE invoice_id = _payment.invoice_id
  ) THEN
    RAISE EXCEPTION 'POS-linked payments should be corrected through refund workflows, not payment reversal.';
  END IF;

  PERFORM set_config('app.finance_bypass', 'payment_reverse', true);

  UPDATE public.payments
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = NULLIF(trim(COALESCE(_reason, '')), '')
  WHERE id = _payment.id
  RETURNING * INTO _payment;

  IF _payment.invoice_id IS NOT NULL THEN
    SELECT * INTO _invoice
    FROM public.customer_invoices
    WHERE id = _payment.invoice_id;

    _new_paid := GREATEST(COALESCE(_invoice.amount_paid, 0) - COALESCE(_payment.amount, 0), 0);
    _new_status := CASE
      WHEN _new_paid >= COALESCE(_invoice.total, 0) AND COALESCE(_invoice.total, 0) > 0 THEN 'paid'
      WHEN _new_paid > 0 THEN 'partial'
      ELSE 'sent'
    END;

    UPDATE public.customer_invoices
    SET amount_paid = _new_paid, status = _new_status::public.invoice_status
    WHERE id = _invoice.id;
  END IF;

  IF _payment.bill_id IS NOT NULL THEN
    SELECT * INTO _bill
    FROM public.supplier_bills
    WHERE id = _payment.bill_id;

    _new_paid := GREATEST(COALESCE(_bill.amount_paid, 0) - COALESCE(_payment.amount, 0), 0);
    _new_status := CASE
      WHEN _new_paid >= COALESCE(_bill.total, 0) AND COALESCE(_bill.total, 0) > 0 THEN 'paid'
      WHEN _new_paid > 0 THEN 'partial'
      ELSE 'received'
    END;

    UPDATE public.supplier_bills
    SET amount_paid = _new_paid, status = _new_status::public.bill_status
    WHERE id = _bill.id;
  END IF;

  RETURN _payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_void_credit_note(
  _credit_note_id uuid,
  _reason text
)
RETURNS public.credit_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _note public.credit_notes;
BEGIN
  SELECT * INTO _note
  FROM public.credit_notes
  WHERE id = _credit_note_id;

  IF _note.id IS NULL THEN
    RAISE EXCEPTION 'Credit note not found.';
  END IF;

  PERFORM public.finance_assert_role(
    _note.company_id,
    ARRAY['owner','accountant']::public.app_role[],
    'void issued credit notes'
  );

  PERFORM public.accounting_assert_period_unlocked(_note.company_id, _note.issue_date, 'credit note void');

  IF _note.status = 'void' THEN
    RETURN _note;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_note_allocations WHERE credit_note_id = _note.id
  ) OR EXISTS (
    SELECT 1 FROM public.cash_refunds WHERE credit_note_id = _note.id
  ) THEN
    RAISE EXCEPTION 'Credit note % has already been allocated or refunded. Create an offsetting correction instead of voiding it.', _note.credit_note_number;
  END IF;

  PERFORM set_config('app.finance_bypass', 'credit_note_void', true);

  UPDATE public.credit_notes
  SET
    status = 'void',
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = NULLIF(trim(COALESCE(_reason, '')), '')
  WHERE id = _note.id
  RETURNING * INTO _note;

  RETURN _note;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accounting_period_state(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_list_periods(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_assert_period_unlocked(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_integrity_warnings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_close_period(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_reopen_period(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_void_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_void_bill(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_reverse_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_void_credit_note(uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS trg_finance_audit_customer_invoices ON public.customer_invoices;
CREATE TRIGGER trg_finance_audit_customer_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_supplier_bills ON public.supplier_bills;
CREATE TRIGGER trg_finance_audit_supplier_bills
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_bills
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_payments ON public.payments;
CREATE TRIGGER trg_finance_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_credit_notes ON public.credit_notes;
CREATE TRIGGER trg_finance_audit_credit_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_credit_allocations ON public.credit_note_allocations;
CREATE TRIGGER trg_finance_audit_credit_allocations
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_note_allocations
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_cash_refunds ON public.cash_refunds;
CREATE TRIGGER trg_finance_audit_cash_refunds
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_refunds
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_quick_expenses ON public.quick_expenses;
CREATE TRIGGER trg_finance_audit_quick_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.quick_expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_cash_sessions ON public.cash_sessions;
CREATE TRIGGER trg_finance_audit_cash_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_cash_session_events ON public.cash_session_events;
CREATE TRIGGER trg_finance_audit_cash_session_events
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_session_events
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_company_settings ON public.company_settings;
CREATE TRIGGER trg_finance_audit_company_settings
  AFTER UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_audit_accounting_periods ON public.accounting_periods;
CREATE TRIGGER trg_finance_audit_accounting_periods
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.finance_capture_audit_log();

DROP TRIGGER IF EXISTS trg_finance_guard_posted_invoice_line ON public.invoice_lines;
CREATE TRIGGER trg_finance_guard_posted_invoice_line
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posted_invoice_line();

DROP TRIGGER IF EXISTS trg_finance_guard_posted_bill_line ON public.bill_lines;
CREATE TRIGGER trg_finance_guard_posted_bill_line
  BEFORE INSERT OR UPDATE OR DELETE ON public.bill_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posted_bill_line();

DROP TRIGGER IF EXISTS trg_finance_guard_posted_credit_note_line ON public.credit_note_lines;
CREATE TRIGGER trg_finance_guard_posted_credit_note_line
  BEFORE INSERT OR UPDATE OR DELETE ON public.credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_posted_credit_note_line();

DROP TRIGGER IF EXISTS trg_finance_guard_pos_price_override ON public.pos_order_lines;
CREATE TRIGGER trg_finance_guard_pos_price_override
  BEFORE INSERT OR UPDATE ON public.pos_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_guard_pos_price_override();
