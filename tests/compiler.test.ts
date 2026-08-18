import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { analyzeFallback, compileFallback, formatFallback } from "../src/compiler/fallback";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import type { Workflow } from "../src/types";

describe("LGIR fallback compiler", () => {
  const primitiveWorkflow: Workflow = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Workflow",
    metadata: { name: "feedback-aggregation" },
    spec: {
      objective: "Combine two candidate results and request teacher feedback.",
      nodes: [
        { id: "input", kind: "input", name: "Input" },
        { id: "draft-a", kind: "agent", name: "Draft A", role: "Writer", prompt: "Produce candidate A." },
        { id: "draft-b", kind: "agent", name: "Draft B", role: "Writer", prompt: "Produce candidate B." },
        { id: "combined", kind: "aggregator", name: "Combine", config: { aggregation: "collect" } },
        {
          id: "teacher",
          kind: "teacher",
          name: "Teacher feedback",
          role: "Teacher",
          prompt: "Identify strengths and specific improvements.",
          config: { teacherModel: "host:teacher", feedbackMode: "critique", workingDirectory: "packages/reviewer" },
        },
        { id: "output", kind: "output", name: "Output" },
      ],
      edges: [
        { id: "e1", from: "input", to: "draft-a", kind: "data" },
        { id: "e2", from: "input", to: "draft-b", kind: "data" },
        { id: "e3", from: "draft-a", to: "combined", kind: "data" },
        { id: "e4", from: "draft-b", to: "combined", kind: "data" },
        { id: "e5", from: "combined", to: "teacher", kind: "data" },
        { id: "e6", from: "teacher", to: "output", kind: "data" },
      ],
    },
  };

  it("analyzes every bundled workflow template", async () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const result = await analyzeFallback(template.yaml, "codex");
      expect(result.ok, `${template.id}: ${JSON.stringify(result.diagnostics)}`).toBe(true);
      expect(result.stats.nodes).toBeGreaterThanOrEqual(3);
      expect(result.nodeOrder).toHaveLength(result.stats.nodes);
    }
  });

  it("rejects unbounded loops with a safe repair", async () => {
    const source = WORKFLOW_TEMPLATES[0].yaml.replace("maxIterations: 3", "maxIterations: 0");
    const result = await analyzeFallback(source, "codex");
    const loopError = result.diagnostics.find((item) => item.code === "LG120");
    expect(result.ok).toBe(false);
    expect(loopError?.fix).toEqual(expect.objectContaining({ value: 3 }));
  });

  it("validates and compiles aggregators and teacher-model feedback", async () => {
    const source = stringify(primitiveWorkflow);
    const analysis = await analyzeFallback(source, "codex");
    const compiled = await compileFallback(source, "codex");

    expect(analysis.ok).toBe(true);
    expect(analysis.stats.agents).toBe(3);
    expect(compiled.content).toContain("ordered array of { source, value } entries");
    expect(compiled.content).toContain("teacher model reference `host:teacher` in `critique` mode");
    expect(compiled.content).toContain("**Working directory:** `packages/reviewer`");
    expect(compiled.capabilityReport.instructional).toEqual(
      expect.arrayContaining(["multi-output aggregation", "teacher-model feedback", "per-node working directories"]),
    );
  });

  it("validates and compiles node-attached form contracts", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.nodes[0].formRefs = ["ladder://forms/docubricks/manufacturing/quality_inspection_report"];
    const source = stringify(workflow);
    const compiled = await compileFallback(source, "codex");

    expect(compiled.ok).toBe(true);
    expect(compiled.content).toContain("**Attached forms:** `ladder://forms/docubricks/manufacturing/quality_inspection_report`");
    expect(compiled.capabilityReport.instructional).toContain("attached form contracts");

    workflow.spec.nodes[0].formRefs = ["ladder://forms/"];
    const invalid = await analyzeFallback(stringify(workflow));
    expect(invalid.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG196" })]));
  });

  it("validates and compiles unified form and document contracts", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.nodes[0].contractRefs = [
      { ref: "ladder://forms/docubricks/manufacturing/quality_inspection_report", usage: "human-interaction" },
      { ref: "ladder://documents/builtin/fs-income-statement", usage: "evidence" },
    ];
    const compiled = await compileFallback(stringify(workflow), "codex");

    expect(compiled.ok).toBe(true);
    expect(compiled.content).toContain(
      "**Attached contracts:** `ladder://forms/docubricks/manufacturing/quality_inspection_report` (human-interaction), `ladder://documents/builtin/fs-income-statement` (evidence)",
    );
    expect(compiled.capabilityReport.instructional).toContain("attached artifact contracts");

    workflow.spec.nodes[0].contractRefs = [{ ref: "ladder://documents/", usage: "evidence" }];
    const invalidRef = await analyzeFallback(stringify(workflow));
    expect(invalidRef.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG197" })]));

    workflow.spec.nodes[0].contractRefs = [
      { ref: "ladder://documents/builtin/fs-income-statement", usage: "evidence" },
      { ref: "ladder://documents/builtin/fs-income-statement", usage: "input" },
    ];
    const duplicate = await analyzeFallback(stringify(workflow));
    expect(duplicate.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG197" })]));
  });

  it("rejects invalid aggregator and teacher-model configuration", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    const aggregator = workflow.spec.nodes.find((node) => node.kind === "aggregator");
    const teacher = workflow.spec.nodes.find((node) => node.kind === "teacher");
    if (!aggregator || !teacher) throw new Error("Primitive fixtures are required.");
    aggregator.config = { aggregation: "" };
    teacher.config = { teacherModel: "", feedbackMode: "" };

    const result = await analyzeFallback(stringify(workflow));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LG116" }),
        expect.objectContaining({ code: "LG117" }),
        expect.objectContaining({ code: "LG118" }),
      ]),
    );
  });

  it("rejects arbitrary back edges", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[1].yaml) as Workflow;
    const lastNode = workflow.spec.nodes.at(-1);
    if (!lastNode) throw new Error("The cycle fixture requires at least one node.");
    workflow.spec.edges.push({
      id: "cycle",
      from: lastNode.id,
      to: workflow.spec.nodes[0].id,
      kind: "dependency",
    });
    const result = await analyzeFallback(stringify(workflow));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG150" })]));
  });

  it("schedules grouped members inside the group boundary before downstream work", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    const output = workflow.spec.nodes.find((node) => node.kind === "output");
    const members = workflow.spec.nodes.filter((node) => node.kind === "agent").slice(0, 2);
    if (!output || members.length < 2) throw new Error("The group fixture requires two agents and an output.");
    const group = {
      id: "implementation-group",
      kind: "group" as const,
      name: "Implementation group",
      config: { members: members.map((node) => node.id), execution: "parallel" as const, exit: "aggregate" as const },
    };
    workflow.spec.nodes.push(group);
    workflow.spec.edges = workflow.spec.edges.filter((edge) => !members.some((member) => edge.from === member.id || edge.to === member.id));
    workflow.spec.edges.push({ id: "group-exit", from: group.id, to: output.id, kind: "data" });

    const result = await analyzeFallback(stringify(workflow));
    expect(result.ok).toBe(true);
    expect(result.nodeOrder.indexOf(group.id)).toBeLessThan(result.nodeOrder.indexOf(members[0].id));
    expect(result.nodeOrder.indexOf(group.id)).toBeLessThan(result.nodeOrder.indexOf(members[1].id));
    expect(result.nodeOrder.indexOf(members[0].id)).toBeLessThan(result.nodeOrder.indexOf(output.id));
    expect(result.nodeOrder.indexOf(members[1].id)).toBeLessThan(result.nodeOrder.indexOf(output.id));
  });

  it("rejects a group that references a missing member", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    workflow.spec.nodes.push({
      id: "broken-group",
      kind: "group",
      name: "Broken group",
      config: { members: ["missing"], execution: "sequential", exit: "serialize" },
    });
    const result = await analyzeFallback(stringify(workflow));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG129" })]));
  });

  it("compiles deterministic, target-specific Markdown", async () => {
    const source = WORKFLOW_TEMPLATES[2].yaml;
    const [codexOne, codexTwo, claude] = await Promise.all([
      compileFallback(source, "codex"),
      compileFallback(source, "codex"),
      compileFallback(source, "claude"),
    ]);
    expect(codexOne.ok).toBe(true);
    expect(codexOne.content).toBe(codexTwo.content);
    expect(codexOne.sourceHash).toBe(codexTwo.sourceHash);
    expect(codexOne.suggestedFilename).toMatch(/\.codex\.md$/);
    expect(claude.suggestedFilename).toMatch(/\.claude\.md$/);
    expect(claude.content).not.toContain("ladder-source-hash");
    expect(claude.content).not.toContain("ladder-target");
  });

  it("compiles multimodal input contracts into target instructions", async () => {
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === "image-text-extraction");
    if (!template) throw new Error("The image extraction template is required.");

    const result = await compileFallback(template.yaml, "codex");

    expect(result.ok).toBe(true);
    expect(result.content).toContain("**Expected input contract**");
    expect(result.content).toContain('"contentMediaType": "image/*"');
    expect(result.content).toContain('"x-ladder-input-mode": "image"');
    expect(result.capabilityReport.instructional).toContain("multimodal input contracts");
  });

  it("compiles a Hermes Agent SKILL.md workflow with declarative connectors", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[2].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    if (!agent) throw new Error("The Hermes fixture requires an agent node.");
    agent.capabilities = {
      ...agent.capabilities,
      skills: ["hermes-agent", "research"],
      connectors: ["hermes:toolset:web", "mcp:github", "provider:openrouter"],
    };

    const first = await compileFallback(stringify(workflow), "hermes");
    const second = await compileFallback(stringify(workflow), "hermes");

    expect(first.ok).toBe(true);
    expect(first.content).toBe(second.content);
    expect(first.suggestedFilename).toMatch(/\.hermes\.md$/);
    expect(first.adapterVersion).toBe("hermes-skill-v1");
    expect(first.content).not.toContain("ladder-source-hash");
    expect(first.content).toContain("metadata:\n  hermes:");
    const frontmatter = parse(first.content.split("---")[1]) as { description: string };
    expect(frontmatter.description.length).toBeLessThanOrEqual(60);
    expect(frontmatter.description.endsWith(".")).toBe(true);
    expect(first.content).toContain("~/.hermes/skills/ladder-graph/");
    expect(first.content).toContain("hermes:toolset:web, mcp:github, provider:openrouter");
    expect(first.content).toContain("never place provider credentials in this skill");
    expect(first.capabilityReport.native).toContain("Hermes Agent SKILL.md metadata");
  });

  it("preserves declarative connectors in target output", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[2].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    if (!agent) throw new Error("The connector fixture requires an agent node.");
    agent.capabilities = { ...agent.capabilities, connectors: ["mcp:github", "custom:knowledge-base"] };
    const source = stringify(workflow);
    const result = await compileFallback(source, "codex");

    expect(result.content).toContain("**Required connectors:** mcp:github, custom:knowledge-base");
    expect(result.content).toContain(".agents/skills/");
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG201" })]));
    expect(result.capabilityReport.instructional).toContain("declared connector availability");
  });

  it("compiles deterministic Python and TypeScript data modules", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[2].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    if (!agent) throw new Error("The code target fixture requires an agent node.");
    agent.capabilities = {
      ...agent.capabilities,
      skills: ["research"],
      connectors: ["custom:evidence-store"],
      customizations: {
        research: { template: "research", instructions: "Require two independent primary sources." },
        "custom:evidence-store": {
          template: "custom-connector",
          instructions: "Read evidence snapshots through the host-provided adapter only.",
        },
      },
    };
    const source = stringify(workflow);
    const [pythonOne, pythonTwo, typescript] = await Promise.all([
      compileFallback(source, "python"),
      compileFallback(source, "python"),
      compileFallback(source, "typescript"),
    ]);

    expect(pythonOne.ok).toBe(true);
    expect(pythonOne.content).toBe(pythonTwo.content);
    expect(pythonOne.suggestedFilename).toMatch(/\.ladder\.py$/);
    expect(pythonOne.mimeType).toBe("text/x-python");
    expect(pythonOne.content).toContain("def ready_nodes");
    expect(pythonOne.content).toContain("custom:evidence-store");
    expect(typescript.suggestedFilename).toMatch(/\.ladder\.ts$/);
    expect(typescript.mimeType).toBe("text/typescript");
    expect(typescript.content).toContain("export function readyNodes");
    expect(typescript.content).toContain("Require two independent primary sources.");
    expect(typescript.capabilityReport.native).toContain("capability templates");
  });

  it("formats valid YAML and blocks aliases", async () => {
    const formatted = await formatFallback(WORKFLOW_TEMPLATES[0].yaml);
    const hostile = await analyzeFallback("a: &shared [1]\nb: *shared\n");
    expect(formatted.ok).toBe(true);
    expect(formatted.content).toContain("apiVersion: ladder.dev/v1alpha1");
    expect(hostile.diagnostics[0].code).toBe("LG004");
  });

  it("allows tag-like text while rejecting actual YAML tags", async () => {
    const emphatic = WORKFLOW_TEMPLATES[0].yaml.replace(/title: .*$/m, 'title: "Ship it!!"');
    const comment = `${WORKFLOW_TEMPLATES[0].yaml}\n# !!python is documentation\n`;
    const tagged = WORKFLOW_TEMPLATES[0].yaml.replace(/title: .*$/m, "title: !custom Example");

    expect((await analyzeFallback(emphatic)).diagnostics[0]?.code).not.toBe("LG002");
    expect((await analyzeFallback(comment)).diagnostics[0]?.code).not.toBe("LG002");
    expect((await analyzeFallback(tagged)).diagnostics[0]?.code).toBe("LG002");
  });

  it("blocks external schema references", async () => {
    const source = WORKFLOW_TEMPLATES[0].yaml.replace("type: object", "$ref: https://example.com/schema.json");
    const result = await analyzeFallback(source);
    expect(result.diagnostics[0].code).toBe("LG005");
  });

  it("enforces condition branch tokens while allowing an explicit unused default", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.nodes.splice(4, 0, {
      id: "route",
      kind: "condition",
      name: "Route",
      config: {
        expression: "review.status",
        router: "host:review-router",
        defaultBranch: "default",
        branches: [
          { label: "Pass", when: "pass" },
          { label: "Default", when: "default" },
        ],
      },
    });
    workflow.spec.edges = [
      ...workflow.spec.edges.filter((edge) => edge.to !== "teacher"),
      { id: "route-in", from: "combined", to: "route", kind: "data" },
      { id: "route-out", from: "route", to: "teacher", kind: "control", condition: "unknown" },
    ];

    const invalid = await analyzeFallback(stringify(workflow));
    expect(invalid.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG163", edgeId: "route-out" })]));

    workflow.spec.edges.at(-1)!.condition = "pass";
    const valid = await analyzeFallback(stringify(workflow));
    expect(valid.ok).toBe(true);
    expect(valid.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG164", severity: "warning" })]));
  });

  it("validates ordered loop boundaries and exhaustion routing", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.nodes.splice(4, 0, {
      id: "revise-loop",
      kind: "loop",
      name: "Revise",
      config: {
        body: ["draft-a", "draft-b"],
        entry: "missing",
        exitNode: "draft-b",
        exitCondition: "review.passed",
        maxIterations: 3,
        onExhausted: "warn",
      },
    });
    workflow.spec.edges.push({ id: "loop-exit", from: "revise-loop", to: "output", kind: "control", condition: "loop_exit" });

    const result = await analyzeFallback(stringify(workflow));
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "LG171" }), expect.objectContaining({ code: "LG175" })]),
    );
  });

  it("validates and compiles explicit loop carry state", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.nodes.push({
      id: "debate-loop",
      kind: "loop",
      name: "Debate rounds",
      config: {
        body: ["draft-a", "draft-b"],
        entry: "draft-a",
        exitNode: "draft-b",
        exitCondition: "moderator.consensusReached",
        maxIterations: 3,
        onExhausted: "stop",
        carry: { moderator: "/results/teacher", positions: "/results/combined" },
      },
    });
    workflow.spec.edges.push({ id: "debate-exit", from: "debate-loop", to: "output", kind: "control", condition: "loop_exit" });

    const source = stringify(workflow);
    const valid = await analyzeFallback(source);
    const compiled = await compileFallback(source, "codex");
    expect(valid.ok).toBe(true);
    expect(compiled.content).toContain("`moderator` from `/results/teacher`");
    expect(compiled.content).toContain("`/loopState/debate-loop/<slot>`");

    const loop = workflow.spec.nodes.find((node) => node.id === "debate-loop");
    if (!loop?.config) throw new Error("The loop carry fixture is required.");
    loop.config.carry = { "bad slot": "not-a-pointer" };
    workflow.spec.nodes[1].config = { carry: { review: "/results/teacher" } };
    const invalid = await analyzeFallback(stringify(workflow));
    expect(invalid.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LG177" }),
        expect.objectContaining({ code: "LG178" }),
        expect.objectContaining({ code: "LG179" }),
      ]),
    );
  });

  it("validates join cardinality and deterministic data mappings", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.edges = workflow.spec.edges.filter((edge) => edge.id !== "e4");
    const first = workflow.spec.edges.find((edge) => edge.id === "e3");
    if (!first) throw new Error("The mapping fixture requires e3.");
    first.sourcePath = "/answer";
    first.targetPath = "/candidates/primary";
    workflow.spec.edges.push({
      id: "collision",
      from: "draft-b",
      to: "combined",
      kind: "data",
      sourcePath: "/answer",
      targetPath: "/candidates/primary",
    });
    const join = workflow.spec.nodes.find((node) => node.id === "combined");
    if (!join) throw new Error("The mapping fixture requires combined.");
    join.kind = "join";
    join.config = { join: "all" };

    const collision = await analyzeFallback(stringify(workflow));
    expect(collision.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG187" })]));

    workflow.spec.edges.pop();
    const undersupplied = await analyzeFallback(stringify(workflow));
    expect(undersupplied.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG180" })]));
  });

  it("requires executable subgraph references and state maps when config is present", async () => {
    const workflow = structuredClone(primitiveWorkflow);
    workflow.spec.nodes[1] = {
      id: "draft-a",
      kind: "subgraph",
      name: "Research pass",
      config: {
        subgraph: {
          ref: "ladder://workflows/research-pass",
          inputMap: { request: "/inputs/request" },
          outputMap: { result: "/results/research" },
          checkpointer: "inherit",
        },
      },
    };

    const valid = await analyzeFallback(stringify(workflow));
    expect(valid.diagnostics.some((item) => item.code.startsWith("LG19") && item.severity === "error")).toBe(false);

    workflow.spec.nodes[1].config!.subgraph!.ref = "https://example.com/graph";
    workflow.spec.nodes[1].config!.subgraph!.inputMap = {};
    const invalid = await analyzeFallback(stringify(workflow));
    expect(invalid.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "LG191" }), expect.objectContaining({ code: "LG192" })]),
    );
  });
});
