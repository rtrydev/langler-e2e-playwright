import { test, expect } from "../fixtures/test";
import type { Locator, Page } from "@playwright/test";

function visiblePrimaryNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Primary" }).filter({ visible: true });
}

const destinations = [
  { name: "Home", path: "/", heading: "Your notebook" },
  { name: "Lessons", path: "/lessons/", heading: "Lessons" },
  { name: "Create", path: "/create/", heading: "Create a lesson" },
  { name: "Review", path: "/review/", heading: null },
  { name: "Glossary", path: "/glossary/", heading: "Glossary" },
  { name: "Settings", path: "/settings/", heading: "Settings" },
];

test("navigates to every primary destination", async ({ page }) => {
  await page.goto("/");

  for (const { name, path, heading } of destinations) {
    await visiblePrimaryNav(page).getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}?$`));
    if (heading) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  }
});

test("reaches Connect and Assess from their in-page entry points", async ({ page }) => {
  await page.goto("/settings/");

  await page.getByRole("link", { name: "Connect your agent →" }).click();
  await expect(page.getByRole("heading", { name: "Connect your agent" })).toBeVisible();

  await page.goto("/settings/");
  await page.getByRole("button", { name: "Take a test" }).click();
  await expect(page.getByRole("heading", { name: "Find your level" })).toBeVisible();
});

test("presents the viewport-appropriate primary navigation", async ({ page }, testInfo) => {
  await page.goto("/");

  const navs = page.getByRole("navigation", { name: "Primary" });
  await expect(navs).toHaveCount(2);

  const visible = navs.filter({ visible: true });
  await expect(visible).toHaveCount(1);

  const box = await visible.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) {
    throw new Error("Could not measure the visible navigation.");
  }

  if (testInfo.project.name === "mobile-webkit") {
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 4);
    expect(box.width).toBeGreaterThan(viewport.width / 2);
  } else {
    expect(box.x).toBeLessThan(8);
    expect(box.height).toBeGreaterThan(viewport.height / 2);
  }
});
