-- ============================================================================
-- GROUP 5: ADJUSTMENT LEDGER RAW VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.accounting_ledger_adjustment_raw
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
    ) AS branch_id
  FROM public.customer_invoices i
),
credit_line_sums AS (
  SELECT
    credit_note_id,
    ROUND(SUM(COALESCE(line_total, 0) - COALESCE(tax_amount, 0)), 2) AS subtotal_net
  FROM public.credit_note_lines
  GROUP BY credit_note_id
),
credit_note_branches AS (
  SELECT
    c.id AS credit_note_id,
    COALESCE(pos.branch_id, inv_meta.branch_id) AS branch_id
  FROM public.credit_notes c
  LEFT JOIN public.pos_orders pos ON pos.id = c.source_pos_order_id
  LEFT JOIN invoice_meta inv_meta ON inv_meta.invoice_id = c.source_invoice_id
)
SELECT
  c.company_id,
  cnb.branch_id,
  c.issue_date AS journal_date,
  c.created_at AS posted_at,
  'credit_note'::text AS source_type,
  c.id AS source_id,
  20 + COALESCE(cnl.position, 0) AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'credit_note:' || c.id::text AS journal_key,
  'credit_note:' || c.id::text || ':revenue:' || cnl.id::text AS line_key,
  c.credit_note_number AS reference,
  COALESCE(cnl.description, 'Credit note line') AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  COALESCE(
    il.account_id,
    CASE
      WHEN COALESCE(pol.is_service, false) THEN public.accounting_account_id(c.company_id, '4200')
      ELSE public.accounting_account_id(c.company_id, '4100')
    END,
    public.accounting_account_id(c.company_id, '4100')
  ) AS account_id,
  ROUND(COALESCE(cnl.line_total, 0) - COALESCE(cnl.tax_amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.credit_notes c
JOIN public.credit_note_lines cnl ON cnl.credit_note_id = c.id
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN public.invoice_lines il ON il.id = cnl.source_line_id
LEFT JOIN public.pos_order_lines pol ON pol.id = cnl.source_line_id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE c.status NOT IN ('draft', 'void')

UNION ALL

SELECT
  c.company_id,
  cnb.branch_id,
  c.issue_date AS journal_date,
  c.created_at AS posted_at,
  'credit_note'::text AS source_type,
  c.id AS source_id,
  190 AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'credit_note:' || c.id::text AS journal_key,
  'credit_note:' || c.id::text || ':revenue-adjustment' AS line_key,
  c.credit_note_number AS reference,
  'Revenue fallback for credit note ' || c.credit_note_number AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '4100') AS account_id,
  ROUND(COALESCE(c.subtotal, 0) - COALESCE(cls.subtotal_net, 0), 2) AS debit,
  0::numeric AS credit
FROM public.credit_notes c
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN credit_line_sums cls ON cls.credit_note_id = c.id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE c.status NOT IN ('draft', 'void')
  AND ABS(COALESCE(c.subtotal, 0) - COALESCE(cls.subtotal_net, 0)) > 0.005

UNION ALL

SELECT
  c.company_id,
  cnb.branch_id,
  c.issue_date AS journal_date,
  c.created_at AS posted_at,
  'credit_note'::text AS source_type,
  c.id AS source_id,
  200 AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'credit_note:' || c.id::text AS journal_key,
  'credit_note:' || c.id::text || ':tax' AS line_key,
  c.credit_note_number AS reference,
  'Tax for credit note ' || c.credit_note_number AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '2200') AS account_id,
  ROUND(COALESCE(c.tax_total, 0), 2) AS debit,
  0::numeric AS credit
FROM public.credit_notes c
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE c.status NOT IN ('draft', 'void')
  AND COALESCE(c.tax_total, 0) <> 0

UNION ALL

SELECT
  c.company_id,
  cnb.branch_id,
  c.issue_date AS journal_date,
  c.created_at AS posted_at,
  'credit_note'::text AS source_type,
  c.id AS source_id,
  300 AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'credit_note:' || c.id::text AS journal_key,
  'credit_note:' || c.id::text || ':customer-credit' AS line_key,
  c.credit_note_number AS reference,
  COALESCE(c.reason, 'Credit note ' || c.credit_note_number) AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '2300') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(c.total, 0), 2) AS credit
FROM public.credit_notes c
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE c.status NOT IN ('draft', 'void')

UNION ALL

