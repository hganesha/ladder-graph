import { ChevronDown, FileJson2, FileText, GitFork, PackageOpen, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../../generated/artifactCatalog";
import { bundleAsset } from "../../lib/bundleEditor";
import type { ArtifactTemplateDefinition, WorkflowBundle } from "../../types";

export interface BundleWorkflowChoice {
  id: string;
  ref: string;
  title: string;
  description: string;
}

interface BundleAssetPickerProps {
  bundle: WorkflowBundle;
  assetTemplates: ArtifactTemplateDefinition[];
  onAttach: (template: ArtifactTemplateDefinition) => void;
  onDetach: (ref: string) => void;
  onNew: () => void;
  onRestoreStarter: () => void;
  onUseCuratedBundle: (template: ArtifactTemplateDefinition) => void;
  onOntologyModeChange: (mode: "full" | "sliver") => void;
  starterLabel: string;
  onWorkflowChange: (workflowId: string) => void;
  workflowChoices: BundleWorkflowChoice[];
}

const artifactKinds = ["ontology", "form", "document"] as const;

const kindLabel = {
  ontology: "Ontologies",
  form: "Forms",
  document: "Documents",
};

const kindDescription = {
  ontology: "Semantic types and relationships",
  form: "Structured user-input contracts",
  document: "Supporting document schemas",
};

const kindIcon = {
  ontology: PackageOpen,
  form: FileText,
  document: FileJson2,
};

export function BundleAssetPicker({
  bundle,
  assetTemplates,
  onAttach,
  onDetach,
  onNew,
  onRestoreStarter,
  onUseCuratedBundle,
  onOntologyModeChange,
  starterLabel,
  onWorkflowChange,
  workflowChoices,
}: BundleAssetPickerProps) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [openKind, setOpenKind] = useState<(typeof artifactKinds)[number]>("ontology");
  const attached = new Set([
    bundle.spec.ontology?.ref,
    ...(bundle.spec.forms ?? []).map((asset) => asset.ref),
    ...(bundle.spec.documents ?? []).map((asset) => asset.ref),
  ]);
  const workflowId = workflowChoices.find((choice) => choice.ref === bundle.spec.workflowRef)?.id ?? workflowChoices[0]?.id ?? "";
  const workflow = workflowChoices.find((choice) => choice.id === workflowId) ?? bundleAsset(bundle.spec.workflowRef);
  const recommendedBundle = useMemo(
    () =>
      ARTIFACT_TEMPLATES.filter((template) => template.kind === "workflow-bundle")
        .map((template) => ({ template, bundle: parse(template.yaml) as WorkflowBundle }))
        .find(
          (candidate) =>
            candidate.bundle.spec.workflowRef === bundle.spec.workflowRef && candidate.bundle.metadata.name !== bundle.metadata.name,
        ),
    [bundle.metadata.name, bundle.spec.workflowRef],
  );
  const industries = useMemo(() => [...new Set(assetTemplates.map((template) => template.path.split("/")[0]))].sort(), [assetTemplates]);
  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assetTemplates.filter(
      (template) =>
        (industry === "all" || template.path.startsWith(`${industry}/`)) &&
        (!normalizedQuery || `${template.title} ${template.description} ${template.path}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [assetTemplates, industry, query]);
  const availableKinds = artifactKinds.filter((kind) => filteredTemplates.some((template) => template.kind === kind));
  const visibleOpenKind = availableKinds.includes(openKind) ? openKind : availableKinds[0];

  return (
    <section className="bundle-assets-editor" aria-labelledby="bundle-assets-title">
      <header>
        <div>
          <span className="eyebrow">Bundle assembly</span>
          <h2 id="bundle-assets-title">Attached assets</h2>
        </div>
        <div className="bundle-reset-actions">
          <button className="quiet-button" onClick={onNew} type="button">
            <Plus size={13} /> New
          </button>
          <button aria-label={`Restore ${starterLabel}`} className="quiet-button" onClick={onRestoreStarter} type="button">
            <RotateCcw size={13} /> Curated starter
          </button>
        </div>
      </header>

      <label className="bundle-workflow-select">
        <span>
          <GitFork size={14} /> Workflow
        </span>
        <select aria-label="Workflow" value={workflowId} onChange={(event) => onWorkflowChange(event.target.value)}>
          {workflowChoices.map((choice) => (
            <option key={choice.ref} value={choice.id}>
              {choice.ref.includes("/local/") ? `My library · ${choice.title}` : choice.title}
            </option>
          ))}
        </select>
        <small>{workflow?.description}</small>
      </label>

      {recommendedBundle ? (
        <aside className="bundle-compatibility-card" aria-label="Curated bundle recommendation">
          <span>
            <strong>Curated match: {recommendedBundle.template.title}</strong>
            <small>
              {(recommendedBundle.bundle.spec.forms?.length ?? 0) + (recommendedBundle.bundle.spec.documents?.length ?? 0)} domain assets ·{" "}
              {recommendedBundle.bundle.spec.bindings?.length ?? 0} explicit bindings ·{" "}
              {recommendedBundle.bundle.spec.ontology ? "ontology sliver included" : "ontology optional"}
            </small>
          </span>
          <button className="quiet-button" onClick={() => onUseCuratedBundle(recommendedBundle.template)} type="button">
            Use curated bundle
          </button>
        </aside>
      ) : null}

      <fieldset className="bundle-library-controls">
        <legend className="sr-only">Filter the artifact library</legend>
        <label>
          <Search size={14} aria-hidden="true" />
          <input
            aria-label="Search bundle assets"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search schemas…"
            type="search"
            value={query}
          />
        </label>
        <select aria-label="Asset industry" onChange={(event) => setIndustry(event.target.value)} value={industry}>
          <option value="all">All industries</option>
          {industries.map((value) => (
            <option key={value} value={value}>
              {value === "fs" ? "Financial services" : value === "my-library" ? "My library" : value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <small>{filteredTemplates.length} matching assets</small>
      </fieldset>

      <div className="bundle-asset-accordion">
        {artifactKinds.map((kind) => {
          const Icon = kindIcon[kind];
          const templates = filteredTemplates.filter((template) => template.kind === kind);
          if (templates.length === 0) return null;
          const attachedCount = templates.filter((template) => attached.has(template.ref)).length;
          const isOpen = visibleOpenKind === kind;
          const panelId = `bundle-${kind}-assets`;
          return (
            <section className={isOpen ? "bundle-asset-group open" : "bundle-asset-group"} key={kind}>
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                aria-label={`${kindLabel[kind]}, ${templates.length} available, ${attachedCount} attached`}
                className="bundle-asset-group-trigger"
                onClick={() => setOpenKind(kind)}
                type="button"
              >
                <span className="bundle-asset-kind-icon">
                  <Icon size={17} />
                </span>
                <span className="bundle-asset-kind-copy">
                  <strong>{kindLabel[kind]}</strong>
                  <small>{kindDescription[kind]}</small>
                </span>
                <span className="bundle-asset-kind-metrics">
                  <strong>{attachedCount}</strong>
                  <small>attached</small>
                  <span>{templates.length} available</span>
                </span>
                <ChevronDown aria-hidden="true" className="bundle-asset-chevron" size={16} />
              </button>
              {isOpen ? (
                <section aria-label={`${kindLabel[kind]} library`} className="bundle-asset-group-panel" id={panelId}>
                  {kind === "ontology" && bundle.spec.ontology ? (
                    <div className="bundle-ontology-output-control">
                      <span>
                        <small>Attached ontology</small>
                        <strong>{bundleAsset(bundle.spec.ontology.ref)?.title ?? bundle.spec.ontology.ref}</strong>
                      </span>
                      <fieldset className="ontology-mode-control">
                        <legend>Compiled output</legend>
                        <button
                          className={bundle.spec.ontology.mode === "sliver" ? "active" : undefined}
                          onClick={() => onOntologyModeChange("sliver")}
                          type="button"
                        >
                          Workflow sliver
                        </button>
                        <button
                          className={bundle.spec.ontology.mode === "full" ? "active" : undefined}
                          onClick={() => onOntologyModeChange("full")}
                          type="button"
                        >
                          Full ontology
                        </button>
                      </fieldset>
                    </div>
                  ) : null}
                  <div className="bundle-asset-card-grid">
                    {templates.map((template) => {
                      const isAttached = attached.has(template.ref);
                      return (
                        <article className={isAttached ? "attached" : undefined} key={template.ref}>
                          <span className="bundle-asset-card-icon">
                            <Icon size={16} />
                          </span>
                          <span className="bundle-asset-card-copy">
                            <strong>{template.title}</strong>
                            <small>{template.description}</small>
                            <span className="bundle-asset-card-tags">
                              {isAttached ? <em>Attached</em> : null}
                              {template.ref.includes("/docubricks/") ? <em>DocuBricks · {template.path.split("/")[0]}</em> : null}
                            </span>
                          </span>
                          <button
                            aria-label={`${isAttached ? "Remove" : "Attach"} ${template.title}`}
                            aria-pressed={isAttached}
                            className={isAttached ? "bundle-asset-action danger" : "bundle-asset-action"}
                            onClick={() => (isAttached ? onDetach(template.ref) : onAttach(template))}
                            type="button"
                          >
                            {isAttached ? <Trash2 size={12} /> : <Plus size={12} />}
                            {isAttached ? "Remove" : "Attach"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </section>
          );
        })}
        {filteredTemplates.length === 0 ? (
          <p className="bundle-library-empty">No forms, documents, or ontologies match these filters.</p>
        ) : null}
      </div>
    </section>
  );
}
