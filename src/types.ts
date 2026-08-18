export type Target = "codex" | "claude" | "hermes" | "python" | "typescript";
export type Severity = "error" | "warning" | "info";
export type NodeKind =
  | "input"
  | "output"
  | "agent"
  | "tool"
  | "transform"
  | "condition"
  | "evaluate"
  | "teacher"
  | "approval"
  | "join"
  | "aggregator"
  | "loop"
  | "group"
  | "subgraph";

export type EdgeKind = "data" | "dependency" | "control";

export interface Position {
  x: number;
  y: number;
}

export interface Branch {
  label: string;
  when: string;
}

export interface SubgraphConfig {
  ref: string;
  inputMap: Record<string, string>;
  outputMap: Record<string, string>;
  checkpointer?: "inherit" | "perInvocation" | "perThread" | "stateless";
}

export interface NodeConfig {
  operation?: "select" | "rename" | "merge" | "filter" | "deduplicate" | "sort" | "slice" | "";
  expression?: string;
  branches?: Branch[];
  join?: "all" | "allSettled" | "first" | "";
  aggregation?: "collect" | "merge" | "concat" | "vote" | "";
  teacherModel?: string;
  feedbackMode?: "critique" | "score" | "rubric" | "";
  workingDirectory?: string;
  body?: string[];
  exitCondition?: string;
  maxIterations?: number;
  onExhausted?: "stop" | "continue" | "warn" | "";
  carry?: Record<string, string>;
  threshold?: number;
  members?: string[];
  execution?: "sequential" | "parallel" | "";
  exit?: "aggregate" | "serialize" | "";
  router?: string;
  defaultBranch?: string;
  entry?: string;
  exitNode?: string;
  subgraph?: SubgraphConfig;
}

export interface Capabilities {
  skills: string[];
  tools: string[];
  connectors: string[];
  permissions: string[];
  customizations: Record<string, CapabilityCustomization>;
}

export interface CapabilityCustomization {
  template: string;
  instructions: string;
}

export interface LgirNode {
  [key: string]: unknown;
  id: string;
  kind: NodeKind;
  name: string;
  templateRef?: string;
  inlineRole?: boolean;
  summary?: string;
  role?: string;
  prompt?: string;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  formRefs?: string[];
  capabilities?: Partial<Capabilities>;
  config?: NodeConfig;
  position?: Position;
}

export interface LgirEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  contract?: string;
  condition?: string;
  sourcePath?: string;
  targetPath?: string;
}

export interface Workflow {
  apiVersion: "ladder.dev/v1alpha1";
  kind: "Workflow";
  metadata: {
    name: string;
    title?: string;
    description?: string;
    version?: string;
  };
  spec: {
    objective: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    policies?: {
      maxConcurrency?: number;
      onFailure?: string;
      requireApprovalFor?: string[];
    };
    nodes: LgirNode[];
    edges: LgirEdge[];
  };
}

export interface Fix {
  label: string;
  path: string;
  value: unknown;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  path: string;
  nodeId?: string;
  edgeId?: string;
  message: string;
  capability?: "native" | "instructional" | "unsupported";
  fix?: Fix;
}

export interface Stats {
  nodes: number;
  edges: number;
  agents: number;
  loops: number;
  maxParallelism: number;
}

export interface AnalysisResult {
  ok: boolean;
  sourceHash: string;
  diagnostics: Diagnostic[];
  normalized?: Workflow;
  nodeOrder: string[];
  stats: Stats;
}

export interface FormatResult {
  ok: boolean;
  content: string;
  diagnostics: Diagnostic[];
}

export interface CapabilityReport {
  target: Target;
  native: string[];
  instructional: string[];
  unsupported: string[];
}

export interface CompileResult {
  ok: boolean;
  content: string;
  suggestedFilename: string;
  mimeType: string;
  sourceHash: string;
  compilerVersion: string;
  adapterVersion: string;
  capabilityReport: CapabilityReport;
  diagnostics: Diagnostic[];
}

export interface TemplateDefinition {
  id: string;
  path: string;
  area: string;
  title: string;
  eyebrow: string;
  description: string;
  topology: string;
  accent: string;
  modalities: InputModality[];
  yaml: string;
}

export type InputModality = "text" | "image" | "audio" | "video" | "document" | "mixed";

export interface RoleTemplate {
  id: string;
  path: string;
  name: string;
  role: string;
  prompt: string;
  areas: string[];
  modalities: InputModality[];
  usage: "workflow-bound" | "palette-only";
  skills: string[];
  tools: string[];
  connectors?: string[];
  permissions?: string[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  artifactKind?: "workflow" | "ontology" | "form" | "document" | "workflow-bundle";
  yaml: string;
  lastValidYaml: string;
  target: Target;
  createdAt: number;
  updatedAt: number;
}

export type * from "./types/artifacts";
