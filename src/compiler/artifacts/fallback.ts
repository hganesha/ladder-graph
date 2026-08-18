import { parseDocument, stringify } from "yaml";
import { allFormFields, formSubmissionSchema, formUiSchema } from "../../lib/formOutputs";
import type {
  ArtifactAnalysisResult,
  BundleCompileResult,
  BundleLockEntry,
  BundleLockfile,
  Diagnostic,
  DocumentField,
  FormatResult,
  FormField,
  LadderArtifact,
  LadderDocument,
  LadderForm,
  Ontology,
  OntologyProperty,
  OntologySelection,
  OntologySliceResult,
  ResolvedBundleAsset,
  SafeRule,
  Target,
  ValidationRule,
  Workflow,
  WorkflowBundle,
} from "../../types";
import { analyzeFallback, compileFallback } from "../fallback";

const API_VERSION = "ladder.dev/v1alpha1";
const ARTIFACT_COMPILER_VERSION = "0.1.0-artifacts-web";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ARTIFACT_KINDS = new Set(["Ontology", "Form", "Document", "WorkflowBundle"]);
const DATA_TYPES = new Set(["string", "integer", "number", "decimal", "boolean", "date", "datetime", "array", "object"]);
const FORM_ROLES = new Set(["start", "clarification", "review", "approval", "exception", "completion"]);
const TRANSFORMS = new Set(["select", "rename", "merge", "filter", "deduplicate", "sort", "slice"]);

function issue(code: string, severity: Diagnostic["severity"], path: string, message: string): Diagnostic {
  return { code, severity, path, message };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonical(child)]),
  );
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonical(value), null, 2);
}

function agentOntology(ontology: Ontology): Ontology {
  const { source: _source, ...metadata } = ontology.metadata;
  return {
    ...ontology,
    metadata,
    spec: {
      types: ontology.spec.types.map((type) => {
        const { sourcePath: _typeSourcePath, ...content } = type;
        return {
          ...content,
          properties: type.properties.map((property) => {
            const { sourcePath: _propertySourcePath, ...propertyContent } = property;
            return propertyContent;
          }),
        };
      }),
      relationships: ontology.spec.relationships.map((relationship) => {
        const { sourcePath: _relationshipSourcePath, ...content } = relationship;
        return content;
      }),
    },
  };
}

async function hash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let fallback = 2166136261;
  for (const byte of bytes) fallback = Math.imul(fallback ^ byte, 16777619);
  return `fnv-${(fallback >>> 0).toString(16).padStart(8, "0")}`;
}

function secureParse(source: string): { value?: unknown; diagnostics: Diagnostic[] } {
  if (source.length > 2_000_000) return { diagnostics: [issue("LA001", "error", "/", "Artifact source exceeds the 2 MB import limit.")] };
  if (source.includes("!!") || source.includes("!<"))
    return { diagnostics: [issue("LA002", "error", "/", "Custom YAML tags are not supported.")] };
  if (/(^|\s)[&*][A-Za-z0-9_-]+/u.test(source))
    return { diagnostics: [issue("LA004", "error", "/", "YAML anchors and aliases are not supported.")] };
  if (/^\s*["']?\$ref["']?\s*:\s*["']?(?:https?:|\/\/)/mu.test(source))
    return { diagnostics: [issue("LA005", "error", "/", "External schema references are not supported.")] };
  try {
    const document = parseDocument(source, { uniqueKeys: true, strict: true });
    if (document.errors.length) {
      return {
        diagnostics: document.errors.map((error) => issue("LA003", "error", "/", `YAML could not be parsed: ${error.message}`)),
      };
    }
    return { value: document.toJS({ maxAliasCount: 50 }), diagnostics: [] };
  } catch (error) {
    return {
      diagnostics: [issue("LA003", "error", "/", `YAML could not be parsed: ${error instanceof Error ? error.message : String(error)}`)],
    };
  }
}

function validateEnvelope(value: unknown, diagnostics: Diagnostic[]): value is LadderArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(issue("LA100", "error", "/", "Artifact source must contain one object."));
    return false;
  }
  const artifact = value as Partial<LadderArtifact>;
  if (artifact.apiVersion !== API_VERSION) diagnostics.push(issue("LA101", "error", "/apiVersion", `Expected apiVersion ${API_VERSION}.`));
  if (!ARTIFACT_KINDS.has(String(artifact.kind)))
    diagnostics.push(issue("LA102", "error", "/kind", "kind must be Ontology, Form, Document, or WorkflowBundle."));
  const name = artifact.metadata?.name;
  if (!name || !SLUG.test(name)) diagnostics.push(issue("LA103", "error", "/metadata/name", "metadata.name must be a lowercase slug."));
  if (!artifact.metadata?.version)
    diagnostics.push(issue("LA104", "warning", "/metadata/version", "Set a version so bundles can lock this artifact reproducibly."));
  return Boolean(artifact.kind && ARTIFACT_KINDS.has(String(artifact.kind)));
}

