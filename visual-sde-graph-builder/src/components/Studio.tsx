import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  BookOpen,
  ChevronLeft,
  LayoutTemplate,
  PanelBottom,
  Redo2,
  Undo2,
  Upload,
  Wand2,
} from "lucide-react";
import mark from "../assets/mark.png";
import { generateBrief, generateJSON, generateMermaid, generateWorkflowJS } from "../lib/codegen";
import { autoLayout } from "../lib/layout";
import { cloneGraph, defaultTask, edgeStyle, KIND_META, makeEdge, makeNode, type GraphEdge, type GraphNode } from "../lib/model";
import { templateById } from "../lib/templates";
import { estimateAgents, findCycles, validateGraph } from "../lib/validate";
import type { EdgeKind, NodeKind, TaskData, WorkflowMeta } from "../types";
import { Guide } from "./Guide";
import { Inspector } from "./Inspector";
import { OutputPanel } from "./OutputPanel";
import { Palette } from "./Palette";
import { TaskNode } from "./TaskNode";
import { cn } from "../utils/cn";

const nodeTypes = { task: TaskNode };

interface StudioProps {
  templateId: string;
  onBack: () => void;
}

export function Studio(props: StudioProps) {
  return (
    <ReactFlowProvider>
      <StudioInner {...props} />
    </ReactFlowProvider>
  );
}

