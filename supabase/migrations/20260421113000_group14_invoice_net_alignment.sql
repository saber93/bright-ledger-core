-- ============================================================================
-- GROUP 14: STOREFRONT INVOICE NET ALIGNMENT
-- ============================================================================

CREATE OR REPLACE VIEW public.accounting_ledger_lines
WITH (security_invoker = true)
AS
WITH invoice_meta AS (
  SELECT
    i.id AS invoice_id,
    (
      SELECT o.branch_id
      FROM public.pos_orders o
      WHERE o.invoice_id = i.id
      ORDER BY o.created_at, o.id
      LIMIT 1
    ) AS branch_id,
    (
      SELECT o.order_number
      FROM public.pos_orders o
      WHERE o.invoice_id = i.id
      ORDER BY o.created_at, o.id
      LIMIT 1
    ) AS pos_order_number
  FROM public.customer_invoices i
),
raw_lines AS (
  SELECT * FROM public.accounting_ledger_operational_raw
  UNION ALL
  SELECT * FROM public.accounting_ledger_adjustment_raw
  UNION ALL
  SELECT
    i.company_id,
    im.branch_id,
    i.issue_date AS journal_date,
    i.created_at AS posted_at,
    CASE WHEN im.pos_order_number IS NULL THEN 'customer_invoice' ELSE 'pos_invoice' END AS source_type,
    i.id AS source_id,
    196 AS sort_order,
    'invoice'::text AS document_type,
    i.id AS document_id,
    i.invoice_number AS document_number,
    'invoice:' || i.id::text AS journal_key,
    'invoice:' || i.id::text || ':net-alignment' AS line_key,
    i.invoice_number AS reference,
    'Net subtotal alignment for invoice ' || i.invoice_number AS description,
    NULL::text AS payment_method,
    'customer'::text AS counterparty_type,
    i.customer_id AS counterparty_id,
    cust.name AS counterparty_name,
    '/invoices/' || i.id::text AS source_href,
    public.accounting_account_id(i.company_id, '4100') AS account_id,
    ROUND(GREATEST(COALESCE(i.subtotal, 0) - (COALESCE(i.total, 0) - COALESCE(i.tax_total, 0)), 0), 2) AS debit,
    ROUND(GREATEST((COALESCE(i.total, 0) - COALESCE(i.tax_total, 0)) - COALESCE(i.subtotal, 0), 0), 2) AS credit
  FROM public.customer_invoices i
  LEFT JOIN invoice_meta im ON im.invoice_id = i.id
  LEFT JOIN public.customers cust ON cust.id = i.customer_id
  WHERE i.status NOT IN ('draft', 'cancelled')
    AND ABS((COALESCE(i.total, 0) - COALESCE(i.tax_total, 0)) - COALESCE(i.subtotal, 0)) > 0.005
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
