import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSharedDocumentUrl,
  createDocumentShareToken,
} from "@/routes/-api.documents.shared";
import {
  STOREFRONT_PORTAL_COOKIE,
  STOREFRONT_PREVIEW_COOKIE,
  buildEntityKey,
  parseEntityKey,
  slugify,
} from "@/features/storefront/shared";
import {
  normalizeShippingMethods,
  resolveShippingMethods,
  summarizePaymentProvider,
  type ResolvedStorefrontShippingMethod,
  type StorefrontFulfillmentType,
  type StorefrontPaymentProviderSummary,
  type StorefrontShippingMethod,
} from "@/features/storefront/commerce";
import {
  STORE_THEME_PRESETS,
  createDefaultProductPresentation,
  createDefaultStoreDesign,
  normalizeProductPresentation,
  normalizeStoreDesign,
  storeDesignHasUnpublishedChanges,
  type StoreDesignConfig,
  type StoreThemePresetId,
} from "@/features/storefront/design";
import type {
  PortalAccountSummary,
  PortalInvoicePaymentResult,
  PortalOrderDetail,
  StoreCheckoutInput,
  StorefrontCheckoutContext,
  StoreCheckoutResult,
  StoreDesignSetup,
  StorefrontProductPresentation,
  StorefrontSetupData,
  StorefrontCatalogResult,
  StorefrontCategory,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontShell,
} from "@/features/storefront/types";

type UntypedAdminRelation = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const adminUntyped = supabaseAdmin as unknown as {
  from: (relation: string) => UntypedAdminRelation;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: Record<string, unknown>[] | Record<string, unknown> | null;
    error: { message?: string; details?: string } | null;
  }>;
};

interface ResolvedStore {
  companyId: string;
  companyName: string;
  currency: string;
  onlineStoreEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  paymentProvider: StorefrontPaymentProviderSummary;
  storeSlug: string;
  storeName: string;
  storeTagline: string | null;
  storeAnnouncement: string | null;
  supportEmail: string | null;
  contactPhone: string | null;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  guestCheckoutEnabled: boolean;
  shippingMethods: StorefrontShippingMethod[];
  defaultBranchId: string | null;
  defaultWarehouseId: string | null;
  previewMode: boolean;
  previewExpiresAt: string | null;
  design: StoreDesignConfig;
}

interface ProductRow {
  id: string;
  category_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  type: string | null;
  unit: string | null;
  sale_price: number | string | null;
  tax_rate: number | string | null;
  image_url: string | null;
  is_published: boolean;
  is_active: boolean;
  storefront_presentation: Record<string, unknown> | null;
  product_categories: { id: string; name: string } | null;
  stock_levels: Array<{ quantity: number | string | null }> | null;
}

interface PortalSessionRow {
  id: string;
  company_id: string;
  customer_id: string;
  email: string;
  expires_at: string;
  revoked_at: string | null;
}

interface StripeCheckoutSession {
  id: string;
  url: string | null;
  payment_intent?: string | null;
  payment_status?: string | null;
  status?: string | null;
  metadata?: Record<string, string>;
}

