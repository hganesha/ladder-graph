import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";

const root = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(root, "catalog");
const manifestPath = resolve(catalogRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const agentDefinitions = [
  [
    "edu-01",
    "Instructional Designer",
    "Education & assessment",
    "research/education/design",
    ["text", "document"],
    "Design backward from measurable learning outcomes to instruction and evidence.",
    ["teaching", "product-design"],
  ],
  [
    "edu-02",
    "Assessment Item Writer",
    "Education & assessment",
    "research/education/assessment",
    ["text", "document"],
    "Write valid assessment items aligned to the supplied construct and difficulty specification.",
    ["teaching", "writing-editing"],
  ],
  [
    "edu-03",
    "Rubric Calibrator",
    "Education & assessment",
    "research/education/assessment",
    ["text", "document"],
    "Calibrate rubric language and examples so independent graders apply the same standard.",
    ["teaching", "evaluation"],
  ],
  [
    "edu-04",
    "Curriculum Alignment Reviewer",
    "Education & assessment",
    "research/education/curriculum",
    ["text", "document"],
    "Trace objectives, instruction, practice, and assessment to the supplied curriculum standard.",
    ["teaching", "evidence-verification"],
  ],
  [
    "edu-05",
    "Reading-Level Adapter",
    "Education & assessment",
    "research/education/access",
    ["text", "document"],
    "Adapt language and scaffolding to the requested reading level without changing the learning construct.",
    ["teaching", "accessibility", "writing-editing"],
  ],
  [
    "edu-06",
    "Assessment Bias Reviewer",
    "Education & assessment",
    "research/education/assessment",
    ["text", "document"],
    "Review items for construct-irrelevant barriers, stereotype activation, differential interpretation, and accessibility.",
    ["evaluation", "accessibility", "risk-analysis"],
  ],
  [
    "fin-01",
    "Equity Research Analyst",
    "Finance & risk",
    "research/finance/investment",
    ["text", "document"],
    "Build a source-grounded investment view that separates reported facts, estimates, assumptions, and valuation implications.",
    ["finance-analysis", "evidence-verification"],
  ],
  [
    "fin-02",
    "Bull-Case Advocate",
    "Finance & risk",
    "research/finance/investment",
    ["text", "document"],
    "Construct the strongest evidence-supported upside case and state the milestones required for it to hold.",
    ["finance-analysis", "decision-analysis"],
  ],
  [
    "fin-03",
    "Bear-Case Advocate",
    "Finance & risk",
    "research/finance/investment",
    ["text", "document"],
    "Construct the strongest evidence-supported downside case and identify permanent-loss mechanisms.",
    ["finance-analysis", "risk-analysis"],
  ],
  [
    "fin-04",
    "Financial Statement Extractor",
    "Finance & risk",
    "research/finance/filings",
    ["text", "document"],
    "Extract cited financial facts at the correct period, unit, basis, and consolidation scope.",
    ["finance-analysis", "evidence-verification"],
  ],
  [
    "fin-05",
    "Model Risk Validator",
    "Finance & risk",
    "research/finance/model-risk",
    ["text", "document"],
    "Validate model purpose, data, assumptions, implementation, sensitivity, limitations, and governance independently.",
    ["risk-analysis", "evaluation", "quantitative-analysis"],
  ],
  [
    "fin-06",
    "Credit Risk Analyst",
    "Finance & risk",
    "research/finance/credit",
    ["text", "document"],
    "Assess repayment capacity, structure, collateral, covenants, downside liquidity, and concentration risk.",
    ["finance-analysis", "risk-analysis"],
  ],
  [
    "fin-07",
    "Valuation Reviewer",
    "Finance & risk",
    "research/finance/valuation",
    ["text", "document"],
    "Re-derive valuation under explicit methods and assumptions and explain sensitivity without false precision.",
    ["finance-analysis", "quantitative-analysis", "evaluation"],
  ],
  [
    "jour-01",
    "Fact-Checker",
    "Journalism & verification",
    "research/journalism/verification",
    ["text", "document", "audio", "video"],
    "Verify every publishable factual claim against traceable evidence and label unresolved claims.",
    ["evidence-verification", "research"],
  ],
  [
    "jour-02",
    "Source Triangulator",
    "Journalism & verification",
    "research/journalism/verification",
    ["text", "document", "audio", "video"],
    "Compare independent source classes, incentives, provenance, timing, and contradictions before drawing a conclusion.",
    ["source-triangulation", "evidence-verification"],
  ],
  [
    "jour-03",
    "Standards & Ethics Editor",
    "Journalism & verification",
    "research/journalism/standards",
    ["text", "document"],
    "Apply the supplied editorial standards for fairness, harm, attribution, privacy, conflicts, and right of reply.",
    ["compliance-review", "risk-analysis", "writing-editing"],
  ],
  [
    "jour-04",
    "Corrections Officer",
    "Journalism & verification",
    "research/journalism/corrections",
    ["text", "document"],
    "Assess correction requests, preserve the publication record, and draft proportionate transparent corrections.",
    ["evidence-verification", "writing-editing", "compliance-review"],
  ],
  [
    "pub-01",
    "Solicitation Requirements Analyst",
    "Public sector procurement & grants",
    "research/public-sector/procurement",
    ["text", "document"],
    "Extract every solicitation requirement with citation, type, owner, evidence, and submission consequence.",
    ["compliance-review", "evidence-verification"],
  ],
  [
    "pub-02",
    "Compliance Matrix Builder",
    "Public sector procurement & grants",
    "research/public-sector/procurement",
    ["text", "document"],
    "Build a complete requirement-to-response matrix and expose every missing or conflicting response obligation.",
    ["compliance-review", "operations-planning"],
  ],
  [
    "pub-03",
    "Past-Performance Evidence Curator",
    "Public sector procurement & grants",
    "research/public-sector/evidence",
    ["text", "document"],
    "Select only relevant, permitted past-performance evidence and trace every claim to an approved record.",
    ["evidence-verification", "research"],
  ],
  [
    "pub-04",
    "Cost Realism Analyst",
    "Public sector procurement & grants",
    "research/public-sector/cost",
    ["text", "document"],
    "Test proposed cost against scope, labor, schedule, assumptions, risk, and the solicitation basis without inventing rates.",
    ["finance-analysis", "risk-analysis", "quantitative-analysis"],
  ],
  [
    "pub-05",
    "Grant Program Officer",
    "Public sector procurement & grants",
    "research/public-sector/grants",
    ["text", "document"],
    "Evaluate eligibility, public purpose, evidence, milestones, budget allowability, and reporting obligations consistently.",
    ["compliance-review", "evaluation", "finance-analysis"],
  ],
  [
    "pub-06",
    "Public Comment Analyst",
    "Public sector procurement & grants",
    "research/public-sector/policy",
    ["text", "document"],
    "Code public comments transparently, preserve minority views, separate volume from representativeness, and trace themes to records.",
    ["research", "evidence-verification", "statistical-analysis"],
  ],
  [
    "gxp-01",
    "Trial Site Feasibility Assessor",
    "Life sciences & GxP operations",
    "research/life-sciences/clinical-ops",
    ["text", "document"],
    "Assess site population, staffing, facilities, competing trials, timelines, and evidence quality against the protocol.",
    ["clinical-review", "operations-planning", "risk-analysis"],
  ],
  [
    "gxp-02",
    "Protocol Deviation Analyst",
    "Life sciences & GxP operations",
    "research/life-sciences/clinical-ops",
    ["text", "document"],
    "Classify protocol deviations against approved rules, assess participant and data impact, and preserve required escalation.",
    ["clinical-review", "compliance-review", "risk-analysis"],
  ],
  [
    "gxp-03",
    "Pharmacovigilance Signal Analyst",
    "Life sciences & GxP operations",
    "research/life-sciences/safety",
    ["text", "document"],
    "Triage safety cases and signals using the supplied criteria, evidence, expectedness, seriousness, and reporting clocks.",
    ["clinical-review", "risk-analysis", "statistical-analysis"],
  ],
  [
    "gxp-04",
    "GMP Batch Record Reviewer",
    "Life sciences & GxP operations",
    "research/life-sciences/manufacturing",
    ["text", "document"],
    "Review the complete batch record for execution, reconciliation, deviations, data integrity, and release prerequisites.",
    ["manufacturing-analysis", "compliance-review", "evaluation"],
  ],
  [
    "gxp-05",
    "Stability Study Analyst",
    "Life sciences & GxP operations",
    "research/life-sciences/quality",
    ["text", "document"],
    "Evaluate stability data against protocol, trends, excursions, methods, storage conditions, and shelf-life claims.",
    ["scientific-analysis", "statistical-analysis", "compliance-review"],
  ],
  [
    "gxp-06",
    "Regulatory Submission Coordinator",
    "Life sciences & GxP operations",
    "research/life-sciences/regulatory",
    ["text", "document"],
    "Coordinate submission content, dependencies, source references, publishing checks, commitments, and authority timelines.",
    ["regulatory-analysis", "operations-planning", "evidence-verification"],
  ],
  [
    "gxp-07",
    "Validation Protocol Author",
    "Life sciences & GxP operations",
    "research/life-sciences/validation",
    ["text", "document"],
    "Author traceable validation objectives, acceptance criteria, evidence capture, deviations, approvals, and change control.",
    ["evaluation", "compliance-review", "writing-editing"],
  ],
  [
    "gxp-08",
    "Supplier Qualification Auditor (GxP)",
    "Life sciences & GxP operations",
    "research/life-sciences/suppliers",
    ["text", "document"],
    "Assess supplier quality systems, technical capability, data integrity, change notification, audit evidence, and residual risk.",
    ["supply-chain-analysis", "compliance-review", "risk-analysis"],
  ],
];

function titleCase(id) {
  return id
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

for (const [id, title, area, path, modalities, prompt, skills] of agentDefinitions) {
  const document = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "AgentTemplate",
    metadata: { name: id, title },
    spec: {
      path,
      areas: [area],
      modalities,
      role: `${title} operating within supplied evidence, policy, and human-approval boundaries.`,
      prompt,
      capabilities: {
        skills,
        tools: ["read"],
        connectors: [],
        permissions: [area.includes("Life sciences") ? "read-sensitive" : "read-only"],
      },
    },
  };
  const file = `agents/${id}.yaml`;
  await writeFile(resolve(catalogRoot, file), stringify(document, { lineWidth: 110 }));
  if (!manifest.agents.some((entry) => entry.id === id)) manifest.agents.push({ id, path, title, file });
}

const agentDocuments = new Map();
for (const entry of manifest.agents) agentDocuments.set(entry.id, parse(await readFile(resolve(catalogRoot, entry.file), "utf8")));

function roleNode(templateRef, id = templateRef, name = null) {
  const agent = agentDocuments.get(templateRef);
  if (!agent) throw new Error(`Unknown roadmap agent ${templateRef}`);
  return {
    id,
    kind: "agent",
    name: name ?? agent.metadata.title,
    templateRef,
    role: agent.spec.role,
    prompt: agent.spec.prompt,
    capabilities: agent.spec.capabilities,
    outputSchema: { type: "object" },
  };
}

function inputNode(modality = "document") {
  if (modality === "text")
    return {
      id: "intake",
      kind: "input",
      name: "Request and constraints",
      inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" } }, "x-ladder-input-mode": "text" },
    };
  const mediaType =
    modality === "image" ? "image/*" : modality === "video" ? "video/*" : modality === "audio" ? "audio/*" : "application/pdf";
  return {
    id: "intake",
    kind: "input",
    name: "Source material and instructions",
    inputSchema: {
      type: "object",
      required: ["asset", "instructions"],
      properties: { asset: { type: "string", contentMediaType: mediaType }, instructions: { type: "string" } },
      "x-ladder-input-mode": modality,
    },
  };
}

function approvalNode(label = "Accountable reviewer approves release") {
  return { id: "approval", kind: "approval", name: label };
}
function outputNode() {
  return { id: "result", kind: "output", name: "Released deliverable and unresolved-item register" };
}
function edge(id, from, to, kind = "data", condition = undefined) {
  return { id, from, to, kind, ...(condition ? { condition } : {}) };
}

function shapedWorkflow(def) {
  const roles = def.roles.map((id, index) => roleNode(id, `role-${index + 1}`));
  const nodes = [inputNode(def.modality), ...roles];
  const edges = [];
  let edgeIndex = 1;
  const add = (from, to, kind = "data", condition) => edges.push(edge(`e${edgeIndex++}`, from, to, kind, condition));
  const roleIds = roles.map((node) => node.id);
  const addApproval = (from, condition) => {
    nodes.push(approvalNode(def.approval), outputNode());
    add(from, "approval", condition ? "control" : "dependency", condition);
    add("approval", "result", "dependency", "approved");
  };

  if (["group-subgraph", "teacher", "transform-group", "concat-teacher"].includes(def.shape)) {
    if (def.shape === "transform-group") {
      nodes.push({
        id: "requirements",
        kind: "transform",
        name: "Split cited requirements",
        config: { operation: "slice", expression: "$.requirements[0:200]" },
      });
      add("intake", "requirements");
    }
    nodes.push({
      id: "work-group",
      kind: "group",
      name: "Bounded specialist phase",
      config: {
        members: roleIds,
        execution: def.shape === "group-subgraph" ? "sequential" : "parallel",
        exit: def.shape === "group-subgraph" ? "serialize" : "aggregate",
      },
    });
    add(def.shape === "transform-group" ? "requirements" : "intake", "work-group");
    if (def.shape === "group-subgraph") {
      nodes.push({
        id: "phase",
        kind: "subgraph",
        name: "Reusable review phase",
        config: {
          subgraph: {
            ref: "ladder://workflows/builtin/refinement",
            inputMap: { request: "/group" },
            outputMap: { result: "/review" },
            checkpointer: "inherit",
          },
        },
      });
      add("work-group", "phase");
      addApproval("phase");
    } else if (def.shape === "transform-group") {
      nodes.push({ id: "collect", kind: "aggregator", name: "Collect compliant responses", config: { aggregation: "collect" } });
      add("work-group", "collect");
      addApproval("collect");
    } else {
      nodes.push({
        id: "teacher",
        kind: "teacher",
        name: "Independent rubric review",
        role: "Host-resolved teacher model",
        prompt:
          "Apply the supplied rubric consistently, cite specific evidence, and return actionable feedback without silently rewriting the work.",
        inlineRole: true,
        capabilities: { skills: ["evaluation"], tools: ["read"], connectors: [], permissions: ["read-only"] },
        outputSchema: { type: "object" },
        config: { teacherModel: "host:teacher-model", feedbackMode: def.shape === "concat-teacher" ? "rubric" : "score" },
      });
      if (def.shape === "concat-teacher") {
        nodes.push({ id: "assemble", kind: "aggregator", name: "Assemble ordered sections", config: { aggregation: "concat" } });
        add("work-group", "assemble");
        add("assemble", "teacher");
      } else add("work-group", "teacher");
      addApproval("teacher");
    }
  } else {
    for (const id of roleIds) add("intake", id);
    if (["vote", "verify-vote"].includes(def.shape)) {
      nodes.push(
        { id: "combine", kind: "aggregator", name: "Preserve positions and ties", config: { aggregation: "vote" } },
        {
          id: "decision",
          kind: "condition",
          name: "Decision supported?",
          config: {
            expression: "vote.has_supported_position",
            branches: [
              { label: "Supported", when: "supported" },
              { label: "Escalate", when: "escalate" },
            ],
          },
        },
      );
      for (const id of roleIds) add(id, "combine");
      add("combine", "decision");
      addApproval("decision", "supported");
    } else if (def.shape === "tool") {
      nodes.push(
        { id: "join", kind: "join", name: "Join extracted and reviewed evidence", config: { join: "all" } },
        {
          id: "calculate",
          kind: "tool",
          name: "Host-resolved deterministic calculation",
          capabilities: { skills: ["quantitative-analysis"], tools: ["calculate"], connectors: [], permissions: ["read-only"] },
        },
        {
          id: "select",
          kind: "transform",
          name: "Select and rename cited fields",
          config: { operation: "rename", expression: "$.reported as reported_values" },
        },
      );
      for (const id of roleIds) add(id, "join");
      add("join", "calculate");
      add("calculate", "select");
      addApproval("select");
    } else if (def.shape === "merge-teacher") {
      nodes.push(
        { id: "combine", kind: "aggregator", name: "Merge findings and surface collisions", config: { aggregation: "merge" } },
        {
          id: "teacher",
          kind: "teacher",
          name: "Independent model-risk critique",
          role: "Host-resolved teacher model",
          prompt: "Critique the merged evidence against the supplied validation standard and preserve unresolved limitations.",
          inlineRole: true,
          capabilities: { skills: ["evaluation"], tools: ["read"], connectors: [], permissions: ["read-only"] },
          outputSchema: { type: "object" },
          config: { teacherModel: "host:teacher-model", feedbackMode: "critique" },
        },
      );
      for (const id of roleIds) add(id, "combine");
      add("combine", "teacher");
      addApproval("teacher");
    } else if (def.shape === "warn-loop") {
      nodes.push(
        { id: "collect", kind: "aggregator", name: "Collect publication and correction evidence", config: { aggregation: "collect" } },
        {
          id: "corrections-loop",
          kind: "loop",
          name: "Bounded correction follow-up",
          config: { body: roleIds, exitCondition: "correction.resolved == true", maxIterations: 3, onExhausted: "warn" },
        },
      );
      for (const id of roleIds) add(id, "collect");
      add("collect", "corrections-loop", "control", "correction_open");
      nodes.push(approvalNode(def.approval), outputNode());
      add("collect", "approval", "control", "complete");
      add("corrections-loop", "approval", "control", "loop_exhausted");
      add("approval", "result", "dependency", "approved");
    } else if (def.shape === "barrier") {
      nodes.push(
        { id: "barrier", kind: "join", name: "Wait for every release barrier", config: { join: "all" } },
        {
          id: "release-gate",
          kind: "condition",
          name: "Every barrier proven?",
          config: {
            expression: "barriers.every(item => item.passed)",
            branches: [
              { label: "Release", when: "release" },
              { label: "Hold", when: "hold" },
            ],
          },
        },
      );
      for (const id of roleIds) add(id, "barrier");
      add("barrier", "release-gate");
      addApproval("release-gate", "release");
    } else if (def.shape === "triage") {
      nodes.splice(1, 0, {
        id: "prioritize",
        kind: "transform",
        name: "Filter, sort, and bound the queue",
        config: { operation: "filter", expression: "$.cases where reportable_or_uncertain" },
      });
      edges.length = 0;
      edgeIndex = 1;
      add("intake", "prioritize");
      for (const id of roleIds) add("prioritize", id);
      nodes.push(
        { id: "collect", kind: "aggregator", name: "Collect signal assessments", config: { aggregation: "collect" } },
        {
          id: "escalation",
          kind: "condition",
          name: "Reporting clock triggered?",
          config: {
            expression: "signals.any(item => item.reportable)",
            branches: [
              { label: "Escalate", when: "escalate" },
              { label: "Monitor", when: "monitor" },
            ],
          },
        },
      );
      for (const id of roleIds) add(id, "collect");
      add("collect", "escalation");
      addApproval("escalation", "escalate");
    }
  }
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Workflow",
    metadata: { name: def.name, title: def.title, description: def.description, version: "1.0.0" },
    spec: {
      objective: def.description,
      policies: { maxConcurrency: 4, onFailure: "preserve-completed", requireApprovalFor: ["approval"] },
      nodes,
      edges,
    },
  };
}

