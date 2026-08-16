import { describe, expect, it } from "vitest";
import { deleteWorkflowElements } from "../src/lib/workflowEditing";
import type { Workflow } from "../src/types";

const workflow: Workflow = {
  apiVersion: "ladder.dev/v1alpha1",
  kind: "Workflow",
  metadata: { name: "delete-elements" },
  spec: {
    objective: "Exercise visual deletion.",
    nodes: [
      { id: "a", kind: "agent", name: "A" },
      { id: "b", kind: "agent", name: "B" },
      { id: "group", kind: "group", name: "Group", config: { members: ["a", "b"] } },
      { id: "loop", kind: "loop", name: "Loop", config: { body: ["a", "b"] } },
      { id: "output", kind: "output", name: "Output" },
    ],
    edges: [
      { id: "a-b", from: "a", to: "b", kind: "data" },
      { id: "b-output", from: "b", to: "output", kind: "data" },
      { id: "a-output", from: "a", to: "output", kind: "data" },
    ],
  },
};

describe("workflow element deletion", () => {
  it("deletes a node, its incident edges, and structural references", () => {
    const next = deleteWorkflowElements(workflow, ["b"], []);

    expect(next.spec.nodes.map((node) => node.id)).not.toContain("b");
    expect(next.spec.edges.map((edge) => edge.id)).toEqual(["a-output"]);
    expect(next.spec.nodes.find((node) => node.id === "group")?.config?.members).toEqual(["a"]);
    expect(next.spec.nodes.find((node) => node.id === "loop")?.config?.body).toEqual(["a"]);
    expect(workflow.spec.nodes.find((node) => node.id === "group")?.config?.members).toEqual(["a", "b"]);
  });

  it("deletes a selected edge without changing its endpoint nodes", () => {
    const next = deleteWorkflowElements(workflow, [], ["a-output"]);

    expect(next.spec.nodes).toHaveLength(workflow.spec.nodes.length);
    expect(next.spec.edges.map((edge) => edge.id)).toEqual(["a-b", "b-output"]);
  });
});
