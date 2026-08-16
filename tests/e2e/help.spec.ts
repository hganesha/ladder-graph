import { expect, test } from "@playwright/test";

test("opens intro and help from the gallery and studio", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Intro & help" }).click();
  const galleryDialog = page.getByRole("dialog", { name: "Build your first workflow" });
  await expect(galleryDialog).toBeVisible();
  await expect(galleryDialog.getByRole("button", { name: /workflow|canvas|issues|target|copy/i })).toHaveCount(5);
  await galleryDialog.getByRole("button", { name: "Close help" }).click();
  await expect(galleryDialog).toBeHidden();

  await page
    .getByRole("button", { name: /open .* in studio/i })
    .first()
    .click();
  await page.getByRole("button", { name: "Open intro and help" }).click();
  await expect(page.getByRole("dialog", { name: "Build your first workflow" })).toBeVisible();
});

test("keeps the intro and help dialog within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Intro & help" }).click();

  const dialog = page.getByRole("dialog", { name: "Build your first workflow" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);
});