SELECT
  c.company_id,
  COALESCE(target_im.branch_id, cnb.branch_id) AS branch_id,
  a.created_at::date AS journal_date,
  a.created_at AS posted_at,
  'credit_note_allocation'::text AS source_type,
  a.id AS source_id,
  10 AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'credit_alloc:' || a.id::text AS journal_key,
  'credit_alloc:' || a.id::text || ':customer-credit' AS line_key,
  c.credit_note_number AS reference,
  'Apply credit note to invoice' AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '2300') AS account_id,
  ROUND(COALESCE(a.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.credit_note_allocations a
JOIN public.credit_notes c ON c.id = a.credit_note_id
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN invoice_meta target_im ON target_im.invoice_id = a.target_invoice_id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE a.target_type = 'invoice'
  AND a.target_invoice_id IS NOT NULL
  AND c.status NOT IN ('draft', 'void')

UNION ALL

SELECT
  c.company_id,
  COALESCE(target_im.branch_id, cnb.branch_id) AS branch_id,
  a.created_at::date AS journal_date,
  a.created_at AS posted_at,
  'credit_note_allocation'::text AS source_type,
  a.id AS source_id,
  20 AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'credit_alloc:' || a.id::text AS journal_key,
  'credit_alloc:' || a.id::text || ':ar' AS line_key,
  c.credit_note_number AS reference,
  'Apply credit note to receivable' AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '1300') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(a.amount, 0), 2) AS credit
FROM public.credit_note_allocations a
JOIN public.credit_notes c ON c.id = a.credit_note_id
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN invoice_meta target_im ON target_im.invoice_id = a.target_invoice_id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE a.target_type = 'invoice'
  AND a.target_invoice_id IS NOT NULL
  AND c.status NOT IN ('draft', 'void')

UNION ALL

SELECT
  cr.company_id,
  cr.branch_id,
  cr.paid_at::date AS journal_date,
  cr.paid_at AS posted_at,
  'cash_refund'::text AS source_type,
  cr.id AS source_id,
  10 AS sort_order,
  'cash_refund'::text AS document_type,
  cr.id AS document_id,
  cn.credit_note_number AS document_number,
  'cash_refund:' || cr.id::text AS journal_key,
  'cash_refund:' || cr.id::text || ':customer-credit' AS line_key,
  COALESCE(cr.reference, cn.credit_note_number) AS reference,
  'Cash refund for credit note ' || cn.credit_note_number AS description,
  cr.method AS payment_method,
  'customer'::text AS counterparty_type,
  cn.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || cn.id::text AS source_href,
  public.accounting_account_id(cr.company_id, '2300') AS account_id,
  ROUND(COALESCE(cr.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.cash_refunds cr
JOIN public.credit_notes cn ON cn.id = cr.credit_note_id
LEFT JOIN public.customers cust ON cust.id = cn.customer_id
WHERE cn.status NOT IN ('draft', 'void')

UNION ALL

SELECT
  cr.company_id,
  cr.branch_id,
  cr.paid_at::date AS journal_date,
  cr.paid_at AS posted_at,
  'cash_refund'::text AS source_type,
  cr.id AS source_id,
  20 AS sort_order,
  'cash_refund'::text AS document_type,
  cr.id AS document_id,
  cn.credit_note_number AS document_number,
  'cash_refund:' || cr.id::text AS journal_key,
  'cash_refund:' || cr.id::text || ':cash' AS line_key,
  COALESCE(cr.reference, cn.credit_note_number) AS reference,
  'Cash refund for credit note ' || cn.credit_note_number AS description,
  cr.method AS payment_method,
  'customer'::text AS counterparty_type,
  cn.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || cn.id::text AS source_href,
  public.accounting_cash_account_id(cr.company_id, cr.method) AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(cr.amount, 0), 2) AS credit
FROM public.cash_refunds cr
JOIN public.credit_notes cn ON cn.id = cr.credit_note_id
LEFT JOIN public.customers cust ON cust.id = cn.customer_id
WHERE cn.status NOT IN ('draft', 'void')

UNION ALL

SELECT
  o.company_id,
  o.branch_id,
  o.completed_at::date AS journal_date,
  o.completed_at AS posted_at,
  'pos_cogs'::text AS source_type,
  pol.id AS source_id,
  10 + COALESCE(pol.position, 0) AS sort_order,
  'pos_order'::text AS document_type,
  o.id AS document_id,
  o.order_number AS document_number,
  'pos_cogs:' || o.id::text AS journal_key,
  'pos_cogs:' || pol.id::text || ':cogs' AS line_key,
  o.order_number AS reference,
  COALESCE(pol.description, p.name, 'POS goods sale') AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  o.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/pos-orders/' || o.id::text AS source_href,
  public.accounting_account_id(o.company_id, '5100') AS account_id,
  ROUND(COALESCE(pol.quantity, 0) * COALESCE(p.cost_price, 0), 2) AS debit,
  0::numeric AS credit
FROM public.pos_orders o
JOIN public.pos_order_lines pol ON pol.order_id = o.id
JOIN public.products p ON p.id = pol.product_id
LEFT JOIN public.customers cust ON cust.id = o.customer_id
WHERE o.status IN ('completed', 'partially_refunded', 'refunded')
  AND p.type = 'goods'

UNION ALL

SELECT
  o.company_id,
  o.branch_id,
  o.completed_at::date AS journal_date,
  o.completed_at AS posted_at,
  'pos_cogs'::text AS source_type,
  pol.id AS source_id,
  20 + COALESCE(pol.position, 0) AS sort_order,
  'pos_order'::text AS document_type,
  o.id AS document_id,
  o.order_number AS document_number,
  'pos_cogs:' || o.id::text AS journal_key,
  'pos_cogs:' || pol.id::text || ':inventory' AS line_key,
  o.order_number AS reference,
  COALESCE(pol.description, p.name, 'POS goods sale') AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  o.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/pos-orders/' || o.id::text AS source_href,
  public.accounting_account_id(o.company_id, '1400') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(pol.quantity, 0) * COALESCE(p.cost_price, 0), 2) AS credit
