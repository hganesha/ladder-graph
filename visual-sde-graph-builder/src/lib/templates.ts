import type { WorkflowMeta } from "../types";
import { makeEdge, makeNode, type GraphEdge, type GraphNode } from "./model";

export interface FleetTemplate {
  id: string;
  name: string;
  topology: string;
  blurb: string;
  tag: string;
  meta: WorkflowMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const X = 340;
const Y = 168;

export const TEMPLATES: FleetTemplate[] = [
  {
    id: "research",
    name: "Cited research",
    topology: "Diamond + adversarial",
    tag: "deep-research",
    blurb: "Scope the question, fan out searches, reduce in JS, then N-vote skeptics before a cited synthesis.",
    meta: {
      name: "cited-research",
      description: "Diamond graph: scope → parallel search → code reduce → adversarial verify → synthesize.",
      objective: "Produce a cited report on the user’s question using only claims that survive a majority of skeptics.",
    },
    nodes: [
      makeNode("start", { x: X, y: 0 }, { title: "User question", summary: "The research objective that seeds the fleet." }, "t_start"),
      makeNode("phase", { x: X, y: Y }, { title: "Scope", phase: "Scope" }, "t_ps"),
      makeNode(
        "agent",
        { x: X, y: Y * 2 },
        {
          title: "Decompose angles",
          label: "research:scope",
          phase: "Scope",
          model: "sonnet",
          schemaName: "ScopeObject",
          prompt:
            "Decompose the objective into 4–8 independent search angles.\nEach angle needs a key, a retrieval query, and why it matters.\nDo not answer the question — only plan the search.",
          summary: "Bounded classifier that turns one question into parallel work.",
        },
        "t_scope",
      ),
      makeNode("phase", { x: X, y: Y * 3 }, { title: "Search", phase: "Search" }, "t_psearch"),
      makeNode(
        "parallel",
        { x: X, y: Y * 4 },
        { title: "Fan-out searches", summary: "One subagent per angle. Fresh context each.", phase: "Search" },
        "t_fan",
      ),
      makeNode(
        "agent",
        { x: X - 300, y: Y * 5 },
        {
          title: "Primary sources",
          label: "research:primary",
          phase: "Search",
          model: "haiku",
          schemaName: "ITEM_SCHEMA",
          prompt: "Search for primary sources on this angle. Return URLs, titles, and claim-level snippets.",
        },
        "t_sa",
      ),
      makeNode(
        "agent",
        { x: X, y: Y * 5 },
        {
          title: "Counter-literature",
          label: "research:counter",
          phase: "Search",
          model: "haiku",
          schemaName: "ITEM_SCHEMA",
          prompt: "Search for the strongest contradictory evidence on this angle.",
        },
        "t_sb",
      ),
      makeNode(
        "agent",
        { x: X + 300, y: Y * 5 },
        {
          title: "Recent reports",
          label: "research:recent",
          phase: "Search",
          model: "haiku",
          schemaName: "ITEM_SCHEMA",
          prompt: "Search for the latest reports, filings, or papers on this angle (last 18 months).",
        },
        "t_sc",
      ),
      makeNode(
        "reduce",
        { x: X, y: Y * 6 },
        {
          title: "Flatten + dedupe",
          summary: "Code reduce edge — never spend a model on merge.",
          reduceExpr:
            "raw.filter(Boolean).flatMap((r) => r.items ?? [])\n  .filter((x, i, a) => a.findIndex((y) => (y.url || y.title) === (x.url || x.title)) === i)",
        },
        "t_red",
      ),
      makeNode("phase", { x: X, y: Y * 7 }, { title: "Verify", phase: "Verify" }, "t_pv"),
      makeNode(
        "verify",
        { x: X, y: Y * 8 },
        {
          title: "Skeptic panel",
          label: "research:verify",
          phase: "Verify",
          model: "sonnet",
          schemaName: "VERDICT",
          voteRule: "majority",
          lenses: "correctness, sourcing, recency",
          prompt:
            "Refute this claim. Is it supported by the cited snippet? Return { real, reason }.\nA claim is real only if the source actually says it.",
          summary: "Adversarial N-vote. Majority must survive.",
        },
        "t_ver",
      ),
      makeNode("phase", { x: X, y: Y * 9 }, { title: "Synthesize", phase: "Synthesize" }, "t_psy"),
      makeNode(
        "agent",
        { x: X, y: Y * 10 },
        {
          title: "Cited report",
          label: "research:synth",
          phase: "Synthesize",
          model: "opus",
          schemaName: "Report",
          prompt:
            "Write a cited report from verified claims only. Do not introduce unsourced assertions.\nQuote or paraphrase with a URL after every factual sentence.",
          summary: "Single synthesis node — flagship tokens live here.",
        },
        "t_syn",
      ),
      makeNode("output", { x: X, y: Y * 11 }, { title: "Report to session", summary: "Only the final answer enters context." }, "t_out"),
    ],
    edges: [
      makeEdge("t_start", "t_ps", { kind: "control" }),
      makeEdge("t_ps", "t_scope", { kind: "control" }),
      makeEdge("t_scope", "t_psearch", { contract: "angles", label: "angles" }),
      makeEdge("t_psearch", "t_fan", { kind: "control" }),
      makeEdge("t_fan", "t_sa", { contract: "angle", label: "angle" }),
      makeEdge("t_fan", "t_sb", { contract: "angle", label: "angle" }),
      makeEdge("t_fan", "t_sc", { contract: "angle", label: "angle" }),
      makeEdge("t_sa", "t_red", { contract: "items" }),
      makeEdge("t_sb", "t_red", { contract: "items" }),
      makeEdge("t_sc", "t_red", { contract: "items" }),
      makeEdge("t_red", "t_pv", { contract: "unique", label: "unique" }),
      makeEdge("t_pv", "t_ver", { kind: "control" }),
      makeEdge("t_ver", "t_psy", { kind: "verify", contract: "survivors", label: "survivors" }),
      makeEdge("t_psy", "t_syn", { kind: "control" }),
      makeEdge("t_syn", "t_out", { contract: "report" }),
    ],
  },
  {
    id: "auth-audit",
    name: "Route security sweep",
    topology: "Diamond + verify edge",
    tag: "auth-audit",
    blurb: "List every route handler, audit in a pipeline, then a skeptic per finding before the report.",
    meta: {
      name: "audit-routes",
      description: "Audit every route handler for missing auth checks.",
      objective: "Find missing authentication and authorization checks across src/routes and report only surviving findings.",
    },
    nodes: [
      makeNode("start", { x: X, y: 0 }, { title: "Audit objective" }, "a_start"),
      makeNode(
        "agent",
        { x: X, y: Y },
        {
          title: "List route files",
          label: "audit:list",
          model: "haiku",
          schemaName: "FileList",
          prompt: "List every .ts/.tsx file under src/routes/ (or the project’s router directory). Return { files: string[] }.",
        },
        "a_list",
      ),
      makeNode(
        "pipeline",
        { x: X, y: Y * 2 },
        {
          title: "Per-route audit",
          label: "audit:file",
          model: "sonnet",
          schemaName: "BUGS",
          prompt: "Audit ${item} for missing authentication or authorization checks. Return concrete findings only.",
          summary: "pipeline() — no global barrier. Fast files finish first.",
        },
        "a_pipe",
      ),
      makeNode(
        "reduce",
        { x: X, y: Y * 3 },
        {
          title: "Collect findings",
          reduceExpr: "raw.filter(Boolean).flatMap((r) => r.bugs ?? [])",
        },
        "a_red",
      ),
      makeNode(
        "verify",
        { x: X, y: Y * 4 },
        {
          title: "Skeptic per finding",
          label: "audit:skeptic",
          model: "sonnet",
          schemaName: "VERDICT",
          lenses: "authn, authz, false-positive",
          voteRule: "majority",
          prompt: "Is this auth finding real, or a false positive given the surrounding middleware?",
        },
        "a_ver",
      ),
      makeNode(
        "agent",
        { x: X, y: Y * 5 },
        {
          title: "Security report",
          label: "audit:report",
          model: "opus",
          schemaName: "Report",
          prompt: "Write a severity-ordered report of surviving auth findings. Include file paths and a fix sketch.",
        },
        "a_rep",
      ),
      makeNode("output", { x: X, y: Y * 6 }, { title: "Report to session" }, "a_out"),
    ],
    edges: [
      makeEdge("a_start", "a_list"),
      makeEdge("a_list", "a_pipe", { contract: "files", label: "files" }),
      makeEdge("a_pipe", "a_red", { contract: "bugs" }),
      makeEdge("a_red", "a_ver", { contract: "findings", label: "findings" }),
      makeEdge("a_ver", "a_rep", { kind: "verify", contract: "survivors" }),
      makeEdge("a_rep", "a_out"),
    ],
  },
  {
    id: "discovery",
    name: "Unknown-size discovery",
    topology: "Cycle until dry",
    tag: "discover",
    blurb: "Parallel finders each round, dedupe against a seen-set, verify survivors, stop after two dry rounds.",
    meta: {
      name: "discover-until-dry",
      description: "Unknown-size discovery with a converging back-edge and seen-set dedupe.",
      objective: "Enumerate every instance of a class of issues until two consecutive finder rounds return nothing new.",
    },
    nodes: [
      makeNode("start", { x: X, y: 0 }, { title: "Discovery brief" }, "d_start"),
      makeNode(
        "loop",
        { x: X, y: Y },
        {
          title: "Until two dry rounds",
          dryRounds: 2,
          maxIterations: 8,
          summary: "Back-edge must terminate. Dedupe against seen, not only confirmed.",
        },
        "d_loop",
      ),
      makeNode(
        "parallel",
        { x: X, y: Y * 2 },
        { title: "Finder fleet", summary: "Independent hunters, same round." },
        "d_fan",
      ),
      makeNode(
        "agent",
        { x: X - 280, y: Y * 3 },
        {
          title: "Static finder",
          label: "find:static",
          model: "haiku",
          schemaName: "BUGS",
          prompt: "Search the repo for the next unseen batch of candidates. Ignore anything already in the seen-set.",
        },
        "d_fa",
      ),
      makeNode(
        "agent",
        { x: X + 280, y: Y * 3 },
        {
          title: "Runtime finder",
          label: "find:runtime",
          model: "haiku",
          schemaName: "BUGS",
          prompt: "From tests and logs, propose candidates not already seen.",
        },
        "d_fb",
      ),
      makeNode(
        "reduce",
        { x: X, y: Y * 4 },
        {
          title: "Dedupe vs seen",
          reduceExpr: "found.filter((b) => !seen.has(key(b)))",
          summary: "Rejected items stay in seen so they cannot respawn.",
        },
        "d_red",
      ),
      makeNode(
        "verify",
        { x: X, y: Y * 5 },
        {
          title: "Three-lens judge",
          label: "find:judge",
          model: "sonnet",
          schemaName: "VERDICT",
          lenses: "correctness, security, repro",
          voteRule: "majority",
          prompt: "Judge whether this candidate is real via the given lens.",
        },
        "d_ver",
      ),
      makeNode("output", { x: X, y: Y * 6.4 }, { title: "Confirmed set" }, "d_out"),
    ],
    edges: [
      makeEdge("d_start", "d_loop"),
      makeEdge("d_loop", "d_fan", { kind: "control" }),
      makeEdge("d_fan", "d_fa"),
      makeEdge("d_fan", "d_fb"),
      makeEdge("d_fa", "d_red", { contract: "bugs" }),
      makeEdge("d_fb", "d_red", { contract: "bugs" }),
      makeEdge("d_red", "d_ver", { contract: "fresh", label: "fresh" }),
      makeEdge("d_ver", "d_loop", { kind: "loop", label: "next round", targetHandle: "back" }),
      makeEdge("d_ver", "d_out", { contract: "confirmed", label: "confirmed" }),
    ],
  },
  {
    id: "diff-router",
    name: "Diff review router",
    topology: "Conditional diamond",
    tag: "review",
    blurb: "Classify the diff. Small changes take one reviewer; large ones fan out lenses, then a judge panel.",
    meta: {
      name: "diff-review",
      description: "Router on validated severity — light path vs parallel lenses plus judge.",
      objective: "Review the current diff with cost proportional to risk.",
    },
    nodes: [
      makeNode("start", { x: X, y: 0 }, { title: "Diff in hand" }, "r_start"),
      makeNode(
        "agent",
        { x: X, y: Y },
        {
          title: "Classify risk",
          label: "review:classify",
          model: "sonnet",
          schemaName: "Severity",
          prompt: "Classify this diff’s risk as low or high. Consider auth, data, and blast radius. Return { severity, rationale }.",
        },
        "r_cls",
      ),
      makeNode(
        "router",
        { x: X, y: Y * 2 },
        {
          title: "Branch on severity",
          conditionField: "severity",
          branches: [
            { id: "high", value: "high", label: "High" },
            { id: "low", value: "low", label: "Low" },
          ],
          summary: "Routing is deterministic JS — same input, same branch.",
        },
        "r_rt",
      ),
      makeNode(
        "parallel",
        { x: X - 260, y: Y * 3.15 },
        { title: "Review lenses" },
        "r_fan",
      ),
      makeNode(
        "agent",
        { x: X - 400, y: Y * 4.3 },
        {
          title: "Correctness",
          label: "review:correct",
          model: "sonnet",
          prompt: "Review the high-risk diff for correctness bugs only.",
        },
        "r_c",
      ),
      makeNode(
        "agent",
        { x: X - 120, y: Y * 4.3 },
        {
          title: "Security",
          label: "review:sec",
          model: "sonnet",
          prompt: "Review the high-risk diff for security issues only.",
        },
        "r_s",
      ),
      makeNode(
        "agent",
        { x: X + 260, y: Y * 3.15 },
        {
          title: "Quick review",
          label: "review:quick",
          model: "haiku",
          prompt: "Give a concise review of this low-risk diff. Flag only blocking issues.",
        },
        "r_q",
      ),
      makeNode(
        "agent",
        { x: X, y: Y * 5.5 },
        {
          title: "Judge panel",
          label: "review:judge",
          model: "opus",
          schemaName: "Report",
          prompt: "Synthesize lens reviews (or the quick review) into a single verdict. Graft runner-up ideas into the winner.",
        },
        "r_j",
      ),
      makeNode("output", { x: X, y: Y * 6.6 }, { title: "Review to session" }, "r_out"),
    ],
    edges: [
      makeEdge("r_start", "r_cls"),
      makeEdge("r_cls", "r_rt", { contract: "severity", label: "severity" }),
      makeEdge("r_rt", "r_fan", { kind: "control", label: "high", sourceHandle: "high" }),
      makeEdge("r_rt", "r_q", { kind: "control", label: "low", sourceHandle: "low" }),
      makeEdge("r_fan", "r_c"),
      makeEdge("r_fan", "r_s"),
      makeEdge("r_c", "r_j"),
      makeEdge("r_s", "r_j"),
      makeEdge("r_q", "r_j"),
      makeEdge("r_j", "r_out"),
    ],
  },
  {
    id: "module-port",
    name: "Module port",
    topology: "Diamond + cycle",
    tag: "port",
    blurb: "Translate files in parallel, run a test gate, and loop failures back until the suite is green.",
    meta: {
      name: "module-port",
      description: "Port a module file-by-file with a test gate and failure back-edge.",
      objective: "Port the selected module to the target stack. Failures re-enter the translator until tests pass or the cap hits.",
    },
    nodes: [
      makeNode("start", { x: X, y: 0 }, { title: "Port brief" }, "p_start"),
      makeNode(
        "agent",
        { x: X, y: Y },
        {
          title: "List source files",
          label: "port:list",
          model: "haiku",
          schemaName: "FileList",
          prompt: "List every file in the module that must be ported, in dependency order if obvious.",
        },
        "p_list",
      ),
      makeNode(
        "loop",
        { x: X, y: Y * 2 },
        { title: "Until tests pass", dryRounds: 1, maxIterations: 6, summary: "Failures re-enter. Cap the retries." },
        "p_loop",
      ),
      makeNode(
        "parallel",
        { x: X, y: Y * 3 },
        { title: "Translators" },
        "p_fan",
      ),
      makeNode(
        "agent",
        { x: X - 240, y: Y * 4 },
        {
          title: "Translate file",
          label: "port:translate",
          model: "sonnet",
          prompt: "Port this file to the target stack. Preserve behavior. Do not invent APIs.",
        },
        "p_tr",
      ),
      makeNode(
        "agent",
        { x: X + 240, y: Y * 4 },
        {
          title: "Test gate",
          label: "port:test",
          model: "haiku",
          schemaName: "BUGS",
          prompt: "Run or reason about the tests for the ported files. Return failing cases as bugs.",
        },
        "p_test",
      ),
      makeNode("output", { x: X, y: Y * 5.3 }, { title: "Ported module" }, "p_out"),
    ],
    edges: [
      makeEdge("p_start", "p_list"),
      makeEdge("p_list", "p_loop", { contract: "files", label: "files" }),
      makeEdge("p_loop", "p_fan"),
      makeEdge("p_fan", "p_tr"),
      makeEdge("p_fan", "p_test"),
      makeEdge("p_tr", "p_test", { contract: "files" }),
      makeEdge("p_test", "p_loop", { kind: "loop", label: "failures", targetHandle: "back" }),
      makeEdge("p_test", "p_out", { contract: "green", label: "green" }),
    ],
  },
  {
    id: "ecosystem",
    name: "Ecosystem scan",
    topology: "Scheduled diamond",
    tag: "scan",
    blurb: "Parallel source readers across the ecosystem, barrier-rank by impact, one synthesis note.",
    meta: {
      name: "ecosystem-scan",
      description: "Parallel readers over named sources, then a rank-and-synthesize barrier.",
      objective: "Scan the named ecosystem this week and return the highest-impact changes with receipts.",
    },
    nodes: [
      makeNode("start", { x: X, y: 0 }, { title: "Scan window" }, "e_start"),
      makeNode("phase", { x: X, y: Y }, { title: "Read sources", phase: "Read" }, "e_ph"),
      makeNode("parallel", { x: X, y: Y * 2 }, { title: "Source readers", phase: "Read" }, "e_fan"),
      makeNode(
        "agent",
        { x: X - 320, y: Y * 3.15 },
        {
          title: "Changelogs",
          label: "scan:changelogs",
          phase: "Read",
          model: "haiku",
          schemaName: "ITEM_SCHEMA",
          prompt: "Read official changelogs for the named projects this window. Extract impactful changes.",
        },
        "e_a",
      ),
      makeNode(
        "agent",
        { x: X, y: Y * 3.15 },
        {
          title: "Advisories",
          label: "scan:cve",
          phase: "Read",
          model: "haiku",
          schemaName: "ITEM_SCHEMA",
          prompt: "Collect security advisories touching the named ecosystem this window.",
        },
        "e_b",
      ),
      makeNode(
        "agent",
        { x: X + 320, y: Y * 3.15 },
        {
          title: "Community pulse",
          label: "scan:pulse",
          phase: "Read",
          model: "haiku",
          schemaName: "ITEM_SCHEMA",
          prompt: "Skim community threads for breaking changes, migrations, and deprecations.",
        },
        "e_c",
      ),
      makeNode(
        "reduce",
        { x: X, y: Y * 4.3 },
        {
          title: "Rank by impact",
          reduceExpr:
            "raw.filter(Boolean).flatMap((r) => r.items ?? [])\n  .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))\n  .slice(0, 12)",
        },
        "e_red",
      ),
      makeNode(
        "agent",
        { x: X, y: Y * 5.4 },
        {
          title: "Briefing",
          label: "scan:brief",
          model: "opus",
          schemaName: "Report",
          prompt: "Write a one-page briefing of the top-ranked changes. Each item needs a why-it-matters and a source.",
        },
        "e_syn",
      ),
      makeNode("output", { x: X, y: Y * 6.5 }, { title: "Briefing to session" }, "e_out"),
    ],
    edges: [
      makeEdge("e_start", "e_ph"),
      makeEdge("e_ph", "e_fan"),
      makeEdge("e_fan", "e_a"),
      makeEdge("e_fan", "e_b"),
      makeEdge("e_fan", "e_c"),
      makeEdge("e_a", "e_red", { contract: "items" }),
      makeEdge("e_b", "e_red", { contract: "items" }),
      makeEdge("e_c", "e_red", { contract: "items" }),
      makeEdge("e_red", "e_syn", { contract: "ranked", label: "ranked" }),
      makeEdge("e_syn", "e_out"),
    ],
  },
];

export function blankFleet(): FleetTemplate {
  return {
    id: "blank",
    name: "Blank fleet",
    topology: "Empty canvas",
    tag: "blank",
    blurb: "Start from an entry and an output. Draw the shape of work.",
    meta: {
      name: "untitled-fleet",
      description: "A dynamic workflow for a subagent fleet.",
      objective: "State the job the graph must finish.",
    },
    nodes: [
      makeNode("start", { x: 280, y: 180 }, { title: "User objective" }, "b_start"),
      makeNode("output", { x: 720, y: 180 }, { title: "Session output" }, "b_out"),
    ],
    edges: [],
  };
}

export function templateById(id: string): FleetTemplate {
  if (id === "blank") return blankFleet();
  return TEMPLATES.find((t) => t.id === id) ?? blankFleet();
}
