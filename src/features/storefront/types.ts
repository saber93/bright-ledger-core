import type {
  StoreDesignConfig,
  StorefrontProductPresentation,
} from "@/features/storefront/design";
import type {
  ResolvedStorefrontShippingMethod,
  StorefrontFulfillmentType,
  StorefrontPaymentProviderSummary,
  StorefrontShippingMethod,
} from "@/features/storefront/commerce";

export interface StorefrontShell {
  companyId: string;
  storeSlug: string;
  storeName: string;
  storeTagline: string | null;
  storeAnnouncement: string | null;
  supportEmail: string | null;
  contactPhone: string | null;
  currency: string;
  onlinePaymentsEnabled: boolean;
  paymentProvider: StorefrontPaymentProviderSummary;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  guestCheckoutEnabled: boolean;
  shippingMethods: StorefrontShippingMethod[];
  previewMode: boolean;
  previewUrl: string | null;
  previewExpiresAt: string | null;
  categories: StorefrontCategory[];
  design: StoreDesignConfig;
}

export interface StorefrontCategory {
  id: string;
  key: string;
  name: string;
  productCount: number;
}

export interface StorefrontProductCard {
  id: string;
  key: string;
  categoryId: string | null;
  categoryKey: string | null;
  categoryName: string | null;
  sku: string | null;
  name: string;
  shortDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  gallery: string[];
  badge: string | null;
  price: number;
  taxRate: number;
  totalStock: number;
  inStock: boolean;
  featured: boolean;
  shortCopy: string | null;
  highlights: string[];
  shippingNote: string | null;
  trustNote: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface StorefrontCatalogResult {
  shell: StorefrontShell;
  products: StorefrontProductCard[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sort: "featured" | "price_asc" | "price_desc" | "name";
  inStockOnly: boolean;
  categoryKey: string | null;
}

export interface StorefrontProductDetail {
  shell: StorefrontShell;
  product: StorefrontProductCard & {
    unit: string | null;
    availabilityLabel: string;
    taxLabel: string;
    related: StorefrontProductCard[];
    presentation: StorefrontProductPresentation;
  };
}

export interface CheckoutContactInput {
  name: string;
  email: string;
  phone?: string | null;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface StoreCheckoutInput {
  storeSlug: string;
  contact: CheckoutContactInput;
  items: CheckoutItemInput[];
  paymentOption: "pay_now" | "pay_later";
  shippingMethodCode: string;
  notes?: string | null;
}

export interface StoreCheckoutResult {
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  salesOrderId: string;
  paymentTransactionId: string;
  paymentState: "paid" | "pending" | "processing";
  redirectUrl: string | null;
}

export interface PortalAccountSummary {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
  orders: PortalOrderSummary[];
  invoices: PortalInvoiceSummary[];
  credits: PortalCreditSummary[];
  recentPayments: PortalPaymentSummary[];
  availableCredit: number;
  totalDue: number;
  currency: string;
  latestShippingAddress: {
    line1: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

export interface PortalOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  total: number;
  currency: string;
  paymentMethod: string | null;
  paymentState: "paid" | "pending";
  invoiceId: string | null;
  fulfillmentType: StorefrontFulfillmentType;
  shippingMethodLabel: string | null;
}

export interface PortalInvoiceSummary {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
}

export interface PortalCreditSummary {
  id: string;
  creditNoteNumber: string;
  issueDate: string;
  status: string;
  total: number;
  allocated: number;
  currency: string;
}

export interface PortalPaymentSummary {
  id: string;
  paidAt: string;
  amount: number;
  method: string;
  reference: string | null;
}

export interface PortalOrderDetail {
  shell: StorefrontShell;
  account: PortalAccountSummary["customer"] | null;
  order: PortalOrderSummary & {
    subtotal: number;
    shippingTotal: number;
    taxTotal: number;
    shippingAddress: {
      line1: string | null;
      city: string | null;
      postalCode: string | null;
      country: string | null;
    };
    shippingMethodLabel: string | null;
    shippingEta: string | null;
    fulfillmentType: StorefrontFulfillmentType;
    canRetryPayment: boolean;
    items: Array<{
      id: string;
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      productKey: string | null;
    }>;
    invoice: PortalInvoiceSummary | null;
  };
}

export interface PortalAccessInput {
  storeSlug: string;
  email: string;
  orderNumber: string;
  postalCode: string;
}

export interface PortalAccessResult {
  ok: true;
}

export interface PortalInvoicePaymentInput {
  storeSlug: string;
  invoiceId: string;
}

export interface PortalInvoicePaymentResult {
  ok: true;
  invoiceId: string;
  redirectUrl: string | null;
}

export interface StoreDesignSetup {
  companyId: string;
  companyName: string;
  currency: string;
  storeUrl: string;
  previewUrl: string | null;
  previewExpiresAt: string | null;
  previewActive: boolean;
  canEditAdvanced: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  draftSavedAt: string | null;
  draftSavedBy: string | null;
  published: StoreDesignConfig;
  draft: StoreDesignConfig;
  hasUnpublishedChanges: boolean;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    isPublished: boolean;
    imageUrl: string | null;
    categoryName: string | null;
    price: number;
    presentation: StorefrontProductPresentation;
  }>;
}

export interface StorefrontSetupSettings {
  onlineStoreEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  paymentProvider: StorefrontPaymentProviderSummary;
  storeSlug: string;
  storeDisplayName: string;
  storeTagline: string;
  storeSupportEmail: string;
  storeContactPhone: string;
  storeAnnouncement: string;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  guestCheckoutEnabled: boolean;
  shippingMethods: StorefrontShippingMethod[];
}

export interface StorefrontSetupData {
  companyName: string;
  currency: string;
  storeUrl: string;
  settings: StorefrontSetupSettings;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    isPublished: boolean;
    imageUrl: string | null;
    price: number;
    categoryName: string | null;
  }>;
}

export interface StorefrontCheckoutContext {
  shell: StorefrontShell;
  availableShippingMethods: ResolvedStorefrontShippingMethod[];
}
