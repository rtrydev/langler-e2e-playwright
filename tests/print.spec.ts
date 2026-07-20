import { test, expect } from "../fixtures/test";

test("renders the worksheet with every exercise type", async ({ factory, data, page }) => {
  const r = await data.importLesson(await factory.japaneseAutoGraded());

  await page.goto(`/lessons/print/?id=${r.lessonId}`);

  await expect(page.getByRole("heading", { name: r.title, level: 1 })).toBeVisible();

  const count = await page.getByRole("heading", { level: 2 }).count();
  expect(count).toBeGreaterThanOrEqual(6);
});

test("adds the answer key when the switch is on", async ({ factory, data, page }) => {
  const r = await data.importLesson(await factory.japaneseAutoGraded());

  await page.goto(`/lessons/print/?id=${r.lessonId}`);

  await expect(page.getByRole("heading", { name: r.title, level: 1 })).toBeVisible();

  const before = await page.getByRole("heading", { level: 2 }).count();

  await expect(page.getByText("Answer key", { exact: true })).toBeHidden();

  // Toggle via the switch's visible label; the underlying sr-only input does not
  // reliably flip under a forced click on WebKit.
  await page.getByText("Include answer key", { exact: true }).click();

  await expect(page.getByText("Answer key", { exact: true })).toBeVisible();

  const after = await page.getByRole("heading", { level: 2 }).count();
  expect(after).toBeGreaterThan(before);
});

test("renders a Burmese worksheet", async ({ factory, data, page }) => {
  const r = await data.importLesson(await factory.burmeseFoundational());

  await page.goto(`/lessons/print/?id=${r.lessonId}`);

  await expect(page.getByRole("heading", { name: r.title, level: 1 })).toBeVisible();

  const count = await page.getByRole("heading", { level: 2 }).count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test("hides the toolbar under print media", async ({ factory, data, page }) => {
  const r = await data.importLesson(await factory.japaneseAutoGraded());

  await page.goto(`/lessons/print/?id=${r.lessonId}`);

  await expect(page.getByRole("heading", { name: r.title, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print worksheet" })).toBeVisible();

  await page.emulateMedia({ media: "print" });

  await expect(page.getByRole("button", { name: "Print worksheet" })).toBeHidden();
  await expect(page.getByRole("heading", { name: r.title, level: 1 })).toBeVisible();
});
