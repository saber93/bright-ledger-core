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
import { useRecordBillPayment } from "@/features/bills/payment-hooks";
import { formatMoney } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  supplierId: string;
  remaining: number;
  currency: string;
}

export function RecordBillPaymentDialog({
  open,
  onOpenChange,
  billId,
  supplierId,
  remaining,
  currency,
}: Props) {
  const mutation = useRecordBillPayment();
  const [amount, setAmount] = useState<number>(remaining);
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer" | "other">(
    "bank_transfer",
  );
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setAmount(remaining);
      setReference("");
      setNotes("");
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    try {
      await mutation.mutateAsync({
        bill_id: billId,
        supplier_id: supplierId,
        amount: Number(amount) || 0,
        method,
        paid_at: paidAt,
        reference: reference || null,
        notes: notes || null,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record supplier payment</DialogTitle>
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
              onChange={(event) => setAmount(Number(event.target.value || 0))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
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
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Reference</Label>
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Transfer ref, cheque #, etc."
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
