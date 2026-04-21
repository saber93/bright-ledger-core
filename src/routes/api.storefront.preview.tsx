import { createFileRoute } from "@tanstack/react-router";
import { openStoreDesignPreview, storefrontJson } from "@/features/storefront/server";

function previewErrorHtml(message: string, storeSlug: string | null) {
  const storeHref = storeSlug ? `/shop/${encodeURIComponent(storeSlug)}` : "/login";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview unavailable</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7fb;
        color: #111827;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(34, 94, 168, 0.12), transparent 28%),
          linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      }
      .card {
        width: min(100%, 560px);
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 28px;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.10);
        padding: 32px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.8rem;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: #475569;
        line-height: 1.6;
      }
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 24px;
        padding: 12px 18px;
        border-radius: 999px;
        background: #1d4ed8;
        color: white;
        text-decoration: none;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Preview unavailable</h1>
      <p>${message}</p>
      <a href="${storeHref}">Open published storefront</a>
    </main>
  </body>
</html>`;
}

export const Route = createFileRoute("/api/storefront/preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const storeSlug = url.searchParams.get("storeSlug")?.trim();
        const token = url.searchParams.get("token")?.trim();
        if (!storeSlug || !token) {
          return storefrontJson({ error: "storeSlug and token are required." }, undefined, 400);
        }

        try {
          return await openStoreDesignPreview(request, { storeSlug, token });
        } catch (error) {
          return new Response(
            previewErrorHtml(
              error instanceof Error ? error.message : "Failed to open preview.",
              storeSlug,
            ),
            {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            },
          );
        }
      },
    },
  },
});
