import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Atlas ERP</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Modern accounting, built for growing teams.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Atlas?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create a workspace
            </Link>
          </p>
        </div>
      </div>

      {/* Right: hero */}
      <div className="hidden bg-gradient-to-br from-primary via-primary to-primary/70 lg:flex lg:items-center lg:justify-center">
        <div className="max-w-md p-12 text-primary-foreground">
          <p className="text-sm font-medium uppercase tracking-widest opacity-80">
            For finance teams
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">
            Run your finances with the clarity of a modern product.
          </h2>
          <p className="mt-4 text-base opacity-90">
            Invoices, bills, payments, and reporting — connected to a real ledger, with the
            speed your team expects.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm opacity-90">
            <li>• Multi-tenant, role-based access</li>
            <li>• Customer & supplier records with full history</li>
            <li>• Invoices, bills, payments — traceable end to end</li>
            <li>• Modular: enable Inventory, Online Store, and more as you grow</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
