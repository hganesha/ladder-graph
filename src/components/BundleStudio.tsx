import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson2,
  FileText,
  GitFork,
  PackageOpen,
  Pencil,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { parse, stringify } from "yaml";
import { compiler } from "../compiler/client";
import { ARTIFACT_TEMPLATES, WORKFLOW_TEMPLATES } from "../generated/catalog";
import type { BundleCompileResult, CompiledArtifact, LadderForm, ResolvedBundleAsset, Target, WorkflowBundle } from "../types";
import { Brand } from "./Brand";
import { FormPreview } from "./form/FormPreview";
import { ThemeToggle } from "./ThemeToggle";

type WorkspaceTab = "bundle" | "form" | "ontology" | "output";

const BUNDLE_TEMPLATE = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "insurance-claim-review");
const INSURANCE_WORKFLOW = WORKFLOW_TEMPLATES.find((workflow) => workflow.id === "wf-insr-01");
const FORM_TEMPLATES = ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind === "form");
const FormStudio = lazy(() => import("./form/FormStudio"));
const DEFAULT_FORM_SOURCES = Object.fromEntries(FORM_TEMPLATES.map((artifact) => [artifact.id, artifact.yaml]));
const STATIC_RESOLVED_ASSETS: ResolvedBundleAsset[] = [
  ...(INSURANCE_WORKFLOW ? [{ ref: "ladder://workflows/builtin/wf-insr-01", source: INSURANCE_WORKFLOW.yaml }] : []),
  ...ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind !== "workflow-bundle" && artifact.kind !== "form").map((artifact) => ({
    ref: artifact.ref,
    source: artifact.yaml,
  })),
];

function resolvedAssets(formSources: Record<string, string>): ResolvedBundleAsset[] {
  return [
    ...STATIC_RESOLVED_ASSETS,
    ...FORM_TEMPLATES.map((artifact) => ({ ref: artifact.ref, source: formSources[artifact.id] ?? artifact.yaml })),
  ];
}

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

