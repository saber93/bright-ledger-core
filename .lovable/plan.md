

User has approved with specific adjustments. Let me revise the plan incorporating all 7 points concisely. No need to re-explore — I have full context.

Key adjustments:
1. POS receipt (PDF download + print) moves to Group 2
2. Refunds → proper credit_notes model with allocation against invoices, customer_credit_balance, and cash_refunds
3. POS context: register_id, branch_id, warehouse_id on pos_orders
4. Route rename: /quick-expenses
5. tax_rates: is_active, effective_from
6. Quick expense posting: paid → Dr expense / Cr cash|bank; unpaid → Dr expense / Cr A/P (or accrued)
7. POS line: product_id nullable (allow ad-hoc), is_service flag derived, manual_price_override + price_override_reason gated by role

Need branches table since none exists — add to Group 1. Registers table for POS terminals.

Keep concise.

