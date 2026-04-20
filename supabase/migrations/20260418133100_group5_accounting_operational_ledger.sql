-- ============================================================================
-- GROUP 5: OPERATIONAL LEDGER RAW VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.accounting_ledger_operational_raw
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
invoice_line_sums AS (
  SELECT
    invoice_id,
    ROUND(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 2) AS subtotal_net
  FROM public.invoice_lines
  GROUP BY invoice_id
),
bill_line_sums AS (
  SELECT
    bill_id,
    ROUND(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 2) AS subtotal_net
  FROM public.bill_lines
  GROUP BY bill_id
)
SELECT
  i.company_id,
  im.branch_id,
  i.issue_date AS journal_date,
  i.created_at AS posted_at,
  CASE WHEN im.pos_order_number IS NULL THEN 'customer_invoice' ELSE 'pos_invoice' END AS source_type,
  i.id AS source_id,
  10 AS sort_order,
  'invoice'::text AS document_type,
  i.id AS document_id,
  i.invoice_number AS document_number,
  'invoice:' || i.id::text AS journal_key,
  'invoice:' || i.id::text || ':ar' AS line_key,
  i.invoice_number AS reference,
  COALESCE(i.notes, 'Invoice ' || i.invoice_number) AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  i.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/invoices/' || i.id::text AS source_href,
  public.accounting_account_id(i.company_id, '1300') AS account_id,
  ROUND(COALESCE(i.total, 0), 2) AS debit,
  0::numeric AS credit
FROM public.customer_invoices i
LEFT JOIN invoice_meta im ON im.invoice_id = i.id
LEFT JOIN public.customers cust ON cust.id = i.customer_id
WHERE i.status NOT IN ('draft', 'cancelled')

UNION ALL

SELECT
  i.company_id,
  im.branch_id,
  i.issue_date AS journal_date,
  i.created_at AS posted_at,
  CASE WHEN im.pos_order_number IS NULL THEN 'customer_invoice' ELSE 'pos_invoice' END AS source_type,
  i.id AS source_id,
  20 + COALESCE(il.position, 0) AS sort_order,
  'invoice'::text AS document_type,
  i.id AS document_id,
  i.invoice_number AS document_number,
  'invoice:' || i.id::text AS journal_key,
  'invoice:' || i.id::text || ':revenue:' || il.id::text AS line_key,
  i.invoice_number AS reference,
  COALESCE(il.description, 'Invoice line') AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  i.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/invoices/' || i.id::text AS source_href,
  COALESCE(il.account_id, public.accounting_account_id(i.company_id, '4100')) AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(il.quantity, 0) * COALESCE(il.unit_price, 0), 2) AS credit
FROM public.customer_invoices i
JOIN public.invoice_lines il ON il.invoice_id = i.id
LEFT JOIN invoice_meta im ON im.invoice_id = i.id
LEFT JOIN public.customers cust ON cust.id = i.customer_id
WHERE i.status NOT IN ('draft', 'cancelled')

UNION ALL

SELECT
  i.company_id,
  im.branch_id,
  i.issue_date AS journal_date,
  i.created_at AS posted_at,
  CASE WHEN im.pos_order_number IS NULL THEN 'customer_invoice' ELSE 'pos_invoice' END AS source_type,
  i.id AS source_id,
  190 AS sort_order,
  'invoice'::text AS document_type,
  i.id AS document_id,
  i.invoice_number AS document_number,
  'invoice:' || i.id::text AS journal_key,
  'invoice:' || i.id::text || ':revenue-adjustment' AS line_key,
  i.invoice_number AS reference,
  'Revenue fallback for invoice ' || i.invoice_number AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  i.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/invoices/' || i.id::text AS source_href,
  public.accounting_account_id(i.company_id, '4100') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(i.subtotal, 0) - COALESCE(ils.subtotal_net, 0), 2) AS credit
