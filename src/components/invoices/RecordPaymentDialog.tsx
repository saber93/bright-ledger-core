import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRecordInvoicePayment } from "@/features/invoices/payment-hooks";
import { formatMoney } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoiceId: string;
  customerId: string;
  remaining: number;
  currency: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  customerId,
  remaining,
  currency,
}: Props) {
  const mut = useRecordInvoicePayment();
  const [amount, setAmount] = useState<number>(remaining);
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer" | "other">(
    "bank_transfer",
  );
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Re-sync the suggested amount when dialog reopens for a different invoice
  // by snapping to remaining if user hasn't typed anything custom.
  function handleOpenChange(o: boolean) {
    if (o) {
      setAmount(remaining);
      setReference("");
      setNotes("");
    }
    onOpenChange(o);
  }

  async function submit() {
    try {
      await mut.mutateAsync({
        invoice_id: invoiceId,
        customer_id: customerId,
        amount: Number(amount) || 0,
        method,
        paid_at: paidAt,
        reference: reference || null,
        notes: notes || null,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record payment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Remaining balance: {formatMoney(remaining, currency)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid at</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Reference</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque #, txn ID, etc."
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
