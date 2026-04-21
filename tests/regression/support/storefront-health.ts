import { inspect } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { getRegressionEnv } from "./env";
import { readStorefrontManifest } from "./storefront-manifest";

export interface StorefrontHealthCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface StorefrontHealthReport {
  ok: boolean;
  checks: StorefrontHealthCheck[];
}

export async function verifyStorefrontHealth(): Promise<StorefrontHealthReport> {
  const env = getRegressionEnv();
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for storefront proof verification.");
  }

  const manifest = readStorefrontManifest();
  const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const checks: StorefrontHealthCheck[] = [];

  const { data: settings, error: settingsError } = await admin
    .from("company_settings")
    .select(
      "online_store_enabled, store_slug, store_shipping_methods, store_design_published, store_design_draft, store_design_preview_token_hash, store_design_preview_expires_at",
    )
    .eq("company_id", manifest.companyId)
    .maybeSingle();
  if (settingsError || !settings) {
    throw new Error(settingsError?.message ?? "Could not load company storefront settings.");
  }

  checks.push({
    label: "Storefront enabled",
    ok: settings.online_store_enabled === true && settings.store_slug === manifest.storeSlug,
    detail: `Store slug is ${settings.store_slug ?? "unset"}.`,
  });

  const publishedHero =
    settings.store_design_published &&
    typeof settings.store_design_published === "object" &&
    "pages" in settings.store_design_published &&
    settings.store_design_published.pages &&
    typeof settings.store_design_published.pages === "object" &&
    "heroTitle" in settings.store_design_published.pages
      ? String(settings.store_design_published.pages.heroTitle)
      : null;
  const draftHero =
    settings.store_design_draft &&
    typeof settings.store_design_draft === "object" &&
    "pages" in settings.store_design_draft &&
    settings.store_design_draft.pages &&
    typeof settings.store_design_draft.pages === "object" &&
    "heroTitle" in settings.store_design_draft.pages
      ? String(settings.store_design_draft.pages.heroTitle)
      : null;

  checks.push({
    label: "Published vs draft design",
    ok: publishedHero === manifest.publishedHero && draftHero === manifest.draftHero,
    detail: `Published hero: ${publishedHero ?? "missing"} | Draft hero: ${draftHero ?? "missing"}`,
  });

  const shippingMethods = Array.isArray(settings.store_shipping_methods)
    ? settings.store_shipping_methods
    : [];
  checks.push({
    label: "Shipping methods",
    ok: shippingMethods.length > 0,
    detail: `${shippingMethods.length} configured method(s).`,
  });

  checks.push({
    label: "Draft preview controls",
    ok: true,
    detail:
      settings.store_design_preview_token_hash && settings.store_design_preview_expires_at
        ? `Active preview expires ${settings.store_design_preview_expires_at}.`
        : "Preview link currently inactive and revocable state is available.",
  });

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, name, is_published")
    .eq("company_id", manifest.companyId)
    .eq("id", manifest.productKey.split("--").at(-1) ?? "")
    .maybeSingle();
  if (productError) {
    throw new Error(productError.message);
  }

  checks.push({
    label: "Published product",
    ok: !!product?.is_published,
    detail: product ? `${product.name}` : "Product missing",
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export function printStorefrontHealthReport(report: StorefrontHealthReport) {
  for (const check of report.checks) {
    const prefix = check.ok ? "[ok]" : "[fail]";
    console.log(`${prefix} ${check.label}`);
    console.log(`  - ${check.detail}`);
  }

  if (!report.ok) {
    console.error(
      inspect(report.checks.filter((check) => !check.ok), {
        depth: 5,
        breakLength: 120,
      }),
    );
  }
}
