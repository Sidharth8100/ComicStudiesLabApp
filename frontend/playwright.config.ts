import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: process.env.PANEL_TEST_URL || "http://127.0.0.1:8000",
    headless: true,
    launchOptions: {
      executablePath: process.env.CI
        ? process.env.CHROMIUM_PATH || undefined
        : process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
});
