import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { analyzeWasm as analyzeFallback } from "./wasmCompiler";
import { ROLE_TEMPLATES, SUBJECT_AREAS, WORKFLOW_TEMPLATES } from "../src/generated/catalogTestFixtures";
import type { Workflow } from "../src/types";

const AREA = "Office productivity";
const workflows = WORKFLOW_TEMPLATES.filter((workflow) => workflow.area === AREA);
const agents = ROLE_TEMPLATES.filter((agent) => agent.areas.includes(AREA));

describe("office productivity catalog", () => {
  it("ships the subject, four harnesses, and eight associated agents", () => {
    expect(SUBJECT_AREAS.find((subject) => subject.name === AREA)?.agentPathPrefixes).toEqual(["office/productivity/"]);
    expect(workflows.map((workflow) => workflow.id)).toEqual(["wf-office-01", "wf-office-02", "wf-office-03", "wf-office-04"]);
    expect(agents.map((agent) => agent.id)).toEqual([
      "offc-01",
      "offc-02",
      "offc-03",
      "offc-04",
      "offc-05",
      "offc-06",
      "offc-07",
      "offc-08",
    ]);
  });

  it("keeps source collection read-only and gates every external write", () => {
    const documents = workflows.map((workflow) => parse(workflow.yaml) as Workflow);
    const writeNodes = documents.flatMap((workflow) =>
      workflow.spec.nodes.filter((node) => node.capabilities?.permissions?.includes("external-write")).map((node) => ({ workflow, node })),
    );

    expect(writeNodes).toHaveLength(2);
    for (const { workflow, node } of writeNodes) {
      const incoming = workflow.spec.edges.filter((edge) => edge.to === node.id);
      expect(incoming).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from: expect.stringMatching(/approval$/),
            kind: "control",
            condition: "approved",
          }),
        ]),
      );
    }
  });

  it("declares portable Codex and Claude capability adapters", () => {
    const customizations = workflows.flatMap((template) => {
      const workflow = parse(template.yaml) as Workflow;
      return workflow.spec.nodes.flatMap((node) => Object.values(node.capabilities?.customizations ?? {}));
    });
    const instructions = customizations.map((customization) => customization.instructions).join(" ");

    expect(instructions).toContain("Codex");
    expect(instructions).toContain("Claude");
  });

  it("passes the workflow graph analyzer", async () => {
    const analyses = await Promise.all(workflows.map((workflow) => analyzeFallback(workflow.yaml)));

    expect(analyses.map((analysis) => analysis.diagnostics)).toEqual([[], [], [], []]);
  });
});
