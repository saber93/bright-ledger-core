/**
 * CSV export helpers — browser side.
 * Builds a UTF-8 CSV blob and triggers a download.
 */

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const r of rows) {
    lines.push(r.map(escapeCell).join(","));
  }
  // BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
