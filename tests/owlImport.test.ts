import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { analyzeArtifactWasm as analyzeArtifactFallback } from "./wasmCompiler";
import { importOwlRdfXml } from "../src/lib/owlImport";

const OWL = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
  xml:base="https://example.com/claims">
  <owl:Ontology rdf:about="https://example.com/claims">
    <rdfs:label>Claims Ontology</rdfs:label>
    <owl:versionInfo>2.1.0</owl:versionInfo>
  </owl:Ontology>
  <owl:Class rdf:about="#Party"><rdfs:label>Party</rdfs:label></owl:Class>
  <owl:Class rdf:about="#Claim">
    <rdfs:label>Insurance Claim</rdfs:label>
    <rdfs:subClassOf rdf:resource="#Party" />
  </owl:Class>
  <owl:DatatypeProperty rdf:about="#claimNumber">
    <rdfs:label>Claim Number</rdfs:label>
    <rdfs:domain rdf:resource="#Claim" />
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string" />
  </owl:DatatypeProperty>
  <owl:ObjectProperty rdf:about="#submittedBy">
    <rdfs:label>Submitted By</rdfs:label>
    <rdfs:domain rdf:resource="#Claim" />
    <rdfs:range rdf:resource="#Party" />
    <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#FunctionalProperty" />
  </owl:ObjectProperty>
</rdf:RDF>`;

describe("OWL RDF/XML import", () => {
  it("normalizes named classes, datatype properties, inheritance, and object relationships", async () => {
    const result = importOwlRdfXml(OWL, "claims.owl");

    expect(result.ontology.metadata).toMatchObject({ name: "claims", title: "Claims Ontology", version: "2.1.0" });
    expect(result.ontology.metadata.source).toMatchObject({ system: "owl", sourcePath: "claims.owl" });
    expect(result.ontology.spec.types).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "party", label: "Party" }),
        expect.objectContaining({
          id: "claim",
          label: "Insurance Claim",
          parentTypeIds: ["party"],
          properties: [expect.objectContaining({ id: "claim.claim_number", dataType: "string" })],
        }),
      ]),
    );
    expect(result.ontology.spec.relationships).toContainEqual(
      expect.objectContaining({
        id: "submitted_by",
        sourceTypeId: "claim",
        targetTypeId: "party",
        cardinality: "many-to-one",
      }),
    );
    expect(result.stats).toEqual({ types: 2, properties: 1, relationships: 1 });
    await expect(analyzeArtifactFallback(stringify(result.ontology))).resolves.toMatchObject({ ok: true, diagnostics: [] });
  });

  it("rejects entity declarations and reports omitted complex semantics", () => {
    expect(() => importOwlRdfXml("<!DOCTYPE rdf:RDF [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><rdf:RDF />")).toThrow(
      /rejects DTD and entity/i,
    );

    const withRestriction = OWL.replace("</owl:Class>", "<rdfs:subClassOf><owl:Restriction /></rdfs:subClassOf></owl:Class>");
    expect(importOwlRdfXml(withRestriction).warnings).toContainEqual(expect.objectContaining({ code: "OWL_COMPLEX_AXIOMS_OMITTED" }));
  });

  it("rejects files without named RDF/XML OWL classes", () => {
    expect(() => importOwlRdfXml("<rdf:RDF xmlns:rdf='urn:rdf' xmlns:owl='urn:owl'><owl:Ontology /></rdf:RDF>")).toThrow(
      /No named owl:Class/i,
    );
  });
});
