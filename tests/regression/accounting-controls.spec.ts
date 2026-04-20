import { expect, test, type Page } from "@playwright/test";
import { seedProofSession } from "./support/auth";
import { readControlManifest } from "./support/control-manifest";

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
    async expectClean(options?: { ignoreConsole?: RegExp[] }) {
      const ignoreConsole = options?.ignoreConsole ?? [];
      const relevantConsoleErrors = consoleErrors.filter(
        (message) => !ignoreConsole.some((pattern) => pattern.test(message)),
      );
      expect(relevantConsoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    },
  };
}

async function submitFinanceReason(
  page: Page,
  title: string,
  reason: string,
  confirmLabel: string,
) {
  const dialog = page.getByRole("dialog").filter({ hasText: title });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Reason").fill(reason);
  await dialog.getByRole("button", { name: confirmLabel }).click();
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await seedProofSession(page);
});

test("finance controls close, block, and reopen the current period", async ({ page }) => {
  const manifest = readControlManifest();
  const browserErrors = trackBrowserErrors(page);

  await page.goto("/accounting/controls");
  await expect(page.getByRole("heading", { name: "Accounting Controls" })).toBeVisible();
  await expect(page.getByText(/^Finance Exceptions$/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`^Close ${manifest.periodLabel}$`) }),
  ).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^Close ${manifest.periodLabel}$`) }).click();
  await submitFinanceReason(
    page,
    "Close accounting period",
    "Group 9 regression close test",
    "Close period",
  );
  await expect(page.getByText("Accounting period closed")).toBeVisible();
  await expect(page.getByText(new RegExp(`${manifest.periodLabel} is closed`))).toBeVisible();

  await page.goto(`/invoices/${manifest.invoiceBlocked.id}`);
  await expect(
    page.getByRole("heading", { name: manifest.invoiceBlocked.number }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Void invoice" }).click();
  await submitFinanceReason(
    page,
    "Void invoice",
    "This should be blocked by the closed period",
    "Void invoice",
  );
  await expect(
    page.getByText(/Accounting period .* is closed|Accounting period locked through/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/accounting/controls");
  await page.getByRole("tab", { name: "Periods" }).click();
  const periodRow = page.locator("tbody tr").filter({ hasText: manifest.periodLabel }).first();
  await expect(periodRow).toBeVisible();
  await periodRow.getByRole("button", { name: "Reopen" }).click();
  await submitFinanceReason(
    page,
    "Reopen accounting period",
    "Group 9 regression reopen cleanup",
    "Reopen period",
  );
  await expect(page.getByText("Accounting period reopened")).toBeVisible();
  await expect(page.getByText(new RegExp(`${manifest.periodLabel} is open`))).toBeVisible();

  await browserErrors.expectClean({
    ignoreConsole: [/^Failed to load resource: the server responded with a status of 400/],
  });
});

test("invoice correction keeps traceability through payment reversal", async ({ page }) => {
  const manifest = readControlManifest();
  const browserErrors = trackBrowserErrors(page);

  await page.goto(`/invoices/${manifest.invoicePaymentReverse.id}`);
  await expect(
    page.getByRole("heading", { name: manifest.invoicePaymentReverse.number }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reverse" }).click();
  await submitFinanceReason(
    page,
    "Reverse payment",
    "Group 9 regression invoice reversal",
    "Reverse payment",
  );
  await expect(page.getByText("Payment reversed")).toBeVisible();
  await expect(page.locator("body")).toContainText(/cancelled/i);
  await expect(page.locator("body")).toContainText("Group 9 regression invoice reversal");

  await browserErrors.expectClean();
});

test("bill and credit-note corrections remain auditable", async ({ page }) => {
  const manifest = readControlManifest();
  const browserErrors = trackBrowserErrors(page);

  await page.goto(`/bills/${manifest.billPaymentReverse.id}`);
  await expect(
    page.getByRole("heading", { name: manifest.billPaymentReverse.number }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reverse" }).click();
  await submitFinanceReason(
    page,
    "Reverse supplier payment",
    "Group 9 regression supplier reversal",
    "Reverse payment",
  );
  await expect(page.getByText("Payment reversed")).toBeVisible();
  await expect(page.locator("body")).toContainText("Group 9 regression supplier reversal");

  await page.goto(`/bills/${manifest.billVoid.id}`);
  await expect(page.getByRole("heading", { name: manifest.billVoid.number })).toBeVisible();
  await page.getByRole("button", { name: "Void bill" }).click();
  await submitFinanceReason(page, "Void bill", "Group 9 regression bill void", "Void bill");
  await expect(page.getByText("Bill voided")).toBeVisible();
  await expect(page.locator("body")).toContainText("Void reason");
  await expect(page.locator("body")).toContainText("Group 9 regression bill void");

  await page.goto(`/refunds/${manifest.creditNoteVoid.id}`);
  await expect(
    page.getByRole("heading", { name: manifest.creditNoteVoid.number }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Void credit note" }).click();
  await submitFinanceReason(
    page,
    "Void credit note",
    "Group 9 regression credit note void",
    "Void credit note",
  );
  await expect(page.getByText("Credit note voided")).toBeVisible();
  await expect(page.locator("body")).toContainText("Void reason");
  await expect(page.locator("body")).toContainText("Group 9 regression credit note void");

  await browserErrors.expectClean();
});
