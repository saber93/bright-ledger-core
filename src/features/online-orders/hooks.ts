import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type OnlineOrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OnlineOrder {
  id: string;
  company_id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_address_line1: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  status: OnlineOrderStatus;
  currency: string;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  payment_method: string | null;
  payment_reference: string | null;
  placed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnlineOrderLine {
  id: string;
  order_id: string;
  product_id: string | null;
  position: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export function useOnlineOrders() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["online-orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("online_orders")
        .select("*")
        .eq("company_id", companyId!)
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OnlineOrder[];
    },
  });
}

export function useOnlineOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["online-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("online_orders")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;

      const { data: lines } = await supabase
        .from("online_order_lines")
        .select("*")
        .eq("order_id", id!)
        .order("position");

      return { order: order as OnlineOrder, lines: (lines ?? []) as OnlineOrderLine[] };
    },
  });
}

export function useUpdateOnlineOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OnlineOrderStatus }) => {
      const { error } = await supabase
        .from("online_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      qc.invalidateQueries({ queryKey: ["online-order", id] });
    },
  });
}
