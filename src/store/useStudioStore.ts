import { createContext, createElement, type ReactNode, useContext } from "react";
import { parseDocument } from "yaml";
import { createStore, type StoreApi, useStore } from "zustand";
import { compiler } from "../compiler/client";
import { createAgentStarterSource } from "../lib/agentStarter";
import { autoLayout, groupMemberPosition, scaleNodeSpacing } from "../lib/layout";
import { type MacroKind, materializeMacro } from "../lib/macros";
import { defaultNode, ROLE_TEMPLATES } from "../lib/nodeMeta";
import { requestPersistentStorage, saveProject } from "../lib/persistence";
import type { UserTemplateRecord } from "../lib/persistence";
import { BLANK_WORKFLOW, WORKFLOW_TEMPLATES } from "../lib/templates";
import { userAgentTemplate } from "../lib/userCatalogAssets";
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
  openUserTemplate: (template: UserTemplateRecord) => Promise<void>;
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

function editYaml(source: string, edit: (document: ReturnType<typeof parseDocument>) => void) {
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length) throw new Error(document.errors[0].message);
  edit(document);
  return document.toString({ indent: 2, lineWidth: 100 });
}

function patchNodePositions(source: string, workflow: Workflow, positions: Record<string, { x: number; y: number }>) {
  return editYaml(source, (document) => {
    workflow.spec.nodes.forEach((node, index) => {
      const position = positions[node.id];
      if (position) document.setIn(["spec", "nodes", index, "position"], position);
    });
  });
}

