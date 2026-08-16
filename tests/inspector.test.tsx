import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { Inspector } from "../src/components/Inspector";
import { defaultNode } from "../src/lib/nodeMeta";
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

  it("edits teacher-model feedback configuration", () => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    const teacher = defaultNode("teacher", workflow.spec.nodes.length + 1);
    workflow.spec.nodes.push(teacher);
    const patchNode = vi.fn(async () => undefined);
    const analysis: AnalysisResult = {
      ok: true,
      sourceHash: "test",
      diagnostics: [],
      normalized: workflow,
      nodeOrder: workflow.spec.nodes.map((node) => node.id),
      stats: { nodes: workflow.spec.nodes.length, edges: workflow.spec.edges.length, agents: 3, loops: 1, maxParallelism: 1 },
    };
    useStudioStore.setState({ analysis, selectedNodeId: teacher.id, inspectorTab: "basics", patchNode });

    render(<Inspector />);

    const workingFolder = screen.getByLabelText("Working folder");
    expect(workingFolder).toHaveValue("");
    fireEvent.change(workingFolder, { target: { value: " packages/reviewer " } });
    fireEvent.blur(workingFolder);
    expect(patchNode).toHaveBeenCalledWith(
      teacher.id,
      expect.objectContaining({ config: expect.objectContaining({ workingDirectory: "packages/reviewer" }) }),
    );

    const model = screen.getByLabelText("Teacher model reference");
    fireEvent.change(model, { target: { value: "host:reviewer-v2" } });
    fireEvent.blur(model);
    expect(patchNode).toHaveBeenCalledWith(
      teacher.id,
      expect.objectContaining({ config: expect.objectContaining({ teacherModel: "host:reviewer-v2" }) }),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    fireEvent.change(screen.getByLabelText("Feedback mode"), { target: { value: "rubric" } });
    expect(patchNode).toHaveBeenCalledWith(
      teacher.id,
      expect.objectContaining({ config: expect.objectContaining({ feedbackMode: "rubric" }) }),
    );
  });

  it("only offers a working folder for host-executed nodes", () => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    const transform = defaultNode("transform", workflow.spec.nodes.length + 1);
    workflow.spec.nodes.push(transform);
    const analysis: AnalysisResult = {
      ok: true,
      sourceHash: "test",
      diagnostics: [],
      normalized: workflow,
      nodeOrder: workflow.spec.nodes.map((node) => node.id),
      stats: { nodes: workflow.spec.nodes.length, edges: workflow.spec.edges.length, agents: 2, loops: 1, maxParallelism: 1 },
    };
    useStudioStore.setState({ analysis, selectedNodeId: transform.id, inspectorTab: "basics", patchNode: vi.fn(async () => undefined) });

    render(<Inspector />);

    expect(screen.queryByLabelText("Working folder")).not.toBeInTheDocument();
  });
});
