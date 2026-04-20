# Accounting Posting Matrix

Group 5 standardizes the finance engine around a single validated ledger source:
`public.accounting_ledger_lines`.

The app still stores operational source documents first:
- `customer_invoices`
- `supplier_bills`
- `payments`
- `pos_orders` / `pos_order_lines`
- `quick_expenses`
- `credit_notes` / `credit_note_allocations`
- `cash_refunds`
- `cash_session_events`

The ledger view expresses those documents as double-entry lines so Trial Balance,
Balance Sheet, P&L, Tax Summary, Cash Flow, and ledger drill-down all reconcile
off one source instead of each report rebuilding its own math.

## Default Control Accounts

When a workflow does not capture an explicit account, the validated ledger falls
back to these company-level defaults from the chart of accounts:

| Code | Account | Purpose |
| --- | --- | --- |
| `1100` | Cash | Cash receipts, cash refunds, petty cash |
| `1200` | Bank Account | Card, transfer, bank, check, gateway, and default non-cash settlement |
| `1300` | Accounts Receivable | Customer invoice control |
| `1400` | Inventory | POS inventory asset |
| `2100` | Accounts Payable | Supplier bill / unpaid expense control |
| `2200` | Sales Tax Payable | Net output tax less input tax / refunds |
| `2300` | Customer Credits Payable | Issued credit notes awaiting allocation or refund |
| `4100` | Sales Revenue | Default sales revenue |
| `4200` | Service Revenue | POS service fallback |
| `5100` | Cost of Goods Sold | POS and refund restock COGS |
| `5500` | Office Supplies | Default expense fallback when no explicit bill/expense account exists |

## Posting Rules

