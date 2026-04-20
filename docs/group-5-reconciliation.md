# Group 5 Reconciliation Notes

## Scope completed

- Posted-ledger source standardized through `public.accounting_ledger_lines`
- Trial Balance added on top of the validated ledger source
- Balance Sheet added on top of the validated ledger source
- General Ledger / account drill-down added on top of the validated ledger source
- Core dashboard finance cards reconciled to the same report-layer hooks

## Posting issues found and fixed

### Before Group 5

- Core financial statements were derived from document aggregation instead of a single validated ledger source.
- Supplier bill payments had no first-class bill detail workflow to support ledger drill-through.
- Quick expenses could be left without a reliable default payable account when unpaid.
- Invoice and POS-created invoice lines could be created without explicit posting accounts.
- Credit-note accounting needed a dedicated liability account so issued credits, allocations, and cash refunds would reconcile cleanly.
- Cash-session operational events and accounting effects were mixed together conceptually.

### Group 5 fixes

- Added a dedicated `2300 Customer Credits Payable` control account.
- Standardized default posting-account assignment for invoice lines, POS invoice lines, bills, and unpaid quick expenses.
- Added a live supplier-bill detail route with payment history and bill-payment entry support.
- Created a ledger-backed accounting view stack:
  - `accounting_ledger_operational_raw`
  - `accounting_ledger_adjustment_raw`
  - `accounting_ledger_lines`
- Added ledger-backed reporting functions:
  - `accounting_trial_balance`
  - `accounting_account_balances`
  - `accounting_account_ledger`
- Repointed Trial Balance, Balance Sheet, General Ledger, Profit & Loss, Tax Summary, and Cash Flow to the validated ledger source.

## Live-data verification results

### Verified on live tenant data

- Customer invoice issue:
  - Sample `INV-1010` posted `Dr A/R 9,500.00` and balanced exactly against credits.
- Customer payment:
  - Sample payment for `INV-1010` posted `Dr cash/bank 9,500.00 / Cr A/R 9,500.00`.
- Supplier bill issue:
  - Sample `BILL-2001` posted `Dr expense 925.00 / Dr tax 74.00 / Cr A/P 999.00`.
- Supplier payment:
  - Sample payment for `BILL-2001` posted `Dr A/P 999.00 / Cr cash/bank 999.00`.
- Trial Balance:
  - Current-month debits and credits reconcile exactly.
- Balance Sheet:
  - Total Assets equals Total Liabilities plus Equity (including current earnings) exactly.
- Ledger drill-down:
  - Account drill-down rows include document numbers, references, and source links such as invoice and bill detail routes.
- Browser smoke test:
  - Dashboard, Trial Balance, Balance Sheet, General Ledger, Profit & Loss, Tax Summary, Cash Flow, and Bills pages loaded successfully with no console or runtime errors.

### Not verifiable on live tenant data because no posted rows exist yet

- POS cash sale
- POS card sale
- Quick expense paid
- Quick expense unpaid
- Credit note issue
- Cash refund
- Customer credit allocation
- Cash-session transfer activity

Current live row counts at verification time:

- `pos_orders`: `0`
- `quick_expenses`: `0`
- `credit_notes`: `0`
- `cash_refunds`: `0`
- accounting cash-session transfer events: `0`

## Reconciliation notes

- Trial Balance and Balance Sheet now reconcile directly from the same validated ledger source.
- Profit & Loss, Tax Summary, and Cash Flow were updated to derive from the validated ledger source rather than parallel document aggregation.
- Dashboard financial widgets now reuse the same report-layer hooks that sit on top of the validated ledger source.
- Receivables and payables aging remain document/subledger views by design, but their balances should be interpreted alongside the ledger-backed statements.

## Remaining risks / deferred items

- This tenant does not currently contain live POS, quick-expense, refund, or cash-session posting examples, so those flows are implemented and covered by the posting matrix but not proven against tenant data yet.
- Tax still rolls through the single `2200` control account; if separate input/output tax control accounts are required later, that will need a chart-of-accounts and reporting refinement.
- Balance Sheet uses current-period earnings as a synthetic equity line when retained earnings has not been closed into a dedicated equity account.
