import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../src/generated/artifactCatalog";

describe("DocuBricks starter library", () => {
  it("publishes every classified schema once with traceable source metadata", async () => {
    const report = JSON.parse(await readFile("catalog/imports/docubricks-import-report.json", "utf8")) as {
      totals: { schemas: number; forms: number; documents: number; fields: number };
      entries: Array<{ catalogId: string; source: string }>;
    };
    expect(report.totals).toMatchObject({ schemas: 55, forms: 24, documents: 31, fields: 1043 });
    expect(new Set(report.entries.map((entry) => entry.source)).size).toBe(55);

    const docuBricksArtifacts = ARTIFACT_TEMPLATES.filter((template) => {
      const artifact = parse(template.yaml) as { metadata?: { source?: { system?: string } } };
      return artifact.metadata?.source?.system === "docubricks";
    });
    expect(docuBricksArtifacts).toHaveLength(55);
    expect(docuBricksArtifacts.some((template) => template.title === "Mortgage Application" && template.kind === "form")).toBe(true);
    expect(docuBricksArtifacts.some((template) => template.title === "Bill Of Materials" && template.kind === "document")).toBe(true);
  });
});
