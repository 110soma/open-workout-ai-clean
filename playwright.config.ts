import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:4174",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "iPhone-14-Pro-width",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    }
  ],
  webServer: externalBaseURL ? undefined : {
    command: "node ./node_modules/vite/bin/vite.js preview --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true
  }
});
