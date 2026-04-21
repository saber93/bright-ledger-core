import { createFileRoute } from "@tanstack/react-router";
import {
  getStoreSetup,
  saveStoreSetup,
  setProductPublished,
  storefrontJson,
} from "@/features/storefront/server";
import { createDefaultShippingMethods } from "@/features/storefront/commerce";
import { requireCompanyApiAccess } from "@/routes/-api.documents.shared";

const setupRoles = ["owner", "accountant", "store_manager", "sales_manager"] as const;

export const Route = createFileRoute("/api/storefront/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const companyId = url.searchParams.get("companyId");
        if (!companyId) return storefrontJson({ error: "companyId is required." }, undefined, 400);
        const access = await requireCompanyApiAccess(request, companyId, [...setupRoles]);
        if (!access.ok) return access.response;

        try {
          return storefrontJson(await getStoreSetup(companyId));
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Failed to load store setup." },
            undefined,
            500,
          );
        }
      },
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as
          | Record<string, unknown>
          | null;
        if (!payload || typeof payload.companyId !== "string") {
          return storefrontJson({ error: "companyId is required." }, undefined, 400);
        }

        const access = await requireCompanyApiAccess(request, payload.companyId, [...setupRoles]);
        if (!access.ok) return access.response;

        try {
          if (payload.action === "set_product_published") {
            if (typeof payload.productId !== "string" || typeof payload.isPublished !== "boolean") {
              return storefrontJson({ error: "productId and isPublished are required." }, undefined, 400);
            }
            await setProductPublished(payload.companyId, payload.productId, payload.isPublished);
            return storefrontJson(await getStoreSetup(payload.companyId));
          }

          return storefrontJson(
            await saveStoreSetup(payload.companyId, {
              storeSlug: String(payload.storeSlug ?? ""),
              storeDisplayName: String(payload.storeDisplayName ?? ""),
              storeTagline: typeof payload.storeTagline === "string" ? payload.storeTagline : null,
              storeSupportEmail:
                typeof payload.storeSupportEmail === "string" ? payload.storeSupportEmail : null,
              storeContactPhone:
                typeof payload.storeContactPhone === "string" ? payload.storeContactPhone : null,
              storeAnnouncement:
                typeof payload.storeAnnouncement === "string" ? payload.storeAnnouncement : null,
              shippingEnabled: payload.shippingEnabled !== false,
              pickupEnabled: payload.pickupEnabled === true,
              guestCheckoutEnabled: payload.guestCheckoutEnabled !== false,
              shippingMethods: Array.isArray(payload.shippingMethods)
                ? (payload.shippingMethods as Parameters<typeof saveStoreSetup>[1]["shippingMethods"])
                : createDefaultShippingMethods({
                    shippingEnabled: payload.shippingEnabled !== false,
                    pickupEnabled: payload.pickupEnabled === true,
                  }),
            }),
          );
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Failed to save store setup." },
            undefined,
            500,
          );
        }
      },
    },
  },
});
