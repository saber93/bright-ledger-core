import { defineConfig } from "@playwright/test";

const storefrontPort = 4174;
const baseURL = `http://127.0.0.1:${storefrontPort}`;

export default defineConfig({
  testDir: "./tests/regression",
  testMatch: ["storefront-proof.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["line"]],
  outputDir: "test-results/playwright-storefront",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:storefront-proof",
    url: `${baseURL}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
