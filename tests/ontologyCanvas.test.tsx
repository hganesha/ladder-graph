import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OntologyCanvas } from "../src/components/artifacts/OntologyCanvas";
import { addOntologyRelationship, addOntologyType, createBlankOntology } from "../src/lib/ontologyEditor";

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
      edges,
      nodes,
      nodesConnectable,
      nodesDraggable,
      onConnect,
    }: {
      children: ReactNode;
      edges: { type?: string }[];
      nodes: { type?: string }[];
      nodesConnectable: boolean;
      nodesDraggable: boolean;
      onConnect?: (connection: { source: string; sourceHandle: null; target: string; targetHandle: null }) => void;
    }) => (
      <div
        data-connectable={String(nodesConnectable)}
        data-draggable={String(nodesDraggable)}
        data-edge-types={edges.map((edge) => edge.type).join(",")}
        data-node-types={nodes.map((node) => node.type).join(",")}
        data-testid="flow"
      >
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
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

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

  it("switches between orthogonal cards and isometric tiles and remembers the choice", () => {
    const withType = addOntologyType(createBlankOntology()).ontology;
    const ontology = addOntologyRelationship(withType, "entity").ontology;
    const props = {
      onSelectRelationship: () => undefined,
      onSelectType: () => undefined,
      query: "",
      selectedRelationshipId: null,
      selectedTypeId: null,
    };
    const { unmount } = render(<OntologyCanvas ontology={ontology} {...props} />);

    const flow = screen.getByTestId("flow");
    expect(screen.getByRole("button", { name: /orthogonal/i })).toHaveAttribute("aria-pressed", "true");
    expect(flow).toHaveAttribute("data-node-types", "ontologyType,ontologyType");
    expect(flow).toHaveAttribute("data-edge-types", "smoothstep");

    fireEvent.click(screen.getByRole("button", { name: /isometric/i }));
    expect(flow).toHaveAttribute("data-node-types", "ontologyIsoType,ontologyIsoType");
    expect(flow).toHaveAttribute("data-edge-types", "iso");
    expect(window.localStorage.getItem("ladder-graph-ontology-projection")).toBe("isometric");
    expect(window.localStorage.getItem("ladder-graph-canvas-projection")).toBeNull();

    unmount();
    render(<OntologyCanvas ontology={ontology} {...props} />);
    expect(screen.getByRole("button", { name: /isometric/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("flow")).toHaveAttribute("data-node-types", "ontologyIsoType,ontologyIsoType");
  });
});
