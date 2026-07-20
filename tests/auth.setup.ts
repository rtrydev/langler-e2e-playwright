import { test as setup, expect } from "@playwright/test";
import { testConfig } from "../lib/config";

const authFile = ".auth/user.json";

setup("authenticate through the sign-in form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(testConfig.email);
  await page.getByLabel("Password").fill(testConfig.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Your notebook" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
