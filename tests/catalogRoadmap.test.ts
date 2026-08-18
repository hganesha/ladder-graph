import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import type { Workflow } from "../src/types";

const expectedAreas = new Map([
  ["Education & assessment", { agents: 6, workflows: 10 }],
  ["Finance & risk", { agents: 7, workflows: 9 }],
  ["Journalism & verification", { agents: 4, workflows: 3 }],
  ["Public sector procurement & grants", { agents: 6, workflows: 2 }],
  ["Life sciences & GxP operations", { agents: 8, workflows: 2 }],
]);

describe("completed catalog roadmap", () => {
  it("ships every remaining area and cross-area composite", () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(212);
    expect(ROLE_TEMPLATES).toHaveLength(389);
    for (const [area, expected] of expectedAreas) {
      expect(
        WORKFLOW_TEMPLATES.filter((workflow) => workflow.area === area),
        area,
      ).toHaveLength(expected.workflows);
      expect(
        ROLE_TEMPLATES.filter((agent) => agent.areas.includes(area)),
        area,
      ).toHaveLength(expected.agents);
    }
    expect(WORKFLOW_TEMPLATES.filter((workflow) => workflow.id.startsWith("wf-cross-"))).toHaveLength(12);
    expect(WORKFLOW_TEMPLATES.filter((workflow) => /^wf-clin-0[4-8]$/.test(workflow.id)).map((workflow) => workflow.id)).toEqual([
      "wf-clin-04",
      "wf-clin-05",
      "wf-clin-06",
      "wf-clin-07",
      "wf-clin-08",
    ]);
    expect(ROLE_TEMPLATES.filter((agent) => /^clin-(09|1[0-6])$|^stat-0[12]$/.test(agent.id))).toHaveLength(10);
  });

  it("demonstrates real program composition and classifies every role node", () => {
    const workflows = WORKFLOW_TEMPLATES.map((template) => parse(template.yaml) as Workflow);
    const program = workflows.find((workflow) => workflow.metadata.name === "regulated-software-delivery-program");
    expect(program?.spec.nodes.length).toBeGreaterThanOrEqual(25);
    expect(program?.spec.nodes.filter((node) => node.kind === "subgraph")).toHaveLength(5);

    const roleNodes = workflows
      .flatMap((workflow) => workflow.spec.nodes)
      .filter((node) => ["agent", "evaluate", "teacher"].includes(node.kind));
    expect(roleNodes.every((node) => Boolean(node.templateRef) !== Boolean(node.inlineRole))).toBe(true);
    expect(ROLE_TEMPLATES.filter((agent) => agent.usage === "palette-only")).toHaveLength(114);
  });

  it("keeps the governed skill vocabulary below the roadmap ceiling", () => {
    const workflowSkills = WORKFLOW_TEMPLATES.flatMap((template) => {
      const workflow = parse(template.yaml) as Workflow;
      return workflow.spec.nodes.flatMap((node) => node.capabilities?.skills ?? []);
    });
    const skills = new Set([...workflowSkills, ...ROLE_TEMPLATES.flatMap((agent) => agent.skills)]);
    expect(skills.size).toBe(83);
    expect(skills.size).toBeLessThanOrEqual(150);
    expect(WORKFLOW_TEMPLATES.some((workflow) => workflow.modalities.includes("video"))).toBe(true);
  });
});
