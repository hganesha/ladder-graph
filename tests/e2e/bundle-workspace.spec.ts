import { expect, test } from "@playwright/test";

test("compiles and explores the insurance workflow bundle", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Insurance claim review/ }).click();

  await expect(page.getByText("Experimental workflow bundle compiler")).toBeVisible();
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await expect(page.getByText("4 / 4")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("bundle-workspace.png"), fullPage: true });

  await page.getByRole("tab", { name: "Form preview" }).click();
  await expect(page.getByRole("heading", { name: "First Notice of Loss" })).toBeVisible();
  await page.getByLabel("Insurance policy number").fill("POL-1042");
  await page.getByLabel("Date of loss").fill("2026-08-15");

  await page.getByRole("tab", { name: "Ontology sliver" }).click();
  await expect(page.getByRole("heading", { name: "Workflow ontology sliver" })).toBeVisible();
  await expect(page.getByText("Insurance Claim", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Compiled output" }).click();
  await expect(page.getByRole("button", { name: /ladder.lock.json/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /first-notice-of-loss.schema.json/ })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("authors a domain-bound form field and recompiles it into the bundle", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Insurance claim review/ }).click();
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await page.getByRole("tab", { name: "Form preview" }).click();
  await page.getByRole("button", { name: "Edit form" }).click();

  await expect(page.getByText("First-class form artifact")).toBeVisible();
  await page.getByRole("button", { name: /Add Claim Number/ }).click();
  await page.getByLabel("Label", { exact: true }).fill("Claim reference");
  await page.getByLabel("Label", { exact: true }).press("Tab");
  await expect(page.getByText("Claim reference").first()).toBeVisible();

  await page.getByRole("tab", { name: "preview" }).click();
  await expect(page.getByRole("textbox", { name: "Claim Number" })).toBeVisible();
  await page.getByRole("button", { name: "Narrow preview" }).click();
  const previewViewport = page.locator(".form-preview-viewport");
  await expect(previewViewport).toHaveClass(/narrow/);
  await expect(previewViewport).toHaveCSS("width", "390px");
  expect((await previewViewport.boundingBox())?.width).toBeLessThanOrEqual(430);
  await page.screenshot({ path: testInfo.outputPath("form-studio-narrow.png"), fullPage: true });

  await page.getByRole("button", { name: "Apply to bundle" }).click();
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await page.getByRole("tab", { name: "Compiled output" }).click();
  await page.getByRole("button", { name: /first-notice-of-loss.schema.json/ }).click();
  await expect(page.getByText(/Claim reference/)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
