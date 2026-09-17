import { expect, test } from "@playwright/test";

test("canvas switches between orthogonal and isometric projections without rewriting layout", async ({ page, isMobile }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: /new workflow/i }).click();
  await expect(page.locator(".task-node")).toHaveCount(2);

  const isometric = page.getByRole("button", { name: /isometric/i });
  const orthogonal = page.getByRole("button", { name: /orthogonal/i });
  await expect(orthogonal).toHaveAttribute("aria-pressed", "true");

  const flatPositions = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".cm-line")]
        .map((line) => line.textContent ?? "")
        .join("\n")
        .match(/\b[xy]:\s*-?[\d.]+/g),
    );
  await page.getByRole("button", { name: "Split canvas and YAML" }).first().click();
  const before = await flatPositions();

  await isometric.click();
  await expect(isometric).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".iso-task-node")).toHaveCount(2);
  await expect(page.locator(".task-node")).toHaveCount(0);
  expect(await flatPositions()).toEqual(before);

  // The choice is a remembered view preference, so a freshly opened canvas keeps it.
  await page.getByRole("button", { name: "Back to gallery" }).click();
  await page.getByRole("button", { name: /new workflow/i }).click();
  await expect(page.getByRole("button", { name: /isometric/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".iso-task-node")).toHaveCount(2);
  await page.getByRole("button", { name: "Split canvas and YAML" }).first().click();
  expect(await flatPositions()).toEqual(before);

  if (!isMobile) {
    const tile = page.locator(".iso-task-node").first();
    const box = await tile.boundingBox();
    expect(box).not.toBeNull();
    const start = { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 60, start.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(flatPositions).not.toEqual(before);
  }

  await page.getByRole("button", { name: /orthogonal/i }).click();
  await expect(page.locator(".task-node")).toHaveCount(2);
  await expect(page.locator(".iso-task-node")).toHaveCount(0);

  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
