import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { StudioHeader } from "../src/components/StudioHeader";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalogTestFixtures";
import { useStudioStore } from "../src/store/useStudioStore";
import type { AnalysisResult, Workflow } from "../src/types";

describe("studio export menu", () => {
  afterEach(cleanup);

  beforeEach(() => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    const analysis: AnalysisResult = {
      ok: true,
      sourceHash: "test",
      diagnostics: [],
      normalized: workflow,
      nodeOrder: workflow.spec.nodes.map((node) => node.id),
      stats: { nodes: workflow.spec.nodes.length, edges: workflow.spec.edges.length, agents: 2, loops: 1, maxParallelism: 1 },
    };
    useStudioStore.setState({ analysis, source: WORKFLOW_TEMPLATES[0].yaml });
  });

  it("offers YAML, PNG, and SVG from the existing download control", () => {
    const onExportImage = vi.fn(async () => undefined);
    render(
      <StudioHeader canExportImage mcpPaired={false} onExportImage={onExportImage} onHelp={() => undefined} onStorage={() => undefined} />,
    );

    fireEvent.click(screen.getAllByLabelText("Download workflow")[0]);
    const menu = screen.getAllByRole("menu", { name: "Download format" })[0];
    expect(within(menu).getByRole("menuitem", { name: /YAML source/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /PNG image/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /SVG image/i })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitem", { name: /PNG image/i }));
    expect(onExportImage).toHaveBeenCalledWith("png");
  });

  it("explains that image export requires a visible canvas", () => {
    render(
      <StudioHeader
        canExportImage={false}
        mcpPaired={false}
        onExportImage={vi.fn(async () => undefined)}
        onHelp={() => undefined}
        onStorage={() => undefined}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Download workflow")[0]);
    const menu = screen.getAllByRole("menu", { name: "Download format" })[0];
    expect(within(menu).getByRole("menuitem", { name: /PNG image/i })).toBeDisabled();
    expect(within(menu).getByText(/Switch to Canvas or Split view/i)).toBeInTheDocument();
  });
});
