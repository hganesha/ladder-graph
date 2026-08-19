import type { CatalogBodyReference, Diagnostic, IconRef, Target } from "../types";

export type ArtifactKind = "Ontology" | "Form" | "Document" | "WorkflowBundle";
export type CatalogArtifactKind = "ontology" | "form" | "document" | "workflow-bundle";

export interface ArtifactTemplateDefinition {
  id: string;
  kind: CatalogArtifactKind;
  path: string;
  title: string;
  description: string;
  file: string;
  yaml: string;
  ref: string;
}

export type ArtifactTemplateMetadata = Omit<ArtifactTemplateDefinition, "yaml"> &
  CatalogBodyReference & {
    bundleSummary?: {
      workflowRef: string;
      formCount: number;
      documentCount: number;
      bindingCount: number;
      hasOntology: boolean;
    };
  };

export interface ArtifactUsageMetadata {
  id: string;
  kind: "form" | "document" | "workflow-bundle";
  title: string;
  ontologyRef?: string;
  workflowRef?: string;
  propertyRefs: string[];
  relationshipIds: string[];
}

export interface ArtifactSource {
  system: "lattice" | "docubricks" | "ladder" | string;
  sourceId?: string;
  sourcePath?: string;
  sourceVersion?: string;
  sourceDigest?: string;
  derivedFrom?: string;
}

export interface ArtifactMetadata {
  name: string;
  title?: string;
  description?: string;
  version?: string;
  source?: ArtifactSource;
}

export type OntologyDataType = "string" | "integer" | "number" | "decimal" | "boolean" | "date" | "datetime" | "array" | "object";

export interface OntologyProperty {
  id: string;
  label: string;
  description?: string;
  dataType: OntologyDataType;
  required?: boolean;
  identifier?: boolean;
  allowedValues?: Array<string | number | boolean>;
  unit?: string;
  sourcePath?: string;
}

export interface OntologyType {
  id: string;
  label: string;
  description?: string;
  icon?: IconRef;
  aliases?: string[];
  parentTypeIds?: string[];
  properties: OntologyProperty[];
  sourcePath?: string;
}

export type OntologyCardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

export interface OntologyRelationship {
  id: string;
  label: string;
  description?: string;
  sourceTypeId: string;
  targetTypeId: string;
  cardinality: OntologyCardinality;
  inverseRelationshipId?: string;
  required?: boolean;
  sourcePath?: string;
}

export interface Ontology {
  apiVersion: "ladder.dev/v1alpha1";
  kind: "Ontology";
  metadata: ArtifactMetadata;
  spec: {
    types: OntologyType[];
    relationships: OntologyRelationship[];
  };
}

export type FormRole = "start" | "clarification" | "review" | "approval" | "exception" | "completion";
export type FormFieldType = "string" | "integer" | "number" | "boolean" | "date" | "datetime" | "array" | "object";
export type FormWidget = "text" | "textarea" | "number" | "date" | "datetime" | "select" | "radio" | "checkbox" | "file";

export type RuleOperand = { field: string } | { value: unknown } | { length: string };
export type SafeRule =
  | { op: "present"; field: string }
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; left: RuleOperand; right: RuleOperand }
  | { op: "matches"; left: RuleOperand; pattern: string }
  | { op: "and" | "or"; rules: SafeRule[] }
  | { op: "not"; rule: SafeRule };

export interface ValidationRule {
  id: string;
  severity: "error" | "warning";
  description?: string;
  rule?: SafeRule;
  sourceExpression?: string;
  supported: boolean;
  unsupportedReason?: string;
}

export type DocumentValidationRule = ValidationRule;

export interface FieldConfidencePolicy {
  minConfidence: number;
  reviewOnBreach?: boolean;
  failOnBreach?: boolean;
  regulatoryRequired?: boolean;
  rationale?: string;
}

export interface ReviewPolicy {
  unsupportedRuleAction?: "human-review";
  defaultConfidenceThreshold?: number;
  fieldConfidence?: Record<string, FieldConfidencePolicy>;
}

