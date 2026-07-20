import { test, expect } from "../fixtures/test";

test("configures lesson parameters", async ({ page }) => {
  await page.goto("/create/");

  await expect(page.getByRole("heading", { name: "Create a lesson" })).toBeVisible();

  await page.getByRole("button", { name: "日本語 Japanese" }).click();

  // SegmentedControl radios are sr-only inputs behind a styled label that
  // intercepts pointer events, so check() must be forced onto the input.
  const level = page.getByRole("radio", { name: "N4" });
  await level.check({ force: true });
  await expect(level).toBeChecked();

  const topicChip = page.getByRole("button", { name: /learned/ }).first();
  await expect(topicChip).toBeVisible();
  await topicChip.click();
  // getByLabel("Topic") also matches the "Suggested topics" group; the input's
  // label is exactly "Topic".
  await expect(page.getByLabel("Topic", { exact: true })).not.toHaveValue("");

  // Exercise-type chips toggle via their label. The sr-only input does not flip
  // under a forced click on WebKit, and the "✓" on a checked chip is CSS, so the
  // label text is just the name.
  // NOTE: the "Pick at least one exercise type." guard is not asserted — it is
  // unreachable from the UI, because the default lesson always retains the
  // story/reading exercise (which has no chip to remove), so exerciseTypes is
  // never empty. Reported as a product finding.
  const multipleChoice = page.getByRole("checkbox", { name: "Multiple choice" });
  await expect(multipleChoice).toBeChecked();
  await page.getByText("Multiple choice", { exact: true }).click();
  await expect(multipleChoice).not.toBeChecked();
  await page.getByText("Multiple choice", { exact: true }).click();
  await expect(multipleChoice).toBeChecked();
});

test("builds and copies the prompt", async ({ page }) => {
  await page.goto("/create/");

  await page.getByRole("button", { name: "Build prompt →" }).click();

  await expect(page.getByText("generated-prompt.md")).toBeVisible();

  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();

  const referenceSwitch = page.getByRole("switch", {
    name: "Include a slice of reference data (vocabulary and grammar you can ground the lesson in)",
  });
  // Toggle via the switch's visible label; the underlying sr-only input does not
  // reliably flip under a forced click on WebKit.
  const wasChecked = await referenceSwitch.isChecked();
  await page
    .getByText(
      "Include a slice of reference data (vocabulary and grammar you can ground the lesson in)",
      { exact: true },
    )
    .click();
  await expect(referenceSwitch).toBeChecked({ checked: !wasChecked });
  await expect(page.getByText("generated-prompt.md")).toBeVisible();
});

test("reports validation errors for invalid JSON", async ({ page }) => {
  await page.goto("/create/");

  await page.getByRole("button", { name: "Build prompt →" }).click();
  await page.getByRole("button", { name: "I have the JSON →" }).click();

  await page
    .getByLabel("Lesson JSON")
    .fill(
      JSON.stringify({
        schemaVersion: "1.0",
        lessonId: "not-a-uuid",
        language: "ja",
        exercises: [],
      }),
    );

  await page.getByRole("button", { name: "Validate & import" }).click();

  await expect(page.getByText(/Validation failed — \d+ issue/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy errors for your AI" })).toBeVisible();
});

test("imports a valid lesson and opens it", async ({ page, factory, data }) => {
  const doc = await factory.japaneseAutoGraded();
  data.trackLesson(doc.lessonId);

  await page.goto("/create/");

  await page.getByRole("button", { name: "Build prompt →" }).click();
  await page.getByRole("button", { name: "I have the JSON →" }).click();

  await page.getByLabel("Lesson JSON").fill(JSON.stringify(doc));

  await page.getByRole("button", { name: "Validate & import" }).click();

  await expect(
    page
      .getByText("Lesson imported")
      .or(page.getByText("Lesson already in your library")),
  ).toBeVisible();
  await expect(page.getByText(/\d+ exercise/)).toBeVisible();

  await page.getByRole("link", { name: "Open lesson" }).click();

  await expect(page).toHaveURL(/\/lessons\/detail\//);
  await expect(page.getByRole("heading", { name: doc.title })).toBeVisible();
});
