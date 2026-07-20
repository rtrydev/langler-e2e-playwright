import { test, expect } from "../fixtures/test";

test("shows an imported lesson in the library and its detail", async ({ factory, data, page }) => {
  const r = await data.importLesson(await factory.japaneseAutoGraded());

  await page.goto("/lessons/");

  const card = page.getByRole("link", { name: new RegExp(r.title) });
  await expect(card).toBeVisible();

  await card.click();

  await expect(page).toHaveURL(/\/lessons\/detail\//);
  await expect(page.getByRole("heading", { name: r.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print worksheet" })).toBeVisible();

  await page.goto("/lessons/");
  await expect(page.getByRole("link", { name: new RegExp(r.title) })).toBeVisible();

  const levelFilter = page.getByRole("combobox", { name: "Filter by level" });
  if (await levelFilter.isVisible()) {
    await expect(levelFilter).toBeVisible();
  }
});

test("removes a lesson from the library after deletion", async ({ factory, data, page }) => {
  const r = await data.importLesson(await factory.japaneseSelfAssessed());

  await page.goto("/lessons/");
  await expect(page.getByRole("link", { name: new RegExp(r.title) })).toBeVisible();

  await data.forgetLesson(r.lessonId);

  await page.reload();
  await expect(page.getByRole("link", { name: new RegExp(r.title) })).toHaveCount(0);
});
