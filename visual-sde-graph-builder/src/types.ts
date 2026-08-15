export type NodeKind =
  | "start"
  | "phase"
  | "agent"
  | "parallel"
  | "pipeline"
  | "reduce"
  | "router"
  | "verify"
  | "loop"
  | "output";

export type ModelTier = "session" | "haiku" | "sonnet" | "opus";

export type EdgeKind = "data" | "control" | "loop" | "verify";

export interface RouterBranch {
  id: string;
  value: string;
  label: string;
}

export interface TaskData {
  kind: NodeKind;
  title: string;
  summary: string;
  prompt: string;
  label: string;
  phase: string;
  model: ModelTier;
  agentType: string;
  schemaName: string;
  schemaJson: string;
  dryRounds: number;
  maxIterations: number;
  conditionField: string;
  branches: RouterBranch[];
  reduceExpr: string;
  voteRule: string;
  lenses: string;
  notes: string;
  [key: string]: unknown;
}

export interface RelationData {
  kind: EdgeKind;
  contract: string;
  label: string;
  [key: string]: unknown;
}

export interface WorkflowMeta {
  name: string;
  description: string;
  objective: string;
}

export interface GraphSnapshot {
  meta: WorkflowMeta;
  nodes: unknown[];
  edges: unknown[];
}

export interface ValidationIssue {
  level: "error" | "warn" | "info";
  message: string;
  nodeId?: string;
}

export const NODE_KINDS: NodeKind[] = [
  "start",
  "phase",
  "agent",
  "parallel",
  "pipeline",
  "reduce",
  "router",
  "verify",
  "loop",
  "output",
];
