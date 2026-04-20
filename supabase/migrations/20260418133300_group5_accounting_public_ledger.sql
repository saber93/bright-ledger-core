-- ============================================================================
-- GROUP 5: PUBLIC LEDGER VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.accounting_ledger_lines
WITH (security_invoker = true)
AS
WITH raw_lines AS (
  SELECT * FROM public.accounting_ledger_operational_raw
  UNION ALL
  SELECT * FROM public.accounting_ledger_adjustment_raw
)
SELECT
  rl.company_id,
  rl.branch_id,
  rl.journal_date,
  rl.posted_at,
  rl.source_type,
  rl.source_id,
  rl.sort_order,
  rl.document_type,
  rl.document_id,
  rl.document_number,
  rl.journal_key,
  rl.line_key,
  rl.reference,
  rl.description,
  rl.payment_method,
  rl.counterparty_type,
  rl.counterparty_id,
  rl.counterparty_name,
  rl.source_href,
  rl.account_id,
  coa.code AS account_code,
  coa.name AS account_name,
  coa.type AS account_type,
  ROUND(COALESCE(rl.debit, 0), 2) AS debit,
  ROUND(COALESCE(rl.credit, 0), 2) AS credit,
  CASE
    WHEN COALESCE(rl.debit, 0) > 0 THEN 'debit'
    ELSE 'credit'
  END AS entry_side,
  ROUND(GREATEST(COALESCE(rl.debit, 0), COALESCE(rl.credit, 0)), 2) AS amount
FROM raw_lines rl
LEFT JOIN public.chart_of_accounts coa ON coa.id = rl.account_id
WHERE ABS(COALESCE(rl.debit, 0)) > 0.0001
   OR ABS(COALESCE(rl.credit, 0)) > 0.0001;

GRANT SELECT ON public.accounting_ledger_lines TO authenticated, service_role;
