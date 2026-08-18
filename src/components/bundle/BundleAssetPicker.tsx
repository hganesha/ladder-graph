import { FileJson2, FileText, GitFork, PackageOpen, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
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
  starterLabel,
  onWorkflowChange,
  workflowChoices,
}: BundleAssetPickerProps) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
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

      <div className="bundle-asset-groups">
        {artifactKinds.map((kind) => {
          const Icon = kindIcon[kind];
          const templates = filteredTemplates.filter((template) => template.kind === kind);
          if (templates.length === 0) return null;
          return (
            <fieldset key={kind}>
              <legend>
                {kindLabel[kind]} <span>{templates.length}</span>
              </legend>
              {templates.map((template) => {
                const isAttached = attached.has(template.ref);
                return (
                  <article className={isAttached ? "attached" : undefined} key={template.ref}>
                    <Icon size={15} />
                    <span>
                      <strong>{template.title}</strong>
                      <small>{template.description}</small>
                      {template.ref.includes("/docubricks/") ? <em>DocuBricks · {template.path.split("/")[0]}</em> : null}
                    </span>
                    <button
                      aria-label={`${isAttached ? "Remove" : "Attach"} ${template.title}`}
                      className={isAttached ? "icon-button danger" : "icon-button"}
                      onClick={() => (isAttached ? onDetach(template.ref) : onAttach(template))}
                      type="button"
                    >
                      {isAttached ? <Trash2 size={13} /> : <Plus size={13} />}
                    </button>
                  </article>
                );
              })}
            </fieldset>
          );
        })}
        {filteredTemplates.length === 0 ? (
          <p className="bundle-library-empty">No forms, documents, or ontologies match these filters.</p>
        ) : null}
      </div>
    </section>
  );
}
