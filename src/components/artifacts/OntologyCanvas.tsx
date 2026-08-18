import dagre from "@dagrejs/dagre";
import {
  Background,
  type Connection,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  useNodesState,
} from "@xyflow/react";
import { memo, useEffect, useMemo } from "react";
import { resolveOntologyIcon } from "../../lib/nodeIcons";
import type { Ontology, OntologyType } from "../../types";
import { InlineNodeField } from "../InlineNodeField";
import { NodeIcon } from "../NodeIcon";

interface OntologyNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  typeId: string;
  propertyCount: number;
  matched: boolean;
  iconName: string;
  onInlineEdit?: (id: string, patch: Pick<Partial<OntologyType>, "label" | "description">) => void;
}

type OntologyFlowNode = Node<OntologyNodeData, "ontologyType">;

const OntologyTypeNode = memo(function OntologyTypeNode({ data, selected }: NodeProps<OntologyFlowNode>) {
  return (
    <article className={`ontology-graph-node ${selected ? "selected" : ""} ${data.matched ? "" : "dimmed"}`}>
      <Handle className="ontology-node-handle" position={Position.Left} type="target" />
      <header>
        <NodeIcon name={data.iconName} size={13} />
        <span>Entity type</span>
      </header>
      <InlineNodeField
        as="strong"
        editable={Boolean(data.onInlineEdit)}
        label="entity name"
        onCommit={(label) => data.onInlineEdit?.(data.typeId, { label })}
        placeholder="Untitled entity"
        showAffordance={selected}
        value={data.label}
      />
      <InlineNodeField
        as="p"
        editable={Boolean(data.onInlineEdit)}
        label="entity details"
        multiline
        onCommit={(description) => data.onInlineEdit?.(data.typeId, { description })}
        placeholder="Add details"
        showAffordance={selected}
        value={data.description}
      />
      <footer>
        <code>{data.typeId}</code>
        <span>{data.propertyCount} properties</span>
      </footer>
      <Handle className="ontology-node-handle" position={Position.Right} type="source" />
    </article>
  );
});

const nodeTypes = { ontologyType: OntologyTypeNode };

function graphElements(
  ontology: Ontology,
  query: string,
  selectedTypeId: string | null,
  selectedRelationshipId: string | null,
  onInlineEdit?: (id: string, patch: Pick<Partial<OntologyType>, "label" | "description">) => void,
) {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: 85, nodesep: 42, marginx: 32, marginy: 32, ranker: "network-simplex" });
  const nodeWidth = 210;
  const nodeHeight = 124;
  const normalizedQuery = query.trim().toLowerCase();
  const matchedIds = new Set(
    ontology.spec.types
      .filter((type) => !normalizedQuery || `${type.id} ${type.label} ${type.description ?? ""}`.toLowerCase().includes(normalizedQuery))
      .map((type) => type.id),
  );
  for (const type of ontology.spec.types) graph.setNode(type.id, { width: nodeWidth, height: nodeHeight });
  for (const relationship of ontology.spec.relationships) {
    if (graph.hasNode(relationship.sourceTypeId) && graph.hasNode(relationship.targetTypeId)) {
      graph.setEdge(relationship.sourceTypeId, relationship.targetTypeId);
    }
  }
  dagre.layout(graph);

  const nodes: OntologyFlowNode[] = ontology.spec.types.map((type) => {
    const position = graph.node(type.id) ?? { x: 0, y: 0 };
    return {
      id: type.id,
      type: "ontologyType",
      position: { x: position.x - nodeWidth / 2, y: position.y - nodeHeight / 2 },
      data: {
        label: type.label,
        description: type.description,
        typeId: type.id,
        propertyCount: type.properties.length,
        matched: matchedIds.has(type.id),
        iconName: resolveOntologyIcon(type).name,
        onInlineEdit,
      },
      selected: type.id === selectedTypeId,
    };
  });
  const edges = ontology.spec.relationships.map((relationship) => ({
    id: relationship.id,
    source: relationship.sourceTypeId,
    target: relationship.targetTypeId,
    type: "smoothstep",
    label: relationship.label,
    selected: relationship.id === selectedRelationshipId,
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--cyan)" },
    style: { stroke: "var(--cyan)", strokeWidth: relationship.id === selectedRelationshipId ? 2.2 : 1.25 },
    labelStyle: { fill: "var(--edge-label)", fontSize: 9 },
    labelBgStyle: { fill: "var(--edge-label-bg)", fillOpacity: 0.94 },
  }));
  return { edges, nodes };
}

export function OntologyCanvas({
  ontology,
  onConnectTypes,
  query,
  selectedRelationshipId,
  selectedTypeId,
  onSelectRelationship,
  onSelectType,
  onUpdateType,
}: {
  ontology: Ontology;
  onConnectTypes?: (sourceTypeId: string, targetTypeId: string) => void;
  query: string;
  selectedRelationshipId: string | null;
  selectedTypeId: string | null;
  onSelectRelationship: (id: string) => void;
  onSelectType: (id: string) => void;
  onUpdateType?: (id: string, patch: Pick<Partial<OntologyType>, "label" | "description">) => void;
}) {
  const { edges, nodes: layoutNodes } = useMemo(
    () => graphElements(ontology, query, selectedTypeId, selectedRelationshipId, onUpdateType),
    [ontology, onUpdateType, query, selectedRelationshipId, selectedTypeId],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<OntologyFlowNode>(layoutNodes);

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      return layoutNodes.map((node) => {
        const current = currentById.get(node.id);
        return current ? { ...node, position: current.position } : node;
      });
    });
  }, [layoutNodes, setNodes]);

  const connect = (connection: Connection) => {
    if (!connection.source || !connection.target || !onConnectTypes) return;
    onConnectTypes(connection.source, connection.target);
  };

  return (
    <section className="ontology-graph-canvas" aria-label="Ontology relationship canvas">
      <ReactFlow
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        maxZoom={1.6}
        minZoom={0.15}
        nodes={nodes}
        nodesConnectable={Boolean(onConnectTypes)}
        nodesDraggable
        nodeTypes={nodeTypes}
        onConnect={connect}
        onEdgeClick={(_, edge) => onSelectRelationship(edge.id)}
        onNodeClick={(_, node) => onSelectType(node.id)}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--graph-grid)" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor="var(--cyan)" pannable zoomable />
      </ReactFlow>
      <div className="ontology-canvas-hint">
        Double-click text to edit · drag nodes · connect handles to create relationships · click edges to inspect
      </div>
    </section>
  );
}
