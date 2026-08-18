import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { analyzeFallback } from "../src/compiler/fallback";
import { createAgentStarterSource } from "../src/lib/agentStarter";
import { ROLE_TEMPLATES, roleTemplatesForSubject } from "../src/lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import { userAgentTemplate } from "../src/lib/userCatalogAssets";
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

  it("converts a saved user agent template into a fresh workflow", () => {
    const template = userAgentTemplate({
      id: "my-reviewer",
      kind: "agent-template",
      path: "research/legal/custom",
      title: "My reviewer",
      yaml: `apiVersion: ladder.dev/v1alpha1
kind: AgentTemplate
metadata:
  name: my-reviewer
  title: My reviewer
spec:
  path: research/legal/custom
  areas: [Legal & contracts]
  modalities: [document]
  role: Reviews agreements against a personal checklist.
  prompt: Review the agreement and return evidenced findings.
  capabilities:
    skills: [contract-review]
    tools: [read]`,
      createdAt: 1,
      updatedAt: 2,
    });
    expect(template).toBeDefined();

    const workflow = parse(createAgentStarterSource(template!)) as Workflow;
    expect(workflow.kind).toBe("Workflow");
    expect(workflow.spec.nodes[1]).toMatchObject({ name: "My reviewer", role: "Reviews agreements against a personal checklist." });
  });
});
