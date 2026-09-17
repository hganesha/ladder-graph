import {
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { exportGraphImage, type GraphImageFormat } from "../lib/graphImage";
import { groupDimensions } from "../lib/layout";
import { NODE_META } from "../lib/nodeMeta";
import { draggedPositions, getInitialProjection, isoGroupFrame, isoTaskPosition, type Projection, saveProjection } from "../lib/projection";
import { useStudioStore } from "../store/useStudioStore";
import type { LgirEdge, LgirNode } from "../types";
import { type GroupFlowData, GroupNode } from "./GroupNode";
import { IsometricEdge, type IsoGroupFlowNode, type IsoTaskFlowNode, IsometricGroupNode, IsometricTaskNode } from "./IsometricNodes";
import { ProjectionSwitch } from "./ProjectionSwitch";
import { type TaskFlowData, TaskNode, type WorkflowInlineEdit } from "./TaskNode";

export type TaskFlowNode = Node<TaskFlowData, "task">;
export type GroupFlowNode = Node<GroupFlowData, "group">;
export type WorkflowFlowNode = TaskFlowNode | GroupFlowNode | IsoTaskFlowNode | IsoGroupFlowNode;

export function toFlowNodes(
  nodes: LgirNode[],
  onInlineEdit?: WorkflowInlineEdit,
  projection: Projection = "orthogonal",
): WorkflowFlowNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const owner = new Map<string, LgirNode>();
  nodes
    .filter((node) => node.kind === "group")
    .forEach((group) => {
      group.config?.members?.forEach((id) => {
        owner.set(id, group);
      });
    });
  if (projection === "isometric") return toIsometricFlowNodes(nodes, byId, owner, onInlineEdit);
  return [...nodes]
    .sort((left, right) => Number(left.kind !== "group") - Number(right.kind !== "group"))
    .map((node) => {
      const position = node.position ?? { x: 0, y: 0 };
      if (node.kind === "group") {
        const dimensions = groupDimensions(node);
        return {
          id: node.id,
          type: "group",
          position,
          data: { ...node, memberCount: node.config?.members?.filter((id) => byId.has(id)).length ?? 0, onInlineEdit },
          style: dimensions,
          zIndex: -1,
        } satisfies GroupFlowNode;
      }
      const group = owner.get(node.id);
      const groupPosition = group?.position ?? { x: 0, y: 0 };
      return {
        id: node.id,
        type: "task",
        position: group ? { x: position.x - groupPosition.x, y: position.y - groupPosition.y } : position,
        data: { ...node, onInlineEdit },
        parentId: group?.id,
        extent: group ? "parent" : undefined,
        zIndex: 2,
      } satisfies TaskFlowNode;
    });
}

function toIsometricFlowNodes(
  nodes: LgirNode[],
  byId: Map<string, LgirNode>,
  owner: Map<string, LgirNode>,
  onInlineEdit?: WorkflowInlineEdit,
): WorkflowFlowNode[] {
  const groups = nodes
    .filter((node) => node.kind === "group")
    .map((node) => {
      const frame = isoGroupFrame(node);
      return {
        id: node.id,
        type: "isoGroup",
        position: frame.position,
        data: {
          ...node,
          memberCount: node.config?.members?.filter((id) => byId.has(id)).length ?? 0,
          onInlineEdit,
          plane: { ...frame.flat, transform: frame.transform },
        },
        style: { width: frame.width, height: frame.height },
        zIndex: -1,
      } satisfies IsoGroupFlowNode;
    });
  // Tiles nearer the viewer (lower on screen) stack above the ones behind them.
  const tasks = nodes
    .filter((node) => node.kind !== "group")
    .map((node) => ({ node, absolute: isoTaskPosition(node.position ?? { x: 0, y: 0 }) }))
    .sort((left, right) => left.absolute.y - right.absolute.y);
  return [
    ...groups,
    ...tasks.map(({ node, absolute }, index) => {
      const group = owner.get(node.id);
      const origin = group ? isoGroupFrame(group).position : { x: 0, y: 0 };
      return {
        id: node.id,
        type: "isoTask",
        position: { x: absolute.x - origin.x, y: absolute.y - origin.y },
        data: { ...node, onInlineEdit },
        parentId: group?.id,
        zIndex: 2 + index,
      } satisfies IsoTaskFlowNode;
    }),
  ];
}

