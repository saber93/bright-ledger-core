import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Globe2, Layers3, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useModuleEnabled } from "@/components/data/ModuleGate";
import { useStoreSetup, useSaveStoreSetup } from "@/features/storefront/hooks";
import { createDefaultShippingMethods, type StorefrontShippingMethod } from "@/features/storefront/commerce";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/store/setup")({
  component: StoreSetupPage,
});

function StoreSetupPage() {
  const enabled = useModuleEnabled("online_store_enabled");
  const { companyId } = useAuth();
  const setup = useStoreSetup(companyId);
  const save = useSaveStoreSetup();
  const [form, setForm] = useState({
    storeSlug: "",
    storeDisplayName: "",
    storeTagline: "",
    storeSupportEmail: "",
    storeContactPhone: "",
    storeAnnouncement: "",
    shippingEnabled: true,
    pickupEnabled: false,
    guestCheckoutEnabled: true,
    shippingMethods: createDefaultShippingMethods(),
  });

  useEffect(() => {
    if (!setup.data) return;
    setForm(setup.data.settings);
  }, [setup.data]);

  if (!enabled) {
    return (
      <div>
        <PageHeader title="Store Setup" description="Turn on the Online Store module first." />
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Online Store is disabled"
          description="Enable the Online Store module first, then come back here for guided setup."
        />
      </div>
    );
  }

  async function saveSettings() {
    if (!companyId) return;
    try {
      await save.mutateAsync({
        companyId,
        ...form,
      });
      toast.success("Storefront settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save store settings");
    }
  }

  async function togglePublish(productId: string, isPublished: boolean) {
    if (!companyId) return;
    try {
      await save.mutateAsync({
        companyId,
        action: "set_product_published",
        productId,
        isPublished,
      });
      toast.success(isPublished ? "Product published online" : "Product removed from storefront");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product");
    }
  }

  const publishedCount = setup.data?.products.filter((product) => product.isPublished).length ?? 0;
  const checklist = [
    { label: "Store module enabled", done: !!setup.data?.settings.onlineStoreEnabled },
    { label: "Store URL configured", done: !!setup.data?.settings.storeSlug },
    { label: "Display name set", done: !!setup.data?.settings.storeDisplayName },
    { label: "Products published", done: publishedCount > 0 },
    { label: "Payment provider ready", done: !!setup.data?.settings.paymentProvider.checkoutEnabled },
    { label: "Guest checkout ready", done: !!setup.data?.settings.guestCheckoutEnabled },
  ];

  return (
    <div>
      <PageHeader
        title="Store Setup"
        description="A guided storefront launch flow with stronger defaults and less ERP storefront sprawl."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/store/design">Store design</Link>
            </Button>
            {setup.data?.storeUrl ? (
              <Button variant="outline" asChild>
                <a href={setup.data.storeUrl}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview storefront
                </a>
              </Button>
            ) : null}
            <Button onClick={() => void saveSettings()} disabled={save.isPending}>
              Save storefront
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Guided launch
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Go live faster than the usual ERP storefront flow</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  One place to set the store URL, customer-facing basics, publishing defaults, and launch readiness.
                </p>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <Globe2 className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Store URL slug">
                <Input
                  value={form.storeSlug}
                  onChange={(event) => setForm((current) => ({ ...current, storeSlug: event.target.value }))}
                />
              </Field>
              <Field label="Display name">
                <Input
                  value={form.storeDisplayName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, storeDisplayName: event.target.value }))
                  }
                />
              </Field>
              <Field label="Tagline" className="sm:col-span-2">
                <Input
                  value={form.storeTagline}
                  onChange={(event) => setForm((current) => ({ ...current, storeTagline: event.target.value }))}
                />
              </Field>
              <Field label="Support email">
                <Input
                  value={form.storeSupportEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, storeSupportEmail: event.target.value }))
                  }
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={form.storeContactPhone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, storeContactPhone: event.target.value }))
                  }
                />
              </Field>
              <Field label="Announcement" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={form.storeAnnouncement}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, storeAnnouncement: event.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="mt-6 grid gap-4 rounded-[24px] border border-border/70 bg-muted/30 p-4 sm:grid-cols-3">
              <ToggleCard
                label="Shipping"
                description="Show shipping-ready checkout defaults"
                checked={form.shippingEnabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, shippingEnabled: checked }))}
              />
              <ToggleCard
                label="Pickup"
                description="Expose a pickup-ready message in storefront trust content"
                checked={form.pickupEnabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, pickupEnabled: checked }))}
              />
              <ToggleCard
                label="Guest checkout"
                description="Keep the default flow simple and conversion-friendly"
                checked={form.guestCheckoutEnabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, guestCheckoutEnabled: checked }))
                }
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
              <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Payment provider</div>
                    <div className="text-xs text-muted-foreground">
                      {setup.data?.settings.paymentProvider.label ?? "Stripe not configured"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Pay-now checkout uses Stripe-hosted checkout when both the Online Payments module and Stripe runtime env vars are configured.
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Shipping methods</div>
                    <div className="text-xs text-muted-foreground">
                      Practical merchant-ready methods without a carrier integration maze.
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          shippingMethods: [...current.shippingMethods, createCustomShippingMethod()],
                        }))
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add custom method
                    </Button>
                  </div>
                  {form.shippingMethods.map((method, index) => (
                    <div key={method.code} className="rounded-[18px] border border-border/70 bg-muted/20 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{method.label || "Shipping method"}</div>
                          <div className="text-xs text-muted-foreground">
                            {method.kind.replace(/_/g, " ")} · {method.fulfillmentType}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-full"
                          aria-label={`Remove ${method.label || "shipping method"}`}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              shippingMethods: current.shippingMethods.filter(
                                (entry, entryIndex) => entryIndex !== index,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Label">
                          <Input
                            value={method.label}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                shippingMethods: current.shippingMethods.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, label: event.target.value } : entry,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="ETA">
                          <Input
                            value={method.etaLabel ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                shippingMethods: current.shippingMethods.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, etaLabel: event.target.value || null }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Description" className="sm:col-span-2">
                          <Input
                            value={method.description ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                shippingMethods: current.shippingMethods.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, description: event.target.value || null }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Amount">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={method.amount}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                shippingMethods: current.shippingMethods.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, amount: Number.parseFloat(event.target.value || "0") || 0 }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </Field>
                        <Field label="Free over">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={method.freeOver ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                shippingMethods: current.shippingMethods.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        freeOver:
                                          event.target.value.trim().length > 0
                                            ? Number.parseFloat(event.target.value) || 0
                                            : null,
                                      }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Product publishing
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Publish products in one pass</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use the same product records, but publish them with clearer defaults than a configuration-heavy website builder.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {publishedCount} live
              </Badge>
            </div>

            <div className="mt-6 space-y-3">
              {setup.data?.products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-border/70 bg-background/80 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{product.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {product.categoryName ?? "Uncategorized"} · {product.sku ?? "No SKU"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {setup.data.currency} {product.price.toFixed(2)}
                    </div>
                    <Switch
                      checked={product.isPublished}
                      onCheckedChange={(checked) => void togglePublish(product.id, checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Launch progress</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Storefront readiness</h2>
            <div className="mt-5 space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 rounded-[18px] bg-muted/30 px-4 py-3">
                  <span className="text-sm">{item.label}</span>
                  <Badge variant={item.done ? "secondary" : "outline"}>{item.done ? "Ready" : "Pending"}</Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Layers3 className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Live storefront URL</div>
                <div className="text-sm text-muted-foreground">{setup.data?.storeUrl ?? "Save your store settings first"}</div>
              </div>
            </div>
            <div className="mt-5 text-sm text-muted-foreground">
              The public storefront, checkout, customer account, and document/accounting traceability all flow through this one store URL.
            </div>
          </section>
        </aside>
      </div>
    </div>
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

function ToggleCard({
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function createCustomShippingMethod(): StorefrontShippingMethod {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    code: `custom-${suffix}`,
    label: "Custom delivery",
    description: "Store-defined shipping or fulfillment method.",
    kind: "custom",
    fulfillmentType: "shipping",
    amount: 0,
    freeOver: null,
    active: true,
    etaLabel: "Configured by merchant",
  };
}