const areaWorkflows = [
  [
    "wf-edu-01",
    "backward-designed-curriculum-unit",
    "Education & assessment",
    "Backward-designed curriculum unit",
    "Design a standards-aligned unit through a serialized phase and reusable review subgraph.",
    "document",
    ["edu-01", "edu-04", "lib-01"],
    "group-subgraph",
  ],
  [
    "wf-edu-02",
    "item-bank-generation-bias-review",
    "Education & assessment",
    "Item bank generation + bias review",
    "Generate assessment items in parallel and score them against alignment, accessibility, and bias criteria.",
    "document",
    ["edu-02", "edu-05", "edu-06", "dev-12"],
    "teacher",
  ],
  [
    "wf-fin-01",
    "investment-memo-red-team-panel",
    "Finance & risk",
    "Investment memo + red-team panel",
    "Preserve bull, bear, and base positions and route unsupported consensus to accountable review.",
    "document",
    ["fin-01", "fin-02", "fin-03"],
    "vote",
  ],
  [
    "wf-fin-02",
    "filing-analysis-numeric-tie-out",
    "Finance & risk",
    "Filing analysis + numeric tie-out",
    "Extract cited filing values, independently calculate key figures, and release only a traceable tie-out.",
    "document",
    ["fin-04", "acct-06", "fin-07"],
    "tool",
  ],
  [
    "wf-fin-03",
    "model-risk-validation",
    "Finance & risk",
    "Model risk validation",
    "Merge independent model, credit, and governance findings before a teacher-model critique.",
    "document",
    ["fin-05", "insr-03", "fin-06"],
    "merge-teacher",
  ],
  [
    "wf-jour-01",
    "claim-triangulation-standards-gate",
    "Journalism & verification",
    "Claim triangulation + standards gate",
    "Triangulate independent source classes and preserve disputed claims before publication approval.",
    "document",
    ["jour-01", "jour-02", "hist-04", "hist-05"],
    "verify-vote",
  ],
  [
    "wf-jour-02",
    "investigation-publication-corrections",
    "Journalism & verification",
    "Investigation → publication → corrections",
    "Publish through an ethics gate and continue transparently when bounded correction follow-up is exhausted.",
    "document",
    ["jour-03", "jour-04", "write-02"],
    "warn-loop",
  ],
  [
    "wf-pub-01",
    "rfp-compliance-submission-gate",
    "Public sector procurement & grants",
    "RFP compliance matrix + submission gate",
    "Split cited requirements, prepare responses in parallel, collect evidence, and gate submission.",
    "document",
    ["pub-01", "pub-02", "pub-04"],
    "transform-group",
  ],
  [
    "wf-pub-02",
    "grant-proposal-assembly",
    "Public sector procurement & grants",
    "Grant proposal assembly",
    "Assemble an evidence-backed grant application and score it against the supplied rubric.",
    "document",
    ["pub-05", "pub-03", "write-05"],
    "concat-teacher",
  ],
  [
    "wf-gxp-01",
    "gmp-batch-release-barrier",
    "Life sciences & GxP operations",
    "GMP batch release + barrier verification",
    "Require every batch, validation, quality, and manufacturing barrier before two-person release.",
    "document",
    ["gxp-04", "gxp-07", "mfg-05", "qac-05"],
    "barrier",
  ],
  [
    "wf-gxp-02",
    "pharmacovigilance-signal-triage",
    "Life sciences & GxP operations",
    "Pharmacovigilance signal triage",
    "Prioritize safety cases, preserve uncertainty, and trigger accountable reporting clocks.",
    "document",
    ["gxp-03", "bio-05", "qac-01"],
    "triage",
  ],
].map(([id, name, area, title, description, modality, roles, shape]) => ({
  id,
  name,
  area,
  title,
  description,
  modality,
  roles,
  shape,
  approval: "Accountable domain reviewer approves release",
}));