| Workflow | Triggering event | Debit | Credit | Amount basis | Status / guards | Edge cases | Group 5 state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Customer invoice issuance | Invoice saved with status not in `draft`, `cancelled` | `1300` Accounts Receivable | Revenue line account(s), `2200` tax | Header `total`, line net amounts, header `tax_total` | Posted only for active invoices | Revenue falls back to `4100` when a line has no `account_id`; subtotal rounding gets an adjustment line | Implemented in validated ledger |
| Customer invoice payment | `payments` row with `direction = in`, `status = completed`, `invoice_id` set | Cash / bank by method | `1300` Accounts Receivable | Payment `amount` | Idempotent because each payment row becomes one journal | POS tenders flow through the same rule because POS checkout already inserts `payments` | Implemented |
| Supplier bill issuance | Bill saved with status not in `draft`, `cancelled` | Expense line account(s), `2200` tax | `2100` Accounts Payable | Header `total`, line net amounts, header `tax_total` | Posted only for active bills | Expense lines fall back to `5500` when no explicit account is stored | Implemented |
| Supplier bill payment | `payments` row with `direction = out`, `status = completed`, `bill_id` set | `2100` Accounts Payable | Cash / bank by method | Payment `amount` | One payment row = one posting | Requires a real supplier-payment flow to create the payment row | Implemented in ledger; UI payment flow added in Group 5 |
| POS sale: revenue / receivable | POS checkout creates invoice + completed POS order | `1300` Accounts Receivable | Revenue + tax | Invoice totals created by POS checkout | Uses invoice issuance rule, not a second revenue engine | Prevents double-posting because `pos_orders` do not post revenue separately | Standardized |
| POS sale: immediate settlement | POS checkout inserts customer `payments` | Cash / bank by tender | `1300` Accounts Receivable | Tender amount | Same payment rules as invoices | Mixed tenders are naturally split across multiple payment rows | Standardized |
| POS sale on credit | POS checkout with `on_credit = true` | `1300` Accounts Receivable | Revenue + tax | Invoice totals | No payment rows until later collection | Leaves receivable open cleanly | Standardized |
| POS inventory impact | Completed POS order for `goods` product lines | `5100` Cost of Goods Sold | `1400` Inventory | `quantity * products.cost_price` | Only for goods lines | Service and digital lines skip inventory/COGS | Implemented |
| Quick expense paid | Quick expense with `paid = true` and payment method not `unpaid` | Expense account, `2200` tax | Cash / bank by method | `amount + tax_amount` | Each expense row posts once | Falls back to `5500` for expense account | Implemented |
| Quick expense unpaid | Quick expense with `paid = false` or method `unpaid` | Expense account, `2200` tax | `payable_account_id` or `2100` A/P | `amount + tax_amount` | Each expense row posts once | Preserves liability until a future settlement flow exists | Implemented |
| Credit note issuance | Credit note with status not in `draft`, `void` | Revenue reversal + `2200` tax | `2300` Customer Credits Payable | Header `total`, line net amounts, `tax_total` | Credit note itself creates the credit liability | Prevents guessing whether to hit A/R or cash before allocations are known | Newly standardized |
| Cash refund from credit note | `cash_refunds` row linked to credit note | `2300` Customer Credits Payable | Cash / bank by refund method | Refund `amount` | One cash refund row = one settlement posting | Existing mirrored negative `payments` rows are operational traces only and are not treated as the trusted posting source | Newly standardized |
| Credit allocation to invoice | `credit_note_allocations` row with `target_type = invoice` | `2300` Customer Credits Payable | `1300` Accounts Receivable | Allocation `amount` | Posted only for invoice targets | Keeps invoice settlement separate from note issuance | Newly standardized |
| Customer credit carry-forward | `credit_note_allocations` row with `target_type = customer_credit` | None at allocation time | None at allocation time | N/A | The credit note issuance already credited `2300` | Outstanding balance lives as a liability until later use/refund | Standardized |
| Later re-application of existing customer credit | Separate workflow after balance already exists | Not available yet | Not available yet | N/A | No standalone mutation exists today | `customer_credit_balance` is operational state, not a separate ledger engine | Deferred / documented |
| Refund restock | Credit note with `restock = true` and goods lines | `1400` Inventory | `5100` Cost of Goods Sold | `quantity * products.cost_price` | Only when restock is explicitly chosen | Non-restocked refunds do not reverse inventory/COGS | Implemented |
| Stock restock outside refunds / POS | Manual stock movements or purchases | Not posted automatically | Not posted automatically | N/A | No source workflow captures inventory valuation + offset account together | Inventory reporting remains operational outside POS/refund valuation paths | Deferred / documented |
| Cash session opening | Session `opening` event | None | None | N/A | Custody event only | Opening cash is operational till state, not a new accounting event | Standardized as non-posting |
| Cash session sale / refund event | `sale` / `refund` till event | None | None | N/A | Operational mirror only | Cash already posts via `payments` / `cash_refunds`; event would duplicate it | Standardized as non-posting |
| Cash session cash-in | `cash_in` event | `1100` Cash | `1200` Bank Account | Event `amount` | One event row = one internal transfer | Current UI does not capture a richer counterpart account, so Bank is the default transfer side | Newly standardized |
| Cash session cash-out / payout | `cash_out` or `payout` event | `1200` Bank Account | `1100` Cash | Event `amount` | One event row = one internal transfer | Treated as internal cash movement, not operating cash flow | Newly standardized |
| Cash session closing | `closing` event / session close | None | None | N/A | Custody marker only | Variance stays operational unless a later classification workflow is added | Standardized as non-posting |

## Issues Found In The Pre-Group-5 State

1. Financial reports were rebuilding totals directly from documents with no single ledger source.
2. POS revenue and payment data existed in multiple tables, which invited double-counting.
3. Refunds mirrored cash back to the customer in both `cash_refunds` and negative `payments`.
4. Supplier payments were not a first-class mirrored workflow like invoice payments.
5. Inventory valuation existed operationally for POS/refunds, but not as a reusable accounting source.
6. Cash session events mixed operational till tracking with potential accounting meaning but no standard counterpart account.

## Reconciliation Intent

Group 5 treats the ledger view as the trusted posting layer, then keeps the
operational subledgers for document UX:

- P&L, Trial Balance, Balance Sheet, Tax Summary, Cash Flow, and dashboard
  financial widgets reconcile from the validated ledger source.
- A/R and A/P aging remain document/subledger views and should reconcile back
  to the `1300` and `2100` control accounts.
- Sales Performance and top-items analytics stay operational reports because
  they are commercial analysis, not core financial statements.