function addDuplicate(diagnostics: Diagnostic[], seen: Set<string>, value: string, path: string, label: string) {
  if (!value) diagnostics.push(issue("LA110", "error", path, `${label} must not be empty.`));
  else if (seen.has(value)) diagnostics.push(issue("LA111", "error", path, `Duplicate ${label.toLowerCase()} '${value}'.`));
  seen.add(value);
}

function validateOntology(ontology: Ontology, diagnostics: Diagnostic[]) {
  const types = ontology.spec?.types ?? [];
  const relationships = ontology.spec?.relationships ?? [];
  if (types.length > 1000) diagnostics.push(issue("LO100", "error", "/spec/types", "Ontologies are limited to 1,000 types."));
  const typeIds = new Set<string>();
  const propertyIds = new Set<string>();
  for (const [typeIndex, type] of types.entries()) {
    const path = `/spec/types/${typeIndex}`;
    addDuplicate(diagnostics, typeIds, type.id, `${path}/id`, "Type ID");
    if (!type.label?.trim()) diagnostics.push(issue("LO101", "error", `${path}/label`, "Ontology types require a label."));
    const localPropertyIds = new Set<string>();
    for (const [propertyIndex, property] of (type.properties ?? []).entries()) {
      const propertyPath = `${path}/properties/${propertyIndex}`;
      addDuplicate(diagnostics, localPropertyIds, property.id, `${propertyPath}/id`, "Property ID");
      if (propertyIds.has(property.id))
        diagnostics.push(issue("LO102", "error", `${propertyPath}/id`, `Property ID '${property.id}' is not globally unique.`));
      propertyIds.add(property.id);
      if (!property.label?.trim())
        diagnostics.push(issue("LO103", "error", `${propertyPath}/label`, "Ontology properties require a label."));
      if (!DATA_TYPES.has(property.dataType))
        diagnostics.push(issue("LO104", "error", `${propertyPath}/dataType`, `Unsupported ontology data type '${property.dataType}'.`));
    }
  }
  for (const [typeIndex, type] of types.entries()) {
    for (const parent of type.parentTypeIds ?? []) {
      if (!typeIds.has(parent))
        diagnostics.push(issue("LO105", "error", `/spec/types/${typeIndex}/parentTypeIds`, `Missing parent type '${parent}'.`));
      if (parent === type.id)
        diagnostics.push(issue("LO106", "error", `/spec/types/${typeIndex}/parentTypeIds`, "A type cannot inherit from itself."));
    }
  }
  const relationshipIds = new Set<string>();
  for (const [index, relationship] of relationships.entries()) {
    const path = `/spec/relationships/${index}`;
    addDuplicate(diagnostics, relationshipIds, relationship.id, `${path}/id`, "Relationship ID");
    if (!typeIds.has(relationship.sourceTypeId))
      diagnostics.push(issue("LO107", "error", `${path}/sourceTypeId`, `Missing source type '${relationship.sourceTypeId}'.`));
    if (!typeIds.has(relationship.targetTypeId))
      diagnostics.push(issue("LO108", "error", `${path}/targetTypeId`, `Missing target type '${relationship.targetTypeId}'.`));
  }
  for (const [index, relationship] of relationships.entries()) {
    if (relationship.inverseRelationshipId && !relationshipIds.has(relationship.inverseRelationshipId))
      diagnostics.push(
        issue(
          "LO109",
          "error",
          `/spec/relationships/${index}/inverseRelationshipId`,
          `Missing inverse relationship '${relationship.inverseRelationshipId}'.`,
        ),
      );
  }
}

function ruleDepth(rule: SafeRule): number {
  if (rule.op === "not") return 1 + ruleDepth(rule.rule);
  if (rule.op === "and" || rule.op === "or") return 1 + Math.max(0, ...rule.rules.map(ruleDepth));
  return 1;
}

function ruleFields(rule: SafeRule): string[] {
  if (rule.op === "present") return [rule.field];
  if (rule.op === "not") return ruleFields(rule.rule);
  if (rule.op === "and" || rule.op === "or") return rule.rules.flatMap(ruleFields);
  if ("left" in rule) {
    const operands = "right" in rule ? [rule.left, rule.right] : [rule.left];
    return operands.flatMap((operand) => {
      if ("field" in operand) return [operand.field];
      if ("length" in operand) return [operand.length];
      return [];
    });
  }
  return [];
}

