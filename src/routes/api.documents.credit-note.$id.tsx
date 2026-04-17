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

export const Route = createFileRoute("/api/documents/credit-note/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: note, error } = await supabaseAdmin
          .from("credit_notes")
          .select(
            "*, customers(name, email, tax_id), customer_invoices:source_invoice_id(invoice_number), pos_orders:source_pos_order_id(order_number)",
          )
          .eq("id", params.id)
          .maybeSingle();
        if (error || !note) return notFoundHtml("Credit note");

        const [{ data: lines }, { data: allocations }, { data: refunds }, { data: company }] =
          await Promise.all([
            supabaseAdmin
              .from("credit_note_lines")
              .select("*")
              .eq("credit_note_id", note.id)
              .order("position"),
            supabaseAdmin
              .from("credit_note_allocations")
              .select("*, customer_invoices:target_invoice_id(invoice_number)")
              .eq("credit_note_id", note.id)
              .order("created_at"),
            supabaseAdmin
              .from("cash_refunds")
              .select("amount, method, paid_at, reference")
              .eq("credit_note_id", note.id)
              .order("paid_at", { ascending: false }),
            supabaseAdmin
              .from("companies")
              .select("name, legal_name, currency, country")
              .eq("id", note.company_id)
              .maybeSingle(),
          ]);

        const currency = note.currency || company?.currency || "USD";
        const customer = (
          note as { customers: { name: string; email: string | null; tax_id: string | null } | null }
        ).customers;
        const sourceInvoice = (
          note as { customer_invoices: { invoice_number: string } | null }
        ).customer_invoices;
        const sourcePos = (note as { pos_orders: { order_number: string } | null }).pos_orders;

        const linesHtml = (lines ?? [])
          .map(
            (l) => `
              <tr>
                <td>${escapeHtml(l.description)}</td>
                <td class="r mono">${Number(l.quantity)}</td>
                <td class="r mono">${fmtMoney(l.unit_price, currency)}</td>
                <td class="r mono muted">${Number(l.tax_rate)}% · ${fmtMoney(l.tax_amount, currency)}</td>
                <td class="r mono">${fmtMoney(l.line_total, currency)}</td>
              </tr>`,
          )
          .join("");

        const allocsHtml =
          (allocations ?? []).length === 0
            ? `<p class="muted small">No allocations.</p>`
            : `<table class="lines">
                <thead><tr><th>Type</th><th>Reference</th><th>Note</th><th class="r">Amount</th></tr></thead>
                <tbody>${(allocations ?? [])
                  .map((a) => {
                    const targetInv = (
                      a as unknown as { customer_invoices: { invoice_number: string } | null }
                    ).customer_invoices;
                    const ref = a.target_type === "invoice" ? targetInv?.invoice_number ?? "—" : "—";
                    return `<tr>
                      <td style="text-transform: capitalize;">${escapeHtml(String(a.target_type).replace("_", " "))}</td>
                      <td class="mono">${escapeHtml(ref)}</td>
                      <td>${escapeHtml(a.note ?? "—")}</td>
                      <td class="r mono">${fmtMoney(a.amount, currency)}</td>
                    </tr>`;
                  })
                  .join("")}</tbody>
              </table>`;

        const refundsHtml =
          (refunds ?? []).length === 0
            ? ""
            : `<h2>Cash impact</h2>
              <table class="lines">
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr></thead>
                <tbody>${(refunds ?? [])
                  .map(
                    (r) => `<tr>
                      <td>${fmtDateTime(r.paid_at)}</td>
                      <td style="text-transform: capitalize;">${escapeHtml(r.method)}</td>
                      <td>${escapeHtml(r.reference ?? "—")}</td>
                      <td class="r mono">−${fmtMoney(r.amount, currency)}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table>`;

        const sourceLabel = sourceInvoice
          ? `Invoice ${sourceInvoice.invoice_number}`
          : sourcePos
            ? `POS order ${sourcePos.order_number}`
            : "Manual";

        const body = `
          <div class="header">
            ${companyHeaderHtml(company ?? null)}
            <div class="doc-meta">
              <div class="num">CREDIT NOTE ${escapeHtml(note.credit_note_number)}</div>
              <div class="small" style="margin-top: 8px;">Issued: ${fmtDate(note.issue_date)}</div>
              <div class="muted small" style="text-transform: capitalize;">Status: ${escapeHtml(String(note.status).replace("_", " "))}</div>
            </div>
          </div>

          <div class="grid-2">
            <div>
              <h2>Customer</h2>
              <div style="font-weight: 600;">${escapeHtml(customer?.name ?? "—")}</div>
              ${customer?.email ? `<div class="small muted">${escapeHtml(customer.email)}</div>` : ""}
              ${customer?.tax_id ? `<div class="small muted">Tax ID: ${escapeHtml(customer.tax_id)}</div>` : ""}
            </div>
            <div>
              <h2>Source</h2>
              <div class="kvs small">
                <span class="k">Type</span><span style="text-transform: capitalize;">${escapeHtml(note.source_type)}</span>
                <span class="k">Reference</span><span class="mono">${escapeHtml(sourceLabel)}</span>
                ${note.reason ? `<span class="k">Reason</span><span>${escapeHtml(note.reason)}</span>` : ""}
                <span class="k">Restock</span><span>${note.restock ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          <h2>Refunded items</h2>
          <table class="lines">
            <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Tax</th><th class="r">Total</th></tr></thead>
            <tbody>${linesHtml || `<tr><td colspan="5" class="muted small">No lines.</td></tr>`}</tbody>
          </table>

          <table class="totals">
            <tr><td>Subtotal</td><td class="r">${fmtMoney(note.subtotal, currency)}</td></tr>
            <tr><td>Tax</td><td class="r">${fmtMoney(note.tax_total, currency)}</td></tr>
            <tr class="grand"><td>Refund total</td><td class="r">${fmtMoney(note.total, currency)}</td></tr>
            <tr><td>Allocated</td><td class="r">${fmtMoney(note.amount_allocated, currency)}</td></tr>
          </table>

          <h2>Allocation</h2>
          ${allocsHtml}

          ${refundsHtml}

          ${note.notes ? `<div class="footer-note">${escapeHtml(note.notes)}</div>` : ""}
        `;

        return htmlResponse(
          renderDocumentHtml({
            title: `Credit note ${note.credit_note_number}`,
            body,
          }),
        );
      },
    },
  },
});
