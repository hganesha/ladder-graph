import type { Ontology, OntologyCardinality, OntologyDataType } from "../types";

const MAX_OWL_BYTES = 5 * 1024 * 1024;
const MAX_TYPES = 1000;
const MAX_RELATIONSHIPS = 2000;
const MAX_PROPERTIES = 10_000;

export interface OwlImportWarning {
  code: string;
  message: string;
}

export interface OwlImportResult {
  ontology: Ontology;
  warnings: OwlImportWarning[];
  stats: {
    types: number;
    properties: number;
    relationships: number;
  };
}

interface OwlPropertyRecord {
  element: Element;
  iri: string;
  id: string;
  label: string;
  description?: string;
  domains: string[];
  ranges: string[];
  functional: boolean;
  inverseFunctional: boolean;
  inverseIri?: string;
}

function elements(root: Document | Element, localName: string) {
  return [...root.getElementsByTagName("*")].filter((element) => element.localName === localName);
}

function directChildren(element: Element, localName: string) {
  return [...element.children].filter((child) => child.localName === localName);
}

function attribute(element: Element, localName: string) {
  return [...element.attributes].find((item) => item.localName === localName)?.value;
}

function text(element: Element, localName: string) {
  return directChildren(element, localName)
    .map((child) => child.textContent?.trim())
    .find(Boolean);
}

function titleCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value: string, separator: "-" | "_" = "-") {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, `$1${separator}$2`)
    .replace(/[^a-zA-Z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "")
    .toLowerCase();
  return normalized || "unnamed";
}

function iriLocalName(iri: string) {
  const withoutQuery = iri.split("?")[0] ?? iri;
  const fragment = withoutQuery.split("#").at(-1) ?? withoutQuery;
  return decodeURIComponent(fragment.split("/").filter(Boolean).at(-1) ?? fragment);
}