FROM public.customer_invoices i
LEFT JOIN invoice_meta im ON im.invoice_id = i.id
LEFT JOIN invoice_line_sums ils ON ils.invoice_id = i.id
LEFT JOIN public.customers cust ON cust.id = i.customer_id
WHERE i.status NOT IN ('draft', 'cancelled')
  AND ABS(COALESCE(i.subtotal, 0) - COALESCE(ils.subtotal_net, 0)) > 0.005

UNION ALL

SELECT
  i.company_id,
  im.branch_id,
  i.issue_date AS journal_date,
  i.created_at AS posted_at,
  CASE WHEN im.pos_order_number IS NULL THEN 'customer_invoice' ELSE 'pos_invoice' END AS source_type,
  i.id AS source_id,
  200 AS sort_order,
  'invoice'::text AS document_type,
  i.id AS document_id,
  i.invoice_number AS document_number,
  'invoice:' || i.id::text AS journal_key,
  'invoice:' || i.id::text || ':tax' AS line_key,
  i.invoice_number AS reference,
  'Tax for invoice ' || i.invoice_number AS description,
  NULL::text AS payment_method,
  'customer'::text AS counterparty_type,
  i.customer_id AS counterparty_id,
  cust.name AS counterparty_name,
  '/invoices/' || i.id::text AS source_href,
  public.accounting_account_id(i.company_id, '2200') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(i.tax_total, 0), 2) AS credit
FROM public.customer_invoices i
LEFT JOIN invoice_meta im ON im.invoice_id = i.id
LEFT JOIN public.customers cust ON cust.id = i.customer_id
WHERE i.status NOT IN ('draft', 'cancelled')
  AND COALESCE(i.tax_total, 0) <> 0

UNION ALL