function validateSafeRule(rule: SafeRule | undefined, fields: Set<string>, path: string, diagnostics: Diagnostic[]) {
  if (!rule) return;
  if (ruleDepth(rule) > 4) diagnostics.push(issue("LF130", "error", path, "Declarative form rules are limited to four levels."));
  for (const field of ruleFields(rule)) {
    if (!fields.has(field)) diagnostics.push(issue("LF131", "error", path, `Rule references missing field '${field}'.`));
  }
  if (rule.op === "matches") {
    try {
      new RegExp(rule.pattern);
    } catch {
      diagnostics.push(issue("LF132", "error", `${path}/pattern`, `Rule contains invalid regular expression '${rule.pattern}'.`));
    }
  }
}

function validateRules(
  rules: ValidationRule[] | undefined,
  fields: Set<string>,
  path: string,
  unsupportedCode: string,
  diagnostics: Diagnostic[],
) {
  const availableFields = new Set([...fields, "avg_confidence", "document_id"]);
  for (const [index, rule] of (rules ?? []).entries()) {
    const rulePath = `${path}/${index}`;
    if (!rule.supported) {
      const reason = rule.unsupportedReason ? ` Reason: ${rule.unsupportedReason}` : "";
      diagnostics.push(
        issue(
          unsupportedCode,
          "warning",
          rulePath,
          `Rule '${rule.id}' is preserved as inert source metadata and will not execute.${reason}`,
        ),
      );
    } else validateSafeRule(rule.rule, availableFields, `${rulePath}/rule`, diagnostics);
  }
}

function validateField(field: FormField | DocumentField, path: string, diagnostics: Diagnostic[]) {
  if (!field.name || !SLUG.test(field.name.replaceAll("_", "-")))
    diagnostics.push(
      issue("LF110", "error", `${path}/name`, "Field names must contain lowercase letters, numbers, underscores, or hyphens."),
    );
  if (!field.label?.trim()) diagnostics.push(issue("LF111", "error", `${path}/label`, "Fields require a visible label."));
  if (!DATA_TYPES.has(field.dataType))
    diagnostics.push(issue("LF112", "error", `${path}/dataType`, `Unsupported field data type '${field.dataType}'.`));
}

function validateForm(form: LadderForm, diagnostics: Diagnostic[]) {
  if (!FORM_ROLES.has(form.spec?.role)) diagnostics.push(issue("LF100", "error", "/spec/role", "Unsupported form role."));
  const ids = new Set<string>();
  const names = new Set<string>();
  const fields: Array<{ value: FormField; path: string }> = [];
  for (const [pageIndex, page] of (form.spec?.pages ?? []).entries()) {
    if (!page.title?.trim()) diagnostics.push(issue("LF101", "error", `/spec/pages/${pageIndex}/title`, "Form pages require a title."));
    for (const [sectionIndex, section] of (page.sections ?? []).entries()) {
      const sectionPath = `/spec/pages/${pageIndex}/sections/${sectionIndex}`;
      if (!section.title?.trim()) diagnostics.push(issue("LF102", "error", `${sectionPath}/title`, "Form sections require a title."));
      for (const [fieldIndex, field] of (section.fields ?? []).entries()) {
        const path = `${sectionPath}/fields/${fieldIndex}`;
        addDuplicate(diagnostics, ids, field.id, `${path}/id`, "Field ID");
        addDuplicate(diagnostics, names, field.name, `${path}/name`, "Field name");
        validateField(field, path, diagnostics);
        if (field.span && ![1, 2].includes(field.span))
          diagnostics.push(issue("LF113", "error", `${path}/span`, "Field span must be one or two columns."));
        fields.push({ value: field, path });
      }
    }
  }
  for (const field of fields) {
    validateSafeRule(field.value.visibleWhen, names, `${field.path}/visibleWhen`, diagnostics);
    validateSafeRule(field.value.enabledWhen, names, `${field.path}/enabledWhen`, diagnostics);
  }
  validateRules(form.spec?.validationRules, names, "/spec/validationRules", "LF120", diagnostics);
}

