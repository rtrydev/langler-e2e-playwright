import { test, expect } from "../fixtures/test";

const exerciseTypeNames = [
  "Multiple choice",
  "Matching",
  "Cloze",
  "Ordering",
  "Script practice",
  "Translation",
  "Writing prompt",
];

test("configures lesson parameters", async ({ page }) => {
  await page.goto("/create/");

  await expect(page.getByRole("heading", { name: "Create a lesson" })).toBeVisible();

  await page.getByRole("button", { name: "日本語 Japanese" }).click();

  const level = page.getByRole("radio", { name: "N4" });
  await level.click();
  await expect(level).toBeChecked();

  const topicChip = page.getByRole("button", { name: /learned/ }).first();
  await expect(topicChip).toBeVisible();
  await topicChip.click();
  await expect(page.getByLabel("Topic")).not.toHaveValue("");

  for (const name of exerciseTypeNames) {
    const cb = page.getByRole("checkbox", { name, exact: true });
    if (await cb.isChecked()) {
      await cb.uncheck();
    }
  }

  await expect(page.getByText("Pick at least one exercise type.")).toBeVisible();
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
  const wasChecked = await referenceSwitch.isChecked();
  await referenceSwitch.click();
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