function compositeWorkflow(def) {
  const roles = def.roles.map((id, index) => roleNode(id, `role-${index + 1}`));
  const nodes = [inputNode(def.modality ?? "document"), ...roles];
  const edges = [];
  let number = 1;
  const add = (from, to, kind = "data", condition) => edges.push(edge(`e${number++}`, from, to, kind, condition));
  for (const role of roles) add("intake", role.id);
  if (def.strategy === "allSettled")
    nodes.push({ id: "combine", kind: "join", name: "Preserve completed and failed branches", config: { join: "allSettled" } });
  else
    nodes.push({
      id: "combine",
      kind: "aggregator",
      name: "Reconcile cross-area findings",
      config: { aggregation: def.strategy ?? "merge" },
    });
  for (const role of roles) add(role.id, "combine");
  nodes.push(approvalNode(def.approval ?? "Cross-functional authority approves release"), outputNode());
  add("combine", "approval", "dependency");
  add("approval", "result", "dependency", "approved");
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Workflow",
    metadata: { name: def.name, title: def.title, description: def.description, version: "1.0.0" },
    spec: {
      objective: def.description,
      policies: { maxConcurrency: 6, onFailure: "preserve-completed", requireApprovalFor: ["approval"] },
      nodes,
      edges,
    },
  };
}

