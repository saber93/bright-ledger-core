import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "draft";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  draft: "bg-secondary text-secondary-foreground border-border",
};

const labels: Record<string, { label: string; tone: Tone }> = {
  // invoice
  draft: { label: "Draft", tone: "draft" },
  sent: { label: "Sent", tone: "info" },
  partial: { label: "Partial", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  // bill
  received: { label: "Received", tone: "info" },
  // payment
  pending: { label: "Pending", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  // online order / sales order
  fulfilled: { label: "Fulfilled", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  quotation: { label: "Quotation", tone: "draft" },
  confirmed: { label: "Confirmed", tone: "info" },
  invoiced: { label: "Invoiced", tone: "success" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = labels[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[cfg.tone],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          cfg.tone === "success" && "bg-success",
          cfg.tone === "warning" && "bg-warning",
          cfg.tone === "danger" && "bg-destructive",
          cfg.tone === "info" && "bg-info",
          (cfg.tone === "neutral" || cfg.tone === "draft") && "bg-muted-foreground",
        )}
      />
      {cfg.label}
    </span>
  );
}
