import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../src/generated/artifactCatalog";
import { createCatalogSearchIndex, searchCatalog } from "../src/lib/catalogSearch";
import type { LadderDocument } from "../src/types";

const EXPECTED = ["fs-income-statement", "fs-balance-sheet", "fs-profit-and-loss-statement", "fs-form-10-k"];

describe("standard financial-services documents", () => {
  it("publishes four distinct document extraction contracts", () => {
    const templates = ARTIFACT_TEMPLATES.filter((template) => EXPECTED.includes(template.id));
    expect(templates.map((template) => template.id).sort()).toEqual([...EXPECTED].sort());
    expect(templates.every((template) => template.kind === "document" && template.path.startsWith("fs/"))).toBe(true);

    for (const template of templates) {
      const document = parse(template.yaml) as LadderDocument;
      expect(document.kind).toBe("Document");
      expect(document.spec.sections.length).toBeGreaterThan(0);
      expect(document.spec.fields.length).toBeGreaterThan(15);
      expect(document.spec.fields.every((field) => field.sourcePath?.startsWith("/"))).toBe(true);
    }
  });

  it("keeps the external income statement distinct from the management P&L", () => {
    const income = parse(ARTIFACT_TEMPLATES.find((template) => template.id === "fs-income-statement")!.yaml) as LadderDocument;
    const pnl = parse(ARTIFACT_TEMPLATES.find((template) => template.id === "fs-profit-and-loss-statement")!.yaml) as LadderDocument;
    const incomeNames = new Set(income.spec.fields.map((field) => field.name));
    const pnlNames = new Set(pnl.spec.fields.map((field) => field.name));

    expect(incomeNames).toContain("diluted_eps");
    expect(incomeNames).not.toContain("budget_ebitda");
    expect(pnlNames).toContain("budget_ebitda");
    expect(pnlNames).toContain("ebitda_variance");
  });

  it("covers the current Form 10-K parts and cybersecurity item", () => {
    const form10K = parse(ARTIFACT_TEMPLATES.find((template) => template.id === "fs-form-10-k")!.yaml) as LadderDocument;
    const fields = new Set(form10K.spec.fields.map((field) => field.name));
    expect(form10K.spec.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(["Part I", "Part II", "Part III", "Part IV, exhibits, and signatures"]),
    );
    expect(fields.has("cybersecurity")).toBe(true);
    expect(fields.has("financial_statements")).toBe(true);
    expect(fields.has("exhibits_and_financial_statement_schedules")).toBe(true);
  });

  it("finds Form 10-K when a user searches for 10K without punctuation", () => {
    const results = searchCatalog(createCatalogSearchIndex([]), "10K", { kinds: ["document"] });
    expect(results.groups.document.map((result) => result.id)).toContain("fs-form-10-k");
  });
});
