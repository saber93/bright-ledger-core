-- ============================================================================
-- GROUP 6: OPERATIONAL LEDGER PROOF & GO-LIVE HARDENING
-- ============================================================================

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS accounting_lock_date date,
  ADD COLUMN IF NOT EXISTS accounting_lock_reason text;

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
  _lock_date date;
  _lock_reason text;
BEGIN
  SELECT accounting_lock_date, accounting_lock_reason
  INTO _lock_date, _lock_reason
  FROM public.company_settings
  WHERE company_id = _company_id;

  IF _lock_date IS NOT NULL
     AND _effective_date IS NOT NULL
     AND _effective_date <= _lock_date THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'Accounting period locked through %s for %s.',
        _lock_date,
        _context
      ),
      DETAIL = COALESCE(
        NULLIF(_lock_reason, ''),
        'Update Settings → Modules → Go-live safety to reopen posting.'
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_source_trace(
  _company_id uuid,
  _source_hrefs text[] DEFAULT NULL,
  _document_type text DEFAULT NULL,
  _document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  branch_id uuid,
  journal_date date,
  posted_at timestamptz,
  source_type text,
  source_id uuid,
  sort_order integer,
  document_type text,
  document_id uuid,
  document_number text,
  journal_key text,
  line_key text,
  reference text,
  description text,
  payment_method text,
  counterparty_type text,
  counterparty_id uuid,
  counterparty_name text,
  source_href text,
  account_id uuid,
  account_code text,
  account_name text,
  account_type public.account_type,
  debit numeric,
  credit numeric,
  entry_side text,
  amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  )
  SELECT
    l.company_id,
    l.branch_id,
    l.journal_date,
    l.posted_at,
    l.source_type,
    l.source_id,
    l.sort_order,
    l.document_type,
    l.document_id,
    l.document_number,
    l.journal_key,
    l.line_key,
    l.reference,
    l.description,
    l.payment_method,
    l.counterparty_type,
    l.counterparty_id,
    l.counterparty_name,
    l.source_href,
    l.account_id,
    l.account_code,
    l.account_name,
    l.account_type,
    l.debit,
    l.credit,
    l.entry_side,
    l.amount
  FROM public.accounting_ledger_lines l
  CROSS JOIN allowed a
  WHERE a.ok = true
    AND l.company_id = _company_id
    AND (
      (
        COALESCE(array_length(_source_hrefs, 1), 0) > 0
        AND l.source_href = ANY(_source_hrefs)
      )
      OR (
        _document_type IS NOT NULL
        AND COALESCE(array_length(_document_ids, 1), 0) > 0
        AND l.document_type = _document_type
        AND l.document_id = ANY(_document_ids)
      )
    )
  ORDER BY
    l.journal_date,
    COALESCE(l.posted_at, l.journal_date::timestamptz),
    l.journal_key,
    l.sort_order,
    l.line_key;
$$;

GRANT EXECUTE ON FUNCTION public.accounting_source_trace(uuid, text[], text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.accounting_guard_customer_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'invoice posting');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'invoice posting');
    RETURN NEW;
  END IF;

  PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'invoice posting');
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_supplier_bill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'bill posting');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'bill posting');
    RETURN NEW;
  END IF;

  PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'bill posting');
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(
      NEW.company_id,
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'payment posting'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(
      OLD.company_id,
      COALESCE(OLD.paid_at::date, CURRENT_DATE),
      'payment posting'
    );
    RETURN NEW;
  END IF;

  PERFORM public.accounting_assert_period_unlocked(
    OLD.company_id,
    COALESCE(OLD.paid_at::date, CURRENT_DATE),
    'payment posting'
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_quick_expense()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.date, 'quick expense posting');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.date, 'quick expense posting');
    RAISE EXCEPTION 'Posted quick expenses are immutable. Create a reversing adjustment instead.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.date, 'quick expense posting');
  RAISE EXCEPTION 'Posted quick expenses cannot be deleted. Create a reversing adjustment instead.';
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(NEW.company_id, NEW.issue_date, 'credit note posting');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'credit note posting');
    RAISE EXCEPTION 'Issued credit notes are immutable. Void or reverse them through an explicit workflow instead.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(OLD.company_id, OLD.issue_date, 'credit note posting');
  RAISE EXCEPTION 'Issued credit notes cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_credit_note_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id
  FROM public.credit_notes
  WHERE id = COALESCE(NEW.credit_note_id, OLD.credit_note_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(
      _company_id,
      COALESCE(NEW.created_at::date, CURRENT_DATE),
      'credit allocation posting'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(
      _company_id,
      COALESCE(OLD.created_at::date, CURRENT_DATE),
      'credit allocation posting'
    );
    RAISE EXCEPTION 'Posted credit allocations are immutable.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(
    _company_id,
    COALESCE(OLD.created_at::date, CURRENT_DATE),
    'credit allocation posting'
  );
  RAISE EXCEPTION 'Posted credit allocations cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_cash_refund()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(
      NEW.company_id,
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'cash refund posting'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(
      OLD.company_id,
      COALESCE(OLD.paid_at::date, CURRENT_DATE),
      'cash refund posting'
    );
    RAISE EXCEPTION 'Posted cash refunds are immutable.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(
    OLD.company_id,
    COALESCE(OLD.paid_at::date, CURRENT_DATE),
    'cash refund posting'
  );
  RAISE EXCEPTION 'Posted cash refunds cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_cash_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(
      NEW.company_id,
      COALESCE(NEW.opened_at::date, CURRENT_DATE),
      'cash session posting'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(
      OLD.company_id,
      COALESCE(OLD.closed_at::date, OLD.opened_at::date, CURRENT_DATE),
      'cash session posting'
    );
    RETURN NEW;
  END IF;

  PERFORM public.accounting_assert_period_unlocked(
    OLD.company_id,
    COALESCE(OLD.closed_at::date, OLD.opened_at::date, CURRENT_DATE),
    'cash session posting'
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_cash_session_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id
  FROM public.cash_sessions
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(
      _company_id,
      COALESCE(NEW.created_at::date, CURRENT_DATE),
      'cash session event posting'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(
      _company_id,
      COALESCE(OLD.created_at::date, CURRENT_DATE),
      'cash session event posting'
    );
    RAISE EXCEPTION 'Recorded cash-session events are immutable.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(
    _company_id,
    COALESCE(OLD.created_at::date, CURRENT_DATE),
    'cash session event posting'
  );
  RAISE EXCEPTION 'Recorded cash-session events cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_pos_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('completed', 'partially_refunded', 'refunded') THEN
      PERFORM public.accounting_assert_period_unlocked(
        NEW.company_id,
        COALESCE(NEW.completed_at::date, CURRENT_DATE),
        'POS posting'
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('completed', 'partially_refunded', 'refunded')
       OR NEW.status IN ('completed', 'partially_refunded', 'refunded') THEN
      PERFORM public.accounting_assert_period_unlocked(
        OLD.company_id,
        COALESCE(OLD.completed_at::date, NEW.completed_at::date, CURRENT_DATE),
        'POS posting'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed', 'partially_refunded', 'refunded') THEN
    PERFORM public.accounting_assert_period_unlocked(
      OLD.company_id,
      COALESCE(OLD.completed_at::date, CURRENT_DATE),
      'POS posting'
    );
    RAISE EXCEPTION 'Completed POS orders cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_guard_pos_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _completed_date date;
BEGIN
  SELECT company_id, COALESCE(completed_at::date, CURRENT_DATE)
  INTO _company_id, _completed_date
  FROM public.pos_orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.accounting_assert_period_unlocked(_company_id, _completed_date, 'POS settlement');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.accounting_assert_period_unlocked(_company_id, _completed_date, 'POS settlement');
    RAISE EXCEPTION 'Recorded POS payments are immutable.';
  END IF;

  PERFORM public.accounting_assert_period_unlocked(_company_id, _completed_date, 'POS settlement');
  RAISE EXCEPTION 'Recorded POS payments cannot be deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_guard_customer_invoice ON public.customer_invoices;
CREATE TRIGGER trg_accounting_guard_customer_invoice
  BEFORE INSERT OR UPDATE OR DELETE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_customer_invoice();

DROP TRIGGER IF EXISTS trg_accounting_guard_supplier_bill ON public.supplier_bills;
CREATE TRIGGER trg_accounting_guard_supplier_bill
  BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_bills
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_supplier_bill();

DROP TRIGGER IF EXISTS trg_accounting_guard_payment ON public.payments;
CREATE TRIGGER trg_accounting_guard_payment
  BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_payment();

DROP TRIGGER IF EXISTS trg_accounting_guard_quick_expense ON public.quick_expenses;
CREATE TRIGGER trg_accounting_guard_quick_expense
  BEFORE INSERT OR UPDATE OR DELETE ON public.quick_expenses
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_quick_expense();

DROP TRIGGER IF EXISTS trg_accounting_guard_credit_note ON public.credit_notes;
CREATE TRIGGER trg_accounting_guard_credit_note
  BEFORE INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_credit_note();

DROP TRIGGER IF EXISTS trg_accounting_guard_credit_note_allocation ON public.credit_note_allocations;
CREATE TRIGGER trg_accounting_guard_credit_note_allocation
  BEFORE INSERT OR UPDATE OR DELETE ON public.credit_note_allocations
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_credit_note_allocation();

DROP TRIGGER IF EXISTS trg_accounting_guard_cash_refund ON public.cash_refunds;
CREATE TRIGGER trg_accounting_guard_cash_refund
  BEFORE INSERT OR UPDATE OR DELETE ON public.cash_refunds
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_cash_refund();

DROP TRIGGER IF EXISTS trg_accounting_guard_cash_session ON public.cash_sessions;
CREATE TRIGGER trg_accounting_guard_cash_session
  BEFORE INSERT OR UPDATE OR DELETE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_cash_session();

DROP TRIGGER IF EXISTS trg_accounting_guard_cash_session_event ON public.cash_session_events;
CREATE TRIGGER trg_accounting_guard_cash_session_event
  BEFORE INSERT OR UPDATE OR DELETE ON public.cash_session_events
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_cash_session_event();

DROP TRIGGER IF EXISTS trg_accounting_guard_pos_order ON public.pos_orders;
CREATE TRIGGER trg_accounting_guard_pos_order
  BEFORE INSERT OR UPDATE OR DELETE ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_pos_order();

DROP TRIGGER IF EXISTS trg_accounting_guard_pos_payment ON public.pos_payments;
CREATE TRIGGER trg_accounting_guard_pos_payment
  BEFORE INSERT OR UPDATE OR DELETE ON public.pos_payments
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_pos_payment();
