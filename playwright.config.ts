import { defineConfig, devices } from "@playwright/test";
import { requireEnv } from "./lib/env";

const authFile = ".auth/user.json";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 2,
  // Assertion patience for real network + occasional Lambda cold-start latency
  // (not request throttling — the client sends requests unpaced).
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: requireEnv("LANGLER_E2E_BASE_URL"),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
        permissions: ["clipboard-read", "clipboard-write"],
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"], storageState: authFile },
      dependencies: ["setup"],
    },
  ],
});
