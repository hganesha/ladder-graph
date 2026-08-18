import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("chooses and clears a custom icon for workflow agents", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();
  await page.getByRole("textbox", { name: "Search nodes and templates" }).fill("Agent");
  await page.getByRole("button", { name: /Agent One focused role and prompt/i }).click();

  await page.getByRole("button", { name: /Automatic: bot/i }).click();
  await expect(page.getByRole("dialog", { name: "Choose node icon" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("agent-icon-picker.png") });
  await page.getByRole("textbox", { name: "Search icons" }).fill("database");
  await page.getByRole("button", { name: "Use Database icon" }).click();

  await expect(page.locator('.task-node svg[data-node-icon="database"]')).toBeVisible();

  const svgDownload = page.waitForEvent("download");
  await page.locator('summary[aria-label="Download workflow"]').first().click();
  await page.getByRole("menuitem", { name: /SVG image/i }).click();
  const svgPath = await (await svgDownload).path();
  expect(svgPath).not.toBeNull();
  const svg = await readFile(svgPath!, "utf8");
  expect(svg).toContain("<ellipse");
  expect(svg).not.toContain("lucide-nodes.svg#lucide-database");

  const pngDownload = page.waitForEvent("download");
  await page.locator('summary[aria-label="Download workflow"]').first().click();
  await page.getByRole("menuitem", { name: /PNG image/i }).click();
  const pngPath = await (await pngDownload).path();
  expect(pngPath).not.toBeNull();
  const png = await readFile(pngPath!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.length).toBeGreaterThan(1_000);

  await page.getByRole("button", { name: /database Custom Lucide icon/i }).click();
  await page
    .getByRole("dialog", { name: "Choose node icon" })
    .getByRole("button", { name: /Automatic/i })
    .click();
  await expect(page.locator('.task-node svg[data-node-icon="bot"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("persists and removes a custom ontology type icon", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New ontology" }).click();

  await page.getByRole("button", { name: /Automatic: boxes/i }).click();
  await page.getByRole("textbox", { name: "Search icons" }).fill("ambulance");
  await page.getByRole("button", { name: "Use Ambulance icon" }).click();

  await expect(page.locator('.ontology-graph-node svg[data-node-icon="ambulance"]')).toBeVisible();
  await expect(page.getByLabel("Ontology YAML source")).toHaveValue(/icon:\n\s+set: lucide\n\s+name: ambulance/u);

  await page.getByRole("button", { name: /ambulance Custom Lucide icon/i }).click();
  await page
    .getByRole("dialog", { name: "Choose node icon" })
    .getByRole("button", { name: /Automatic/i })
    .click();
  await expect(page.getByLabel("Ontology YAML source")).not.toHaveValue(/icon:/u);
});
