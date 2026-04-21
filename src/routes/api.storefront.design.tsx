import { createFileRoute } from "@tanstack/react-router";
import {
  applyStoreDesignPreset,
  createStoreDesignPreviewLink,
  getStoreDesignSetup,
  publishStoreDesignDraft,
  revokeStoreDesignPreviewLink,
  revertStoreDesignDraft,
  saveProductPresentation,
  saveStoreDesignDraft,
  storefrontJson,
} from "@/features/storefront/server";
import { normalizeProductPresentation, normalizeStoreDesign } from "@/features/storefront/design";
import { requireCompanyApiAccess } from "@/routes/-api.documents.shared";

const designRoles = ["owner", "accountant", "store_manager", "sales_manager"] as const;

export const Route = createFileRoute("/api/storefront/design")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const companyId = url.searchParams.get("companyId");
        if (!companyId) return storefrontJson({ error: "companyId is required." }, undefined, 400);
        const access = await requireCompanyApiAccess(request, companyId, [...designRoles]);
        if (!access.ok) return access.response;

        try {
          return storefrontJson(await getStoreDesignSetup(companyId, access.roles.includes("owner")));
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Failed to load store design." },
            undefined,
            500,
          );
        }
      },
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!payload || typeof payload.companyId !== "string" || typeof payload.action !== "string") {
          return storefrontJson({ error: "companyId and action are required." }, undefined, 400);
        }

        const access = await requireCompanyApiAccess(request, payload.companyId, [...designRoles]);
        if (!access.ok) return access.response;

        try {
          const canEditAdvanced = access.roles.includes("owner");
          if (payload.action === "save_draft") {
            return storefrontJson(
              await saveStoreDesignDraft(
                payload.companyId,
                access.userId,
                normalizeStoreDesign(payload.draft),
                canEditAdvanced,
              ),
            );
          }
          if (payload.action === "publish") {
            return storefrontJson(
              await publishStoreDesignDraft(payload.companyId, access.userId, canEditAdvanced),
            );
          }
          if (payload.action === "revert") {
            return storefrontJson(
              await revertStoreDesignDraft(payload.companyId, access.userId, canEditAdvanced),
            );
          }
          if (payload.action === "apply_preset") {
            if (typeof payload.presetId !== "string") {
              return storefrontJson({ error: "presetId is required." }, undefined, 400);
            }
            return storefrontJson(
              await applyStoreDesignPreset(
                payload.companyId,
                access.userId,
                payload.presetId as Parameters<typeof applyStoreDesignPreset>[2],
                canEditAdvanced,
              ),
            );
          }
          if (payload.action === "create_preview_link") {
            return storefrontJson(
              await createStoreDesignPreviewLink(payload.companyId, access.userId, canEditAdvanced),
            );
          }
          if (payload.action === "revoke_preview_link") {
            return storefrontJson(
              await revokeStoreDesignPreviewLink(payload.companyId, canEditAdvanced),
            );
          }
          if (payload.action === "save_product_presentation") {
            if (typeof payload.productId !== "string") {
              return storefrontJson({ error: "productId is required." }, undefined, 400);
            }
            await saveProductPresentation(payload.companyId, payload.productId, {
              presentation: normalizeProductPresentation(payload.presentation),
              isPublished:
                typeof payload.isPublished === "boolean" ? payload.isPublished : undefined,
            });
            return storefrontJson(await getStoreDesignSetup(payload.companyId, canEditAdvanced));
          }

          return storefrontJson({ error: "Unknown action." }, undefined, 400);
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Failed to save store design." },
            undefined,
            500,
          );
        }
      },
    },
  },
});
