import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { analyzeFallback } from "../src/compiler/fallback";
import { createAgentStarterSource } from "../src/lib/agentStarter";
import { ROLE_TEMPLATES, roleTemplatesForSubject } from "../src/lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import type { Workflow } from "../src/types";

describe("agent starter workflows", () => {
  it("creates a valid input-to-agent workflow from the selected template", async () => {
    const template = ROLE_TEMPLATES.find((candidate) => candidate.id === "dev-04");
    expect(template).toBeDefined();

    const workflow = parse(createAgentStarterSource(template!)) as Workflow;
    expect(workflow.spec.nodes).toHaveLength(2);
    expect(workflow.spec.nodes.map((node) => node.kind)).toEqual(["input", "agent"]);
    expect(workflow.spec.nodes[1]).toMatchObject({
      id: "agent-1",
      name: template?.name,
      role: template?.role,
      prompt: template?.prompt,
    });
    expect(workflow.spec.edges).toEqual([
      { id: "edge-input-agent", from: "input-1", to: "agent-1", kind: "data", contract: "UserRequest" },
    ]);

    const analysis = await analyzeFallback(createAgentStarterSource(template!));
    expect(analysis.ok).toBe(true);
    expect(analysis.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LG131", severity: "warning", message: expect.stringContaining("implicit output") }),
      ]),
    );
  });

  it("offers at least one agent in every subject area", () => {
    const areas = new Set(WORKFLOW_TEMPLATES.map((template) => template.area));
    for (const area of areas) {
      expect(roleTemplatesForSubject(area).length, area).toBeGreaterThan(0);
    }
  });
});
