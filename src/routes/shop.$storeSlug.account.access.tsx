import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { cloneElement, isValidElement, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePortalAccess } from "@/features/storefront/hooks";

export const Route = createFileRoute("/shop/$storeSlug/account/access")({
  component: StorefrontAccountAccessPage,
});

function StorefrontAccountAccessPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const access = usePortalAccess();
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await access.mutateAsync({ storeSlug, email, orderNumber, postalCode });
      navigate({ to: "/shop/$storeSlug/account", params: { storeSlug } });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Access failed.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div className="space-y-3 text-center">
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Customer access</div>
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Open your account without a separate portal maze
        </h1>
        <p className="text-sm text-muted-foreground">
          Use the email from your order, your order number, and the postal code used at checkout.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn’t verify those details</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-[32px] border border-border/70 bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" className="sm:col-span-2">
            <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Order number">
            <Input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} />
          </Field>
          <Field label="Postal code">
            <Input required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" className="rounded-full px-6" disabled={access.isPending}>
            {access.isPending ? "Checking…" : "Continue to account"}
          </Button>
          <Button variant="outline" className="rounded-full px-6" asChild>
            <Link to="/shop/$storeSlug" params={{ storeSlug }}>
              Back to shop
            </Link>
          </Button>
        </div>
      </form>
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
  const id = useId();
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id })
    : children;

  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-2 block text-sm">
        {label}
      </Label>
      {control}
    </div>
  );
}