function validateDocument(document: LadderDocument, diagnostics: Diagnostic[]) {
  if (!document.spec?.documentType?.trim())
    diagnostics.push(issue("LD100", "error", "/spec/documentType", "Documents require a documentType."));
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const [index, field] of (document.spec?.fields ?? []).entries()) {
    const path = `/spec/fields/${index}`;
    addDuplicate(diagnostics, ids, field.id, `${path}/id`, "Field ID");
    addDuplicate(diagnostics, names, field.name, `${path}/name`, "Field name");
    validateField(field, path, diagnostics);
  }
  for (const [sectionIndex, section] of (document.spec?.sections ?? []).entries()) {
    for (const fieldId of section.fieldIds ?? []) {
      if (!ids.has(fieldId))
        diagnostics.push(
          issue("LD101", "error", `/spec/sections/${sectionIndex}/fieldIds`, `Section references missing field '${fieldId}'.`),
        );
    }
  }
  validateRules(document.spec?.validationRules, names, "/spec/validationRules", "LD120", diagnostics);
}

function validPointer(path: string) {
  return (
    path.startsWith("/") &&
    !path
      .split("/")
      .slice(1)
      .some((segment) => /~(?![01])/u.test(segment))
  );
}

function validateBundle(bundle: WorkflowBundle, diagnostics: Diagnostic[]) {
  const refs = new Set<string>(
    [
      bundle.spec?.workflowRef,
      bundle.spec?.ontology?.ref,
      ...(bundle.spec?.forms ?? []).map((item) => item.ref),
      ...(bundle.spec?.documents ?? []).map((item) => item.ref),
    ].filter(Boolean) as string[],
  );
  if (!bundle.spec?.workflowRef?.startsWith("ladder://"))
    diagnostics.push(issue("LB100", "error", "/spec/workflowRef", "workflowRef must be a ladder:// URI."));
  if (bundle.spec?.ontology && !bundle.spec.ontology.ref.startsWith("ladder://"))
    diagnostics.push(issue("LB101", "error", "/spec/ontology/ref", "Ontology ref must be a ladder:// URI."));
  const bindingIds = new Set<string>();
  for (const [index, binding] of (bundle.spec?.bindings ?? []).entries()) {
    const path = `/spec/bindings/${index}`;
    addDuplicate(diagnostics, bindingIds, binding.id, `${path}/id`, "Binding ID");
    if (!refs.has(binding.source.ref))
      diagnostics.push(
        issue("LB102", "error", `${path}/source/ref`, `Binding source '${binding.source.ref}' is not attached to this bundle.`),
      );
    if (!refs.has(binding.target.ref))
      diagnostics.push(
        issue("LB103", "error", `${path}/target/ref`, `Binding target '${binding.target.ref}' is not attached to this bundle.`),
      );
    if (!validPointer(binding.source.path))
      diagnostics.push(issue("LB104", "error", `${path}/source/path`, "Binding source path must be a valid JSON Pointer."));
    if (!validPointer(binding.target.path))
      diagnostics.push(issue("LB105", "error", `${path}/target/path`, "Binding target path must be a valid JSON Pointer."));
    if (binding.transform && !TRANSFORMS.has(binding.transform))
      diagnostics.push(issue("LB106", "error", `${path}/transform`, "Binding transform is not in the safe declarative set."));
  }
}

export async function analyzeArtifactFallback<T extends LadderArtifact = LadderArtifact>(
  source: string,
): Promise<ArtifactAnalysisResult<T>> {
  const parsed = secureParse(source);
  const diagnostics = [...parsed.diagnostics];
  if (diagnostics.length > 0) return { ok: false, sourceHash: "", diagnostics };
  if (!validateEnvelope(parsed.value, diagnostics)) return { ok: false, sourceHash: "", diagnostics };
  const artifact = parsed.value;
  if (artifact.kind === "Ontology") validateOntology(artifact, diagnostics);
  else if (artifact.kind === "Form") validateForm(artifact, diagnostics);
  else if (artifact.kind === "Document") validateDocument(artifact, diagnostics);
  else validateBundle(artifact, diagnostics);
  return {
    ok: !diagnostics.some((item) => item.severity === "error"),
    sourceHash: await hash(artifact),
    diagnostics,
    normalized: artifact as T,
  };
}

export async function formatArtifactFallback(source: string): Promise<FormatResult> {
  const analysis = await analyzeArtifactFallback(source);
  return {
    ok: analysis.ok,
    content: analysis.normalized ? stringify(analysis.normalized, { lineWidth: 110 }) : "",
    diagnostics: analysis.diagnostics,
  };
}

function propertyIndex(ontology: Ontology) {
  const result = new Map<string, { owner: Ontology["spec"]["types"][number]; property: OntologyProperty }>();
  for (const type of ontology.spec.types) for (const property of type.properties) result.set(property.id, { owner: type, property });
  return result;
}