export function toFlowEdges(edges: LgirEdge[], nodes: LgirNode[], projection: Projection = "orthogonal"): Edge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const type = projection === "isometric" ? "iso" : "smoothstep";
  const stored = edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type,
    label: edge.contract || edge.condition,
    animated: edge.kind === "control",
    style: {
      stroke: edge.kind === "data" ? "var(--cyan)" : edge.kind === "control" ? "var(--pink)" : "var(--edge-dependency)",
      strokeWidth: 1.35,
    },
    labelStyle: { fill: "var(--edge-label)", fontSize: 11 },
    labelBgStyle: { fill: "var(--edge-label-bg)", fillOpacity: 0.94 },
  }));
  const virtual = nodes
    .filter((node) => node.kind === "group")
    .flatMap((group) => {
      const members = group.config?.members?.filter((id) => nodeIds.has(id)) ?? [];
      if (!members.length) return [];
      const executionEdges =
        group.config?.execution === "sequential"
          ? [
              { id: `group-${group.id}-dispatch`, source: group.id, sourceHandle: "dispatch", target: members[0] },
              ...members
                .slice(1)
                .map((member, index) => ({ id: `group-${group.id}-sequence-${index}`, source: members[index], target: member })),
            ]
          : members.map((member) => ({
              id: `group-${group.id}-dispatch-${member}`,
              source: group.id,
              sourceHandle: "dispatch",
              target: member,
            }));
      const collectionEdges = members.map((member) => ({
        id: `group-${group.id}-collect-${member}`,
        source: member,
        target: group.id,
        targetHandle: "collect",
      }));
      return [...executionEdges, ...collectionEdges].map((edge) => ({
        ...edge,
        type,
        selectable: false,
        focusable: false,
        className: "group-internal-edge",
        style: { stroke: "var(--group-edge)", strokeWidth: 1.1, strokeDasharray: "4 4" },
      }));
    });
  return [...stored, ...virtual];
}

export const workflowNodeTypes = { task: TaskNode, group: GroupNode, isoTask: IsometricTaskNode, isoGroup: IsometricGroupNode };
export const workflowEdgeTypes = { iso: IsometricEdge };