interface StripeEventEnvelope {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

const PORTAL_SESSION_DAYS = 30;
const STOREFRONT_PREVIEW_DAYS = 3;
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

function num(value: unknown) {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function safeRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function shortDescription(text: string | null | undefined) {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117).trimEnd()}...`;
}

function resolveStoreDesign(
  publishedConfig: unknown,
  draftConfig?: unknown,
) {
  const published = normalizeStoreDesign(publishedConfig);
  const draft = normalizeStoreDesign(draftConfig ?? publishedConfig);
  return {
    published,
    draft,
    hasUnpublishedChanges: storeDesignHasUnpublishedChanges(draft, published),
  };
}

function portalCookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${STOREFRONT_PORTAL_COOKIE}=([^;]+)`);
  const match = cookieHeader.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function portalCookieHeader(token: string) {
  const maxAge = PORTAL_SESSION_DAYS * 24 * 60 * 60;
  return `${STOREFRONT_PORTAL_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

function clearPortalCookieHeader() {
  return `${STOREFRONT_PORTAL_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

function previewCookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${STOREFRONT_PREVIEW_COOKIE}=([^;]+)`);
  const match = cookieHeader.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function previewCookieHeader(token: string, storeSlug: string, expiresAt: string) {
  const maxAge = Math.max(
    60,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  return `${STOREFRONT_PREVIEW_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

function clearPreviewCookieHeader(storeSlug: string) {
  return `${STOREFRONT_PREVIEW_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPreviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appOrigin(request: Request) {
  return process.env.APP_URL?.trim() || new URL(request.url).origin;
}

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

function stripeConfigured() {
  const secret = stripeSecretKey();
  const origin = process.env.APP_URL?.trim();
  return Boolean(secret && origin);
}

function providerAmount(currency: string, amount: number) {
  const normalized = currency.trim().toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) return Math.round(amount);
  return Math.round(amount * 100);
}

function appendStripeFormField(params: URLSearchParams, key: string, value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return;
  params.append(key, String(value));
}

function previewUrlForStore(storeSlug: string, token: string) {
  const params = new URLSearchParams({ storeSlug, token });
  return `/api/storefront/preview?${params.toString()}`;
}

function stripeSignature(header: string, payload: string, secret: string) {
  const parts = header.split(",").map((segment) => segment.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected);

  return signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  });
}

async function assertAccountingPeriodOpen(companyId: string, effectiveDate: string, context: string) {
  const { error } = await adminUntyped.rpc("accounting_assert_period_unlocked", {
    _company_id: companyId,
    _effective_date: effectiveDate,
    _context: context,
  });
  if (error) {
    const details = [error.message?.trim(), error.details?.trim()].filter(Boolean).join(" ");
    throw new Error(details || "The selected accounting period is closed.");
  }
}

function invoiceNumberPrefixSettings(settings: { invoice_prefix?: string | null } | null | undefined) {
  return settings?.invoice_prefix?.trim() || "INV-";
}

async function resolveStore(storeSlug: string, request?: Request): Promise<ResolvedStore | null> {
  const { data, error } = await adminUntyped
    .from("company_settings")
    .select(
      "company_id, online_store_enabled, online_payments_enabled, store_slug, store_display_name, store_tagline, store_support_email, store_contact_phone, store_announcement, store_default_branch_id, store_default_warehouse_id, store_shipping_enabled, store_pickup_enabled, store_guest_checkout_enabled, store_shipping_methods, store_payment_provider, store_design_published, store_design_draft, store_design_preview_token_hash, store_design_preview_expires_at, store_design_preview_last_used_at, companies!inner(name, currency)",
    )
    .eq("store_slug", storeSlug)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Failed to load storefront.");
  if (!data) return null;

  let previewMode = false;
  let previewExpiresAt: string | null = null;
  if (request) {
    const previewToken = previewCookieValue(request);
    const previewHash = nonEmpty(data.store_design_preview_token_hash);
    const previewExpiry = nonEmpty(data.store_design_preview_expires_at);
    if (
      previewToken &&
      previewHash &&
      previewExpiry &&
      previewHash === hashPreviewToken(previewToken) &&
      new Date(previewExpiry).getTime() > Date.now()
    ) {
      previewMode = true;
      previewExpiresAt = previewExpiry;
      await adminUntyped
        .from("company_settings")
        .update({ store_design_preview_last_used_at: new Date().toISOString() })
        .eq("company_id", data.company_id);
    }
  }

  const shippingMethods = normalizeShippingMethods(data.store_shipping_methods, {
    shippingEnabled: Boolean(data.store_shipping_enabled),
    pickupEnabled: Boolean(data.store_pickup_enabled),
  });
  const paymentProvider = summarizePaymentProvider(
    Boolean(data.online_payments_enabled),
    stripeSecretKey(),
  );
  const design = previewMode
    ? resolveStoreDesign(data.store_design_published, data.store_design_draft).draft
    : resolveStoreDesign(data.store_design_published).published;

  return {
    companyId: String(data.company_id),
    companyName: String(data.companies?.name ?? "Store"),
    currency: String(data.companies?.currency ?? "USD"),
    onlineStoreEnabled: Boolean(data.online_store_enabled),
    onlinePaymentsEnabled: paymentProvider.checkoutEnabled,
    paymentProvider,
    storeSlug: String(data.store_slug),
    storeName: String(data.store_display_name || data.companies?.name || "Store"),
    storeTagline: nonEmpty(data.store_tagline),
    storeAnnouncement: nonEmpty(data.store_announcement),
    supportEmail: nonEmpty(data.store_support_email),
    contactPhone: nonEmpty(data.store_contact_phone),
    shippingEnabled: Boolean(data.store_shipping_enabled),
    pickupEnabled: Boolean(data.store_pickup_enabled),
    guestCheckoutEnabled: Boolean(data.store_guest_checkout_enabled),
    shippingMethods,
    defaultBranchId: data.store_default_branch_id ? String(data.store_default_branch_id) : null,
    defaultWarehouseId: data.store_default_warehouse_id ? String(data.store_default_warehouse_id) : null,
    previewMode,
    previewExpiresAt,
    design,
  };
}

async function loadPublishedProducts(companyId: string) {
  const [{ data: products, error: productsError }, { data: categories, error: categoriesError }, { data: stockLevels, error: stockLevelsError }] = await Promise.all([
    adminUntyped
      .from("products")
      .select("id, category_id, sku, name, description, type, unit, sale_price, tax_rate, image_url, is_published, is_active, storefront_presentation")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .eq("is_published", true)
      .order("name"),
    adminUntyped
      .from("product_categories")
      .select("id, name")
      .eq("company_id", companyId),
    adminUntyped
      .from("stock_levels")
      .select("product_id, quantity")
      .eq("company_id", companyId),
  ]);

  if (productsError) throw new Error(productsError.message ?? "Failed to load published products.");
  if (categoriesError) throw new Error(categoriesError.message ?? "Failed to load product categories.");
  if (stockLevelsError) throw new Error(stockLevelsError.message ?? "Failed to load stock levels.");

  const categoryMap = new Map((categories ?? []).map((category: Record<string, unknown>) => [String(category.id), { id: String(category.id), name: String(category.name) }]));
  const stockByProduct = new Map<string, Array<{ quantity: number | string | null }>>();
  for (const row of (stockLevels ?? []) as Array<Record<string, unknown>>) {
    const productId = String(row.product_id);
    const current = stockByProduct.get(productId) ?? [];
    current.push({ quantity: row.quantity as number | string | null });
    stockByProduct.set(productId, current);
  }

  return ((products ?? []) as Array<Record<string, unknown>>).map((product) => ({
    ...(product as unknown as Omit<ProductRow, "product_categories" | "stock_levels">),
    product_categories: product.category_id ? categoryMap.get(String(product.category_id)) ?? null : null,
    stock_levels: stockByProduct.get(String(product.id)) ?? [],
  })) as ProductRow[];
}

function buildProductCard(row: ProductRow): StorefrontProductCard {
  const totalStock = (row.stock_levels ?? []).reduce((sum, level) => sum + num(level.quantity), 0);
  const categoryName = row.product_categories?.name ?? null;
  const presentation = normalizeProductPresentation(row.storefront_presentation);
  const gallery =
    presentation.gallery.filter(Boolean).length > 0
      ? presentation.gallery.filter(Boolean)
      : row.image_url
        ? [row.image_url]
        : [];
  const fallbackBadge = totalStock <= 0 ? "Out of stock" : totalStock <= 5 ? "Low stock" : null;
  return {
    id: row.id,
    key: buildEntityKey(row.name, row.id),
    categoryId: row.category_id,
    categoryKey: row.category_id && categoryName ? buildEntityKey(categoryName, row.category_id) : null,
    categoryName,
    sku: row.sku,
    name: row.name,
    shortDescription: shortDescription(presentation.shortCopy) ?? shortDescription(row.description),
    description: row.description,
    imageUrl: row.image_url,
    gallery,
    badge: nonEmpty(presentation.badge) ?? fallbackBadge,
    price: num(row.sale_price),
    taxRate: num(row.tax_rate),
    totalStock,
    inStock: totalStock > 0,
    featured: totalStock > 0 && num(row.sale_price) > 0,
    shortCopy: nonEmpty(presentation.shortCopy),
    highlights: presentation.highlights,
    shippingNote: nonEmpty(presentation.shippingNote),
    trustNote: nonEmpty(presentation.trustNote),
    seoTitle: nonEmpty(presentation.seoTitle),
    seoDescription: nonEmpty(presentation.seoDescription),
  };
}

function buildShell(store: ResolvedStore, products: StorefrontProductCard[]): StorefrontShell {
  const categoryMap = new Map<string, StorefrontCategory>();
  for (const product of products) {
    if (!product.categoryId || !product.categoryKey || !product.categoryName) continue;
    const current = categoryMap.get(product.categoryId);
    if (current) {
      current.productCount += 1;
      continue;
    }
    categoryMap.set(product.categoryId, {
      id: product.categoryId,
      key: product.categoryKey,
      name: product.categoryName,
      productCount: 1,
    });
  }

  return {
    companyId: store.companyId,
    storeSlug: store.storeSlug,
    storeName: store.storeName,
    storeTagline: store.storeTagline,
    storeAnnouncement: store.storeAnnouncement,
    supportEmail: store.supportEmail,
    contactPhone: store.contactPhone,
    currency: store.currency,
    onlinePaymentsEnabled: store.onlinePaymentsEnabled,
    paymentProvider: store.paymentProvider,
    shippingEnabled: store.shippingEnabled,
    pickupEnabled: store.pickupEnabled,
    guestCheckoutEnabled: store.guestCheckoutEnabled,
    shippingMethods: store.shippingMethods,
    previewMode: store.previewMode,
    previewUrl: null,
    previewExpiresAt: store.previewExpiresAt,
    categories: Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    design: store.design,
  };
}

function sortProducts(
  products: StorefrontProductCard[],
  sort: "featured" | "price_asc" | "price_desc" | "name",
) {
  const copy = [...products];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    case "price_desc":
      return copy.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy.sort((a, b) => {
        if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }
}

async function nextNumber(companyId: string, relation: "sales_orders" | "online_orders", prefix: string) {
  const { count, error } = await adminUntyped
    .from(relation)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? `Failed to number ${relation}`);
  const seq = (count ?? 0) + 1;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}${stamp}-${String(seq).padStart(5, "0")}`;
}

async function nextInvoiceNumber(companyId: string) {
  const { data: settings, error: settingsError } = await adminUntyped
    .from("company_settings")
    .select("invoice_prefix")
    .eq("company_id", companyId)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message ?? "Failed to load invoice prefix");
  const prefix = invoiceNumberPrefixSettings(settings);
  const { count, error } = await adminUntyped
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Failed to number invoices");
  return `${prefix}${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function upsertCustomerForCheckout(store: ResolvedStore, input: StoreCheckoutInput) {
  const email = input.contact.email.trim().toLowerCase();
  const { data: existing, error: existingError } = await adminUntyped
    .from("customers")
    .select("*")
    .eq("company_id", store.companyId)
    .ilike("email", email)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message ?? "Failed to look up customer.");

  const payload = {
    company_id: store.companyId,
    name: input.contact.name.trim(),
    email,
    phone: nonEmpty(input.contact.phone),
    address_line1: input.contact.addressLine1.trim(),
    city: input.contact.city.trim(),
    postal_code: input.contact.postalCode.trim(),
    country: input.contact.country.trim(),
    currency: store.currency,
    is_active: true,
  };

  if (existing) {
    const { error } = await adminUntyped.from("customers").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message ?? "Failed to update customer.");
    return {
      id: String(existing.id),
      ...payload,
    };
  }

  const { data, error } = await adminUntyped.from("customers").insert(payload).select("*").single();
  if (error) throw new Error(error.message ?? "Failed to create customer.");
  return {
    id: String(data.id),
    ...payload,
  };
}

async function createPortalSession({
  companyId,
  customerId,
  email,
  createdViaOrderId,
}: {
  companyId: string;
  customerId: string;
  email: string;
  createdViaOrderId?: string | null;
}) {
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await adminUntyped.from("customer_portal_sessions").insert({
    company_id: companyId,
    customer_id: customerId,
    email: email.toLowerCase(),
    token_hash: tokenHash,
    created_via_order_id: createdViaOrderId ?? null,
    expires_at: expiresAt,
    last_used_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message ?? "Failed to create customer portal session.");

  return {
    token,
    expiresAt,
  };
}

async function loadPortalSession(request: Request, storeSlug: string) {
  const store = await resolveStore(storeSlug, request);
  if (!store || !store.onlineStoreEnabled) return { store, session: null as null };

  const token = portalCookieValue(request);
  if (!token) return { store, session: null as null };

  const { data, error } = await adminUntyped
    .from("customer_portal_sessions")
    .select("*")
    .eq("company_id", store.companyId)
    .eq("token_hash", hashPortalToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Failed to validate portal session.");
  if (!data) return { store, session: null as null };

  await adminUntyped
    .from("customer_portal_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { store, session: data as PortalSessionRow };
}

async function loadPortalAccountData(store: ResolvedStore, customerId: string): Promise<PortalAccountSummary> {
  const [{ data: customer, error: customerError }, { data: orders, error: ordersError }, { data: invoices, error: invoicesError }, { data: credits, error: creditsError }, { data: creditBalance, error: creditBalanceError }] = await Promise.all([
    adminUntyped
      .from("customers")
      .select("id, name, email, phone, address_line1, city, postal_code, country")
      .eq("id", customerId)
      .maybeSingle(),
    adminUntyped
      .from("online_orders")
      .select("id, order_number, status, placed_at, total, currency, payment_method, invoice_id, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, fulfillment_type, shipping_method_label")
      .eq("company_id", store.companyId)
      .eq("customer_id", customerId)
      .order("placed_at", { ascending: false }),
    adminUntyped
      .from("customer_invoices")
      .select("id, invoice_number, issue_date, due_date, status, total, amount_paid, currency")
      .eq("company_id", store.companyId)
      .eq("customer_id", customerId)
      .order("issue_date", { ascending: false }),
    adminUntyped
      .from("credit_notes")
      .select("id, credit_note_number, issue_date, status, total, amount_allocated, currency")
      .eq("company_id", store.companyId)
      .eq("customer_id", customerId)
      .order("issue_date", { ascending: false }),
    adminUntyped
      .from("customer_credit_balance")
      .select("balance")
      .eq("customer_id", customerId)
      .maybeSingle(),
  ]);

  if (customerError) throw new Error(customerError.message ?? "Failed to load customer account.");
  if (ordersError) throw new Error(ordersError.message ?? "Failed to load storefront orders.");
  if (invoicesError) throw new Error(invoicesError.message ?? "Failed to load invoices.");
  if (creditsError) throw new Error(creditsError.message ?? "Failed to load credits.");
  if (creditBalanceError) throw new Error(creditBalanceError.message ?? "Failed to load credit balance.");
  if (!customer) throw new Error("Customer account not found.");

  const invoiceRows = (invoices ?? []).map((invoice) => {
    const balanceDue = Math.max(0, num(invoice.total) - num(invoice.amount_paid));
    return {
      id: String(invoice.id),
      invoiceNumber: String(invoice.invoice_number),
      issueDate: String(invoice.issue_date),
      dueDate: invoice.due_date ? String(invoice.due_date) : null,
      status: String(invoice.status),
      total: num(invoice.total),
      amountPaid: num(invoice.amount_paid),
      balanceDue,
      currency: String(invoice.currency ?? store.currency),
    };
  });

  const paymentInvoiceIds = invoiceRows.map((invoice) => invoice.id);
  const { data: recentPayments, error: paymentsError } =
    paymentInvoiceIds.length === 0
      ? { data: [], error: null }
      : await adminUntyped
          .from("payments")
          .select("id, paid_at, amount, method, reference, invoice_id")
          .eq("company_id", store.companyId)
          .eq("party_type", "customer")
          .eq("party_id", customerId)
          .in("invoice_id", paymentInvoiceIds)
          .order("paid_at", { ascending: false })
          .limit(10);
  if (paymentsError) throw new Error(paymentsError.message ?? "Failed to load recent payments.");

  const orderRows = (orders ?? []).map((order) => {
    const invoice = invoiceRows.find((row) => row.id === order.invoice_id);
    return {
      id: String(order.id),
      orderNumber: String(order.order_number),
      status: String(order.status),
      placedAt: String(order.placed_at),
      total: num(order.total),
      currency: String(order.currency ?? store.currency),
      paymentMethod: nonEmpty(order.payment_method),
      paymentState: invoice ? (invoice.balanceDue <= 0.005 ? "paid" : "pending") : order.status === "paid" ? "paid" : "pending",
      invoiceId: order.invoice_id ? String(order.invoice_id) : null,
      fulfillmentType:
        order.fulfillment_type === "pickup" ? "pickup" : "shipping",
      shippingMethodLabel: nonEmpty(order.shipping_method_label),
    } as PortalAccountSummary["orders"][number];
  });

  const latestOrder = orders?.[0] as
    | {
        shipping_address_line1?: string | null;
        shipping_city?: string | null;
        shipping_postal_code?: string | null;
        shipping_country?: string | null;
      }
    | undefined;

  return {
    customer: {
      id: String(customer.id),
      name: String(customer.name),
      email: nonEmpty(customer.email),
      phone: nonEmpty(customer.phone),
      addressLine1: nonEmpty(customer.address_line1),
      city: nonEmpty(customer.city),
      postalCode: nonEmpty(customer.postal_code),
      country: nonEmpty(customer.country),
    },
    orders: orderRows,
    invoices: invoiceRows,
    credits: (credits ?? []).map((note) => ({
      id: String(note.id),
      creditNoteNumber: String(note.credit_note_number),
      issueDate: String(note.issue_date),
      status: String(note.status),
      total: num(note.total),
      allocated: num(note.amount_allocated),
      currency: String(note.currency ?? store.currency),
    })),
    recentPayments: (recentPayments ?? []).map((payment) => ({
      id: String(payment.id),
      paidAt: String(payment.paid_at),
      amount: num(payment.amount),
      method: String(payment.method),
      reference: nonEmpty(payment.reference),
    })),
    availableCredit: num(creditBalance?.balance),
    totalDue: invoiceRows.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    currency: store.currency,
    latestShippingAddress: latestOrder
      ? {
          line1: nonEmpty(latestOrder.shipping_address_line1),
          city: nonEmpty(latestOrder.shipping_city),
          postalCode: nonEmpty(latestOrder.shipping_postal_code),
          country: nonEmpty(latestOrder.shipping_country),
        }
      : null,
  };
}

export async function getStoreCatalog({
  request,
  storeSlug,
  search,
  categoryKey,
  sort = "featured",
  inStockOnly = false,
  page = 1,
  pageSize = 12,
}: {
  request?: Request;
  storeSlug: string;
  search?: string | null;
  categoryKey?: string | null;
  sort?: "featured" | "price_asc" | "price_desc" | "name";
  inStockOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<StorefrontCatalogResult> {
  const store = await resolveStore(storeSlug, request);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");

  const products = (await loadPublishedProducts(store.companyId)).map(buildProductCard);
  const shell = buildShell(store, products);
  const normalizedSearch = search?.trim().toLowerCase() ?? "";
  const categoryId = categoryKey ? parseEntityKey(categoryKey) : null;

  const filtered = sortProducts(
    products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (inStockOnly && !product.inStock) return false;
      if (!normalizedSearch) return true;
      const haystack = [product.name, product.shortDescription, product.sku, product.categoryName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    }),
    sort,
  );

  const safePageSize = Math.max(0, pageSize);
  const safePage = Math.max(1, page);
  const paged = safePageSize > 0 ? filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize) : [];

  return {
    shell,
    products: paged,
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
    search: search?.trim() ?? "",
    sort,
    inStockOnly,
    categoryKey: categoryKey ?? null,
  };
}

export async function getStoreShell(storeSlug: string) {
  const result = await getStoreCatalog({ storeSlug, pageSize: 0 });
  return result.shell;
}

export async function getStoreProduct(
  request: Request | undefined,
  storeSlug: string,
  productKey: string,
): Promise<StorefrontProductDetail> {
  const store = await resolveStore(storeSlug, request);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");

  const rows = await loadPublishedProducts(store.companyId);
  const products = rows.map(buildProductCard);
  const shell = buildShell(store, products);
  const productId = parseEntityKey(productKey);
  const product = products.find((row) => row.id === productId);
  if (!product) throw new Error("Product not found.");

  const row = rows.find((item) => item.id === productId);
  const presentation = normalizeProductPresentation(row?.storefront_presentation);
  const configuredRelated = presentation.relatedProductIds
    .map((id) => products.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is StorefrontProductCard => !!candidate && candidate.id !== product.id);
  const related =
    configuredRelated.length > 0
      ? configuredRelated.slice(0, 4)
      : products
          .filter((candidate) => candidate.id !== product.id && candidate.categoryId === product.categoryId)
          .slice(0, 4);

  return {
    shell,
    product: {
      ...product,
      unit: row?.unit ?? null,
      availabilityLabel: product.inStock
        ? product.totalStock <= 5
          ? `Only ${product.totalStock} left in stock`
          : "Ready to ship"
        : "Currently unavailable",
      taxLabel: product.taxRate > 0 ? `Includes ${product.taxRate}% tax` : "Tax calculated at checkout",
      related,
      presentation,
    },
  };
}

async function resolveCheckoutItems(
  store: ResolvedStore,
  items: StoreCheckoutInput["items"],
) {
  const requestedIds = items.map((item) => item.productId);
  const products = (await loadPublishedProducts(store.companyId)).filter((row) => requestedIds.includes(row.id));
  if (products.length !== requestedIds.length) throw new Error("One or more products are no longer available.");

  const productMap = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error("One or more products are no longer available.");
    const quantity = Math.max(1, Math.floor(num(item.quantity)));
    const available = (product.stock_levels ?? []).reduce((sum, level) => sum + num(level.quantity), 0);
    if (product.type !== "service" && available > 0 && quantity > available) {
      throw new Error(`Only ${available} units remain for ${product.name}.`);
    }
    const unitPrice = num(product.sale_price);
    const taxRate = num(product.tax_rate);
    const net = unitPrice * quantity;
    const tax = net * (taxRate / 100);
    return {
      product,
      quantity,
      unitPrice,
      taxRate,
      lineTotal: net + tax,
      taxAmount: tax,
    };
  });
}

function resolveCheckoutTotals(
  store: ResolvedStore,
  selectedShippingMethodCode: string,
  normalizedItems: Awaited<ReturnType<typeof resolveCheckoutItems>>,
) {
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxTotal = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const availableShippingMethods = resolveShippingMethods(store.shippingMethods, subtotal);
  const shippingMethod =
    availableShippingMethods.find((method) => method.code === selectedShippingMethodCode) ??
    availableShippingMethods[0];

  if (!shippingMethod) {
    throw new Error("No shipping or pickup methods are available for this storefront.");
  }

  return {
    subtotal,
    taxTotal,
    shippingMethod,
    shippingTotal: shippingMethod.effectiveAmount,
    total: subtotal + taxTotal + shippingMethod.effectiveAmount,
    availableShippingMethods,
  };
}

export async function getStoreCheckoutContext(
  request: Request | undefined,
  {
    storeSlug,
    items,
  }: {
    storeSlug: string;
    items?: StoreCheckoutInput["items"];
  },
): Promise<StorefrontCheckoutContext> {
  const store = await resolveStore(storeSlug, request);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");

  const products = (await loadPublishedProducts(store.companyId)).map(buildProductCard);
  const shell = buildShell(store, products);
  const normalizedItems = items?.length ? await resolveCheckoutItems(store, items) : [];
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    shell,
    availableShippingMethods: resolveShippingMethods(store.shippingMethods, subtotal),
  };
}

async function insertPaymentTransaction({
  companyId,
  paymentId,
  provider,
  providerRef,
  status,
  amount,
  currency,
  rawPayload,
}: {
  companyId: string;
  paymentId?: string | null;
  provider: string;
  providerRef?: string | null;
  status: "pending" | "completed" | "failed";
  amount: number;
  currency: string;
  rawPayload: Record<string, unknown>;
}) {
  const { data, error } = await adminUntyped
    .from("payment_transactions")
    .insert({
      company_id: companyId,
      payment_id: paymentId ?? null,
      provider,
      provider_ref: providerRef ?? null,
      status,
      amount,
      currency,
      raw_payload: rawPayload,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message ?? "Failed to create payment transaction.");
  return String(data.id);
}

async function updatePaymentTransaction(
  id: string,
  patch: {
    provider?: string;
    providerRef?: string | null;
    paymentId?: string | null;
    status?: "pending" | "completed" | "failed";
    rawPayload?: Record<string, unknown>;
  },
) {
  const { error } = await adminUntyped
    .from("payment_transactions")
    .update({
      provider: patch.provider,
      provider_ref: patch.providerRef,
      payment_id: patch.paymentId,
      status: patch.status,
      raw_payload: patch.rawPayload,
    })
    .eq("id", id);
  if (error) throw new Error(error.message ?? "Failed to update payment transaction.");
}

async function fetchPaymentTransaction(id: string) {
  const { data, error } = await adminUntyped
    .from("payment_transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load payment transaction.");
  return data as Record<string, unknown> | null;
}

async function createStripeCheckoutSession({
  request,
  store,
  orderId,
  orderNumber,
  paymentTransactionId,
  customerEmail,
  successPath,
  cancelPath,
  currency,
  lineItems,
  metadata,
}: {
  request: Request;
  store: ResolvedStore;
  orderId: string;
  orderNumber: string;
  paymentTransactionId: string;
  customerEmail: string;
  successPath: string;
  cancelPath: string;
  currency: string;
  lineItems: Array<{ name: string; amount: number; quantity?: number; description?: string | null }>;
  metadata: Record<string, string>;
}) {
  const secret = stripeSecretKey();
  if (!secret) throw new Error("Stripe is not configured for this runtime.");

  const params = new URLSearchParams();
  appendStripeFormField(params, "mode", "payment");
  appendStripeFormField(params, "success_url", new URL(successPath, appOrigin(request)).toString());
  appendStripeFormField(params, "cancel_url", new URL(cancelPath, appOrigin(request)).toString());
  appendStripeFormField(params, "customer_email", customerEmail);
  appendStripeFormField(params, "client_reference_id", orderId);
  appendStripeFormField(params, "metadata[company_id]", store.companyId);
  appendStripeFormField(params, "metadata[online_order_id]", orderId);
  appendStripeFormField(params, "metadata[payment_transaction_id]", paymentTransactionId);
  appendStripeFormField(params, "metadata[order_number]", orderNumber);
  appendStripeFormField(params, "payment_intent_data[metadata][company_id]", store.companyId);
  appendStripeFormField(params, "payment_intent_data[metadata][online_order_id]", orderId);
  appendStripeFormField(params, "payment_intent_data[metadata][payment_transaction_id]", paymentTransactionId);

  Object.entries(metadata).forEach(([key, value]) => {
    appendStripeFormField(params, `metadata[${key}]`, value);
  });

  lineItems.forEach((item, index) => {
    appendStripeFormField(params, `line_items[${index}][quantity]`, item.quantity ?? 1);
    appendStripeFormField(params, `line_items[${index}][price_data][currency]`, currency.toLowerCase());
    appendStripeFormField(
      params,
      `line_items[${index}][price_data][unit_amount]`,
      providerAmount(currency, item.amount),
    );
    appendStripeFormField(params, `line_items[${index}][price_data][product_data][name]`, item.name);
    appendStripeFormField(
      params,
      `line_items[${index}][price_data][product_data][description]`,
      item.description,
    );
  });

  const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const payload = (await response.json().catch(() => null)) as
    | StripeCheckoutSession
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("id" in payload)) {
    const message =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Failed to create Stripe Checkout session.";
    throw new Error(message);
  }

  return payload;
}

async function settleStorePaymentTransaction({
  companyId,
  paymentTransactionId,
  paymentReference,
  method,
  paidAt,
  paymentIntentId,
  eventId,
}: {
  companyId: string;
  paymentTransactionId: string;
  paymentReference: string;
  method: string;
  paidAt: string;
  paymentIntentId: string | null;
  eventId: string | null;
}) {
  const tx = await fetchPaymentTransaction(paymentTransactionId);
  if (!tx) throw new Error("Payment transaction not found.");
  if (String(tx.company_id) !== companyId) throw new Error("Payment transaction company mismatch.");

  if (tx.payment_id || tx.status === "completed") {
    return { alreadySettled: true as const };
  }

  const payload = safeRecord(tx.raw_payload);
  const invoiceId = typeof payload.invoice_id === "string" ? payload.invoice_id : null;
  const onlineOrderId = typeof payload.online_order_id === "string" ? payload.online_order_id : null;
  const customerId = typeof payload.customer_id === "string" ? payload.customer_id : null;
  const amount = num(tx.amount);
  const currency = String(tx.currency ?? "USD");

  if (!invoiceId || !customerId) {
    throw new Error("Payment transaction is missing invoice or customer linkage.");
  }

  const { data: invoice, error: invoiceError } = await adminUntyped
    .from("customer_invoices")
    .select("id, total, amount_paid, status")
    .eq("company_id", companyId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) throw new Error(invoiceError.message ?? "Failed to load invoice for settlement.");
  if (!invoice) throw new Error("Invoice for payment transaction not found.");

  const remaining = Math.max(0, num(invoice.total) - num(invoice.amount_paid));
  if (remaining <= 0.005) {
    await updatePaymentTransaction(paymentTransactionId, {
      status: "completed",
      rawPayload: {
        ...payload,
        completed_at: paidAt,
        completed_via_event_id: eventId,
        payment_intent_id: paymentIntentId,
      },
    });
    return { alreadySettled: true as const };
  }

  const paymentAmount = Math.min(remaining, amount > 0 ? amount : remaining);
  const { data: payment, error: paymentError } = await adminUntyped
    .from("payments")
    .insert({
      company_id: companyId,
      direction: "in",
      party_type: "customer",
      party_id: customerId,
      invoice_id: invoiceId,
      amount: paymentAmount,
      currency,
      method,
      status: "completed",
      reference: paymentReference,
      paid_at: paidAt,
      notes: "Storefront Stripe payment",
    })
    .select("id")
    .single();
  if (paymentError) throw new Error(paymentError.message ?? "Failed to record Stripe payment.");

  const nextAmountPaid = num(invoice.amount_paid) + paymentAmount;
  const nextInvoiceStatus = nextAmountPaid >= num(invoice.total) - 0.005 ? "paid" : "sent";

  const { error: invoiceUpdateError } = await adminUntyped
    .from("customer_invoices")
    .update({
      amount_paid: nextAmountPaid,
      status: nextInvoiceStatus,
    })
    .eq("id", invoiceId);
  if (invoiceUpdateError) {
    throw new Error(invoiceUpdateError.message ?? "Failed to update invoice after Stripe payment.");
  }

  if (onlineOrderId) {
    await adminUntyped
      .from("online_orders")
      .update({ status: nextInvoiceStatus === "paid" ? "paid" : "pending" })
      .eq("company_id", companyId)
      .eq("id", onlineOrderId);
  }

  await updatePaymentTransaction(paymentTransactionId, {
    paymentId: String(payment.id),
    providerRef: paymentIntentId ?? String(tx.provider_ref ?? paymentReference),
    status: "completed",
    rawPayload: {
      ...payload,
      completed_at: paidAt,
      completed_via_event_id: eventId,
      payment_intent_id: paymentIntentId,
    },
  });

  return { alreadySettled: false as const, paymentId: String(payment.id) };
}

export async function checkoutStoreOrder(
  request: Request,
  input: StoreCheckoutInput,
): Promise<{ result: StoreCheckoutResult; headers: Headers }> {
  const store = await resolveStore(input.storeSlug, request);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");
  if (!store.guestCheckoutEnabled) throw new Error("Guest checkout is disabled for this storefront.");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Your cart is empty.");
  if (input.paymentOption === "pay_now" && !store.onlinePaymentsEnabled) {
    throw new Error("Online payments are not enabled for this storefront yet.");
  }

  const today = new Date().toISOString().slice(0, 10);
  await assertAccountingPeriodOpen(store.companyId, today, "storefront checkout");
  const normalizedItems = await resolveCheckoutItems(store, input.items);
  const { subtotal, taxTotal, shippingMethod, shippingTotal, total } = resolveCheckoutTotals(
    store,
    input.shippingMethodCode,
    normalizedItems,
  );
  const documentSubtotal = subtotal + shippingTotal;

  const customer = await upsertCustomerForCheckout(store, input);
  const salesOrderNumber = await nextNumber(store.companyId, "sales_orders", "WEB-");
  const onlineOrderNumber = await nextNumber(store.companyId, "online_orders", "SHOP-");
  const invoiceNumber = await nextInvoiceNumber(store.companyId);

  const { data: salesOrder, error: salesOrderError } = await adminUntyped
    .from("sales_orders")
    .insert({
      company_id: store.companyId,
      customer_id: customer.id,
      order_number: salesOrderNumber,
      status: "confirmed",
      order_date: today,
      expected_delivery_date: null,
      currency: store.currency,
      subtotal: documentSubtotal,
      tax_total: taxTotal,
      total,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (salesOrderError) throw new Error(salesOrderError.message ?? "Failed to create sales order.");

  const salesOrderLines = normalizedItems.map((item, index) => ({
    order_id: salesOrder.id,
    product_id: item.product.id,
    position: index,
    description: item.product.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    line_total: item.lineTotal,
  }));
  if (shippingTotal > 0) {
    salesOrderLines.push({
      order_id: salesOrder.id,
      product_id: null,
      position: salesOrderLines.length,
      description: shippingMethod.label,
      quantity: 1,
      unit_price: shippingTotal,
      tax_rate: 0,
      line_total: shippingTotal,
    });
  }

  const { error: salesLinesError } = await adminUntyped
    .from("sales_order_lines")
    .insert(salesOrderLines);
  if (salesLinesError) throw new Error(salesLinesError.message ?? "Failed to create order lines.");

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (input.paymentOption === "pay_now" ? 0 : 14));
  const amountPaid = 0;
  const invoiceStatus = "sent";

  const { data: invoice, error: invoiceError } = await adminUntyped
    .from("customer_invoices")
    .insert({
      company_id: store.companyId,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      issue_date: today,
      due_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      currency: store.currency,
      subtotal: documentSubtotal,
      tax_total: taxTotal,
      total,
      amount_paid: amountPaid,
      notes: input.notes ?? `Storefront checkout ${onlineOrderNumber}`,
    })
    .select("id")
    .single();
  if (invoiceError) throw new Error(invoiceError.message ?? "Failed to create invoice.");

  const invoiceLines = normalizedItems.map((item, index) => ({
    invoice_id: invoice.id,
    position: index,
    description: item.product.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    line_total: item.lineTotal,
  }));
  if (shippingTotal > 0) {
    invoiceLines.push({
      invoice_id: invoice.id,
      position: invoiceLines.length,
      description: shippingMethod.label,
      quantity: 1,
      unit_price: shippingTotal,
      tax_rate: 0,
      line_total: shippingTotal,
      account_id: null,
    });
  }

  const { error: invoiceLinesError } = await adminUntyped
    .from("invoice_lines")
    .insert(invoiceLines);
  if (invoiceLinesError) throw new Error(invoiceLinesError.message ?? "Failed to create invoice lines.");

  const { error: invoiceFinalizeError } = await adminUntyped
    .from("customer_invoices")
    .update({ status: invoiceStatus, amount_paid: amountPaid })
    .eq("id", invoice.id);
  if (invoiceFinalizeError) throw new Error(invoiceFinalizeError.message ?? "Failed to finalize invoice.");

  const paymentTransactionId = await insertPaymentTransaction({
    companyId: store.companyId,
    provider: input.paymentOption === "pay_now" ? "stripe_checkout" : "storefront_invoice",
    providerRef: onlineOrderNumber,
    status: "pending",
    amount: total,
    currency: store.currency,
    rawPayload: {
      channel: "storefront",
      payment_option: input.paymentOption,
      contact_email: customer.email,
      customer_id: customer.id,
      invoice_id: String(invoice.id),
      online_order_id: null,
      sales_order_id: String(salesOrder.id),
      shipping_method_code: shippingMethod.code,
      shipping_method_label: shippingMethod.label,
      fulfillment_type: shippingMethod.fulfillmentType,
    },
  });

  const { data: onlineOrder, error: onlineOrderError } = await adminUntyped
    .from("online_orders")
    .insert({
      company_id: store.companyId,
      order_number: onlineOrderNumber,
      customer_id: customer.id,
      customer_email: customer.email,
      customer_name: customer.name,
      customer_phone: customer.phone,
      shipping_address_line1: customer.address_line1,
      shipping_city: customer.city,
      shipping_postal_code: input.contact.postalCode.trim(),
      shipping_country: customer.country,
      status: "pending",
      currency: store.currency,
      subtotal,
      shipping_total: shippingTotal,
      tax_total: taxTotal,
      total,
      payment_method: input.paymentOption === "pay_now" ? "card" : "invoice",
      payment_reference: onlineOrderNumber,
      sales_order_id: salesOrder.id,
      invoice_id: invoice.id,
      payment_transaction_id: paymentTransactionId,
      fulfillment_type: shippingMethod.fulfillmentType,
      shipping_method_code: shippingMethod.code,
      shipping_method_label: shippingMethod.label,
      shipping_eta: shippingMethod.etaLabel,
      notes: input.notes ?? null,
      placed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (onlineOrderError) throw new Error(onlineOrderError.message ?? "Failed to create online order.");

  await updatePaymentTransaction(paymentTransactionId, {
    rawPayload: {
      channel: "storefront",
      payment_option: input.paymentOption,
      contact_email: customer.email,
      customer_id: customer.id,
      invoice_id: String(invoice.id),
      online_order_id: String(onlineOrder.id),
      sales_order_id: String(salesOrder.id),
      shipping_method_code: shippingMethod.code,
      shipping_method_label: shippingMethod.label,
      fulfillment_type: shippingMethod.fulfillmentType,
    },
  });

  const { error: onlineLinesError } = await adminUntyped.from("online_order_lines").insert(
    normalizedItems.map((item, index) => ({
      order_id: onlineOrder.id,
      product_id: item.product.id,
      position: index,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    })),
  );
  if (onlineLinesError) throw new Error(onlineLinesError.message ?? "Failed to create online order lines.");

  if (store.defaultWarehouseId) {
    for (const item of normalizedItems) {
      if ((item.product.type ?? "").toLowerCase() === "service") continue;

      await adminUntyped.from("stock_movements").insert({
        company_id: store.companyId,
        product_id: item.product.id,
        warehouse_id: store.defaultWarehouseId,
        type: "out",
        quantity: item.quantity,
        reference: onlineOrderNumber,
        notes: "Storefront checkout",
      });

      const { data: level } = await adminUntyped
        .from("stock_levels")
        .select("id, quantity")
        .eq("product_id", item.product.id)
        .eq("warehouse_id", store.defaultWarehouseId)
        .maybeSingle();

      if (level) {
        await adminUntyped
          .from("stock_levels")
          .update({ quantity: num(level.quantity) - item.quantity })
          .eq("id", level.id);
      } else {
        await adminUntyped.from("stock_levels").insert({
          company_id: store.companyId,
          product_id: item.product.id,
          warehouse_id: store.defaultWarehouseId,
          quantity: -item.quantity,
        });
      }
    }
  }

  let redirectUrl: string | null = null;
  let paymentState: StoreCheckoutResult["paymentState"] = "pending";
  if (input.paymentOption === "pay_now") {
    const session = await createStripeCheckoutSession({
      request,
      store,
      orderId: String(onlineOrder.id),
      orderNumber: onlineOrderNumber,
      paymentTransactionId,
      customerEmail: customer.email,
      successPath: `/shop/${store.storeSlug}/order/${onlineOrder.id}?payment=success`,
      cancelPath: `/shop/${store.storeSlug}/order/${onlineOrder.id}?payment=cancelled`,
      currency: store.currency,
      lineItems: [
        ...normalizedItems.map((item) => ({
          name: item.product.name,
          amount: item.unitPrice * (1 + item.taxRate / 100),
          quantity: item.quantity,
          description: nonEmpty(item.product.description) ?? item.product.sku,
        })),
        ...(shippingTotal > 0
          ? [
              {
                name: shippingMethod.label,
                amount: shippingTotal,
                quantity: 1,
                description: shippingMethod.etaLabel ?? shippingMethod.description,
              },
            ]
          : []),
      ],
      metadata: {
        checkout_source: "storefront_checkout",
        invoice_id: String(invoice.id),
      },
    });

    await updatePaymentTransaction(paymentTransactionId, {
      provider: "stripe_checkout",
      providerRef: session.id,
      rawPayload: {
        channel: "storefront",
        payment_option: input.paymentOption,
        contact_email: customer.email,
        customer_id: customer.id,
        invoice_id: String(invoice.id),
        online_order_id: String(onlineOrder.id),
        sales_order_id: String(salesOrder.id),
        shipping_method_code: shippingMethod.code,
        shipping_method_label: shippingMethod.label,
        fulfillment_type: shippingMethod.fulfillmentType,
        checkout_session_id: session.id,
      },
    });
    redirectUrl = session.url;
    paymentState = "processing";
  }

  const portalSession = await createPortalSession({
    companyId: store.companyId,
    customerId: customer.id,
    email: customer.email,
    createdViaOrderId: String(onlineOrder.id),
  });

  const headers = new Headers();
  headers.append("Set-Cookie", portalCookieHeader(portalSession.token));

  return {
    result: {
      orderId: String(onlineOrder.id),
      orderNumber: onlineOrderNumber,
      invoiceId: String(invoice.id),
      salesOrderId: String(salesOrder.id),
      paymentTransactionId,
      paymentState,
      redirectUrl,
    },
    headers,
  };
}

export async function accessPortalAccount(
  request: Request,
  {
    storeSlug,
    email,
    orderNumber,
    postalCode,
  }: {
    storeSlug: string;
    email: string;
    orderNumber: string;
    postalCode: string;
  },
) {
  const store = await resolveStore(storeSlug, request);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOrderNumber = orderNumber.trim();
  const normalizedPostalCode = slugify(postalCode).replace(/-/g, "");

  const { data: order, error } = await adminUntyped
    .from("online_orders")
    .select("id, customer_id, customer_email, shipping_postal_code")
    .eq("company_id", store.companyId)
    .eq("order_number", normalizedOrderNumber)
    .ilike("customer_email", normalizedEmail)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to verify order access.");
  if (!order) throw new Error("We couldn't match that order to this email address.");

  const orderPostal = slugify(String(order.shipping_postal_code ?? "")).replace(/-/g, "");
  if (!orderPostal || orderPostal !== normalizedPostalCode) {
    throw new Error("The postal code did not match this order.");
  }
  if (!order.customer_id) {
    throw new Error("This order is not yet linked to a customer account.");
  }

  const portalSession = await createPortalSession({
    companyId: store.companyId,
    customerId: String(order.customer_id),
    email: normalizedEmail,
    createdViaOrderId: String(order.id),
  });

  const headers = new Headers();
  headers.append("Set-Cookie", portalCookieHeader(portalSession.token));
  return headers;
}

export async function getPortalAccount(
  request: Request,
  storeSlug: string,
): Promise<{ shell: StorefrontShell; account: PortalAccountSummary }> {
  const { store, session } = await loadPortalSession(request, storeSlug);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");
  if (!session) throw new Error("Sign in to your customer account to continue.");

  const products = (await loadPublishedProducts(store.companyId)).map(buildProductCard);
  return {
    shell: buildShell(store, products),
    account: await loadPortalAccountData(store, session.customer_id),
  };
}

async function beginStorefrontInvoiceCheckoutSession(
  request: Request,
  {
    store,
    customerId,
    customerEmail,
    invoiceId,
    source,
  }: {
    store: ResolvedStore;
    customerId: string;
    customerEmail: string;
    invoiceId: string;
    source: "portal_invoice" | "order_retry";
  },
) {
  if (!store.onlinePaymentsEnabled || !stripeConfigured()) {
    throw new Error("Online card payments are not enabled for this storefront.");
  }

  const { data: invoice, error: invoiceError } = await adminUntyped
    .from("customer_invoices")
    .select("id, invoice_number, total, amount_paid, currency, customer_id")
    .eq("company_id", store.companyId)
    .eq("id", invoiceId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (invoiceError) throw new Error(invoiceError.message ?? "Failed to load invoice.");
  if (!invoice) throw new Error("Invoice not found.");

  const remaining = Math.max(0, num(invoice.total) - num(invoice.amount_paid));
  if (remaining <= 0.005) throw new Error("This invoice is already paid.");

  const { data: order, error: orderError } = await adminUntyped
    .from("online_orders")
    .select("id, order_number, subtotal, shipping_total, tax_total, total, shipping_method_label, shipping_eta, payment_transaction_id")
    .eq("company_id", store.companyId)
    .eq("invoice_id", invoiceId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message ?? "Failed to load storefront order.");

  const paymentTransactionId =
    typeof order?.payment_transaction_id === "string"
      ? String(order.payment_transaction_id)
      : await insertPaymentTransaction({
          companyId: store.companyId,
          provider: "stripe_checkout",
          status: "pending",
          amount: remaining,
          currency: String(invoice.currency ?? store.currency),
          rawPayload: {
            channel: source === "portal_invoice" ? "portal" : "storefront",
            payment_option: "pay_now",
            customer_id: customerId,
            invoice_id: String(invoice.id),
            online_order_id: order?.id ? String(order.id) : null,
          },
        });

  const session = await createStripeCheckoutSession({
    request,
    store,
    orderId: order?.id ? String(order.id) : String(invoice.id),
    orderNumber: order?.order_number ? String(order.order_number) : String(invoice.invoice_number),
    paymentTransactionId,
    customerEmail,
    successPath: order?.id
      ? `/shop/${store.storeSlug}/order/${order.id}?payment=success`
      : `/shop/${store.storeSlug}/account?payment=success`,
    cancelPath: order?.id
      ? `/shop/${store.storeSlug}/order/${order.id}?payment=cancelled`
      : `/shop/${store.storeSlug}/account?payment=cancelled`,
    currency: String(invoice.currency ?? store.currency),
    lineItems: [
      {
        name: order?.order_number
          ? `Order ${order.order_number}`
          : `Invoice ${invoice.invoice_number}`,
        amount: remaining,
        quantity: 1,
        description: order?.shipping_method_label
          ? `${order.shipping_method_label}${order.shipping_eta ? ` · ${order.shipping_eta}` : ""}`
          : "Outstanding storefront balance",
      },
    ],
    metadata: {
      checkout_source: source,
      invoice_id: String(invoice.id),
    },
  });

  const existingTx = safeRecord((await fetchPaymentTransaction(paymentTransactionId))?.raw_payload);
  await updatePaymentTransaction(paymentTransactionId, {
    provider: "stripe_checkout",
    providerRef: session.id,
    rawPayload: {
      ...existingTx,
      channel: source === "portal_invoice" ? "portal" : "storefront",
      payment_option: "pay_now",
      customer_id: customerId,
      invoice_id: String(invoice.id),
      online_order_id: order?.id ? String(order.id) : null,
      checkout_session_id: session.id,
    },
  });

  return {
    invoiceId: String(invoice.id),
    orderId: order?.id ? String(order.id) : null,
    redirectUrl: session.url,
  };
}

export async function getPortalOrder(
  request: Request,
  storeSlug: string,
  orderId: string,
): Promise<PortalOrderDetail> {
  const { store, session } = await loadPortalSession(request, storeSlug);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");
  if (!session) throw new Error("Sign in to your customer account to continue.");

  const products = (await loadPublishedProducts(store.companyId)).map(buildProductCard);
  const shell = buildShell(store, products);

  const { data: order, error: orderError } = await adminUntyped
    .from("online_orders")
    .select("*")
    .eq("company_id", store.companyId)
    .eq("id", orderId)
    .eq("customer_id", session.customer_id)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message ?? "Failed to load order.");
  if (!order) throw new Error("Order not found.");

  const [{ data: lines, error: linesError }, account] = await Promise.all([
    adminUntyped
      .from("online_order_lines")
      .select("*")
      .eq("order_id", order.id)
      .order("position"),
    loadPortalAccountData(store, session.customer_id),
  ]);
  if (linesError) throw new Error(linesError.message ?? "Failed to load order lines.");

  const invoice = order.invoice_id
    ? account.invoices.find((row) => row.id === String(order.invoice_id)) ?? null
    : null;

  return {
    shell,
    account: account.customer,
    order: {
      id: String(order.id),
      orderNumber: String(order.order_number),
      status: String(order.status),
      placedAt: String(order.placed_at),
      total: num(order.total),
      currency: String(order.currency ?? store.currency),
      paymentMethod: nonEmpty(order.payment_method),
      paymentState: invoice ? (invoice.balanceDue <= 0.005 ? "paid" : "pending") : order.status === "paid" ? "paid" : "pending",
      invoiceId: order.invoice_id ? String(order.invoice_id) : null,
      subtotal: num(order.subtotal),
      shippingTotal: num(order.shipping_total),
      taxTotal: num(order.tax_total),
      shippingAddress: {
        line1: nonEmpty(order.shipping_address_line1),
        city: nonEmpty(order.shipping_city),
        postalCode: nonEmpty(order.shipping_postal_code),
        country: nonEmpty(order.shipping_country),
      },
      shippingMethodLabel: nonEmpty(order.shipping_method_label),
      shippingEta: nonEmpty(order.shipping_eta),
      fulfillmentType: order.fulfillment_type === "pickup" ? "pickup" : "shipping",
      canRetryPayment:
        store.onlinePaymentsEnabled &&
        !!invoice &&
        invoice.balanceDue > 0.005,
      items: (lines ?? []).map((line: Record<string, unknown>) => {
        const productId = line.product_id ? String(line.product_id) : null;
        const product = productId ? products.find((row) => row.id === productId) : null;
        return {
          id: String(line.id),
          productId,
          productName: String(line.product_name),
          quantity: num(line.quantity),
          unitPrice: num(line.unit_price),
          lineTotal: num(line.line_total),
          productKey: product ? product.key : null,
        };
      }),
      invoice,
    },
  };
}

export async function retryStoreOrderPayment(
  request: Request,
  {
    storeSlug,
    orderId,
  }: {
    storeSlug: string;
    orderId: string;
  },
) {
  const { store, session } = await loadPortalSession(request, storeSlug);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");
  if (!session) throw new Error("Sign in to your customer account to continue.");

  const { data: order, error } = await adminUntyped
    .from("online_orders")
    .select("id, invoice_id")
    .eq("company_id", store.companyId)
    .eq("id", orderId)
    .eq("customer_id", session.customer_id)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load order.");
  if (!order?.invoice_id) throw new Error("This order does not have an invoice to pay.");

  return beginStorefrontInvoiceCheckoutSession(request, {
    store,
    customerId: session.customer_id,
    customerEmail: session.email,
    invoiceId: String(order.invoice_id),
    source: "order_retry",
  });
}

export async function payPortalInvoice(
  request: Request,
  {
    storeSlug,
    invoiceId,
  }: {
    storeSlug: string;
    invoiceId: string;
  },
) {
  const { store, session } = await loadPortalSession(request, storeSlug);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");
  if (!session) throw new Error("Sign in to your customer account to continue.");

  const today = new Date().toISOString().slice(0, 10);
  await assertAccountingPeriodOpen(store.companyId, today, "customer portal payment");

  const result = await beginStorefrontInvoiceCheckoutSession(request, {
    store,
    customerId: session.customer_id,
    customerEmail: session.email,
    invoiceId,
    source: "portal_invoice",
  });

  return {
    ok: true as const,
    invoiceId: result.invoiceId,
    redirectUrl: result.redirectUrl,
  } satisfies PortalInvoicePaymentResult;
}

export async function handleStorefrontStripeWebhook(request: Request) {
  const secret = stripeWebhookSecret();
  if (!secret) throw new Error("Stripe webhook secret is not configured.");

  const signatureHeader = request.headers.get("Stripe-Signature");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header.");

  const payload = await request.text();
  const timestampPart = signatureHeader
    .split(",")
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith("t="))
    ?.slice(2);
  if (!timestampPart || Math.abs(Date.now() / 1000 - Number(timestampPart)) > 300) {
    throw new Error("Stripe webhook timestamp is outside the allowed tolerance.");
  }
  if (!stripeSignature(signatureHeader, payload, secret)) {
    throw new Error("Stripe webhook signature verification failed.");
  }

  const event = JSON.parse(payload) as StripeEventEnvelope;
  const session = safeRecord(event.data?.object);
  const metadata = safeRecord(session.metadata);
  const paymentTransactionId =
    typeof metadata.payment_transaction_id === "string"
      ? metadata.payment_transaction_id
      : null;
  const companyId = typeof metadata.company_id === "string" ? metadata.company_id : null;

  if (!paymentTransactionId || !companyId) {
    return { ok: true as const, ignored: true as const };
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    if (session.payment_status !== "paid") {
      return { ok: true as const, ignored: true as const };
    }
    await settleStorePaymentTransaction({
      companyId,
      paymentTransactionId,
      paymentReference:
        typeof metadata.order_number === "string"
          ? `Stripe ${metadata.order_number}`
          : `Stripe ${String(session.id ?? paymentTransactionId)}`,
      method: "card",
      paidAt: new Date().toISOString(),
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      eventId: event.id,
    });
    return { ok: true as const, settled: true as const };
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const tx = await fetchPaymentTransaction(paymentTransactionId);
    if (tx && !tx.payment_id && tx.status !== "completed") {
      const currentPayload = safeRecord(tx.raw_payload);
      await updatePaymentTransaction(paymentTransactionId, {
        status: "failed",
        rawPayload: {
          ...currentPayload,
          failed_at: new Date().toISOString(),
          failed_via_event_id: event.id,
          checkout_status: session.status ?? null,
          payment_status: session.payment_status ?? null,
        },
      });
    }
  }

  return { ok: true as const, ignored: true as const };
}

export async function getPortalDocumentUrl(
  request: Request,
  {
    storeSlug,
    documentType,
    documentId,
  }: {
    storeSlug: string;
    documentType: "invoice" | "credit_note" | "customer_statement";
    documentId: string;
  },
) {
  const { store, session } = await loadPortalSession(request, storeSlug);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");
  if (!session) throw new Error("Sign in to your customer account to continue.");

  let printPath: string;
  if (documentType === "customer_statement") {
    if (documentId !== session.customer_id) throw new Error("Access denied.");
    printPath = `/api/documents/customer-statement/${session.customer_id}`;
  } else if (documentType === "invoice") {
    const { data } = await adminUntyped
      .from("customer_invoices")
      .select("id")
      .eq("company_id", store.companyId)
      .eq("customer_id", session.customer_id)
      .eq("id", documentId)
      .maybeSingle();
    if (!data) throw new Error("Access denied.");
    printPath = `/api/documents/invoice/${documentId}`;
  } else {
    const { data } = await adminUntyped
      .from("credit_notes")
      .select("id")
      .eq("company_id", store.companyId)
      .eq("customer_id", session.customer_id)
      .eq("id", documentId)
      .maybeSingle();
    if (!data) throw new Error("Access denied.");
    printPath = `/api/documents/credit-note/${documentId}`;
  }

  const shareToken = await createDocumentShareToken({
    companyId: store.companyId,
    documentType,
    documentId,
    createdBy: null,
    expiresInDays: 7,
  });

  return buildSharedDocumentUrl(request, printPath, shareToken.token);
}

export async function getStoreSetup(companyId: string): Promise<StorefrontSetupData> {
  const [{ data: settings, error: settingsError }, { data: company, error: companyError }, { data: products, error: productsError }] = await Promise.all([
    adminUntyped
      .from("company_settings")
      .select("online_store_enabled, online_payments_enabled, store_slug, store_display_name, store_tagline, store_support_email, store_contact_phone, store_announcement, store_default_branch_id, store_default_warehouse_id, store_shipping_enabled, store_pickup_enabled, store_guest_checkout_enabled, store_shipping_methods")
      .eq("company_id", companyId)
      .maybeSingle(),
    adminUntyped
      .from("companies")
      .select("name, currency")
      .eq("id", companyId)
      .maybeSingle(),
    adminUntyped
      .from("products")
      .select("id, name, sku, is_published, image_url, sale_price, product_categories(name)")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(24),
  ]);

  if (settingsError) throw new Error(settingsError.message ?? "Failed to load store settings.");
  if (companyError) throw new Error(companyError.message ?? "Failed to load company.");
  if (productsError) throw new Error(productsError.message ?? "Failed to load products.");

  const slug =
    settings?.store_slug ??
    `${slugify(company?.name ?? "store")}-${companyId.slice(0, 6)}`;
  const shippingMethods = normalizeShippingMethods(settings?.store_shipping_methods, {
    shippingEnabled: settings?.store_shipping_enabled ?? true,
    pickupEnabled: settings?.store_pickup_enabled ?? false,
  });
  const paymentProvider = summarizePaymentProvider(
    Boolean(settings?.online_payments_enabled),
    stripeSecretKey(),
  );

  return {
    companyName: String(company?.name ?? "Store"),
    currency: String(company?.currency ?? "USD"),
    settings: {
      onlineStoreEnabled: Boolean(settings?.online_store_enabled),
      onlinePaymentsEnabled: paymentProvider.checkoutEnabled,
      paymentProvider,
      storeSlug: slug,
      storeDisplayName: settings?.store_display_name ?? company?.name ?? "Store",
      storeTagline: settings?.store_tagline ?? "",
      storeSupportEmail: settings?.store_support_email ?? "",
      storeContactPhone: settings?.store_contact_phone ?? "",
      storeAnnouncement: settings?.store_announcement ?? "",
      shippingEnabled: settings?.store_shipping_enabled ?? true,
      pickupEnabled: settings?.store_pickup_enabled ?? false,
      guestCheckoutEnabled: settings?.store_guest_checkout_enabled ?? true,
      shippingMethods,
    },
    storeUrl: `/shop/${slug}`,
    products: (products ?? []).map((product: Record<string, unknown>) => ({
      id: String(product.id),
      name: String(product.name),
      sku: nonEmpty(product.sku),
      isPublished: Boolean(product.is_published),
      imageUrl: nonEmpty(product.image_url),
      price: num(product.sale_price),
      categoryName: product.product_categories?.name ? String(product.product_categories.name) : null,
    })),
  };
}

function stripAdvancedConfig(config: StoreDesignConfig) {
  return {
    ...config,
    advanced: {
      customCss: "",
    },
  } satisfies StoreDesignConfig;
}

function findThemePreset(presetId: StoreThemePresetId) {
  return STORE_THEME_PRESETS.find((preset) => preset.id === presetId) ?? STORE_THEME_PRESETS[0];
}

export async function getStoreDesignSetup(
  companyId: string,
  canEditAdvanced: boolean,
): Promise<StoreDesignSetup> {
  const [{ data: company, error: companyError }, { data: settings, error: settingsError }, { data: products, error: productsError }] = await Promise.all([
    adminUntyped
      .from("companies")
      .select("id, name, currency")
      .eq("id", companyId)
      .maybeSingle(),
    adminUntyped
      .from("company_settings")
      .select(
        "store_slug, store_design_draft, store_design_published, store_design_draft_saved_at, store_design_draft_saved_by, store_design_published_at, store_design_published_by, store_design_preview_token_hash, store_design_preview_expires_at",
      )
      .eq("company_id", companyId)
      .maybeSingle(),
    adminUntyped
      .from("products")
      .select("id, name, sku, is_published, image_url, sale_price, storefront_presentation, product_categories(name)")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(24),
  ]);

  if (companyError) throw new Error(companyError.message ?? "Failed to load store design.");
  if (settingsError) throw new Error(settingsError.message ?? "Failed to load store design settings.");
  if (productsError) throw new Error(productsError.message ?? "Failed to load store design products.");

  const slug =
    settings?.store_slug ??
    `${slugify(company?.name ?? "store")}-${companyId.slice(0, 6)}`;
  const { published, draft, hasUnpublishedChanges } = resolveStoreDesign(
    settings?.store_design_published,
    settings?.store_design_draft,
  );
  const safeDraft = canEditAdvanced ? draft : stripAdvancedConfig(draft);
  const safePublished = canEditAdvanced ? published : stripAdvancedConfig(published);

  return {
    companyId,
    companyName: String(company?.name ?? "Store"),
    currency: String(company?.currency ?? "USD"),
    storeUrl: `/shop/${slug}`,
    previewUrl: null,
    previewExpiresAt: settings?.store_design_preview_expires_at
      ? String(settings.store_design_preview_expires_at)
      : null,
    previewActive: Boolean(
      settings?.store_design_preview_token_hash &&
        settings?.store_design_preview_expires_at &&
        new Date(String(settings.store_design_preview_expires_at)).getTime() > Date.now(),
    ),
    canEditAdvanced,
    publishedAt: settings?.store_design_published_at ? String(settings.store_design_published_at) : null,
    publishedBy: settings?.store_design_published_by ? String(settings.store_design_published_by) : null,
    draftSavedAt: settings?.store_design_draft_saved_at ? String(settings.store_design_draft_saved_at) : null,
    draftSavedBy: settings?.store_design_draft_saved_by ? String(settings.store_design_draft_saved_by) : null,
    published: safePublished,
    draft: safeDraft,
    hasUnpublishedChanges,
    products: (products ?? []).map((product: Record<string, unknown>) => ({
      id: String(product.id),
      name: String(product.name),
      sku: nonEmpty(product.sku),
      isPublished: Boolean(product.is_published),
      imageUrl: nonEmpty(product.image_url),
      categoryName: product.product_categories?.name ? String(product.product_categories.name) : null,
      price: num(product.sale_price),
      presentation: normalizeProductPresentation(product.storefront_presentation),
    })),
  };
}

export async function saveStoreDesignDraft(
  companyId: string,
  actorId: string,
  payload: StoreDesignConfig,
  canEditAdvanced: boolean,
) {
  const nextDraft = canEditAdvanced ? payload : stripAdvancedConfig(payload);
  const { error } = await adminUntyped
    .from("company_settings")
    .update({
      store_design_draft: nextDraft,
      store_design_draft_saved_at: new Date().toISOString(),
      store_design_draft_saved_by: actorId,
    })
    .eq("company_id", companyId);

  if (error) throw new Error(error.message ?? "Failed to save store design draft.");
  return getStoreDesignSetup(companyId, canEditAdvanced);
}

export async function publishStoreDesignDraft(
  companyId: string,
  actorId: string,
  canEditAdvanced: boolean,
) {
  const current = await getStoreDesignSetup(companyId, true);
  const nextPublished = canEditAdvanced ? current.draft : stripAdvancedConfig(current.draft);
  const now = new Date().toISOString();
  const { error } = await adminUntyped
    .from("company_settings")
    .update({
      store_design_draft: nextPublished,
      store_design_published: nextPublished,
      store_design_draft_saved_at: now,
      store_design_draft_saved_by: actorId,
      store_design_published_at: now,
      store_design_published_by: actorId,
    })
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Failed to publish store design.");
  return getStoreDesignSetup(companyId, canEditAdvanced);
}

export async function revertStoreDesignDraft(
  companyId: string,
  actorId: string,
  canEditAdvanced: boolean,
) {
  const current = await getStoreDesignSetup(companyId, true);
  const nextDraft = canEditAdvanced ? current.published : stripAdvancedConfig(current.published);
  const { error } = await adminUntyped
    .from("company_settings")
    .update({
      store_design_draft: nextDraft,
      store_design_draft_saved_at: new Date().toISOString(),
      store_design_draft_saved_by: actorId,
    })
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Failed to revert store design draft.");
  return getStoreDesignSetup(companyId, canEditAdvanced);
}

export async function createStoreDesignPreviewLink(
  companyId: string,
  actorId: string,
  canEditAdvanced: boolean,
) {
  const current = await getStoreDesignSetup(companyId, true);
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + STOREFRONT_PREVIEW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await adminUntyped
    .from("company_settings")
    .update({
      store_design_preview_token_hash: hashPreviewToken(token),
      store_design_preview_expires_at: expiresAt,
      store_design_preview_created_at: new Date().toISOString(),
      store_design_preview_created_by: actorId,
      store_design_preview_last_used_at: null,
    })
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Failed to create preview link.");

  const setup = await getStoreDesignSetup(companyId, canEditAdvanced);
  return {
    ...setup,
    previewUrl: previewUrlForStore(current.storeUrl.replace("/shop/", ""), token),
    previewExpiresAt: expiresAt,
    previewActive: true,
  } satisfies StoreDesignSetup;
}

export async function revokeStoreDesignPreviewLink(
  companyId: string,
  canEditAdvanced: boolean,
) {
  const { error } = await adminUntyped
    .from("company_settings")
    .update({
      store_design_preview_token_hash: null,
      store_design_preview_expires_at: null,
      store_design_preview_created_at: null,
      store_design_preview_created_by: null,
      store_design_preview_last_used_at: null,
    })
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Failed to revoke preview link.");
  return getStoreDesignSetup(companyId, canEditAdvanced);
}

export async function applyStoreDesignPreset(
  companyId: string,
  actorId: string,
  presetId: StoreThemePresetId,
  canEditAdvanced: boolean,
) {
  const current = await getStoreDesignSetup(companyId, true);
  const preset = findThemePreset(presetId);
  const nextDraft: StoreDesignConfig = {
    ...createDefaultStoreDesign(preset.id),
    advanced: canEditAdvanced ? current.draft.advanced : { customCss: "" },
  };
  return saveStoreDesignDraft(companyId, actorId, nextDraft, canEditAdvanced);
}

export async function saveProductPresentation(
  companyId: string,
  productId: string,
  payload: {
    presentation: StorefrontProductPresentation;
    isPublished?: boolean;
  },
) {
  const updateRow: Record<string, unknown> = {
    storefront_presentation: normalizeProductPresentation(payload.presentation),
  };
  if (typeof payload.isPublished === "boolean") {
    updateRow.is_published = payload.isPublished;
  }

  const { error } = await adminUntyped
    .from("products")
    .update(updateRow)
    .eq("company_id", companyId)
    .eq("id", productId);
  if (error) throw new Error(error.message ?? "Failed to save product presentation.");
  return { ok: true as const };
}

export async function saveStoreSetup(
  companyId: string,
  payload: {
    storeSlug: string;
    storeDisplayName: string;
    storeTagline?: string | null;
    storeSupportEmail?: string | null;
    storeContactPhone?: string | null;
    storeAnnouncement?: string | null;
    shippingEnabled: boolean;
    pickupEnabled: boolean;
    guestCheckoutEnabled: boolean;
    shippingMethods: StorefrontShippingMethod[];
  },
) {
  const normalizedSlug = slugify(payload.storeSlug || "");
  if (!normalizedSlug) throw new Error("Choose a valid store URL slug.");
  const shippingMethods = normalizeShippingMethods(payload.shippingMethods, {
    shippingEnabled: payload.shippingEnabled,
    pickupEnabled: payload.pickupEnabled,
  });

  const { error } = await adminUntyped
    .from("company_settings")
    .update({
      store_slug: normalizedSlug,
      store_display_name: payload.storeDisplayName.trim(),
      store_tagline: nonEmpty(payload.storeTagline),
      store_support_email: nonEmpty(payload.storeSupportEmail),
      store_contact_phone: nonEmpty(payload.storeContactPhone),
      store_announcement: nonEmpty(payload.storeAnnouncement),
      store_shipping_enabled: payload.shippingEnabled,
      store_pickup_enabled: payload.pickupEnabled,
      store_guest_checkout_enabled: payload.guestCheckoutEnabled,
      store_shipping_methods: shippingMethods,
    })
    .eq("company_id", companyId);

  if (error) {
    if (/idx_company_settings_store_slug|duplicate/i.test(error.message ?? "")) {
      throw new Error("That store URL is already in use. Choose another slug.");
    }
    throw new Error(error.message ?? "Failed to save storefront settings.");
  }

  return getStoreSetup(companyId);
}

export async function setProductPublished(
  companyId: string,
  productId: string,
  isPublished: boolean,
) {
  const { error } = await adminUntyped
    .from("products")
    .update({ is_published: isPublished })
    .eq("company_id", companyId)
    .eq("id", productId);

  if (error) throw new Error(error.message ?? "Failed to update product publishing.");
  return { ok: true as const };
}

export async function openStoreDesignPreview(
  request: Request,
  {
    storeSlug,
    token,
  }: {
    storeSlug: string;
    token: string;
  },
) {
  const store = await resolveStore(storeSlug);
  if (!store || !store.onlineStoreEnabled) throw new Error("This storefront is not available.");

  const { data, error } = await adminUntyped
    .from("company_settings")
    .select("store_design_preview_token_hash, store_design_preview_expires_at")
    .eq("company_id", store.companyId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load preview state.");

  const tokenHash = nonEmpty(data?.store_design_preview_token_hash);
  const expiresAt = nonEmpty(data?.store_design_preview_expires_at);
  if (
    !tokenHash ||
    !expiresAt ||
    tokenHash !== hashPreviewToken(token) ||
    new Date(expiresAt).getTime() <= Date.now()
  ) {
    throw new Error("This preview link is invalid or has expired.");
  }

  const headers = new Headers();
  headers.append("Set-Cookie", previewCookieHeader(token, storeSlug, expiresAt));
  headers.set("Location", new URL(`/shop/${storeSlug}`, appOrigin(request)).toString());
  return new Response(null, { status: 302, headers });
}

export function storefrontJson(body: unknown, headers?: HeadersInit, status = 200) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export function storefrontUnauthorizedJson(message = "Sign in required.") {
  const headers = new Headers();
  headers.append("Set-Cookie", clearPortalCookieHeader());
  return storefrontJson({ error: message }, headers, 401);
}
