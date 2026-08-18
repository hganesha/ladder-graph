import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OntologyCanvas } from "../src/components/artifacts/OntologyCanvas";
import { addOntologyType, createBlankOntology } from "../src/lib/ontologyEditor";

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
      nodesConnectable,
      nodesDraggable,
      onConnect,
    }: {
      children: ReactNode;
      nodesConnectable: boolean;
      nodesDraggable: boolean;
      onConnect?: (connection: { source: string; sourceHandle: null; target: string; targetHandle: null }) => void;
    }) => (
      <div data-connectable={String(nodesConnectable)} data-draggable={String(nodesDraggable)}>
        <button
          disabled={!nodesConnectable}
          onClick={() => onConnect?.({ source: "entity", sourceHandle: null, target: "entity-2", targetHandle: null })}
          type="button"
        >
          Connect entity to entity-2
        </button>
        {children}
      </div>
    ),
    useNodesState: (initialNodes: unknown[]) => {
      const [nodes, setNodes] = React.useState(initialNodes);
      return [nodes, setNodes, vi.fn()];
    },
  };
});

describe("ontology canvas", () => {
  it("enables dragging and sends handle connections to the ontology editor", () => {
    const ontology = addOntologyType(createBlankOntology()).ontology;
    const onConnectTypes = vi.fn();

    render(
      <OntologyCanvas
        ontology={ontology}
        onConnectTypes={onConnectTypes}
        onSelectRelationship={() => undefined}
        onSelectType={() => undefined}
        query=""
        selectedRelationshipId={null}
        selectedTypeId="entity"
      />,
    );

    const connectButton = screen.getByRole("button", { name: "Connect entity to entity-2" });
    expect(connectButton.parentElement).toHaveAttribute("data-connectable", "true");
    expect(connectButton.parentElement).toHaveAttribute("data-draggable", "true");
    fireEvent.click(connectButton);

    expect(onConnectTypes).toHaveBeenCalledWith("entity", "entity-2");
    expect(screen.getByText(/connect handles to create relationships/i)).toBeInTheDocument();
  });
});