function StudioInner({ templateId, onBack }: StudioProps) {
  const seed = templateById(templateId);
  const seeded = cloneGraph(seed.nodes, seed.edges);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>(seeded.edges);
  const [meta, setMeta] = useState<WorkflowMeta>({ ...seed.meta });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const fileRef = useRef<HTMLInputElement>(null);

  const past = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }[]>([]);
  const future = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }[]>([]);

  const snapshot = useCallback(() => {
    past.current.push(cloneGraph(nodes, edges));
    if (past.current.length > 50) past.current.shift();
    future.current = [];
  }, [nodes, edges]);

  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 40);
    return () => window.clearTimeout(t);
  }, [fitView, templateId]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const issues = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);
  const cycleInfo = useMemo(() => findCycles(nodes, edges), [nodes, edges]);
  const agentEst = useMemo(() => estimateAgents(nodes), [nodes]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      snapshot();
      const kind: EdgeKind = params.targetHandle === "back" ? "loop" : "data";
      const edge = makeEdge(params.source, params.target, {
        kind,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        label: kind === "loop" ? "loop" : "",
      });
      setEdges((eds) => eds.concat(edge));
    },
    [setEdges, snapshot],
  );

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      snapshot();
      const pos =
        position ??
        screenToFlowPosition({
          x: window.innerWidth / 2 + (nodes.length % 5) * 18,
          y: window.innerHeight / 2 + (nodes.length % 4) * 18,
        });
      const node = makeNode(kind, pos);
      setNodes((nds) => nds.concat(node));
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [nodes.length, screenToFlowPosition, setNodes, snapshot],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/codez") as NodeKind;
      if (!kind) return;
      addNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addNode, screenToFlowPosition],
  );

  const onChangeNode = (id: string, patch: Partial<TaskData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const onChangeEdge = (id: string, patch: { kind?: EdgeKind; contract?: string; label?: string }) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== id) return e;
        const kind = patch.kind ?? e.data?.kind ?? "data";
        const contract = patch.contract ?? e.data?.contract ?? "";
        const label = patch.label ?? e.data?.label ?? contract;
        return {
          ...e,
          animated: kind === "loop" || kind === "verify",
          style: edgeStyle(kind),
          label: label || undefined,
          data: { kind, contract, label },
        };
      }),
    );
  };

  const layout = (dir: "TB" | "LR") => {
    snapshot();
    setNodes((nds) => autoLayout(nds, edges, dir));
    window.setTimeout(() => fitView({ padding: 0.2, duration: 350 }), 20);
  };

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(cloneGraph(nodes, edges));
    setNodes(prev.nodes);
    setEdges(prev.edges as typeof edges);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(cloneGraph(nodes, edges));
    setNodes(next.nodes);
    setEdges(next.edges as typeof edges);
  };

  const onSelect = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeId((params.nodes[0]?.id as string | undefined) ?? null);
    setSelectedEdgeId((params.edges[0]?.id as string | undefined) ?? null);
  }, []);

  const focusNode = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    setSelectedNodeId(id);
    setCenter(n.position.x + 130, n.position.y + 60, { zoom: 1.05, duration: 350 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const metaKey = e.metaKey || e.ctrlKey;
      if (metaKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (metaKey && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (metaKey && e.key === "Enter") {
        e.preventDefault();
        setOutputOpen(true);
        flash("Compiled — copy from the drawer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const exportAll = () => {
    const pack = [
      { name: `${meta.name}.js`, body: generateWorkflowJS(nodes, edges, meta) },
      { name: `${meta.name}.mmd`, body: generateMermaid(nodes, edges, meta) },
      { name: `${meta.name}.md`, body: generateBrief(nodes, edges, meta) },
      { name: `${meta.name}.json`, body: generateJSON(nodes, edges, meta) },
    ];
    for (const file of pack) {
      const blob = new Blob([file.body], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
    flash("Downloaded JS, Mermaid, brief, JSON");
  };

  const importGraph = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        meta?: Partial<WorkflowMeta>;
        nodes?: Array<{ id: string; kind?: NodeKind; position?: { x: number; y: number }; data?: Partial<TaskData> }>;
        edges?: Array<{
          id?: string;
          source: string;
          target: string;
          sourceHandle?: string | null;
          targetHandle?: string | null;
          data?: { kind?: EdgeKind; contract?: string; label?: string };
        }>;
      };
      snapshot();
      const nextNodes: GraphNode[] = (parsed.nodes ?? []).map((n) => {
        const kind = (n.data?.kind ?? n.kind ?? "agent") as NodeKind;
        return {
          id: n.id,
          type: "task",
          position: n.position ?? { x: 40, y: 40 },
          data: { ...defaultTask(kind), ...(n.data ?? {}), kind },
        };
      });
      const nextEdges: GraphEdge[] = (parsed.edges ?? []).map((e) => ({
        ...makeEdge(e.source, e.target, {
          kind: e.data?.kind ?? "data",
          contract: e.data?.contract ?? "",
          label: e.data?.label ?? "",
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        }),
        id: e.id ?? `${e.source}-${e.target}`,
      }));
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (parsed.meta) setMeta((m) => ({ ...m, ...parsed.meta }));
      flash("Graph imported");
      window.setTimeout(() => fitView({ padding: 0.2, duration: 350 }), 30);
    } catch {
      flash("Could not read that JSON");
    }
  };

  const errors = issues.filter((i) => i.level === "error").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#07080b] text-[#efeae0]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/6 bg-[#0c0d11]/90 px-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-[#9a9488] hover:bg-white/5 hover:text-[#efeae0]"
          >
            <ChevronLeft size={14} />
            Gallery
          </button>
          <div className="h-4 w-px bg-white/10" />
          <img src={mark} alt="" className="h-7 w-7 rounded-md object-cover ring-1 ring-white/10" />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] tracking-tight">{meta.name}</div>
            <div className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[#7d786e]">
              {meta.description}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge>
            {nodes.length}n · {edges.length}e · ~{agentEst} agents
          </Badge>
          <Badge tone={cycleInfo.hasUnmarkedCycle ? "bad" : cycleInfo.cycles ? "loop" : "ok"}>
            {cycleInfo.hasUnmarkedCycle ? "unmarked cycle" : cycleInfo.cycles ? "guarded loop" : "DAG"}
          </Badge>
          {errors > 0 && <Badge tone="bad">{errors} error{errors > 1 ? "s" : ""}</Badge>}

          <IconBtn title="Undo" onClick={undo}>
            <Undo2 size={14} />
          </IconBtn>
          <IconBtn title="Redo" onClick={redo}>
            <Redo2 size={14} />
          </IconBtn>
          <IconBtn title="Auto-layout" onClick={() => layout("TB")}>
            <LayoutTemplate size={14} />
          </IconBtn>
          <IconBtn title="Import graph JSON" onClick={() => fileRef.current?.click()}>
            <Upload size={14} />
          </IconBtn>
          <IconBtn title="Roadmap" onClick={() => setGuideOpen(true)}>
            <BookOpen size={14} />
          </IconBtn>
          <IconBtn title="Toggle output" onClick={() => setOutputOpen((v) => !v)}>
            <PanelBottom size={14} />
          </IconBtn>
          <button
            type="button"
            onClick={() => {
              setOutputOpen(true);
              flash("Workflow compiled");
            }}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-[#2ec4d6] px-3 py-1.5 text-[12px] font-medium text-[#071316] hover:bg-[#53d4e3]"
          >
            <Wand2 size={13} />
            Compile
          </button>
          <button
            type="button"
            onClick={exportAll}
            className="hidden rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-[#d7d1c5] hover:bg-white/5 sm:inline-flex"
          >
            Export all
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette onAdd={(k) => addNode(k)} />

        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(c) => {
              if (c.some((x) => x.type === "remove" || x.type === "position" && "dragging" in x && x.dragging === false)) {
                snapshot();
              }
              onNodesChange(c);
            }}
            onEdgesChange={(c) => {
              if (c.some((x) => x.type === "remove")) snapshot();
              onEdgesChange(c);
            }}
            onConnect={onConnect}
            onSelectionChange={onSelect}
            nodeTypes={nodeTypes}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            fitView
            colorMode="dark"
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: false }}
            connectionLineStyle={{ stroke: "#2ec4d6", strokeWidth: 1.6 }}
            defaultEdgeOptions={{ type: "smoothstep" }}
            minZoom={0.2}
            maxZoom={1.8}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2d35" />
            <Controls
              position="bottom-left"
              className="!overflow-hidden !rounded-xl !border !border-white/10 !bg-[#12141a]/90 !shadow-none"
            />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => KIND_META[(n.data as TaskData).kind]?.color ?? "#888"}
              maskColor="rgba(7,8,11,0.72)"
              className="!overflow-hidden !rounded-xl !border !border-white/10 !bg-[#12141a]/90"
              pannable
              zoomable
            />
          </ReactFlow>

          <div className="pointer-events-none absolute left-4 top-4 max-w-md">
            <div className="rounded-2xl border border-white/8 bg-[#0c0d11]/70 px-3.5 py-2.5 backdrop-blur-md">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/60">Objective</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#d7d1c5]">{meta.objective}</p>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-16 hidden rounded-full border border-white/8 bg-[#0c0d11]/70 px-3 py-1 font-mono text-[10px] text-[#8a8478] backdrop-blur-md md:block">
            drag to add · connect handles · loop back-edge on the pink port · ⌘↵ compile
          </div>
        </div>

        <Inspector
          meta={meta}
          onMeta={(p) => setMeta((m) => ({ ...m, ...p }))}
          node={selectedNode}
          edge={selectedEdge}
          onChangeNode={onChangeNode}
          onChangeEdge={onChangeEdge}
          issues={issues}
          nodes={nodes}
          edges={edges}
          onFocusNode={focusNode}
        />
      </div>

      <OutputPanel open={outputOpen} nodes={nodes} edges={edges} meta={meta} />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importGraph(f);
          e.target.value = "";
        }}
      />

      {guideOpen && <Guide onClose={() => setGuideOpen(false)} />}

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#151820] px-4 py-2 text-[12px] text-[#efeae0] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "loop" | "bad" }) {
  return (
    <span
      className={cn(
        "hidden rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] lg:inline-flex",
        tone === "neutral" && "border-white/10 text-[#9a9488]",
        tone === "ok" && "border-emerald-400/20 text-emerald-200/80",
        tone === "loop" && "border-pink-400/25 text-pink-200/80",
        tone === "bad" && "border-rose-400/25 text-rose-200/85",
      )}
    >
      {children}
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 text-[#c8c2b4] hover:bg-white/5"
    >
      {children}
    </button>
  );
}
