import { describe, expect, it } from "vitest";
import latticeReport from "../catalog/imports/lattice-import-report.json";
import { importDocuBricksSchema, importLatticeOntology } from "../src/compiler/artifacts/importers";

describe("portable artifact importers", () => {
  it("publishes a traceable report for every curated Lattice ontology import", () => {
    expect(latticeReport.imports).toHaveLength(7);
    expect(latticeReport.imports.every((entry) => entry.sourceDigest.startsWith("sha256:"))).toBe(true);
    expect(latticeReport.imports.every((entry) => entry.omittedSemantics.includes("runtime behavior"))).toBe(true);
  });
  it("imports only ontology semantics from a Lattice export", () => {
    const result = importLatticeOntology(
      JSON.stringify({
        ontology: {
          id: "insurance-ontology",
          name: "Insurance Ontology",
          version: "0.1.0",
          digest: "sha256:source",
          releaseStatus: "UNPUBLISHED",
          entityTypes: [
            {
              id: "insurance_claim",
              label: "Insurance Claim",
              properties: [
                { id: "insurance_claim.claim_number", name: "Claim Number", dataType: "string", required: true, identifier: true },
              ],
              evidenceStatus: "TEMPLATE_DERIVED",
            },
            { id: "loss_event", label: "Loss Event", properties: [] },
          ],
          relationshipTypes: [
            {
              id: "arises_from",
              label: "ARISES_FROM",
              sourceTypeId: "insurance_claim",
              targetTypeId: "loss_event",
              cardinality: "MANY_TO_MANY",
              impact: "HIGH",
            },
          ],
          policies: [{ id: "must-not-import" }],
        },
        provenance: { generatorVersion: "1.0.0" },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.artifact?.metadata.source).toMatchObject({ system: "lattice", sourceId: "insurance-ontology" });
    expect(result.artifact?.spec.relationships[0].cardinality).toBe("many-to-many");
    expect(JSON.stringify(result.artifact)).not.toContain("policies");
    expect(JSON.stringify(result.artifact)).not.toContain("evidenceStatus");
    expect(JSON.stringify(result.artifact)).not.toContain("releaseStatus");
  });

  it("normalizes Lattice enum properties to portable string semantics", () => {
    const result = importLatticeOntology(
      JSON.stringify({
        ontology: {
          id: "operations-ontology",
          name: "Operations Ontology",
          entityTypes: [
            {
              id: "agent",
              label: "Agent",
              properties: [{ id: "agent.agent_type", name: "Agent type", dataType: "enum" }],
            },
          ],
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.artifact?.spec.types[0].properties[0].dataType).toBe("string");
  });

  it("requires an explicit experience for hybrid DocuBricks assets", () => {
    const source = JSON.stringify({ document_type: "proof_of_loss", fields: [] });
    const result = importDocuBricksSchema(source, undefined, { artifactKind: "hybrid" });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "DI100" }));
  });

  it("imports DocuBricks intake fields as a first-class form", () => {
    const result = importDocuBricksSchema(
      JSON.stringify({
        document_type: "first_notice_of_loss",
        vertical: "insurance",
        schema_version: "insurance_first_notice_of_loss_v1",
        fields: [
          { name: "policy_number", type: "string", required: true, section: "policy", description: "Policy number." },
          { name: "loss_date", type: "date", required: true, section: "loss" },
        ],
        sections: [
          { id: "policy", title: "Policy", fields: ["policy_number"] },
          { id: "loss", title: "Loss", fields: ["loss_date"] },
        ],
      }),
      undefined,
      {
        artifactKind: "form",
        role: "start",
        ontologyProperties: { policy_number: "insurance_policy.policy_number", loss_date: "loss_event.loss_date" },
      },
    );

    expect(result.ok).toBe(true);
    expect(result.artifact?.kind).toBe("Form");
    if (result.artifact?.kind !== "Form") throw new Error("Expected form import.");
    expect(result.artifact.spec.pages[0].sections).toHaveLength(2);
    expect(result.artifact.spec.pages[0].sections[0].fields[0]).toMatchObject({
      name: "policy_number",
      required: true,
      ontologyPropertyRef: "insurance_policy.policy_number",
    });
  });

  it("preserves unsupported DocuBricks expressions as inert document metadata", () => {
    const result = importDocuBricksSchema(
      JSON.stringify({
        document_type: "insurance_claim_file",
        vertical: "insurance",
        fields: [{ name: "reserve_amount", type: "number", section: "financials" }],
        sections: [{ id: "financials", title: "Financials", fields: ["reserve_amount"] }],
      }),
      JSON.stringify([
        {
          name: "reserve_non_negative",
          rule_type: "range",
          field_name: "reserve_amount",
          expression: "reserve_amount IS NULL OR reserve_amount >= 0",
          severity: "warn",
        },
        {
          name: "warehouse_lookup",
          rule_type: "sql",
          fields: ["reserve_amount"],
          expression: "EXISTS (SELECT 1 FROM reserves)",
          severity: "fail",
        },
      ]),
      { artifactKind: "document" },
    );

    expect(result.ok).toBe(true);
    if (result.artifact?.kind !== "Document") throw new Error("Expected document import.");
    expect(result.artifact.spec.validationRules?.[0]).toMatchObject({ supported: true, rule: { op: "gte" } });
    expect(result.artifact.spec.validationRules?.[1]).toMatchObject({
      supported: false,
      sourceExpression: "EXISTS (SELECT 1 FROM reserves)",
    });
  });
});
