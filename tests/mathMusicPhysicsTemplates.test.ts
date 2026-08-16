import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { MATH_MUSIC_PHYSICS_ROLES, MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES } from "../src/lib/mathMusicPhysicsTemplates";
import type { Workflow } from "../src/types";

describe("mathematics, music, and physics research templates", () => {
  it("imports every agent with unique IDs and the expected domain counts", () => {
    expect(MATH_MUSIC_PHYSICS_ROLES).toHaveLength(26);
    expect(new Set(MATH_MUSIC_PHYSICS_ROLES.map((role) => role.id)).size).toBe(26);
    expect(MATH_MUSIC_PHYSICS_ROLES.filter((role) => role.path.startsWith("research/mathematics/"))).toHaveLength(8);
    expect(MATH_MUSIC_PHYSICS_ROLES.filter((role) => role.path.startsWith("research/music/"))).toHaveLength(10);
    expect(MATH_MUSIC_PHYSICS_ROLES.filter((role) => role.path.startsWith("research/physics/"))).toHaveLength(8);
  });

  it("imports all eight workflows as acyclic LGIR with explicit outputs", () => {
    expect(MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES).toHaveLength(8);
    expect(MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES.filter((template) => template.area === "Mathematics")).toHaveLength(3);
    expect(MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES.filter((template) => template.area === "Music")).toHaveLength(3);
    expect(MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES.filter((template) => template.area === "Physics")).toHaveLength(2);

    for (const template of MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES) {
      const workflow = parse(template.yaml) as Workflow;
      expect(
        workflow.spec.nodes.some((node) => node.kind === "output"),
        template.id,
      ).toBe(true);
      expect(
        workflow.spec.nodes.every((node) => (node.kind as string) !== "decision"),
        template.id,
      ).toBe(true);
      expect(new Set(workflow.spec.edges.map((edge) => edge.id)).size, template.id).toBe(workflow.spec.edges.length);
    }
  });

  it("declares the audio-analysis workflow with a multimodal audio input contract", () => {
    const template = MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES.find((candidate) => candidate.id === "wf-music-01");
    if (!template) throw new Error("The audio analysis workflow is required.");
    const workflow = parse(template.yaml) as Workflow;
    const input = workflow.spec.nodes.find((node) => node.kind === "input");

    expect(input?.inputSchema?.["x-ladder-input-mode"]).toBe("audio");
  });
});