function programWorkflow() {
  const roleIds = ["dev-01", "dev-02", "dev-05", "dev-09", "dev-13", "sec-12", "sec-13", "qac-04", "gxp-07"];
  const roles = roleIds.map((id, index) => roleNode(id, `role-${index + 1}`));
  const subgraph = (id, ref) => ({
    id,
    kind: "subgraph",
    name: titleCase(id),
    config: { subgraph: { ref, inputMap: { request: "/input" }, outputMap: { result: "/output" }, checkpointer: "perInvocation" } },
  });
  const nodes = [
    inputNode("document"),
    ...roles,
    subgraph("discovery-phase", "ladder://workflows/builtin/feature-spec"),
    subgraph("architecture-phase", "ladder://workflows/builtin/secure-software-delivery"),
    {
      id: "delivery-group",
      kind: "group",
      name: "Parallel regulated delivery disciplines",
      config: { members: roles.map((role) => role.id), execution: "parallel", exit: "aggregate" },
    },
    { id: "evidence-join", kind: "join", name: "Join delivery and architecture evidence", config: { join: "all" } },
    subgraph("verification-phase", "ladder://workflows/builtin/implementation-review"),
    {
      id: "evidence-tool",
      kind: "tool",
      name: "Host-resolved validation evidence check",
      capabilities: { skills: ["evaluation"], tools: ["test"], connectors: ["mcp:github"], permissions: ["read-only"] },
    },
    {
      id: "evidence-select",
      kind: "transform",
      name: "Select release evidence",
      config: { operation: "select", expression: "$.verified_evidence" },
    },
    subgraph("security-phase", "ladder://workflows/builtin/threat-model"),
    { id: "release-merge", kind: "aggregator", name: "Merge validation and security evidence", config: { aggregation: "merge" } },
    {
      id: "release-evaluation",
      kind: "evaluate",
      name: "Score release readiness",
      role: "Independent regulated release evaluator",
      prompt:
        "Score the supplied release evidence against every approved acceptance criterion and preserve every failed or unavailable check.",
      inlineRole: true,
      capabilities: { skills: ["evaluation"], tools: ["read"], connectors: [], permissions: ["read-only"] },
      outputSchema: { type: "object" },
      config: { threshold: 0.95 },
    },
    {
      id: "release-decision",
      kind: "condition",
      name: "Release evidence complete?",
      config: {
        expression: "evaluation.passed",
        branches: [
          { label: "Ready", when: "ready" },
          { label: "Blocked", when: "blocked" },
        ],
      },
    },
    { id: "quality-approval", kind: "approval", name: "Quality and validation approve evidence" },
    subgraph("deployment-phase", "ladder://workflows/builtin/full-stack-delivery"),
    { id: "release-approval", kind: "approval", name: "Business, security, and quality authorize release" },
    outputNode(),
  ];
  const edges = [];
  let n = 1;
  const add = (from, to, kind = "data", condition) => edges.push(edge(`e${n++}`, from, to, kind, condition));
  add("intake", "discovery-phase");
  add("discovery-phase", "architecture-phase");
  add("architecture-phase", "delivery-group");
  add("architecture-phase", "evidence-join");
  add("delivery-group", "evidence-join");
  add("evidence-join", "verification-phase");
  add("verification-phase", "evidence-tool", "dependency");
  add("evidence-tool", "evidence-select");
  add("evidence-select", "security-phase");
  add("evidence-select", "release-merge");
  add("security-phase", "release-merge");
  add("release-merge", "release-evaluation");
  add("release-evaluation", "release-decision");
  add("release-decision", "quality-approval", "control", "ready");
  add("quality-approval", "deployment-phase", "dependency", "approved");
  add("deployment-phase", "release-approval", "dependency");
  add("release-approval", "result", "dependency", "approved");
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Workflow",
    metadata: {
      name: "regulated-software-delivery-program",
      title: "Regulated software delivery, end to end",
      description: "Compose discovery, architecture, delivery, validation, security, and deployment as a 25-node regulated program.",
      version: "1.0.0",
    },
    spec: {
      objective: "Deliver regulated software with traceable phase evidence and non-skippable release authority.",
      policies: { maxConcurrency: 8, onFailure: "stop", requireApprovalFor: ["quality-approval", "release-approval"] },
      nodes,
      edges,
    },
  };
}

