import type { WorkflowMeta } from "../types";
import { SCHEMA_PRESETS, toIdent, type GraphEdge, type GraphNode } from "./model";

function ident(node: GraphNode, used: Set<string>): string {
  const base = toIdent(node.data.label || node.data.title, node.data.kind);
  let name = base;
  let i = 2;
  while (used.has(name)) {
    name = `${base}_${i++}`;
  }
  used.add(name);
  return name;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

function prettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

function schemaLiteral(node: GraphNode): string | null {
  const inline = node.data.schemaJson?.trim() ? prettyJson(node.data.schemaJson) : null;
  if (inline) return inline;
  const preset = SCHEMA_PRESETS.find((p) => p.name === node.data.schemaName);
  if (preset) return prettyJson(preset.json);
  return null;
}

function agentOptions(node: GraphNode, indent: string): string {
  const lines: string[] = [];
  if (node.data.label) lines.push(`${indent}label: '${esc(node.data.label)}',`);
  if (node.data.phase) lines.push(`${indent}phase: '${esc(node.data.phase)}',`);
  if (node.data.model && node.data.model !== "session") {
    lines.push(`${indent}model: '${node.data.model}',`);
  }
  if (node.data.agentType) lines.push(`${indent}agentType: '${esc(node.data.agentType)}',`);
  const schema = schemaLiteral(node);
  if (schema) {
    const shifted = schema
      .split("\n")
      .map((l, i) => (i === 0 ? l : indent + l))
      .join("\n");
    lines.push(`${indent}schema: ${shifted},`);
  } else if (node.data.schemaName) {
    lines.push(`${indent}schema: ${node.data.schemaName},`);
  }
  return lines.join("\n");
}

function topo(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const ids = nodes.map((n) => n.id);
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const e of edges) {
    if (e.data?.kind === "loop") continue;
    adj.get(e.source)?.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  const q = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
  const out: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    out.push(id);
    for (const nxt of adj.get(id) ?? []) {
      const nextIn = (incoming.get(nxt) ?? 1) - 1;
      incoming.set(nxt, nextIn);
      if (nextIn === 0) q.push(nxt);
    }
  }
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

function outgoing(edges: GraphEdge[], id: string): GraphEdge[] {
  return edges.filter((e) => e.source === id && e.data?.kind !== "loop");
}

function promptFor(node: GraphNode, meta: WorkflowMeta): string {
  const raw = node.data.prompt.trim();
  if (raw) return raw;
  if (node.data.kind === "start") return meta.objective;
  return node.data.summary || node.data.title;
}

export function generateWorkflowJS(nodes: GraphNode[], edges: GraphEdge[], meta: WorkflowMeta): string {
  const used = new Set<string>(["raw", "collected", "fresh", "dry", "seen", "confirmed", "meta"]);
  const names = new Map<string, string>();
  for (const n of nodes) names.set(n.id, ident(n, used));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = topo(nodes, edges);
  const emitted = new Set<string>();
  const body: string[] = [];

  body.push("/**");
  body.push(` * CODEZ compiled workflow — ${esc(meta.name || "untitled-fleet")}`);
  body.push(" * Save to .claude/workflows/ and invoke by name.");
  body.push(" * Claude Code v2.1.154+ with Dynamic workflows enabled.");
  body.push(" * Orchestration is JavaScript (zero model tokens).");
  body.push(" */");
  body.push("export const meta = {");
  body.push(`  name: '${esc(meta.name || "untitled-fleet")}',`);
  body.push(`  description: '${esc(meta.description || "")}',`);
  body.push("};");
  body.push("");
  body.push(`// Objective: ${esc(meta.objective || "")}`);
  body.push("");

  const emitAgent = (node: GraphNode, varName: string, extraComment?: string) => {
    if (extraComment) body.push(`// ${extraComment}`);
    const opts = agentOptions(node, "  ");
    body.push(`const ${varName} = await agent(`);
    body.push(`  \`${esc(promptFor(node, meta))}\`,`);
    if (opts) {
      body.push("  {");
      body.push(opts);
      body.push("  },");
    }
    body.push(");");
    body.push("");
  };

  for (const id of order) {
    if (emitted.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    const name = names.get(id)!;

    switch (node.data.kind) {
      case "start": {
        body.push(`// Entry — ${node.data.title}`);
        body.push(`const objective = \`${esc(meta.objective || node.data.summary)}\`;`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "phase": {
        body.push(`phase('${esc(node.data.title)}');`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "agent": {
        emitAgent(node, name);
        emitted.add(id);
        break;
      }
      case "verify": {
        const lenses = node.data.lenses
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const vote =
          node.data.voteRule === "all"
            ? "lenses.length"
            : node.data.voteRule === "any"
              ? "1"
              : "Math.ceil(lenses.length / 2)";
        body.push(`// Verify — ${node.data.title} (${node.data.voteRule || "majority"})`);
        body.push(`const lenses = ${JSON.stringify(lenses.length ? lenses : ["correctness", "security", "repro"])};`);
        body.push(`const ${name}_votes = await parallel(`);
        body.push("  lenses.map((lens) => () =>");
        body.push("    agent(");
        body.push(`      \`${esc(promptFor(node, meta))}\\nLens: \${lens}\`,`);
        body.push("      {");
        const opts = agentOptions(node, "        ");
        if (opts) body.push(opts);
        body.push("      },");
        body.push("    ),");
        body.push("  ),");
        body.push(");");
        body.push(`const ${name} = ${name}_votes.filter(Boolean).filter((v) => v.real).length >= ${vote};`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "parallel": {
        const kids = outgoing(edges, id)
          .map((e) => byId.get(e.target))
          .filter((n): n is GraphNode => !!n && (n.data.kind === "agent" || n.data.kind === "verify"));
        body.push(`// Parallel fan-out — ${node.data.title}`);
        if (kids.length === 0) {
          body.push(`const ${name} = await parallel([`);
          body.push("  () => agent('Fan-out worker A', { label: 'worker-a' }),");
          body.push("  () => agent('Fan-out worker B', { label: 'worker-b' }),");
          body.push("]);");
        } else {
          body.push(`const ${name} = await parallel([`);
          for (const kid of kids) {
            const kn = names.get(kid.id)!;
            emitted.add(kid.id);
            body.push("  () => agent(");
            body.push(`    \`${esc(promptFor(kid, meta))}\`,`);
            body.push("    {");
            const opts = agentOptions(kid, "      ");
            if (opts) body.push(opts);
            else body.push(`      label: '${esc(kn)}',`);
            body.push("    },");
            body.push("  ),");
          }
          body.push("]);");
        }
        body.push(`const ${name}_ok = ${name}.filter(Boolean);`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "pipeline": {
        const srcEdge = edges.find((e) => e.target === id && e.data?.kind !== "loop");
        const srcName = srcEdge ? names.get(srcEdge.source) : undefined;
        const contract = srcEdge?.data?.contract || "files";
        const items = srcName ? `${srcName}.${contract} ?? ${srcName}` : "items";
        body.push(`// Pipeline — ${node.data.title}`);
        body.push(`const ${name} = await pipeline(${items}, (item) =>`);
        body.push("  agent(");
        body.push(`    \`${esc(promptFor(node, meta) || "Transform ${item}")}\`,`);
        body.push("    {");
        const opts = agentOptions(node, "      ");
        if (opts) body.push(opts);
        body.push("      label: String(item),");
        body.push("    },");
        body.push("  ),");
        body.push(");");
        body.push(`const ${name}_ok = ${name}.filter(Boolean);`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "reduce": {
        const srcs = edges.filter((e) => e.target === id && e.data?.kind !== "loop");
        let src = "raw";
        for (const e of srcs) {
          const n = byId.get(e.source);
          if (n?.data.kind === "parallel" || n?.data.kind === "pipeline") {
            src = names.get(n.id) ?? src;
            break;
          }
        }
        if (src === "raw") {
          for (const e of srcs) {
            const ups = edges.filter((x) => x.target === e.source && x.data?.kind !== "loop");
            const par = ups.map((u) => byId.get(u.source)).find((n) => n?.data.kind === "parallel" || n?.data.kind === "pipeline");
            if (par) {
              src = names.get(par.id) ?? src;
              break;
            }
          }
        }
        if (src === "raw" && srcs[0]) src = names.get(srcs[0].source) || "raw";
        body.push(`// Reduce — ${node.data.title} (zero model tokens)`);
        body.push(`const key = (x) => x.url ?? x.id ?? x.file ?? JSON.stringify(x);`);
        const expr = node.data.reduceExpr.trim() || "raw.filter(Boolean)";
        body.push(`const raw = ${src};`);
        body.push(`const ${name} = ${expr};`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "router": {
        const field = node.data.conditionField || "severity";
        const srcEdge = edges.find((e) => e.target === id && e.data?.kind !== "loop");
        const srcName = srcEdge ? names.get(srcEdge.source) : "input";
        body.push(`// Router — ${node.data.title}`);
        body.push(`const ${name}_key = ${srcName}?.${field} ?? ${srcName};`);
        const branches = node.data.branches.length
          ? node.data.branches
          : [
              { id: "high", value: "high", label: "High" },
              { id: "low", value: "low", label: "Low" },
            ];
        branches.forEach((b, i) => {
          const handleKids = outgoing(edges, id).filter((e) => (e.sourceHandle ?? "") === b.id);
          const kw = i === 0 ? "if" : "else if";
          body.push(`${kw} (${name}_key === '${esc(b.value)}') {`);
          if (handleKids.length === 0) {
            body.push(`  // ${b.label} branch — connect a node to handle “${b.id}”`);
          } else {
            for (const e of handleKids) {
              const kid = byId.get(e.target);
              if (!kid) continue;
              if (kid.data.kind === "agent" || kid.data.kind === "verify") {
                body.push(`  const ${names.get(kid.id)} = await agent(\`${esc(promptFor(kid, meta))}\`, {`);
                const opts = agentOptions(kid, "    ");
                if (opts) body.push(opts);
                body.push("  });");
                emitted.add(kid.id);
              } else if (kid.data.kind === "parallel") {
                body.push(`  const ${names.get(kid.id)} = await parallel([/* ${kid.data.title} */]);`);
              } else {
                body.push(`  // continue → ${kid.data.title}`);
              }
            }
          }
          body.push("}");
        });
        body.push("else {");
        body.push("  // default branch");
        body.push("}");
        body.push("");
        emitted.add(id);
        break;
      }
      case "loop": {
        body.push(`// Loop-until-dry — ${node.data.title}`);
        body.push("const key = (x) => x.id ?? x.url ?? JSON.stringify(x);");
        body.push("const seen = new Set();");
        body.push("const confirmed = [];");
        body.push("let dry = 0;");
        body.push(`let iter = 0;`);
        body.push(`while (dry < ${node.data.dryRounds || 2} && iter < ${node.data.maxIterations || 8}) {`);
        body.push("  iter += 1;");
        const kids = outgoing(edges, id)
          .map((e) => byId.get(e.target))
          .filter((n): n is GraphNode => !!n);
        if (kids.length) {
          body.push("  const found = (await parallel([");
          for (const kid of kids.filter((k) => k.data.kind === "agent" || k.data.kind === "verify" || k.data.kind === "parallel")) {
            body.push("    () => agent(");
            body.push(`      \`${esc(promptFor(kid, meta))}\`,`);
            body.push("      {");
            const opts = agentOptions(kid, "        ");
            if (opts) body.push(opts);
            body.push("      },");
            body.push("    ),");
            if (kid.data.kind === "agent" || kid.data.kind === "verify") emitted.add(kid.id);
          }
          body.push("  ])).filter(Boolean).flatMap((r) => r.bugs ?? r.items ?? r);");
        } else {
          body.push("  const found = (await parallel([");
          body.push("    () => agent('Find the next unseen batch.', { schema: BUGS }),");
          body.push("  ])).filter(Boolean).flatMap((r) => r.bugs ?? []);");
        }
        body.push("  const fresh = found.filter((b) => !seen.has(key(b)));");
        body.push("  if (!fresh.length) { dry += 1; continue; }");
        body.push("  dry = 0;");
        body.push("  fresh.forEach((b) => seen.add(key(b)));");
        body.push("  confirmed.push(...fresh);");
        body.push("}");
        body.push(`const ${name} = confirmed;`);
        body.push("");
        emitted.add(id);
        break;
      }
      case "output": {
        const srcs = edges
          .filter((e) => e.target === id)
          .map((e) => names.get(e.source))
          .filter(Boolean);
        body.push(`// Output — ${node.data.title}`);
        body.push(`return ${srcs[0] || "confirmed"};`);
        body.push("");
        emitted.add(id);
        break;
      }
      default:
        emitted.add(id);
    }
  }

  return body.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function generateMermaid(nodes: GraphNode[], edges: GraphEdge[], meta: WorkflowMeta): string {
  const lines = [
    "%%{init: {\"theme\": \"base\", \"themeVariables\": {\"background\": \"transparent\", \"lineColor\": \"#8b93a7\", \"fontFamily\": \"IBM Plex Mono\"}}}%%",
    "graph TD",
    `  %% ${meta.name} — ${meta.description}`,
  ];

  const safe = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

  for (const n of nodes) {
    const title = n.data.title.replace(/"/g, "'");
    const shape =
      n.data.kind === "router"
        ? `${safe(n.id)}{\"${title}\"}`
        : n.data.kind === "output" || n.data.kind === "start"
          ? `${safe(n.id)}((\"${title}\"))`
          : n.data.kind === "loop"
            ? `${safe(n.id)}(((\"${title}\")))`
            : n.data.kind === "reduce"
              ? `${safe(n.id)}[\"${title}\"]`
              : `${safe(n.id)}[\"${title}\"]`;
    lines.push(`  ${shape}`);
  }

  for (const e of edges) {
    const label = (e.data?.label || e.data?.contract || "").replace(/"/g, "'");
    const arrow = e.data?.kind === "loop" ? "-.->" : e.data?.kind === "verify" ? "==>" : "-->";
    if (label) lines.push(`  ${safe(e.source)} ${arrow}|${label}| ${safe(e.target)}`);
    else lines.push(`  ${safe(e.source)} ${arrow} ${safe(e.target)}`);
  }

  lines.push("");
  lines.push("  classDef agent fill:#8B0000,color:#fff,stroke:#8B0000");
  lines.push("  classDef hook fill:#189AB4,color:#fff,stroke:#189AB4");
  lines.push("  classDef decision fill:#444,color:#fff,stroke:#666");
  lines.push("  classDef gold fill:#6b5420,color:#fff,stroke:#e8b84a");
  lines.push("  classDef pink fill:#6b2d4a,color:#fff,stroke:#e879a9");

  const classify = (kind: string, cls: string) => {
    const ids = nodes.filter((n) => n.data.kind === kind).map((n) => safe(n.id));
    if (ids.length) lines.push(`  class ${ids.join(",")} ${cls}`);
  };
  classify("start", "agent");
  classify("output", "agent");
  classify("agent", "hook");
  classify("parallel", "hook");
  classify("pipeline", "hook");
  classify("phase", "hook");
  classify("verify", "hook");
  classify("router", "decision");
  classify("reduce", "gold");
  classify("loop", "pink");

  return lines.join("\n");
}

export function generateBrief(nodes: GraphNode[], edges: GraphEdge[], meta: WorkflowMeta): string {
  const kinds = nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.data.kind] = (acc[n.data.kind] ?? 0) + 1;
    return acc;
  }, {});
  const loops = edges.filter((e) => e.data?.kind === "loop").length;
  const topology =
    loops > 0 && kinds.router
      ? "Conditional diamond + cycle"
      : loops > 0
        ? "Diamond + converging cycle"
        : kinds.router
          ? "Conditional diamond"
          : kinds.parallel || kinds.pipeline
            ? "Diamond — fan out → reduce → synthesize"
            : "Linear chain (degenerate graph)";

  const lines = [
    `# ${meta.name}`,
    "",
    meta.description,
    "",
    `**Objective.** ${meta.objective}`,
    "",
    `**Topology.** ${topology}`,
    `**Nodes.** ${nodes.length}   **Edges.** ${edges.length}   **Loop edges.** ${loops}`,
    "",
    "## Fleet",
    "",
  ];

  nodes.forEach((n, i) => {
    lines.push(`### ${i + 1}. ${n.data.title}  \`${n.data.kind}\``);
    lines.push("");
    if (n.data.summary) lines.push(n.data.summary);
    if (n.data.prompt) {
      lines.push("");
      lines.push("> " + n.data.prompt.split("\n").join("\n> "));
    }
    const bits = [
      n.data.model !== "session" ? `model: ${n.data.model}` : null,
      n.data.schemaName ? `schema: ${n.data.schemaName}` : null,
      n.data.phase ? `phase: ${n.data.phase}` : null,
      n.data.kind === "loop" ? `dry < ${n.data.dryRounds}, max ${n.data.maxIterations}` : null,
      n.data.kind === "verify" ? `vote: ${n.data.voteRule} · ${n.data.lenses}` : null,
    ].filter(Boolean);
    if (bits.length) {
      lines.push("");
      lines.push(bits.map((b) => `- ${b}`).join("\n"));
    }
    lines.push("");
  });

  lines.push("## Relations");
  lines.push("");
  if (edges.length === 0) lines.push("_No edges yet._");
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.source)?.data.title ?? e.source;
    const b = nodes.find((n) => n.id === e.target)?.data.title ?? e.target;
    const kind = e.data?.kind ?? "data";
    const contract = e.data?.contract ? ` \`${e.data.contract}\`` : "";
    lines.push(`- ${a} —${kind}${contract}→ ${b}`);
  }

  lines.push("");
  lines.push("## Runtime notes");
  lines.push("");
  lines.push("- Orchestration is JavaScript — zero model tokens on edges.");
  lines.push("- `parallel()` failures resolve to `null`; always `.filter(Boolean)`.");
  lines.push("- Concurrent agents cap at 16; 1,000 agents per run.");
  lines.push("- Save to `.claude/workflows/` and invoke by name.");
  lines.push("");
  lines.push("_Compiled by CODEZ Graph Engineering Studio._");

  return lines.join("\n");
}

export function generateJSON(nodes: GraphNode[], edges: GraphEdge[], meta: WorkflowMeta): string {
  return JSON.stringify(
    {
      meta,
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: n.data.kind,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        data: e.data,
      })),
    },
    null,
    2,
  );
}
