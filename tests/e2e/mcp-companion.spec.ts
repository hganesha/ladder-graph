import { expect, test } from "@playwright/test";

test("local MCP companion is available from the gallery", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("127.0.0.1:7341") && !message.text().includes("ERR_CONNECTION_REFUSED"))
      errors.push(message.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open MCP companion" }).click();

  const dialog = page.getByRole("dialog", { name: "Local storage" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("MCP companion", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(dialog.getByText(/no pairing code required/i)).toBeVisible();
  await expect(dialog.getByLabel("Pairing code")).toHaveCount(0);
  await expect(dialog).toContainText("MCP access is read-only");
  expect(errors).toEqual([]);
});
