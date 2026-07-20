import { test, expect } from "../fixtures/test";
import type { GlossaryLanguage } from "../lib/types";

// The glossary is a partly-durable, reference-counted area: the test user may
// already own some of these vocab from earlier runs/lessons. So we only assert
// on this run's own headwords, and use RELATIVE (delta) comparisons for removal
// rather than any "the word is globally gone" absolute claim.
function lessonCountFor(glossary: GlossaryLanguage[], headword: string): number {
  const ja = glossary.find((g) => g.language === "ja");
  if (!ja) {
    return 0;
  }
  return ja.words.find((w) => w.headword === headword)?.lessonCount ?? 0;
}

test("adds referenced vocab to the glossary on import", async ({ factory, data, page, api }) => {
  const { doc, vocab } = await factory.glossaryLesson(0);
  const before = await api.glossary("ja");

  await data.importLesson(doc);

  await page.goto("/glossary/");
  await expect(page.getByRole("heading", { name: "Glossary" })).toBeVisible();

  for (const entry of vocab) {
    await expect(page.getByText(entry.headword, { exact: false }).first()).toBeVisible();
  }

  // Searchbox only renders when the user has >= 2 languages of glossary words.
  const search = page.getByRole("searchbox", { name: "Search words" });
  if (await search.isVisible()) {
    await search.fill(vocab[0].headword);
    await expect(page.getByText(vocab[0].headword, { exact: false }).first()).toBeVisible();
    await search.clear();
  }

  // Relative check at the data layer: importing this lesson referenced each
  // vocab once, so every headword's lessonCount strictly increases.
  const after = await api.glossary("ja");
  for (const entry of vocab) {
    expect(lessonCountFor(after, entry.headword)).toBeGreaterThan(
      lessonCountFor(before, entry.headword),
    );
  }
});

test("removes glossary words when the lesson is deleted (refcount)", async ({
  factory,
  data,
  page,
  api,
}) => {
  const { doc, vocab } = await factory.glossaryLesson(1);
  const before = await api.glossary("ja");

  const r = await data.importLesson(doc);

  await page.goto("/glossary/");
  await expect(page.getByRole("heading", { name: "Glossary" })).toBeVisible();
  await expect(page.getByText(vocab[0].headword, { exact: false }).first()).toBeVisible();

  // Deleting the lesson decrements each referenced vocab's refcount.
  await data.forgetLesson(r.lessonId);

  // Fully relative: every headword returns to exactly its pre-import count,
  // which is robust to other lessons that reference the same shared vocab.
  const after = await api.glossary("ja");
  for (const entry of vocab) {
    expect(lessonCountFor(after, entry.headword)).toBe(lessonCountFor(before, entry.headword));
  }

  await page.goto("/glossary/");
  await expect(page.getByRole("heading", { name: "Glossary" })).toBeVisible();
});
