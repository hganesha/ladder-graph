import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
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
  attachReferencedWorkflowContracts,
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
import type { BundleWorkflowChoice } from "./bundle/BundleAssetPicker";
import { BundleAssetPicker } from "./bundle/BundleAssetPicker";
import { BundleHistoryDialog } from "./bundle/BundleHistoryDialog";
import { BundleIdentityEditor } from "./bundle/BundleIdentityEditor";
import { BundleOntologyPreview } from "./bundle/BundleOntologyPreview";
import { BundleWorkflowPreview } from "./bundle/BundleWorkflowPreview";
import { FormPreview } from "./form/FormPreview";
import { LazyHelpDialog } from "./LazyHelpDialog";
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

function artifactLabel(artifact: CompiledArtifact) {
  const name =
    artifact.path
      .split("/")
      .at(-1)
      ?.replace(/\.(?:schema|ui)\.json$|\.(?:json|yaml|md)$/u, "") ?? "content";
  const title = name
    .replace(/\.(?:codex|claude|hermes)$/u, "")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
  if (artifact.path.startsWith("workflow/")) return "Workflow instructions";
  if (artifact.path.startsWith("forms/") && artifact.path.endsWith(".schema.json")) return `${title} input contract`;
  if (artifact.path.startsWith("forms/") && artifact.path.endsWith(".ui.json")) return `${title} form presentation`;
  if (artifact.path.startsWith("documents/")) return `${title} document contract`;
  if (artifact.path.startsWith("ontology/")) return `${title} ontology context`;
  return title;
}