SELECT
  p.company_id,
  im.branch_id,
  p.paid_at::date AS journal_date,
  p.paid_at AS posted_at,
  'customer_payment'::text AS source_type,
  p.id AS source_id,
  10 AS sort_order,
  'payment'::text AS document_type,
  p.id AS document_id,
  COALESCE(i.invoice_number, p.reference, p.id::text) AS document_number,
  'payment:' || p.id::text AS journal_key,
  'payment:' || p.id::text || ':cash' AS line_key,
  COALESCE(p.reference, i.invoice_number, p.id::text) AS reference,
  COALESCE(p.notes, 'Customer payment') AS description,
  p.method::text AS payment_method,
  'customer'::text AS counterparty_type,
  p.party_id AS counterparty_id,
  cust.name AS counterparty_name,
  CASE
    WHEN p.invoice_id IS NOT NULL THEN '/invoices/' || p.invoice_id::text
    ELSE '/payments'
  END AS source_href,
  public.accounting_cash_account_id(p.company_id, p.method::text) AS account_id,
  ROUND(COALESCE(p.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.payments p
JOIN public.customer_invoices i ON i.id = p.invoice_id
JOIN public.customers cust ON cust.id = p.party_id
LEFT JOIN invoice_meta im ON im.invoice_id = p.invoice_id
WHERE p.status = 'completed'
  AND p.direction = 'in'
  AND p.invoice_id IS NOT NULL

UNION ALL

SELECT
  p.company_id,
  im.branch_id,
  p.paid_at::date AS journal_date,
  p.paid_at AS posted_at,
  'customer_payment'::text AS source_type,
  p.id AS source_id,
  20 AS sort_order,
  'payment'::text AS document_type,
  p.id AS document_id,
  COALESCE(i.invoice_number, p.reference, p.id::text) AS document_number,
  'payment:' || p.id::text AS journal_key,
  'payment:' || p.id::text || ':ar' AS line_key,
  COALESCE(p.reference, i.invoice_number, p.id::text) AS reference,
  COALESCE(p.notes, 'Customer payment') AS description,
  p.method::text AS payment_method,
  'customer'::text AS counterparty_type,
  p.party_id AS counterparty_id,
  cust.name AS counterparty_name,
  CASE
    WHEN p.invoice_id IS NOT NULL THEN '/invoices/' || p.invoice_id::text
    ELSE '/payments'
  END AS source_href,
  public.accounting_account_id(p.company_id, '1300') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(p.amount, 0), 2) AS credit
FROM public.payments p
JOIN public.customer_invoices i ON i.id = p.invoice_id
JOIN public.customers cust ON cust.id = p.party_id
LEFT JOIN invoice_meta im ON im.invoice_id = p.invoice_id
WHERE p.status = 'completed'
  AND p.direction = 'in'
  AND p.invoice_id IS NOT NULL

UNION ALL

SELECT
  b.company_id,
  NULL::uuid AS branch_id,
  b.issue_date AS journal_date,
  b.created_at AS posted_at,
  'supplier_bill'::text AS source_type,
  b.id AS source_id,
  20 + COALESCE(bl.position, 0) AS sort_order,
  'bill'::text AS document_type,
  b.id AS document_id,
  b.bill_number AS document_number,
  'bill:' || b.id::text AS journal_key,
  'bill:' || b.id::text || ':expense:' || bl.id::text AS line_key,
  b.bill_number AS reference,
  COALESCE(bl.description, 'Bill line') AS description,
  NULL::text AS payment_method,
  'supplier'::text AS counterparty_type,
  b.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/bills/' || b.id::text AS source_href,
  COALESCE(bl.account_id, public.accounting_account_id(b.company_id, '5500')) AS account_id,
  ROUND(COALESCE(bl.quantity, 0) * COALESCE(bl.unit_price, 0), 2) AS debit,
  0::numeric AS credit
FROM public.supplier_bills b
JOIN public.bill_lines bl ON bl.bill_id = b.id
LEFT JOIN public.suppliers sup ON sup.id = b.supplier_id
WHERE b.status NOT IN ('draft', 'cancelled')

UNION ALL

SELECT
  b.company_id,
  NULL::uuid AS branch_id,
  b.issue_date AS journal_date,
  b.created_at AS posted_at,
  'supplier_bill'::text AS source_type,
  b.id AS source_id,
  190 AS sort_order,
  'bill'::text AS document_type,
  b.id AS document_id,
  b.bill_number AS document_number,
  'bill:' || b.id::text AS journal_key,
  'bill:' || b.id::text || ':expense-adjustment' AS line_key,
  b.bill_number AS reference,
  'Expense fallback for bill ' || b.bill_number AS description,
  NULL::text AS payment_method,
  'supplier'::text AS counterparty_type,
  b.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/bills/' || b.id::text AS source_href,
  public.accounting_account_id(b.company_id, '5500') AS account_id,
  ROUND(COALESCE(b.subtotal, 0) - COALESCE(bls.subtotal_net, 0), 2) AS debit,
  0::numeric AS credit
FROM public.supplier_bills b
LEFT JOIN bill_line_sums bls ON bls.bill_id = b.id
LEFT JOIN public.suppliers sup ON sup.id = b.supplier_id
WHERE b.status NOT IN ('draft', 'cancelled')
  AND ABS(COALESCE(b.subtotal, 0) - COALESCE(bls.subtotal_net, 0)) > 0.005

UNION ALL

SELECT
  b.company_id,
  NULL::uuid AS branch_id,
  b.issue_date AS journal_date,
  b.created_at AS posted_at,
  'supplier_bill'::text AS source_type,
  b.id AS source_id,
  200 AS sort_order,
  'bill'::text AS document_type,
  b.id AS document_id,
  b.bill_number AS document_number,
  'bill:' || b.id::text AS journal_key,
  'bill:' || b.id::text || ':tax' AS line_key,
  b.bill_number AS reference,
  'Tax for bill ' || b.bill_number AS description,
  NULL::text AS payment_method,
  'supplier'::text AS counterparty_type,
  b.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/bills/' || b.id::text AS source_href,
  public.accounting_account_id(b.company_id, '2200') AS account_id,
  ROUND(COALESCE(b.tax_total, 0), 2) AS debit,
  0::numeric AS credit
FROM public.supplier_bills b
LEFT JOIN public.suppliers sup ON sup.id = b.supplier_id
WHERE b.status NOT IN ('draft', 'cancelled')
  AND COALESCE(b.tax_total, 0) <> 0

UNION ALL

SELECT
  b.company_id,
  NULL::uuid AS branch_id,
  b.issue_date AS journal_date,
  b.created_at AS posted_at,
  'supplier_bill'::text AS source_type,
  b.id AS source_id,
  300 AS sort_order,
  'bill'::text AS document_type,
  b.id AS document_id,
  b.bill_number AS document_number,
  'bill:' || b.id::text AS journal_key,
  'bill:' || b.id::text || ':ap' AS line_key,
  b.bill_number AS reference,
  COALESCE(b.notes, 'Supplier bill ' || b.bill_number) AS description,
  NULL::text AS payment_method,
  'supplier'::text AS counterparty_type,
  b.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/bills/' || b.id::text AS source_href,
  public.accounting_account_id(b.company_id, '2100') AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(b.total, 0), 2) AS credit