const compositeDefinitions = [
  ["wf-cross-01", "Software engineering", programWorkflow()],
  [
    "wf-cross-02",
    "Architecture & design",
    compositeWorkflow({
      name: "design-construction-handoff-clash-resolution",
      title: "Design → construction handoff with clash resolution",
      description:
        "Reconcile architecture, engineering, coordination, constructability, and cost evidence while surfacing model collisions.",
      roles: ["arch-01", "arch-02", "arch-04", "arch-05", "arch-11", "arch-16", "rec-03", "rec-04"],
      strategy: "merge",
    }),
  ],
  [
    "wf-cross-03",
    "Security",
    compositeWorkflow({
      name: "incident-customer-regulatory-notice",
      title: "Incident → customer notice → regulatory filing",
      description:
        "Coordinate incident facts, customer communication, compliance obligations, and notification deadlines in one authority chain.",
      roles: ["sec-05", "sec-20", "cs-03", "qac-01", "legal-03"],
      strategy: "collect",
    }),
  ],
  [
    "wf-cross-04",
    "Product management",
    compositeWorkflow({
      name: "launch-readiness-barrier-check",
      title: "Launch readiness barrier check",
      description: "Require engineering, reliability, marketing, quality, and security evidence before launch authorization.",
      roles: ["dev-09", "sre-04", "mkt-05", "qac-04", "sec-12"],
      strategy: "collect",
    }),
  ],
  [
    "wf-cross-05",
    "Supply chain & logistics",
    compositeWorkflow({
      name: "supplier-esg-emissions-due-diligence",
      title: "Supplier ESG & emissions due diligence",
      description: "Reconcile supplier, environmental, fashion, and quality evidence without hiding source conflicts.",
      roles: ["supply-04", "envr-01", "envr-06", "fash-02", "qac-03"],
      strategy: "merge",
    }),
  ],
  [
    "wf-cross-06",
    "Agriculture & food systems",
    compositeWorkflow({
      name: "product-recall-decision-public-notice",
      title: "Product recall decision & public notice",
      description: "Combine food safety, traceability, crisis communication, customer, and quality evidence for a recall decision.",
      roles: ["agri-04", "agri-05", "crisis-04", "cs-03", "qac-05"],
      strategy: "collect",
    }),
  ],
  [
    "wf-cross-07",
    "Airline flight operations",
    compositeWorkflow({
      name: "disruption-day-recovery",
      title: "Disruption day recovery",
      description: "Proceed with completed flight, crew, customer, crisis, and mobility recovery branches while listing failures.",
      roles: ["flt-06", "flt-01", "cs-03", "crisis-04", "mob-05"],
      strategy: "allSettled",
    }),
  ],
  [
    "wf-cross-08",
    "Oil & gas drilling & well operations",
    compositeWorkflow({
      name: "well-plan-independent-design-review",
      title: "Well plan independent design review",
      description: "Blindly reconcile planning, geomechanics, barriers, integrity, and methods evidence before drill-ahead authority.",
      roles: ["well-01", "well-03", "well-04", "well-05", "peer-03"],
      strategy: "vote",
    }),
  ],
  [
    "wf-cross-09",
    "Clinical & health sciences",
    compositeWorkflow({
      name: "clinical-note-coding-billing-audit",
      title: "Clinical note → coding → billing audit",
      description: "Reconcile clinical documentation, coding evidence, accounting controls, and billing records under qualified review.",
      roles: ["clin-06", "acct-01", "acct-04"],
      strategy: "merge",
    }),
  ],
  [
    "wf-cross-10",
    "Writing",
    compositeWorkflow({
      name: "long-form-nonfiction-verified-production",
      title: "Long-form nonfiction: research → argument → fact-check → line edit",
      description: "Assemble historical research, argument, verification, drafting, and editing into one claim-gated manuscript workflow.",
      roles: ["hist-01", "hist-04", "hist-05", "phil-03", "write-01", "write-02", "jour-01"],
      strategy: "concat",
    }),
  ],
  [
    "wf-cross-11",
    "Personal development",
    compositeWorkflow({
      name: "career-transition-plan",
      title: "Career transition plan",
      description: "Combine values, goals, behavior design, talent evidence, and labor-market constraints into a reviewed transition plan.",
      roles: ["goal-01", "goal-03", "goal-04", "hr-05", "hr-06"],
      strategy: "collect",
    }),
  ],
  [
    "wf-cross-12",
    "Manufacturing & industrial operations",
    compositeWorkflow({
      name: "inspection-video-defect-adjudication",
      title: "Inspection video + defect adjudication",
      description:
        "Blindly review inspection video, manufacturing evidence, quality criteria, and damage analogues before defect disposition.",
      modality: "video",
      roles: ["mfg-02", "mfg-04", "insr-01", "clin-01"],
      strategy: "vote",
    }),
  ],
];

