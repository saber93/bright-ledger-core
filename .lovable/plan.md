

User approved Group 4 plan with all 4 recommended decisions plus a reconciliation guardrail. Switching to default mode to execute in the specified order.

## Group 4 — Confirmed Execution Plan

**Decisions locked in:**
- Reports depth: Functional v1 (filters, KPIs, tables, totals, CSV, print). No charts.
- Balance Sheet & Trial Balance: Deferred to Group 5.
- Print model: Browser print-to-PDF (same as POS receipt). No server-side PDF engine.
- Invoice detail: Full depth (summary, lines, payments, refunds, record payment, print).
- **Reconciliation guardrail**: All report numbers must read directly from posted documents (`customer_invoices`, `pos_orders`, `pos_payments`, `payments`, `quick_expenses`, `credit_notes`, `cash_refunds`, `cash_session_events`). No parallel aggregation tables, no drift surface.

## Execution Order (locked)

1. **`/invoices/$invoiceId`** — full detail route
   - Summary card, line items table, payment history, `RefundsHistory` (closes Group 3 deferred item)
   - "Record payment" dialog → existing payments hook
   - "Print / Save as PDF" button → new `/api/documents/invoice/:id`
   - Wire row click from `/invoices` list

2. **Document HTML routes** (Worker-safe, A4 styled, auto `window.print()`):
   - `/api/documents/invoice/:id`
   - `/api/documents/bill/:id`
   - `/api/documents/credit-note/:id`
   - `/api/documents/quick-expense/:id`
   - `/api/documents/cash-session/:id`
   - Pattern reuses `api.documents.pos-receipt.$id.tsx`

3. **Print buttons** wired into: invoice detail, bill detail, credit-note detail, quick-expense detail, cash-session detail, POS order detail (already has receipt — confirm consistency)

4. **`src/features/reports/hooks.ts`** — thin aggregation layer reading posted documents only:
   - `useProfitLoss({ from, to, branchId })` — revenue from invoices + POS, expense from quick expenses + bills
   - `useSalesPerformance({ from, to, groupBy })` — invoices + POS orders
   - `useTaxSummary({ from, to })` — `tax_total` aggregations from invoices, bills, POS, credit notes
   - `useCashFlow({ from, to, branchId })` — payments + cash session events + cash refunds + quick expenses

5. **`/reports`** — replace placeholder grid:
   - 4 working report routes: `/reports/profit-loss`, `/reports/sales`, `/reports/tax`, `/reports/cash-flow`
   - Each: filter bar + KPI cards + data table + totals row + CSV export (browser blob) + Print button
   - Other tiles stay as "coming soon"
   - `/api/documents/report/:type` for print

6. **Dashboard upgrade** (`_authenticated.dashboard.tsx`):
   - This-month revenue/expenses/net widget (P&L hook)
   - Receivables aging + Payables aging widgets
   - Cash position by branch widget
   - Top customers + top items (last 30 days)
   - Extend `ActivityTimeline` with recent posted documents

7. **Verify 12 scenarios** through code review + build:
   1–5: Print routes for invoice/bill/credit-note/quick-expense/cash-session
   6: P&L matches POS + invoice revenue and quick-expense + bill expenses
   7: Sales by branch matches raw documents
   8: Tax Summary totals match `tax_total` sums
   9: Cash Flow reconciles to cash session opening/closing
   10: CSV export downloads with headers + totals
   11: Dashboard widgets reflect same numbers as reports
   12: Invoice detail shows linked refunds (closes Group 3 deferred item)

## Reconciliation guardrail — concrete enforcement

Every report hook will:
- Read directly from posted-document tables (no caching layer, no materialized aggregates)
- Use the same currency/amount fields the source-of-truth UI shows
- Filter by `company_id` via RLS, plus optional `branch_id` / date range
- Return raw rows + computed totals; no rounding before final display

Pause and report after step 7.

