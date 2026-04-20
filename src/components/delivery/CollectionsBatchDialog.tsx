import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BatchPreviewResult } from "@/features/delivery/collections";
import { formatDate, formatMoney } from "@/lib/format";

export function CollectionsBatchDialog({
  open,
  onOpenChange,
  title,
  description,
  preview,
  confirmLabel,
  currency,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  preview: BatchPreviewResult | null;
  confirmLabel: string;
  currency: string;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const items = preview?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Eligible" value={preview?.sendable ?? 0} hint="Will be queued" />
          <SummaryCard label="Skipped" value={preview?.skipped ?? 0} hint="Missing email or suppressed" />
          <SummaryCard label="Total rows" value={preview?.total ?? 0} hint={preview?.asOf ? `As of ${formatDate(preview.asOf)}` : "Preview"} />
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="max-h-[45vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Document</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Recipient</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No matching rows for this preview.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={`${item.documentType}-${item.documentId}`} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{item.documentNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.dueDate ? `Due ${formatDate(item.dueDate)}` : formatDate(item.issueDate)}
                      </div>
                    </td>
                    <td className="px-3 py-2">{item.customerName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {item.recipient ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="capitalize">
                        {item.targetStage?.replace("_", " ") ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatMoney(item.balanceDue, currency)}
                    </td>
                    <td className="px-3 py-2">
                      {item.sendable ? (
                        <span className="text-xs text-success">Ready</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{item.skipReason ?? "Skipped"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={loading || !preview || preview.sendable === 0}
          >
            {loading ? "Sending…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
