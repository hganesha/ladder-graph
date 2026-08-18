import { describe, expect, it } from "vitest";
import { createCatalogSearchIndex, searchCatalog } from "../src/lib/catalogSearch";

const subjects = [
  {
    name: "Insurance & underwriting",
    description: "Claims, underwriting, actuarial review, fraud analysis, policy wording, and catastrophe risk.",
  },
  {
    name: "Software engineering",
    description: "Implementation, debugging, testing, architecture, and release risk.",
  },
  {
    name: "Product design",
    description: "Journey audits, critique, accessibility, redesign, and validation.",
  },
];

describe("universal catalog search", () => {
  const index = createCatalogSearchIndex(subjects);

  it("matches partial words and groups results by catalog kind", () => {
    const result = searchCatalog(index, "underw");

    expect(result.groups.subject[0]?.title).toBe("Insurance & underwriting");
    expect(result.groups.workflow.length).toBeGreaterThan(0);
    expect(result.groups.agent.length).toBeGreaterThan(0);
    expect(result.groups.form.length).toBeGreaterThan(0);
    expect(result.groups.document.length).toBeGreaterThan(0);
    expect(result.groups.ontology.length).toBeGreaterThan(0);
    expect(result.groups.bundle.length).toBeGreaterThan(0);
    expect(result.total).toBe(Object.values(result.counts).reduce((total, count) => total + count, 0));
  });

  it("requires every term and ranks title matches above metadata matches", () => {
    const result = searchCatalog(index, "bug regres");

    expect(result.groups.workflow[0]?.title).toBe("Bug diagnosis + regression gate");
    expect(result.groups.workflow.every((entry) => /bug/i.test(`${entry.title} ${entry.primaryText} ${entry.secondaryText}`))).toBe(true);
    expect(result.groups.workflow.every((entry) => /regres/i.test(`${entry.title} ${entry.primaryText} ${entry.secondaryText}`))).toBe(
      true,
    );
  });

  it("supports deterministic kind, subject, and modality filters", () => {
    const forms = searchCatalog(index, "claim", { kinds: ["form"], subjectArea: "Insurance & underwriting" });
    expect(forms.groups.form.length).toBeGreaterThan(0);
    expect(forms.groups.workflow).toEqual([]);
    expect(forms.groups.document).toEqual([]);

    const imageWorkflows = searchCatalog(index, "image", { kinds: ["workflow"], modality: "image" });
    expect(imageWorkflows.groups.workflow.length).toBeGreaterThan(0);
    expect(imageWorkflows.groups.workflow.every((entry) => entry.modalities.includes("image"))).toBe(true);
  });

  it("uses bounded typo recovery only after stronger matches are exhausted", () => {
    const result = searchCatalog(index, "underwirting");

    expect(result.groups.subject[0]?.title).toBe("Insurance & underwriting");
    expect(result.groups.subject[0]?.reason).toMatch(/similar/i);
    expect(result.didUseTypoRecovery).toBe(true);
  });
});
