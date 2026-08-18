import { expect, test } from "@playwright/test";

const openInsuranceBundle = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByLabel("Subject area").selectOption("Insurance & underwriting");
  await page.getByRole("tab", { name: "Bundles", exact: true }).click();
  await page.getByRole("button", { name: "Open Insurance claim review bundle" }).click();
};

test("compiles and explores the insurance workflow bundle", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openInsuranceBundle(page);

  await expect(page.getByText("Experimental workflow bundle compiler")).toBeVisible();
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attached assets" })).toBeVisible();
  await expect(page.getByText("Semantic bindings")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("bundle-workspace.png"), fullPage: true });

  await page.getByRole("tab", { name: "Workflow graph" }).click();
  await expect(page.getByRole("region", { name: "Bundled workflow graph canvas" })).toBeVisible();
  await expect(page.getByLabel("Bundled workflow inspector")).toBeVisible();

  await page.getByRole("tab", { name: "Form preview" }).click();
  await expect(page.getByRole("heading", { name: "First Notice of Loss" })).toBeVisible();
  await page.getByLabel("Insurance policy number").fill("POL-1042");
  await page.getByLabel("Date of loss").fill("2026-08-15");

  await page.getByRole("tab", { name: "Ontology sliver" }).click();
  await expect(page.getByRole("heading", { name: "Insurance ontology sliver" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ontology relationship canvas" })).toBeVisible();
  await page.locator(".react-flow__node").filter({ hasText: "Insurance Claim" }).click();
  await expect(page.getByLabel("Bundled ontology inspector")).toContainText("Insurance Claim");

  await page.getByRole("tab", { name: "Compiled output" }).click();
  await expect(page.getByRole("navigation", { name: "Agent-ready content" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Workflow instructions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /First Notice Of Loss input contract/i })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("uses the available package viewport for the ontology workspace", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await openInsuranceBundle(page);
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await page.getByRole("tab", { name: "Ontology sliver" }).click();

  const tabPanel = page.locator(".bundle-tab-panel");
  const ontologyWorkspace = page.locator(".bundle-ontology-preview .ontology-visual-workspace");
  await expect(ontologyWorkspace).toBeVisible();

  const [tabPanelBox, ontologyWorkspaceBox] = await Promise.all([tabPanel.boundingBox(), ontologyWorkspace.boundingBox()]);
  expect(tabPanelBox).not.toBeNull();
  expect(ontologyWorkspaceBox).not.toBeNull();
  expect(ontologyWorkspaceBox!.width).toBeGreaterThan(tabPanelBox!.width * 0.9);
  expect(ontologyWorkspaceBox!.height).toBeGreaterThan(tabPanelBox!.height * 0.7);
  await page.screenshot({ path: testInfo.outputPath("package-ontology-full-viewport.png"), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("authors a domain-bound form field and recompiles it into the bundle", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openInsuranceBundle(page);
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
  await page.getByRole("button", { name: /First Notice Of Loss input contract/i }).click();
  await expect(page.getByText(/Claim reference/)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("assembles and binds a bundle around another catalog workflow", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openInsuranceBundle(page);
  await expect(page.getByText(/deterministic files/)).toBeVisible();

  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByLabel("Workflow", { exact: true }).selectOption("evidence-research");
  await expect(page.getByRole("heading", { name: "Evidence research bundle" })).toBeVisible();
  await page.getByRole("button", { name: "Attach Insurance ontology" }).click();
  await page.getByRole("button", { name: "Attach First Notice of Loss" }).click();
  await page.getByRole("button", { name: "Add binding" }).click();

  await expect(page.getByLabel("Binding binding-1 source asset")).toHaveValue("ladder://forms/builtin/first-notice-of-loss");
  await expect(page.getByText("Changes pending validation")).toBeVisible();
  await page.getByRole("button", { name: "Validate changes" }).click();
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("general-bundle-builder.png"), fullPage: true });

  await page.getByRole("tab", { name: "Compiled output" }).click();
  await expect(page.getByRole("button", { name: "Workflow instructions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /First Notice Of Loss input contract/i })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("saves, reopens, and restores a DocuBricks-enriched bundle", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openInsuranceBundle(page);
  await expect(page.getByText(/deterministic files/)).toBeVisible();

  await page.getByLabel("Search bundle assets").fill("mortgage application");
  await expect(page.getByText("Mortgage Application", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Attach Mortgage Application" }).click();
  await expect(page.getByText(/deterministic files/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Bundle saved with a complete portable revision.")).toBeVisible();

  await page.getByRole("button", { name: "Back to workflow gallery" }).click();
  await page.getByRole("tab", { name: "Recent projects" }).click();
  await page.locator(".recent-list button").filter({ hasText: "Insurance claim review bundle" }).click();
  await expect(page.getByRole("heading", { name: "Insurance claim review bundle" })).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Latest save")).toBeVisible();
  await expect(page.getByText("Validated")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
