export type StoreThemePresetId =
  | "clean-retail"
  | "premium-brand"
  | "b2b-catalog"
  | "fast-commerce"
  | "minimal-boutique";

export type StoreBorderRadius = "rounded" | "soft" | "sharp";
export type StoreFontPairing = "modern-sans" | "editorial-serif" | "catalog-utility";
export type StoreButtonStyle = "pill" | "soft-square" | "underline";
export type StoreCardStyle = "elevated" | "outline" | "flat";
export type StoreBadgeStyle = "pill" | "outline" | "solid";
export type StoreInputStyle = "soft" | "outline" | "underline";
export type StoreImageStyle = "rounded" | "soft" | "square";
export type StoreSpacingDensity = "comfortable" | "compact";
export type StoreHeaderDensity = "comfortable" | "compact";
export type StoreLogoAlignment = "left" | "center";
export type StoreNavigationStyle = "pill" | "underline" | "minimal";
export type StoreFooterStyle = "columns" | "minimal";
export type StoreHomepageLayout = "immersive" | "editorial" | "catalog";
export type StoreCatalogDensity = "comfortable" | "compact";
export type StoreCatalogLayout = "chips" | "sidebar" | "minimal";
export type StoreProductLayout = "split" | "editorial" | "stacked";
export type StoreProductCardStyle = "editorial" | "minimal" | "dense";
export type StorePriceEmphasis = "balanced" | "strong";
export type StoreQuantitySelectorStyle = "stepper" | "inline";
export type StoreCartSummaryStyle = "card" | "split";
export type StoreCheckoutProgressStyle = "pills" | "bar";
export type StoreAccountStyle = "tiles" | "list";
export type StoreTrustBlockStyle = "cards" | "inline";

export type HomeSectionId =
  | "hero"
  | "featured_categories"
  | "featured_products"
  | "promo_banner"
  | "trust_block"
  | "testimonials"
  | "faq"
  | "newsletter";

export interface StoreDesignConfig {
  preset: StoreThemePresetId;
  brand: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    canvasColor: string;
    surfaceColor: string;
    fontPairing: StoreFontPairing;
    buttonStyle: StoreButtonStyle;
    cardStyle: StoreCardStyle;
    borderRadius: StoreBorderRadius;
    spacingDensity: StoreSpacingDensity;
    imageStyle: StoreImageStyle;
    badgeStyle: StoreBadgeStyle;
    inputStyle: StoreInputStyle;
  };
  layout: {
    homepageLayout: StoreHomepageLayout;
    catalogLayout: StoreCatalogLayout;
    catalogDensity: StoreCatalogDensity;
    productLayout: StoreProductLayout;
    stickyHeader: boolean;
    headerDensity: StoreHeaderDensity;
    logoAlignment: StoreLogoAlignment;
    navigationStyle: StoreNavigationStyle;
    footerStyle: StoreFooterStyle;
    showAnnouncementBar: boolean;
    showSupportStrip: boolean;
    showPaymentStrip: boolean;
    showAccountLink: boolean;
    showCartLink: boolean;
  };
  pages: {
    homeSections: HomeSectionId[];
    heroEyebrow: string;
    heroTitle: string;
    heroBody: string;
    heroPrimaryCta: string;
    heroSecondaryCta: string;
    featuredCategoriesTitle: string;
    featuredProductsTitle: string;
    promoTitle: string;
    promoBody: string;
    trustTitle: string;
    trustItems: string[];
    testimonialQuote: string;
    testimonialAuthor: string;
    faqItems: Array<{ question: string; answer: string }>;
    newsletterTitle: string;
    newsletterBody: string;
  };
  commerce: {
    productCardStyle: StoreProductCardStyle;
    priceEmphasis: StorePriceEmphasis;
    stockBadgeVisibility: boolean;
    quantitySelectorStyle: StoreQuantitySelectorStyle;
    cartSummaryStyle: StoreCartSummaryStyle;
    checkoutProgressStyle: StoreCheckoutProgressStyle;
    accountStyle: StoreAccountStyle;
    trustBlockStyle: StoreTrustBlockStyle;
  };
  advanced: {
    customCss: string;
  };
}

