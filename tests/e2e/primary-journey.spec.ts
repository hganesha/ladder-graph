import { expect, test } from "@playwright/test";

test("template to repair to compiled workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Starter workflows" })).toBeVisible();
  await page.getByRole("button", { name: /open draft.*critique.*revise in studio/i }).click();
  await expect(page.getByLabel("Workflow graph canvas")).toBeVisible();
  await page.getByRole("button", { name: "YAML source view" }).click();
  await expect(page.locator(".cm-editor")).toBeVisible();
  await page.getByRole("button", { name: "Compile" }).click();
  await expect(page.getByLabel("Compiled workflow output")).toBeVisible();
  await expect(page.getByRole("button", { name: /copy prompt/i })).toBeEnabled();
});
