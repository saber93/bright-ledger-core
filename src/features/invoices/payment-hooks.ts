import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface RecordInvoicePaymentInput {
  invoice_id: string;
  customer_id: string;
  amount: number;
  method: "cash" | "card" | "bank_transfer" | "other";
  paid_at: string;
  reference?: string | null;
  notes?: string | null;
}

/**
 * Record a customer payment against an invoice.
 * Inserts into payments and updates the invoice amount_paid + status.
 */
export function useRecordInvoicePayment() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();

  return useMutation({
    mutationFn: async (input: RecordInvoicePaymentInput) => {
      if (!companyId) throw new Error("Missing company");
      if (input.amount <= 0) throw new Error("Amount must be greater than zero");

      // Read current invoice state
      const { data: inv, error: invErr } = await supabase
        .from("customer_invoices")
        .select("id, total, amount_paid, status, currency")
        .eq("id", input.invoice_id)
        .maybeSingle();
      if (invErr) throw invErr;
      if (!inv) throw new Error("Invoice not found");

      const remaining = Number(inv.total) - Number(inv.amount_paid);
      if (input.amount - remaining > 0.01) {
        throw new Error(
          `Amount exceeds remaining balance (${remaining.toFixed(2)})`,
        );
      }

      // Insert payment row
      const { error: payErr } = await supabase.from("payments").insert({
        company_id: companyId,
        invoice_id: input.invoice_id,
        party_type: "customer",
        party_id: input.customer_id,
        direction: "in",
        method: input.method,
        amount: input.amount,
        currency: inv.currency,
        paid_at: input.paid_at,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        status: "completed",
        created_by: user?.id ?? null,
      });
      if (payErr) throw payErr;

      // Update invoice
      const newPaid = Number(inv.amount_paid) + Number(input.amount);
      const newStatus =
        newPaid >= Number(inv.total)
          ? "paid"
          : newPaid > 0
            ? "partial"
            : inv.status;
      const { error: upErr } = await supabase
        .from("customer_invoices")
        .update({ amount_paid: newPaid, status: newStatus })
        .eq("id", input.invoice_id);
      if (upErr) throw upErr;

      return input.invoice_id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