function OutputBrowser({ result }: { result: BundleCompileResult | null }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const artifacts = useMemo(
    () =>
      (result?.artifacts ?? [])
        .filter(
          (artifact) => artifact.path !== "bundle.yaml" && artifact.path !== "ladder.lock.json" && !artifact.path.endsWith(".reasons.json"),
        )
        .sort((left, right) => {
          const priority = (path: string) => (path.startsWith("workflow/") ? 0 : path.startsWith("forms/") ? 1 : 2);
          return priority(left.path) - priority(right.path) || left.path.localeCompare(right.path);
        }),
    [result],
  );
  const selected = artifacts.find((artifact) => artifact.path === selectedPath) ?? artifacts[0];
  if (!result) return <div className="bundle-empty-state">Compile the bundle to inspect its agent-ready content.</div>;
  if (!artifacts.length) return <div className="bundle-empty-state">No agent-ready content was emitted.</div>;
  return (
    <div className="output-browser">
      <nav aria-label="Agent-ready content">
        {artifacts.map((artifact) => (
          <button
            className={artifact.path === selected?.path ? "active" : undefined}
            key={artifact.path}
            onClick={() => setSelectedPath(artifact.path)}
            type="button"
          >
            {artifact.mimeType.includes("json") ? <FileJson2 size={14} /> : <FileText size={14} />}
            <span>{artifactLabel(artifact)}</span>
          </button>
        ))}
      </nav>
      {selected ? (
        <section aria-label={`Preview of ${artifactLabel(selected)}`}>
          <header>
            <div>
              <strong>{artifactLabel(selected)}</strong>
              <small>Agent-ready content</small>
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

function artifactSlug(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .toLowerCase() || "bundle"
  );
}

function formTemplateFromSource(ref: string, source: string): ArtifactTemplateDefinition | null {
  try {
    const form = parse(source) as LadderForm;
    if (form.kind !== "Form") return null;
    const id = ref.split("/").at(-1) ?? artifactSlug(form.metadata.name);
    return {
      id,
      kind: "form",
      path: "bundle-owned/forms",
      title: form.metadata.title ?? form.metadata.name,
      description: form.metadata.description ?? "Form owned by this portable bundle.",
      file: `bundle:${id}`,
      yaml: source,
      ref,
    };
  } catch {
    return null;
  }
}

function newBundleFormTemplate(bundle: WorkflowBundle, sourceOverrides: Record<string, string>): ArtifactTemplateDefinition {
  const base = `${artifactSlug(bundle.metadata.name)}-form`;
  const attachedRefs = new Set((bundle.spec.forms ?? []).map((attachment) => attachment.ref));
  let sequence = 1;
  let id = base;
  let ref = `ladder://forms/local/${id}`;
  while (attachedRefs.has(ref) || sourceOverrides[ref]) {
    sequence += 1;
    id = `${base}-${sequence}`;
    ref = `ladder://forms/local/${id}`;
  }
  const title = sequence === 1 ? "Untitled form" : `Untitled form ${sequence}`;
  const form: LadderForm = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Form",
    metadata: {
      name: id,
      title,
      description: "Bundle-owned form created from scratch.",
      version: "1.0.0",
      source: { system: "ladder", sourceId: bundle.metadata.name },
    },
    spec: {
      role: "start",
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          sections: [{ id: "section-1", title: "Section 1", fields: [] }],
        },
      ],
    },
  };
  return {
    id,
    kind: "form",
    path: "bundle-owned/forms",
    title,
    description: form.metadata.description ?? "Bundle-owned form.",
    file: `bundle:${id}`,
    yaml: stringify(form, { lineWidth: 110 }),
    ref,
  };
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
  const [helpOpen, setHelpOpen] = useState(false);
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
  const bundleOwnedFormTemplates = useMemo(
    () =>
      (bundle.spec.forms ?? []).flatMap((attachment) => {
        const isKnown = ARTIFACT_TEMPLATES.some((template) => template.ref === attachment.ref);
        if (isKnown || localArtifactTemplates.some((template) => template.ref === attachment.ref)) return [];
        const template = formTemplateFromSource(attachment.ref, sourceOverrides[attachment.ref] ?? "");
        return template ? [template] : [];
      }),
    [bundle.spec.forms, localArtifactTemplates, sourceOverrides],
  );
  const assetTemplates = useMemo(() => {
    const templates = [
      ...ARTIFACT_TEMPLATES.filter((template) => template.kind !== "workflow-bundle"),
      ...localArtifactTemplates,
      ...bundleOwnedFormTemplates,
    ];
    return [...new Map(templates.map((template) => [template.ref, template])).values()];
  }, [bundleOwnedFormTemplates, localArtifactTemplates]);
  const attachedForms = useMemo(
    () =>
      (bundle.spec.forms ?? []).flatMap((attachment) => {
        const template = assetTemplates.find((candidate) => candidate.kind === "form" && candidate.ref === attachment.ref);
        return template ? [template] : [];
      }),
    [assetTemplates, bundle.spec.forms],
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
  const workflowSource = bundleAssetSource(bundle.spec.workflowRef, sourceOverrides);
  const workflowDefinition = useMemo(() => {
    if (!workflowSource) return null;
    try {
      const parsed = parse(workflowSource) as Workflow;
      return parsed.kind === "Workflow" ? parsed : null;
    } catch {
      return null;
    }
  }, [workflowSource]);
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

  const compileFromHeader = async () => {
    const validatingChanges = dirty;
    setNotice(null);
    const compiled = await compile();
    if (!compiled) return;
    const errors = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const warnings = compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    if (validatingChanges) {
      setNotice(
        errors
          ? `Validation completed with ${errors} blocking ${errors === 1 ? "error" : "errors"}.`
          : `Bundle validated: ${compiled.artifacts.length} deterministic files${warnings ? ` and ${warnings} warnings` : ""}.`,
      );
      return;
    }
    setTab("output");
    setNotice(
      errors
        ? `Compilation completed with ${errors} blocking ${errors === 1 ? "error" : "errors"}.`
        : `Bundle compiled: ${compiled.artifacts.length} deterministic files${warnings ? ` and ${warnings} warnings` : ""}.`,
    );
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

  const applyWorkflowSource = (nextWorkflowSource: string) => {
    const nextOverrides = { ...sourceOverrides, [bundle.spec.workflowRef]: nextWorkflowSource };
    let nextBundle = bundle;
    let autoAttached = 0;
    try {
      const nextWorkflow = parse(nextWorkflowSource) as Workflow;
      const reconciled = attachReferencedWorkflowContracts(bundle, nextWorkflow, assetTemplates);
      nextBundle = reconciled.bundle;
      autoAttached = reconciled.attached.length;
      for (const template of reconciled.attached) {
        nextOverrides[template.ref] = template.yaml;
      }
    } catch {
      // The workflow editor owns syntax diagnostics; applying remains possible so the bundle compiler can report them.
    }
    const nextBundleSource = autoAttached ? stringify(nextBundle, { lineWidth: 110 }) : source;
    if (autoAttached) setSource(nextBundleSource);
    setSourceOverrides(nextOverrides);
    setDirty(true);
    setNotice(
      autoAttached
        ? `Workflow changes applied; ${autoAttached} referenced contract${autoAttached === 1 ? " was" : "s were"} added to the bundle.`
        : "Workflow changes applied to this bundle.",
    );
    void compile(nextBundleSource, target, nextOverrides);
  };

  const setOntologyMode = (mode: "full" | "sliver") => {
    if (!bundle.spec.ontology) return;
    const next = structuredClone(bundle);
    if (next.spec.ontology) next.spec.ontology.mode = mode;
    applyBundle(next, true);
  };

  const createBlankForm = () => {
    const template = newBundleFormTemplate(bundle, sourceOverrides);
    const nextOverrides = { ...sourceOverrides, [template.ref]: template.yaml };
    setSourceOverrides(nextOverrides);
    setFormId(template.id);
    setNotice(null);
    applyBundle(attachBundleArtifact(bundle, template), false, nextOverrides);
    setEditingFormRef(template.ref);
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
    const editingTemplate = attachedForms.find((template) => template.ref === editingFormRef);
    const editingSource = sourceOverrides[editingFormRef] ?? editingTemplate?.yaml;
    if (editingSource) {
      return (
        <Suspense fallback={<div className="workspace-loading">Opening form studio…</div>}>
          <FormStudio
            initialSource={editingSource}
            ontologySource={ontologySource}
            onBack={() => {
              setEditingFormRef(null);
              setTab("bundle");
            }}
            onSave={(nextFormSource) => {
              const nextOverrides = { ...sourceOverrides, [editingFormRef]: nextFormSource };
              setSourceOverrides(nextOverrides);
              setEditingFormRef(null);
              setTab("form");
              setNotice("Form changes applied to this bundle.");
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
          <button aria-label="Open bundle help" className="icon-button" onClick={() => setHelpOpen(true)} title="Bundle help" type="button">
            <CircleHelp size={15} aria-hidden="true" />
          </button>
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
          <button className="compile-button" disabled={busy} onClick={() => void compileFromHeader()} type="button">
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
          <div className={tab === "workflow" ? "bundle-tab-panel bundle-tab-panel-workflow" : "bundle-tab-panel"} role="tabpanel">
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
                  onNewForm={createBlankForm}
                  onOntologyModeChange={setOntologyMode}
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
              workflowDefinition && workflowSource ? (
                <BundleWorkflowPreview
                  key={bundle.spec.workflowRef}
                  onApplySource={applyWorkflowSource}
                  source={workflowSource}
                  target={target}
                  workflow={workflowDefinition}
                />
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
      {helpOpen ? <LazyHelpDialog initialTopic="bundle" onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
