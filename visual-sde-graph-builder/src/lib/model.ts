import type { CSSProperties } from "react";
import type { Edge, Node } from "@xyflow/react";
import type {
  EdgeKind,
  ModelTier,
  NodeKind,
  RelationData,
  TaskData,
  WorkflowMeta,
} from "../types";

export type GraphNode = Node<TaskData, "task">;
export type GraphEdge = Edge<RelationData>;

export const KIND_META: Record<
  NodeKind,
  {
    label: string;
    hint: string;
    color: string;
    glow: string;
    accent: string;
  }
> = {
  start: {
    label: "Entry",
    hint: "User objective — the graph’s source",
    color: "#3dd6c6",
    glow: "rgba(61,214,198,0.28)",
    accent: "from-teal-400/20 to-transparent",
  },
  phase: {
    label: "Phase",
    hint: "Progress label in /workflows",
    color: "#9aa3b5",
    glow: "rgba(154,163,181,0.2)",
    accent: "from-slate-400/15 to-transparent",
  },
  agent: {
    label: "Agent",
    hint: "Bounded agent() call — one job, one schema",
    color: "#e85d4c",
    glow: "rgba(232,93,76,0.3)",
    accent: "from-rose-500/20 to-transparent",
  },
  parallel: {
    label: "Parallel",
    hint: "Fan-out barrier — independent thunks",
    color: "#2ec4d6",
    glow: "rgba(46,196,214,0.3)",
    accent: "from-cyan-400/20 to-transparent",
  },
  pipeline: {
    label: "Pipeline",
    hint: "Per-item stream — no global wait",
    color: "#3ecf8e",
    glow: "rgba(62,207,142,0.28)",
    accent: "from-emerald-400/20 to-transparent",
  },
  reduce: {
    label: "Reduce",
    hint: "JS flatten / dedupe / filter — zero tokens",
    color: "#e8b84a",
    glow: "rgba(232,184,74,0.28)",
    accent: "from-amber-400/20 to-transparent",
  },
  router: {
    label: "Router",
    hint: "if/switch on validated output",
    color: "#f0a05a",
    glow: "rgba(240,160,90,0.28)",
    accent: "from-orange-400/20 to-transparent",
  },
  verify: {
    label: "Verify",
    hint: "Adversarial lenses, N-vote, judge panel",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.3)",
    accent: "from-violet-400/20 to-transparent",
  },
  loop: {
    label: "Loop",
    hint: "Converging cycle — dry rounds + cap",
    color: "#e879a9",
    glow: "rgba(232,121,169,0.3)",
    accent: "from-pink-400/20 to-transparent",
  },
  output: {
    label: "Output",
    hint: "Return to the session",
    color: "#f0e6d0",
    glow: "rgba(240,230,208,0.22)",
    accent: "from-stone-200/15 to-transparent",
  },
};

export const MODEL_TIERS: { id: ModelTier; label: string; note: string }[] = [
  { id: "session", label: "Session", note: "Inherit the current /model" },
  { id: "haiku", label: "Haiku", note: "Cheap fan-out extractors" },
  { id: "sonnet", label: "Sonnet", note: "Classifiers and routers" },
  { id: "opus", label: "Opus", note: "Synthesis and adjudication" },
];

export const SCHEMA_PRESETS: { name: string; json: string }[] = [
  {
    name: "ScopeObject",
    json: `{
  "type": "object",
  "required": ["angles"],
  "properties": {
    "angles": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["key", "query"],
        "properties": {
          "key": { "type": "string" },
          "query": { "type": "string" },
          "why": { "type": "string" }
        }
      }
    }
  }
}`,
  },
  {
    name: "ITEM_SCHEMA",
    json: `{
  "type": "object",
  "required": ["items"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "title": { "type": "string" },
          "snippet": { "type": "string" },
          "claim": { "type": "string" }
        }
      }
    }
  }
}`,
  },
  {
    name: "VERDICT",
    json: `{
  "type": "object",
  "required": ["real", "reason"],
  "properties": {
    "real": { "type": "boolean" },
    "reason": { "type": "string" },
    "severity": { "enum": ["low", "medium", "high"] }
  }
}`,
  },
  {
    name: "BUGS",
    json: `{
  "type": "object",
  "required": ["bugs"],
  "properties": {
    "bugs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "desc"],
        "properties": {
          "id": { "type": "string" },
          "desc": { "type": "string" },
          "file": { "type": "string" }
        }
      }
    }
  }
}`,
  },
  {
    name: "Severity",
    json: `{
  "type": "object",
  "required": ["severity"],
  "properties": {
    "severity": { "enum": ["low", "high"] },
    "rationale": { "type": "string" }
  }
}`,
  },
  {
    name: "FileList",
    json: `{
  "type": "object",
  "required": ["files"],
  "properties": {
    "files": { "type": "array", "items": { "type": "string" } }
  }
}`,
  },
  {
    name: "Report",
    json: `{
  "type": "object",
  "required": ["title", "body"],
  "properties": {
    "title": { "type": "string" },
    "body": { "type": "string" },
    "citations": { "type": "array", "items": { "type": "string" } }
  }
}`,
  },
];