export interface StorefrontProductPresentation {
  shortCopy: string;
  highlights: string[];
  badge: string;
  gallery: string[];
  relatedProductIds: string[];
  seoTitle: string;
  seoDescription: string;
  shippingNote: string;
  trustNote: string;
}

export const HOME_SECTION_OPTIONS: Array<{ id: HomeSectionId; label: string }> = [
  { id: "hero", label: "Hero" },
  { id: "featured_categories", label: "Featured categories" },
  { id: "featured_products", label: "Featured products" },
  { id: "promo_banner", label: "Promotional banner" },
  { id: "trust_block", label: "Trust block" },
  { id: "testimonials", label: "Testimonials" },
  { id: "faq", label: "FAQ" },
  { id: "newsletter", label: "Newsletter" },
];

export const STORE_THEME_PRESETS: Array<{
  id: StoreThemePresetId;
  label: string;
  description: string;
  mood: string;
  defaults: StoreDesignConfig;
}> = [
  {
    id: "clean-retail",
    label: "Clean Retail",
    description: "Balanced, modern retail with polished cards and conversion-first defaults.",
    mood: "Bright merchandising, clear pricing, and comfortable browsing density.",
    defaults: {
      preset: "clean-retail",
      brand: {
        primaryColor: "#0f172a",
        secondaryColor: "#e2e8f0",
        accentColor: "#0f766e",
        canvasColor: "#f8fafc",
        surfaceColor: "#ffffff",
        fontPairing: "modern-sans",
        buttonStyle: "pill",
        cardStyle: "elevated",
        borderRadius: "rounded",
        spacingDensity: "comfortable",
        imageStyle: "soft",
        badgeStyle: "pill",
        inputStyle: "soft",
      },
      layout: {
        homepageLayout: "immersive",
        catalogLayout: "chips",
        catalogDensity: "comfortable",
        productLayout: "split",
        stickyHeader: true,
        headerDensity: "comfortable",
        logoAlignment: "left",
        navigationStyle: "pill",
        footerStyle: "columns",
        showAnnouncementBar: true,
        showSupportStrip: true,
        showPaymentStrip: true,
        showAccountLink: true,
        showCartLink: true,
      },
      pages: {
        homeSections: [
          "hero",
          "featured_categories",
          "featured_products",
          "promo_banner",
          "trust_block",
          "testimonials",
          "faq",
        ],
        heroEyebrow: "ERP-connected commerce",
        heroTitle: "A storefront that feels premium without disconnecting from operations.",
        heroBody:
          "Publish products faster, keep checkout simple, and let orders flow cleanly into sales, inventory, payments, and customer accounts.",
        heroPrimaryCta: "Shop now",
        heroSecondaryCta: "Access account",
        featuredCategoriesTitle: "Browse by collection",
        featuredProductsTitle: "Popular right now",
        promoTitle: "Faster than the usual ERP storefront setup",
        promoBody:
          "Theme presets, design tokens, and safe defaults keep launch work focused on selling instead of website plumbing.",
        trustTitle: "Why customers trust this store",
        trustItems: ["ERP-backed stock", "Transparent tax totals", "Customer-safe invoices and statements"],
        testimonialQuote:
          "We finally got a storefront that looks modern and still behaves like part of the business.",
        testimonialAuthor: "Independent retailer",
        faqItems: [
          {
            question: "When is stock updated?",
            answer: "Published availability is tied to the same inventory records the team uses internally.",
          },
          {
            question: "Can I pay later?",
            answer: "Merchants can offer invoice-first checkout and keep balances visible in the customer account.",
          },
        ],
        newsletterTitle: "Stay close to new drops",
        newsletterBody: "Use this block as a simple announcement capture area until deeper marketing tools are added.",
      },
      commerce: {
        productCardStyle: "editorial",
        priceEmphasis: "balanced",
        stockBadgeVisibility: true,
        quantitySelectorStyle: "stepper",
        cartSummaryStyle: "card",
        checkoutProgressStyle: "pills",
        accountStyle: "tiles",
        trustBlockStyle: "cards",
      },
      advanced: {
        customCss: "",
      },
    },
  },
  {
    id: "premium-brand",
    label: "Premium Brand",
    description: "Editorial, high-contrast design for aspirational brands and curated catalogues.",
    mood: "Sharper storytelling, more product focus, more contrast.",
    defaults: {
      preset: "premium-brand",
      brand: {
        primaryColor: "#111827",
        secondaryColor: "#f5f5f4",
        accentColor: "#b45309",
        canvasColor: "#f8f5f1",
        surfaceColor: "#fffdf8",
        fontPairing: "editorial-serif",
        buttonStyle: "soft-square",
        cardStyle: "elevated",
        borderRadius: "soft",
        spacingDensity: "comfortable",
        imageStyle: "rounded",
        badgeStyle: "solid",
        inputStyle: "outline",
      },
      layout: {
        homepageLayout: "editorial",
        catalogLayout: "minimal",
        catalogDensity: "comfortable",
        productLayout: "editorial",
        stickyHeader: true,
        headerDensity: "comfortable",
        logoAlignment: "center",
        navigationStyle: "underline",
        footerStyle: "columns",
        showAnnouncementBar: true,
        showSupportStrip: true,
        showPaymentStrip: true,
        showAccountLink: true,
        showCartLink: true,
      },
      pages: {
        homeSections: [
          "hero",
          "promo_banner",
          "featured_products",
          "trust_block",
          "testimonials",
          "faq",
        ],
        heroEyebrow: "Curated online retail",
        heroTitle: "Premium storefront styling without a heavyweight website builder.",
        heroBody:
          "Bring brand personality into catalogue, checkout, and account pages while keeping sales and accounting tightly connected.",
        heroPrimaryCta: "Explore catalogue",
        heroSecondaryCta: "View account",
        featuredCategoriesTitle: "Collections",
        featuredProductsTitle: "Curated picks",
        promoTitle: "Design once, stay consistent through checkout",
        promoBody:
          "Theme presets and tokens carry the same visual system from browse to buy to post-purchase service.",
        trustTitle: "Thoughtful details",
        trustItems: ["Refined product pages", "Consistent account experience", "Safe design controls"],
        testimonialQuote:
          "It feels like a purpose-built commerce brand, not an ERP bolted onto a website.",
        testimonialAuthor: "DTC merchant",
        faqItems: [
          {
            question: "Can I preview before going live?",
            answer: "Draft and published configurations stay separate so you can preview safely first.",
          },
          {
            question: "Will theme switching break content?",
            answer: "Presets keep the same store content and only change the design defaults around it.",
          },
        ],
        newsletterTitle: "Keep customers close",
        newsletterBody: "Use this section as a brand-forward closing CTA while deeper automation is still out of scope.",
      },
      commerce: {
        productCardStyle: "minimal",
        priceEmphasis: "strong",
        stockBadgeVisibility: true,
        quantitySelectorStyle: "inline",
        cartSummaryStyle: "split",
        checkoutProgressStyle: "bar",
        accountStyle: "tiles",
        trustBlockStyle: "cards",
      },
      advanced: {
        customCss: "",
      },
    },
  },
  {
    id: "b2b-catalog",
    label: "B2B Catalog",
    description: "Dense, trustworthy catalogue styling for wholesale and quote-heavy merchants.",
    mood: "Clarity, specification visibility, and faster scanning.",
    defaults: {
      preset: "b2b-catalog",
      brand: {
        primaryColor: "#1f2937",
        secondaryColor: "#dbe4ee",
        accentColor: "#2563eb",
        canvasColor: "#f3f6fb",
        surfaceColor: "#ffffff",
        fontPairing: "catalog-utility",
        buttonStyle: "soft-square",
        cardStyle: "outline",
        borderRadius: "soft",
        spacingDensity: "compact",
        imageStyle: "square",
        badgeStyle: "outline",
        inputStyle: "outline",
      },
      layout: {
        homepageLayout: "catalog",
        catalogLayout: "sidebar",
        catalogDensity: "compact",
        productLayout: "split",
        stickyHeader: true,
        headerDensity: "compact",
        logoAlignment: "left",
        navigationStyle: "minimal",
        footerStyle: "columns",
        showAnnouncementBar: true,
        showSupportStrip: true,
        showPaymentStrip: false,
        showAccountLink: true,
        showCartLink: true,
      },
      pages: {
        homeSections: ["hero", "featured_categories", "featured_products", "trust_block", "faq"],
        heroEyebrow: "B2B-ready ordering",
        heroTitle: "A catalogue-first storefront that stays tied to invoices, balances, and fulfilment.",
        heroBody:
          "Help customers scan products quickly, trust availability, and move into invoice-first ordering without friction.",
        heroPrimaryCta: "Browse catalogue",
        heroSecondaryCta: "Open account",
        featuredCategoriesTitle: "Popular categories",
        featuredProductsTitle: "Top ordered lines",
        promoTitle: "Built for repeat buyers",
        promoBody:
          "Dense catalogue defaults, clearer spec messaging, and a customer account that supports statements and outstanding balances.",
        trustTitle: "Operational confidence",
        trustItems: ["Invoice-first ordering", "Clear customer balances", "Linked order and document history"],
        testimonialQuote:
          "Our customers get what they need quickly, and our ops team never loses the ERP trail.",
        testimonialAuthor: "Wholesale distributor",
        faqItems: [
          {
            question: "Can customers pay later?",
            answer: "Yes. Invoice-first checkout flows straight into the receivables lifecycle already in the ERP.",
          },
          {
            question: "Can staff still trace online orders?",
            answer: "Store orders remain linked to sales orders, invoices, payments, and stock movements.",
          },
        ],
        newsletterTitle: "Account-based updates",
        newsletterBody: "Reserve this area for account-driven notices and lead capture messaging.",
      },
      commerce: {
        productCardStyle: "dense",
        priceEmphasis: "balanced",
        stockBadgeVisibility: true,
        quantitySelectorStyle: "inline",
        cartSummaryStyle: "split",
        checkoutProgressStyle: "bar",
        accountStyle: "list",
        trustBlockStyle: "inline",
      },
      advanced: {
        customCss: "",
      },
    },
  },
  {
    id: "fast-commerce",
    label: "Essentials / Fast Commerce",
    description: "Lean, high-speed defaults for merchants who want to launch fast with minimal setup.",
    mood: "Conversion-first, highly legible, and compact.",
    defaults: {
      preset: "fast-commerce",
      brand: {
        primaryColor: "#0f172a",
        secondaryColor: "#e5eef7",
        accentColor: "#dc2626",
        canvasColor: "#f8fafc",
        surfaceColor: "#ffffff",
        fontPairing: "modern-sans",
        buttonStyle: "pill",
        cardStyle: "outline",
        borderRadius: "soft",
        spacingDensity: "compact",
        imageStyle: "rounded",
        badgeStyle: "solid",
        inputStyle: "soft",
      },
      layout: {
        homepageLayout: "catalog",
        catalogLayout: "chips",
        catalogDensity: "compact",
        productLayout: "split",
        stickyHeader: true,
        headerDensity: "compact",
        logoAlignment: "left",
        navigationStyle: "pill",
        footerStyle: "minimal",
        showAnnouncementBar: true,
        showSupportStrip: false,
        showPaymentStrip: true,
        showAccountLink: true,
        showCartLink: true,
      },
      pages: {
        homeSections: ["hero", "featured_products", "trust_block"],
        heroEyebrow: "Fast launch storefront",
        heroTitle: "Launch quickly with a strong default theme that still feels intentional.",
        heroBody:
          "Designed for merchants who want fewer toggles, cleaner defaults, and a quick path from product publish to live orders.",
        heroPrimaryCta: "Start shopping",
        heroSecondaryCta: "Customer access",
        featuredCategoriesTitle: "Key categories",
        featuredProductsTitle: "Best sellers",
        promoTitle: "Less setup, better defaults",
        promoBody: "Perfect for fast launches and lean teams that still want a polished buying experience.",
        trustTitle: "Simple by design",
        trustItems: ["Quick theme setup", "Fast checkout defaults", "Unified customer account"],
        testimonialQuote:
          "We changed a handful of settings and were live with a store that already felt polished.",
        testimonialAuthor: "Growing SMB",
        faqItems: [
          {
            question: "Do I need a page builder?",
            answer: "No. This phase focuses on guided presets and safe composition instead of free-form layout tools.",
          },
        ],
        newsletterTitle: "Stay informed",
        newsletterBody: "Keep this as a simple follow-up CTA until deeper marketing tools are added.",
      },
      commerce: {
        productCardStyle: "dense",
        priceEmphasis: "strong",
        stockBadgeVisibility: true,
        quantitySelectorStyle: "stepper",
        cartSummaryStyle: "card",
        checkoutProgressStyle: "pills",
        accountStyle: "tiles",
        trustBlockStyle: "inline",
      },
      advanced: {
        customCss: "",
      },
    },
  },
  {
    id: "minimal-boutique",
    label: "Minimal Boutique",
    description: "Warm, quieter styling for boutiques and visually led catalogues.",
    mood: "Minimal, airy, and product-centric.",
    defaults: {
      preset: "minimal-boutique",
      brand: {
        primaryColor: "#1c1917",
        secondaryColor: "#f3ede8",
        accentColor: "#9a3412",
        canvasColor: "#fbf7f2",
        surfaceColor: "#fffdfa",
        fontPairing: "editorial-serif",
        buttonStyle: "underline",
        cardStyle: "flat",
        borderRadius: "rounded",
        spacingDensity: "comfortable",
        imageStyle: "rounded",
        badgeStyle: "outline",
        inputStyle: "underline",
      },
      layout: {
        homepageLayout: "editorial",
        catalogLayout: "minimal",
        catalogDensity: "comfortable",
        productLayout: "stacked",
        stickyHeader: false,
        headerDensity: "comfortable",
        logoAlignment: "center",
        navigationStyle: "underline",
        footerStyle: "minimal",
        showAnnouncementBar: true,
        showSupportStrip: true,
        showPaymentStrip: true,
        showAccountLink: true,
        showCartLink: true,
      },
      pages: {
        homeSections: ["hero", "featured_products", "promo_banner", "testimonials", "faq"],
        heroEyebrow: "Boutique online selling",
        heroTitle: "Quiet design, strong product presentation, and a modern customer account.",
        heroBody:
          "Bring warmth to the storefront while keeping order, payment, and document traceability intact behind the scenes.",
        heroPrimaryCta: "Browse collection",
        heroSecondaryCta: "Returning customer",
        featuredCategoriesTitle: "Collections",
        featuredProductsTitle: "Featured products",
        promoTitle: "Refined visual defaults",
        promoBody: "A boutique-first feel without giving up the operational backbone of the ERP.",
        trustTitle: "Designed for confidence",
        trustItems: ["Polished detail pages", "Unified account experience", "Safe publish workflow"],
        testimonialQuote:
          "It feels like a modern boutique storefront, but every order still lands exactly where our ops team needs it.",
        testimonialAuthor: "Independent brand",
        faqItems: [
          {
            question: "Will the account area match the store?",
            answer: "Yes. The same published design tokens carry through checkout and customer account views.",
          },
        ],
        newsletterTitle: "Join the next release",
        newsletterBody: "Use this as a softer call-to-action until fuller CRM automation is added.",
      },
      commerce: {
        productCardStyle: "minimal",
        priceEmphasis: "balanced",
        stockBadgeVisibility: true,
        quantitySelectorStyle: "stepper",
        cartSummaryStyle: "card",
        checkoutProgressStyle: "pills",
        accountStyle: "tiles",
        trustBlockStyle: "cards",
      },
      advanced: {
        customCss: "",
      },
    },
  },
];