FROM public.supplier_bills b
LEFT JOIN public.suppliers sup ON sup.id = b.supplier_id
WHERE b.status NOT IN ('draft', 'cancelled')

UNION ALL

SELECT
  p.company_id,
  NULL::uuid AS branch_id,
  p.paid_at::date AS journal_date,
  p.paid_at AS posted_at,
  'supplier_payment'::text AS source_type,
  p.id AS source_id,
  10 AS sort_order,
  'payment'::text AS document_type,
  p.id AS document_id,
  COALESCE(b.bill_number, p.reference, p.id::text) AS document_number,
  'payment:' || p.id::text AS journal_key,
  'payment:' || p.id::text || ':ap' AS line_key,
  COALESCE(p.reference, b.bill_number, p.id::text) AS reference,
  COALESCE(p.notes, 'Supplier payment') AS description,
  p.method::text AS payment_method,
  'supplier'::text AS counterparty_type,
  p.party_id AS counterparty_id,
  sup.name AS counterparty_name,
  CASE
    WHEN p.bill_id IS NOT NULL THEN '/bills/' || p.bill_id::text
    ELSE '/payments'
  END AS source_href,
  public.accounting_account_id(p.company_id, '2100') AS account_id,
  ROUND(COALESCE(p.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.payments p
JOIN public.supplier_bills b ON b.id = p.bill_id
JOIN public.suppliers sup ON sup.id = p.party_id
WHERE p.status = 'completed'
  AND p.direction = 'out'
  AND p.bill_id IS NOT NULL

UNION ALL

SELECT
  p.company_id,
  NULL::uuid AS branch_id,
  p.paid_at::date AS journal_date,
  p.paid_at AS posted_at,
  'supplier_payment'::text AS source_type,
  p.id AS source_id,
  20 AS sort_order,
  'payment'::text AS document_type,
  p.id AS document_id,
  COALESCE(b.bill_number, p.reference, p.id::text) AS document_number,
  'payment:' || p.id::text AS journal_key,
  'payment:' || p.id::text || ':cash' AS line_key,
  COALESCE(p.reference, b.bill_number, p.id::text) AS reference,
  COALESCE(p.notes, 'Supplier payment') AS description,
  p.method::text AS payment_method,
  'supplier'::text AS counterparty_type,
  p.party_id AS counterparty_id,
  sup.name AS counterparty_name,
  CASE
    WHEN p.bill_id IS NOT NULL THEN '/bills/' || p.bill_id::text
    ELSE '/payments'
  END AS source_href,
  public.accounting_cash_account_id(p.company_id, p.method::text) AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(p.amount, 0), 2) AS credit
FROM public.payments p
JOIN public.supplier_bills b ON b.id = p.bill_id
JOIN public.suppliers sup ON sup.id = p.party_id
WHERE p.status = 'completed'
  AND p.direction = 'out'
  AND p.bill_id IS NOT NULL

UNION ALL

SELECT
  qe.company_id,
  qe.branch_id,
  qe.date AS journal_date,
  qe.created_at AS posted_at,
  'quick_expense'::text AS source_type,
  qe.id AS source_id,
  10 AS sort_order,
  'quick_expense'::text AS document_type,
  qe.id AS document_id,
  qe.expense_number AS document_number,
  'quick_expense:' || qe.id::text AS journal_key,
  'quick_expense:' || qe.id::text || ':expense' AS line_key,
  qe.expense_number AS reference,
  qe.description AS description,
  qe.payment_method::text AS payment_method,
  'supplier'::text AS counterparty_type,
  qe.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/quick-expenses/' || qe.id::text AS source_href,
  COALESCE(qe.account_id, public.accounting_account_id(qe.company_id, '5500')) AS account_id,
  ROUND(COALESCE(qe.amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.quick_expenses qe
LEFT JOIN public.suppliers sup ON sup.id = qe.supplier_id

UNION ALL

SELECT
  qe.company_id,
  qe.branch_id,
  qe.date AS journal_date,
  qe.created_at AS posted_at,
  'quick_expense'::text AS source_type,
  qe.id AS source_id,
  20 AS sort_order,
  'quick_expense'::text AS document_type,
  qe.id AS document_id,
  qe.expense_number AS document_number,
  'quick_expense:' || qe.id::text AS journal_key,
  'quick_expense:' || qe.id::text || ':tax' AS line_key,
  qe.expense_number AS reference,
  'Tax for quick expense ' || qe.expense_number AS description,
  qe.payment_method::text AS payment_method,
  'supplier'::text AS counterparty_type,
  qe.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/quick-expenses/' || qe.id::text AS source_href,
  public.accounting_account_id(qe.company_id, '2200') AS account_id,
  ROUND(COALESCE(qe.tax_amount, 0), 2) AS debit,
  0::numeric AS credit
FROM public.quick_expenses qe
LEFT JOIN public.suppliers sup ON sup.id = qe.supplier_id
WHERE COALESCE(qe.tax_amount, 0) <> 0

UNION ALL

SELECT
  qe.company_id,
  qe.branch_id,
  qe.date AS journal_date,
  qe.created_at AS posted_at,
  'quick_expense'::text AS source_type,
  qe.id AS source_id,
  30 AS sort_order,
  'quick_expense'::text AS document_type,
  qe.id AS document_id,
  qe.expense_number AS document_number,
  'quick_expense:' || qe.id::text AS journal_key,
  'quick_expense:' || qe.id::text || ':settlement' AS line_key,
  qe.expense_number AS reference,
  CASE
    WHEN qe.paid = true AND qe.payment_method <> 'unpaid' THEN 'Paid quick expense'
    ELSE 'Unpaid quick expense'
  END AS description,
  qe.payment_method::text AS payment_method,
  'supplier'::text AS counterparty_type,
  qe.supplier_id AS counterparty_id,
  sup.name AS counterparty_name,
  '/quick-expenses/' || qe.id::text AS source_href,
  CASE
    WHEN qe.paid = true AND qe.payment_method <> 'unpaid'
      THEN public.accounting_cash_account_id(qe.company_id, qe.payment_method::text)
    ELSE COALESCE(qe.payable_account_id, public.accounting_account_id(qe.company_id, '2100'))
  END AS account_id,
  0::numeric AS debit,
  ROUND(COALESCE(qe.amount, 0) + COALESCE(qe.tax_amount, 0), 2) AS credit
FROM public.quick_expenses qe
LEFT JOIN public.suppliers sup ON sup.id = qe.supplier_id;

GRANT SELECT ON public.accounting_ledger_operational_raw TO authenticated, service_role;
