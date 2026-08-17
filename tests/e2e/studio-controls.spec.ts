import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("node spacing and panel-owned controls provide visible feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();

  const nodeCenters = async () =>
    page.locator(".task-node").evaluateAll((nodes) =>
      nodes.map((node) => {
        const flowNode = node.closest(".react-flow__node");
        return flowNode ? new DOMMatrix(getComputedStyle(flowNode).transform).m41 : Number.NaN;
      }),
    );
  await expect(page.locator(".task-node")).toHaveCount(2);
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

test("downloads the full graph as PNG and SVG from the export menu", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();
  await expect(page.getByLabel("Workflow graph canvas")).toBeVisible();

  await page.locator(".header-actions .export-menu summary").click();
  await expect(page.getByRole("menu", { name: "Download format" }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("export-menu.png") });

  const pngDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: /PNG image/i })
    .first()
    .click();
  const pngDownload = await pngDownloadPromise;
  const pngPath = await pngDownload.path();
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
  expect(pngPath).not.toBeNull();
  expect((await readFile(pngPath as string)).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

  await page.locator(".header-actions .export-menu summary").click();
  const svgDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: /SVG image/i })
    .first()
    .click();
  const svgDownload = await svgDownloadPromise;
  const svgPath = await svgDownload.path();
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
  expect(svgPath).not.toBeNull();
  const svg = await readFile(svgPath as string, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("task-node");
  expect(browserErrors).toEqual([]);
});
