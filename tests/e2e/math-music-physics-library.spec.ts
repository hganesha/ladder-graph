import { expect, test } from "@playwright/test";

test("opens a mathematics workflow and finds a physics agent", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Subject area").selectOption("Mathematics");
  await expect(page.getByRole("button", { name: /open optimization problem solving pipeline in studio/i })).toBeVisible();
  await page.getByRole("button", { name: /open optimization problem solving pipeline in studio/i }).click();

  await expect(page.getByLabel("Workflow graph canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: /0 errors and \d+ warnings/ })).toBeVisible();
  await expect(page.getByText("359 agents")).toBeVisible();

  await page.getByPlaceholder("Search library").fill("Quantum Mechanics Tutor");
  await expect(page.getByRole("button", { name: /quantum mechanics tutor/i })).toBeVisible();
});
