import { stringify } from "yaml";
import agentLibraryJson from "../../math_music_physics_agent_templates.json";
import workflowLibraryJson from "../../math_music_physics_workflow_templates.json";
import type { LgirEdge, LgirNode, TemplateDefinition, Workflow } from "../types";
import { inputContractSchema } from "./inputContracts";
import type { RoleTemplate } from "./roleTemplates";

interface SourceAgent {
  id: string;
  group: "Mathematics" | "Music" | "Physics";
  category: string;
  name: string;
  role_sme_assumption: string;
  description_prompt: string;
  reference_sites: string[];
  skills_connectors: string[];
}

interface SourceWorkflowNode {
  id: string;
  type: "agent" | "input" | "decision" | "condition" | "evaluate" | "approval" | "join" | "loop";
  label: string;
  config: {
    agent_template_id?: string;
    instruction_override?: string;
    expected_fields?: string[];
    source?: string;
    basis?: string;
    branches?: Array<{ when: string; to: string }>;
    default_to?: string;
    expression?: string;
    true_to?: string;
    false_to?: string;
    method?: string;
    metric?: string;
    output_key?: string;
    approver_role?: string;
    on_approve?: string;
    on_reject?: string;
    on_timeout?: string;
    inputs?: string[];
    strategy?: string;
    body?: string[];
    loop_back_to?: string;
    exit_condition?: string;
    max_iterations?: number;
  };
}

interface SourceWorkflow {
  id: string;
  domain: SourceAgent["group"];
  name: string;
  description: string;
  trigger: string;
  nodes: SourceWorkflowNode[];
  edges: Array<{ from: string; to: string; on?: string }>;
}

const sourceAgents = (agentLibraryJson as { agents: SourceAgent[] }).agents;
const sourceWorkflows = (workflowLibraryJson as { workflows: SourceWorkflow[] }).workflows;

function normalizeText(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function skillId(value: string): string {
  const concise = value
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(api|connector|tooling|tools?|library)\b/gi, "")
    .trim();
  return slug(concise || value);
}

function connectorIds(values: string[]): string[] {
  const connectors = new Set<string>();
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (normalized.includes("wolfram")) connectors.add("api:wolfram-alpha");
    if (normalized.includes("desmos")) connectors.add("api:desmos");
    if (normalized.includes("spotify") || normalized.includes("apple music")) connectors.add("api:music-catalog");
    if (normalized.includes("musicbrainz")) connectors.add("api:musicbrainz");
    if (normalized.includes("ableton") || normalized.includes("logic") || normalized.includes("daw")) connectors.add("mcp:daw");
    if (/musescore|sibelius|finale|lilypond|vexflow/.test(normalized)) connectors.add("mcp:music-notation");
    if (/lean|coq/.test(normalized)) connectors.add("mcp:proof-assistant");
    if (normalized.includes("codata")) connectors.add("api:codata");
  }
  return [...connectors];
}

function roleTools(agent: SourceAgent): string[] {
  if (agent.group === "Music") return agent.category === "Co-Creator" ? ["read", "audio", "generate"] : ["read", "audio"];
  return ["read", "calculate"];
}

export const MATH_MUSIC_PHYSICS_ROLES: RoleTemplate[] = sourceAgents.map((agent) => ({
  id: agent.id,
  path: `research/${slug(agent.group)}/${slug(agent.category)}`,
  name: agent.name,
  role: normalizeText(agent.role_sme_assumption),
  prompt: normalizeText(agent.description_prompt),
  skills: [...new Set(agent.skills_connectors.map(skillId).filter(Boolean))],
  tools: roleTools(agent),
  connectors: connectorIds(agent.skills_connectors),
  permissions: ["read-only"],
}));

const rolesById = new Map(MATH_MUSIC_PHYSICS_ROLES.map((role) => [role.id, role]));

function nodeSummary(source: SourceWorkflowNode): string {
  if (source.type === "approval") {
    return `Pause for ${normalizeText(source.config.approver_role) || "the designated reviewer"}; on timeout, ${source.config.on_timeout ?? "stop"}.`;
  }
  if (source.type === "evaluate") return `Evaluate ${normalizeText(source.config.metric)?.replaceAll("_", " ") || "the upstream result"}.`;
  if (source.type === "decision")
    return `Route from ${normalizeText(source.config.basis)?.replaceAll("_", " ") || "the declared classification"}.`;
  if (source.type === "loop")
    return `Repeat a bounded revision sequence until ${normalizeText(source.config.exit_condition) || "the exit condition passes"}.`;
  return source.label;
}

function inputModality(workflow: SourceWorkflow): "audio" | "text" {
  return workflow.id === "wf-music-01" ? "audio" : "text";
}