export default function BundleStudio({ onBack }: { onBack: () => void }) {
  const [source, setSource] = useState(BUNDLE_TEMPLATE?.yaml ?? "");
  const [target, setTarget] = useState<Target>("codex");
  const [result, setResult] = useState<BundleCompileResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("bundle");
  const [formId, setFormId] = useState("first-notice-of-loss");
  const [formSources, setFormSources] = useState<Record<string, string>>(() => DEFAULT_FORM_SOURCES);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const bundle = parse(source) as WorkflowBundle;
  const selectedForm = FORM_TEMPLATES.find((template) => template.id === formId);
  const form = selectedForm ? (parse(formSources[selectedForm.id] ?? selectedForm.yaml) as LadderForm) : null;
  const ontologySource = ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === "ontology")?.yaml;
  const ontologyOutput = result?.artifacts.find((artifact) => artifact.path.endsWith("-sliver.yaml"));
  const ontology = ontologyOutput
    ? (parse(ontologyOutput.content) as {
        spec: { types: Array<{ id: string; label: string; properties: unknown[] }>; relationships: Array<{ id: string; label: string }> };
      })
    : null;

  const compile = async (nextSource = source, nextTarget = target, nextFormSources = formSources) => {
    setBusy(true);
    setFailure(null);
    try {
      setResult(await compiler.compileBundle(nextSource, resolvedAssets(nextFormSources), nextTarget));
    } catch (error) {
      setResult(null);
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void compiler
      .compileBundle(BUNDLE_TEMPLATE?.yaml ?? "", resolvedAssets(DEFAULT_FORM_SOURCES), "codex")
      .then((compiled) => {
        if (active) setResult(compiled);
      })
      .catch((error: unknown) => {
        if (active) setFailure(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setOntologyMode = (mode: "full" | "sliver") => {
    const next = parse(source) as WorkflowBundle;
    if (next.spec.ontology) next.spec.ontology.mode = mode;
    const nextSource = stringify(next, { lineWidth: 110 });
    setSource(nextSource);
    void compile(nextSource);
  };

  const errorCount = result?.diagnostics.filter((item) => item.severity === "error").length ?? 0;
  const warnings = result?.diagnostics.filter((item) => item.severity === "warning") ?? [];

  if (editingFormId) {
    const editingTemplate = FORM_TEMPLATES.find((template) => template.id === editingFormId);
    if (editingTemplate) {
      return (
        <Suspense fallback={<div className="workspace-loading">Opening form studio…</div>}>
          <FormStudio
            initialSource={formSources[editingFormId] ?? editingTemplate.yaml}
            ontologySource={ontologySource}
            onBack={() => setEditingFormId(null)}
            onSave={(nextFormSource) => {
              const nextFormSources = { ...formSources, [editingFormId]: nextFormSource };
              setFormSources(nextFormSources);
              setEditingFormId(null);
              void compile(source, target, nextFormSources);
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
            <WandSparkles size={15} /> {busy ? "Compiling…" : "Compile bundle"}
          </button>
        </div>
      </header>

      <div className="bundle-layout">
        <aside className="bundle-sidebar" aria-label="Bundle assets">
          <div className="bundle-summary">
            <span className="eyebrow">Workflow bundle</span>
            <h1>{bundle.metadata.title}</h1>
            <p>{bundle.metadata.description}</p>
            <div className={errorCount ? "bundle-health error" : "bundle-health"}>
              {errorCount ? <ShieldCheck size={15} /> : <CheckCircle2 size={15} />}
              <span>
                {busy
                  ? "Checking contracts…"
                  : errorCount
                    ? `${errorCount} blocking errors`
                    : `${result?.artifacts.length ?? 0} deterministic files`}
              </span>
            </div>
          </div>
          <ol className="bundle-asset-list">
            <li>
              <GitFork size={15} />
              <span>
                <small>Workflow</small>
                <strong>Blind dual claim review</strong>
              </span>
            </li>
            <li>
              <PackageOpen size={15} />
              <span>
                <small>Ontology from Lattice</small>
                <strong>Insurance · {bundle.spec.ontology?.mode}</strong>
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
                <strong>{bundle.spec.documents?.length ?? 0} contract</strong>
              </span>
            </li>
          </ol>
          <fieldset className="ontology-mode-control">
            <legend>Ontology output</legend>
            <button
              className={bundle.spec.ontology?.mode === "sliver" ? "active" : undefined}
              onClick={() => setOntologyMode("sliver")}
              type="button"
            >
              Workflow sliver
            </button>
            <button
              className={bundle.spec.ontology?.mode === "full" ? "active" : undefined}
              onClick={() => setOntologyMode("full")}
              type="button"
            >
              Full ontology
            </button>
          </fieldset>
          <div className="bundle-binding-count">
            <strong>{bundle.spec.bindings?.length ?? 0}</strong>
            <span>explicit bindings</span>
          </div>
        </aside>

        <section className="bundle-main">
          <div className="bundle-tabs" role="tablist" aria-label="Bundle workspace views">
            {(["bundle", "form", "ontology", "output"] as const).map((item) => (
              <button
                aria-selected={tab === item}
                className={tab === item ? "active" : undefined}
                key={item}
                onClick={() => setTab(item)}
                role="tab"
                type="button"
              >
                {item === "bundle"
                  ? "Bundle map"
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
              <>
                <div className="bundle-map">
                  <div className="bundle-map-node source-node">
                    <small>Start form</small>
                    <strong>First Notice of Loss</strong>
                    <span>11 fields</span>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div className="bundle-map-node workflow-node">
                    <small>Workflow</small>
                    <strong>Blind dual claim review</strong>
                    <span>Independent review + approval</span>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div className="bundle-map-node output-node">
                    <small>Approval form</small>
                    <strong>Claim review decision</strong>
                    <span>5 fields</span>
                  </div>
                  <div className="bundle-map-support">
                    <div>
                      <small>Supporting contract</small>
                      <strong>Insurance claim file</strong>
                    </div>
                    <div>
                      <small>Semantic contract</small>
                      <strong>Insurance ontology {bundle.spec.ontology?.mode}</strong>
                    </div>
                  </div>
                  <section className="bundle-diagnostics-summary">
                    <h2>Cross-artifact contract</h2>
                    <dl>
                      <div>
                        <dt>Workflow inputs bound</dt>
                        <dd>4 / 4</dd>
                      </div>
                      <div>
                        <dt>Attached forms</dt>
                        <dd>2</dd>
                      </div>
                      <div>
                        <dt>Ontology-bound fields</dt>
                        <dd>25</dd>
                      </div>
                      <div>
                        <dt>Lockfile assets</dt>
                        <dd>{result?.lockfile?.assets.length ?? 0}</dd>
                      </div>
                    </dl>
                    {warnings.length ? (
                      <p>{warnings.length} non-blocking source warnings remain visible in compiled diagnostics.</p>
                    ) : (
                      <p>All attached contracts resolve without a blocking mismatch.</p>
                    )}
                  </section>
                </div>
                {failure ? <p className="bundle-failure">Compiler unavailable: {failure}</p> : null}
              </>
            ) : null}
            {tab === "form" ? (
              <div className="form-workspace">
                <div className="form-workspace-controls">
                  <label>
                    Preview form
                    <select value={formId} onChange={(event) => setFormId(event.target.value)}>
                      {FORM_TEMPLATES.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="compile-button" onClick={() => setEditingFormId(formId)} type="button">
                    <Pencil size={14} /> Edit form
                  </button>
                </div>
                {form ? <FormPreview form={form} /> : null}
              </div>
            ) : null}
            {tab === "ontology" ? (
              <div className="ontology-preview">
                <header>
                  <span className="eyebrow">Deterministic closure</span>
                  <h2>{bundle.spec.ontology?.mode === "sliver" ? "Workflow ontology sliver" : "Full insurance ontology"}</h2>
                  <p>Only explicit field and relationship references participate. Prompt text is never used to infer ontology scope.</p>
                </header>
                {ontology ? (
                  <div className="ontology-type-grid">
                    {ontology.spec.types.map((type) => (
                      <article key={type.id}>
                        <small>{type.id}</small>
                        <strong>{type.label}</strong>
                        <span>{type.properties.length} included properties</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="bundle-empty-state">Compile to inspect ontology closure.</div>
                )}
              </div>
            ) : null}
            {tab === "output" ? <OutputBrowser result={result} /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
