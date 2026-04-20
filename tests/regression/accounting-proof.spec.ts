import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedProofSession } from "./support/auth";
import { proofManifest } from "./support/proof-manifest";

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

async function waitForPostingAudit(page: Page) {
  await expect(page.getByText("Posted ledger impact")).toBeVisible();
  await expect(page.getByText("Loading posted ledger lines…")).toHaveCount(0);
}

async function openRowLink(page: Page, listPath: string, rowLabel: string) {
  await page.goto(listPath);
  const listLink = page.locator(`a:has-text("${rowLabel}")`).first();
  if ((await listLink.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false))) {
    await listLink.click();
    return;
  }

  const row = page.locator("tbody tr").filter({ hasText: rowLabel }).first();
  await expect(row).toBeVisible();
  await row.click();
}

async function expectDetailHeading(page: Page, value: string) {
  await expect(page.getByRole("heading", { name: value })).toBeVisible();
}

function tableLinkByName(page: Page, name: string): Locator {
  return page.locator("table a").filter({ hasText: new RegExp(`^${name}$`) }).first();
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await seedProofSession(page);
});

test("dashboard proof widgets render cleanly", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Gross Revenue (MTD)")).toBeVisible();
  await expect(page.getByText("Net Cash Flow (MTD)")).toBeVisible();
  await expect(page.getByText("Receivables Aging")).toBeVisible();
  await expect(page.getByText("Payables Aging")).toBeVisible();

  await browserErrors.expectClean();
});

test("POS proof pages show expected ledger traces", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await openRowLink(page, "/pos-orders", proofManifest.posOrders.cash);
  await expectDetailHeading(page, proofManifest.posOrders.cash);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("POS revenue");
  await expect(page.locator("body")).toContainText("Customer payment");
  await expect(page.locator("body")).toContainText("Inventory / COGS");
  await expect(page.locator("body")).toContainText("Cash");

  await openRowLink(page, "/pos-orders", proofManifest.posOrders.card);
  await expectDetailHeading(page, proofManifest.posOrders.card);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Bank Account");

  await openRowLink(page, "/pos-orders", proofManifest.posOrders.mixed);
  await expectDetailHeading(page, proofManifest.posOrders.mixed);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Cash");
  await expect(page.locator("body")).toContainText("Bank Account");

  await openRowLink(page, "/pos-orders", proofManifest.posOrders.onCredit);
  await expectDetailHeading(page, proofManifest.posOrders.onCredit);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Accounts Receivable");
  await expect(page.locator("body")).not.toContainText("Customer payment");

  await browserErrors.expectClean();
});

test("quick expense proof pages show paid, unpaid, and taxed traces", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await openRowLink(page, "/quick-expenses", proofManifest.quickExpenses.paid);
  await expectDetailHeading(page, proofManifest.quickExpenses.paid);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Office Supplies");
  await expect(page.locator("body")).toContainText("Cash");

  await openRowLink(page, "/quick-expenses", proofManifest.quickExpenses.unpaid);
  await expectDetailHeading(page, proofManifest.quickExpenses.unpaid);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Accounts Payable");

  await openRowLink(page, "/quick-expenses", proofManifest.quickExpenses.taxed);
  await expectDetailHeading(page, proofManifest.quickExpenses.taxed);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Bank Account");
  await expect(page.locator("body")).toContainText("Sales Tax Payable");

  await browserErrors.expectClean();
});

test("refund proof pages show customer-credit and cash-refund flows", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await openRowLink(page, "/refunds", proofManifest.refunds.posFull);
  await expectDetailHeading(page, proofManifest.refunds.posFull);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Cash refund");
  await expect(page.locator("body")).toContainText("Refund restock");

  await openRowLink(page, "/refunds", proofManifest.refunds.customerCredit);
  await expectDetailHeading(page, proofManifest.refunds.customerCredit);
  await waitForPostingAudit(page);
  await expect(page.locator("body")).toContainText("Customer Credits Payable");
  await expect(page.locator("body")).toContainText(/Cash refund\s*\$0\.00/);

  await browserErrors.expectClean();
});

test("cash session proof page shows only transfer journals", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto(`/cash-sessions?sessionId=${proofManifest.cashSession.sessionId}`);
  await expect(page.getByRole("heading", { name: "Cash Sessions" })).toBeVisible();
  await expect(page.getByText("Ledger impact")).toBeVisible();
  await expect(page.getByText("Loading posted ledger lines…")).toHaveCount(0);
  await expect(page.locator("body")).toContainText("Cash transfer");
  await expect(page.locator("body")).toContainText(proofManifest.cashSession.cashInNote);
  await expect(page.locator("body")).toContainText(proofManifest.cashSession.cashOutNote);
  await expect(page.locator("body")).toContainText(proofManifest.cashSession.payoutNote);
  await expect(page.locator("body")).toContainText(
    "Only cash-in, cash-out, and payout events create accounting journals. Opening, sale, refund, and closing markers stay operational.",
  );

  await browserErrors.expectClean();
});

test("ledger-backed reports and drill-down stay healthy", async ({ page }) => {
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/reports/trial-balance");
  await expect(page.getByRole("heading", { name: "Trial Balance" })).toBeVisible();
  await expect(page.getByText("Trial Balance is in balance.")).toBeVisible();

  await page.goto("/reports/balance-sheet");
  await expect(page.getByRole("heading", { name: "Balance Sheet" })).toBeVisible();
  await expect(page.getByText("Balance Sheet is in balance.")).toBeVisible();

  await page.goto("/reports/trial-balance");
  await tableLinkByName(page, "Cash").click();
  await expect(page.getByRole("heading", { name: "General Ledger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journal lines" })).toBeVisible();
  await expect(page.locator("body")).toContainText(proofManifest.ledgerRefs.cashReceipt);
  await expect(page.locator("body")).toContainText(proofManifest.ledgerRefs.refund);
  await expect(page.locator("body")).toContainText(proofManifest.ledgerRefs.transfer);

  await page.goto("/reports/profit-loss");
  await expect(page.getByRole("heading", { name: "Profit & Loss" })).toBeVisible();

  await page.goto("/reports/tax");
  await expect(page.getByRole("heading", { name: "Tax Summary" })).toBeVisible();

  await page.goto("/reports/cash-flow");
  await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();

  await browserErrors.expectClean();
});
