import { fireEvent, render, screen } from "@testing-library/react";
import { type ComponentType, createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OntologyCanvas } from "../src/components/artifacts/OntologyCanvas";
import { type TaskFlowData, TaskNode } from "../src/components/TaskNode";
import { createBlankOntology } from "../src/lib/ontologyEditor";

vi.mock("@xyflow/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: "arrowclosed" },
    MiniMap: () => null,
    Position: { Left: "left", Right: "right" },
    ReactFlow: ({
      children,
      nodes,
      nodeTypes,
    }: {
      children: ReactNode;
      nodes: Array<{ id: string; type: string; data: unknown; selected?: boolean }>;
      nodeTypes: Record<string, ComponentType<Record<string, unknown>>>;
    }) => (
      <div>
        {nodes.map((node) =>
          createElement(nodeTypes[node.type], {
            data: node.data,
            id: node.id,
            key: node.id,
            selected: node.selected,
          }),
        )}
        {children}
      </div>
    ),
    useNodesState: (initialNodes: unknown[]) => {
      const [nodes, setNodes] = React.useState(initialNodes);
      return [nodes, setNodes, vi.fn()];
    },
  };
});

describe("workflow node in-place editing", () => {
  it("commits a renamed node with Enter and details with Command+Enter", () => {
    const onInlineEdit = vi.fn();
    const EditableTaskNode = TaskNode as unknown as ComponentType<{ data: TaskFlowData; selected: boolean }>;
    render(
      <EditableTaskNode
        data={{
          id: "draft",
          kind: "agent",
          name: "Draft response",
          summary: "Create the first draft.",
          onInlineEdit,
        }}
        selected
      />,
    );

    fireEvent.doubleClick(screen.getByText("Draft response"));
    let nameInput = screen.getByRole("textbox", { name: "Edit node name" });
    fireEvent.change(nameInput, { target: { value: "Discarded rename" } });
    fireEvent.keyDown(nameInput, { key: "Escape" });
    expect(onInlineEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Draft response"));
    nameInput = screen.getByRole("textbox", { name: "Edit node name" });
    fireEvent.change(nameInput, { target: { value: "Draft answer" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });
    expect(onInlineEdit).toHaveBeenCalledWith("draft", { name: "Draft answer" });

    fireEvent.doubleClick(screen.getByText("Create the first draft."));
    const detailsInput = screen.getByRole("textbox", { name: "Edit node details" });
    fireEvent.change(detailsInput, { target: { value: "Create a grounded first draft." } });
    fireEvent.keyDown(detailsInput, { key: "Enter", metaKey: true });
    expect(onInlineEdit).toHaveBeenCalledWith("draft", { summary: "Create a grounded first draft." });
  });
});

describe("ontology node in-place editing", () => {
  it("commits entity label and description without changing its stable ID", () => {
    const onUpdateType = vi.fn();
    render(
      <OntologyCanvas
        ontology={createBlankOntology()}
        onSelectRelationship={() => undefined}
        onSelectType={() => undefined}
        onUpdateType={onUpdateType}
        query=""
        selectedRelationshipId={null}
        selectedTypeId="entity"
      />,
    );

    fireEvent.doubleClick(screen.getByText("Entity"));
    const labelInput = screen.getByRole("textbox", { name: "Edit entity name" });
    fireEvent.change(labelInput, { target: { value: "Claim" } });
    fireEvent.keyDown(labelInput, { key: "Enter" });
    expect(onUpdateType).toHaveBeenCalledWith("entity", { label: "Claim" });

    fireEvent.doubleClick(screen.getByText("Replace this starter type with the first governed concept."));
    const detailsInput = screen.getByRole("textbox", { name: "Edit entity details" });
    fireEvent.change(detailsInput, { target: { value: "A governed insurance claim." } });
    fireEvent.keyDown(detailsInput, { key: "Enter", ctrlKey: true });
    expect(onUpdateType).toHaveBeenCalledWith("entity", { description: "A governed insurance claim." });
  });
});
