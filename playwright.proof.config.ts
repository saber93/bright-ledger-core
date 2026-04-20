import { defineConfig } from "@playwright/test";

const proofPort = 4173;
const baseURL = `http://127.0.0.1:${proofPort}`;

export default defineConfig({
  testDir: "./tests/regression",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["line"]],
  outputDir: "test-results/playwright-proof",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:proof",
    url: `${baseURL}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
