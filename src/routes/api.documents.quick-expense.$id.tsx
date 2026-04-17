import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  companyHeaderHtml,
  escapeHtml,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  htmlResponse,
  notFoundHtml,
  renderDocumentHtml,
} from "./api.documents.shared";

export const Route = createFileRoute("/api/documents/quick-expense/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: expense, error } = await supabaseAdmin
          .from("quick_expenses")
          .select(
            "*, account:chart_of_accounts!quick_expenses_account_id_fkey(code, name), payable:chart_of_accounts!quick_expenses_payable_account_id_fkey(code, name), suppliers(name), branches(name), tax_rates(name, rate)",
          )
          .eq("id", params.id)
          .maybeSingle();
        if (error || !expense) return notFoundHtml("Expense");

        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("name, legal_name, currency, country")
          .eq("id", expense.company_id)
          .maybeSingle();

        const currency = expense.currency || company?.currency || "USD";
        const total = Number(expense.amount) + Number(expense.tax_amount ?? 0);

        type Detail = typeof expense & {
          account: { code: string; name: string } | null;
          payable: { code: string; name: string } | null;
          suppliers: { name: string } | null;
          branches: { name: string } | null;
          tax_rates: { name: string; rate: number } | null;
        };
        const d = expense as Detail;

        const methodLabel: Record<string, string> = {
          cash: "Cash",
          bank: "Bank transfer",
          card: "Card",
          petty_cash: "Petty cash",
          unpaid: "Unpaid (on credit)",
          other: "Other",
        };

        const accountingRows = `
          <tr>
            <td>${escapeHtml(d.account ? `${d.account.code} ${d.account.name}` : "Expense")}</td>
            <td class="r mono">${fmtMoney(d.amount, currency)}</td>
            <td class="r mono muted">—</td>
          </tr>
          ${
            Number(d.tax_amount) > 0
              ? `<tr><td>Input tax</td><td class="r mono">${fmtMoney(d.tax_amount, currency)}</td><td class="r mono muted">—</td></tr>`
              : ""
          }
          <tr>
            <td>${escapeHtml(
              d.paid
                ? methodLabel[d.payment_method] ?? d.payment_method
                : d.payable
                  ? `${d.payable.code} ${d.payable.name}`
                  : "Accounts payable",
            )}</td>
            <td class="r mono muted">—</td>
            <td class="r mono">${fmtMoney(total, currency)}</td>
          </tr>`;

        const body = `
          <div class="header">
            ${companyHeaderHtml(company ?? null)}
            <div class="doc-meta">
              <div class="num">EXPENSE ${escapeHtml(d.expense_number)}</div>
              <div class="small" style="margin-top: 8px;">Date: ${fmtDate(d.date)}</div>
              <div class="muted small">${
                d.paid
                  ? `<span class="pill success">Paid</span>`
                  : `<span class="pill warn">Unpaid</span>`
              }</div>
            </div>
          </div>

          <div class="grid-2">
            <div>
              <h2>Detail</h2>
              <div class="kvs small">
                <span class="k">Description</span><span>${escapeHtml(d.description)}</span>
                <span class="k">Account</span><span>${escapeHtml(d.account ? `${d.account.code} ${d.account.name}` : "—")}</span>
                <span class="k">Method</span><span>${escapeHtml(methodLabel[d.payment_method] ?? d.payment_method)}</span>
                ${!d.paid ? `<span class="k">Payable</span><span>${escapeHtml(d.payable ? `${d.payable.code} ${d.payable.name}` : "—")}</span>` : ""}
                <span class="k">Supplier</span><span>${escapeHtml(d.suppliers?.name ?? "—")}</span>
                <span class="k">Branch</span><span>${escapeHtml(d.branches?.name ?? "—")}</span>
                <span class="k">Tax rate</span><span>${d.tax_rates ? `${escapeHtml(d.tax_rates.name)} · ${Number(d.tax_rates.rate)}%` : "No tax"}</span>
                <span class="k">Created</span><span>${fmtDateTime(d.created_at)}</span>
              </div>
            </div>
            <div>
              <h2>Amount</h2>
              <div class="kvs small">
                <span class="k">Net</span><span class="r mono">${fmtMoney(d.amount, currency)}</span>
                <span class="k">Tax</span><span class="r mono">${fmtMoney(d.tax_amount, currency)}</span>
                <span class="k" style="font-weight: 600;">Total</span><span class="r mono" style="font-weight: 700;">${fmtMoney(total, currency)}</span>
              </div>
            </div>
          </div>

          <h2>Accounting impact</h2>
          <table class="lines">
            <thead><tr><th>Account</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead>
            <tbody>${accountingRows}</tbody>
            <tfoot>
              <tr>
                <td class="muted small" style="border-top: 1px solid #111827; padding-top: 6px;">Balance</td>
                <td class="r mono" style="border-top: 1px solid #111827; padding-top: 6px;">${fmtMoney(total, currency)}</td>
                <td class="r mono" style="border-top: 1px solid #111827; padding-top: 6px;">${fmtMoney(total, currency)}</td>
              </tr>
            </tfoot>
          </table>
        `;

        return htmlResponse(
          renderDocumentHtml({
            title: `Expense ${d.expense_number}`,
            body,
          }),
        );
      },
    },
  },
});
