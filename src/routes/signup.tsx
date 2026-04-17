import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            display_name: displayName,
            company_name: companyName,
          },
        },
      });
      if (error) throw error;
      toast.success("Workspace created. Welcome to Atlas!");
      // small delay to let trigger run + session settle
      setTimeout(() => navigate({ to: "/dashboard" }), 800);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Atlas ERP</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You'll be the owner. You can invite teammates later.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company name</Label>
              <Input
                id="company"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating workspace…" : "Create workspace"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden bg-gradient-to-br from-primary via-primary to-primary/70 lg:flex lg:items-center lg:justify-center">
        <div className="max-w-md p-12 text-primary-foreground">
          <p className="text-sm font-medium uppercase tracking-widest opacity-80">Built for scale</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">
            Start with accounting. Add the rest as you grow.
          </h2>
          <p className="mt-4 text-base opacity-90">
            A modular platform with accounting at its core. Turn on Inventory, Online Store, or
            Online Payments when you need them.
          </p>
        </div>
      </div>
    </div>
  );
}
