import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { seedProofSession } from "./support/auth";
import { readStorefrontManifest } from "./support/storefront-manifest";

const manifest = readStorefrontManifest();
const manifestProductId = manifest.productKey.split("--").at(-1) ?? manifest.productKey;

function storefrontUrl(baseURL: string, path: string) {
  return new URL(path, baseURL).toString();
}

function trackBrowserErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  return {
    async expectClean() {
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    },
  };
}

async function createIsolatedPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return {
    context,
    page,
    browserErrors: trackBrowserErrors(page),
  };
}

async function closeContext(context: BrowserContext | null) {
  if (context) {
    await context.close();
  }
}

async function addManifestProductToCart(page: Page) {
  await page.goto(`/shop/${manifest.storeSlug}/product/${manifest.productKey}`);
  await expect(page.getByRole("heading", { name: manifest.productName })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page.getByRole("heading", { name: "Review your order" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("public storefront browsing and cart interactions stay healthy", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto(`/shop/${manifest.storeSlug}`);
  await expect(page.getByRole("heading", { name: manifest.publishedHero })).toBeVisible();

  await page.goto(`/shop/${manifest.storeSlug}/category/${manifest.categoryKey}`);
  await expect(
    page.getByRole("link", { name: manifest.productName, exact: true }).first(),
  ).toBeVisible();

  await addManifestProductToCart(page);

  const quantity = page.getByTestId(`cart-item-quantity-${manifestProductId}`);
  await expect(quantity).toHaveText("1");
  await page
    .getByRole("button", { name: `Increase quantity for ${manifest.productName}` })
    .click();
  await expect(quantity).toHaveText("2");

  await page
    .getByRole("button", { name: `Remove ${manifest.productName} from cart` })
    .click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();

  await browserErrors.expectClean();
});

test("pay-later checkout leads to order confirmation and customer account visibility", async ({
  page,
}) => {
  const browserErrors = trackBrowserErrors(page);
  const email = `storefront-proof+${Date.now()}@example.com`;
  const postalCode = "DXB-001";

  await addManifestProductToCart(page);
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await expect(
    page.getByRole("heading", { name: "Keep it simple, keep it clear" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Send me an invoice" }).click();
  await page.getByLabel("Full name").fill("Storefront Proof Buyer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("+971500000001");
  await page.getByLabel("Country").fill("United Arab Emirates");
  await page.getByLabel("Address line 1").fill("Proof Street 42");
  await page.getByLabel("City").fill("Dubai");
  await page.getByLabel("Postal code").fill(postalCode);
  await page.getByLabel("Order notes").fill("Storefront regression pay-later path");

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Order confirmed")).toBeVisible();
  const orderHeading = page.locator("h1").first();
  await expect(orderHeading).toContainText("SHOP-");
  const orderNumber = (await orderHeading.textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^SHOP-/);

  await page.context().clearCookies();

  const accountResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/storefront/account?") &&
      response.request().method() === "GET",
  );

  await page.goto(`/shop/${manifest.storeSlug}/account/access`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Order number").fill(orderNumber);
  await page.getByLabel("Postal code").fill(postalCode);
  await page.getByRole("button", { name: "Continue to account" }).click();

  const accountResponse = await accountResponsePromise;
  const accountPayload = (await accountResponse.json()) as {
    account: {
      customer: { name: string };
      orders: Array<{ orderNumber: string; invoiceId: string | null }>;
      invoices: Array<{ id: string; invoiceNumber: string }>;
    };
  };

  const matchingOrder = accountPayload.account.orders.find(
    (order) => order.orderNumber === orderNumber,
  );
  if (!matchingOrder) {
    throw new Error(`Could not find order ${orderNumber} in the customer account payload.`);
  }
  const matchingInvoice = accountPayload.account.invoices.find(
    (invoice) => invoice.id === matchingOrder.invoiceId,
  );
  if (!matchingInvoice) {
    throw new Error(`Could not find the invoice linked to order ${orderNumber}.`);
  }

  await expect(
    page.getByRole("heading", { name: accountPayload.account.customer.name }),
  ).toBeVisible();
  await expect(page.getByText(orderNumber)).toBeVisible();

  await page.getByRole("tab", { name: "Invoices" }).click();
  await expect(page.getByText(matchingInvoice.invoiceNumber)).toBeVisible();

  await page.getByRole("tab", { name: "Statement" }).click();
  await expect(page.getByText("Statement summary")).toBeVisible();
  await expect(
    page.getByLabel("Statement").getByRole("button", { name: "Print statement" }),
  ).toBeVisible();

  await browserErrors.expectClean();
});

test("draft preview links keep unpublished storefront state isolated and revocable", async ({
  browser,
  page,
}, testInfo) => {
  const adminErrors = trackBrowserErrors(page);
  const published = await createIsolatedPage(browser);
  const preview = await createIsolatedPage(browser);
  const revoked = await createIsolatedPage(browser);
  const baseURL = String(
    testInfo.project.use.baseURL ??
      process.env.STOREFRONT_PROOF_BASE_URL ??
      "http://127.0.0.1:4174",
  );

  try {
    await seedProofSession(page);

    await published.page.goto(storefrontUrl(baseURL, `/shop/${manifest.storeSlug}`));
    await expect(
      published.page.getByRole("heading", { name: manifest.publishedHero }),
    ).toBeVisible();
    await expect(published.page.getByText(manifest.draftHero)).toHaveCount(0);

    await page.goto("/store/design");
    await expect(page.getByRole("heading", { name: "Store Design" })).toBeVisible();
    await page.getByRole("tab", { name: "Preview & Publish" }).click();
    await page.getByRole("button", { name: "Generate link" }).click();

    const openDraftLink = page.getByRole("link", { name: "Open draft" });
    await expect(openDraftLink).toBeVisible();
    const previewHref = await openDraftLink.getAttribute("href");
    expect(previewHref).toBeTruthy();

    await preview.page.goto(storefrontUrl(baseURL, previewHref ?? "/"));
    await expect(preview.page.getByText("Draft preview")).toBeVisible();
    await expect(
      preview.page.getByRole("heading", { name: manifest.draftHero }),
    ).toBeVisible();

    await preview.page.goto(
      storefrontUrl(baseURL, `/shop/${manifest.storeSlug}/category/${manifest.categoryKey}`),
    );
    await expect(preview.page.getByText("Draft preview")).toBeVisible();
    await expect(
      preview.page.getByRole("link", { name: manifest.productName, exact: true }).first(),
    ).toBeVisible();

    await preview.page.goto(
      storefrontUrl(baseURL, `/shop/${manifest.storeSlug}/product/${manifest.productKey}`),
    );
    await expect(preview.page.getByText("Draft preview")).toBeVisible();
    await expect(
      preview.page.getByRole("heading", { name: manifest.productName }),
    ).toBeVisible();

    await published.page.reload();
    await expect(
      published.page.getByRole("heading", { name: manifest.publishedHero }),
    ).toBeVisible();
    await expect(published.page.getByText(manifest.draftHero)).toHaveCount(0);

    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("No active preview link")).toBeVisible();

    await revoked.page.goto(storefrontUrl(baseURL, previewHref ?? "/"));
    await expect(revoked.page.locator("body")).toContainText(
      "This preview link is invalid or has expired.",
    );

    await adminErrors.expectClean();
    await published.browserErrors.expectClean();
    await preview.browserErrors.expectClean();
    await revoked.browserErrors.expectClean();
  } finally {
    await closeContext(published.context);
    await closeContext(preview.context);
    await closeContext(revoked.context);
  }
});
