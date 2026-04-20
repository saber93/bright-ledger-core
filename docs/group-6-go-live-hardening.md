# Group 6: Operational Ledger Proof & Go-Live Hardening

Date: 2026-04-18

## What changed

Group 6 closed the remaining trust gap between the validated ledger and the operational modules that had not yet been proven on live tenant data.

Implemented in this phase:

- Live proof data for the remaining operational accounting flows
- Source-to-ledger traceability on operational detail screens
- Accounting lock-date controls in company settings and mutation guards
- Database-side guards to block edits/deletes in locked periods
- Nested-route fix so operational detail routes actually render
- Browser smoke coverage for operational proof pages and ledger-backed reports

## Issues found and fixed

### 1. Operational detail routes were unreachable

`/pos-orders/:id`, `/quick-expenses/:id`, and `/refunds/:id` were nested under list routes, but their parent route components never rendered an `Outlet`. The URL changed, but the list page stayed on screen.

Fixed by rendering `Outlet` on detail paths in:

- `src/routes/_authenticated.pos-orders.tsx`
- `src/routes/_authenticated.quick-expenses.tsx`
- `src/routes/_authenticated.refunds.tsx`

### 2. Operational source-to-ledger proof was not visible enough

The ledger was posting, but POS orders, quick expenses, refunds, and cash-session transfer flows needed stronger in-app traceability so finance users can inspect the exact journals behind each source document.

Improved with:

- `src/components/accounting/PostingAuditCard.tsx`
- `src/features/accounting/ledger.ts`
- detail-page wiring for POS orders, quick expenses, refunds, and cash sessions

### 3. Period-close controls needed production foundations

The app needed a real accounting lock-date foundation so operational mutations do not silently alter closed periods.

Added in:

- `company_settings.accounting_lock_date`
- `company_settings.accounting_lock_reason`
- mutation-time lock checks in operational hooks
- database-side guard triggers in `20260418150000_group6_operational_go_live_hardening.sql`

## Live proof scenarios

The tenant now contains a live proof set covering the previously unproven flows:

- POS cash sale: `POS-G6-CASH`
- POS card sale: `POS-G6-CARD`
- POS mixed payment sale: `POS-G6-MIX`
- POS on-credit sale: `POS-G6-CREDIT`
- Paid quick expense: `EXP-G6-001`
- Unpaid quick expense: `EXP-G6-002`
- Paid quick expense with tax: `EXP-G6-003`
- Full POS refund with cash-out and restock: `CN-G6-POSFULL`
- Partial invoice refund to customer credit: `CN-G6-CREDIT`
- Cash-session transfer / adjustment proof session: `cash_sessions.id = d38bbaa5-e901-4ee6-ad26-a0937114f6b6`

## Live posting proof

Validated directly against `public.accounting_ledger_lines`:

- `POS-G6-CASH`
  - POS revenue journal via linked invoice
  - customer payment to `1100 Cash`
  - COGS / inventory journal
- `POS-G6-CARD`
  - POS revenue journal via linked invoice
  - customer payment to `1200 Bank Account`
  - COGS / inventory journal
- `POS-G6-MIX`
  - POS revenue journal via linked invoice
  - split settlement across `1100 Cash` and `1200 Bank Account`
  - COGS / inventory journal
- `POS-G6-CREDIT`
  - POS revenue journal via linked invoice
  - open `1300 Accounts Receivable`
  - no payment journal
  - COGS / inventory journal
- `EXP-G6-001`
  - `Dr 5500 Office Supplies`
  - `Cr 1100 Cash`
- `EXP-G6-002`
  - `Dr 5500 Office Supplies`
  - `Cr 2100 Accounts Payable`
- `EXP-G6-003`
  - `Dr 5500 Office Supplies`
  - `Dr 2200 Sales Tax Payable`
  - `Cr 1200 Bank Account`
- `CN-G6-POSFULL`
  - refund credit note reversing revenue/tax
  - cash refund journal reducing `1100 Cash`
  - refund restock journal reversing COGS into inventory
- `CN-G6-CREDIT`
  - refund credit note reversing revenue
  - liability posted to `2300 Customer Credits Payable`
  - no cash-refund journal
- Cash-session transfers
  - `cash_in`: `Dr 1100 Cash / Cr 1200 Bank Account`
  - `cash_out`: `Dr 1200 Bank Account / Cr 1100 Cash`
  - `payout`: `Dr 1200 Bank Account / Cr 1100 Cash`
  - operational `opening`, `sale`, and `refund` session events remain non-posting by design

## Reconciliation snapshot

Current-month reconciliation from the validated ledger source:

- Trial Balance
  - Closing debits: `147,585.64`
  - Closing credits: `147,585.64`
  - Difference: `0.00`
  - Period debits: `37,091.68`
  - Period credits: `37,091.68`
- Balance Sheet
  - Assets: `121,579.19`
  - Liabilities: `16,087.64`
  - Current earnings: `105,491.55`
  - Liabilities + Equity: `121,579.19`
  - Difference: `0.00`
- Profit & Loss
  - Gross revenue: `17,396.00`
  - Refunds: `1,849.00`
  - Expenses: `7,000.00`
  - Net profit: `8,547.00`
- Tax Summary
  - Output tax: `512.08`
  - Input tax: `177.25`
  - Refunded tax: `34.27`
  - Net tax payable: `300.56`
- Cash Flow
  - Customer payments: `4,153.81`
  - Supplier payments: `5,556.00`
  - Quick expenses: `366.00`
  - Cash refunds: `183.27`
  - Cash transfers in: `50.00`
  - Cash transfers out: `50.00`
  - Net cash flow: `-1,951.46`

## Browser smoke result

Authenticated browser smoke passed on the current code running at `http://127.0.0.1:8081` for:

- Dashboard
- POS order detail proof pages
- Quick expense detail proof pages
- Refund detail proof pages
- Cash session proof page
- Trial Balance
- Balance Sheet
- General Ledger
- Profit & Loss
- Tax Summary
- Cash Flow

No browser console errors and no page runtime errors were observed in that smoke pass.

## Remaining production risks before Group 7

- The live proof transactions were seeded directly into the tenant for deterministic reconciliation. The accounting result is proven, but not every proof transaction was re-created manually through browser forms during this pass.
- A stale dev server was still running on `:8080` during implementation; the verified browser smoke ran on the fresh server at `:8081`. Restart the long-running local dev server before further manual QA so everyone is testing the same runtime.
- The repository still does not have a checked-in automated regression suite for these accounting proofs. The smoke script used here was temporary and local to this implementation session.