FROM public.pos_orders o
JOIN public.pos_order_lines pol ON pol.order_id = o.id
JOIN public.products p ON p.id = pol.product_id
LEFT JOIN public.customers cust ON cust.id = o.customer_id
WHERE o.status IN ('completed', 'partially_refunded', 'refunded')
  AND p.type = 'goods'

UNION ALL

SELECT
  c.company_id,
  cnb.branch_id,
  c.issue_date AS journal_date,
  c.created_at AS posted_at,
  'refund_restock'::text AS source_type,
  cnl.id AS source_id,
  10 + COALESCE(cnl.position, 0) AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'refund_restock:' || c.id::text AS journal_key,
  'refund_restock:' || cnl.id::text || ':inventory' AS line_key,
  c.credit_note_number AS reference,
  COALESCE(cnl.description, p.name, 'Refund restock') AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '1400') AS account_id,
  ROUND(COALESCE(cnl.quantity, 0) * COALESCE(p.cost_price, 0), 2) AS debit,
  0::numeric AS credit
FROM public.credit_notes c
JOIN public.credit_note_lines cnl ON cnl.credit_note_id = c.id
JOIN public.products p ON p.id = cnl.product_id
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE c.status NOT IN ('draft', 'void')
  AND c.restock = true
  AND p.type = 'goods'

UNION ALL

SELECT
  c.company_id,
  cnb.branch_id,
  c.issue_date AS journal_date,
  c.created_at AS posted_at,
  'refund_restock'::text AS source_type,
  cnl.id AS source_id,
  20 + COALESCE(cnl.position, 0) AS sort_order,
  'credit_note'::text AS document_type,
  c.id AS document_id,
  c.credit_note_number AS document_number,
  'refund_restock:' || c.id::text AS journal_key,
  'refund_restock:' || cnl.id::text || ':cogs' AS line_key,
  c.credit_note_number AS reference,
  COALESCE(cnl.description, p.name, 'Refund restock') AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  c.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/refunds/' || c.id::text AS source_href,
  public.accounting_account_id(c.company_id, '5100') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(cnl.quantity, 0) * COALESCE(p.cost_price, 0), 2) AS credit
FROM public.credit_notes c
JOIN public.credit_note_lines cnl ON cnl.credit_note_id = c.id
JOIN public.products p ON p.id = cnl.product_id
LEFT JOIN credit_note_branches cnb ON cnb.credit_note_id = c.id
LEFT JOIN public.customers cust ON cust.id = c.customer_id
WHERE c.status NOT IN ('draft', 'void')
  AND c.restock = true
  AND p.type = 'goods'

UNION ALL