const themePresetMap = new Map(STORE_THEME_PRESETS.map((preset) => [preset.id, preset]));

export function createDefaultStoreDesign(
  presetId: StoreThemePresetId = "clean-retail",
): StoreDesignConfig {
  return structuredClone(
    themePresetMap.get(presetId)?.defaults ?? themePresetMap.get("clean-retail")!.defaults,
  );
}

export function createDefaultProductPresentation(): StorefrontProductPresentation {
  return {
    shortCopy: "",
    highlights: [],
    badge: "",
    gallery: [],
    relatedProductIds: [],
    seoTitle: "",
    seoDescription: "",
    shippingNote: "",
    trustNote: "",
  };
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((entry): entry is string => typeof entry === "string");
}

function faqItems(
  value: unknown,
  fallback: Array<{ question: string; answer: string }>,
) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      return {
        question: text(row.question),
        answer: text(row.answer),
      };
    })
    .filter((entry): entry is { question: string; answer: string } => !!entry);
}

function hasKey<T extends string>(value: unknown, options: readonly T[], fallback: T) {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

export function normalizeStoreDesign(input: unknown): StoreDesignConfig {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const preset = hasKey(
    raw.preset,
    STORE_THEME_PRESETS.map((item) => item.id) as StoreThemePresetId[],
    "clean-retail",
  );
  const defaults = createDefaultStoreDesign(preset);
  const brand = raw.brand && typeof raw.brand === "object" ? (raw.brand as Record<string, unknown>) : {};
  const layout =
    raw.layout && typeof raw.layout === "object" ? (raw.layout as Record<string, unknown>) : {};
  const pages = raw.pages && typeof raw.pages === "object" ? (raw.pages as Record<string, unknown>) : {};
  const commerce =
    raw.commerce && typeof raw.commerce === "object"
      ? (raw.commerce as Record<string, unknown>)
      : {};
  const advanced =
    raw.advanced && typeof raw.advanced === "object"
      ? (raw.advanced as Record<string, unknown>)
      : {};

  return {
    preset,
    brand: {
      primaryColor: text(brand.primaryColor, defaults.brand.primaryColor),
      secondaryColor: text(brand.secondaryColor, defaults.brand.secondaryColor),
      accentColor: text(brand.accentColor, defaults.brand.accentColor),
      canvasColor: text(brand.canvasColor, defaults.brand.canvasColor),
      surfaceColor: text(brand.surfaceColor, defaults.brand.surfaceColor),
      fontPairing: hasKey(
        brand.fontPairing,
        ["modern-sans", "editorial-serif", "catalog-utility"] as const,
        defaults.brand.fontPairing,
      ),
      buttonStyle: hasKey(
        brand.buttonStyle,
        ["pill", "soft-square", "underline"] as const,
        defaults.brand.buttonStyle,
      ),
      cardStyle: hasKey(
        brand.cardStyle,
        ["elevated", "outline", "flat"] as const,
        defaults.brand.cardStyle,
      ),
      borderRadius: hasKey(
        brand.borderRadius,
        ["rounded", "soft", "sharp"] as const,
        defaults.brand.borderRadius,
      ),
      spacingDensity: hasKey(
        brand.spacingDensity,
        ["comfortable", "compact"] as const,
        defaults.brand.spacingDensity,
      ),
      imageStyle: hasKey(
        brand.imageStyle,
        ["rounded", "soft", "square"] as const,
        defaults.brand.imageStyle,
      ),
      badgeStyle: hasKey(
        brand.badgeStyle,
        ["pill", "outline", "solid"] as const,
        defaults.brand.badgeStyle,
      ),
      inputStyle: hasKey(
        brand.inputStyle,
        ["soft", "outline", "underline"] as const,
        defaults.brand.inputStyle,
      ),
    },
    layout: {
      homepageLayout: hasKey(
        layout.homepageLayout,
        ["immersive", "editorial", "catalog"] as const,
        defaults.layout.homepageLayout,
      ),
      catalogLayout: hasKey(
        layout.catalogLayout,
        ["chips", "sidebar", "minimal"] as const,
        defaults.layout.catalogLayout,
      ),
      catalogDensity: hasKey(
        layout.catalogDensity,
        ["comfortable", "compact"] as const,
        defaults.layout.catalogDensity,
      ),
      productLayout: hasKey(
        layout.productLayout,
        ["split", "editorial", "stacked"] as const,
        defaults.layout.productLayout,
      ),
      stickyHeader: bool(layout.stickyHeader, defaults.layout.stickyHeader),
      headerDensity: hasKey(
        layout.headerDensity,
        ["comfortable", "compact"] as const,
        defaults.layout.headerDensity,
      ),
      logoAlignment: hasKey(
        layout.logoAlignment,
        ["left", "center"] as const,
        defaults.layout.logoAlignment,
      ),
      navigationStyle: hasKey(
        layout.navigationStyle,
        ["pill", "underline", "minimal"] as const,
        defaults.layout.navigationStyle,
      ),
      footerStyle: hasKey(
        layout.footerStyle,
        ["columns", "minimal"] as const,
        defaults.layout.footerStyle,
      ),
      showAnnouncementBar: bool(
        layout.showAnnouncementBar,
        defaults.layout.showAnnouncementBar,
      ),
      showSupportStrip: bool(layout.showSupportStrip, defaults.layout.showSupportStrip),
      showPaymentStrip: bool(layout.showPaymentStrip, defaults.layout.showPaymentStrip),
      showAccountLink: bool(layout.showAccountLink, defaults.layout.showAccountLink),
      showCartLink: bool(layout.showCartLink, defaults.layout.showCartLink),
    },
    pages: {
      homeSections: stringArray(pages.homeSections, defaults.pages.homeSections).filter(
        (entry): entry is HomeSectionId =>
          HOME_SECTION_OPTIONS.some((option) => option.id === entry),
      ),
      heroEyebrow: text(pages.heroEyebrow, defaults.pages.heroEyebrow),
      heroTitle: text(pages.heroTitle, defaults.pages.heroTitle),
      heroBody: text(pages.heroBody, defaults.pages.heroBody),
      heroPrimaryCta: text(pages.heroPrimaryCta, defaults.pages.heroPrimaryCta),
      heroSecondaryCta: text(pages.heroSecondaryCta, defaults.pages.heroSecondaryCta),
      featuredCategoriesTitle: text(
        pages.featuredCategoriesTitle,
        defaults.pages.featuredCategoriesTitle,
      ),
      featuredProductsTitle: text(
        pages.featuredProductsTitle,
        defaults.pages.featuredProductsTitle,
      ),
      promoTitle: text(pages.promoTitle, defaults.pages.promoTitle),
      promoBody: text(pages.promoBody, defaults.pages.promoBody),
      trustTitle: text(pages.trustTitle, defaults.pages.trustTitle),
      trustItems: stringArray(pages.trustItems, defaults.pages.trustItems),
      testimonialQuote: text(pages.testimonialQuote, defaults.pages.testimonialQuote),
      testimonialAuthor: text(pages.testimonialAuthor, defaults.pages.testimonialAuthor),
      faqItems: faqItems(pages.faqItems, defaults.pages.faqItems),
      newsletterTitle: text(pages.newsletterTitle, defaults.pages.newsletterTitle),
      newsletterBody: text(pages.newsletterBody, defaults.pages.newsletterBody),
    },
    commerce: {
      productCardStyle: hasKey(
        commerce.productCardStyle,
        ["editorial", "minimal", "dense"] as const,
        defaults.commerce.productCardStyle,
      ),
      priceEmphasis: hasKey(
        commerce.priceEmphasis,
        ["balanced", "strong"] as const,
        defaults.commerce.priceEmphasis,
      ),
      stockBadgeVisibility: bool(
        commerce.stockBadgeVisibility,
        defaults.commerce.stockBadgeVisibility,
      ),
      quantitySelectorStyle: hasKey(
        commerce.quantitySelectorStyle,
        ["stepper", "inline"] as const,
        defaults.commerce.quantitySelectorStyle,
      ),
      cartSummaryStyle: hasKey(
        commerce.cartSummaryStyle,
        ["card", "split"] as const,
        defaults.commerce.cartSummaryStyle,
      ),
      checkoutProgressStyle: hasKey(
        commerce.checkoutProgressStyle,
        ["pills", "bar"] as const,
        defaults.commerce.checkoutProgressStyle,
      ),
      accountStyle: hasKey(
        commerce.accountStyle,
        ["tiles", "list"] as const,
        defaults.commerce.accountStyle,
      ),
      trustBlockStyle: hasKey(
        commerce.trustBlockStyle,
        ["cards", "inline"] as const,
        defaults.commerce.trustBlockStyle,
      ),
    },
    advanced: {
      customCss: text(advanced.customCss, ""),
    },
  };
}

export function normalizeProductPresentation(input: unknown): StorefrontProductPresentation {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const defaults = createDefaultProductPresentation();
  return {
    shortCopy: text(raw.shortCopy, defaults.shortCopy),
    highlights: stringArray(raw.highlights, defaults.highlights),
    badge: text(raw.badge, defaults.badge),
    gallery: stringArray(raw.gallery, defaults.gallery),
    relatedProductIds: stringArray(raw.relatedProductIds, defaults.relatedProductIds),
    seoTitle: text(raw.seoTitle, defaults.seoTitle),
    seoDescription: text(raw.seoDescription, defaults.seoDescription),
    shippingNote: text(raw.shippingNote, defaults.shippingNote),
    trustNote: text(raw.trustNote, defaults.trustNote),
  };
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const safe = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized;
  const parsed = parseInt(safe, 16);
  if (!Number.isFinite(parsed) || safe.length !== 6) return "15, 23, 42";
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `${r}, ${g}, ${b}`;
}

export function storefrontThemeStyleVars(config: StoreDesignConfig) {
  const radius =
    config.brand.borderRadius === "rounded"
      ? { card: "32px", soft: "24px", pill: "999px", image: "28px" }
      : config.brand.borderRadius === "soft"
        ? { card: "24px", soft: "18px", pill: "18px", image: "20px" }
        : { card: "12px", soft: "10px", pill: "10px", image: "12px" };
  const cardShadow =
    config.brand.cardStyle === "elevated"
      ? "0 28px 70px rgba(15,23,42,0.10)"
      : config.brand.cardStyle === "outline"
        ? "0 10px 26px rgba(15,23,42,0.04)"
        : "0 6px 18px rgba(15,23,42,0.03)";

  const inputBorder =
    config.brand.inputStyle === "underline" ? "0 0 0 rgba(0,0,0,0)" : config.brand.secondaryColor;

  const headingFont =
    config.brand.fontPairing === "editorial-serif"
      ? '"Georgia", "Times New Roman", serif'
      : config.brand.fontPairing === "catalog-utility"
        ? '"Inter", "Segoe UI", system-ui, sans-serif'
        : '"Inter", "Segoe UI", system-ui, sans-serif';

  const bodyFont =
    config.brand.fontPairing === "editorial-serif"
      ? '"Inter", "Segoe UI", system-ui, sans-serif'
      : '"Inter", "Segoe UI", system-ui, sans-serif';

  return {
    "--store-primary": config.brand.primaryColor,
    "--store-secondary": config.brand.secondaryColor,
    "--store-accent": config.brand.accentColor,
    "--store-canvas": config.brand.canvasColor,
    "--store-surface": config.brand.surfaceColor,
    "--store-primary-rgb": hexToRgb(config.brand.primaryColor),
    "--store-secondary-rgb": hexToRgb(config.brand.secondaryColor),
    "--store-accent-rgb": hexToRgb(config.brand.accentColor),
    "--store-radius-card": radius.card,
    "--store-radius-soft": radius.soft,
    "--store-radius-pill": radius.pill,
    "--store-radius-image": config.brand.imageStyle === "square" ? "12px" : radius.image,
    "--store-shadow-card": cardShadow,
    "--store-spacing": config.brand.spacingDensity === "compact" ? "0.85rem" : "1.15rem",
    "--store-heading-font": headingFont,
    "--store-body-font": bodyFont,
    "--store-input-border": inputBorder,
  } satisfies Record<string, string>;
}

export function storeDesignHasUnpublishedChanges(
  draft: StoreDesignConfig,
  published: StoreDesignConfig,
) {
  return JSON.stringify(draft) !== JSON.stringify(published);
}