const workflowDefinitions = [...areaWorkflows.map((def) => [def.id, def.area, shapedWorkflow(def)]), ...compositeDefinitions];

for (const [id, area, document] of workflowDefinitions) {
  const file = `workflows/${id}.yaml`;
  await writeFile(resolve(catalogRoot, file), stringify(document, { lineWidth: 110 }));
  if (!manifest.workflows.some((entry) => entry.id === id)) {
    manifest.workflows.push({
      id,
      path: `${area
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}/${id}`,
      area,
      title: document.metadata.title,
      eyebrow: id.startsWith("wf-cross") ? "Cross-area composite" : "Expansion roadmap",
      description: document.metadata.description,
      topology: document.spec.nodes.some((node) => node.kind === "subgraph") ? "Program composition" : "Governed specialist workflow",
      accent: id.startsWith("wf-edu")
        ? "#d6a84f"
        : id.startsWith("wf-fin")
          ? "#5ca989"
          : id.startsWith("wf-jour")
            ? "#8e79c6"
            : id.startsWith("wf-pub")
              ? "#668fd1"
              : id.startsWith("wf-gxp")
                ? "#4db5a8"
                : "#df8c68",
      file,
    });
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Roadmap expansion now contains ${manifest.workflows.length} workflows and ${manifest.agents.length} agents.`);
