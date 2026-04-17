/**
 * Shared utilities for the browser print-to-PDF document routes.
 * Worker-safe: pure HTML strings + small helpers, no native deps.
 */

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtMoney(value: unknown, currency: string): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

export interface DocumentChrome {
  /** Page <title>. */
  title: string;
  /** Inner HTML for the document body. */
  body: string;
  /** When true, do not auto-trigger print on page load. */
  noAutoPrint?: boolean;
}

/**
 * Wraps a document body in a clean A4-styled HTML shell with print CSS,
 * a top-bar Print button, and an optional auto window.print() trigger.
 */
export function renderDocumentHtml({ title, body, noAutoPrint }: DocumentChrome): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", sans-serif;
      font-size: 12px;
      color: #111827;
      background: #f3f4f6;
      line-height: 1.45;
    }
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 10px 16px;
      background: #ffffff; border-bottom: 1px solid #e5e7eb;
    }
    .toolbar button {
      font: inherit; padding: 6px 12px; border-radius: 6px;
      background: #111827; color: #ffffff; border: none; cursor: pointer;
    }
    .toolbar button.secondary { background: #f3f4f6; color: #111827; border: 1px solid #e5e7eb; }
    .page {
      max-width: 800px; margin: 16px auto; padding: 36px 40px;
      background: #ffffff; border: 1px solid #e5e7eb; border-radius: 4px;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    .muted { color: #6b7280; }
    .row { display: flex; justify-content: space-between; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .pill {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      background: #eef2ff; color: #4338ca;
    }
    .pill.success { background: #ecfdf5; color: #047857; }
    .pill.warn { background: #fffbeb; color: #92400e; }
    .pill.danger { background: #fef2f2; color: #b91c1c; }
    .pill.muted { background: #f3f4f6; color: #4b5563; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.lines th, table.lines td { padding: 8px 6px; text-align: left; }
    table.lines th { background: #f9fafb; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; font-size: 10px; color: #6b7280; letter-spacing: 0.04em; }
    table.lines td { border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    table.lines td.r, table.lines th.r { text-align: right; }
    table.lines td.mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
    table.totals { margin-left: auto; margin-top: 12px; min-width: 280px; }
    table.totals td { padding: 4px 0; }
    table.totals td.r { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
    table.totals tr.grand td { padding-top: 10px; border-top: 1px solid #111827; font-weight: 700; font-size: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 16px; border-bottom: 2px solid #111827; margin-bottom: 24px; }
    .doc-meta { text-align: right; }
    .doc-meta .num { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; font-weight: 600; }
    .footer-note { margin-top: 32px; padding-top: 12px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #6b7280; white-space: pre-wrap; }
    .kvs { display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 4px; }
    .kvs .k { color: #6b7280; }
    .small { font-size: 11px; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { margin: 0; border: none; padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="secondary" onclick="window.close()">Close</button>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page">
    ${body}
  </div>
  ${noAutoPrint ? "" : `<script>window.addEventListener("load", () => setTimeout(() => { try { window.print(); } catch (e) {} }, 250));</script>`}
</body>
</html>`;
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function notFoundHtml(label: string): Response {
  return htmlResponse(
    renderDocumentHtml({
      title: `${label} not found`,
      body: `<h1>${escapeHtml(label)} not found</h1><p class="muted">This document could not be loaded.</p>`,
      noAutoPrint: true,
    }),
    404,
  );
}

/** Renders the company header block (name, address, contact). */
export function companyHeaderHtml(company: {
  name?: string | null;
  legal_name?: string | null;
  country?: string | null;
} | null): string {
  if (!company) return "";
  const display = company.legal_name || company.name || "";
  return `
    <div>
      <div style="font-size: 18px; font-weight: 700;">${escapeHtml(display)}</div>
      ${company.country ? `<div class="muted small">${escapeHtml(company.country)}</div>` : ""}
    </div>`;
}