export async function sliceOntologyFallback(source: string, selection: OntologySelection): Promise<OntologySliceResult> {
  const analysis = await analyzeArtifactFallback<Ontology>(source);
  const diagnostics = [...analysis.diagnostics];
  if (analysis.normalized?.kind !== "Ontology") {
    if (analysis.normalized) diagnostics.push(issue("LO200", "error", "/kind", "Ontology slicing requires an Ontology artifact."));
    return {
      ok: false,
      sourceHash: analysis.sourceHash,
      selectionHash: "",
      includedTypeIds: [],
      includedPropertyRefs: [],
      includedRelationshipIds: [],
      inclusionReasons: {},
      diagnostics,
    };
  }
  const ontology = analysis.normalized;
  const types = new Map(ontology.spec.types.map((type) => [type.id, type]));
  const properties = propertyIndex(ontology);
  const relationships = new Map(ontology.spec.relationships.map((relationship) => [relationship.id, relationship]));
  const includedTypes = new Set<string>();
  const includedProperties = new Set<string>();
  const includedRelationships = new Set<string>();
  const reasons = new Map<string, Set<string>>();
  const addReason = (id: string, reason: string) => reasons.set(id, new Set([...(reasons.get(id) ?? []), reason]));
  const includeIdentity = (typeId: string, reason: string) => {
    const type = types.get(typeId);
    if (!type) return;
    includedTypes.add(typeId);
    addReason(typeId, reason);
    for (const property of type.properties.filter((item) => item.identifier || item.required)) {
      includedProperties.add(property.id);
      addReason(property.id, `Required identity/constraint for ${typeId}`);
    }
  };
  for (const typeId of [...new Set(selection.typeIds ?? [])].sort()) {
    const type = types.get(typeId);
    if (!type) diagnostics.push(issue("LO201", "error", "/selection/typeIds", `Selected type '${typeId}' does not exist.`));
    else {
      includeIdentity(typeId, "Explicit type selection");
      for (const property of type.properties) {
        includedProperties.add(property.id);
        addReason(property.id, `Included with explicitly selected type ${typeId}`);
      }
    }
  }
  for (const propertyRef of [...new Set(selection.propertyRefs ?? [])].sort()) {
    const entry = properties.get(propertyRef);
    if (!entry) diagnostics.push(issue("LO202", "error", "/selection/propertyRefs", `Selected property '${propertyRef}' does not exist.`));
    else {
      includedProperties.add(propertyRef);
      addReason(propertyRef, "Explicit property selection");
      includeIdentity(entry.owner.id, `Owns selected property ${propertyRef}`);
    }
  }
  const includeRelationship = (relationshipId: string, reason: string) => {
    const relationship = relationships.get(relationshipId);
    if (!relationship) return false;
    includedRelationships.add(relationshipId);
    addReason(relationshipId, reason);
    includeIdentity(relationship.sourceTypeId, `Source of relationship ${relationshipId}`);
    includeIdentity(relationship.targetTypeId, `Target of relationship ${relationshipId}`);
    return true;
  };
  for (const relationshipId of [...new Set(selection.relationshipIds ?? [])].sort()) {
    if (!includeRelationship(relationshipId, "Explicit relationship selection"))
      diagnostics.push(issue("LO203", "error", "/selection/relationshipIds", `Selected relationship '${relationshipId}' does not exist.`));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const typeId of [...includedTypes]) {
      const type = types.get(typeId);
      for (const parentId of type?.parentTypeIds ?? []) {
        if (!includedTypes.has(parentId)) {
          includeIdentity(parentId, `Ancestor of ${typeId}`);
          const parent = types.get(parentId);
          for (const property of parent?.properties ?? []) {
            includedProperties.add(property.id);
            addReason(property.id, `Inherited from ancestor ${parentId}`);
          }
          changed = true;
        }
      }
      for (const relationship of ontology.spec.relationships.filter((item) => item.required && item.sourceTypeId === typeId)) {
        if (!includedRelationships.has(relationship.id)) {
          includeRelationship(relationship.id, `Mandatory relationship for ${typeId}`);
          changed = true;
        }
      }
    }
  }
  const slicedTypes = ontology.spec.types
    .filter((type) => includedTypes.has(type.id))
    .map((type) => ({
      ...type,
      properties: type.properties.filter((property) => includedProperties.has(property.id)).sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const slicedRelationships = ontology.spec.relationships
    .filter((relationship) => includedRelationships.has(relationship.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const selectionHash = await hash({
    typeIds: [...includedTypes].sort(),
    propertyRefs: [...includedProperties].sort(),
    relationshipIds: [...includedRelationships].sort(),
  });
  const sliver: Ontology = {
    ...ontology,
    metadata: {
      ...ontology.metadata,
      name: `${ontology.metadata.name}-sliver`,
      title: `${ontology.metadata.title ?? ontology.metadata.name} sliver`,
      description: `Selected context from ${ontology.metadata.name}.`,
    },
    spec: { types: slicedTypes, relationships: slicedRelationships },
  };
  return {
    ok: !diagnostics.some((item) => item.severity === "error"),
    sourceHash: analysis.sourceHash,
    selectionHash,
    ontology: sliver,
    includedTypeIds: [...includedTypes].sort(),
    includedPropertyRefs: [...includedProperties].sort(),
    includedRelationshipIds: [...includedRelationships].sort(),
    inclusionReasons: Object.fromEntries(
      [...reasons].sort(([left], [right]) => left.localeCompare(right)).map(([id, values]) => [id, [...values].sort()]),
    ),
    diagnostics,
  };
}

function pointerValue(value: unknown, pointer: string): { found: boolean; value?: unknown } {
  if (pointer === "") return { found: true, value };
  if (!validPointer(pointer)) return { found: false };
  let current = value;
  for (const raw of pointer.split("/").slice(1)) {
    const segment = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!current || typeof current !== "object" || !(segment in current)) return { found: false };
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function jsonSchemaForFields(fields: Array<FormField | DocumentField>) {
  return {
    type: "object",
    additionalProperties: false,
    required: fields.filter((field) => field.required).map((field) => field.name),
    properties: Object.fromEntries(
      [...fields]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((field) => {
          const type = field.dataType === "date" || field.dataType === "datetime" ? "string" : field.dataType;
          const schema: Record<string, unknown> = { type, title: field.label };
          if (field.description) schema.description = field.description;
          if (field.dataType === "date") schema.format = "date";
          if (field.dataType === "datetime") schema.format = "date-time";
          if ("allowedValues" in field && field.allowedValues?.length) schema.enum = field.allowedValues;
          if ("minimum" in field && field.minimum !== undefined) schema.minimum = field.minimum;
          if ("maximum" in field && field.maximum !== undefined) schema.maximum = field.maximum;
          if ("minLength" in field && field.minLength !== undefined) schema.minLength = field.minLength;
          if ("maxLength" in field && field.maxLength !== undefined) schema.maxLength = field.maxLength;
          return [field.name, schema];
        }),
    ),
  };
}

function fieldForPointer(artifact: LadderArtifact | Workflow, pointer: string): FormField | DocumentField | undefined {
  const result = pointerValue(artifact, pointer);
  if (!result.found || !result.value || typeof result.value !== "object") return undefined;
  const candidate = result.value as Partial<FormField | DocumentField>;
  return candidate.name && candidate.dataType ? (candidate as FormField | DocumentField) : undefined;
}

function compatibleTypes(field: FormField | DocumentField, property: OntologyProperty) {
  const normalize = (type: string) => (type === "decimal" ? "number" : type === "date" || type === "datetime" ? "string" : type);
  return normalize(field.dataType) === normalize(property.dataType);
}

export async function compileBundleFallback(
  source: string,
  resolvedAssets: ResolvedBundleAsset[],
  target: Target,
): Promise<BundleCompileResult> {
  const bundleAnalysis = await analyzeArtifactFallback<WorkflowBundle>(source);
  const diagnostics = [...bundleAnalysis.diagnostics];
  const capabilityReport = {
    target,
    native: ["workflow compilation", "portable form contracts", "deterministic ontology slivers", "bundle lockfiles"],
    instructional: ["host-provided form rendering", "host-provided workflow execution"],
    unsupported: [] as string[],
  };
  if (bundleAnalysis.normalized?.kind !== "WorkflowBundle") {
    if (bundleAnalysis.normalized)
      diagnostics.push(issue("LB200", "error", "/kind", "Bundle compilation requires a WorkflowBundle artifact."));
    return { ok: false, artifacts: [], lockfile: null, diagnostics, capabilityReport };
  }
  const bundle = bundleAnalysis.normalized;
  const sourceByRef = new Map(resolvedAssets.map((asset) => [asset.ref, asset.source]));
  const requiredRefs = [
    bundle.spec.workflowRef,
    bundle.spec.ontology?.ref,
    ...(bundle.spec.forms ?? []).map((item) => item.ref),
    ...(bundle.spec.documents ?? []).map((item) => item.ref),
  ].filter(Boolean) as string[];
  const parsedAssets = new Map<string, LadderArtifact | Workflow>();
  const sourceHashes = new Map<string, string>();
  for (const ref of [...new Set(requiredRefs)].sort()) {
    const assetSource = sourceByRef.get(ref);
    if (!assetSource) {
      diagnostics.push(issue("LB201", "error", "/spec", `Resolved source is missing for '${ref}'.`));
      continue;
    }
    if (ref === bundle.spec.workflowRef) {
      const workflow = await analyzeFallback(assetSource, target);
      diagnostics.push(...workflow.diagnostics.map((item) => ({ ...item, path: `${ref}${item.path}` })));
      if (workflow.normalized) parsedAssets.set(ref, workflow.normalized);
      sourceHashes.set(ref, workflow.sourceHash);
    } else {
      const artifact = await analyzeArtifactFallback(assetSource);
      diagnostics.push(...artifact.diagnostics.map((item) => ({ ...item, path: `${ref}${item.path}` })));
      if (artifact.normalized) parsedAssets.set(ref, artifact.normalized);
      sourceHashes.set(ref, artifact.sourceHash);
    }
  }
  for (const attachment of bundle.spec.forms ?? []) {
    if (parsedAssets.get(attachment.ref)?.kind !== "Form")
      diagnostics.push(issue("LB202", "error", "/spec/forms", `'${attachment.ref}' must resolve to a Form.`));
  }
  for (const attachment of bundle.spec.documents ?? []) {
    if (parsedAssets.get(attachment.ref)?.kind !== "Document")
      diagnostics.push(issue("LB203", "error", "/spec/documents", `'${attachment.ref}' must resolve to a Document.`));
  }
  const ontologyRef = bundle.spec.ontology?.ref;
  const ontology = ontologyRef ? parsedAssets.get(ontologyRef) : undefined;
  if (ontologyRef && ontology?.kind !== "Ontology")
    diagnostics.push(issue("LB204", "error", "/spec/ontology/ref", `'${ontologyRef}' must resolve to an Ontology.`));
  const properties =
    ontology?.kind === "Ontology" ? propertyIndex(ontology) : new Map<string, { owner: never; property: OntologyProperty }>();
  const selectedRefs = new Set(bundle.spec.ontology?.selection?.propertyRefs ?? []);
  for (const [index, binding] of (bundle.spec.bindings ?? []).entries()) {
    const sourceAsset = parsedAssets.get(binding.source.ref);
    const targetAsset = parsedAssets.get(binding.target.ref);
    if (sourceAsset && !pointerValue(sourceAsset, binding.source.path).found)
      diagnostics.push(
        issue(
          "LB210",
          "error",
          `/spec/bindings/${index}/source/path`,
          `Source pointer '${binding.source.path}' does not exist in '${binding.source.ref}'.`,
        ),
      );
    if (targetAsset && !pointerValue(targetAsset, binding.target.path).found)
      diagnostics.push(
        issue(
          "LB211",
          "error",
          `/spec/bindings/${index}/target/path`,
          `Target pointer '${binding.target.path}' does not exist in '${binding.target.ref}'.`,
        ),
      );
    if (binding.ontologyPropertyRef) {
      const property = properties.get(binding.ontologyPropertyRef)?.property;
      if (!property)
        diagnostics.push(
          issue(
            "LB212",
            "error",
            `/spec/bindings/${index}/ontologyPropertyRef`,
            `Ontology property '${binding.ontologyPropertyRef}' does not exist.`,
          ),
        );
      else {
        selectedRefs.add(binding.ontologyPropertyRef);
        const sourceField = sourceAsset ? fieldForPointer(sourceAsset, binding.source.path) : undefined;
        const targetField = targetAsset ? fieldForPointer(targetAsset, binding.target.path) : undefined;
        for (const field of [sourceField, targetField].filter(Boolean) as Array<FormField | DocumentField>) {
          if (!compatibleTypes(field, property))
            diagnostics.push(
              issue(
                "LB213",
                "error",
                `/spec/bindings/${index}`,
                `Field '${field.name}' type '${field.dataType}' is incompatible with ontology property '${property.id}' type '${property.dataType}'.`,
              ),
            );
        }
      }
    }
  }
  for (const artifact of parsedAssets.values()) {
    const fields = artifact.kind === "Form" ? allFormFields(artifact) : artifact.kind === "Document" ? artifact.spec.fields : [];
    for (const field of fields) {
      if (!field.ontologyPropertyRef) continue;
      if (!properties.has(field.ontologyPropertyRef))
        diagnostics.push(
          issue("LB214", "error", "/spec", `Field '${field.name}' references missing ontology property '${field.ontologyPropertyRef}'.`),
        );
      else selectedRefs.add(field.ontologyPropertyRef);
    }
  }
  if (diagnostics.some((item) => item.severity === "error"))
    return { ok: false, artifacts: [], lockfile: null, diagnostics, capabilityReport };

  const workflowSource = sourceByRef.get(bundle.spec.workflowRef)!;
  const workflowCompiled = await compileFallback(workflowSource, target);
  const compiled: BundleCompileResult["artifacts"] = [
    {
      path: `workflow/${workflowCompiled.suggestedFilename}`,
      mimeType: workflowCompiled.mimeType,
      content: workflowCompiled.content,
      sourceHash: workflowCompiled.sourceHash,
    },
  ];
  if (ontology?.kind === "Ontology" && ontologyRef) {
    let outputOntology = ontology;
    if (bundle.spec.ontology?.mode === "sliver") {
      const sliver = await sliceOntologyFallback(sourceByRef.get(ontologyRef)!, {
        ...bundle.spec.ontology.selection,
        propertyRefs: [...selectedRefs].sort(),
      });
      diagnostics.push(...sliver.diagnostics);
      if (!sliver.ok || !sliver.ontology) return { ok: false, artifacts: [], lockfile: null, diagnostics, capabilityReport };
      outputOntology = sliver.ontology;
      compiled.push({
        path: `ontology/${outputOntology.metadata.name}.reasons.json`,
        mimeType: "application/json",
        content: `${canonicalJson({ selectionHash: sliver.selectionHash, inclusionReasons: sliver.inclusionReasons })}\n`,
        sourceHash: await hash(sliver.inclusionReasons),
      });
    }
    const ontologyContent = agentOntology(outputOntology);
    compiled.push({
      path: `ontology/${ontologyContent.metadata.name}.yaml`,
      mimeType: "application/yaml",
      content: stringify(ontologyContent, { lineWidth: 110 }),
      sourceHash: await hash(ontologyContent),
    });
  }
  for (const attachment of [...(bundle.spec.forms ?? [])].sort((left, right) => left.ref.localeCompare(right.ref))) {
    const form = parsedAssets.get(attachment.ref) as LadderForm;
    const submissionSchema = formSubmissionSchema(form);
    const uiSchema = formUiSchema(form);
    compiled.push(
      {
        path: `forms/${form.metadata.name}.schema.json`,
        mimeType: "application/schema+json",
        content: `${canonicalJson(submissionSchema)}\n`,
        sourceHash: await hash(submissionSchema),
      },
      {
        path: `forms/${form.metadata.name}.ui.json`,
        mimeType: "application/json",
        content: `${canonicalJson(uiSchema)}\n`,
        sourceHash: await hash(uiSchema),
      },
    );
  }
  for (const attachment of [...(bundle.spec.documents ?? [])].sort((left, right) => left.ref.localeCompare(right.ref))) {
    const document = parsedAssets.get(attachment.ref) as LadderDocument;
    const schema =
      document.spec.outputSchema && Object.keys(document.spec.outputSchema).length
        ? document.spec.outputSchema
        : jsonSchemaForFields(document.spec.fields);
    compiled.push({
      path: `documents/${document.metadata.name}.schema.json`,
      mimeType: "application/schema+json",
      content: `${canonicalJson(schema)}\n`,
      sourceHash: await hash(schema),
    });
  }
  compiled.push({
    path: "bundle.yaml",
    mimeType: "application/yaml",
    content: stringify(bundle, { lineWidth: 110 }),
    sourceHash: bundleAnalysis.sourceHash,
  });
  const lockEntries: BundleLockEntry[] = [...parsedAssets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ref, artifact]) => ({
      ref,
      kind: artifact.kind,
      name: artifact.metadata.name,
      version: artifact.metadata.version || "unversioned",
      sourceHash: sourceHashes.get(ref) ?? "",
    }));
  const lockfile: BundleLockfile = {
    lockVersion: 1,
    bundle: bundle.metadata.name,
    target,
    sourceHash: bundleAnalysis.sourceHash,
    assets: lockEntries,
  };
  const lockContent = `${canonicalJson(lockfile)}\n`;
  compiled.push({ path: "ladder.lock.json", mimeType: "application/json", content: lockContent, sourceHash: await hash(lockfile) });
  return {
    ok: !diagnostics.some((item) => item.severity === "error"),
    artifacts: compiled.sort((left, right) => left.path.localeCompare(right.path)),
    lockfile,
    diagnostics,
    capabilityReport,
  };
}

export { ARTIFACT_COMPILER_VERSION };
