import { createFileRoute } from "@tanstack/react-router";
import { createServerClient } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/documents/pos-receipt/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const supabase = createServerClient(request);
        const { data: order, error } = await supabase
          .from("pos_orders")
          .select("*, pos_order_lines(*), pos_payments(*)")
          .eq("id", params.id)
          .maybeSingle();

        if (error || !order) {
          return new Response("Not found", { status: 404 });
        }

        const { data: company } = await supabase
          .from("companies")
          .select("name, currency")
          .eq("id", order.company_id)
          .maybeSingle();

        const fmt = (n: number) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: order.currency || company?.currency || "USD",
          }).format(Number(n) || 0);

        const lines = (order.pos_order_lines as Array<{
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        }>) ?? [];
        const payments = (order.pos_payments as Array<{
          method: string;
          amount: number;
        }>) ?? [];

        const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${order.order_number}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: #000; margin: 0; padding: 8px; max-width: 80mm; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .muted { color: #555; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .sep { border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.r { text-align: right; }
  .totals td { padding: 1px 0; }
  .totals tr.grand td { font-weight: 700; font-size: 13px; padding-top: 4px; border-top: 1px solid #000; }
  .center { text-align: center; }
  .small { font-size: 10px; }
  @media print { .no-print { display: none; } }
  .actions { text-align: center; margin-top: 12px; }
  button { font: inherit; padding: 6px 12px; cursor: pointer; }
</style></head>
<body>
  <h1>${escapeHtml(company?.name ?? "Receipt")}</h1>
  <div class="center small muted">Order ${escapeHtml(order.order_number)}</div>
  <div class="center small muted">${new Date(order.created_at).toLocaleString()}</div>
  <div class="sep"></div>
  <table>
    ${lines
      .map(
        (l) => `
        <tr>
          <td>${escapeHtml(l.description)}</td>
        </tr>
        <tr>
          <td class="muted small">${Number(l.quantity)} × ${fmt(Number(l.unit_price))}</td>
          <td class="r">${fmt(Number(l.line_total))}</td>
        </tr>`,
      )
      .join("")}
  </table>
  <div class="sep"></div>
  <table class="totals">
    <tr><td>Subtotal</td><td class="r">${fmt(Number(order.subtotal))}</td></tr>
    ${Number(order.discount_total) > 0 ? `<tr><td>Discount</td><td class="r">-${fmt(Number(order.discount_total))}</td></tr>` : ""}
    <tr><td>Tax</td><td class="r">${fmt(Number(order.tax_total))}</td></tr>
    <tr class="grand"><td>TOTAL</td><td class="r">${fmt(Number(order.total))}</td></tr>
  </table>
  ${
    payments.length > 0
      ? `<div class="sep"></div>
         <table>${payments.map((p) => `<tr><td class="muted">${escapeHtml(p.method)}</td><td class="r">${fmt(Number(p.amount))}</td></tr>`).join("")}</table>`
      : ""
  }
  <div class="sep"></div>
  <div class="center small muted">Thank you for your purchase</div>
  <div class="actions no-print">
    <button onclick="window.print()">Print receipt</button>
  </div>
  <script>setTimeout(() => { try { window.print(); } catch(e){} }, 200);</script>
</body></html>`;

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
