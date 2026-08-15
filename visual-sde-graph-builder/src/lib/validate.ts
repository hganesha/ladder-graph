import type { ValidationIssue } from "../types";
import type { GraphEdge, GraphNode } from "./model";

export function validateGraph(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set(nodes.map((n) => n.id));

  const starts = nodes.filter((n) => n.data.kind === "start");
  const outputs = nodes.filter((n) => n.data.kind === "output");

  if (starts.length === 0) issues.push({ level: "error", message: "Graph needs an Entry node." });
  if (starts.length > 1) issues.push({ level: "warn", message: "Multiple Entry nodes — codegen will pick the first." });
  if (outputs.length === 0) issues.push({ level: "error", message: "Graph needs an Output node to return to the session." });

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  nodes.forEach((n) => {
    incoming.set(n.id, 0);
    outgoing.set(n.id, 0);
  });

  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      issues.push({ level: "error", message: `Dangling edge ${e.id}.` });
      continue;
    }
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  for (const n of nodes) {
    const inn = incoming.get(n.id) ?? 0;
    const out = outgoing.get(n.id) ?? 0;
    if (n.data.kind !== "start" && n.data.kind !== "output" && inn === 0 && out === 0) {
      issues.push({ level: "warn", message: `“${n.data.title}” is isolated.`, nodeId: n.id });
    }
    if (n.data.kind === "agent" && !n.data.prompt.trim()) {
      issues.push({ level: "error", message: `Agent “${n.data.title}” has an empty prompt.`, nodeId: n.id });
    }
    if (n.data.kind === "loop" && n.data.dryRounds < 1) {
      issues.push({ level: "error", message: `Loop “${n.data.title}” needs a dry-round guard.`, nodeId: n.id });
    }
    if (n.data.kind === "loop" && n.data.maxIterations < 1) {
      issues.push({ level: "error", message: `Loop “${n.data.title}” needs a max iteration cap.`, nodeId: n.id });
    }
    if (n.data.kind === "router" && n.data.branches.length < 2) {
      issues.push({ level: "warn", message: `Router “${n.data.title}” should declare at least two branches.`, nodeId: n.id });
    }
    if ((n.data.kind === "agent" || n.data.kind === "verify") && !n.data.schemaName && !n.data.schemaJson) {
      issues.push({
        level: "warn",
        message: `“${n.data.title}” has no schema — downstream nodes must parse free text.`,
        nodeId: n.id,
      });
    }
    if (n.data.kind === "reduce" && !n.data.reduceExpr.trim()) {
      issues.push({ level: "warn", message: `Reduce “${n.data.title}” has no JS expression.`, nodeId: n.id });
    }
  }

  const { hasUnmarkedCycle, cycles } = findCycles(nodes, edges);
  if (hasUnmarkedCycle) {
    issues.push({
      level: "error",
      message: `Unmarked cycle detected (${cycles} back-edge${cycles === 1 ? "" : "s"}). Mark loop edges or add a Loop node.`,
    });
  } else if (cycles > 0) {
    issues.push({
      level: "info",
      message: `Converging cycle present — ${cycles} loop edge${cycles === 1 ? "" : "s"} with termination guards.`,
    });
  }

  const agents = nodes.filter((n) => ["agent", "verify"].includes(n.data.kind)).length;
  if (agents > 16) {
    issues.push({
      level: "info",
      message: `${agents} agent nodes — runtime caps concurrent agents at 16 (extras queue).`,
    });
  }

  return issues;
}

export function findCycles(nodes: GraphNode[], edges: GraphEdge[]) {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => adj.get(e.source)?.push(e.target));

  const state = new Map<string, 0 | 1 | 2>();
  let back = 0;
  let unmarked = 0;

  const visit = (id: string, stack: Set<string>) => {
    state.set(id, 1);
    stack.add(id);
    for (const nxt of adj.get(id) ?? []) {
      const st = state.get(nxt) ?? 0;
      if (st === 0) visit(nxt, stack);
      else if (st === 1) {
        back += 1;
        const edge = edges.find((e) => e.source === id && e.target === nxt);
        const target = nodes.find((n) => n.id === nxt);
        const marked = edge?.data?.kind === "loop" || target?.data.kind === "loop";
        if (!marked) unmarked += 1;
      }
    }
    stack.delete(id);
    state.set(id, 2);
  };

  for (const n of nodes) {
    if ((state.get(n.id) ?? 0) === 0) visit(n.id, new Set());
  }

  return { hasUnmarkedCycle: unmarked > 0, cycles: back };
}

export function estimateAgents(nodes: GraphNode[]): number {
  return nodes.reduce((sum, n) => {
    if (n.data.kind === "agent" || n.data.kind === "verify") return sum + 1;
    if (n.data.kind === "parallel") return sum + 3;
    if (n.data.kind === "pipeline") return sum + 4;
    if (n.data.kind === "loop") return sum + 2;
    return sum;
  }, 0);
}
