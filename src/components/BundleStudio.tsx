import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson2,
  FileText,
  GitFork,
  History,
  PackageOpen,
  Pencil,
  Save,
  ShieldCheck,
  Upload,
  WandSparkles,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { parse, stringify } from "yaml";
import { compiler } from "../compiler/client";
import { ARTIFACT_TEMPLATES } from "../generated/artifactCatalog";
import { WORKFLOW_TEMPLATES } from "../generated/catalog";
import { createBundleArchive, parseBundleArchive } from "../lib/bundleArchive";
import {
  attachBundleArtifact,
  bundleAsset,
  bundleAssetSource,
  createBundleForWorkflow,
  detachBundleArtifact,
  replaceBundleWorkflow,
  resolveBundleAssets,
  updateBundleMetadata,
} from "../lib/bundleEditor";
import { listBundleAssets, listProjects, saveArtifactProject, saveBundleAssets } from "../lib/persistence";
import type {
  ArtifactTemplateDefinition,
  BundleCompileResult,
  CompiledArtifact,
  LadderForm,
  Ontology,
  ProjectRecord,
  Target,
  Workflow,
  WorkflowBundle,
} from "../types";
import { Brand } from "./Brand";
import { BindingInspector } from "./bundle/BindingInspector";
import { BundleAssetPicker } from "./bundle/BundleAssetPicker";
import type { BundleWorkflowChoice } from "./bundle/BundleAssetPicker";
import { BundleHistoryDialog } from "./bundle/BundleHistoryDialog";
import { BundleIdentityEditor } from "./bundle/BundleIdentityEditor";
import { BundleOntologyPreview } from "./bundle/BundleOntologyPreview";
import { BundleWorkflowPreview } from "./bundle/BundleWorkflowPreview";
import { FormPreview } from "./form/FormPreview";
import { ThemeToggle } from "./ThemeToggle";

type WorkspaceTab = "bundle" | "workflow" | "form" | "ontology" | "output";

const BUNDLE_TEMPLATE = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "insurance-claim-review");
const BUNDLE_TEMPLATES = ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind === "workflow-bundle");
const FORM_TEMPLATES = ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind === "form");
const DEFAULT_BUNDLE_SOURCE = BUNDLE_TEMPLATE?.yaml ?? stringify(createBundleForWorkflow(WORKFLOW_TEMPLATES[0]));
const DEFAULT_SOURCE_OVERRIDES = Object.fromEntries(FORM_TEMPLATES.map((artifact) => [artifact.ref, artifact.yaml]));
const FormStudio = lazy(() => import("./form/FormStudio"));

