import { createContext, createElement, type ReactNode, useContext } from "react";
import { parseDocument } from "yaml";
import { createStore, type StoreApi, useStore } from "zustand";
import { compiler } from "../compiler/client";
import { createAgentStarterSource } from "../lib/agentStarter";
import { autoLayout, groupMemberPosition, scaleNodeSpacing } from "../lib/layout";
import { type MacroKind, materializeMacro } from "../lib/macros";
import { defaultNode, ROLE_TEMPLATES } from "../lib/nodeMeta";
import { requestPersistentStorage, saveProject } from "../lib/persistence";
import { BLANK_WORKFLOW, WORKFLOW_TEMPLATES } from "../lib/templates";
import { deleteWorkflowElements } from "../lib/workflowEditing";
import type { AnalysisResult, CompileResult, Diagnostic, LgirEdge, LgirNode, NodeKind, ProjectRecord, Target, Workflow } from "../types";

type ViewMode = "gallery" | "studio";
type CenterMode = "canvas" | "split" | "source";
type InspectorTab = "basics" | "contracts" | "capabilities" | "advanced";

export interface StudioState {
  view: ViewMode;
  source: string;
  lastValidSource: string;
  projectId: string | null;
  analysis: AnalysisResult | null;
  compileResult: CompileResult | null;
  target: Target;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  centerMode: CenterMode;
  inspectorTab: InspectorTab;
  outputOpen: boolean;
  diagnosticsOpen: boolean;
  paletteOpen: boolean;
  inspectorOpen: boolean;
  nodeSpacing: number;
  busy: boolean;
  runtime: "wasm" | "fallback";
  savedAt: number | null;
  past: string[];
  future: string[];
  setView: (view: ViewMode) => void;
  openTemplate: (id: string) => Promise<void>;
  openAgentTemplate: (id: string) => Promise<void>;
  openBlank: () => Promise<void>;
  openProject: (project: ProjectRecord) => Promise<void>;
  setSource: (source: string, recordHistory?: boolean) => Promise<void>;
  setTarget: (target: Target) => Promise<void>;
  compile: () => Promise<void>;
  format: () => Promise<void>;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setCenterMode: (mode: CenterMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleOutput: (value?: boolean) => void;
  toggleDiagnostics: (value?: boolean) => void;
  togglePalette: () => void;
  toggleInspector: () => void;
  patchWorkflowMetadata: (patch: Partial<Workflow["metadata"]>) => Promise<void>;
  patchNode: (id: string, patch: Partial<LgirNode>) => Promise<void>;
  patchEdge: (id: string, patch: Partial<LgirEdge>) => Promise<void>;
  deleteElements: (nodeIds: string[], edgeIds: string[]) => Promise<void>;
  addNode: (kind: NodeKind) => Promise<void>;
  addRole: (name: string) => Promise<void>;
  addMacro: (macro: MacroKind) => Promise<void>;
  connect: (edge: Omit<LgirEdge, "id">) => Promise<void>;
  updatePositions: (positions: Record<string, { x: number; y: number }>) => Promise<void>;
  adjustNodeSpacing: (direction: -1 | 1) => Promise<void>;
  applyFix: (diagnostic: Diagnostic) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface StudioStoreRuntime {
  analysisRevision: number;
  saveTimer: ReturnType<typeof setTimeout> | null;
  persist: boolean;
}

export interface CreateStudioStoreOptions {
  initialSource?: string;
  initialTarget?: Target;
  persist?: boolean;
}

function parseWorkflow(source: string): Workflow | null {
  try {
    if (/(^|\s)[&*][A-Za-z0-9_-]+/.test(source)) return null;
    const document = parseDocument(source, { uniqueKeys: true, strict: true });
    if (document.errors.length) return null;
    return document.toJS({ maxAliasCount: 50 }) as Workflow;
  } catch {
    return null;
  }
}

function patchYaml(source: string, path: (string | number)[], value: unknown) {
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length) throw new Error(document.errors[0].message);
  document.setIn(path, value);
  return document.toString({ indent: 2, lineWidth: 100 });
}

function projectName(source: string) {
  const metadata = parseWorkflow(source)?.metadata;
  return metadata?.title?.trim() || metadata?.name || "untitled-workflow";
}

async function analyzeAndPersist(
  runtime: StudioStoreRuntime,
  set: (value: Partial<StudioState>) => void,
  get: () => StudioState,
  source: string,
) {
  const revision = ++runtime.analysisRevision;
  set({ busy: true });
  const analysis = await compiler.analyze(source, get().target);
  if (revision !== runtime.analysisRevision) return;
  const valid = Boolean(analysis.normalized);
  const lastValidSource = analysis.ok ? source : get().lastValidSource;
  set({ analysis, lastValidSource, busy: false, runtime: compiler.runtime });
  if (!runtime.persist) return;
  if (runtime.saveTimer) clearTimeout(runtime.saveTimer);
  runtime.saveTimer = setTimeout(async () => {
    const state = get();
    const project = await saveProject(
      state.projectId,
      projectName(state.source),
      state.source,
      state.lastValidSource,
      state.target,
      valid && analysis.ok,
    );
    set({ projectId: project.id, savedAt: project.updatedAt });
    if (!state.projectId) void requestPersistentStorage();
  }, 500);
}

export function createStudioStore(options: CreateStudioStoreOptions = {}): StoreApi<StudioState> {
  const initialSource = options.initialSource ?? BLANK_WORKFLOW;
  const runtime: StudioStoreRuntime = { analysisRevision: 0, saveTimer: null, persist: options.persist ?? true };
  return createStore<StudioState>()((set, get) => ({
    view: options.initialSource ? "studio" : "gallery",
    source: initialSource,
    lastValidSource: initialSource,
    projectId: null,
    analysis: null,
    compileResult: null,
    target: options.initialTarget ?? "codex",
    selectedNodeId: null,
    selectedEdgeId: null,
    centerMode: "canvas",
    inspectorTab: "basics",
    outputOpen: false,
    diagnosticsOpen: false,
    paletteOpen: true,
    inspectorOpen: true,
    nodeSpacing: 1,
    busy: false,
    runtime: "fallback",
    savedAt: null,
    past: [],
    future: [],
    setView: (view) => set({ view }),
    openTemplate: async (id) => {
      const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === id);
      if (!template) return;
      const templateWorkflow = parseWorkflow(template.yaml);
      const source = templateWorkflow
        ? patchYaml(template.yaml, ["spec", "nodes"], autoLayout(templateWorkflow.spec.nodes, templateWorkflow.spec.edges))
        : template.yaml;
      set({
        view: "studio",
        projectId: null,
        source,
        lastValidSource: source,
        selectedNodeId: null,
        selectedEdgeId: null,
        outputOpen: false,
        compileResult: null,
        nodeSpacing: 1,
        past: [],
        future: [],
      });
      await analyzeAndPersist(runtime, set, get, source);
    },
    openAgentTemplate: async (id) => {
      const template = ROLE_TEMPLATES.find((candidate) => candidate.id === id);
      if (!template) return;
      const source = createAgentStarterSource(template);
      set({
        view: "studio",
        projectId: null,
        source,
        lastValidSource: source,
        selectedNodeId: "agent-1",
        selectedEdgeId: null,
        outputOpen: false,
        compileResult: null,
        past: [],
        future: [],
      });
      await analyzeAndPersist(runtime, set, get, source);
    },
    openBlank: async () => {
      set({
        view: "studio",
        projectId: null,
        source: BLANK_WORKFLOW,
        lastValidSource: BLANK_WORKFLOW,
        selectedNodeId: null,
        selectedEdgeId: null,
        outputOpen: false,
        compileResult: null,
        nodeSpacing: 1,
        past: [],
        future: [],
      });
      await analyzeAndPersist(runtime, set, get, BLANK_WORKFLOW);
    },
    openProject: async (project) => {
      set({
        view: "studio",
        projectId: project.id,
        source: project.yaml,
        lastValidSource: project.lastValidYaml,
        target: project.target,
        selectedNodeId: null,
        selectedEdgeId: null,
        outputOpen: false,
        compileResult: null,
        nodeSpacing: 1,
        past: [],
        future: [],
      });
      await analyzeAndPersist(runtime, set, get, project.yaml);
    },
    setSource: async (source, recordHistory = true) => {
      const state = get();
      set({
        source,
        compileResult: null,
        past: recordHistory ? [...state.past.slice(-49), state.source] : state.past,
        future: recordHistory ? [] : state.future,
      });
      await analyzeAndPersist(runtime, set, get, source);
    },
    setTarget: async (target) => {
      set({ target, compileResult: null });
      await analyzeAndPersist(runtime, set, get, get().source);
    },
    compile: async () => {
      set({ busy: true });
      const result = await compiler.compile(get().source, get().target);
      set({ compileResult: result, outputOpen: true, busy: false, runtime: compiler.runtime });
    },
    format: async () => {
      const result = await compiler.format(get().source);
      if (result.ok) await get().setSource(result.content);
    },
    selectNode: (selectedNodeId) => set({ selectedNodeId, selectedEdgeId: null, inspectorOpen: true }),
    selectEdge: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null, inspectorOpen: true }),
    setCenterMode: (centerMode) => set({ centerMode }),
    setInspectorTab: (inspectorTab) => set({ inspectorTab }),
    toggleOutput: (value) => set((state) => ({ outputOpen: value ?? !state.outputOpen })),
    toggleDiagnostics: (value) => set((state) => ({ diagnosticsOpen: value ?? !state.diagnosticsOpen })),
    togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
    toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
    patchWorkflowMetadata: async (patch) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      let source = get().source;
      Object.entries(patch).forEach(([key, value]) => {
        source = patchYaml(source, ["metadata", key], value);
      });
      await get().setSource(source);
    },
    patchNode: async (id, patch) => {
      const workflow = parseWorkflow(get().source);
      const index = workflow?.spec.nodes.findIndex((node) => node.id === id) ?? -1;
      if (!workflow || index < 0) return;
      const document = parseDocument(get().source, { keepSourceTokens: true });
      if (document.errors.length) return;
      Object.entries(patch).forEach(([key, value]) => {
        const path = ["spec", "nodes", index, key];
        if (value === undefined) document.deleteIn(path);
        else document.setIn(path, value);
      });
      let source = document.toString({ indent: 2, lineWidth: 100 });
      const group = workflow.spec.nodes[index];
      if (group?.kind === "group" && patch.config) {
        const nextGroup = { ...group, ...patch, config: { ...group.config, ...patch.config } };
        const groupPosition = group.position ?? { x: 0, y: 0 };
        const nodes = workflow.spec.nodes.map((node) => {
          const memberIndex = nextGroup.config?.members?.indexOf(node.id) ?? -1;
          if (memberIndex < 0) return node.id === id ? nextGroup : node;
          const relative = groupMemberPosition(nextGroup, memberIndex);
          return { ...node, position: { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y } };
        });
        source = patchYaml(source, ["spec", "nodes"], nodes);
      }
      await get().setSource(source);
    },
    patchEdge: async (id, patch) => {
      const workflow = parseWorkflow(get().source);
      const index = workflow?.spec.edges.findIndex((edge) => edge.id === id) ?? -1;
      if (!workflow || index < 0) return;
      const document = parseDocument(get().source, { keepSourceTokens: true });
      if (document.errors.length) return;
      Object.entries(patch).forEach(([key, value]) => {
        const path = ["spec", "edges", index, key];
        if (value === undefined) document.deleteIn(path);
        else document.setIn(path, value);
      });
      await get().setSource(document.toString({ indent: 2, lineWidth: 100 }));
    },
    deleteElements: async (nodeIds, edgeIds) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow || (!nodeIds.length && !edgeIds.length)) return;
      const next = deleteWorkflowElements(workflow, nodeIds, edgeIds);
      let source = patchYaml(get().source, ["spec", "nodes"], next.spec.nodes);
      source = patchYaml(source, ["spec", "edges"], next.spec.edges);
      set({ selectedNodeId: null, selectedEdgeId: null });
      await get().setSource(source);
    },
    addNode: async (kind) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const node = defaultNode(kind, workflow.spec.nodes.length + 1);
      const selected = workflow.spec.nodes.find((candidate) => candidate.id === get().selectedNodeId);
      const activeGroup =
        kind === "group"
          ? undefined
          : selected?.kind === "group"
            ? selected
            : workflow.spec.nodes.find(
                (candidate) => candidate.kind === "group" && candidate.config?.members?.includes(selected?.id ?? ""),
              );
      let nodes = [...workflow.spec.nodes, node];
      if (activeGroup) {
        const members = [...(activeGroup.config?.members ?? []), node.id];
        const relative = groupMemberPosition(activeGroup, members.length - 1);
        const groupPosition = activeGroup.position ?? { x: 0, y: 0 };
        node.position = { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y };
        nodes = nodes.map((candidate) =>
          candidate.id === activeGroup.id ? { ...candidate, config: { ...candidate.config, members } } : candidate,
        );
      }
      const source = patchYaml(get().source, ["spec", "nodes"], nodes);
      set({ selectedNodeId: node.id, selectedEdgeId: null });
      await get().setSource(source);
    },
    addRole: async (name) => {
      const role = ROLE_TEMPLATES.find((candidate) => candidate.name === name);
      const workflow = parseWorkflow(get().source);
      if (!role || !workflow) return;
      const node = defaultNode("agent", workflow.spec.nodes.length + 1);
      node.name = role.name;
      node.role = role.role;
      node.prompt = role.prompt;
      node.capabilities = {
        skills: [...role.skills],
        tools: [...role.tools],
        connectors: [...(role.connectors ?? [])],
        permissions: [...(role.permissions ?? ["read-only"])],
        customizations: {},
      };
      const source = patchYaml(get().source, ["spec", "nodes"], [...workflow.spec.nodes, node]);
      set({ selectedNodeId: node.id, selectedEdgeId: null });
      await get().setSource(source);
    },
    addMacro: async (macro) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const materialized = materializeMacro(workflow, macro);
      let source = patchYaml(get().source, ["spec", "nodes"], materialized.nodes);
      source = patchYaml(source, ["spec", "edges"], materialized.edges);
      await get().setSource(source);
    },
    connect: async (edge) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const item: LgirEdge = { ...edge, id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      const source = patchYaml(get().source, ["spec", "edges"], [...workflow.spec.edges, item]);
      set({ selectedEdgeId: item.id, selectedNodeId: null, inspectorOpen: true });
      await get().setSource(source);
    },
    updatePositions: async (positions) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const nodes = workflow.spec.nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node));
      const source = patchYaml(get().source, ["spec", "nodes"], nodes);
      await get().setSource(source, false);
    },
    adjustNodeSpacing: async (direction) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const current = get().nodeSpacing;
      const next = Math.max(0.8, Math.min(1.6, Number((current + direction * 0.2).toFixed(1))));
      if (next === current) return;
      const nodes = scaleNodeSpacing(workflow.spec.nodes, next / current);
      const source = patchYaml(get().source, ["spec", "nodes"], nodes);
      set({ nodeSpacing: next });
      await get().setSource(source);
    },
    applyFix: async (diagnostic) => {
      if (!diagnostic.fix) return;
      const path = diagnostic.fix.path
        .split("/")
        .filter(Boolean)
        .map((item) => (/^\d+$/.test(item) ? Number(item) : item));
      await get().setSource(patchYaml(get().source, path, diagnostic.fix.value));
    },
    undo: async () => {
      const state = get();
      const previous = state.past.at(-1);
      if (!previous) return;
      set({ source: previous, past: state.past.slice(0, -1), future: [state.source, ...state.future].slice(0, 50) });
      await analyzeAndPersist(runtime, set, get, previous);
    },
    redo: async () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({ source: next, past: [...state.past, state.source].slice(-50), future: state.future.slice(1) });
      await analyzeAndPersist(runtime, set, get, next);
    },
  }));
}

const globalStudioStore = createStudioStore();
const StudioStoreContext = createContext<StoreApi<StudioState> | null>(null);
const identity = (state: StudioState) => state;

type StudioStoreHook = {
  (): StudioState;
  <T>(selector: (state: StudioState) => T): T;
} & StoreApi<StudioState>;

const useSelectedStudioStore = (<T>(selector: (state: StudioState) => T = identity as (state: StudioState) => T) => {
  const store = useContext(StudioStoreContext) ?? globalStudioStore;
  return useStore(store, selector);
}) as StudioStoreHook;

export const useStudioStore = Object.assign(useSelectedStudioStore, globalStudioStore);

export function useStudioStoreApi() {
  return useContext(StudioStoreContext) ?? globalStudioStore;
}

export function StudioStoreProvider({ store, children }: { store: StoreApi<StudioState>; children: ReactNode }) {
  return createElement(StudioStoreContext.Provider, { value: store }, children);
}

export function currentWorkflow(state: Pick<StudioState, "analysis">) {
  return state.analysis?.normalized ?? null;
}
