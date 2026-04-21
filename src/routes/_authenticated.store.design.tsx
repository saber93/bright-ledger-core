import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Monitor, Paintbrush2, Save, Smartphone, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StoreDesignPreview } from "@/components/storefront/StoreDesignPreview";
import {
  HOME_SECTION_OPTIONS,
  STORE_THEME_PRESETS,
  createDefaultProductPresentation,
  createDefaultStoreDesign,
  type HomeSectionId,
  type StoreDesignConfig,
  type StorefrontProductPresentation,
} from "@/features/storefront/design";
import { useStoreDesign, useSaveStoreDesign } from "@/features/storefront/hooks";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/store/design")({
  component: StoreDesignPage,
});

function StoreDesignPage() {
  const { companyId } = useAuth();
  const finance = useFinancePermissions();
  const query = useStoreDesign(companyId);
  const save = useSaveStoreDesign();
  const [tab, setTab] = useState("brand");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [draft, setDraft] = useState<StoreDesignConfig>(createDefaultStoreDesign());
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productPresentation, setProductPresentation] = useState<StorefrontProductPresentation>(
    createDefaultProductPresentation(),
  );
  const [productPublished, setProductPublished] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setDraft(query.data.draft);
    setPreviewLink(query.data.previewUrl);
    if (!selectedProductId && query.data.products[0]) {
      setSelectedProductId(query.data.products[0].id);
    }
  }, [query.data, selectedProductId]);

  const selectedProduct = useMemo(
    () => query.data?.products.find((product) => product.id === selectedProductId) ?? null,
    [query.data, selectedProductId],
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setProductPresentation(selectedProduct.presentation);
    setProductPublished(selectedProduct.isPublished);
  }, [selectedProduct]);

  if (!companyId) {
    return <div className="py-10 text-sm text-muted-foreground">Loading company…</div>;
  }

  if (query.isLoading) {
    return <div className="py-10 text-sm text-muted-foreground">Loading store design…</div>;
  }

  if (query.error || !query.data) {
    return (
      <div className="py-10 text-sm text-muted-foreground">
        Store design could not be loaded.
      </div>
    );
  }

  const data = query.data;

  async function saveDraft() {
    try {
      await save.mutateAsync({
        companyId,
        action: "save_draft",
        draft,
      });
      toast.success("Store design draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save store design");
    }
  }

  async function publishDraft() {
    try {
      await save.mutateAsync({
        companyId,
        action: "save_draft",
        draft,
      });
      await save.mutateAsync({
        companyId,
        action: "publish",
      });
      toast.success("Store design published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish store design");
    }
  }

  async function revertDraft() {
    try {
      const response = await save.mutateAsync({
        companyId,
        action: "revert",
      });
      setDraft(response.draft);
      toast.success("Draft reverted to last published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revert draft");
    }
  }

  async function saveSelectedProduct() {
    if (!selectedProductId) return;
    try {
      await save.mutateAsync({
        companyId,
        action: "save_product_presentation",
        productId: selectedProductId,
        isPublished: productPublished,
        presentation: productPresentation,
      });
      toast.success("Product online presentation saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save product presentation");
    }
  }

  async function createPreviewLink() {
    try {
      await save.mutateAsync({
        companyId,
        action: "save_draft",
        draft,
      });
      const response = await save.mutateAsync({
        companyId,
        action: "create_preview_link",
      });
      setPreviewLink(response.previewUrl);
      toast.success("Draft preview link generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create preview link");
    }
  }

  async function revokePreviewLink() {
    try {
      const response = await save.mutateAsync({
        companyId,
        action: "revoke_preview_link",
      });
      setPreviewLink(response.previewUrl);
      toast.success("Draft preview link revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke preview link");
    }
  }

  function moveHomeSection(sectionId: HomeSectionId, direction: -1 | 1) {
    setDraft((current) => {
      const sections = [...current.pages.homeSections];
      const index = sections.indexOf(sectionId);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= sections.length) return current;
      const [section] = sections.splice(index, 1);
      sections.splice(nextIndex, 0, section);
      return {
        ...current,
        pages: {
          ...current.pages,
          homeSections: sections,
        },
      };
    });
  }

  function toggleHomeSection(sectionId: HomeSectionId) {
    setDraft((current) => {
      const enabled = current.pages.homeSections.includes(sectionId);
      return {
        ...current,
        pages: {
          ...current.pages,
          homeSections: enabled
            ? current.pages.homeSections.filter((entry) => entry !== sectionId)
            : [...current.pages.homeSections, sectionId],
        },
      };
    });
  }

  return (
    <div>
      <PageHeader
        title="Store Design"
        description="Theme presets, brand tokens, page composition, and product presentation in one commerce-first workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/store/setup">Store setup</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={data.storeUrl}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open published store
              </a>
            </Button>
            <Button variant="outline" onClick={() => void createPreviewLink()} disabled={save.isPending}>
              Draft preview
            </Button>
            <Button variant="outline" onClick={() => void revertDraft()} disabled={save.isPending}>
              Revert
            </Button>
            <Button variant="outline" onClick={() => void saveDraft()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button onClick={() => void publishDraft()} disabled={save.isPending}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Publish
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {STORE_THEME_PRESETS.find((preset) => preset.id === draft.preset)?.label}
        </Badge>
        <Badge variant={data.hasUnpublishedChanges ? "outline" : "secondary"} className="rounded-full px-3 py-1">
          {data.hasUnpublishedChanges ? "Unpublished changes" : "Published in sync"}
        </Badge>
        {data.publishedAt ? (
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Published {new Date(data.publishedAt).toLocaleString()}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Why this is easier</div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  Design the whole commerce surface without a sprawling website builder
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Theme, brand, layout, storefront pages, checkout styling, customer account visuals,
                  and product online presentation all stay together here.
                </p>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <Paintbrush2 className="h-5 w-5" />
              </div>
            </div>
          </section>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-[20px] bg-muted/60 p-1">
              <TabsTrigger value="brand">Brand</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="navigation">Navigation</TabsTrigger>
              <TabsTrigger value="commerce">Commerce UI</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="preview">Preview & Publish</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="brand">
              <Panel
                title="Brand tokens"
                description="Apply brand styling across storefront, checkout, and customer account without hand-editing each page."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label="Primary"
                    value={draft.brand.primaryColor}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, primaryColor: value },
                      }))
                    }
                  />
                  <ColorField
                    label="Secondary"
                    value={draft.brand.secondaryColor}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, secondaryColor: value },
                      }))
                    }
                  />
                  <ColorField
                    label="Accent"
                    value={draft.brand.accentColor}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, accentColor: value },
                      }))
                    }
                  />
                  <ColorField
                    label="Canvas"
                    value={draft.brand.canvasColor}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, canvasColor: value },
                      }))
                    }
                  />
                  <ColorField
                    label="Surface"
                    value={draft.brand.surfaceColor}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, surfaceColor: value },
                      }))
                    }
                  />
                  <SelectField
                    label="Typography pairing"
                    value={draft.brand.fontPairing}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, fontPairing: value as StoreDesignConfig["brand"]["fontPairing"] },
                      }))
                    }
                    options={[
                      ["modern-sans", "Modern Sans"],
                      ["editorial-serif", "Editorial Serif"],
                      ["catalog-utility", "Catalog Utility"],
                    ]}
                  />
                  <SelectField
                    label="Button style"
                    value={draft.brand.buttonStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, buttonStyle: value as StoreDesignConfig["brand"]["buttonStyle"] },
                      }))
                    }
                    options={[
                      ["pill", "Pill"],
                      ["soft-square", "Soft Square"],
                      ["underline", "Underline"],
                    ]}
                  />
                  <SelectField
                    label="Card style"
                    value={draft.brand.cardStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, cardStyle: value as StoreDesignConfig["brand"]["cardStyle"] },
                      }))
                    }
                    options={[
                      ["elevated", "Elevated"],
                      ["outline", "Outline"],
                      ["flat", "Flat"],
                    ]}
                  />
                  <SelectField
                    label="Border radius"
                    value={draft.brand.borderRadius}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, borderRadius: value as StoreDesignConfig["brand"]["borderRadius"] },
                      }))
                    }
                    options={[
                      ["rounded", "Rounded"],
                      ["soft", "Soft"],
                      ["sharp", "Sharp"],
                    ]}
                  />
                  <SelectField
                    label="Spacing density"
                    value={draft.brand.spacingDensity}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: {
                          ...current.brand,
                          spacingDensity: value as StoreDesignConfig["brand"]["spacingDensity"],
                        },
                      }))
                    }
                    options={[
                      ["comfortable", "Comfortable"],
                      ["compact", "Compact"],
                    ]}
                  />
                  <SelectField
                    label="Image style"
                    value={draft.brand.imageStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, imageStyle: value as StoreDesignConfig["brand"]["imageStyle"] },
                      }))
                    }
                    options={[
                      ["rounded", "Rounded"],
                      ["soft", "Soft"],
                      ["square", "Square"],
                    ]}
                  />
                  <SelectField
                    label="Badge style"
                    value={draft.brand.badgeStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, badgeStyle: value as StoreDesignConfig["brand"]["badgeStyle"] },
                      }))
                    }
                    options={[
                      ["pill", "Pill"],
                      ["outline", "Outline"],
                      ["solid", "Solid"],
                    ]}
                  />
                  <SelectField
                    label="Input style"
                    value={draft.brand.inputStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        brand: { ...current.brand, inputStyle: value as StoreDesignConfig["brand"]["inputStyle"] },
                      }))
                    }
                    options={[
                      ["soft", "Soft"],
                      ["outline", "Outline"],
                      ["underline", "Underline"],
                    ]}
                  />
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="theme">
              <Panel
                title="Theme presets"
                description="Switch the entire commerce surface between strong preset families, then fine-tune with tokens."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {STORE_THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`rounded-[24px] border p-5 text-left transition ${
                        draft.preset === preset.id
                          ? "border-primary bg-primary/5"
                          : "border-border/70 bg-background hover:border-primary/40"
                      }`}
                      onClick={() =>
                        setDraft((current) => {
                          const next = createDefaultStoreDesign(preset.id);
                          return {
                            ...next,
                            pages: {
                              ...next.pages,
                              homeSections: current.pages.homeSections,
                              heroEyebrow: current.pages.heroEyebrow,
                              heroTitle: current.pages.heroTitle,
                              heroBody: current.pages.heroBody,
                              heroPrimaryCta: current.pages.heroPrimaryCta,
                              heroSecondaryCta: current.pages.heroSecondaryCta,
                              featuredCategoriesTitle: current.pages.featuredCategoriesTitle,
                              featuredProductsTitle: current.pages.featuredProductsTitle,
                              promoTitle: current.pages.promoTitle,
                              promoBody: current.pages.promoBody,
                              trustTitle: current.pages.trustTitle,
                              trustItems: current.pages.trustItems,
                              testimonialQuote: current.pages.testimonialQuote,
                              testimonialAuthor: current.pages.testimonialAuthor,
                              faqItems: current.pages.faqItems,
                              newsletterTitle: current.pages.newsletterTitle,
                              newsletterBody: current.pages.newsletterBody,
                            },
                            advanced: current.advanced,
                          };
                        })
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{preset.label}</div>
                          <div className="mt-2 text-sm text-muted-foreground">{preset.description}</div>
                          <div className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {preset.mood}
                          </div>
                        </div>
                        {draft.preset === preset.id ? <Badge>Current draft</Badge> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="pages">
              <Panel
                title="Controlled page composition"
                description="Enable, reorder, and tune key sections without handing merchants a free-form page builder."
              >
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {HOME_SECTION_OPTIONS.map((section) => {
                      const enabled = draft.pages.homeSections.includes(section.id);
                      return (
                        <div
                          key={section.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/70 bg-background/80 px-4 py-3"
                        >
                          <div>
                            <div className="font-medium">{section.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {enabled ? "Live in the draft homepage flow" : "Currently hidden"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => moveHomeSection(section.id, -1)} disabled={!enabled}>
                              Up
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => moveHomeSection(section.id, 1)} disabled={!enabled}>
                              Down
                            </Button>
                            <Switch checked={enabled} onCheckedChange={() => toggleHomeSection(section.id)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Hero eyebrow">
                      <Input
                        value={draft.pages.heroEyebrow}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, heroEyebrow: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Hero title">
                      <Input
                        value={draft.pages.heroTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, heroTitle: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Hero body" className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={draft.pages.heroBody}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, heroBody: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Featured categories title">
                      <Input
                        value={draft.pages.featuredCategoriesTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, featuredCategoriesTitle: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Featured products title">
                      <Input
                        value={draft.pages.featuredProductsTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, featuredProductsTitle: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Promo title">
                      <Input
                        value={draft.pages.promoTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, promoTitle: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Promo body" className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={draft.pages.promoBody}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, promoBody: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Trust title">
                      <Input
                        value={draft.pages.trustTitle}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, trustTitle: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Trust items (one per line)" className="sm:col-span-2">
                      <Textarea
                        rows={4}
                        value={draft.pages.trustItems.join("\n")}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: {
                              ...current.pages,
                              trustItems: linesToList(event.target.value),
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Testimonial quote" className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={draft.pages.testimonialQuote}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, testimonialQuote: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Testimonial author">
                      <Input
                        value={draft.pages.testimonialAuthor}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: { ...current.pages, testimonialAuthor: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="FAQ items (Question :: Answer per line)" className="sm:col-span-2">
                      <Textarea
                        rows={5}
                        value={draft.pages.faqItems.map((item) => `${item.question} :: ${item.answer}`).join("\n")}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            pages: {
                              ...current.pages,
                              faqItems: parseFaqLines(event.target.value),
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="navigation">
              <Panel
                title="Header, footer, and navigation"
                description="Control structure and visibility without sending merchants into multiple scattered admin screens."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Header density"
                    value={draft.layout.headerDensity}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, headerDensity: value as StoreDesignConfig["layout"]["headerDensity"] },
                      }))
                    }
                    options={[
                      ["comfortable", "Comfortable"],
                      ["compact", "Compact"],
                    ]}
                  />
                  <SelectField
                    label="Logo alignment"
                    value={draft.layout.logoAlignment}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, logoAlignment: value as StoreDesignConfig["layout"]["logoAlignment"] },
                      }))
                    }
                    options={[
                      ["left", "Left"],
                      ["center", "Center"],
                    ]}
                  />
                  <SelectField
                    label="Navigation style"
                    value={draft.layout.navigationStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: {
                          ...current.layout,
                          navigationStyle: value as StoreDesignConfig["layout"]["navigationStyle"],
                        },
                      }))
                    }
                    options={[
                      ["pill", "Pill"],
                      ["underline", "Underline"],
                      ["minimal", "Minimal"],
                    ]}
                  />
                  <SelectField
                    label="Footer style"
                    value={draft.layout.footerStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, footerStyle: value as StoreDesignConfig["layout"]["footerStyle"] },
                      }))
                    }
                    options={[
                      ["columns", "Columns"],
                      ["minimal", "Minimal"],
                    ]}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ToggleTile
                    label="Sticky header"
                    description="Keep navigation fixed while scrolling"
                    checked={draft.layout.stickyHeader}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, stickyHeader: checked },
                      }))
                    }
                  />
                  <ToggleTile
                    label="Announcement bar"
                    description="Show store announcement above the header"
                    checked={draft.layout.showAnnouncementBar}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, showAnnouncementBar: checked },
                      }))
                    }
                  />
                  <ToggleTile
                    label="Support strip"
                    description="Keep support details visible in the footer"
                    checked={draft.layout.showSupportStrip}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, showSupportStrip: checked },
                      }))
                    }
                  />
                  <ToggleTile
                    label="Payment trust strip"
                    description="Show payment/shipping trust messaging in the footer"
                    checked={draft.layout.showPaymentStrip}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, showPaymentStrip: checked },
                      }))
                    }
                  />
                  <ToggleTile
                    label="Account link"
                    description="Show customer account entry in header"
                    checked={draft.layout.showAccountLink}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, showAccountLink: checked },
                      }))
                    }
                  />
                  <ToggleTile
                    label="Cart button"
                    description="Keep cart entry visible in header"
                    checked={draft.layout.showCartLink}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, showCartLink: checked },
                      }))
                    }
                  />
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="commerce">
              <Panel
                title="Commerce UI styling"
                description="Tune how catalogue, PDP, cart, checkout, and account components look without dropping into custom code."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Homepage layout"
                    value={draft.layout.homepageLayout}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: {
                          ...current.layout,
                          homepageLayout: value as StoreDesignConfig["layout"]["homepageLayout"],
                        },
                      }))
                    }
                    options={[
                      ["immersive", "Immersive"],
                      ["editorial", "Editorial"],
                      ["catalog", "Catalog"],
                    ]}
                  />
                  <SelectField
                    label="Catalog filters"
                    value={draft.layout.catalogLayout}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, catalogLayout: value as StoreDesignConfig["layout"]["catalogLayout"] },
                      }))
                    }
                    options={[
                      ["chips", "Chips"],
                      ["sidebar", "Sidebar feel"],
                      ["minimal", "Minimal"],
                    ]}
                  />
                  <SelectField
                    label="Catalog density"
                    value={draft.layout.catalogDensity}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, catalogDensity: value as StoreDesignConfig["layout"]["catalogDensity"] },
                      }))
                    }
                    options={[
                      ["comfortable", "Comfortable"],
                      ["compact", "Compact"],
                    ]}
                  />
                  <SelectField
                    label="Product page layout"
                    value={draft.layout.productLayout}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        layout: { ...current.layout, productLayout: value as StoreDesignConfig["layout"]["productLayout"] },
                      }))
                    }
                    options={[
                      ["split", "Split"],
                      ["editorial", "Editorial"],
                      ["stacked", "Stacked"],
                    ]}
                  />
                  <SelectField
                    label="Product card style"
                    value={draft.commerce.productCardStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: {
                          ...current.commerce,
                          productCardStyle: value as StoreDesignConfig["commerce"]["productCardStyle"],
                        },
                      }))
                    }
                    options={[
                      ["editorial", "Editorial"],
                      ["minimal", "Minimal"],
                      ["dense", "Dense"],
                    ]}
                  />
                  <SelectField
                    label="Price emphasis"
                    value={draft.commerce.priceEmphasis}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: {
                          ...current.commerce,
                          priceEmphasis: value as StoreDesignConfig["commerce"]["priceEmphasis"],
                        },
                      }))
                    }
                    options={[
                      ["balanced", "Balanced"],
                      ["strong", "Strong"],
                    ]}
                  />
                  <SelectField
                    label="Quantity selector"
                    value={draft.commerce.quantitySelectorStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: {
                          ...current.commerce,
                          quantitySelectorStyle: value as StoreDesignConfig["commerce"]["quantitySelectorStyle"],
                        },
                      }))
                    }
                    options={[
                      ["stepper", "Stepper"],
                      ["inline", "Inline"],
                    ]}
                  />
                  <SelectField
                    label="Cart summary"
                    value={draft.commerce.cartSummaryStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: {
                          ...current.commerce,
                          cartSummaryStyle: value as StoreDesignConfig["commerce"]["cartSummaryStyle"],
                        },
                      }))
                    }
                    options={[
                      ["card", "Card"],
                      ["split", "Split"],
                    ]}
                  />
                  <SelectField
                    label="Checkout progress"
                    value={draft.commerce.checkoutProgressStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: {
                          ...current.commerce,
                          checkoutProgressStyle: value as StoreDesignConfig["commerce"]["checkoutProgressStyle"],
                        },
                      }))
                    }
                    options={[
                      ["pills", "Pills"],
                      ["bar", "Bar"],
                    ]}
                  />
                  <SelectField
                    label="Account dashboard"
                    value={draft.commerce.accountStyle}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: {
                          ...current.commerce,
                          accountStyle: value as StoreDesignConfig["commerce"]["accountStyle"],
                        },
                      }))
                    }
                    options={[
                      ["tiles", "Tiles"],
                      ["list", "List"],
                    ]}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ToggleTile
                    label="Stock badges"
                    description="Keep low-stock / availability ribbons visible"
                    checked={draft.commerce.stockBadgeVisibility}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        commerce: { ...current.commerce, stockBadgeVisibility: checked },
                      }))
                    }
                  />
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="products">
              <Panel
                title="Product online presentation"
                description="Make online publishing feel like one guided workflow instead of scattered product settings."
              >
                <div className="grid gap-4 lg:grid-cols-[0.85fr,1.15fr]">
                  <div className="space-y-3 rounded-[24px] border border-border/70 bg-background/80 p-4">
                    <Label>Choose product</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedProduct ? (
                      <div className="rounded-[20px] border border-border/70 bg-card p-4 text-sm">
                        <div className="font-medium">{selectedProduct.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {selectedProduct.categoryName ?? "Uncategorized"} · {selectedProduct.sku ?? "No SKU"}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-muted-foreground">Published online</span>
                          <Switch checked={productPublished} onCheckedChange={setProductPublished} />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Short selling copy" className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={productPresentation.shortCopy}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            shortCopy: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Ribbon / badge">
                      <Input
                        value={productPresentation.badge}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            badge: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Gallery URLs (one per line)" className="sm:col-span-2">
                      <Textarea
                        rows={4}
                        value={productPresentation.gallery.join("\n")}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            gallery: linesToList(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Highlight bullets (one per line)" className="sm:col-span-2">
                      <Textarea
                        rows={4}
                        value={productPresentation.highlights.join("\n")}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            highlights: linesToList(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Shipping message">
                      <Textarea
                        rows={3}
                        value={productPresentation.shippingNote}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            shippingNote: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Trust message">
                      <Textarea
                        rows={3}
                        value={productPresentation.trustNote}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            trustNote: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="SEO title">
                      <Input
                        value={productPresentation.seoTitle}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            seoTitle: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="SEO description" className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={productPresentation.seoDescription}
                        onChange={(event) =>
                          setProductPresentation((current) => ({
                            ...current,
                            seoDescription: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Related products" className="sm:col-span-2">
                      <div className="flex flex-wrap gap-2 rounded-[18px] border border-border/70 bg-background/80 p-3">
                        {data.products
                          .filter((product) => product.id !== selectedProductId)
                          .map((product) => {
                            const selected = productPresentation.relatedProductIds.includes(product.id);
                            return (
                              <button
                                key={product.id}
                                type="button"
                                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                  selected
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border bg-background text-muted-foreground"
                                }`}
                                onClick={() =>
                                  setProductPresentation((current) => ({
                                    ...current,
                                    relatedProductIds: selected
                                      ? current.relatedProductIds.filter((entry) => entry !== product.id)
                                      : [...current.relatedProductIds, product.id].slice(0, 4),
                                  }))
                                }
                              >
                                {product.name}
                              </button>
                            );
                          })}
                      </div>
                    </Field>
                    <div className="sm:col-span-2">
                      <Button onClick={() => void saveSelectedProduct()} disabled={!selectedProductId || save.isPending}>
                        Save product presentation
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="preview">
              <Panel
                title="Preview and publish"
                description="Review desktop and mobile before going live, then publish the draft when you’re ready."
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant={previewDevice === "desktop" ? "default" : "outline"}
                      onClick={() => setPreviewDevice("desktop")}
                    >
                      <Monitor className="mr-2 h-4 w-4" />
                      Desktop
                    </Button>
                    <Button
                      variant={previewDevice === "mobile" ? "default" : "outline"}
                      onClick={() => setPreviewDevice("mobile")}
                    >
                      <Smartphone className="mr-2 h-4 w-4" />
                      Mobile
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {data.hasUnpublishedChanges
                      ? "Draft differs from published storefront."
                      : "Draft and published storefront are currently in sync."}
                  </div>
                </div>

                <div className="mb-4 rounded-[24px] border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Public draft preview</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Generate a revocable preview URL that renders the unpublished design across storefront, cart, checkout, and account pages without publishing it.
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {data.previewActive && data.previewExpiresAt
                          ? `Active until ${new Date(data.previewExpiresAt).toLocaleString()}`
                          : "No active preview link"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => void createPreviewLink()} disabled={save.isPending}>
                        Generate link
                      </Button>
                      {previewLink ? (
                        <>
                          <Button variant="outline" asChild>
                            <a href={previewLink}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open draft
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={async () => {
                              await navigator.clipboard.writeText(previewLink);
                              toast.success("Preview link copied");
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy link
                          </Button>
                        </>
                      ) : null}
                      {data.previewActive ? (
                        <Button variant="outline" onClick={() => void revokePreviewLink()} disabled={save.isPending}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <StoreDesignPreview
                  design={draft}
                  storeName={data.companyName}
                  storeTagline="Storefront preview"
                  announcement="Previewing current draft design"
                  products={data.products}
                  device={previewDevice}
                />
              </Panel>
            </TabsContent>

            <TabsContent value="advanced">
              <Panel
                title="Advanced controls"
                description="Safe controls stay front and center. Advanced overrides are owner-only and intentionally constrained."
              >
                {!finance.canChangeSensitiveSettings || !data.canEditAdvanced ? (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Advanced mode is owner-only</AlertTitle>
                    <AlertDescription>
                      Safe design controls remain available, but custom CSS and deeper overrides are restricted to owners.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertTitle>Use advanced overrides carefully</AlertTitle>
                      <AlertDescription>
                        Custom CSS is applied across the public store, checkout, and customer account. Custom scripts are intentionally disabled in this phase for safety.
                      </AlertDescription>
                    </Alert>
                    <Field label="Custom CSS">
                      <Textarea
                        rows={10}
                        value={draft.advanced.customCss}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            advanced: { customCss: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                )}
              </Panel>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Launch view</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">What merchants control here</h2>
            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p>Theme family, design tokens, homepage composition, header/footer structure, commerce component styling, and product online presentation.</p>
              <p>Draft and published states stay separate so merchants can change the look without taking unnecessary launch risk.</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Revision metadata</div>
            <div className="mt-4 space-y-3 text-sm">
              <MetadataRow label="Draft saved" value={data.draftSavedAt ? new Date(data.draftSavedAt).toLocaleString() : "Not yet"} />
              <MetadataRow label="Published" value={data.publishedAt ? new Date(data.publishedAt).toLocaleString() : "Not yet"} />
              <MetadataRow label="Store URL" value={data.storeUrl} mono />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block text-sm">{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3 rounded-[18px] border border-border/70 bg-background/80 px-3 py-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 rounded border-0 bg-transparent p-0" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="border-none bg-transparent shadow-none" />
      </div>
    </Field>
  );
}

function ToggleTile({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-[20px] border border-border/70 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function MetadataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseFaqLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [question, ...answerParts] = entry.split("::");
      return {
        question: question?.trim() ?? "",
        answer: answerParts.join("::").trim(),
      };
    })
    .filter((entry) => entry.question && entry.answer);
}
