import { test, expect } from "../fixtures/test";
import { runTag } from "../lib/run";

test("creates, reveals, and revokes an agent token", async ({ page, data }) => {
  const label = runTag("token");
  data.trackTokenLabel(label);

  await page.goto("/settings/");

  await page.getByLabel("Label").fill(label);
  await expect(page.getByRole("checkbox", { name: "Read reference" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Import lessons" })).toBeChecked();
  await page.getByLabel("Expires").selectOption({ label: "In 30 days" });

  await page.getByRole("button", { name: "Create token" }).click();

  const reveal = page.getByRole("region", { name: "Token created" });
  await expect(reveal).toBeVisible();
  await expect(reveal.getByText(/lang_sk_/)).toBeVisible();

  await reveal.getByRole("button", { name: "Copy" }).click();
  await expect(reveal.getByRole("button", { name: "Copied" })).toBeVisible();

  await reveal.getByRole("button", { name: "I've saved it" }).click();

  const row = page.getByRole("listitem").filter({ hasText: label });
  await expect(row).toBeVisible();
  await expect(row.getByText(/••••/)).toBeVisible();
  await expect(row.getByText("Active")).toBeVisible();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await row.getByRole("button", { name: "Revoke" }).click();

  await expect(row.getByText("Revoked")).toBeVisible();
});
