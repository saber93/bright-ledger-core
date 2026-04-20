import { expect, type Page } from "@playwright/test";
import { getRegressionEnv } from "./env";

export async function seedProofSession(page: Page) {
  const env = getRegressionEnv();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();

  await page.evaluate(
    async ({ supabaseUrl, publishableKey, email, password, storageKey }) => {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.msg ?? payload?.error_description ?? payload?.error ?? "Failed to seed proof session",
        );
      }

      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    {
      supabaseUrl: env.supabaseUrl,
      publishableKey: env.supabasePublishableKey,
      email: env.proofEmail,
      password: env.proofPassword,
      storageKey: env.storageKey,
    },
  );

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}
