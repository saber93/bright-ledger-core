-- ============================================================================
-- GROUP 5: REPORTING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accounting_trial_balance(
  _company_id uuid,
  _from date,
  _to date,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  account_code text,
  account_name text,
  account_type public.account_type,
  opening_debit numeric,
  opening_credit numeric,
  period_debit numeric,
  period_credit numeric,
  closing_debit numeric,
  closing_credit numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  ),
  base AS (
    SELECT l.*
    FROM public.accounting_ledger_lines l
    CROSS JOIN allowed a
    WHERE a.ok = true
      AND l.company_id = _company_id
      AND (_branch_id IS NULL OR l.branch_id = _branch_id)
  ),
  grouped AS (
    SELECT
      account_id,
      account_code,
      account_name,
      account_type,
      COALESCE(SUM(CASE WHEN journal_date < _from THEN debit - credit ELSE 0 END), 0) AS opening_net,
      COALESCE(SUM(CASE WHEN journal_date >= _from AND journal_date <= _to THEN debit ELSE 0 END), 0) AS period_debit,
      COALESCE(SUM(CASE WHEN journal_date >= _from AND journal_date <= _to THEN credit ELSE 0 END), 0) AS period_credit
    FROM base
    GROUP BY account_id, account_code, account_name, account_type
  )
  SELECT
    account_id,
    account_code,
    account_name,
    account_type,
    ROUND(GREATEST(opening_net, 0), 2) AS opening_debit,
    ROUND(GREATEST(-opening_net, 0), 2) AS opening_credit,
    ROUND(period_debit, 2) AS period_debit,
    ROUND(period_credit, 2) AS period_credit,
    ROUND(GREATEST(opening_net + period_debit - period_credit, 0), 2) AS closing_debit,
    ROUND(GREATEST(-(opening_net + period_debit - period_credit), 0), 2) AS closing_credit
  FROM grouped
  ORDER BY
    CASE account_type
      WHEN 'asset' THEN 1
      WHEN 'liability' THEN 2
      WHEN 'equity' THEN 3
      WHEN 'income' THEN 4
      ELSE 5
    END,
    account_code;
$$;

CREATE OR REPLACE FUNCTION public.accounting_account_balances(
  _company_id uuid,
  _as_of date,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  account_code text,
  account_name text,
  account_type public.account_type,
  balance_net numeric,
  debit_balance numeric,
  credit_balance numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  ),
  grouped AS (
    SELECT
      l.account_id,
      l.account_code,
      l.account_name,
      l.account_type,
      COALESCE(SUM(l.debit - l.credit), 0) AS balance_net
    FROM public.accounting_ledger_lines l
    CROSS JOIN allowed a
    WHERE a.ok = true
      AND l.company_id = _company_id
      AND l.journal_date <= _as_of
      AND (_branch_id IS NULL OR l.branch_id = _branch_id)
    GROUP BY l.account_id, l.account_code, l.account_name, l.account_type
  )
  SELECT
    account_id,
    account_code,
    account_name,
    account_type,
    ROUND(balance_net, 2) AS balance_net,
    ROUND(GREATEST(balance_net, 0), 2) AS debit_balance,
    ROUND(GREATEST(-balance_net, 0), 2) AS credit_balance
  FROM grouped
  ORDER BY
    CASE account_type
      WHEN 'asset' THEN 1
      WHEN 'liability' THEN 2
      WHEN 'equity' THEN 3
      WHEN 'income' THEN 4
      ELSE 5
    END,
    account_code;
$$;

CREATE OR REPLACE FUNCTION public.accounting_account_ledger(
  _company_id uuid,
  _account_id uuid,
  _from date,
  _to date,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  journal_date date,
  posted_at timestamptz,
  journal_key text,
  line_key text,
  source_type text,
  document_type text,
  document_id uuid,
  document_number text,
  reference text,
  description text,
  payment_method text,
  counterparty_name text,
  source_href text,
  debit numeric,
  credit numeric,
  opening_balance numeric,
  running_balance numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT public.has_company_access(auth.uid(), _company_id) AS ok
  ),
  opening AS (
    SELECT COALESCE(SUM(l.debit - l.credit), 0) AS balance
    FROM public.accounting_ledger_lines l
    CROSS JOIN allowed a
    WHERE a.ok = true
      AND l.company_id = _company_id
      AND l.account_id = _account_id
      AND l.journal_date < _from
      AND (_branch_id IS NULL OR l.branch_id = _branch_id)
  ),
  rows_in_period AS (
    SELECT
      l.journal_date,
      l.posted_at,
      l.journal_key,
      l.line_key,
      l.source_type,
      l.document_type,
      l.document_id,
      l.document_number,
      l.reference,
      l.description,
      l.payment_method,
      l.counterparty_name,
      l.source_href,
      l.debit,
      l.credit,
      l.sort_order
    FROM public.accounting_ledger_lines l
    CROSS JOIN allowed a
    WHERE a.ok = true
      AND l.company_id = _company_id
      AND l.account_id = _account_id
      AND l.journal_date >= _from
      AND l.journal_date <= _to
      AND (_branch_id IS NULL OR l.branch_id = _branch_id)
  )
  SELECT
    r.journal_date,
    r.posted_at,
    r.journal_key,
    r.line_key,
    r.source_type,
    r.document_type,
    r.document_id,
    r.document_number,
    r.reference,
    r.description,
    r.payment_method,
    r.counterparty_name,
    r.source_href,
    ROUND(r.debit, 2) AS debit,
    ROUND(r.credit, 2) AS credit,
    ROUND(o.balance, 2) AS opening_balance,
    ROUND(
      o.balance + SUM(r.debit - r.credit) OVER (
        ORDER BY
          r.journal_date,
          COALESCE(r.posted_at, r.journal_date::timestamptz),
          r.journal_key,
          r.sort_order,
          r.line_key
      ),
      2
    ) AS running_balance
  FROM rows_in_period r
  CROSS JOIN opening o
  ORDER BY
    r.journal_date,
    COALESCE(r.posted_at, r.journal_date::timestamptz),
    r.journal_key,
    r.sort_order,
    r.line_key;
$$;

GRANT EXECUTE ON FUNCTION public.accounting_trial_balance(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_account_balances(uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_account_ledger(uuid, uuid, date, date, uuid) TO authenticated;
