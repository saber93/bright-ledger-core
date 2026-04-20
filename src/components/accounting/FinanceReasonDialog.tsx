import { useEffect, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FinanceReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder = "Explain why this finance-sensitive action is needed.",
  confirmLabel = "Confirm",
  pendingLabel = "Saving…",
  actionTone = "primary",
  onConfirm,
  requireReason = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  placeholder?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  actionTone?: "primary" | "danger";
  onConfirm: (reason: string) => Promise<void>;
  requireReason?: boolean;
}) {
  const reasonFieldId = useId();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trimmedReason = reason.trim();

  useEffect(() => {
    if (!open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  async function submit() {
    if (requireReason && !trimmedReason) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmedReason);
      onOpenChange(false);
    } catch {
      // Callers handle user-facing error toasts; keep the dialog open without bubbling
      // an unhandled rejection through the browser event loop.
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={reasonFieldId}>Reason</Label>
          <Textarea
            id={reasonFieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={actionTone === "danger" ? "destructive" : "default"}
            onClick={submit}
            disabled={submitting || (requireReason && !trimmedReason)}
          >
            {submitting ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
