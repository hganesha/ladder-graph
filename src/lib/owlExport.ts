import type { Ontology, OntologyDataType, OntologyRelationship } from "../types";

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL_NS = "http://www.w3.org/2002/07/owl#";
const XSD_NS = "http://www.w3.org/2001/XMLSchema#";
const LADDER_NS = "https://ladder.dev/ontology#";

const XSD_DATATYPES: Record<OntologyDataType, string> = {
  string: "string",
  integer: "integer",
  number: "double",
  decimal: "decimal",
  boolean: "boolean",
  date: "date",
  datetime: "dateTime",
  array: "string",
  object: "string",
};

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function ontologyBase(ontology: Ontology) {
  const sourceId = ontology.metadata.source?.sourceId?.trim();
  if (sourceId) {
    try {
      const url = new URL(sourceId);
      if (["http:", "https:", "urn:"].includes(url.protocol)) return sourceId.replace(/#.*$/, "");
    } catch {
      // A local source filename is provenance, not a stable ontology IRI.
    }
  }
  return `https://ladder.dev/ontologies/${encodeURIComponent(ontology.metadata.name || "ontology")}`;
}

function entityIri(base: string, id: string) {
  return `${base.replace(/#.*$/, "")}#${encodeURIComponent(id)}`;
}

function textElement(name: string, value: string | undefined, indent: string) {
  return value?.trim() ? `${indent}<${name}>${xml(value)}</${name}>\n` : "";
}

function booleanAnnotation(name: string, value: boolean | undefined, indent: string) {
  return value ? `${indent}<ladder:${name} rdf:datatype="${XSD_NS}boolean">true</ladder:${name}>\n` : "";
}

function propertyRestrictions(ontology: Ontology, typeId: string, base: string) {
  const type = ontology.spec.types.find((candidate) => candidate.id === typeId);
  if (!type) return "";
  const propertyIris = type.properties.filter((property) => property.required).map((property) => entityIri(base, property.id));
  const relationshipIris = ontology.spec.relationships
    .filter((relationship) => relationship.sourceTypeId === typeId && relationship.required)
    .map((relationship) => entityIri(base, relationship.id));
  return [...propertyIris, ...relationshipIris]
    .map(
      (iri) =>
        `    <rdfs:subClassOf>\n` +
        `      <owl:Restriction>\n` +
        `        <owl:onProperty rdf:resource="${xml(iri)}" />\n` +
        `        <owl:minCardinality rdf:datatype="${XSD_NS}nonNegativeInteger">1</owl:minCardinality>\n` +
        `      </owl:Restriction>\n` +
        `    </rdfs:subClassOf>\n`,
    )
    .join("");
}

function relationshipCharacteristics(relationship: OntologyRelationship) {
  const characteristics: string[] = [];
  if (["one-to-one", "many-to-one"].includes(relationship.cardinality)) characteristics.push("FunctionalProperty");
  if (["one-to-one", "one-to-many"].includes(relationship.cardinality)) characteristics.push("InverseFunctionalProperty");
  return characteristics.map((kind) => `    <rdf:type rdf:resource="${OWL_NS}${kind}" />\n`).join("");
}

/** Serialize Ladder's portable ontology contract as deterministic OWL 2 RDF/XML. */
export function exportOntologyToOwl(ontology: Ontology) {
  const base = ontologyBase(ontology);
  const typeIds = new Set(ontology.spec.types.map((type) => type.id));
  const relationshipIds = new Set(ontology.spec.relationships.map((relationship) => relationship.id));
  let output = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  output += `<rdf:RDF\n`;
  output += `  xmlns:rdf="${RDF_NS}"\n`;
  output += `  xmlns:rdfs="${RDFS_NS}"\n`;
  output += `  xmlns:owl="${OWL_NS}"\n`;
  output += `  xmlns:xsd="${XSD_NS}"\n`;
  output += `  xmlns:ladder="${LADDER_NS}"\n`;
  output += `  xml:base="${xml(base)}">\n\n`;

  output += `  <owl:Ontology rdf:about="${xml(base)}">\n`;
  output += textElement("rdfs:label", ontology.metadata.title ?? ontology.metadata.name, "    ");
  output += textElement("rdfs:comment", ontology.metadata.description, "    ");
  output += textElement("owl:versionInfo", ontology.metadata.version, "    ");
  output += `  </owl:Ontology>\n\n`;

  for (const type of ontology.spec.types) {
    output += `  <owl:Class rdf:about="${xml(entityIri(base, type.id))}">\n`;
    output += textElement("rdfs:label", type.label, "    ");
    output += textElement("rdfs:comment", type.description, "    ");
    for (const parentId of type.parentTypeIds ?? []) {
      if (typeIds.has(parentId)) output += `    <rdfs:subClassOf rdf:resource="${xml(entityIri(base, parentId))}" />\n`;
    }
    for (const alias of type.aliases ?? []) output += textElement("ladder:alias", alias, "    ");
    output += propertyRestrictions(ontology, type.id, base);
    output += `  </owl:Class>\n\n`;
  }

  for (const type of ontology.spec.types) {
    for (const property of type.properties) {
      output += `  <owl:DatatypeProperty rdf:about="${xml(entityIri(base, property.id))}">\n`;
      output += textElement("rdfs:label", property.label, "    ");
      output += textElement("rdfs:comment", property.description, "    ");
      output += `    <rdfs:domain rdf:resource="${xml(entityIri(base, type.id))}" />\n`;
      output += `    <rdfs:range rdf:resource="${XSD_NS}${XSD_DATATYPES[property.dataType]}" />\n`;
      if (property.identifier) output += `    <rdf:type rdf:resource="${OWL_NS}FunctionalProperty" />\n`;
      output += booleanAnnotation("required", property.required, "    ");
      output += booleanAnnotation("identifier", property.identifier, "    ");
      output += textElement("ladder:dataType", property.dataType, "    ");
      output += textElement("ladder:unit", property.unit, "    ");
      if (property.allowedValues?.length) {
        output += textElement("ladder:allowedValues", JSON.stringify(property.allowedValues), "    ");
      }
      output += `  </owl:DatatypeProperty>\n\n`;
    }
  }

  for (const relationship of ontology.spec.relationships) {
    if (!typeIds.has(relationship.sourceTypeId) || !typeIds.has(relationship.targetTypeId)) continue;
    output += `  <owl:ObjectProperty rdf:about="${xml(entityIri(base, relationship.id))}">\n`;
    output += textElement("rdfs:label", relationship.label, "    ");
    output += textElement("rdfs:comment", relationship.description, "    ");
    output += `    <rdfs:domain rdf:resource="${xml(entityIri(base, relationship.sourceTypeId))}" />\n`;
    output += `    <rdfs:range rdf:resource="${xml(entityIri(base, relationship.targetTypeId))}" />\n`;
    output += relationshipCharacteristics(relationship);
    if (relationship.inverseRelationshipId && relationshipIds.has(relationship.inverseRelationshipId)) {
      output += `    <owl:inverseOf rdf:resource="${xml(entityIri(base, relationship.inverseRelationshipId))}" />\n`;
    }
    output += booleanAnnotation("required", relationship.required, "    ");
    output += textElement("ladder:cardinality", relationship.cardinality, "    ");
    output += `  </owl:ObjectProperty>\n\n`;
  }

  output += `</rdf:RDF>\n`;
  return output;
}
