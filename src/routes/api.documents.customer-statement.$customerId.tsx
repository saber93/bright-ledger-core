import { createFileRoute } from "@tanstack/react-router";
import {
  companyHeaderHtml,
  escapeHtml,
  fmtDate,
  fmtMoney,
  htmlResponse,
  notFoundHtml,
  renderDocumentHtml,
  requireDocumentAccess,
} from "@/routes/-api.documents.shared";
import { loadCustomerStatementDocument } from "@/features/delivery/server";

export const Route = createFileRoute("/api/documents/customer-statement/$customerId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const statement = await loadCustomerStatementDocument(params.customerId);
        if (!statement) return notFoundHtml("Customer statement");

        const guard = await requireDocumentAccess(request, statement.companyId, {
          documentType: "customer_statement",
          documentId: statement.customer.id,
        });
        if (!guard.ok) return guard.response;

        const currency = statement.currency;
        const openInvoicesHtml =
          statement.openInvoices.length === 0
            ? `<tr><td colspan="5" class="muted small">No open invoices.</td></tr>`
            : statement.openInvoices
                .map(
                  (invoice) => `<tr>
                    <td class="mono">${escapeHtml(invoice.invoice_number)}</td>
                    <td>${fmtDate(invoice.issue_date)}</td>
                    <td>${fmtDate(invoice.due_date)}</td>
                    <td class="r mono">${fmtMoney(invoice.total, currency)}</td>
                    <td class="r mono">${fmtMoney(invoice.remaining, currency)}</td>
                  </tr>`,
                )
                .join("");

        const paymentsHtml =
          statement.recentPayments.length === 0
            ? `<tr><td colspan="4" class="muted small">No recent payments.</td></tr>`
            : statement.recentPayments
                .map(
                  (payment) => `<tr>
                    <td>${fmtDate(payment.paid_at)}</td>
                    <td style="text-transform: capitalize;">${escapeHtml(payment.method.replaceAll("_", " "))}</td>
                    <td>${escapeHtml(payment.reference ?? "—")}</td>
                    <td class="r mono">${fmtMoney(payment.amount, currency)}</td>
                  </tr>`,
                )
                .join("");

        const creditsHtml =
          statement.recentCredits.length === 0
            ? `<tr><td colspan="4" class="muted small">No credit notes.</td></tr>`
            : statement.recentCredits
                .map(
                  (credit) => `<tr>
                    <td class="mono">${escapeHtml(credit.credit_note_number)}</td>
                    <td>${fmtDate(credit.issue_date)}</td>
                    <td style="text-transform: capitalize;">${escapeHtml(credit.status.replaceAll("_", " "))}</td>
                    <td class="r mono">${fmtMoney(credit.total, currency)}</td>
                  </tr>`,
                )
                .join("");

        const today = new Date().toISOString().slice(0, 10);
        const body = `
          <div class="header">
            ${companyHeaderHtml(statement.company)}
            <div class="doc-meta">
              <div class="num">ACCOUNT STATEMENT</div>
              <div class="small" style="margin-top: 8px;">As of ${fmtDate(today)}</div>
            </div>
          </div>

          <div class="grid-2">
            <div>
              <h2>Customer</h2>
              <div style="font-weight: 600;">${escapeHtml(statement.customer.name)}</div>
              ${statement.customer.email ? `<div class="small muted">${escapeHtml(statement.customer.email)}</div>` : ""}
            </div>
            <div>
              <h2>Summary</h2>
              <div class="kvs small">
                <span class="k">Open invoices</span><span>${statement.openInvoices.length}</span>
                <span class="k">Total due</span><span class="r mono">${fmtMoney(statement.totalDue, currency)}</span>
                <span class="k">Available credit</span><span class="r mono">${fmtMoney(statement.availableCredit, currency)}</span>
              </div>
            </div>
          </div>

          <h2>Open invoices</h2>
          <table class="lines">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Issued</th>
                <th>Due</th>
                <th class="r">Total</th>
                <th class="r">Open balance</th>
              </tr>
            </thead>
            <tbody>${openInvoicesHtml}</tbody>
          </table>

          <h2>Recent payments</h2>
          <table class="lines">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th class="r">Amount</th>
              </tr>
            </thead>
            <tbody>${paymentsHtml}</tbody>
          </table>

          <h2>Credits & refunds</h2>
          <table class="lines">
            <thead>
              <tr>
                <th>Credit note</th>
                <th>Issued</th>
                <th>Status</th>
                <th class="r">Amount</th>
              </tr>
            </thead>
            <tbody>${creditsHtml}</tbody>
          </table>

          <table class="totals">
            <tr><td>Total open receivables</td><td class="r">${fmtMoney(statement.totalDue, currency)}</td></tr>
            <tr><td>Available credit</td><td class="r">${fmtMoney(statement.availableCredit, currency)}</td></tr>
            <tr class="grand"><td>Net customer position</td><td class="r">${fmtMoney(statement.totalDue - statement.availableCredit, currency)}</td></tr>
          </table>
        `;

        return htmlResponse(
          renderDocumentHtml({
            title: `Statement ${statement.customer.name}`,
            body,
          }),
        );
      },
    },
  },
});
