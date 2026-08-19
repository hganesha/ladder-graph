import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../src/generated/artifactCatalog";
import { ARTIFACT_USAGE_INDEX } from "../src/generated/catalog";
import { ontologyUsage, usageForType } from "../src/lib/ontologyUsage";
import type { Ontology } from "../src/types";

describe("ontology usage analysis", () => {
  it("indexes workflow, bundle, form, and document references by ontology type", () => {
    const insurance = ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === "ontology" && artifact.id === "insurance");
    if (!insurance) throw new Error("Insurance ontology fixture is required.");
    const usage = ontologyUsage(parse(insurance.yaml) as Ontology, ARTIFACT_USAGE_INDEX);
    const claimUsage = usageForType(usage, "insurance_claim");
    expect(claimUsage.map((entry) => entry.kind)).toEqual(expect.arrayContaining(["workflow", "workflow-bundle", "form", "document"]));
    expect(claimUsage.every((entry) => entry.propertyRefs.some((reference) => reference.startsWith("insurance_claim.")))).toBe(true);
  });
});
