import { Background, type Connection, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { Braces, Check, GitFork, Network, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { parse, stringify } from "yaml";
import { autoLayout } from "../../lib/layout";
import { defaultNode, NODE_META, PALETTE_ORDER } from "../../lib/nodeMeta";
import { deleteWorkflowElements } from "../../lib/workflowEditing";
import type { LgirEdge, NodeKind, Workflow } from "../../types";
import { toFlowEdges, toFlowNodes, workflowNodeTypes } from "../GraphCanvas";

type EditorMode = "inspect" | "visual" | "source";

function clonedWorkflow(workflow: Workflow): Workflow {
  return structuredClone(workflow);
}

function nextNode(workflow: Workflow, kind: NodeKind) {
  const ids = new Set(workflow.spec.nodes.map((node) => node.id));
  let sequence = workflow.spec.nodes.length + 1;
  let node = defaultNode(kind, sequence);
  while (ids.has(node.id)) {
    sequence += 1;
    node = defaultNode(kind, sequence);
  }
  return node;
}

function nextEdge(workflow: Workflow, connection: Connection): LgirEdge | null {
  if (!connection.source || !connection.target) return null;
  const ids = new Set(workflow.spec.edges.map((edge) => edge.id));
  let sequence = workflow.spec.edges.length + 1;
  while (ids.has(`edge-${sequence}`)) sequence += 1;
  return { id: `edge-${sequence}`, from: connection.source, to: connection.target, kind: "dependency" };
}

export function BundleWorkflowPreview({
  workflow,
  source,
  onApplySource,
}: {
  workflow: Workflow;
  source: string;
  onApplySource: (source: string) => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(workflow.spec.nodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("inspect");
  const [draftSource, setDraftSource] = useState(source);
  const [draftWorkflow, setDraftWorkflow] = useState<Workflow>(() => clonedWorkflow(workflow));
  const [draftError, setDraftError] = useState<string | null>(null);
  const [newNodeKind, setNewNodeKind] = useState<NodeKind>("agent");

  useEffect(() => {
    if (editorMode !== "inspect") return;
    setDraftSource(source);
    setDraftWorkflow(clonedWorkflow(workflow));
  }, [editorMode, source, workflow]);

  const activeWorkflow = editorMode === "visual" ? draftWorkflow : workflow;
  const layoutNodes = useMemo(
    () => (editorMode === "visual" ? activeWorkflow.spec.nodes : autoLayout(activeWorkflow.spec.nodes, activeWorkflow.spec.edges)),
    [activeWorkflow.spec.edges, activeWorkflow.spec.nodes, editorMode],
  );
  const nodes = useMemo(
    () => toFlowNodes(layoutNodes).map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [layoutNodes, selectedNodeId],
  );
  const edges = useMemo(
    () =>
      toFlowEdges(activeWorkflow.spec.edges, layoutNodes).map((edge) => ({
        ...edge,
        selected: edge.id === selectedEdgeId,
      })),
    [activeWorkflow.spec.edges, layoutNodes, selectedEdgeId],
  );
  const selectedNode = activeWorkflow.spec.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = activeWorkflow.spec.edges.find((edge) => edge.id === selectedEdgeId);

  const resetEditor = (mode: EditorMode) => {
    setDraftSource(source);
    const nextWorkflow = clonedWorkflow(workflow);
    if (mode === "visual") nextWorkflow.spec.nodes = autoLayout(nextWorkflow.spec.nodes, nextWorkflow.spec.edges);
    setDraftWorkflow(nextWorkflow);
    setDraftError(null);
    setEditorMode(mode);
  };

  const applySourceDraft = () => {
    try {
      const candidate = parse(draftSource) as Workflow;
      if (candidate?.kind !== "Workflow" || !Array.isArray(candidate.spec?.nodes) || !Array.isArray(candidate.spec?.edges)) {
        throw new Error("Source must contain a Ladder Workflow with node and edge arrays.");
      }
      setDraftError(null);
      onApplySource(draftSource);
      setEditorMode("inspect");
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Workflow YAML could not be parsed.");
    }
  };

  const applyVisualDraft = () => {
    onApplySource(stringify(draftWorkflow, { lineWidth: 110 }));
    setEditorMode("inspect");
  };

  const updateDraftNode = (patch: Partial<Workflow["spec"]["nodes"][number]>) => {
    if (!selectedNodeId) return;
    setDraftWorkflow((current) => ({
      ...current,
      spec: {
        ...current.spec,
        nodes: current.spec.nodes.map((node) => (node.id === selectedNodeId ? { ...node, ...patch } : node)),
      },
    }));
  };

  const deleteSelected = () => {
    setDraftWorkflow((current) =>
      deleteWorkflowElements(current, selectedNodeId ? [selectedNodeId] : [], selectedEdgeId ? [selectedEdgeId] : []),
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  return (
    <section className="bundle-workflow-preview" aria-label="Bundled workflow inspection">
      <header>
        <div>
          <span className="eyebrow">Bundled LGIR workflow</span>
          <h2>{activeWorkflow.metadata.title ?? activeWorkflow.metadata.name}</h2>
          <p>{activeWorkflow.spec.objective}</p>
        </div>
        <dl>
          <div>
            <dt>Nodes</dt>
            <dd>{activeWorkflow.spec.nodes.length}</dd>
          </div>
          <div>
            <dt>Edges</dt>
            <dd>{activeWorkflow.spec.edges.length}</dd>
          </div>
        </dl>
        <div className="bundle-workflow-editor-modes">
          <button
            aria-pressed={editorMode === "visual"}
            className={editorMode === "visual" ? "quiet-button active" : "quiet-button"}
            onClick={() => resetEditor(editorMode === "visual" ? "inspect" : "visual")}
            type="button"
          >
            <Pencil size={14} /> {editorMode === "visual" ? "Close visual editor" : "Edit workflow visually"}
          </button>
          <button
            aria-pressed={editorMode === "source"}
            className={editorMode === "source" ? "quiet-button active" : "quiet-button"}
            onClick={() => resetEditor(editorMode === "source" ? "inspect" : "source")}
            type="button"
          >
            <Braces size={14} /> {editorMode === "source" ? "Close YAML editor" : "Edit workflow YAML"}
          </button>
        </div>
      </header>

      {editorMode === "source" ? (
        <section className="bundle-workflow-source-editor" aria-label="Bundled workflow source editor">
          <header>
            <div>
              <strong>Workflow YAML</strong>
              <small>Edit the attached workflow asset. Applying recompiles the bundle and refreshes this graph.</small>
            </div>
            <div>
              <button className="quiet-button" onClick={() => resetEditor("inspect")} type="button">
                <X size={13} /> Cancel
              </button>
              <button className="primary-button" onClick={applySourceDraft} type="button">
                <Check size={13} /> Apply workflow changes
              </button>
            </div>
          </header>
          <textarea
            aria-label="Bundled workflow YAML source"
            onChange={(event) => {
              setDraftSource(event.target.value);
              setDraftError(null);
            }}
            spellCheck={false}
            value={draftSource}
          />
          {draftError ? <p role="alert">{draftError}</p> : null}
        </section>
      ) : (
        <>
          {editorMode === "visual" ? (
            <div className="bundle-workflow-visual-toolbar" aria-label="Visual workflow editing controls" role="toolbar">
              <label>
                <span>Add node</span>
                <select
                  aria-label="New workflow node kind"
                  onChange={(event) => setNewNodeKind(event.target.value as NodeKind)}
                  value={newNodeKind}
                >
                  {PALETTE_ORDER.map((kind) => (
                    <option key={kind} value={kind}>
                      {NODE_META[kind].label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="quiet-button"
                onClick={() => {
                  const node = nextNode(draftWorkflow, newNodeKind);
                  setDraftWorkflow((current) => ({
                    ...current,
                    spec: { ...current.spec, nodes: [...current.spec.nodes, node] },
                  }));
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                type="button"
              >
                <Plus size={13} /> Add {NODE_META[newNodeKind].label}
              </button>
              <button className="quiet-button danger" disabled={!selectedNodeId && !selectedEdgeId} onClick={deleteSelected} type="button">
                <Trash2 size={13} /> Delete selected
              </button>
              <span className="bundle-workflow-toolbar-spacer" />
              <button className="quiet-button" onClick={() => resetEditor("inspect")} type="button">
                <X size={13} /> Discard
              </button>
              <button className="primary-button" onClick={applyVisualDraft} type="button">
                <Check size={13} /> Apply visual changes
              </button>
            </div>
          ) : null}
          <div className={editorMode === "visual" ? "bundle-workflow-visual editing" : "bundle-workflow-visual"}>
            <section className="embedded-graph-canvas" aria-label="Bundled workflow graph canvas">
              <ReactFlow
                deleteKeyCode={editorMode === "visual" ? ["Backspace", "Delete"] : null}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                maxZoom={1.35}
                minZoom={0.2}
                nodes={nodes}
                nodesConnectable={editorMode === "visual"}
                nodesDraggable={editorMode === "visual"}
                nodeTypes={workflowNodeTypes}
                onConnect={(connection) => {
                  const edge = nextEdge(draftWorkflow, connection);
                  if (!edge) return;
                  setDraftWorkflow((current) => ({
                    ...current,
                    spec: { ...current.spec, edges: [...current.spec.edges, edge] },
                  }));
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                onDelete={({ nodes: deletedNodes, edges: deletedEdges }) => {
                  if (editorMode !== "visual") return;
                  setDraftWorkflow((current) =>
                    deleteWorkflowElements(
                      current,
                      deletedNodes.map((node) => node.id),
                      deletedEdges.map((edge) => edge.id),
                    ),
                  );
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                onNodeDragStop={(_, node) => {
                  if (editorMode !== "visual") return;
                  setDraftWorkflow((current) => ({
                    ...current,
                    spec: {
                      ...current.spec,
                      nodes: current.spec.nodes.map((candidate) =>
                        candidate.id === node.id ? { ...candidate, position: node.position } : candidate,
                      ),
                    },
                  }));
                }}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="var(--graph-grid)" gap={25} size={1} />
                <Controls showInteractive={false} />
                <MiniMap nodeColor={(node) => NODE_META[(node.data as Workflow["spec"]["nodes"][number]).kind]?.color ?? "#66717c"} />
              </ReactFlow>
            </section>
            <aside className="embedded-graph-inspector" aria-label="Bundled workflow inspector">
              {selectedNode ? (
                <>
                  <header>
                    <Braces size={15} />
                    <span>
                      <small>{selectedNode.kind} node</small>
                      <strong>{selectedNode.name}</strong>
                    </span>
                  </header>
                  {editorMode === "visual" ? (
                    <fieldset className="embedded-node-editor">
                      <legend>Selected node</legend>
                      <label>
                        <span>Name</span>
                        <input
                          aria-label="Selected workflow node name"
                          onChange={(event) => updateDraftNode({ name: event.target.value })}
                          value={selectedNode.name}
                        />
                      </label>
                      <label>
                        <span>Summary</span>
                        <textarea
                          aria-label="Selected workflow node summary"
                          onChange={(event) => updateDraftNode({ summary: event.target.value })}
                          value={selectedNode.summary}
                        />
                      </label>
                      {selectedNode.role !== undefined ? (
                        <label>
                          <span>Role</span>
                          <input
                            aria-label="Selected workflow node role"
                            onChange={(event) => updateDraftNode({ role: event.target.value })}
                            value={selectedNode.role}
                          />
                        </label>
                      ) : null}
                    </fieldset>
                  ) : (
                    <p>{selectedNode.summary}</p>
                  )}
                  <dl>
                    <div>
                      <dt>Stable ID</dt>
                      <dd>{selectedNode.id}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{selectedNode.role ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Input contract</dt>
                      <dd>{selectedNode.inputSchema ? "Declared" : "None"}</dd>
                    </div>
                    <div>
                      <dt>Output contract</dt>
                      <dd>{selectedNode.outputSchema ? "Declared" : "None"}</dd>
                    </div>
                    <div>
                      <dt>Attached forms</dt>
                      <dd>{selectedNode.formRefs?.length ?? 0}</dd>
                    </div>
                  </dl>
                  {selectedNode.prompt ? <pre>{selectedNode.prompt}</pre> : null}
                </>
              ) : selectedEdge ? (
                <>
                  <header>
                    <GitFork size={15} />
                    <span>
                      <small>{selectedEdge.kind} edge</small>
                      <strong>{selectedEdge.id}</strong>
                    </span>
                  </header>
                  <div className="embedded-edge-route">
                    <code>{selectedEdge.from}</code>
                    <Network size={14} />
                    <code>{selectedEdge.to}</code>
                  </div>
                  <dl>
                    <div>
                      <dt>Condition</dt>
                      <dd>{selectedEdge.condition ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Contract</dt>
                      <dd>{selectedEdge.contract ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>State mapping</dt>
                      <dd>
                        {selectedEdge.sourcePath && selectedEdge.targetPath
                          ? `${selectedEdge.sourcePath} → ${selectedEdge.targetPath}`
                          : "None"}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p>
                  {editorMode === "visual"
                    ? "Select a node or edge to edit it."
                    : "Select a workflow node or edge to inspect its compiled contract."}
                </p>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
