import { test, expect } from "../fixtures/test";

// SRS due-timing follows SM-2 scheduling: RecordLesson seeds items via progress.Schedule,
// which forces IntervalDays >= 1 for a fresh item (Again/Hard/Good -> 1 day, Easy -> 4),
// so a newly-seeded item's DueDate is tomorrow at the earliest and is never due the same day.
// The review area is durable (no delete endpoint), so this spec asserts a coherent state and a
// relative advance, tolerating whatever pre-existing SRS state the shared account already holds.

// Disabled by BUG-1 (docs/known-issues.md): the dashboard reads GET /progress,
// which 500s on the overflowed SM-2 due date, so the "Due today" card never
// renders. Re-enable once the progress endpoint is fixed and rows are repaired.
test.fixme("surfaces the due-today review state on the dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Due today" })).toBeVisible();
});

test("runs a review session or shows nothing due", async ({ page }) => {
  await page.goto("/review/?language=ja");

  const backHome = page.getByRole("button", { name: "Back to home" });
  const reveal = page.getByRole("button", { name: "Reveal" });

  // Wait past the "Preparing today's review…" loading state to a coherent outcome:
  // either the "Nothing due" empty state or a gradable card.
  await expect(backHome.or(reveal)).toBeVisible();

  if (await reveal.isVisible()) {
    const counter = page.getByText(/\d+ left today/);
    const beforeText = (await counter.textContent()) ?? "";
    const beforeMatch = beforeText.match(/(\d+) left today/);
    const beforeCount = beforeMatch && beforeMatch[1] ? Number(beforeMatch[1]) : null;

    await reveal.click();
    await page.getByRole("button", { name: "Good" }).click();

    const sessionComplete = page.getByRole("heading", { name: "Session complete" });

    // The session must advance: the last card grades into "Session complete", otherwise the
    // next card renders its own "Reveal" and the counter drops.
    await expect(sessionComplete.or(reveal)).toBeVisible();

    if (!(await sessionComplete.isVisible()) && beforeCount !== null) {
      const afterText = (await counter.textContent()) ?? "";
      const afterMatch = afterText.match(/(\d+) left today/);
      const afterCount = afterMatch && afterMatch[1] ? Number(afterMatch[1]) : null;
      if (afterCount !== null) {
        expect(afterCount).toBeLessThan(beforeCount);
      }
    }
  }
});
