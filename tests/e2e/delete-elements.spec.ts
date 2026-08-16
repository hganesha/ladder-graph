import { expect, test } from "@playwright/test";

test("deletes selected edges with the mouse and nodes with the keyboard", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("body")).not.toHaveText("");
  await page.getByRole("button", { name: /new workflow/i }).click();

  const edge = page.locator(".react-flow__edge:not(.group-internal-edge)").first();
  await expect(edge).toHaveCount(1);
  await edge.dispatchEvent("click");
  const deleteEdge = page.getByRole("button", { name: "Delete selected edge" });
  await expect(deleteEdge).toBeVisible();
  await deleteEdge.click();
  await expect(page.locator(".react-flow__edge:not(.group-internal-edge)")).toHaveCount(0);

  await page.getByLabel("Primitives").locator("summary").click();
  await page.getByRole("button", { name: /agent one focused role and prompt/i }).click();
  const agent = page.getByLabel("Agent: Agent");
  await expect(agent).toBeVisible();
  await agent.click();
  await expect(page.getByRole("button", { name: "Delete selected node" })).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(agent).toHaveCount(0);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
