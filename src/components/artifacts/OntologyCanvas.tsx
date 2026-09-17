import dagre from "@dagrejs/dagre";
import {
  Background,
  type Connection,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { resolveOntologyIcon } from "../../lib/nodeIcons";
import { flatTaskPosition, getInitialProjection, isoTaskPosition, type Projection, saveProjection } from "../../lib/projection";
import type { Ontology, OntologyType, Position as FlatPosition } from "../../types";
import { InlineNodeField } from "../InlineNodeField";
import { IsometricEdge, IsoTile } from "../IsometricNodes";
import { NodeIcon } from "../NodeIcon";
import { ProjectionSwitch } from "../ProjectionSwitch";

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
type OntologyIsoFlowNode = Node<OntologyNodeData, "ontologyIsoType">;
type OntologyCanvasNode = OntologyFlowNode | OntologyIsoFlowNode;

const ONTOLOGY_NODE = { width: 210, height: 124 };
// The dagre layout packs rows tighter than the workflow grid; spread it so tile labels clear the tile in front.
const ISO_SPREAD = 1.3;

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

const OntologyIsoTypeNode = memo(function OntologyIsoTypeNode({ data, selected }: NodeProps<OntologyIsoFlowNode>) {
  return (
    <IsoTile
      ariaLabel={`Entity type: ${data.label}`}
      className={`ontology-iso-node ${data.matched ? "" : "dimmed"}`}
      color="var(--cyan)"
      handleClassName="ontology-node-handle"
      icon={<NodeIcon name={data.iconName} size={14} />}
      kicker="Entity type"
      name={
        <InlineNodeField
          as="h3"
          editable={Boolean(data.onInlineEdit)}
          label="entity name"
          onCommit={(label) => data.onInlineEdit?.(data.typeId, { label })}
          placeholder="Untitled entity"
          showAffordance={selected}
          value={data.label}
        />
      }
      selected={selected}
      title={`${data.description ? `${data.description}\n` : ""}${data.typeId} · ${data.propertyCount} properties`}
    />
  );
});

const nodeTypes = { ontologyType: OntologyTypeNode, ontologyIsoType: OntologyIsoTypeNode };
const edgeTypes = { iso: IsometricEdge };

/** Layout positions stay flat; the isometric view only projects them for display. */
function displayNodes(layoutNodes: OntologyFlowNode[], projection: Projection, flatPositions: Map<string, FlatPosition>) {
  const nodes = layoutNodes.map((node): OntologyCanvasNode => {
    const flat = flatPositions.get(node.id) ?? node.position;
    flatPositions.set(node.id, flat);
    return projection === "isometric"
      ? { ...node, type: "ontologyIsoType", position: isoTaskPosition({ x: flat.x * ISO_SPREAD, y: flat.y * ISO_SPREAD }, ONTOLOGY_NODE) }
      : { ...node, position: flat };
  });
  if (projection !== "isometric") return nodes;
  // Tiles nearer the viewer (lower on screen) stack above the ones behind them.
  const depth = [...nodes].sort((left, right) => left.position.y - right.position.y).map((node) => node.id);
  return nodes.map((node) => ({ ...node, zIndex: depth.indexOf(node.id) + 1 }));
}

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
  showProjection = true,
}: {
  ontology: Ontology;
  onConnectTypes?: (sourceTypeId: string, targetTypeId: string) => void;
  query: string;
  selectedRelationshipId: string | null;
  selectedTypeId: string | null;
  onSelectRelationship: (id: string) => void;
  onSelectType: (id: string) => void;
  onUpdateType?: (id: string, patch: Pick<Partial<OntologyType>, "label" | "description">) => void;
  /** Embedded previews stay flat so the switch cannot cover a node on a small canvas. */
  showProjection?: boolean;
}) {
  const [projection, setProjection] = useState<Projection>(() => (showProjection ? getInitialProjection("ontology") : "orthogonal"));
  const { edges: layoutEdges, nodes: layoutNodes } = useMemo(
    () => graphElements(ontology, query, selectedTypeId, selectedRelationshipId, onUpdateType),
    [ontology, onUpdateType, query, selectedRelationshipId, selectedTypeId],
  );
  const edges = useMemo(
    (): Edge[] => (projection === "isometric" ? layoutEdges.map((edge) => ({ ...edge, type: "iso" })) : layoutEdges),
    [layoutEdges, projection],
  );
  const flatPositions = useRef(new Map<string, FlatPosition>());
  const [initialNodes] = useState(() => displayNodes(layoutNodes, projection, flatPositions.current));
  const [nodes, setNodes, onNodesChange] = useNodesState<OntologyCanvasNode>(initialNodes);
  const flowRef = useRef<ReactFlowInstance<OntologyCanvasNode, Edge> | null>(null);
  const previousProjection = useRef(projection);

  useEffect(() => {
    setNodes(displayNodes(layoutNodes, projection, flatPositions.current));
  }, [layoutNodes, projection, setNodes]);

  useEffect(() => {
    if (previousProjection.current === projection) return;
    previousProjection.current = projection;
    const frame = requestAnimationFrame(() => {
      void flowRef.current?.fitView({ padding: 0.16, duration: 220 });
    });
    return () => cancelAnimationFrame(frame);
  }, [projection]);

  const changeProjection = (next: Projection) => {
    setProjection(next);
    saveProjection(next, "ontology");
  };

  const connect = (connection: Connection) => {
    if (!connection.source || !connection.target || !onConnectTypes) return;
    onConnectTypes(connection.source, connection.target);
  };

  return (
    <section className="ontology-graph-canvas" aria-label="Ontology relationship canvas">
      <ReactFlow
        edges={edges}
        edgeTypes={edgeTypes}
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
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onNodeDragStop={(_, _node, dragged) => {
          for (const node of dragged) {
            const spread = projection === "isometric" ? flatTaskPosition(node.position, ONTOLOGY_NODE) : undefined;
            flatPositions.current.set(node.id, spread ? { x: spread.x / ISO_SPREAD, y: spread.y / ISO_SPREAD } : node.position);
          }
        }}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--graph-grid)" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor="var(--cyan)" pannable zoomable />
      </ReactFlow>
      {showProjection && <ProjectionSwitch value={projection} onChange={changeProjection} />}
      <div className="ontology-canvas-hint">
        Double-click text to edit · drag nodes · connect handles to create relationships · click edges to inspect
      </div>
    </section>
  );
}