export interface GraphCanvasHandle {
  exportImage: (format: GraphImageFormat) => Promise<void>;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle>(function GraphCanvas(_, ref) {
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const validYaml = Boolean(workflow);
  const selectNode = useStudioStore((state) => state.selectNode);
  const selectEdge = useStudioStore((state) => state.selectEdge);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const selectedEdgeId = useStudioStore((state) => state.selectedEdgeId);
  const connect = useStudioStore((state) => state.connect);
  const deleteElements = useStudioStore((state) => state.deleteElements);
  const patchNode = useStudioStore((state) => state.patchNode);
  const updatePositions = useStudioStore((state) => state.updatePositions);
  const [projection, setProjection] = useState<Projection>(getInitialProjection);
  const onInlineEdit = useCallback<WorkflowInlineEdit>((id, patch) => void patchNode(id, patch), [patchNode]);
  const sourceNodes = useMemo(
    () => toFlowNodes(workflow?.spec.nodes ?? [], onInlineEdit, projection),
    [onInlineEdit, projection, workflow],
  );
  const sourceEdges = useMemo(
    () => toFlowEdges(workflow?.spec.edges ?? [], workflow?.spec.nodes ?? [], projection),
    [projection, workflow],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(sourceNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sourceEdges);
  const canvasRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<WorkflowFlowNode, Edge> | null>(null);
  const fitAddedNodes = useRef<(() => void) | null>(null);
  const previousNodeCount = useRef(sourceNodes.length);
  const previousProjection = useRef(projection);
  const selectedNode = workflow?.spec.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = workflow?.spec.edges.find((edge) => edge.id === selectedEdgeId);
  const displayNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })), [nodes, selectedNodeId]);
  const displayEdges = useMemo(
    () =>
      edges.map((edge) =>
        edge.id === selectedEdgeId
          ? {
              ...edge,
              selected: true,
              style: { ...edge.style, stroke: "var(--cyan)", strokeWidth: 2.4 },
              labelStyle: { ...edge.labelStyle, fill: "var(--text)", fontWeight: 600 },
            }
          : { ...edge, selected: false },
      ),
    [edges, selectedEdgeId],
  );

  useImperativeHandle(
    ref,
    () => ({
      exportImage: async (format) => {
        if (!canvasRef.current || !flowRef.current) throw new Error("Open the canvas before exporting an image.");
        await exportGraphImage({
          format,
          instance: flowRef.current,
          name: workflow?.metadata.name ?? "workflow",
          root: canvasRef.current,
        });
      },
    }),
    [workflow?.metadata.name],
  );

  useEffect(() => setNodes(sourceNodes), [sourceNodes, setNodes]);
  useEffect(() => setEdges(sourceEdges), [sourceEdges, setEdges]);
  useEffect(() => {
    const added = sourceNodes.length > previousNodeCount.current;
    previousNodeCount.current = sourceNodes.length;
    if (!added) return;
    const frame = requestAnimationFrame(() => {
      fitAddedNodes.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceNodes.length]);

  useEffect(() => {
    if (previousProjection.current === projection) return;
    previousProjection.current = projection;
    const frame = requestAnimationFrame(() => {
      void flowRef.current?.fitView({ padding: 0.2, minZoom: 0.25, maxZoom: 1, duration: 220 });
    });
    return () => cancelAnimationFrame(frame);
  }, [projection]);

  const changeProjection = (next: Projection) => {
    setProjection(next);
    saveProjection(next);
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    void connect({ from: connection.source, to: connection.target, kind: "dependency" });
  };

  return (
    <section ref={canvasRef} className="canvas-wrap" aria-label="Workflow graph canvas">
      {!validYaml && (
        <div className="canvas-lock">
          <AlertContent />
        </div>
      )}
      <ReactFlow<WorkflowFlowNode, Edge>
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={workflowNodeTypes}
        edgeTypes={workflowEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onEdgeDoubleClick={(_, edge) => selectEdge(edge.id)}
        onDelete={({ nodes: deletedNodes, edges: deletedEdges }) =>
          void deleteElements(
            deletedNodes.map((node) => node.id),
            deletedEdges.map((edge) => edge.id),
          )
        }
        onPaneClick={() => selectNode(null)}
        onInit={(instance) => {
          flowRef.current = instance;
          fitAddedNodes.current = () => {
            void instance.fitView({ padding: 0.15, minZoom: 0.45, maxZoom: 0.9, duration: 220 });
          };
        }}
        onNodeDragStop={(_, node) => {
          if (!workflow) return;
          const parentPosition = node.parentId ? nodes.find((candidate) => candidate.id === node.parentId)?.position : undefined;
          const positions = draggedPositions(workflow.spec.nodes, node.id, node.position, projection, parentPosition);
          if (Object.keys(positions).length) void updatePositions(positions);
        }}
        nodesDraggable={validYaml}
        nodesConnectable={validYaml}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.45,
          maxZoom: 1,
          nodes: sourceNodes.slice(0, Math.min(4, sourceNodes.length)),
        }}
        minZoom={0.25}
        maxZoom={1.7}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--graph-grid)" gap={25} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => NODE_META[(node.data as unknown as LgirNode).kind]?.color ?? "#66717c"}
          maskColor="var(--minimap-mask)"
          pannable
          zoomable
        />
      </ReactFlow>
      <ProjectionSwitch value={projection} onChange={changeProjection} />
      {(selectedNode || selectedEdge) && (
        <button
          type="button"
          className="canvas-delete-action"
          aria-label={`Delete selected ${selectedNode ? "node" : "edge"}`}
          title={`Delete ${selectedNode?.name ?? "selected edge"}`}
          onClick={() => void deleteElements(selectedNode ? [selectedNode.id] : [], selectedEdge ? [selectedEdge.id] : [])}
        >
          <Trash2 size={14} />
          <span>Delete {selectedNode ? "node" : "edge"}</span>
          <kbd>⌫</kbd>
        </button>
      )}
      <div className="canvas-hint">
        <span className="desktop-canvas-hint">double-click text to edit · drag nodes · connect handles · select + delete · ⌘↵ compile</span>
        <span className="mobile-canvas-hint">drag to pan · pinch to zoom</span>
      </div>
    </section>
  );
});

function AlertContent() {
  return (
    <>
      <strong>Canvas paused</strong>
      <span>Fix the YAML syntax to resume visual editing. Your last valid graph is still saved.</span>
    </>
  );
}
