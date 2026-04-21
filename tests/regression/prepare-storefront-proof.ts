import { createClient } from "@supabase/supabase-js";
import { createDefaultStoreDesign } from "@/features/storefront/design";
import { createDefaultShippingMethods } from "@/features/storefront/commerce";
import { buildEntityKey } from "@/features/storefront/shared";
import { getRegressionEnv } from "./support/env";
import { writeStorefrontManifest } from "./support/storefront-manifest";

type AdminClient = ReturnType<typeof createClient>;

async function signInProofUser() {
  const env = getRegressionEnv();
  const client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: env.proofEmail,
    password: env.proofPassword,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not authenticate the proof storefront user.");
  }

  return {
    client,
    userId: data.user.id,
  };
}

async function resolveCompany(client: AdminClient, userId: string) {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("default_company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  let companyId = profile?.default_company_id ?? null;
  if (!companyId) {
    const { data: member } = await client
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    companyId = member?.company_id ?? null;
  }
  if (!companyId) throw new Error("Could not resolve a proof company.");

  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) {
    throw new Error(companyError?.message ?? "Could not load the proof company.");
  }

  return {
    id: company.id,
    name: company.name ?? company.id,
  };
}

async function main() {
  const env = getRegressionEnv();
  if (!env.supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. The storefront proof harness needs service-role access to normalize the proof storefront state.",
    );
  }

  const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { client, userId } = await signInProofUser();
  const company = await resolveCompany(client, userId);

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, name, is_published, product_categories(id, name)")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .not("category_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(4);
  if (productsError) throw new Error(productsError.message);
  if (!products || products.length === 0) {
    throw new Error("No categorized active products exist for the storefront proof harness.");
  }

  const published = createDefaultStoreDesign("clean-retail");
  published.pages.heroTitle = "Proof published storefront";
  published.pages.heroBody = "Published commerce styling that stays tied to ERP and customer balances.";

  const draft = createDefaultStoreDesign("premium-brand");
  draft.pages.heroTitle = "Proof draft preview only";
  draft.pages.heroBody = "Draft-only changes stay behind a revocable preview link until the merchant publishes.";

  const storeSlug = `proof-store-${company.id.slice(0, 6)}`;
  const paymentEnabled = Boolean(env.stripeSecretKey && env.appUrl);

  const { error: settingsError } = await admin
    .from("company_settings")
    .update({
      online_store_enabled: true,
      online_payments_enabled: paymentEnabled,
      store_payment_provider: paymentEnabled ? "stripe_checkout" : null,
      store_slug: storeSlug,
      store_display_name: `${company.name} Store`,
      store_tagline: "Proof storefront for regression coverage",
      store_support_email: env.proofEmail,
      store_contact_phone: "+971500000000",
      store_announcement: "Proof storefront launch banner",
      store_shipping_enabled: true,
      store_pickup_enabled: true,
      store_guest_checkout_enabled: true,
      store_shipping_methods: createDefaultShippingMethods({ shippingEnabled: true, pickupEnabled: true }),
      store_design_published: published,
      store_design_draft: draft,
      store_design_published_at: new Date().toISOString(),
      store_design_published_by: userId,
      store_design_draft_saved_at: new Date().toISOString(),
      store_design_draft_saved_by: userId,
      store_design_preview_token_hash: null,
      store_design_preview_expires_at: null,
      store_design_preview_created_at: null,
      store_design_preview_created_by: null,
      store_design_preview_last_used_at: null,
    })
    .eq("company_id", company.id);
  if (settingsError) throw new Error(settingsError.message);

  const publishIds = products.map((product) => product.id);
  const { error: publishError } = await admin
    .from("products")
    .update({ is_published: true })
    .eq("company_id", company.id)
    .in("id", publishIds);
  if (publishError) throw new Error(publishError.message);

  const primaryProduct = products[0];
  const primaryCategory = Array.isArray(primaryProduct.product_categories)
    ? primaryProduct.product_categories[0]
    : primaryProduct.product_categories;
  if (!primaryCategory?.id || !primaryCategory?.name) {
    throw new Error("Prepared storefront product is missing a usable category.");
  }

  writeStorefrontManifest({
    generatedAt: new Date().toISOString(),
    companyId: company.id,
    storeSlug,
    categoryKey: buildEntityKey(String(primaryCategory.name), String(primaryCategory.id)),
    productKey: buildEntityKey(String(primaryProduct.name), String(primaryProduct.id)),
    productName: String(primaryProduct.name),
    publishedHero: published.pages.heroTitle,
    draftHero: draft.pages.heroTitle,
  });

  console.log(`Prepared storefront proof for ${company.name} (${company.id})`);
  console.log(`  - store slug: ${storeSlug}`);
  console.log(`  - published product: ${primaryProduct.name}`);
  console.log(`  - category: ${primaryCategory.name}`);
  console.log(`  - Stripe checkout enabled: ${paymentEnabled ? "yes" : "no"}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
