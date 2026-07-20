import { test, expect } from "@playwright/test";
import { testConfig } from "../lib/config";

test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: import("@playwright/test").Page): Promise<void> {
  await page.getByLabel("Email").fill(testConfig.email);
  await page.getByLabel("Password").fill(testConfig.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("shows the sign-in card in place on a deep link without a session", async ({ page }) => {
  await page.goto("/glossary/");

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveURL(/\/glossary\/?$/);
});

test("rejects a wrong password with an inline alert", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(testConfig.email);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your notebook" })).toBeHidden();
});

test("signs in, keeps the session across reload, and signs out", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Your notebook" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your notebook" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("renders the linked page when following a deep link with a session", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Your notebook" })).toBeVisible();

  await page.goto("/glossary/");
  await expect(page.getByRole("heading", { name: "Glossary" })).toBeVisible();
});
