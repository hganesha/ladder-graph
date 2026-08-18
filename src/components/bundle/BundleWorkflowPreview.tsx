import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { Braces, Check, GitFork, Network, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { parse } from "yaml";
import { autoLayout } from "../../lib/layout";
import { NODE_META } from "../../lib/nodeMeta";
import type { Workflow } from "../../types";
import { toFlowEdges, toFlowNodes, workflowNodeTypes } from "../GraphCanvas";

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
  const [editingSource, setEditingSource] = useState(false);
  const [draftSource, setDraftSource] = useState(source);
  const [draftError, setDraftError] = useState<string | null>(null);
  useEffect(() => {
    if (!editingSource) setDraftSource(source);
  }, [editingSource, source]);
  const layoutNodes = useMemo(() => autoLayout(workflow.spec.nodes, workflow.spec.edges), [workflow]);
  const nodes = useMemo(
    () => toFlowNodes(layoutNodes).map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [layoutNodes, selectedNodeId],
  );
  const edges = useMemo(
    () => toFlowEdges(workflow.spec.edges, layoutNodes).map((edge) => ({ ...edge, selected: edge.id === selectedEdgeId })),
    [layoutNodes, selectedEdgeId, workflow.spec.edges],
  );
  const selectedNode = workflow.spec.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = workflow.spec.edges.find((edge) => edge.id === selectedEdgeId);
  const applyDraft = () => {
    try {
      const candidate = parse(draftSource) as Workflow;
      if (candidate?.kind !== "Workflow" || !Array.isArray(candidate.spec?.nodes) || !Array.isArray(candidate.spec?.edges)) {
        throw new Error("Source must contain a Ladder Workflow with node and edge arrays.");
      }
      setDraftError(null);
      onApplySource(draftSource);
      setEditingSource(false);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Workflow YAML could not be parsed.");
    }
  };

  return (
    <section className="bundle-workflow-preview" aria-label="Bundled workflow inspection">
      <header>
        <div>
          <span className="eyebrow">Bundled LGIR workflow</span>
          <h2>{workflow.metadata.title ?? workflow.metadata.name}</h2>
          <p>{workflow.spec.objective}</p>
        </div>
        <dl>
          <div>
            <dt>Nodes</dt>
            <dd>{workflow.spec.nodes.length}</dd>
          </div>
          <div>
            <dt>Edges</dt>
            <dd>{workflow.spec.edges.length}</dd>
          </div>
        </dl>
        <button
          className={editingSource ? "quiet-button active" : "quiet-button"}
          onClick={() => {
            setDraftSource(source);
            setDraftError(null);
            setEditingSource((current) => !current);
          }}
          type="button"
        >
          <Pencil size={14} /> {editingSource ? "Close source editor" : "Edit workflow"}
        </button>
      </header>
      {editingSource ? (
        <section className="bundle-workflow-source-editor" aria-label="Bundled workflow source editor">
          <header>
            <div>
              <strong>Workflow YAML</strong>
              <small>Edit the attached workflow asset. Applying recompiles the bundle and refreshes this graph.</small>
            </div>
            <div>
              <button
                className="quiet-button"
                onClick={() => {
                  setDraftSource(source);
                  setDraftError(null);
                  setEditingSource(false);
                }}
                type="button"
              >
                <X size={13} /> Cancel
              </button>
              <button className="primary-button" onClick={applyDraft} type="button">
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
        <div className="bundle-workflow-visual">
          <section className="embedded-graph-canvas" aria-label="Bundled workflow graph canvas">
            <ReactFlow
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              maxZoom={1.35}
              minZoom={0.2}
              nodes={nodes}
              nodesConnectable={false}
              nodesDraggable={false}
              nodeTypes={workflowNodeTypes}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
              }}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
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
                <p>{selectedNode.summary}</p>
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
              <p>Select a workflow node or edge to inspect its compiled contract.</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
