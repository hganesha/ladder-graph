import type { Ontology, OntologyProperty, OntologyRelationship, OntologyType } from "../types";

function uniqueId(base: string, used: Set<string>) {
  if (!used.has(base)) return base;
  let sequence = 2;
  while (used.has(`${base}-${sequence}`)) sequence += 1;
  return `${base}-${sequence}`;
}

function copy(ontology: Ontology) {
  return structuredClone(ontology);
}

export function createBlankOntology(): Ontology {
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Ontology",
    metadata: {
      name: "untitled-ontology",
      title: "Untitled Ontology",
      description: "Define shared entity types, properties, and relationships.",
      version: "1.0.0",
      source: { system: "ladder" },
    },
    spec: {
      types: [
        {
          id: "entity",
          label: "Entity",
          description: "Replace this starter type with the first governed concept.",
          properties: [],
        },
      ],
      relationships: [],
    },
  };
}

export function addOntologyType(ontology: Ontology): { ontology: Ontology; typeId: string } {
  const next = copy(ontology);
  const typeId = uniqueId("entity", new Set(next.spec.types.map((type) => type.id)));
  const entity: OntologyType = {
    id: typeId,
    label: typeId === "entity" ? "Entity" : `Entity ${next.spec.types.length + 1}`,
    description: "Describe this governed concept.",
    properties: [],
  };
  next.spec.types.push(entity);
  return { ontology: next, typeId };
}

export function addOntologyProperty(ontology: Ontology, typeId: string): { ontology: Ontology; propertyId: string } {
  const next = copy(ontology);
  const owner = next.spec.types.find((type) => type.id === typeId);
  if (!owner) return { ontology: next, propertyId: "" };
  const used = new Set(next.spec.types.flatMap((type) => type.properties.map((property) => property.id)));
  const propertyId = uniqueId(`${typeId}.attribute`, used);
  const property: OntologyProperty = {
    id: propertyId,
    label: owner.properties.length ? `Attribute ${owner.properties.length + 1}` : "Attribute",
    description: "Describe the value captured for this entity.",
    dataType: "string",
  };
  owner.properties.push(property);
  return { ontology: next, propertyId };
}

export function addOntologyRelationship(
  ontology: Ontology,
  sourceTypeId?: string,
  targetTypeId?: string,
): { ontology: Ontology; relationshipId: string } {
  const next = copy(ontology);
  if (!next.spec.types.length) {
    const added = addOntologyType(next);
    next.spec.types = added.ontology.spec.types;
    sourceTypeId = added.typeId;
  }
  const source = next.spec.types.find((type) => type.id === sourceTypeId) ?? next.spec.types[0];
  const target =
    next.spec.types.find((type) => type.id === targetTypeId) ?? next.spec.types.find((type) => type.id !== source.id) ?? source;
  const relationshipId = uniqueId("relates-to", new Set(next.spec.relationships.map((relationship) => relationship.id)));
  const relationship: OntologyRelationship = {
    id: relationshipId,
    label: "Relates to",
    description: `Describe how ${source.label} relates to ${target.label}.`,
    sourceTypeId: source.id,
    targetTypeId: target.id,
    cardinality: "many-to-one",
  };
  next.spec.relationships.push(relationship);
  return { ontology: next, relationshipId };
}

export function updateOntologyType(ontology: Ontology, typeId: string, changes: Partial<OntologyType>) {
  const next = copy(ontology);
  const index = next.spec.types.findIndex((type) => type.id === typeId);
  if (index >= 0) next.spec.types[index] = { ...next.spec.types[index], ...changes, id: typeId };
  return next;
}

export function updateOntologyProperty(ontology: Ontology, typeId: string, propertyId: string, changes: Partial<OntologyProperty>) {
  const next = copy(ontology);
  const owner = next.spec.types.find((type) => type.id === typeId);
  const index = owner?.properties.findIndex((property) => property.id === propertyId) ?? -1;
  if (owner && index >= 0) owner.properties[index] = { ...owner.properties[index], ...changes, id: propertyId };
  return next;
}

export function updateOntologyRelationship(ontology: Ontology, relationshipId: string, changes: Partial<OntologyRelationship>) {
  const next = copy(ontology);
  const index = next.spec.relationships.findIndex((relationship) => relationship.id === relationshipId);
  if (index >= 0) next.spec.relationships[index] = { ...next.spec.relationships[index], ...changes, id: relationshipId };
  return next;
}
