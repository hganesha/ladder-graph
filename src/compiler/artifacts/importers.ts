import type {
  Diagnostic,
  DocumentValidationRule,
  FormField,
  FormRole,
  LadderDocument,
  LadderForm,
  Ontology,
  OntologyCardinality,
  OntologyDataType,
  OntologyProperty,
  SafeRule,
} from "../../types";

export interface ImportResult<T> {
  ok: boolean;
  artifact?: T;
  diagnostics: Diagnostic[];
}

interface LatticePropertySource {
  id: string;
  name: string;
  description?: string;
  dataType: string;
  required?: boolean;
  identifier?: boolean;
}

interface LatticeTypeSource {
  id: string;
  label: string;
  description?: string;
  properties?: LatticePropertySource[];
}

interface LatticeRelationshipSource {
  id: string;
  label: string;
  description?: string;
  sourceTypeId: string;
  targetTypeId: string;
  cardinality: string;
}

interface LatticeOntologySource {
  id: string;
  name: string;
  description?: string;
  version?: string;
  digest?: string;
  entityTypes?: LatticeTypeSource[];
  relationshipTypes?: LatticeRelationshipSource[];
}

interface DocuBricksFieldSource {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  section?: string;
}

interface DocuBricksSectionSource {
  id: string;
  title: string;
  description?: string;
  fields?: string[];
}

interface DocuBricksSchemaSource {
  document_type: string;
  vertical?: string;
  schema_version?: string;
  source_prompt?: string;
  fields?: DocuBricksFieldSource[];
  sections?: DocuBricksSectionSource[];
}

interface DocuBricksRuleSource {
  name: string;
  rule_type: string;
  fields?: string[];
  expression?: string;
  severity?: string;
  description?: string;
  field_name?: string;
}

