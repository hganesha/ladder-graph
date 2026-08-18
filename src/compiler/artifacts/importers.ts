import type {
  Diagnostic,
  FieldConfidencePolicy,
  FormField,
  FormRole,
  LadderDocument,
  LadderForm,
  ModelRouting,
  Ontology,
  OntologyCardinality,
  OntologyDataType,
  OntologyProperty,
  ReviewPolicy,
  ValidationRule,
} from "../../types";
import { convertDocuBricksRule } from "./docubricksRules.mjs";

export interface ImportResult<T> {
  ok: boolean;
  artifact?: T;
  counterpartArtifact?: LadderForm | LadderDocument;
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
  family?: string;
  schema_version?: string;
  source_prompt?: string;
  output_contract?: Record<string, unknown>;
  completeness_checklist?: unknown[];
  fields?: DocuBricksFieldSource[];
  sections?: DocuBricksSectionSource[];
}

export interface DocuBricksRuleSource {
  name: string;
  rule_type: string;
  fields?: string[];
  expression?: string;
  severity?: string;
  description?: string;
  field_name?: string;
}

interface DocuBricksThresholdSource {
  default_threshold?: number;
  [field: string]: unknown;
}

interface DocuBricksModelRoutingSource {
  primary?: string;
  fallback_chain?: string[];
  max_tokens?: number;
  temperature?: number;
  timeout_seconds?: number;
  max_retries?: number;
  tier_overrides?: Record<string, unknown>;
  rationale?: string;
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
  if (normalized === "enum") return "string";
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

export interface DocuBricksImportOptions {
  artifactKind: "form" | "document" | "hybrid";
  hybridExperience?: "form" | "document";
  role?: FormRole;
  ontologyProperties?: Record<string, string>;
  thresholdsSource?: string;
  modelRoutingSource?: string;
}

function normalizeReviewPolicy(source: DocuBricksThresholdSource | undefined): ReviewPolicy {
  const fieldConfidence = Object.fromEntries(
    Object.entries(source ?? {}).flatMap(([field, value]) => {
      if (field === "default_threshold" || !value || typeof value !== "object" || Array.isArray(value)) return [];
      const threshold = value as Record<string, unknown>;
      if (typeof threshold.min_confidence !== "number") return [];
      const policy: FieldConfidencePolicy = {
        minConfidence: threshold.min_confidence,
        ...(typeof threshold.review_on_breach === "boolean" ? { reviewOnBreach: threshold.review_on_breach } : {}),
        ...(typeof threshold.fail_on_breach === "boolean" ? { failOnBreach: threshold.fail_on_breach } : {}),
        ...(typeof threshold.regulatory_required === "boolean" ? { regulatoryRequired: threshold.regulatory_required } : {}),
        ...(typeof threshold.description === "string" ? { rationale: threshold.description } : {}),
      };
      return [[field, policy]];
    }),
  );
  return {
    unsupportedRuleAction: "human-review",
    ...(typeof source?.default_threshold === "number" ? { defaultConfidenceThreshold: source.default_threshold } : {}),
    ...(Object.keys(fieldConfidence).length ? { fieldConfidence } : {}),
  };
}

function normalizeModelRouting(source: DocuBricksModelRoutingSource | undefined): ModelRouting | undefined {
  if (!source) return undefined;
  return {
    ...(source.primary ? { primary: source.primary } : {}),
    ...(source.fallback_chain ? { fallbackChain: source.fallback_chain } : {}),
    ...(typeof source.max_tokens === "number" ? { maxTokens: source.max_tokens } : {}),
    ...(typeof source.temperature === "number" ? { temperature: source.temperature } : {}),
    ...(typeof source.timeout_seconds === "number" ? { timeoutSeconds: source.timeout_seconds } : {}),
    ...(typeof source.max_retries === "number" ? { maxRetries: source.max_retries } : {}),
    ...(source.tier_overrides ? { tierOverrides: source.tier_overrides } : {}),
    ...(source.rationale ? { rationale: source.rationale } : {}),
  };
}

export function importDocuBricksSchema(
  fieldsSource: string,
  rulesSource: string | undefined,
  options: DocuBricksImportOptions,
): ImportResult<LadderForm | LadderDocument> {
  const diagnostics: Diagnostic[] = [];
  const schema = parseJson<DocuBricksSchemaSource>(fieldsSource, "/fields", diagnostics);
  const rules = rulesSource ? parseJson<DocuBricksRuleSource[]>(rulesSource, "/validationRules", diagnostics) : [];
  const thresholds = options.thresholdsSource
    ? parseJson<DocuBricksThresholdSource>(options.thresholdsSource, "/fieldThresholds", diagnostics)
    : undefined;
  const routing = options.modelRoutingSource
    ? parseJson<DocuBricksModelRoutingSource>(options.modelRoutingSource, "/modelRouting", diagnostics)
    : undefined;
  if (!schema) return { ok: false, diagnostics };
  const normalizedSchema = schema;
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
  const fieldNames = new Set(normalizedFields.map((field) => field.name));
  const validationRules = (rules ?? []).map((rule) => convertDocuBricksRule(rule, fieldNames) as ValidationRule);
  const reviewPolicy = normalizeReviewPolicy(thresholds);
  const modelRouting = normalizeModelRouting(routing);
  const baseMetadata = {
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

  const sectionSources: DocuBricksSectionSource[] = schema.sections?.length
    ? schema.sections
    : [...new Set(normalizedFields.map((field) => field.section))].map((id) => ({ id, title: title(id) }));

  function formArtifact(name = baseMetadata.name, derivedFrom?: string): LadderForm {
    return {
      apiVersion: "ladder.dev/v1alpha1",
      kind: "Form",
      metadata: {
        ...baseMetadata,
        name,
        ...(name.endsWith("-review") ? { title: `${baseMetadata.title} Review` } : {}),
        source: { ...baseMetadata.source, ...(derivedFrom ? { derivedFrom } : {}) },
      },
      spec: {
        role: options.role ?? (name.endsWith("-review") ? "review" : "start"),
        pages: [
          {
            id: "main",
            title: baseMetadata.title,
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
        validationRules,
        reviewPolicy,
        ...(modelRouting ? { modelRouting } : {}),
        submissionSchema: {},
      },
    };
  }

  function documentArtifact(name = baseMetadata.name, derivedFrom?: string): LadderDocument {
    return {
      apiVersion: "ladder.dev/v1alpha1",
      kind: "Document",
      metadata: {
        ...baseMetadata,
        name,
        ...(name.endsWith("-source") ? { title: `${baseMetadata.title} Source` } : {}),
        source: { ...baseMetadata.source, ...(derivedFrom ? { derivedFrom } : {}) },
      },
      spec: {
        documentType: normalizedSchema.document_type,
        fields: normalizedFields.map(({ section: _section, ...field }) => ({ ...field, sourcePath: `/fields/${field.name}` })),
        sections: sectionSources.map((section) => ({
          id: slug(section.id),
          title: section.title,
          description: section.description,
          fieldIds: (section.fields ?? normalizedFields.filter((field) => field.section === section.id).map((field) => field.name)).map(
            slug,
          ),
        })),
        validationRules,
        reviewPolicy,
        ...(modelRouting ? { modelRouting } : {}),
        outputSchema: {},
        inertSourceMetadata: {
          promptId: normalizedSchema.source_prompt,
          family: normalizedSchema.family,
          outputContract: normalizedSchema.output_contract,
          completenessChecklist: normalizedSchema.completeness_checklist ?? [],
        },
      },
    };
  }

  const artifact = selectedKind === "form" ? formArtifact() : documentArtifact();
  const counterpartArtifact =
    options.artifactKind !== "hybrid"
      ? undefined
      : selectedKind === "form"
        ? documentArtifact(`${baseMetadata.name}-source`, baseMetadata.name)
        : formArtifact(`${baseMetadata.name}-review`, baseMetadata.name);
  return {
    ok: !diagnostics.some((item) => item.severity === "error"),
    artifact,
    ...(counterpartArtifact ? { counterpartArtifact } : {}),
    diagnostics,
  };
}
