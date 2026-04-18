import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  companyHeaderHtml,
  escapeHtml,
  fmtDate,
  fmtMoney,
  htmlResponse,
  notFoundHtml,
  renderDocumentHtml,
  requireDocumentAccess,
} from "./api.documents.shared";

export const Route = createFileRoute("/api/documents/invoice/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { data: invoice, error } = await supabaseAdmin
          .from("customer_invoices")
          .select("*, customers(name, email, phone, address_line1, city, country, tax_id)")
          .eq("id", params.id)
          .maybeSingle();
        if (error || !invoice) return notFoundHtml("Invoice");

        const guard = await requireDocumentAccess(request, invoice.company_id);
        if (!guard.ok) return guard.response;

        const [{ data: lines }, { data: payments }, { data: company }] = await Promise.all([
          supabaseAdmin
            .from("invoice_lines")
            .select("*")
            .eq("invoice_id", invoice.id)
            .order("position"),
          supabaseAdmin
            .from("payments")
            .select("amount, method, paid_at, reference, direction")
            .eq("invoice_id", invoice.id)
            .order("paid_at", { ascending: false }),
          supabaseAdmin
            .from("companies")
            .select("name, legal_name, currency, country")
            .eq("id", invoice.company_id)
            .maybeSingle(),
        ]);

        const currency = invoice.currency || company?.currency || "USD";
        const customer = (invoice as { customers: { name: string; email: string | null; phone: string | null; address_line1: string | null; city: string | null; country: string | null; tax_id: string | null } | null }).customers;
        const remaining = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));

        const statusPill =
          invoice.status === "paid"
            ? `<span class="pill success">Paid</span>`
            : invoice.status === "overdue"
              ? `<span class="pill danger">Overdue</span>`
              : invoice.status === "partial"
                ? `<span class="pill warn">Partial</span>`
                : invoice.status === "cancelled"
                  ? `<span class="pill muted">Cancelled</span>`
                  : `<span class="pill">${escapeHtml(invoice.status)}</span>`;

        const linesHtml = (lines ?? [])
          .map(
            (l) => `
              <tr>
                <td>${escapeHtml(l.description)}</td>
                <td class="r mono">${Number(l.quantity)}</td>
                <td class="r mono">${fmtMoney(l.unit_price, currency)}</td>
                <td class="r mono muted">${Number(l.tax_rate)}%</td>
                <td class="r mono">${fmtMoney(l.line_total, currency)}</td>
              </tr>`,
          )
          .join("");

        const paymentsHtml =
          (payments ?? []).length === 0
            ? `<p class="muted small">No payments recorded.</p>`
            : `<table class="lines">
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr></thead>
                <tbody>
                  ${(payments ?? [])
                    .map(
                      (p) => `<tr>
                        <td>${fmtDate(p.paid_at)}</td>
                        <td style="text-transform: capitalize;">${escapeHtml(String(p.method).replace("_", " "))}</td>
                        <td>${escapeHtml(p.reference ?? "—")}</td>
                        <td class="r mono">${p.direction === "out" ? "−" : ""}${fmtMoney(p.amount, currency)}</td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>`;

        const body = `
          <div class="header">
            ${companyHeaderHtml(company ?? null)}
            <div class="doc-meta">
              <div class="num">INVOICE ${escapeHtml(invoice.invoice_number)}</div>
              <div class="muted small" style="margin-top: 4px;">${statusPill}</div>
              <div class="small" style="margin-top: 8px;">Issued: ${fmtDate(invoice.issue_date)}</div>
              ${invoice.due_date ? `<div class="small">Due: ${fmtDate(invoice.due_date)}</div>` : ""}
            </div>
          </div>

          <div class="grid-2">
            <div>
              <h2>Bill to</h2>
              <div style="font-weight: 600;">${escapeHtml(customer?.name ?? "—")}</div>
              ${customer?.email ? `<div class="small muted">${escapeHtml(customer.email)}</div>` : ""}
              ${customer?.phone ? `<div class="small muted">${escapeHtml(customer.phone)}</div>` : ""}
              ${customer?.address_line1 ? `<div class="small">${escapeHtml(customer.address_line1)}</div>` : ""}
              ${customer?.city || customer?.country ? `<div class="small">${escapeHtml([customer.city, customer.country].filter(Boolean).join(", "))}</div>` : ""}
              ${customer?.tax_id ? `<div class="small muted">Tax ID: ${escapeHtml(customer.tax_id)}</div>` : ""}
            </div>
            <div>
              <h2>Summary</h2>
              <div class="kvs small">
                <span class="k">Subtotal</span><span class="r mono">${fmtMoney(invoice.subtotal, currency)}</span>
                <span class="k">Tax</span><span class="r mono">${fmtMoney(invoice.tax_total, currency)}</span>
                <span class="k">Total</span><span class="r mono" style="font-weight: 700;">${fmtMoney(invoice.total, currency)}</span>
                <span class="k">Paid</span><span class="r mono">${fmtMoney(invoice.amount_paid, currency)}</span>
                <span class="k" style="font-weight: 600;">Balance</span><span class="r mono" style="font-weight: 700;">${fmtMoney(remaining, currency)}</span>
              </div>
            </div>
          </div>

          <h2>Items</h2>
          <table class="lines">
            <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Tax</th><th class="r">Total</th></tr></thead>
            <tbody>${linesHtml || `<tr><td colspan="5" class="muted small">No line items.</td></tr>`}</tbody>
          </table>

          <table class="totals">
            <tr><td>Subtotal</td><td class="r">${fmtMoney(invoice.subtotal, currency)}</td></tr>
            <tr><td>Tax</td><td class="r">${fmtMoney(invoice.tax_total, currency)}</td></tr>
            <tr class="grand"><td>Total</td><td class="r">${fmtMoney(invoice.total, currency)}</td></tr>
            <tr><td>Paid</td><td class="r">${fmtMoney(invoice.amount_paid, currency)}</td></tr>
            <tr><td><strong>Balance due</strong></td><td class="r"><strong>${fmtMoney(remaining, currency)}</strong></td></tr>
          </table>

          <h2>Payment history</h2>
          ${paymentsHtml}

          ${invoice.notes ? `<div class="footer-note">${escapeHtml(invoice.notes)}</div>` : ""}
        `;

        return htmlResponse(
          renderDocumentHtml({
            title: `Invoice ${invoice.invoice_number}`,
            body,
          }),
        );
      },
    },
  },
});
