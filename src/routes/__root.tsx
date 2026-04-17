import {
  Outlet,
  Link,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Accounting — Modern Accounting & Operations" },
      {
        name: "description",
        content:
          "Modern accounting and ERP for growing businesses. Invoicing, bills, payments, and reporting — beautifully designed.",
      },
      { property: "og:title", content: "Accounting — Modern Accounting & Operations" },
      { name: "twitter:title", content: "Accounting — Modern Accounting & Operations" },
      { name: "description", content: "Modern Accounting & Operations" },
      { property: "og:description", content: "Modern Accounting & Operations" },
      { name: "twitter:description", content: "Modern Accounting & Operations" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Omip0M08sHOuvGFP8X6WMHRYkiM2/social-images/social-1776445380457-Enhance_this_logo_concept_for_Agentic_Systems_AI,_a_UAE-based_artificial_intelligence_company_specializing_in_autonomous_agentic_systems_that_connect_human_insight_and_machine_intelligence.__Design_Goals___Keep_the_sleek,_modern_feel_of_(3).webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Omip0M08sHOuvGFP8X6WMHRYkiM2/social-images/social-1776445380457-Enhance_this_logo_concept_for_Agentic_Systems_AI,_a_UAE-based_artificial_intelligence_company_specializing_in_autonomous_agentic_systems_that_connect_human_insight_and_machine_intelligence.__Design_Goals___Keep_the_sleek,_modern_feel_of_(3).webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
