import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import type {
  PortalAccessInput,
  PortalAccessResult,
  PortalAccountSummary,
  PortalInvoicePaymentInput,
  PortalInvoicePaymentResult,
  PortalOrderDetail,
  StoreCheckoutInput,
  StorefrontCheckoutContext,
  StoreCheckoutResult,
  StorefrontCatalogResult,
  StoreDesignSetup,
  StorefrontProductDetail,
  StorefrontSetupData,
  StorefrontShell,
} from "@/features/storefront/types";

export function useStoreShell(storeSlug: string) {
  return useQuery({
    queryKey: ["storefront-shell", storeSlug],
    enabled: !!storeSlug,
    queryFn: () =>
      apiJson<StorefrontCatalogResult>(
        `/api/storefront/catalog?storeSlug=${encodeURIComponent(storeSlug)}&page=1&pageSize=0`,
      ),
    select: (result) => result.shell,
  });
}

export function useStoreCatalog({
  storeSlug,
  search,
  categoryKey,
  sort,
  inStockOnly,
  page,
}: {
  storeSlug: string;
  search?: string;
  categoryKey?: string | null;
  sort?: "featured" | "price_asc" | "price_desc" | "name";
  inStockOnly?: boolean;
  page?: number;
}) {
  const params = new URLSearchParams({
    storeSlug,
    page: String(page ?? 1),
    pageSize: "12",
  });
  if (search) params.set("search", search);
  if (categoryKey) params.set("categoryKey", categoryKey);
  if (sort) params.set("sort", sort);
  if (inStockOnly) params.set("inStockOnly", "true");

  return useQuery({
    queryKey: ["storefront-catalog", storeSlug, search ?? "", categoryKey ?? "", sort ?? "featured", !!inStockOnly, page ?? 1],
    enabled: !!storeSlug,
    queryFn: () => apiJson<StorefrontCatalogResult>(`/api/storefront/catalog?${params.toString()}`),
  });
}

export function useStoreProduct(storeSlug: string, productKey: string) {
  return useQuery({
    queryKey: ["storefront-product", storeSlug, productKey],
    enabled: !!storeSlug && !!productKey,
    queryFn: () =>
      apiJson<StorefrontProductDetail>(
        `/api/storefront/product?storeSlug=${encodeURIComponent(storeSlug)}&productKey=${encodeURIComponent(productKey)}`,
      ),
  });
}

export function useStoreCheckout() {
  return useMutation({
    mutationFn: (input: StoreCheckoutInput) =>
      apiJson<StoreCheckoutResult>("/api/storefront/checkout", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useStoreCheckoutContext() {
  return useMutation({
    mutationFn: (input: Pick<StoreCheckoutInput, "storeSlug" | "items">) =>
      apiJson<StorefrontCheckoutContext>("/api/storefront/checkout-context", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function usePortalAccount(storeSlug: string) {
  return useQuery({
    queryKey: ["storefront-portal-account", storeSlug],
    enabled: !!storeSlug,
    retry: false,
    queryFn: () =>
      apiJson<{ shell: StorefrontShell; account: PortalAccountSummary }>(
        `/api/storefront/account?storeSlug=${encodeURIComponent(storeSlug)}`,
      ),
  });
}

export function usePortalOrder(storeSlug: string, orderId: string) {
  return useQuery({
    queryKey: ["storefront-portal-order", storeSlug, orderId],
    enabled: !!storeSlug && !!orderId,
    retry: false,
    queryFn: () =>
      apiJson<PortalOrderDetail>(
        `/api/storefront/account/order?storeSlug=${encodeURIComponent(storeSlug)}&orderId=${encodeURIComponent(orderId)}`,
      ),
  });
}

export function usePortalAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PortalAccessInput) =>
      apiJson<PortalAccessResult>("/api/storefront/account/access", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: ["storefront-portal-account", input.storeSlug] });
    },
  });
}

export function usePortalInvoicePayment() {
  return useMutation({
    mutationFn: (input: PortalInvoicePaymentInput) =>
      apiJson<PortalInvoicePaymentResult>("/api/storefront/account/pay-invoice", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useRetryStoreOrderPayment() {
  return useMutation({
    mutationFn: (input: { storeSlug: string; orderId: string }) =>
      apiJson<{ orderId: string | null; invoiceId: string; redirectUrl: string | null }>(
        "/api/storefront/account/retry-payment",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
  });
}

export function useStoreSetup(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["storefront-setup", companyId],
    enabled: !!companyId,
    queryFn: () =>
      apiJson<StorefrontSetupData>(`/api/storefront/setup?companyId=${encodeURIComponent(companyId!)}`),
  });
}

export function useSaveStoreSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiJson("/api/storefront/setup", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      const companyId = typeof variables.companyId === "string" ? variables.companyId : null;
      if (companyId) {
        qc.invalidateQueries({ queryKey: ["storefront-setup", companyId] });
      }
    },
  });
}

export function useStoreDesign(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["storefront-design", companyId],
    enabled: !!companyId,
    queryFn: () =>
      apiJson<StoreDesignSetup>(`/api/storefront/design?companyId=${encodeURIComponent(companyId!)}`),
  });
}

export function useSaveStoreDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiJson<StoreDesignSetup>("/api/storefront/design", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      const companyId = typeof variables.companyId === "string" ? variables.companyId : null;
      if (companyId) {
        qc.invalidateQueries({ queryKey: ["storefront-design", companyId] });
        qc.invalidateQueries({ queryKey: ["storefront-setup", companyId] });
      }
    },
  });
}
