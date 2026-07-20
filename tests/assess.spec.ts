import { test, expect } from "../fixtures/test";
import type { Locator, Page } from "@playwright/test";

// The answer OptionCards render inside <main>; the app-shell "Sign out" buttons
// live outside it. A { pressed: false } filter alone also matches "Sign out"
// (clicking which logs the session out), so scope to <main> — where the only
// non-pressed buttons on a testing stage are the answer options.
function answerOptions(page: Page): Locator {
  return page.getByRole("main").getByRole("button", { pressed: false });
}

const COMPLETION = /Placement complete/;

test("completes a placement test end to end", async ({ page }) => {
  await page.goto("/assess/");
  await expect(
    page.getByRole("heading", { name: "Find your level" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "日本語 Japanese" }).click();
  await page.getByRole("button", { name: "Start the placement test" }).click();

  const completion = page.getByText(COMPLETION);

  // Answer every round until completion. Correct answers are unknowable client-side
  // by design, so we deliberately take the FIRST option each round — a legitimate
  // "any valid choice" pick, NOT a brittle nav-order shortcut. Each click
  // auto-submits and loads the next item/round. The loop is bounded to avoid
  // spinning forever if completion never renders.
  for (let round = 0; round < 60; round += 1) {
    const option = answerOptions(page).first();
    // Wait for either the next option to render or the result screen to appear.
    // A "Checking this round…" status sits between rounds, so neither is present
    // for a moment — the web-first assertion retries, no sleeps needed. Only one
    // of the two ever matches at a time, so strict mode stays happy.
    await expect(option.or(completion).first()).toBeVisible();
    if (await completion.isVisible()) break;
    await option.click();
  }

  await expect(completion).toBeVisible();
  await expect(page.getByText(/≈ /).first()).toBeVisible();

  // Durable area (assessments can't be deleted): assert RELATIVE — a completed
  // Japanese row now exists in the placement history, never an absolute count.
  await page.goto("/settings/");
  await expect(
    page.getByRole("heading", { name: "Placement tests" }),
  ).toBeVisible();
  await expect(page.getByText("Japanese").first()).toBeVisible();
  await expect(page.getByText(/≈\s/).first()).toBeVisible();
});

test("resumes an in-progress placement test from history", async ({ page }) => {
  await page.goto("/assess/");
  await expect(
    page.getByRole("heading", { name: "Find your level" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "日本語 Japanese" }).click();
  await page.getByRole("button", { name: "Start the placement test" }).click();

  // Answer exactly one option so the assessment is genuinely in progress.
  const firstOption = answerOptions(page).first();
  await expect(firstOption).toBeVisible();
  await firstOption.click();

  await page.getByRole("link", { name: "Exit placement test" }).click();

  await page.goto("/settings/");
  await expect(
    page.getByRole("heading", { name: "Placement tests" }),
  ).toBeVisible();

  // Multiple in-progress rows may accumulate in this durable area — resume the
  // first Resume link (each links to /assess/?id=…).
  const resume = page.getByRole("link", { name: "Resume" }).first();
  await expect(resume).toBeVisible();
  await resume.click();

  await expect(page).toHaveURL(/\/assess\/\?id=/);
  // The test resumed: an answer option is back on screen (after the brief
  // "Picking up where you left off…" status, which the retrying assertion rides).
  await expect(answerOptions(page).first()).toBeVisible();
});
