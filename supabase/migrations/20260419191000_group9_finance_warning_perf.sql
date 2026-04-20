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
