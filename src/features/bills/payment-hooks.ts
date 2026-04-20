import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAccountingPeriodUnlocked } from "@/features/accounting/locks";
import { useAuth } from "@/lib/auth";

export interface RecordBillPaymentInput {
  bill_id: string;
  supplier_id: string;
  amount: number;
  method: "cash" | "card" | "bank_transfer" | "other";
  paid_at: string;
  reference?: string | null;
  notes?: string | null;
}

export function useRecordBillPayment() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();

  return useMutation({
    mutationFn: async (input: RecordBillPaymentInput) => {
      if (!companyId) throw new Error("Missing company");
      if (input.amount <= 0) throw new Error("Amount must be greater than zero");
      await ensureAccountingPeriodUnlocked(companyId, input.paid_at, "supplier payment");

      const { data: bill, error: billErr } = await supabase
        .from("supplier_bills")
        .select("id, total, amount_paid, status, currency")
        .eq("id", input.bill_id)
        .maybeSingle();
      if (billErr) throw billErr;
      if (!bill) throw new Error("Bill not found");

      const remaining = Number(bill.total) - Number(bill.amount_paid);
      if (input.amount - remaining > 0.01) {
        throw new Error(`Amount exceeds remaining balance (${remaining.toFixed(2)})`);
      }

      const { error: payErr } = await supabase.from("payments").insert({
        company_id: companyId,
        bill_id: input.bill_id,
        party_type: "supplier",
        party_id: input.supplier_id,
        direction: "out",
        method: input.method,
        amount: input.amount,
        currency: bill.currency,
        paid_at: input.paid_at,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        status: "completed",
        created_by: user?.id ?? null,
      });
      if (payErr) throw payErr;

      const newPaid = Number(bill.amount_paid) + Number(input.amount);
      const newStatus =
        newPaid >= Number(bill.total)
          ? "paid"
          : newPaid > 0
            ? "partial"
            : bill.status;

      const { error: updateErr } = await supabase
        .from("supplier_bills")
        .update({ amount_paid: newPaid, status: newStatus })
        .eq("id", input.bill_id);
      if (updateErr) throw updateErr;

      return input.bill_id;
    },
    onSuccess: (billId) => {
      qc.invalidateQueries({ queryKey: ["bill", billId] });
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
