import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = ["/", "/my-issues", "/issues", "/projects", "/projects/nivo-2", "/projects/nivo-2/issues", "/projects/nivo-2/board", "/projects/nivo-2/cycles", "/projects/nivo-2/activity", "/cycles", "/cycles/cycle-24"];

test("all core routes render without browser errors or document overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByText("We couldn’t open this view")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBeTruthy();
  }
  await page.goto("/projects/nivo-2/board");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("board.png"), fullPage: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("create, edit, comment, navigate back and persist an issue", async ({ page }) => {
  await page.goto("/issues");
  await expect(page.getByRole("heading", { name: "All issues", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create issue", exact: true }).first().click();
  const create = page.getByRole("dialog", { name: "Create issue", exact: true });
  await expect(create).toBeVisible();
  await create.getByLabel("Issue title", { exact: true }).fill("Validate the complete Nivo workflow");
  await create.getByLabel("Description", { exact: true }).fill("A **real** issue with persisted context.");
  await create.getByLabel("Project", { exact: true }).selectOption("nivo-2");
  await create.getByLabel("Assignee", { exact: true }).selectOption("user-admin");
  await create.getByLabel("Status", { exact: true }).selectOption("todo");
  await create.getByLabel("Priority", { exact: true }).selectOption("high");
  await create.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(create).toHaveCount(0);
  const issue = page.getByRole("link", { name: /Validate the complete Nivo workflow/ }).first();
  await expect(issue).toBeVisible();
  await issue.click();
  const detail = page.getByRole("dialog", { name: "Issue details", exact: true });
  await expect(detail).toBeVisible();
  const issueUrl = page.url();
  await detail.getByLabel("Status", { exact: true }).selectOption("done");
  await expect(detail.getByLabel("Status", { exact: true })).toHaveValue("done");
  await detail.getByLabel("Write a comment", { exact: true }).fill("Verified the status transition and shared context.");
  await detail.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(detail.getByRole("article").getByText("Verified the status transition and shared context.", { exact: true })).toBeVisible();
  await expect(page.locator(".sync-status")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Issue details", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("done");
  await expect(page.getByLabel("Assignee", { exact: true })).toHaveValue("user-admin");
  await page.goto("/my-issues");
  await expect(page.getByRole("link", { name: /Validate the complete Nivo workflow/ }).first()).toBeVisible();
  await page.goto(issueUrl);
  await expect(page.getByLabel("Priority", { exact: true })).toHaveValue("high");
});

test("issue panel retains list context through browser history", async ({ page }) => {
  await page.goto("/projects/nivo-2/issues");
  const issue = page.locator('main a[href^="/issues/issue-"]:visible').first();
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(page.getByRole("dialog", { name: "Issue details", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Issue details", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects\/nivo-2\/issues/);
  await expect(issue).toBeFocused();
  await page.goForward();
  await expect(page.getByRole("dialog", { name: "Issue details", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Issue details", exact: true })).toHaveCount(0);
});

test("the workspace has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page: page as unknown as never }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
});