function problem(code: string, severity: Diagnostic["severity"], path: string, message: string): Diagnostic {
  return { code, severity, path, message };
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function title(value: string) {
  return value
    .split(/[_-]/gu)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function parseJson<T>(source: string, path: string, diagnostics: Diagnostic[]): T | undefined {
  try {
    return JSON.parse(source) as T;
  } catch (error) {
    diagnostics.push(
      problem("LI001", "error", path, `JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`),
    );
    return undefined;
  }
}

function ontologyType(source: string): OntologyDataType | undefined {
  const normalized = source.toLowerCase();
  if (["string", "integer", "number", "decimal", "boolean", "date", "datetime", "array", "object"].includes(normalized))
    return normalized as OntologyDataType;
  return undefined;
}

function cardinality(source: string): OntologyCardinality | undefined {
  const normalized = source.toLowerCase().replaceAll("_", "-");
  if (["one-to-one", "one-to-many", "many-to-one", "many-to-many"].includes(normalized)) return normalized as OntologyCardinality;
  return undefined;
}

export function importLatticeOntology(source: string): ImportResult<Ontology> {
  const diagnostics: Diagnostic[] = [];
  const parsed = parseJson<{ ontology?: LatticeOntologySource } | LatticeOntologySource>(source, "/", diagnostics);
  if (!parsed) return { ok: false, diagnostics };
  const input = "ontology" in parsed && parsed.ontology ? parsed.ontology : (parsed as LatticeOntologySource);
  if (!input.id || !input.name) {
    diagnostics.push(problem("LI100", "error", "/ontology", "Lattice ontology export requires id and name."));
    return { ok: false, diagnostics };
  }
  const types = (input.entityTypes ?? []).map((type, typeIndex) => ({
    id: type.id,
    label: type.label,
    description: type.description,
    sourcePath: `/ontology/entityTypes/${typeIndex}`,
    properties: (type.properties ?? []).flatMap((property, propertyIndex) => {
      const dataType = ontologyType(property.dataType);
      if (!dataType) {
        diagnostics.push(
          problem(
            "LI101",
            "error",
            `/ontology/entityTypes/${typeIndex}/properties/${propertyIndex}/dataType`,
            `Unsupported Lattice data type '${property.dataType}'.`,
          ),
        );
        return [];
      }
      const normalized: OntologyProperty = {
        id: property.id,
        label: property.name,
        description: property.description,
        dataType,
        required: property.required,
        identifier: property.identifier,
        sourcePath: `/ontology/entityTypes/${typeIndex}/properties/${propertyIndex}`,
      };
      return [normalized];
    }),
  }));
  const relationships = (input.relationshipTypes ?? []).flatMap((relationship, index) => {
    const normalizedCardinality = cardinality(relationship.cardinality);
    if (!normalizedCardinality) {
      diagnostics.push(
        problem(
          "LI102",
          "error",
          `/ontology/relationshipTypes/${index}/cardinality`,
          `Unsupported Lattice cardinality '${relationship.cardinality}'.`,
        ),
      );
      return [];
    }
    return [
      {
        id: relationship.id,
        label: relationship.label,
        description: relationship.description,
        sourceTypeId: relationship.sourceTypeId,
        targetTypeId: relationship.targetTypeId,
        cardinality: normalizedCardinality,
        sourcePath: `/ontology/relationshipTypes/${index}`,
      },
    ];
  });
  const artifact: Ontology = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Ontology",
    metadata: {
      name: slug(input.id.replace(/-ontology$/u, "")),
      title: input.name,
      description: input.description,
      version: input.version ?? "unversioned",
      source: {
        system: "lattice",
        sourceId: input.id,
        sourceVersion: input.version,
        sourceDigest: input.digest,
      },
    },
    spec: { types, relationships },
  };
  return { ok: !diagnostics.some((item) => item.severity === "error"), artifact, diagnostics };
}

function docuBricksType(source: string): FormField["dataType"] | undefined {
  if (source.startsWith("array<")) return "array";
  if (["string", "integer", "number", "boolean", "date", "datetime", "array", "object"].includes(source))
    return source as FormField["dataType"];
  return undefined;
}

function convertRule(rule: DocuBricksRuleSource, fieldNames: Set<string>): DocumentValidationRule {
  const field = rule.field_name ?? rule.fields?.[0];
  let safeRule: SafeRule | undefined;
  if (rule.rule_type === "presence" && field && fieldNames.has(field)) safeRule = { op: "present", field };
  else if (rule.rule_type === "range" && field && fieldNames.has(field) && />=\s*0/u.test(rule.expression ?? ""))
    safeRule = { op: "gte", left: { field }, right: { value: 0 } };
  return {
    id: slug(rule.name),
    severity: rule.severity === "fail" ? "error" : "warning",
    description: rule.description,
    rule: safeRule,
    sourceExpression: rule.expression,
    supported: Boolean(safeRule),
  };
}

export interface DocuBricksImportOptions {
  artifactKind: "form" | "document" | "hybrid";
  hybridExperience?: "form" | "document";
  role?: FormRole;
  ontologyProperties?: Record<string, string>;
}

export function importDocuBricksSchema(
  fieldsSource: string,
  rulesSource: string | undefined,
  options: DocuBricksImportOptions,
): ImportResult<LadderForm | LadderDocument> {
  const diagnostics: Diagnostic[] = [];
  const schema = parseJson<DocuBricksSchemaSource>(fieldsSource, "/fields", diagnostics);
  const rules = rulesSource ? parseJson<DocuBricksRuleSource[]>(rulesSource, "/validationRules", diagnostics) : [];
  if (!schema) return { ok: false, diagnostics };
  const selectedKind = options.artifactKind === "hybrid" ? options.hybridExperience : options.artifactKind;
  if (!selectedKind) {
    diagnostics.push(
      problem("DI100", "error", "/classification", "Hybrid DocuBricks assets require an explicit form or document experience."),
    );
    return { ok: false, diagnostics };
  }
  const normalizedFields = (schema.fields ?? []).flatMap((field, index) => {
    const dataType = docuBricksType(field.type);
    if (!dataType) {
      diagnostics.push(problem("DI101", "error", `/fields/${index}/type`, `Unsupported DocuBricks type '${field.type}'.`));
      return [];
    }
    return [
      {
        id: slug(field.name),
        name: field.name,
        label: title(field.name),
        description: field.description,
        dataType,
        required: field.required,
        ontologyPropertyRef: options.ontologyProperties?.[field.name],
        section: field.section ?? "details",
      },
    ];
  });
  const metadata = {
    name: slug(schema.document_type),
    title: title(schema.document_type),
    version: schema.schema_version ?? "unversioned",
    source: {
      system: "docubricks",
      sourceId: schema.schema_version ?? schema.document_type,
      sourcePath: `Schemas/${schema.vertical ?? "unknown"}/${schema.document_type}`,
      sourceVersion: schema.schema_version,
    },
  };
  if (selectedKind === "form") {
    const sectionSources: DocuBricksSectionSource[] = schema.sections?.length
      ? schema.sections
      : [...new Set(normalizedFields.map((field) => field.section))].map((id) => ({ id, title: title(id) }));
    const artifact: LadderForm = {
      apiVersion: "ladder.dev/v1alpha1",
      kind: "Form",
      metadata,
      spec: {
        role: options.role ?? "start",
        pages: [
          {
            id: "main",
            title: metadata.title,
            sections: sectionSources.map((section) => ({
              id: slug(section.id),
              title: section.title,
              description: section.description,
              fields: normalizedFields
                .filter((field) => (section.fields?.length ? section.fields.includes(field.name) : field.section === section.id))
                .map(({ section: _section, ...field }) => field),
            })),
          },
        ],
        submissionSchema: {},
      },
    };
    if (rules?.length)
      diagnostics.push(
        problem(
          "DI120",
          "warning",
          "/validationRules",
          "DocuBricks extraction rules remain source metadata for form imports in this version.",
        ),
      );
    return { ok: !diagnostics.some((item) => item.severity === "error"), artifact, diagnostics };
  }
  const artifact: LadderDocument = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Document",
    metadata,
    spec: {
      documentType: schema.document_type,
      fields: normalizedFields.map(({ section: _section, ...field }) => ({ ...field, sourcePath: `/fields/${field.name}` })),
      sections: (schema.sections ?? []).map((section) => ({
        id: slug(section.id),
        title: section.title,
        description: section.description,
        fieldIds: (section.fields ?? []).map(slug),
      })),
      validationRules: (rules ?? []).map((rule) => convertRule(rule, new Set(normalizedFields.map((field) => field.name)))),
      outputSchema: {},
      inertSourceMetadata: { promptId: schema.source_prompt },
    },
  };
  return { ok: !diagnostics.some((item) => item.severity === "error"), artifact, diagnostics };
}