function convertNode(workflow: SourceWorkflow, source: SourceWorkflowNode): LgirNode {
  const base: LgirNode = {
    id: source.id,
    kind: source.type === "decision" ? "condition" : source.type,
    name: source.label,
    summary: nodeSummary(source),
  };

  if (source.type === "input") {
    base.inputSchema = inputContractSchema(inputModality(workflow));
    if (source.config.expected_fields?.length) {
      base.inputSchema = {
        ...base.inputSchema,
        properties: {
          ...(base.inputSchema?.properties as Record<string, unknown> | undefined),
          workflowFields: {
            type: "object",
            required: source.config.expected_fields,
            properties: Object.fromEntries(source.config.expected_fields.map((field) => [field, {}])),
          },
        },
      };
    }
  } else if (source.type === "agent") {
    const role = rolesById.get(source.config.agent_template_id ?? "");
    base.role = role?.role ?? "Domain specialist";
    base.prompt = [
      role?.prompt,
      normalizeText(source.config.instruction_override) && `Workflow focus: ${normalizeText(source.config.instruction_override)}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    base.capabilities = role
      ? {
          skills: [...role.skills],
          tools: [...role.tools],
          connectors: [...(role.connectors ?? [])],
          permissions: [...(role.permissions ?? [])],
        }
      : { skills: [], tools: ["read"], connectors: [], permissions: ["read-only"] };
    base.outputSchema = { type: "object" };
  } else if (source.type === "evaluate") {
    const metric = source.config.metric?.replaceAll("_", " ") ?? "quality";
    base.role = source.config.method === "programmatic" ? "Deterministic metric evaluator" : "Independent domain evaluator";
    base.prompt = `Evaluate the upstream result using ${metric}. Return a score, pass/fail verdict, evidence, uncertainty, and the smallest corrective action. Do not claim programmatic measurement unless the host supplies the required tool.`;
    base.capabilities = { skills: ["evaluation"], tools: ["read", "calculate"], connectors: [], permissions: ["read-only"] };
    base.outputSchema = {
      type: "object",
      required: ["score", "passed", "reasons"],
      properties: { score: { type: "number" }, passed: { type: "boolean" }, reasons: { type: "array", items: { type: "string" } } },
    };
    base.config = { threshold: 0.8 };
  } else if (source.type === "condition") {
    base.config = {
      expression: source.config.expression ?? "result.passed == true",
      branches: [
        { label: "True", when: "true" },
        { label: "False", when: "false" },
      ],
    };
  } else if (source.type === "decision") {
    base.config = {
      expression: `${source.config.basis ?? "classification"} selects one declared branch`,
      branches: [
        ...(source.config.branches ?? []).map((branch) => ({ label: branch.when.replaceAll("_", " "), when: branch.when })),
        ...(source.config.default_to ? [{ label: "Default", when: "default" }] : []),
      ],
    };
  } else if (source.type === "join") {
    base.config = { join: source.config.strategy === "wait_any" ? "first" : "all" };
  } else if (source.type === "loop") {
    base.config = {
      body: source.config.body ?? [],
      exitCondition: source.config.exit_condition ?? "evaluation.passed == true",
      maxIterations: Math.max(1, Math.min(100, source.config.max_iterations ?? 3)),
      onExhausted: "stop",
    };
  }

  return base;
}

function createsCycle(edges: LgirEdge[], candidate: LgirEdge): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const queue = [candidate.to];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    if (current === candidate.from) return true;
    visited.add(current);
    queue.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

function convertEdges(workflow: SourceWorkflow): LgirEdge[] {
  const result: LgirEdge[] = [];
  workflow.edges.forEach((edge, index) => {
    const candidate: LgirEdge = {
      id: `${workflow.id}-edge-${index + 1}`,
      from: edge.from,
      to: edge.to,
      kind: edge.on ? "control" : "data",
      ...(edge.on ? { condition: edge.on } : {}),
    };
    if (!createsCycle(result, candidate)) result.push(candidate);
  });
  return result;
}

function convertWorkflow(source: SourceWorkflow): Workflow {
  const nodes = source.nodes.map((node) => convertNode(source, node));
  const edges = convertEdges(source);
  const outgoing = new Set(edges.map((edge) => edge.from));
  const terminalIds = nodes.filter((node) => !outgoing.has(node.id)).map((node) => node.id);
  const outputId = "workflow-output";
  nodes.push({
    id: outputId,
    kind: "output",
    name: "Validated result",
    summary: `Return the completed ${source.name.toLowerCase()} deliverable, validation evidence, and unresolved uncertainty.`,
  });
  terminalIds.forEach((from, index) => {
    edges.push({ id: `${source.id}-output-${index + 1}`, from, to: outputId, kind: "dependency" });
  });

  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Workflow",
    metadata: {
      name: slug(source.name),
      title: source.name,
      description: normalizeText(source.description),
      version: "1.0.0",
    },
    spec: {
      objective: `${normalizeText(source.description)} Trigger: ${normalizeText(source.trigger)}`,
      policies: {
        maxConcurrency: 4,
        onFailure: "stop",
        requireApprovalFor: source.nodes.filter((node) => node.type === "approval").map((node) => node.id),
      },
      nodes,
      edges,
    },
  };
}

const areaMeta: Record<SourceAgent["group"], Pick<TemplateDefinition, "eyebrow" | "accent">> = {
  Mathematics: { eyebrow: "Formal reasoning", accent: "#4f8bd6" },
  Music: { eyebrow: "Analysis + creation", accent: "#ce728d" },
  Physics: { eyebrow: "Model + verification", accent: "#7d83d6" },
};

export const MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES: TemplateDefinition[] = sourceWorkflows.map((source) => ({
  id: source.id,
  path: `research/${slug(source.domain)}/${source.id}`,
  area: source.domain,
  title: source.name,
  eyebrow: areaMeta[source.domain].eyebrow,
  description: normalizeText(source.description),
  topology: source.nodes.some((node) => node.type === "loop") ? "Branch + bounded loop" : "Validated pipeline",
  accent: areaMeta[source.domain].accent,
  yaml: stringify(convertWorkflow(source), { indent: 2, lineWidth: 100 }),
}));
