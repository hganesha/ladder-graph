import { expect, test } from "@playwright/test";

test("searches the universal catalog and opens global search", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/");

  const search = page.getByRole("combobox", { name: "Search the Ladder catalog" });
  await search.fill("underw");
  await expect(page.getByRole("option", { name: /Insurance & underwriting, Subject areas, Browse subject/i })).toBeVisible();
  await expect(page.locator(".catalog-result-group")).toHaveCount(7);
  await expect(page.locator(".catalog-result-summary")).toContainText("underw");

  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await expect(page.getByRole("dialog", { name: "Find a starting point" })).toBeVisible();
  await expect(page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("catalog results fit a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search the Ladder catalog" }).fill("claim");

  await expect(page.locator(".catalog-result-list > button").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const firstResult = await page.locator(".catalog-result-list > button").first().boundingBox();
  expect(firstResult?.x).toBeGreaterThanOrEqual(0);
  expect((firstResult?.x ?? 0) + (firstResult?.width ?? 0)).toBeLessThanOrEqual(390);
});
