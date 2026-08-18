import { describe, expect, it } from "vitest";
import { exportOntologyToOwl } from "../src/lib/owlExport";
import { importOwlRdfXml } from "../src/lib/owlImport";
import type { Ontology } from "../src/types";

describe("OWL export", () => {
  it("serializes ontology classes, datatype properties, relationships, and cardinality as RDF/XML", () => {
    const ontology: Ontology = {
      apiVersion: "ladder.dev/v1alpha1",
      kind: "Ontology",
      metadata: {
        name: "asset-model",
        title: "Asset & Facility Model",
        description: "Governed <asset> relationships.",
        version: "2.0.0",
      },
      spec: {
        types: [
          {
            id: "asset",
            label: "Asset",
            properties: [
              {
                id: "asset.serial_number",
                label: "Serial number",
                dataType: "string",
                required: true,
                identifier: true,
              },
            ],
          },
          { id: "facility", label: "Facility", parentTypeIds: ["asset"], properties: [] },
        ],
        relationships: [
          {
            id: "located_at",
            label: "Located at",
            sourceTypeId: "asset",
            targetTypeId: "facility",
            cardinality: "many-to-one",
            required: true,
          },
        ],
      },
    };

    const owl = exportOntologyToOwl(ontology);

    expect(owl).toContain('<owl:Ontology rdf:about="https://ladder.dev/ontologies/asset-model">');
    expect(owl).toContain("Asset &amp; Facility Model");
    expect(owl).toContain("Governed &lt;asset&gt; relationships.");
    expect(owl).toContain('<owl:Class rdf:about="https://ladder.dev/ontologies/asset-model#facility">');
    expect(owl).toContain('<rdfs:subClassOf rdf:resource="https://ladder.dev/ontologies/asset-model#asset" />');
    expect(owl).toContain('<owl:DatatypeProperty rdf:about="https://ladder.dev/ontologies/asset-model#asset.serial_number">');
    expect(owl).toContain('<rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#string" />');
    expect(owl).toContain('<owl:ObjectProperty rdf:about="https://ladder.dev/ontologies/asset-model#located_at">');
    expect(owl).toContain('<rdf:type rdf:resource="http://www.w3.org/2002/07/owl#FunctionalProperty" />');
    expect(owl).toContain("<owl:minCardinality");

    const imported = importOwlRdfXml(owl, "asset-model.owl");
    expect(imported.ontology.spec.types.map((type) => type.label)).toEqual(["Asset", "Facility"]);
    expect(imported.ontology.spec.relationships[0]).toMatchObject({
      label: "Located at",
      sourceTypeId: "asset",
      targetTypeId: "facility",
      cardinality: "many-to-one",
    });
  });
});
