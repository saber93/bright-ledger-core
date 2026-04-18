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

export const Route = createFileRoute("/api/documents/bill/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { data: bill, error } = await supabaseAdmin
          .from("supplier_bills")
          .select("*, suppliers(name, email, phone, tax_id)")
          .eq("id", params.id)
          .maybeSingle();
        if (error || !bill) return notFoundHtml("Bill");

        const guard = await requireDocumentAccess(request, bill.company_id);
        if (!guard.ok) return guard.response;

        const [{ data: lines }, { data: payments }, { data: company }] = await Promise.all([
          supabaseAdmin
            .from("bill_lines")
            .select("*")
            .eq("bill_id", bill.id)
            .order("position"),
          supabaseAdmin
            .from("payments")
            .select("amount, method, paid_at, reference, direction")
            .eq("bill_id", bill.id)
            .order("paid_at", { ascending: false }),
          supabaseAdmin
            .from("companies")
            .select("name, legal_name, currency, country")
            .eq("id", bill.company_id)
            .maybeSingle(),
        ]);

        const currency = bill.currency || company?.currency || "USD";
        const supplier = (bill as { suppliers: { name: string; email: string | null; phone: string | null; tax_id: string | null } | null }).suppliers;
        const remaining = Math.max(0, Number(bill.total) - Number(bill.amount_paid));

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
                <tbody>${(payments ?? [])
                  .map(
                    (p) => `<tr>
                      <td>${fmtDate(p.paid_at)}</td>
                      <td style="text-transform: capitalize;">${escapeHtml(String(p.method).replace("_", " "))}</td>
                      <td>${escapeHtml(p.reference ?? "—")}</td>
                      <td class="r mono">${fmtMoney(p.amount, currency)}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table>`;

        const body = `
          <div class="header">
            ${companyHeaderHtml(company ?? null)}
            <div class="doc-meta">
              <div class="num">BILL ${escapeHtml(bill.bill_number)}</div>
              <div class="small" style="margin-top: 8px;">Issued: ${fmtDate(bill.issue_date)}</div>
              ${bill.due_date ? `<div class="small">Due: ${fmtDate(bill.due_date)}</div>` : ""}
              <div class="muted small" style="margin-top: 4px; text-transform: capitalize;">Status: ${escapeHtml(bill.status)}</div>
            </div>
          </div>

          <div class="grid-2">
            <div>
              <h2>Supplier</h2>
              <div style="font-weight: 600;">${escapeHtml(supplier?.name ?? "—")}</div>
              ${supplier?.email ? `<div class="small muted">${escapeHtml(supplier.email)}</div>` : ""}
              ${supplier?.phone ? `<div class="small muted">${escapeHtml(supplier.phone)}</div>` : ""}
              ${supplier?.tax_id ? `<div class="small muted">Tax ID: ${escapeHtml(supplier.tax_id)}</div>` : ""}
            </div>
            <div>
              <h2>Summary</h2>
              <div class="kvs small">
                <span class="k">Subtotal</span><span class="r mono">${fmtMoney(bill.subtotal, currency)}</span>
                <span class="k">Tax</span><span class="r mono">${fmtMoney(bill.tax_total, currency)}</span>
                <span class="k">Total</span><span class="r mono" style="font-weight: 700;">${fmtMoney(bill.total, currency)}</span>
                <span class="k">Paid</span><span class="r mono">${fmtMoney(bill.amount_paid, currency)}</span>
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
            <tr><td>Subtotal</td><td class="r">${fmtMoney(bill.subtotal, currency)}</td></tr>
            <tr><td>Tax</td><td class="r">${fmtMoney(bill.tax_total, currency)}</td></tr>
            <tr class="grand"><td>Total</td><td class="r">${fmtMoney(bill.total, currency)}</td></tr>
            <tr><td>Paid</td><td class="r">${fmtMoney(bill.amount_paid, currency)}</td></tr>
            <tr><td><strong>Balance owed</strong></td><td class="r"><strong>${fmtMoney(remaining, currency)}</strong></td></tr>
          </table>

          <h2>Payment history</h2>
          ${paymentsHtml}

          ${bill.notes ? `<div class="footer-note">${escapeHtml(bill.notes)}</div>` : ""}
        `;

        return htmlResponse(
          renderDocumentHtml({ title: `Bill ${bill.bill_number}`, body }),
        );
      },
    },
  },
});