export interface ModelRouting {
  primary?: string;
  fallbackChain?: string[];
  maxTokens?: number;
  temperature?: number;
  timeoutSeconds?: number;
  maxRetries?: number;
  tierOverrides?: Record<string, unknown>;
  rationale?: string;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  description?: string;
  helpText?: string;
  dataType: FormFieldType;
  widget?: FormWidget;
  required?: boolean;
  defaultValue?: unknown;
  allowedValues?: Array<string | number | boolean>;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  ontologyPropertyRef?: string;
  workflowPath?: string;
  accessibilityLabel?: string;
  errorMessage?: string;
  visibleWhen?: SafeRule;
  enabledWhen?: SafeRule;
  span?: 1 | 2;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormPage {
  id: string;
  title: string;
  description?: string;
  sections: FormSection[];
}

export interface LadderForm {
  apiVersion: "ladder.dev/v1alpha1";
  kind: "Form";
  metadata: ArtifactMetadata;
  spec: {
    role: FormRole;
    pages: FormPage[];
    validationRules?: ValidationRule[];
    reviewPolicy?: ReviewPolicy;
    modelRouting?: ModelRouting;
    submissionSchema?: Record<string, unknown>;
  };
}

export interface DocumentField {
  id: string;
  name: string;
  label: string;
  description?: string;
  dataType: FormFieldType;
  required?: boolean;
  ontologyPropertyRef?: string;
  sourcePath?: string;
}

export interface DocumentSection {
  id: string;
  title: string;
  description?: string;
  fieldIds: string[];
}

export interface LadderDocument {
  apiVersion: "ladder.dev/v1alpha1";
  kind: "Document";
  metadata: ArtifactMetadata;
  spec: {
    documentType: string;
    sections: DocumentSection[];
    fields: DocumentField[];
    validationRules?: ValidationRule[];
    reviewPolicy?: ReviewPolicy;
    modelRouting?: ModelRouting;
    outputSchema?: Record<string, unknown>;
    inertSourceMetadata?: Record<string, unknown>;
  };
}

export interface OntologySelection {
  typeIds?: string[];
  propertyRefs?: string[];
  relationshipIds?: string[];
}

export interface BundleAssetRef {
  ref: string;
  role?: FormRole | "supporting";
}

export interface BundleBindingEndpoint {
  ref: string;
  path: string;
}

export interface BundleBinding {
  id: string;
  description?: string;
  source: BundleBindingEndpoint;
  target: BundleBindingEndpoint;
  ontologyPropertyRef?: string;
  direction: "input" | "output" | "review" | "approval";
  transform?: "select" | "rename" | "merge" | "filter" | "deduplicate" | "sort" | "slice";
}

export interface WorkflowBundle {
  apiVersion: "ladder.dev/v1alpha1";
  kind: "WorkflowBundle";
  metadata: ArtifactMetadata;
  spec: {
    workflowRef: string;
    ontology?: {
      ref: string;
      mode: "full" | "sliver";
      selection?: OntologySelection;
    };
    forms?: BundleAssetRef[];
    documents?: BundleAssetRef[];
    bindings?: BundleBinding[];
  };
}

export type LadderArtifact = Ontology | LadderForm | LadderDocument | WorkflowBundle;

export interface ArtifactAnalysisResult<T extends LadderArtifact = LadderArtifact> {
  ok: boolean;
  sourceHash: string;
  diagnostics: Diagnostic[];
  normalized?: T;
}

export interface OntologySliceResult {
  ok: boolean;
  sourceHash: string;
  selectionHash: string;
  ontology?: Ontology;
  includedTypeIds: string[];
  includedPropertyRefs: string[];
  includedRelationshipIds: string[];
  inclusionReasons: Record<string, string[]>;
  diagnostics: Diagnostic[];
}

export interface ResolvedBundleAsset {
  ref: string;
  source: string;
}

export interface CompiledArtifact {
  path: string;
  mimeType: string;
  content: string;
  sourceHash: string;
}

export interface BundleLockEntry {
  ref: string;
  kind: "Workflow" | ArtifactKind;
  name: string;
  version: string;
  sourceHash: string;
}

export interface BundleLockfile {
  lockVersion: 1;
  bundle: string;
  target: Target;
  sourceHash: string;
  assets: BundleLockEntry[];
}

export interface BundleCapabilityReport {
  target: Target;
  native: string[];
  instructional: string[];
  unsupported: string[];
}

export interface BundleCompileResult {
  ok: boolean;
  artifacts: CompiledArtifact[];
  lockfile: BundleLockfile | null;
  diagnostics: Diagnostic[];
  capabilityReport: BundleCapabilityReport;
}
