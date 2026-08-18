import { expect, test } from "@playwright/test";

const OWL = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
  xml:base="https://example.com/facilities">
  <owl:Ontology rdf:about="https://example.com/facilities">
    <rdfs:label>Facilities Ontology</rdfs:label>
    <owl:versionInfo>1.2.0</owl:versionInfo>
  </owl:Ontology>
  <owl:Class rdf:about="#Facility"><rdfs:label>Facility</rdfs:label></owl:Class>
  <owl:Class rdf:about="#Asset"><rdfs:label>Asset</rdfs:label></owl:Class>
  <owl:DatatypeProperty rdf:about="#assetNumber">
    <rdfs:label>Asset Number</rdfs:label>
    <rdfs:domain rdf:resource="#Asset" />
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string" />
  </owl:DatatypeProperty>
  <owl:ObjectProperty rdf:about="#locatedAt">
    <rdfs:label>Located At</rdfs:label>
    <rdfs:domain rdf:resource="#Asset" />
    <rdfs:range rdf:resource="#Facility" />
  </owl:ObjectProperty>
</rdf:RDF>`;

test("creates a bundle as a first-class project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New bundle" }).click();

  await expect(page.getByRole("heading", { name: "Name and version" })).toBeVisible();
  await page.getByLabel("Bundle title").fill("Facilities operations bundle");
  await page.getByLabel("Bundle slug").fill("facilities-operations-bundle");
  await page.getByLabel("Bundle description").fill("Portable facilities workflow contracts.");
  await page.getByRole("button", { name: "Validate changes" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Facilities operations bundle" })).toBeVisible();
  await page.getByRole("tab", { name: "Workflow graph" }).click();
  await expect(page.getByRole("region", { name: "Bundled workflow graph canvas" })).toBeVisible();
  await page.getByRole("button", { name: "Edit workflow" }).click();
  const sourceEditor = page.getByLabel("Bundled workflow YAML source");
  const source = await sourceEditor.inputValue();
  await sourceEditor.fill(source.replace(/title: .*/u, "title: Facilities editable workflow"));
  await page.getByRole("button", { name: "Apply workflow changes" }).click();
  await expect(page.getByRole("heading", { name: "Facilities editable workflow" })).toBeVisible();
});

test("creates an ontology by importing OWL and saves it to My library", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New ontology" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Untitled Ontology" })).toBeVisible();
  await page.getByLabel("OWL file").setInputFiles({ name: "facilities.owl", mimeType: "application/rdf+xml", buffer: Buffer.from(OWL) });

  await expect(page.getByRole("heading", { level: 1, name: "Facilities Ontology" })).toBeVisible();
  await expect(page.getByRole("region", { name: "OWL import report" })).toContainText("Imported 2 types, 1 property, and 1 relationship");
  await expect(page.getByRole("region", { name: "Ontology relationship canvas" })).toBeVisible();
  await expect(page.getByLabel("Ontology selection inspector")).toContainText("Facility");
  await page.getByRole("button", { name: "Add entity" }).click();
  await page.getByLabel("Entity label").fill("Service location");
  await page.getByRole("button", { name: "Add attribute" }).click();
  await page.getByLabel("Attribute entity.attribute label").fill("Location code");
  await page.getByRole("button", { name: "Add relationship" }).click();
  await page.getByLabel("Relationship label").fill("Hosts asset");
  await expect(page.getByLabel("Ontology YAML source")).toHaveValue(/Hosts asset/u);
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("tab", { name: "Recent projects" }).click();
  await expect(page.getByRole("button", { name: /Facilities Ontology/ })).toBeVisible();
});
