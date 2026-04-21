export type StorefrontShippingMethodKind =
  | "flat_rate"
  | "free_shipping"
  | "local_pickup"
  | "custom";

export type StorefrontFulfillmentType = "shipping" | "pickup";

export interface StorefrontShippingMethod {
  code: string;
  label: string;
  description: string | null;
  kind: StorefrontShippingMethodKind;
  fulfillmentType: StorefrontFulfillmentType;
  amount: number;
  freeOver: number | null;
  active: boolean;
  etaLabel: string | null;
}

export interface ResolvedStorefrontShippingMethod extends StorefrontShippingMethod {
  effectiveAmount: number;
}

export interface StorefrontPaymentProviderSummary {
  provider: "stripe";
  mode: "disabled" | "test" | "live";
  checkoutEnabled: boolean;
  label: string;
}

function num(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
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

export function createDefaultShippingMethods(options?: {
  shippingEnabled?: boolean;
  pickupEnabled?: boolean;
}) {
  const shippingEnabled = options?.shippingEnabled !== false;
  const pickupEnabled = options?.pickupEnabled === true;
  const methods: StorefrontShippingMethod[] = [];

  if (shippingEnabled) {
    methods.push(
      {
        code: "standard-shipping",
        label: "Standard shipping",
        description: "Reliable delivery with a flat-rate default.",
        kind: "flat_rate",
        fulfillmentType: "shipping",
        amount: 15,
        freeOver: null,
        active: true,
        etaLabel: "3-5 business days",
      },
      {
        code: "free-over-250",
        label: "Free shipping over 250",
        description: "Automatically free on higher-value carts.",
        kind: "free_shipping",
        fulfillmentType: "shipping",
        amount: 15,
        freeOver: 250,
        active: true,
        etaLabel: "3-5 business days",
      },
    );
  }

  if (pickupEnabled) {
    methods.push({
      code: "local-pickup",
      label: "Local pickup",
      description: "Collect from the store with pickup instructions after checkout.",
      kind: "local_pickup",
      fulfillmentType: "pickup",
      amount: 0,
      freeOver: null,
      active: true,
      etaLabel: "Ready same day",
    });
  }

  if (methods.length === 0) {
    methods.push({
      code: "service-delivery",
      label: "Digital / service delivery",
      description: "No physical shipping required.",
      kind: "custom",
      fulfillmentType: "shipping",
      amount: 0,
      freeOver: null,
      active: true,
      etaLabel: "Sent after confirmation",
    });
  }

  return methods;
}

export function normalizeShippingMethods(
  value: unknown,
  options?: {
    shippingEnabled?: boolean;
    pickupEnabled?: boolean;
  },
) {
  const defaults = createDefaultShippingMethods(options);
  if (!Array.isArray(value) || value.length === 0) {
    return defaults;
  }

  const normalized = value
    .map((entry, index) => {
      const record = safeRecord(entry);
      const fallback = defaults[index] ?? defaults[0];
      const code = nonEmpty(record.code) ?? `${fallback.code}-${index + 1}`;
      const label = nonEmpty(record.label) ?? fallback.label;
      const kind =
        record.kind === "flat_rate" ||
        record.kind === "free_shipping" ||
        record.kind === "local_pickup" ||
        record.kind === "custom"
          ? record.kind
          : fallback.kind;
      const fulfillmentType =
        record.fulfillmentType === "pickup" || kind === "local_pickup"
          ? "pickup"
          : "shipping";
      return {
        code,
        label,
        description: nonEmpty(record.description),
        kind,
        fulfillmentType,
        amount: Math.max(0, num(record.amount)),
        freeOver:
          record.freeOver === null || record.freeOver === undefined
            ? null
            : Math.max(0, num(record.freeOver)),
        active: record.active !== false,
        etaLabel: nonEmpty(record.etaLabel),
      } satisfies StorefrontShippingMethod;
    })
    .filter((method) => {
      if (!method.active) return false;
      if (method.fulfillmentType === "pickup" && options?.pickupEnabled === false) return false;
      if (method.fulfillmentType === "shipping" && options?.shippingEnabled === false) return false;
      return true;
    });

  return normalized.length > 0 ? normalized : defaults;
}

export function resolveShippingMethods(
  methods: StorefrontShippingMethod[],
  subtotal: number,
) {
  return methods
    .filter((method) => method.active)
    .map((method) => {
      const eligibleForFree =
        method.kind === "free_shipping" &&
        method.freeOver !== null &&
        subtotal >= method.freeOver;
      return {
        ...method,
        effectiveAmount: eligibleForFree ? 0 : Math.max(0, method.amount),
      } satisfies ResolvedStorefrontShippingMethod;
    });
}

export function summarizePaymentProvider(checkoutEnabled: boolean, stripeSecretKey?: string | null) {
  const trimmed = stripeSecretKey?.trim() ?? "";
  const mode = !checkoutEnabled
    ? "disabled"
    : trimmed.startsWith("sk_live_")
      ? "live"
      : trimmed.startsWith("sk_test_")
        ? "test"
        : "disabled";

  return {
    provider: "stripe",
    mode,
    checkoutEnabled: checkoutEnabled && mode !== "disabled",
    label:
      mode === "live"
        ? "Stripe live checkout"
        : mode === "test"
          ? "Stripe test checkout"
          : "Stripe not configured",
  } satisfies StorefrontPaymentProviderSummary;
}
