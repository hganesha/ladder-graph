import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { Inspector } from "../src/components/Inspector";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import { useStudioStore } from "../src/store/useStudioStore";
import type { AnalysisResult, Workflow } from "../src/types";

describe("input contract inspector", () => {
  afterEach(cleanup);

  it("shows and applies media input presets", () => {
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === "image-text-extraction");
    if (!template) throw new Error("The image extraction template is required.");
    const workflow = parse(template.yaml) as Workflow;
    const input = workflow.spec.nodes.find((node) => node.kind === "input");
    if (!input) throw new Error("The image extraction input is required.");
    const patchNode = vi.fn(async () => undefined);
    const analysis: AnalysisResult = {
      ok: true,
      sourceHash: "test",
      diagnostics: [],
      normalized: workflow,
      nodeOrder: workflow.spec.nodes.map((node) => node.id),
      stats: { nodes: workflow.spec.nodes.length, edges: workflow.spec.edges.length, agents: 2, loops: 0, maxParallelism: 1 },
    };
    useStudioStore.setState({ analysis, selectedNodeId: input.id, inspectorTab: "contracts", patchNode });

    render(<Inspector />);

    const selector = screen.getByRole("combobox");
    expect(selector).toHaveValue("image");
    expect(screen.getByDisplayValue(/"contentMediaType": "image\/\*"/)).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: "audio" } });
    expect(patchNode).toHaveBeenCalledWith(
      input.id,
      expect.objectContaining({ inputSchema: expect.objectContaining({ "x-ladder-input-mode": "audio" }) }),
    );
  });
});
