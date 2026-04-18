import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  companyHeaderHtml,
  escapeHtml,
  fmtDateTime,
  fmtMoney,
  htmlResponse,
  notFoundHtml,
  renderDocumentHtml,
  requireDocumentAccess,
} from "./api.documents.shared";

export const Route = createFileRoute("/api/documents/cash-session/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { data: session, error } = await supabaseAdmin
          .from("cash_sessions")
          .select("*, branches(name, code), pos_registers(name, code)")
          .eq("id", params.id)
          .maybeSingle();
        if (error || !session) return notFoundHtml("Cash session");

        const guard = await requireDocumentAccess(request, session.company_id);
        if (!guard.ok) return guard.response;

        const [{ data: events }, { data: orders }, { data: company }] = await Promise.all([
          supabaseAdmin
            .from("cash_session_events")
            .select("type, amount, note, reference, created_at")
            .eq("session_id", session.id)
            .order("created_at"),
          supabaseAdmin
            .from("pos_orders")
            .select("id, order_number, total, completed_at")
            .eq("session_id", session.id)
            .order("created_at"),
          supabaseAdmin
            .from("companies")
            .select("name, legal_name, currency, country")
            .eq("id", session.company_id)
            .maybeSingle(),
        ]);

        const currency = company?.currency || "USD";

        // POS payment totals by method for this session's orders
        const orderIds = (orders ?? []).map((o) => o.id);
        let payByMethod = new Map<string, number>();
        let posTotal = 0;
        if (orderIds.length > 0) {
          const { data: pays } = await supabaseAdmin
            .from("pos_payments")
            .select("method, amount, order_id")
            .in("order_id", orderIds);
          for (const p of pays ?? []) {
            const cur = payByMethod.get(p.method) ?? 0;
            payByMethod.set(p.method, cur + Number(p.amount));
          }
          posTotal = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
        }

        // Cash refunds against this session
        const { data: refunds } = await supabaseAdmin
          .from("cash_refunds")
          .select("amount, method, paid_at, reference")
          .eq("session_id", session.id);
        const refundTotal = (refunds ?? []).reduce((s, r) => s + Number(r.amount), 0);

        const branch = (session as { branches: { name: string; code: string } | null }).branches;
        const register = (session as { pos_registers: { name: string; code: string } | null }).pos_registers;

        const eventsHtml =
          (events ?? []).length === 0
            ? `<p class="muted small">No drawer events.</p>`
            : `<table class="lines">
                <thead><tr><th>Time</th><th>Type</th><th>Note</th><th class="r">Amount</th></tr></thead>
                <tbody>${(events ?? [])
                  .map(
                    (e) => `<tr>
                      <td>${fmtDateTime(e.created_at)}</td>
                      <td style="text-transform: capitalize;">${escapeHtml(String(e.type).replace("_", " "))}</td>
                      <td>${escapeHtml(e.note ?? e.reference ?? "—")}</td>
                      <td class="r mono">${fmtMoney(e.amount, currency)}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table>`;

        const ordersHtml =
          (orders ?? []).length === 0
            ? `<p class="muted small">No POS orders in this session.</p>`
            : `<table class="lines">
                <thead><tr><th>Order</th><th>Completed</th><th class="r">Total</th></tr></thead>
                <tbody>${(orders ?? [])
                  .map(
                    (o) => `<tr>
                      <td class="mono">${escapeHtml(o.order_number)}</td>
                      <td>${o.completed_at ? fmtDateTime(o.completed_at) : "—"}</td>
                      <td class="r mono">${fmtMoney(o.total, currency)}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
                <tfoot><tr>
                  <td colspan="2" class="r small muted" style="padding-top: 6px;">Total POS sales</td>
                  <td class="r mono" style="padding-top: 6px; font-weight: 700;">${fmtMoney(
                    (orders ?? []).reduce((s, o) => s + Number(o.total), 0),
                    currency,
                  )}</td>
                </tr></tfoot>
              </table>`;

        const methodsHtml =
          payByMethod.size === 0
            ? `<p class="muted small">No POS payments.</p>`
            : `<table class="lines">
                <thead><tr><th>Method</th><th class="r">Amount</th></tr></thead>
                <tbody>${[...payByMethod.entries()]
                  .map(
                    ([m, amt]) => `<tr>
                      <td style="text-transform: capitalize;">${escapeHtml(m)}</td>
                      <td class="r mono">${fmtMoney(amt, currency)}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
                <tfoot><tr>
                  <td class="r small muted" style="padding-top: 6px;">Total</td>
                  <td class="r mono" style="padding-top: 6px; font-weight: 700;">${fmtMoney(posTotal, currency)}</td>
                </tr></tfoot>
              </table>`;

        const variance = Number(session.variance ?? 0);

        const body = `
          <div class="header">
            ${companyHeaderHtml(company ?? null)}
            <div class="doc-meta">
              <div class="num">Z-REPORT</div>
              <div class="small" style="margin-top: 8px;">${escapeHtml(branch?.name ?? "—")} · ${escapeHtml(register?.name ?? "—")}</div>
              <div class="muted small" style="text-transform: capitalize;">${escapeHtml(session.status)}</div>
            </div>
          </div>

          <div class="grid-2">
            <div>
              <h2>Session</h2>
              <div class="kvs small">
                <span class="k">Opened</span><span>${fmtDateTime(session.opened_at)}</span>
                <span class="k">Closed</span><span>${session.closed_at ? fmtDateTime(session.closed_at) : "—"}</span>
                <span class="k">Branch</span><span>${escapeHtml(branch?.name ?? "—")}</span>
                <span class="k">Register</span><span>${escapeHtml(register?.name ?? "—")}</span>
              </div>
            </div>
            <div>
              <h2>Reconciliation</h2>
              <div class="kvs small">
                <span class="k">Opening cash</span><span class="r mono">${fmtMoney(session.opening_cash, currency)}</span>
                <span class="k">Expected cash</span><span class="r mono">${fmtMoney(session.expected_cash, currency)}</span>
                <span class="k">Counted cash</span><span class="r mono">${session.counted_cash !== null ? fmtMoney(session.counted_cash, currency) : "—"}</span>
                <span class="k" style="font-weight: 600;">Variance</span><span class="r mono" style="font-weight: 700; color: ${variance < 0 ? "#b91c1c" : variance > 0 ? "#047857" : "inherit"};">${session.counted_cash !== null ? `${variance >= 0 ? "+" : ""}${fmtMoney(variance, currency)}` : "—"}</span>
              </div>
            </div>
          </div>

          <h2>POS sales</h2>
          ${ordersHtml}

          <h2>Payments by method</h2>
          ${methodsHtml}

          <h2>Drawer events</h2>
          ${eventsHtml}

          ${
            refundTotal > 0
              ? `<h2>Cash refunds</h2>
                 <p class="small">Total refunded from this session: <strong>${fmtMoney(refundTotal, currency)}</strong></p>`
              : ""
          }

          ${session.notes ? `<div class="footer-note">${escapeHtml(session.notes)}</div>` : ""}
        `;

        return htmlResponse(
          renderDocumentHtml({
            title: `Z-Report · ${register?.name ?? "Session"}`,
            body,
          }),
        );
      },
    },
  },
});