function downloadArtifact(artifact: CompiledArtifact) {
  const url = URL.createObjectURL(new Blob([artifact.content], { type: artifact.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.path.split("/").at(-1) ?? "artifact.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

function OutputBrowser({ result }: { result: BundleCompileResult | null }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selected = result?.artifacts.find((artifact) => artifact.path === selectedPath) ?? result?.artifacts[0];
  if (!result) return <div className="bundle-empty-state">Compile the bundle to inspect its portable files.</div>;
  return (
    <div className="output-browser">
      <nav aria-label="Compiled files">
        {result.artifacts.map((artifact) => (
          <button
            className={artifact.path === selected?.path ? "active" : undefined}
            key={artifact.path}
            onClick={() => setSelectedPath(artifact.path)}
            type="button"
          >
            {artifact.mimeType.includes("json") ? <FileJson2 size={14} /> : <FileText size={14} />}
            <span>{artifact.path}</span>
          </button>
        ))}
      </nav>
      {selected ? (
        <section aria-label={`Preview of ${selected.path}`}>
          <header>
            <div>
              <strong>{selected.path}</strong>
              <small>{selected.mimeType}</small>
            </div>
            <button className="quiet-button" onClick={() => downloadArtifact(selected)} type="button">
              <Download size={14} /> Download
            </button>
          </header>
          <pre>{selected.content}</pre>
        </section>
      ) : null}
    </div>
  );
}

function parsedBundle(source: string) {
  return parse(source) as WorkflowBundle;
}

function firstAttachedFormId(source: string) {
  const firstRef = parsedBundle(source).spec.forms?.[0]?.ref;
  return FORM_TEMPLATES.find((template) => template.ref === firstRef)?.id ?? "";
}

function archiveFilename(source: string) {
  const name = parsedBundle(source)
    .metadata.name.replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
  return `${name || "workflow-bundle"}.ladderbundle.json`;
}

function assetKind(source: string) {
  const kind = (parse(source) as { kind?: string }).kind;
  if (kind === "Workflow" || kind === "Ontology" || kind === "Form" || kind === "Document") return kind;
  throw new Error(`Bundle asset has unsupported kind '${kind ?? "unknown"}'.`);
}

export default function BundleStudio({
  onBack,
  initialProject,
  initialTemplateId,
}: {
  onBack: () => void;
  initialProject?: ProjectRecord;
  initialTemplateId?: string;
}) {
  const starterTemplate = BUNDLE_TEMPLATES.find((template) => template.id === initialTemplateId) ?? BUNDLE_TEMPLATE;
  const starterSource =
    initialTemplateId === "__new__"
      ? stringify(createBundleForWorkflow(WORKFLOW_TEMPLATES[0]))
      : (starterTemplate?.yaml ?? DEFAULT_BUNDLE_SOURCE);
  const initialSource = initialProject?.yaml ?? starterSource;
  const [source, setSource] = useState(initialSource);
  const [target, setTarget] = useState<Target>(initialProject?.target ?? "codex");
  const [result, setResult] = useState<BundleCompileResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("bundle");
  const [formId, setFormId] = useState(() => firstAttachedFormId(initialSource));
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>(() => DEFAULT_SOURCE_OVERRIDES);
  const [editingFormRef, setEditingFormRef] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [lastValidSource, setLastValidSource] = useState(initialProject?.lastValidYaml ?? starterSource);
  const [savedAt, setSavedAt] = useState<number | null>(initialProject?.updatedAt ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [libraryProjects, setLibraryProjects] = useState<ProjectRecord[]>([]);
  const importInput = useRef<HTMLInputElement>(null);
  const compileRevision = useRef(0);
  const bundle = useMemo(() => parsedBundle(source), [source]);
  const workflowChoices = useMemo<BundleWorkflowChoice[]>(
    () => [
      ...WORKFLOW_TEMPLATES.map((template) => ({
        id: template.id,
        ref: `ladder://workflows/builtin/${template.id}`,
        title: template.title,
        description: template.description,
      })),
      ...libraryProjects
        .filter((project) => (project.artifactKind ?? "workflow") === "workflow")
        .flatMap((project) => {
          try {
            const parsed = parse(project.yaml) as Workflow;
            if (parsed.kind !== "Workflow") return [];
            return [
              {
                id: project.id,
                ref: `ladder://workflows/local/${project.id}`,
                title: parsed.metadata?.title ?? project.name,
                description: parsed.metadata?.description ?? "Saved workflow from My library.",
              },
            ];
          } catch {
            return [];
          }
        }),
    ],
    [libraryProjects],
  );
  const availableWorkflowChoices = useMemo<BundleWorkflowChoice[]>(() => {
    if (workflowChoices.some((choice) => choice.ref === bundle.spec.workflowRef)) return workflowChoices;
    const bundledSource = bundleAssetSource(bundle.spec.workflowRef, sourceOverrides);
    if (!bundledSource) return workflowChoices;
    try {
      const attached = parse(bundledSource) as Workflow;
      if (attached.kind !== "Workflow") return workflowChoices;
      return [
        ...workflowChoices,
        {
          id: `attached:${bundle.spec.workflowRef}`,
          ref: bundle.spec.workflowRef,
          title: attached.metadata.title ?? attached.metadata.name,
          description: attached.metadata.description ?? "Workflow carried inside this portable bundle.",
        },
      ];
    } catch {
      return workflowChoices;
    }
  }, [bundle.spec.workflowRef, sourceOverrides, workflowChoices]);
  const localArtifactTemplates = useMemo<ArtifactTemplateDefinition[]>(
    () =>
      libraryProjects.flatMap((project) => {
        if (project.artifactKind !== "ontology" && project.artifactKind !== "form" && project.artifactKind !== "document") return [];
        try {
          const plural = project.artifactKind === "ontology" ? "ontologies" : `${project.artifactKind}s`;
          const parsed = parse(project.yaml) as { metadata?: { description?: string } };
          return [
            {
              id: project.id,
              kind: project.artifactKind,
              path: `my-library/${project.artifactKind}`,
              title: project.name,
              description: parsed.metadata?.description ?? `Saved ${project.artifactKind} from My library.`,
              file: `local:${project.id}`,
              yaml: project.yaml,
              ref: `ladder://${plural}/local/${project.id}`,
            },
          ];
        } catch {
          return [];
        }
      }),
    [libraryProjects],
  );
  const assetTemplates = useMemo(
    () => [...ARTIFACT_TEMPLATES.filter((template) => template.kind !== "workflow-bundle"), ...localArtifactTemplates],
    [localArtifactTemplates],
  );
  const attachedForms = useMemo(
    () =>
      (bundle.spec.forms ?? []).flatMap((attachment) => {
        const template = FORM_TEMPLATES.find((candidate) => candidate.ref === attachment.ref);
        return template ? [template] : [];
      }),
    [bundle],
  );
  const activeFormId = attachedForms.some((template) => template.id === formId) ? formId : (attachedForms[0]?.id ?? "");
  const selectedForm = attachedForms.find((template) => template.id === activeFormId);
  const selectedFormSource = selectedForm ? (sourceOverrides[selectedForm.ref] ?? selectedForm.yaml) : undefined;
  const form = selectedFormSource ? (parse(selectedFormSource) as LadderForm) : null;
  const ontologySource = bundle.spec.ontology ? bundleAssetSource(bundle.spec.ontology.ref, sourceOverrides) : undefined;
  const ontologyOutput = result?.artifacts.find((artifact) => artifact.path.startsWith("ontology/") && artifact.path.endsWith(".yaml"));
  const ontology = ontologyOutput ? (parse(ontologyOutput.content) as Ontology) : null;
  const workflowTitle =
    availableWorkflowChoices.find((choice) => choice.ref === bundle.spec.workflowRef)?.title ?? bundleAsset(bundle.spec.workflowRef)?.title;
  const workflowDefinition = useMemo(() => {
    const workflowSource = bundleAssetSource(bundle.spec.workflowRef, sourceOverrides);
    if (!workflowSource) return null;
    try {
      const parsed = parse(workflowSource) as Workflow;
      return parsed.kind === "Workflow" ? parsed : null;
    } catch {
      return null;
    }
  }, [bundle.spec.workflowRef, sourceOverrides]);
  const sourceByRef = useMemo(
    () => Object.fromEntries(resolveBundleAssets(bundle, sourceOverrides).map((asset) => [asset.ref, asset.source])),
    [bundle, sourceOverrides],
  );

  const compile = async (nextSource = source, nextTarget = target, nextOverrides = sourceOverrides) => {
    const revision = ++compileRevision.current;
    setBusy(true);
    setFailure(null);
    try {
      const nextBundle = parsedBundle(nextSource);
      const compiled = await compiler.compileBundle(nextSource, resolveBundleAssets(nextBundle, nextOverrides), nextTarget);
      if (revision !== compileRevision.current) return;
      setResult(compiled);
      if (compiled.ok) setLastValidSource(nextSource);
      setDirty(false);
      return compiled;
    } catch (error) {
      if (revision !== compileRevision.current) return;
      setResult(null);
      setFailure(error instanceof Error ? error.message : String(error));
      setDirty(false);
      return null;
    } finally {
      if (revision === compileRevision.current) setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void listProjects().then((projects) => {
      if (active) setLibraryProjects(projects);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const revision = ++compileRevision.current;
    const initialSource = initialProject?.yaml ?? starterSource;
    const initialTarget = initialProject?.target ?? "codex";
    void (initialProject ? listBundleAssets(initialProject.id) : Promise.resolve([]))
      .then((records) => {
        const overrides = records.length
          ? Object.fromEntries(records.map((record) => [record.ref, record.source]))
          : DEFAULT_SOURCE_OVERRIDES;
        if (active) setSourceOverrides(overrides);
        return compiler.compileBundle(initialSource, resolveBundleAssets(parsedBundle(initialSource), overrides), initialTarget);
      })
      .then((compiled) => {
        if (active && revision === compileRevision.current) {
          setResult(compiled);
          if (compiled.ok) setLastValidSource(initialSource);
        }
      })
      .catch((error: unknown) => {
        if (active && revision === compileRevision.current) setFailure(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active && revision === compileRevision.current) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [initialProject, starterSource]);

  const restoreArchive = async (body: string) => {
    try {
      const archive = await parseBundleArchive(body);
      const nextOverrides = Object.fromEntries(archive.assets.map((asset) => [asset.ref, asset.source]));
      setSource(archive.bundle.source);
      setTarget(archive.bundle.target);
      setSourceOverrides(nextOverrides);
      setFormId("");
      setTab("bundle");
      setDirty(true);
      await compile(archive.bundle.source, archive.bundle.target, nextOverrides);
      setNotice("Restored the bundle and all attached assets from history.");
    } catch (error) {
      if (!body.trim().startsWith("{")) {
        setSource(body);
        setDirty(true);
        await compile(body, target, sourceOverrides);
        setNotice("Restored a legacy bundle revision.");
        return;
      }
      throw error;
    }
  };

  const saveBundle = async () => {
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const nextBundle = parsedBundle(source);
      const assets = resolveBundleAssets(nextBundle, sourceOverrides);
      const compiled = await compiler.compileBundle(source, assets, target);
      setResult(compiled);
      setDirty(false);
      if (compiled.ok) setLastValidSource(source);
      const archiveBody = await createBundleArchive(source, assets, target);
      const archive = await parseBundleArchive(archiveBody);
      const project = await saveArtifactProject({
        projectId,
        name: nextBundle.metadata.title ?? nextBundle.metadata.name,
        yaml: source,
        lastValidYaml: compiled.ok ? source : lastValidSource,
        target,
        valid: compiled.ok,
        artifactKind: "workflow-bundle",
        revisionBody: archiveBody,
      });
      const now = Date.now();
      await saveBundleAssets(
        project.id,
        archive.assets.map((asset) => ({
          id: `${project.id}:${asset.ref}`,
          projectId: project.id,
          ref: asset.ref,
          kind: assetKind(asset.source),
          source: asset.source,
          sourceHash: asset.sourceHash,
          updatedAt: now,
        })),
      );
      setProjectId(project.id);
      setSavedAt(project.updatedAt);
      setNotice(compiled.ok ? "Bundle saved with a complete portable revision." : "Bundle saved with compiler errors for recovery.");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const exportBundle = async () => {
    setFailure(null);
    try {
      const assets = resolveBundleAssets(parsedBundle(source), sourceOverrides);
      const archive = await createBundleArchive(source, assets, target);
      const url = URL.createObjectURL(new Blob([archive], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = archiveFilename(source);
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Portable bundle archive exported.");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };

  const importBundle = async (file: File) => {
    setBusy(true);
    setFailure(null);
    try {
      const archive = await parseBundleArchive(await file.text());
      setProjectId(null);
      setSavedAt(null);
      await restoreArchive(JSON.stringify(archive));
      setNotice(`Imported ${file.name}. Save to add it to recent projects.`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const applyBundle = (next: WorkflowBundle, compileNow = false, nextOverrides = sourceOverrides) => {
    const nextSource = stringify(next, { lineWidth: 110 });
    setSource(nextSource);
    setDirty(true);
    if (compileNow) void compile(nextSource, target, nextOverrides);
  };

  const setOntologyMode = (mode: "full" | "sliver") => {
    if (!bundle.spec.ontology) return;
    const next = structuredClone(bundle);
    if (next.spec.ontology) next.spec.ontology.mode = mode;
    applyBundle(next, true);
  };

  const restoreStarter = () => {
    const starter = parsedBundle(starterSource);
    setSourceOverrides(DEFAULT_SOURCE_OVERRIDES);
    setFormId(firstAttachedFormId(starterSource));
    setProjectId(null);
    setSavedAt(null);
    setTab("bundle");
    applyBundle(starter, true, DEFAULT_SOURCE_OVERRIDES);
  };

  const useCuratedBundle = (template: ArtifactTemplateDefinition) => {
    const nextSource = template.yaml;
    setSourceOverrides(DEFAULT_SOURCE_OVERRIDES);
    setFormId(firstAttachedFormId(nextSource));
    setProjectId(null);
    setSavedAt(null);
    setTab("bundle");
    applyBundle(parsedBundle(nextSource), true, DEFAULT_SOURCE_OVERRIDES);
  };

  const startNew = () => {
    const choice = availableWorkflowChoices.find((candidate) => candidate.ref === bundle.spec.workflowRef) ?? availableWorkflowChoices[0];
    if (!choice) return;
    const localProject = libraryProjects.find((project) => choice.ref.endsWith(`/${project.id}`));
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === choice.id);
    const workflowSource = localProject?.yaml ?? template?.yaml ?? bundleAssetSource(choice.ref, sourceOverrides);
    if (!workflowSource) return;
    const workflow = parse(workflowSource) as Workflow;
    const nextOverrides = { ...sourceOverrides, [choice.ref]: workflowSource };
    setSourceOverrides(nextOverrides);
    setFormId("");
    setProjectId(null);
    setSavedAt(null);
    setTab("bundle");
    applyBundle(
      createBundleForWorkflow(
        { id: choice.id, title: workflow.metadata.title ?? choice.title, description: workflow.metadata.description ?? choice.description },
        choice.ref,
      ),
      true,
      nextOverrides,
    );
  };

  const errorCount = dirty ? 0 : (result?.diagnostics.filter((item) => item.severity === "error").length ?? 0);
  const warnings = dirty ? [] : (result?.diagnostics.filter((item) => item.severity === "warning") ?? []);
  const generalDiagnostics = dirty ? [] : (result?.diagnostics.filter((item) => !item.path.startsWith("/spec/bindings")) ?? []).slice(0, 8);
  const attachedAssetCount = 1 + (bundle.spec.ontology ? 1 : 0) + (bundle.spec.forms?.length ?? 0) + (bundle.spec.documents?.length ?? 0);
  const ontologyBoundBindings = (bundle.spec.bindings ?? []).filter((binding) => binding.ontologyPropertyRef).length;

  if (editingFormRef) {
    const editingTemplate = FORM_TEMPLATES.find((template) => template.ref === editingFormRef);
    if (editingTemplate) {
      return (
        <Suspense fallback={<div className="workspace-loading">Opening form studio…</div>}>
          <FormStudio
            initialSource={sourceOverrides[editingFormRef] ?? editingTemplate.yaml}
            ontologySource={ontologySource}
            onBack={() => setEditingFormRef(null)}
            onSave={(nextFormSource) => {
              const nextOverrides = { ...sourceOverrides, [editingFormRef]: nextFormSource };
              setSourceOverrides(nextOverrides);
              setEditingFormRef(null);
              void compile(source, target, nextOverrides);
            }}
          />
        </Suspense>
      );
    }
  }

  return (
    <main className="bundle-workspace">
      <header className="bundle-header">
        <div>
          <button className="icon-button" aria-label="Back to workflow gallery" onClick={onBack} type="button">
            <ArrowLeft size={16} />
          </button>
          <Brand compact />
          <span className="header-divider" />
          <div>
            <strong>{bundle.metadata.title}</strong>
            <small>Experimental workflow bundle compiler</small>
          </div>
        </div>
        <div>
          <ThemeToggle compact />
          <input
            accept=".json,.ladderbundle.json,application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBundle(file);
              event.currentTarget.value = "";
            }}
            ref={importInput}
            type="file"
          />
          <button className="quiet-button" onClick={() => importInput.current?.click()} type="button">
            <Upload size={14} /> Import
          </button>
          <button className="quiet-button" onClick={() => void exportBundle()} type="button">
            <Download size={14} /> Export
          </button>
          <button className="quiet-button" disabled={!projectId} onClick={() => setHistoryOpen(true)} type="button">
            <History size={14} /> History
          </button>
          <select
            aria-label="Bundle compile target"
            className="target-select"
            value={target}
            onChange={(event) => {
              const nextTarget = event.target.value as Target;
              setTarget(nextTarget);
              void compile(source, nextTarget);
            }}
          >
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
            <option value="hermes">Hermes Agent</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
          </select>
          <button className="compile-button" disabled={busy} onClick={() => void compile()} type="button">
            <WandSparkles size={15} /> {busy ? "Compiling…" : dirty ? "Validate changes" : "Compile bundle"}
          </button>
          <button className="compile-button bundle-save-button" disabled={busy} onClick={() => void saveBundle()} type="button">
            <Save size={15} /> Save
          </button>
        </div>
      </header>

      <div className="bundle-layout">
        <aside className="bundle-sidebar" aria-label="Bundle summary">
          <div className="bundle-summary">
            <span className="eyebrow">Workflow bundle</span>
            <h1>{bundle.metadata.title}</h1>
            <p>{bundle.metadata.description}</p>
            <div className={errorCount ? "bundle-health error" : dirty ? "bundle-health pending" : "bundle-health"}>
              {errorCount ? <ShieldCheck size={15} /> : dirty ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <span>
                {busy
                  ? "Checking contracts…"
                  : dirty
                    ? "Changes pending validation"
                    : errorCount
                      ? `${errorCount} blocking errors`
                      : `${result?.artifacts.length ?? 0} deterministic files`}
              </span>
            </div>
            {failure ? <p className="bundle-failure">Compiler unavailable: {failure}</p> : null}
            {notice ? <p className="bundle-notice">{notice}</p> : null}
            {savedAt ? <small className="bundle-saved-at">Saved {new Date(savedAt).toLocaleString()}</small> : null}
          </div>
          <ol className="bundle-asset-list">
            <li>
              <GitFork size={15} />
              <span>
                <small>Workflow</small>
                <strong>{workflowTitle ?? bundle.spec.workflowRef}</strong>
              </span>
            </li>
            <li>
              <PackageOpen size={15} />
              <span>
                <small>Ontology</small>
                <strong>
                  {bundle.spec.ontology
                    ? `${bundleAsset(bundle.spec.ontology.ref)?.title ?? bundle.spec.ontology.ref} · ${bundle.spec.ontology.mode}`
                    : "Not attached"}
                </strong>
              </span>
            </li>
            <li>
              <FileText size={15} />
              <span>
                <small>First-class forms</small>
                <strong>{bundle.spec.forms?.length ?? 0} attached</strong>
              </span>
            </li>
            <li>
              <FileJson2 size={15} />
              <span>
                <small>Supporting documents</small>
                <strong>{bundle.spec.documents?.length ?? 0} attached</strong>
              </span>
            </li>
          </ol>
          {bundle.spec.ontology ? (
            <fieldset className="ontology-mode-control">
              <legend>Ontology output</legend>
              <button
                className={bundle.spec.ontology.mode === "sliver" ? "active" : undefined}
                onClick={() => setOntologyMode("sliver")}
                type="button"
              >
                Workflow sliver
              </button>
              <button
                className={bundle.spec.ontology.mode === "full" ? "active" : undefined}
                onClick={() => setOntologyMode("full")}
                type="button"
              >
                Full ontology
              </button>
            </fieldset>
          ) : null}
          <div className="bundle-binding-count">
            <strong>{bundle.spec.bindings?.length ?? 0}</strong>
            <span>explicit bindings</span>
          </div>
        </aside>

        <section className="bundle-main">
          <div className="bundle-tabs" role="tablist" aria-label="Bundle workspace views">
            {(["bundle", "workflow", "form", "ontology", "output"] as const).map((item) => (
              <button
                aria-selected={tab === item}
                className={tab === item ? "active" : undefined}
                key={item}
                onClick={() => setTab(item)}
                role="tab"
                type="button"
              >
                {item === "bundle"
                  ? "Bundle & bindings"
                  : item === "workflow"
                    ? "Workflow graph"
                    : item === "form"
                      ? "Form preview"
                      : item === "ontology"
                        ? "Ontology sliver"
                        : "Compiled output"}
              </button>
            ))}
          </div>
          <div className="bundle-tab-panel" role="tabpanel">
            {tab === "bundle" ? (
              <div className="bundle-builder">
                <BundleIdentityEditor bundle={bundle} onChange={(metadata) => applyBundle(updateBundleMetadata(bundle, metadata))} />
                <BundleAssetPicker
                  assetTemplates={assetTemplates}
                  bundle={bundle}
                  onAttach={(template) => {
                    const nextOverrides = { ...sourceOverrides, [template.ref]: template.yaml };
                    setSourceOverrides(nextOverrides);
                    applyBundle(attachBundleArtifact(bundle, template), true, nextOverrides);
                  }}
                  onDetach={(ref) => applyBundle(detachBundleArtifact(bundle, ref), true)}
                  onNew={startNew}
                  onRestoreStarter={restoreStarter}
                  onUseCuratedBundle={useCuratedBundle}
                  starterLabel={starterTemplate?.title ?? "Curated starter"}
                  onWorkflowChange={(workflowId) => {
                    const choice = availableWorkflowChoices.find((candidate) => candidate.id === workflowId);
                    if (!choice) return;
                    const localProject = libraryProjects.find((project) => choice.ref.endsWith(`/${project.id}`));
                    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === workflowId);
                    const workflowSource = localProject?.yaml ?? template?.yaml ?? bundleAssetSource(choice.ref, sourceOverrides);
                    if (!workflowSource) return;
                    const workflow = parse(workflowSource) as Workflow;
                    const nextOverrides = { ...sourceOverrides, [choice.ref]: workflowSource };
                    setSourceOverrides(nextOverrides);
                    applyBundle(
                      replaceBundleWorkflow(
                        bundle,
                        {
                          id: choice.id,
                          title: workflow.metadata.title ?? choice.title,
                          description: workflow.metadata.description ?? choice.description,
                        },
                        choice.ref,
                      ),
                      true,
                      nextOverrides,
                    );
                  }}
                  workflowChoices={availableWorkflowChoices}
                />
                <BindingInspector
                  bundle={bundle}
                  diagnostics={dirty ? [] : (result?.diagnostics ?? [])}
                  sources={sourceByRef}
                  onChange={(next) => applyBundle(next)}
                />
                <section className="bundle-diagnostics-summary">
                  <h2>Bundle contract</h2>
                  <dl>
                    <div>
                      <dt>Attached assets</dt>
                      <dd>{attachedAssetCount}</dd>
                    </div>
                    <div>
                      <dt>Explicit bindings</dt>
                      <dd>{bundle.spec.bindings?.length ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Semantic bindings</dt>
                      <dd>{ontologyBoundBindings}</dd>
                    </div>
                    <div>
                      <dt>Lockfile assets</dt>
                      <dd>{dirty ? "—" : (result?.lockfile?.assets.length ?? 0)}</dd>
                    </div>
                  </dl>
                  {dirty ? (
                    <p>Validate changes to refresh cross-artifact diagnostics and deterministic output.</p>
                  ) : warnings.length ? (
                    <p>{warnings.length} non-blocking source warnings remain visible in compiled diagnostics.</p>
                  ) : errorCount ? (
                    <p>{errorCount} binding or asset errors must be resolved before portable files can be emitted.</p>
                  ) : (
                    <p>All attached contracts resolve without a blocking mismatch.</p>
                  )}
                  {generalDiagnostics.length ? (
                    <ul className="bundle-diagnostic-list">
                      {generalDiagnostics.map((diagnostic) => (
                        <li className={diagnostic.severity} key={`${diagnostic.code}-${diagnostic.path}-${diagnostic.message}`}>
                          <code>{diagnostic.code}</code>
                          <span>{diagnostic.message}</span>
                          <small>{diagnostic.path}</small>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              </div>
            ) : null}
            {tab === "workflow" ? (
              workflowDefinition ? (
                <BundleWorkflowPreview key={bundle.spec.workflowRef} workflow={workflowDefinition} />
              ) : (
                <div className="bundle-empty-state">The bundled workflow source is unavailable or invalid.</div>
              )
            ) : null}
            {tab === "form" ? (
              attachedForms.length ? (
                <div className="form-workspace">
                  <div className="form-workspace-controls">
                    <label>
                      Preview form
                      <select value={activeFormId} onChange={(event) => setFormId(event.target.value)}>
                        {attachedForms.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="compile-button" onClick={() => selectedForm && setEditingFormRef(selectedForm.ref)} type="button">
                      <Pencil size={14} /> Edit form
                    </button>
                  </div>
                  {form ? <FormPreview form={form} /> : null}
                </div>
              ) : (
                <div className="bundle-empty-state">Attach a form in Bundle &amp; bindings to preview or edit it.</div>
              )
            ) : null}
            {tab === "ontology" ? (
              bundle.spec.ontology ? (
                ontology ? (
                  <BundleOntologyPreview
                    key={`${bundle.spec.ontology.ref}-${bundle.spec.ontology.mode}`}
                    ontology={ontology}
                    title={
                      bundle.spec.ontology.mode === "sliver"
                        ? `${bundleAsset(bundle.spec.ontology.ref)?.title ?? "Ontology"} sliver`
                        : (bundleAsset(bundle.spec.ontology.ref)?.title ?? "Full ontology")
                    }
                  />
                ) : (
                  <div className="bundle-empty-state">Compile to inspect ontology closure.</div>
                )
              ) : (
                <div className="bundle-empty-state">Attach an ontology to inspect full or workflow-specific semantics.</div>
              )
            ) : null}
            {tab === "output" ? <OutputBrowser result={dirty ? null : result} /> : null}
          </div>
        </section>
      </div>
      {historyOpen && projectId ? (
        <BundleHistoryDialog onClose={() => setHistoryOpen(false)} onRestore={restoreArchive} projectId={projectId} />
      ) : null}
    </main>
  );
}
