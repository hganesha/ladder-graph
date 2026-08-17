import { expect, test } from "@playwright/test";

test("node spacing and panel-owned controls provide visible feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();

  const nodeCenters = async () =>
    page.locator(".task-node").evaluateAll((nodes) =>
      nodes.map((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.x + bounds.width / 2;
      }),
    );
  const before = await nodeCenters();
  await page.getByRole("button", { name: "Increase node spacing" }).click();
  await expect(page.getByLabel("Node spacing 120 percent")).toBeVisible();
  await expect
    .poll(async () => {
      const after = await nodeCenters();
      return Math.abs(after[1] - after[0]);
    })
    .toBeGreaterThan(Math.abs(before[1] - before[0]));

  await page.getByRole("button", { name: "Close library" }).click();
  await expect(page.getByLabel("Node and template palette")).toBeHidden();
  await page.getByRole("button", { name: "Open library" }).click();
  await expect(page.getByLabel("Node and template palette")).toBeVisible();

  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page.getByRole("button", { name: "Open inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Open inspector" }).click();
  await expect(page.getByText("Workflow overview")).toBeVisible();
});

test("workflow name and description are editable from the header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();

  const name = page.getByLabel("Workflow name");
  const description = page.getByLabel("Workflow description");
  await name.fill("Release readiness review");
  await name.press("Enter");
  await description.fill("Verify risks, owners, and launch evidence.");
  await description.press("Enter");

  await expect(name).toHaveValue("Release readiness review");
  await expect(description).toHaveValue("Verify risks, owners, and launch evidence.");
  await page.getByRole("button", { name: "YAML source view" }).click();
  await expect(page.locator(".cm-content")).toContainText("title: Release readiness review");
  await expect(page.locator(".cm-content")).toContainText("description: Verify risks, owners, and launch evidence.");
});
