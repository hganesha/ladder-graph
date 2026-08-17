import { expect, test } from "@playwright/test";

const chooseManufacturing = async (page: import("@playwright/test").Page) => {
  await page.getByLabel("Subject area").selectOption("Manufacturing & industrial operations");
};

test("opens standalone form, document, and ontology workspaces from the artifact library", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Workflow library" })).toBeVisible();

  await chooseManufacturing(page);
  await page.getByRole("tab", { name: "Forms" }).click();
  await page.getByRole("button", { name: "Open Quality Inspection Report form" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quality Inspection Report" })).toBeVisible();
  await expect(page.getByText("Standalone form project")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  await chooseManufacturing(page);
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByRole("button", { name: "Open Certificate Of Analysis document" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Certificate Of Analysis" })).toBeVisible();
  await expect(page.getByText("Valid document")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  await chooseManufacturing(page);
  await page.getByRole("tab", { name: "Ontologies" }).click();
  await page.getByRole("button", { name: "Open Manufacturing ontology ontology" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Manufacturing Ontology" })).toBeVisible();
  await expect(page.getByText("Valid ontology")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("manufacturing-ontology-studio.png"), fullPage: true });

  expect(consoleErrors).toEqual([]);
});