function nextEdgeId(edges: LgirEdge[], from: string, to: string) {
  const part = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "node";
  const base = `edge-${part(from)}-${part(to)}`;
  const ids = new Set(edges.map((edge) => edge.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function projectName(source: string) {
  const metadata = parseWorkflow(source)?.metadata;
  return metadata?.title?.trim() || metadata?.name || "untitled-workflow";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function runtimeDiagnostic(code: string, severity: Diagnostic["severity"], message: string): Diagnostic {
  return { code, severity, path: "/", message };
}

function failedAnalysis(error: unknown): AnalysisResult {
  return {
    ok: false,
    sourceHash: "",
    diagnostics: [runtimeDiagnostic("LG900", "error", `Compiler unavailable: ${errorMessage(error)}`)],
    nodeOrder: [],
    stats: { nodes: 0, edges: 0, agents: 0, loops: 0, maxParallelism: 0 },
  };
}

async function analyzeAndPersist(
  runtime: StudioStoreRuntime,
  set: (value: Partial<StudioState>) => void,
  get: () => StudioState,
  source: string,
) {
  const revision = ++runtime.analysisRevision;
  set({ busy: true });
  let analysis: AnalysisResult;
  try {
    analysis = await compiler.analyze(source, get().target);
  } catch (error) {
    if (revision === runtime.analysisRevision) set({ analysis: failedAnalysis(error), busy: false });
    return;
  }
  if (revision !== runtime.analysisRevision) return;
  const valid = Boolean(analysis.normalized);
  const lastValidSource = analysis.ok ? source : get().lastValidSource;
  set({ analysis, lastValidSource, busy: false, runtime: compiler.runtime });
  if (!runtime.persist) return;
  if (runtime.saveTimer) clearTimeout(runtime.saveTimer);
  runtime.saveTimer = setTimeout(async () => {
    try {
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
    } catch (error) {
      const current = get().analysis;
      if (!current) return;
      set({
        analysis: {
          ...current,
          diagnostics: [
            ...current.diagnostics.filter((diagnostic) => diagnostic.code !== "LG901"),
            runtimeDiagnostic("LG901", "warning", `Could not save locally: ${errorMessage(error)}`),
          ],
        },
      });
    }
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
    openUserTemplate: async (template) => {
      const agent = userAgentTemplate(template);
      const rawSource = agent ? createAgentStarterSource(agent) : template.yaml;
      const workflow = parseWorkflow(rawSource);
      const source = workflow ? patchYaml(rawSource, ["spec", "nodes"], autoLayout(workflow.spec.nodes, workflow.spec.edges)) : rawSource;
      set({
        view: "studio",
        projectId: null,
        source,
        lastValidSource: source,
        selectedNodeId: agent ? "agent-1" : null,
        selectedEdgeId: null,
        outputOpen: false,
        compileResult: null,
        nodeSpacing: 1,
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
      try {
        const result = await compiler.compile(get().source, get().target);
        set({ compileResult: result, outputOpen: true, runtime: compiler.runtime });
      } catch (error) {
        const target = get().target;
        set({
          compileResult: {
            ok: false,
            content: "",
            suggestedFilename: "",
            mimeType: "text/plain",
            sourceHash: "",
            compilerVersion: "unavailable",
            adapterVersion: "unavailable",
            capabilityReport: { target, native: [], instructional: [], unsupported: ["compiler unavailable"] },
            diagnostics: [runtimeDiagnostic("LG902", "error", `Compilation failed: ${errorMessage(error)}`)],
          },
          outputOpen: true,
        });
      } finally {
        set({ busy: false });
      }
    },
    format: async () => {
      try {
        const result = await compiler.format(get().source);
        if (result.ok) await get().setSource(result.content);
      } catch (error) {
        set({ analysis: failedAnalysis(error), busy: false });
      }
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
      const source = editYaml(get().source, (document) => {
        Object.entries(patch).forEach(([key, value]) => {
          if (value === undefined) document.deleteIn(["metadata", key]);
          else document.setIn(["metadata", key], value);
        });
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
        const positions: Record<string, { x: number; y: number }> = {};
        workflow.spec.nodes.forEach((node) => {
          const memberIndex = nextGroup.config?.members?.indexOf(node.id) ?? -1;
          if (memberIndex < 0) return;
          const relative = groupMemberPosition(nextGroup, memberIndex);
          positions[node.id] = { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y };
        });
        source = patchNodePositions(source, workflow, positions);
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
      const retainedNodeIds = new Set(next.spec.nodes.map((node) => node.id));
      const retainedEdgeIds = new Set(next.spec.edges.map((edge) => edge.id));
      const source = editYaml(get().source, (document) => {
        workflow.spec.edges
          .map((edge, index) => ({ edge, index }))
          .filter(({ edge }) => !retainedEdgeIds.has(edge.id))
          .reverse()
          .forEach(({ index }) => {
            document.deleteIn(["spec", "edges", index]);
          });
        workflow.spec.nodes
          .map((node, index) => ({ node, index }))
          .filter(({ node }) => !retainedNodeIds.has(node.id))
          .reverse()
          .forEach(({ index }) => {
            document.deleteIn(["spec", "nodes", index]);
          });
      });
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
      let activeGroupMembers: string[] | undefined;
      if (activeGroup) {
        const members = [...(activeGroup.config?.members ?? []), node.id];
        activeGroupMembers = members;
        const relative = groupMemberPosition(activeGroup, members.length - 1);
        const groupPosition = activeGroup.position ?? { x: 0, y: 0 };
        node.position = { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y };
      }
      const source = editYaml(get().source, (document) => {
        if (activeGroup && activeGroupMembers) {
          const groupIndex = workflow.spec.nodes.findIndex((candidate) => candidate.id === activeGroup.id);
          document.setIn(["spec", "nodes", groupIndex, "config", "members"], activeGroupMembers);
        }
        document.addIn(["spec", "nodes"], node);
      });
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
      const source = editYaml(get().source, (document) => document.addIn(["spec", "nodes"], node));
      set({ selectedNodeId: node.id, selectedEdgeId: null });
      await get().setSource(source);
    },
    addMacro: async (macro) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const materialized = materializeMacro(workflow, macro);
      const existingNodeIds = new Set(workflow.spec.nodes.map((node) => node.id));
      const existingEdgeIds = new Set(workflow.spec.edges.map((edge) => edge.id));
      const source = editYaml(get().source, (document) => {
        materialized.nodes
          .filter((node) => !existingNodeIds.has(node.id))
          .forEach((node) => {
            document.addIn(["spec", "nodes"], node);
          });
        materialized.edges
          .filter((edge) => !existingEdgeIds.has(edge.id))
          .forEach((edge) => {
            document.addIn(["spec", "edges"], edge);
          });
      });
      await get().setSource(source);
    },
    connect: async (edge) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const item: LgirEdge = { ...edge, id: nextEdgeId(workflow.spec.edges, edge.from, edge.to) };
      const source = editYaml(get().source, (document) => document.addIn(["spec", "edges"], item));
      set({ selectedEdgeId: item.id, selectedNodeId: null, inspectorOpen: true });
      await get().setSource(source);
    },
    updatePositions: async (positions) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const source = patchNodePositions(get().source, workflow, positions);
      await get().setSource(source, false);
    },
    adjustNodeSpacing: async (direction) => {
      const workflow = parseWorkflow(get().source);
      if (!workflow) return;
      const current = get().nodeSpacing;
      const next = Math.max(0.8, Math.min(1.6, Number((current + direction * 0.2).toFixed(1))));
      if (next === current) return;
      const nodes = scaleNodeSpacing(workflow.spec.nodes, next / current);
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        if (node.position) positions[node.id] = node.position;
      });
      const source = patchNodePositions(get().source, workflow, positions);
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
