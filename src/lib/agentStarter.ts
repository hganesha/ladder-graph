import { stringify } from "yaml";
import type { RoleTemplate, Workflow } from "../types";
import { inputContractSchema } from "./inputContracts";

export function createAgentStarterSource(template: RoleTemplate): string {
  const workflow: Workflow = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Workflow",
    metadata: {
      name: `${template.id}-workflow`,
      title: `${template.name} workflow`,
      description: `A starter workflow using the ${template.name} agent template.`,
      version: "1.0.0",
    },
    spec: {
      objective: `Complete the user's request with the ${template.name} agent.`,
      policies: { maxConcurrency: 1, onFailure: "stop", requireApprovalFor: [] },
      nodes: [
        {
          id: "input-1",
          kind: "input",
          name: "User input",
          summary: "The task, context, constraints, and requested output.",
          inputSchema: inputContractSchema("text"),
          position: { x: 180, y: 180 },
        },
        {
          id: "agent-1",
          kind: "agent",
          name: template.name,
          summary: template.role,
          role: template.role,
          prompt: template.prompt,
          capabilities: {
            skills: [...template.skills],
            tools: [...template.tools],
            connectors: [...(template.connectors ?? [])],
            permissions: [...(template.permissions ?? ["read-only"])],
            customizations: {},
          },
          outputSchema: { type: "object" },
          position: { x: 520, y: 180 },
        },
      ],
      edges: [{ id: "edge-input-agent", from: "input-1", to: "agent-1", kind: "data", contract: "UserRequest" }],
    },
  };

  return stringify(workflow, { indent: 2, lineWidth: 100 });
}
