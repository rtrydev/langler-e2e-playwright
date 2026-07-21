import { test, expect } from "../fixtures/test";
import { runTag } from "../lib/run";

test("renders the harness tabs and download links", async ({ page }) => {
  await page.goto("/connect/");

  await expect(page.getByRole("heading", { name: "Connect your agent" })).toBeVisible();

  const claudeCode = page.getByRole("button", { name: "Claude Code" });
  const openapi = page.getByRole("button", { name: "OpenAPI" });
  const mcp = page.getByRole("button", { name: "MCP", exact: true });

  await expect(claudeCode).toBeVisible();
  await expect(openapi).toBeVisible();
  await expect(mcp).toBeVisible();

  await openapi.click();
  await expect(openapi).toBeVisible();

  await mcp.click();
  await expect(mcp).toBeVisible();

  await expect(page.getByRole("link", { name: "↓ Skill" })).toBeVisible();
  await expect(page.getByRole("link", { name: "↓ OpenAPI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "↓ MCP server" })).toBeVisible();
  await expect(page.getByRole("link", { name: "↓ MCP config" })).toBeVisible();
});

test("imports a lesson through a UI-created machine token", async ({ page, factory, data, api }) => {
  const label = runTag("token");
  data.trackTokenLabel(label);

  await page.goto("/settings/");

  await page.getByLabel("Label").fill(label);

  const importScope = page.getByRole("checkbox", { name: "Import lessons" });
  if (!(await importScope.isChecked())) {
    // sr-only ChoiceChip input — toggle via the visible label text, as a
    // (forced) click on the clipped input does not fire change on WebKit.
    await page.getByText("Import lessons", { exact: true }).click();
  }
  await expect(importScope).toBeChecked();

  await page.getByRole("button", { name: "Create token" }).click();

  const region = page.getByRole("region", { name: "Token created" });
  await expect(region).toBeVisible();

  const secret = (await region.getByText(/lang_sk_/).textContent())?.trim();
  if (!secret) {
    throw new Error("no secret revealed");
  }

  const doc = await factory.japaneseAutoGraded();
  data.trackLesson(doc.lessonId);
  await api.importLessonWithSecret(secret, doc);

  await page.goto("/lessons/");
  await expect(page.getByRole("link", { name: new RegExp(doc.title) })).toBeVisible();
});
