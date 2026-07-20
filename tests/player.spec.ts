import { test, expect } from "../fixtures/test";
import type { Page } from "@playwright/test";

// Click "Check", assert the grading feedback, then advance to the next exercise.
async function advance(page: Page, feedback: RegExp | string): Promise<void> {
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(feedback)).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
}

test("plays the auto-graded lesson to a saved result", async ({ page, factory, data }) => {
  const doc = await factory.japaneseAutoGraded();
  const r = await data.importLesson(doc);
  await page.goto(`/lessons/play/?id=${r.lessonId}`);

  // reading-1: answer the comprehension MC within its region (the passage may
  // repeat the same headword as a tap-to-define button, so scope by region).
  const readingQ = (doc.exercises[0].payload.questions as Array<{ options: string[]; answer: string }>)[0];
  const questions = page.getByRole("region", { name: "Comprehension questions" });
  await questions.getByRole("button", { name: readingQ.answer, exact: true }).click();
  await advance(page, /\d+ of \d+ gradable answers correct/);

  // mc-1
  const mcQ = (doc.exercises[1].payload.questions as Array<{ options: string[]; answer: string }>)[0];
  await page.getByRole("button", { name: mcQ.answer, exact: true }).click();
  await advance(page, /\d+ of \d+ questions correct/);

  // cloze-bank-1: click each blank, then the matching word-bank button.
  const bankBlanks = doc.exercises[2].payload.blanks as Array<{ index: number; answer: string }>;
  for (const blank of bankBlanks) {
    await page.getByRole("button", { name: `Blank ${blank.index}` }).click();
    await page.getByRole("button", { name: blank.answer, exact: true }).click();
  }
  await advance(page, /\d+ of \d+ blanks correct/);

  // cloze-typed-1: typed input blanks.
  const typedBlank = (doc.exercises[3].payload.blanks as Array<{ index: number; answer: string }>)[0];
  await page.getByRole("textbox", { name: `Blank ${typedBlank.index}` }).fill(typedBlank.answer);
  await advance(page, /\d+ of \d+ blanks correct/);

  // matching-1: select the left item, then its correct right item, per pair.
  const pairs = doc.exercises[4].payload.pairs as Array<{ left: string; right: string }>;
  for (const pair of pairs) {
    await page.getByRole("button", { name: pair.left }).click();
    await page.getByRole("button", { name: pair.right, exact: true }).click();
  }
  await advance(page, /\d+ of \d+ pairs correct/);

  // ordering-1: click tokens in the payload's correct order.
  const items = doc.exercises[5].payload.items as string[];
  for (const token of items) {
    await page.getByRole("button", { name: token, exact: true }).click();
  }
  await advance(page, "Correct order.");

  // Results.
  await expect(page.getByText("Lesson complete")).toBeVisible();
  await expect(page.getByText("Your result was saved.")).toBeVisible();
  await expect(page.getByText("Auto-graded", { exact: true })).toBeVisible();
});

test("toggles furigana and tap-to-define on a reading lesson", async ({ page, factory, data }) => {
  const doc = await factory.japaneseReading();
  const r = await data.importLesson(doc);
  await page.goto(`/lessons/play/?id=${r.lessonId}`);

  const reading = doc.exercises[0];
  const title = reading.payload.title as string;
  const annotations = reading.payload.annotations as Array<{ surface: string }>;
  const surface = annotations[0].surface;

  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();

  // Furigana switch: it is a native checkbox with role=switch and no
  // aria-checked attribute, so assert checked state (not the attribute), and
  // toggle via its label text to avoid clicking the visually-hidden input.
  const furigana = page.getByRole("switch", { name: "Furigana" });
  await expect(furigana).toBeChecked();
  await page.getByText("Furigana", { exact: true }).click();
  await expect(furigana).not.toBeChecked();

  // Tap a glossed word in the passage (scoped to the reading article) to open
  // its definition card, then close it.
  await page.getByRole("article").getByRole("button", { name: surface, exact: true }).click();
  const close = page.getByRole("button", { name: "Close definition" });
  await expect(close).toBeVisible();
  await close.click();
  await expect(close).toBeHidden();
});

test("self-assesses a foundational lesson", async ({ page, factory, data }) => {
  const doc = await factory.japaneseSelfAssessed();
  const r = await data.importLesson(doc);
  await page.goto(`/lessons/play/?id=${r.lessonId}`);

  // translation-1
  await page.getByPlaceholder("Write your translation…").fill("test");
  await page.getByRole("button", { name: "Compare answer" }).click();
  await page.getByRole("button", { name: "Confident" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();

  // writing-1
  await page.getByPlaceholder("Write here…").fill("テスト");
  await page.getByRole("button", { name: "Review my writing" }).click();
  await page.getByRole("button", { name: "Mostly" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();

  // script-1: the SelfAssessment only appears after something is drawn, so make
  // a stroke on the practice pad first, then rate.
  await page.getByLabel("Drawing practice area").first().click();
  await page.getByRole("button", { name: "With help" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();

  // Results.
  await expect(page.getByText("Self-assessed", { exact: true })).toBeVisible();
  await expect(page.getByText("Your result was saved.")).toBeVisible();
});

test("grades a Polish orthography exercise", async ({ page, factory, data }) => {
  const doc = await factory.polishOrthography();
  const r = await data.importLesson(doc);
  await page.goto(`/lessons/play/?id=${r.lessonId}`);

  const items = doc.exercises[0].payload.items as Array<{ kind: string; options?: string[]; answer: string }>;
  const choice = items[0];
  const dictation = items[1];

  await page.getByRole("button", { name: choice.answer, exact: true }).click();
  await page.getByRole("textbox", { name: "Orthography answer 2" }).fill(dictation.answer);

  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/\d+ of \d+ spellings correct/)).toBeVisible();

  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Your result was saved.")).toBeVisible();
});
