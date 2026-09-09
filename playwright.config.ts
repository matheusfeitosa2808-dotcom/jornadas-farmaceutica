import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: "e2e.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "./test-results/e2e",
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "api", grep: /@api/ },
    {
      name: "desktop",
      grep: /@desktop/,
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "mobile", grep: /@mobile/, use: { ...devices["Pixel 7"] } },
  ],
  webServer:
    process.env.E2E_START_SERVER === "1"
      ? {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
});