export function uid(prefix = "n"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function toIdent(title: string, fallback = "node"): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "_$&");
  return cleaned || fallback;
}

export function defaultTask(kind: NodeKind, partial: Partial<TaskData> = {}): TaskData {
  const titles: Record<NodeKind, string> = {
    start: "User objective",
    phase: "Phase",
    agent: "Subagent",
    parallel: "Fan-out",
    pipeline: "Pipeline",
    reduce: "Code reduce",
    router: "Router",
    verify: "Verifier",
    loop: "Loop until dry",
    output: "Session output",
  };

  const summaries: Record<NodeKind, string> = {
    start: "The job the fleet is hired to finish.",
    phase: "Groups agents in the /workflows UI.",
    agent: "One bounded judgment call with a schema.",
    parallel: "Spawn independent thunks; wait for all.",
    pipeline: "Stream the same transform across items.",
    reduce: "Flatten, dedupe, filter in JavaScript.",
    router: "Deterministic branch on validated fields.",
    verify: "Adversarial N-vote before synthesis.",
    loop: "Repeat finders until K dry rounds.",
    output: "Only the final answer reaches the session.",
  };

  return {
    kind,
    title: titles[kind],
    summary: summaries[kind],
    prompt: kind === "agent" || kind === "verify" ? "Do one bounded job. Return schema-valid JSON." : "",
    label: toIdent(titles[kind]),
    phase: "",
    model: kind === "verify" || kind === "agent" ? "sonnet" : kind === "start" ? "session" : "haiku",
    agentType: "general-purpose",
    schemaName: kind === "verify" ? "VERDICT" : kind === "agent" ? "ITEM_SCHEMA" : "",
    schemaJson: "",
    dryRounds: 2,
    maxIterations: 8,
    conditionField: "severity",
    branches: [
      { id: "high", value: "high", label: "High" },
      { id: "low", value: "low", label: "Low" },
    ],
    reduceExpr:
      "raw.filter(Boolean).flatMap((r) => r.items ?? r.bugs ?? r)\n  .filter((x, i, a) => a.findIndex((y) => key(y) === key(x)) === i)",
    voteRule: "majority",
    lenses: "correctness, security, repro",
    notes: "",
    ...partial,
  };
}

export function makeNode(
  kind: NodeKind,
  position: { x: number; y: number },
  partial: Partial<TaskData> = {},
  id?: string,
): GraphNode {
  const data = defaultTask(kind, partial);
  return {
    id: id ?? uid("n"),
    type: "task",
    position,
    data,
  };
}

export function makeEdge(
  source: string,
  target: string,
  extras: {
    kind?: EdgeKind;
    contract?: string;
    label?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  } = {},
): GraphEdge {
  const kind = extras.kind ?? "data";
  return {
    id: uid("e"),
    source,
    target,
    sourceHandle: extras.sourceHandle ?? undefined,
    targetHandle: extras.targetHandle ?? undefined,
    type: "smoothstep",
    animated: kind === "loop" || kind === "verify",
    data: {
      kind,
      contract: extras.contract ?? "",
      label: extras.label ?? extras.contract ?? "",
    },
    style: edgeStyle(kind),
    label: extras.label ?? extras.contract,
    labelStyle: { fill: "#c8c2b4", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" },
    labelBgStyle: { fill: "#12141a", fillOpacity: 0.92 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
  };
}

export function edgeStyle(kind: EdgeKind): CSSProperties {
  if (kind === "loop") {
    return { stroke: "#e879a9", strokeWidth: 1.7, strokeDasharray: "7 5" };
  }
  if (kind === "verify") {
    return { stroke: "#a78bfa", strokeWidth: 1.6 };
  }
  if (kind === "control") {
    return { stroke: "#8b93a7", strokeWidth: 1.4, strokeDasharray: "3 4" };
  }
  return { stroke: "#5c6b78", strokeWidth: 1.5 };
}

export const DEFAULT_META: WorkflowMeta = {
  name: "untitled-fleet",
  description: "A dynamic workflow for a subagent fleet.",
  objective: "State the job the graph must finish.",
};

export function cloneGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  return {
    nodes: nodes.map((n) => ({ ...n, data: { ...n.data, branches: n.data.branches.map((b) => ({ ...b })) }, position: { ...n.position } })),
    edges: edges.map((e) => ({ ...e, data: e.data ? { ...e.data } : e.data })),
  };
}