function resolveIri(value: string, base: string) {
  if (!value) return value;
  if (value.startsWith("#")) return `${base.replace(/#.*$/, "")}${value}`;
  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

function identityIri(element: Element, base: string) {
  const about = attribute(element, "about");
  if (about) return resolveIri(about, base);
  const id = attribute(element, "ID");
  return id ? resolveIri(`#${id}`, base) : undefined;
}

function uniqueId(candidate: string, used: Set<string>) {
  let next = candidate;
  let suffix = 2;
  while (used.has(next)) next = `${candidate}_${suffix++}`;
  used.add(next);
  return next;
}

function resources(element: Element, localName: string, base: string) {
  return directChildren(element, localName)
    .map((child) => attribute(child, "resource") ?? identityIri(elements(child, "Class")[0] ?? child, base))
    .filter((value): value is string => Boolean(value))
    .map((value) => resolveIri(value, base));
}

function hasRdfType(element: Element, typeName: string) {
  return directChildren(element, "type").some((child) => iriLocalName(attribute(child, "resource") ?? "") === typeName);
}

function dataTypeFor(rangeIri: string | undefined, warnings: OwlImportWarning[]): OntologyDataType {
  const range = iriLocalName(rangeIri ?? "string").toLowerCase();
  if (["byte", "short", "int", "integer", "long", "nonnegativeinteger", "positiveinteger"].includes(range)) return "integer";
  if (["float", "double"].includes(range)) return "number";
  if (range === "decimal") return "decimal";
  if (range === "boolean") return "boolean";
  if (range === "date") return "date";
  if (["datetime", "datetimestamp"].includes(range)) return "datetime";
  if (["string", "normalizedstring", "token", "language", "anyuri"].includes(range)) return "string";
  warnings.push({ code: "OWL_UNSUPPORTED_DATATYPE", message: `Mapped OWL datatype '${range || "unknown"}' to string.` });
  return "string";
}

function propertyRecords(document: Document, localName: "DatatypeProperty" | "ObjectProperty", base: string) {
  const usedIds = new Set<string>();
  const seenIris = new Set<string>();
  const candidates = [
    ...elements(document, localName),
    ...elements(document, "Description").filter((element) => hasRdfType(element, localName)),
  ];
  return candidates.flatMap((element): OwlPropertyRecord[] => {
    const iri = identityIri(element, base);
    if (!iri || seenIris.has(iri)) return [];
    seenIris.add(iri);
    const local = iriLocalName(iri);
    return [
      {
        element,
        iri,
        id: uniqueId(slug(local, "_"), usedIds),
        label: text(element, "label") ?? titleCase(local),
        description: text(element, "comment"),
        domains: resources(element, "domain", base),
        ranges: resources(element, "range", base),
        functional: hasRdfType(element, "FunctionalProperty"),
        inverseFunctional: hasRdfType(element, "InverseFunctionalProperty"),
        inverseIri: resources(element, "inverseOf", base)[0],
      },
    ];
  });
}

function relationshipCardinality(record: OwlPropertyRecord): OntologyCardinality {
  if (record.functional && record.inverseFunctional) return "one-to-one";
  if (record.functional) return "many-to-one";
  if (record.inverseFunctional) return "one-to-many";
  return "many-to-many";
}

export function importOwlRdfXml(source: string, filename = "imported.owl"): OwlImportResult {
  if (new TextEncoder().encode(source).byteLength > MAX_OWL_BYTES) throw new Error("OWL files are limited to 5 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("OWL import rejects DTD and entity declarations.");

  const document = new DOMParser().parseFromString(source, "application/xml");
  if (elements(document, "parsererror").length) throw new Error("The OWL file is not valid XML.");
  const root = document.documentElement;
  const ontologyElement = elements(document, "Ontology")[0];
  const declaredBase = attribute(root, "base") ?? root.baseURI ?? `urn:ladder:${slug(filename)}`;
  const ontologyIri = ontologyElement ? identityIri(ontologyElement, declaredBase) : undefined;
  const base = attribute(root, "base") ?? ontologyIri ?? declaredBase;
  const warnings: OwlImportWarning[] = [];

  if (elements(document, "imports").length) {
    warnings.push({ code: "OWL_IMPORTS_NOT_FETCHED", message: "Referenced owl:imports were not fetched; only this file was normalized." });
  }
  const omittedAxioms = ["Restriction", "equivalentClass", "unionOf", "intersectionOf", "disjointWith"].filter(
    (name) => elements(document, name).length > 0,
  );
  if (omittedAxioms.length) {
    warnings.push({
      code: "OWL_COMPLEX_AXIOMS_OMITTED",
      message: `Complex OWL axioms were not compiled: ${omittedAxioms.join(", ")}.`,
    });
  }

  const seenClassIris = new Set<string>();
  const classElements = [
    ...elements(document, "Class"),
    ...elements(document, "Description").filter((element) => hasRdfType(element, "Class")),
  ]
    .filter((element) => identityIri(element, base))
    .filter((element) => {
      const iri = identityIri(element, base)!;
      if (seenClassIris.has(iri)) return false;
      seenClassIris.add(iri);
      return true;
    });
  if (!classElements.length)
    throw new Error("No named owl:Class declarations were found. Ladder currently imports RDF/XML OWL ontologies.");
  if (classElements.length > MAX_TYPES)
    throw new Error(`OWL import found ${classElements.length} classes; Ladder supports at most ${MAX_TYPES}.`);

  const typeIds = new Set<string>();
  const typeIdByIri = new Map<string, string>();
  const typeIdByLocalName = new Map<string, string>();
  const types = classElements.map((element, index) => {
    const iri = identityIri(element, base)!;
    const local = iriLocalName(iri);
    const id = uniqueId(slug(local, "_"), typeIds);
    typeIdByIri.set(iri, id);
    typeIdByLocalName.set(local, id);
    return {
      id,
      label: text(element, "label") ?? titleCase(local),
      description: text(element, "comment"),
      parentTypeIds: [] as string[],
      properties: [] as Ontology["spec"]["types"][number]["properties"],
      sourcePath: `/owl/classes/${index}`,
      element,
    };
  });
  const typeIdFor = (iri: string) => typeIdByIri.get(resolveIri(iri, base)) ?? typeIdByLocalName.get(iriLocalName(iri));

  for (const type of types) {
    type.parentTypeIds = resources(type.element, "subClassOf", base).flatMap((iri) => {
      const id = typeIdFor(iri);
      return id && id !== type.id ? [id] : [];
    });
  }

  const datatypeProperties = propertyRecords(document, "DatatypeProperty", base);
  let propertyCount = 0;
  for (const property of datatypeProperties) {
    if (!property.domains.length) {
      warnings.push({
        code: "OWL_PROPERTY_WITHOUT_DOMAIN",
        message: `Skipped datatype property '${property.label}' because it has no named domain.`,
      });
      continue;
    }
    for (const domain of property.domains) {
      const typeId = typeIdFor(domain);
      const type = types.find((candidate) => candidate.id === typeId);
      if (!type) {
        warnings.push({
          code: "OWL_UNKNOWN_DOMAIN",
          message: `Skipped datatype property '${property.label}' with unknown domain '${domain}'.`,
        });
        continue;
      }
      propertyCount += 1;
      if (propertyCount > MAX_PROPERTIES) throw new Error(`OWL import exceeds the ${MAX_PROPERTIES.toLocaleString()} property limit.`);
      type.properties.push({
        id: `${type.id}.${property.id}`,
        label: property.label,
        description: property.description,
        dataType: dataTypeFor(property.ranges[0], warnings),
        sourcePath: `/owl/datatypeProperties/${property.id}`,
      });
    }
  }

  const objectProperties = propertyRecords(document, "ObjectProperty", base);
  const relationshipIdByIri = new Map(objectProperties.map((property) => [property.iri, property.id]));
  const relationships: Ontology["spec"]["relationships"] = [];
  for (const property of objectProperties) {
    if (!property.domains.length || !property.ranges.length) {
      warnings.push({
        code: "OWL_RELATIONSHIP_WITHOUT_ENDPOINTS",
        message: `Skipped object property '${property.label}' because it lacks a named domain or range.`,
      });
      continue;
    }
    for (const domain of property.domains) {
      for (const range of property.ranges) {
        const sourceTypeId = typeIdFor(domain);
        const targetTypeId = typeIdFor(range);
        if (!sourceTypeId || !targetTypeId) {
          warnings.push({
            code: "OWL_UNKNOWN_RELATIONSHIP_ENDPOINT",
            message: `Skipped object property '${property.label}' because an endpoint is not a declared class.`,
          });
          continue;
        }
        if (relationships.length >= MAX_RELATIONSHIPS) throw new Error(`OWL import exceeds the ${MAX_RELATIONSHIPS} relationship limit.`);
        const suffix = relationships.some((relationship) => relationship.id === property.id) ? `_${sourceTypeId}_${targetTypeId}` : "";
        relationships.push({
          id: `${property.id}${suffix}`,
          label: property.label,
          description: property.description,
          sourceTypeId,
          targetTypeId,
          cardinality: relationshipCardinality(property),
          inverseRelationshipId: property.inverseIri ? relationshipIdByIri.get(resolveIri(property.inverseIri, base)) : undefined,
          sourcePath: `/owl/objectProperties/${property.id}`,
        });
      }
    }
  }

  const emittedRelationshipIds = new Set(relationships.map((relationship) => relationship.id));
  for (const relationship of relationships) {
    if (relationship.inverseRelationshipId && !emittedRelationshipIds.has(relationship.inverseRelationshipId)) {
      warnings.push({
        code: "OWL_INVERSE_NOT_EMITTED",
        message: `Omitted unresolved inverse for relationship '${relationship.label}'.`,
      });
      delete relationship.inverseRelationshipId;
    }
  }

  const cleanTypes = types.map(({ element: _element, ...type }) => type);
  const filenameStem = filename.replace(/\.(owl|rdf|xml)$/i, "");
  const sourceId = ontologyIri ?? filename;
  const ontologyName = slug(iriLocalName(ontologyIri ?? filenameStem));
  const ontology: Ontology = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Ontology",
    metadata: {
      name: ontologyName,
      title: (ontologyElement && text(ontologyElement, "label")) || titleCase(iriLocalName(ontologyIri ?? filenameStem)),
      description: ontologyElement ? text(ontologyElement, "comment") : undefined,
      version: (ontologyElement && (text(ontologyElement, "versionInfo") ?? resources(ontologyElement, "versionIRI", base)[0])) || "1.0.0",
      source: {
        system: "owl",
        sourceId,
        sourcePath: filename,
      },
    },
    spec: { types: cleanTypes, relationships },
  };

  return { ontology, warnings, stats: { types: cleanTypes.length, properties: propertyCount, relationships: relationships.length } };
}
