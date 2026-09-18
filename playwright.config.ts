import { defineConfig } from "@playwright/test";

// End-to-end tests run against a real production build on a throwaway database.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:8123",
    trace: "retain-on-failure",
    channel: process.env.QA_BROWSER ?? "msedge",
  },
  webServer: {
    command: "npm run build && node server/main.ts",
    url: "http://127.0.0.1:8123/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: "8123",
      PUBLIC_URL: "http://127.0.0.1:8123",
      DATABASE_PATH: "data/e2e.db",
      UPLOAD_DIR: "data/e2e-uploads",
    },
  },
});
