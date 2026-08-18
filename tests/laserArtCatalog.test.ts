import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import type { Workflow } from "../src/types";

describe("laser art catalog", () => {
  it("ships an image-and-prompt workflow with three parallel preparation branches", () => {
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === "laser-art-production");
    expect(template?.modalities).toEqual(["image"]);

    const workflow = parse(template?.yaml ?? "") as Workflow;
    const source = workflow.spec.nodes.find((node) => node.id === "source");
    expect(source?.inputSchema?.["x-ladder-input-mode"]).toBe("image");
    expect(source?.inputSchema?.required).toEqual(["asset", "instructions"]);

    const fanOut = workflow.spec.edges.filter((edge) => edge.from === "generate-master").map((edge) => edge.to);
    expect(fanOut).toEqual(["grayscale-dither", "palette-quantize", "vectorize", "output"]);
    expect(workflow.spec.policies?.maxConcurrency).toBe(3);
    expect(workflow.spec.nodes.find((node) => node.id === "variants")?.config?.aggregation).toBe("collect");
  });

  it("binds every multimodal stage to its associated laser-art agent", () => {
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === "laser-art-production");
    const workflow = parse(template?.yaml ?? "") as Workflow;
    const roleRefs = workflow.spec.nodes.flatMap((node) => (node.templateRef ? [node.templateRef] : []));

    expect(roleRefs).toEqual(["laser-01", "laser-02", "laser-03", "laser-04"]);
    expect(ROLE_TEMPLATES.filter((agent) => agent.id.startsWith("laser-")).map((agent) => agent.id)).toEqual(roleRefs);
    expect(ROLE_TEMPLATES.filter((agent) => roleRefs.includes(agent.id)).every((agent) => agent.modalities.includes("image"))).toBe(true);
  });
});
