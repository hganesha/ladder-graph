import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { BLANK_WORKFLOW } from "../src/lib/templates";
import { createStudioStore } from "../src/store/useStudioStore";
import type { Workflow } from "../src/types";

function editingStore(source: string) {
  const store = createStudioStore({ initialSource: source, persist: false });
  store.setState({
    setSource: async (nextSource) => {
      store.setState({ source: nextSource });
    },
  });
  return store;
}

describe("surgical YAML editing", () => {
  it("retains node comments while changing layout and adding nodes", async () => {
    const source = BLANK_WORKFLOW.replace("    - id: input-1", "    # Keep this author note\n    - id: input-1");
    const store = editingStore(source);

    await store.getState().updatePositions({ "input-1": { x: 240, y: 260 } });
    await store.getState().addNode("agent");

    expect(store.getState().source).toContain("# Keep this author note");
    const workflow = parse(store.getState().source) as Workflow;
    expect(workflow.spec.nodes.find((node) => node.id === "input-1")?.position).toEqual({ x: 240, y: 260 });
    expect(workflow.spec.nodes).toHaveLength(3);
  });

  it("creates stable monotonic edge IDs without timestamps or randomness", async () => {
    const store = editingStore(BLANK_WORKFLOW);

    await store.getState().connect({ from: "input-1", to: "output-1", kind: "data" });
    await store.getState().connect({ from: "input-1", to: "output-1", kind: "control" });

    const workflow = parse(store.getState().source) as Workflow;
    expect(workflow.spec.edges.map((edge) => edge.id)).toEqual(["edge-1", "edge-input-1-output-1", "edge-input-1-output-1-2"]);
  });
});
