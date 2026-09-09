import { expect, test } from "@playwright/test";

test("command search opens an issue and restores context", async ({ page }) => {
  await page.goto("/issues");
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("NIV-142");
  const result = palette.getByRole("option").filter({ hasText: "NIV-142" }).first();
  await expect(result).toBeVisible();
  await palette.getByRole("combobox").press("Enter");
  await expect(page.getByRole("dialog", { name: "Issue details", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/issues\/issue-142$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/issues$/);
});

test("shortcut respects editable fields and dialog focus stays contained", async ({ page }) => {
  await page.goto("/issues");
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create issue", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create issue", exact: true });
  const title = dialog.getByLabel("Issue title", { exact: true });
  await expect(title).toBeFocused();
  await title.fill("cjqkeasp");
  await title.press("ControlOrMeta+k");
  await expect(title).toHaveValue("cjqkeasp");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(title).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
  }
  await title.fill("");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const tag = await page.evaluate(() => document.activeElement?.tagName);
  expect(["BUTTON", "BODY"]).toContain(tag);
});

test("deep links and unknown entities have meaningful states", async ({ page }) => {
  await page.goto("/issues/issue-142");
  await expect(page.getByRole("heading", { name: "Implement command palette", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/issues/does-not-exist");
  await expect(page.getByText("Issue not found", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to issues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
});