SELECT
  s.company_id,
  s.branch_id,
  e.created_at::date AS journal_date,
  e.created_at AS posted_at,
  'cash_session_transfer'::text AS source_type,
  e.id AS source_id,
  10 AS sort_order,
  'cash_session'::text AS document_type,
  s.id AS document_id,
  pr.code || ':' || s.id::text AS document_number,
  'cash_event:' || e.id::text AS journal_key,
  'cash_event:' || e.id::text || ':cash' AS line_key,
  COALESCE(e.reference, pr.code) AS reference,
  COALESCE(e.note, 'Drawer cash in') AS description,
  'cash_transfer'::text AS payment_method,
  NULL::text AS counterparty_type,
  NULL::uuid AS counterparty_id,
  NULL::text AS counterparty_name,
  '/cash-sessions' AS source_href,
  public.accounting_account_id(s.company_id, '1100') AS account_id,
  ROUND(COALESCE(e.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.cash_session_events e
JOIN public.cash_sessions s ON s.id = e.session_id
JOIN public.pos_registers pr ON pr.id = s.register_id
WHERE e.type = 'cash_in'

UNION ALL

SELECT
  s.company_id,
  s.branch_id,
  e.created_at::date AS journal_date,
  e.created_at AS posted_at,
  'cash_session_transfer'::text AS source_type,
  e.id AS source_id,
  20 AS sort_order,
  'cash_session'::text AS document_type,
  s.id AS document_id,
  pr.code || ':' || s.id::text AS document_number,
  'cash_event:' || e.id::text AS journal_key,
  'cash_event:' || e.id::text || ':bank' AS line_key,
  COALESCE(e.reference, pr.code) AS reference,
  COALESCE(e.note, 'Drawer cash in') AS description,
  'cash_transfer'::text AS payment_method,
  NULL::text AS counterparty_type,
  NULL::uuid AS counterparty_id,
  NULL::text AS counterparty_name,
  '/cash-sessions' AS source_href,
  public.accounting_account_id(s.company_id, '1200') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(e.amount, 0), 2) AS credit
FROM public.cash_session_events e
JOIN public.cash_sessions s ON s.id = e.session_id
JOIN public.pos_registers pr ON pr.id = s.register_id
WHERE e.type = 'cash_in'

UNION ALL

SELECT
  s.company_id,
  s.branch_id,
  e.created_at::date AS journal_date,
  e.created_at AS posted_at,
  'cash_session_transfer'::text AS source_type,
  e.id AS source_id,
  10 AS sort_order,
  'cash_session'::text AS document_type,
  s.id AS document_id,
  pr.code || ':' || s.id::text AS document_number,
  'cash_event:' || e.id::text AS journal_key,
  'cash_event:' || e.id::text || ':bank' AS line_key,
  COALESCE(e.reference, pr.code) AS reference,
  COALESCE(e.note, 'Drawer cash out') AS description,
  'cash_transfer'::text AS payment_method,
  NULL::text AS counterparty_type,
  NULL::uuid AS counterparty_id,
  NULL::text AS counterparty_name,
  '/cash-sessions' AS source_href,
  public.accounting_account_id(s.company_id, '1200') AS account_id,
  ROUND(COALESCE(e.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.cash_session_events e
JOIN public.cash_sessions s ON s.id = e.session_id
JOIN public.pos_registers pr ON pr.id = s.register_id
WHERE e.type IN ('cash_out', 'payout')

UNION ALL

SELECT
  s.company_id,
  s.branch_id,
  e.created_at::date AS journal_date,
  e.created_at AS posted_at,
  'cash_session_transfer'::text AS source_type,
  e.id AS source_id,
  20 AS sort_order,
  'cash_session'::text AS document_type,
  s.id AS document_id,
  pr.code || ':' || s.id::text AS document_number,
  'cash_event:' || e.id::text AS journal_key,
  'cash_event:' || e.id::text || ':cash' AS line_key,
  COALESCE(e.reference, pr.code) AS reference,
  COALESCE(e.note, 'Drawer cash out') AS description,
  'cash_transfer'::text AS payment_method,
  NULL::text AS counterparty_type,
  NULL::uuid AS counterparty_id,
  NULL::text AS counterparty_name,
  '/cash-sessions' AS source_href,
  public.accounting_account_id(s.company_id, '1100') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(e.amount, 0), 2) AS credit
FROM public.cash_session_events e
JOIN public.cash_sessions s ON s.id = e.session_id
JOIN public.pos_registers pr ON pr.id = s.register_id
WHERE e.type IN ('cash_out', 'payout');

GRANT SELECT ON public.accounting_ledger_adjustment_raw TO authenticated, service_role;
