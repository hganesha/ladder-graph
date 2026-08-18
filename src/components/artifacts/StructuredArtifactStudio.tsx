import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { parse } from "yaml";
import { compiler } from "../../compiler/client";
import { ARTIFACT_TEMPLATES } from "../../generated/artifactCatalog";
import { saveArtifactProject } from "../../lib/persistence";
import type { Diagnostic, LadderDocument, Ontology, OntologySliceResult, ProjectRecord, WorkflowBundle } from "../../types";
import { Brand } from "../Brand";
import { ThemeToggle } from "../ThemeToggle";
import { OntologyCanvas } from "./OntologyCanvas";

type StructuredKind = "ontology" | "document";
type ParsedArtifact = Ontology | LadderDocument;
const ONTOLOGY_USAGE = new Map<string, string[]>();
for (const template of ARTIFACT_TEMPLATES) {
  if (template.kind !== "workflow-bundle") continue;
  const bundle = parse(template.yaml) as WorkflowBundle;
  const ontologyRef = bundle.spec.ontology?.ref;
  if (!ontologyRef) continue;
  ONTOLOGY_USAGE.set(ontologyRef, [...(ONTOLOGY_USAGE.get(ontologyRef) ?? []), template.title]);
}

function parseArtifact(source: string, artifactKind: StructuredKind): ParsedArtifact | undefined {
  try {
    const value = parse(source) as ParsedArtifact;
    const expectedKind = artifactKind === "ontology" ? "Ontology" : "Document";
    return value?.kind === expectedKind ? value : undefined;
  } catch {
    return undefined;
  }
}

function titleFor(artifact: ParsedArtifact | undefined, artifactKind: StructuredKind) {
  return artifact?.metadata.title ?? artifact?.metadata.name ?? `Untitled ${artifactKind}`;
}

function ontologyBreakingChanges(previous: Ontology | undefined, current: Ontology | undefined) {
  if (!previous || !current) return [];
  const changes: string[] = [];
  const currentTypes = new Map(current.spec.types.map((type) => [type.id, type]));
  for (const type of previous.spec.types) {
    const next = currentTypes.get(type.id);
    if (!next) {
      changes.push(`Removed type ${type.id}`);
      continue;
    }
    const nextProperties = new Set(next.properties.map((property) => property.id));
    for (const property of type.properties) {
      if (!nextProperties.has(property.id)) changes.push(`Removed property ${property.id}`);
    }
  }
  const currentRelationships = new Set(current.spec.relationships.map((relationship) => relationship.id));
  for (const relationship of previous.spec.relationships) {
    if (!currentRelationships.has(relationship.id)) changes.push(`Removed relationship ${relationship.id}`);
  }
  return changes;
}

export default function StructuredArtifactStudio({
  artifactKind,
  initialProject,
  initialTemplateId,
  onBack,
}: {
  artifactKind: StructuredKind;
  initialProject?: ProjectRecord;
  initialTemplateId?: string;
  onBack: () => void;
}) {
  const template = ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === artifactKind && artifact.id === initialTemplateId);
  const fallback = ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === artifactKind);
  const initialSource = initialProject?.yaml ?? template?.yaml ?? fallback?.yaml ?? "";
  const [source, setSource] = useState(initialSource);
  const [savedSource, setSavedSource] = useState(initialSource);
  const [projectId, setProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(initialProject?.updatedAt ?? null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [validating, setValidating] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [slicePreview, setSlicePreview] = useState<{ seedId: string; result: OntologySliceResult } | undefined>(undefined);
  const [sliceLoading, setSliceLoading] = useState(false);
  const artifact = useMemo(() => parseArtifact(source, artifactKind), [artifactKind, source]);
  const initialOntology = useMemo(() => {
    const initial = parseArtifact(initialSource, artifactKind);
    return initial?.kind === "Ontology" ? initial : undefined;
  }, [artifactKind, initialSource]);
  const label = artifactKind === "ontology" ? "Ontology" : "Document";

  useEffect(() => {
    let active = true;
    setValidating(true);
    const timer = window.setTimeout(() => {
      void compiler
        .analyzeArtifact(source)
        .then((result) => {
          if (!active) return;
          setDiagnostics(result.diagnostics);
          setValidating(false);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setDiagnostics([
            {
              code: "ARTIFACT_ANALYSIS_FAILED",
              severity: "error",
              path: "/",
              message: error instanceof Error ? error.message : "Artifact analysis failed",
            },
          ]);
          setValidating(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [source]);

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const dirty = source !== savedSource;
  const sourceSystem = artifact?.metadata.source?.system;
  const breakingChanges = useMemo(
    () => ontologyBreakingChanges(initialOntology, artifact?.kind === "Ontology" ? artifact : undefined),
    [artifact, initialOntology],
  );

  const documentFields = useMemo(() => {
    if (artifact?.kind !== "Document") return [];
    const normalizedQuery = query.trim().toLowerCase();
    return artifact.spec.fields.filter((field) =>
      !normalizedQuery ? true : `${field.label} ${field.name} ${field.description ?? ""}`.toLowerCase().includes(normalizedQuery),
    );
  }, [artifact, query]);

  const save = async () => {
    if (!artifact || errors.length > 0 || validating) return;
    const project = await saveArtifactProject({
      projectId,
      name: titleFor(artifact, artifactKind),
      yaml: source,
      lastValidYaml: source,
      target: initialProject?.target ?? "codex",
      valid: true,
      artifactKind,
    });
    setProjectId(project.id);
    setSavedSource(source);
    setSavedAt(project.updatedAt);
  };

  const selectedOntologyType =
    artifact?.kind === "Ontology" ? (artifact.spec.types.find((type) => type.id === selectedId) ?? artifact.spec.types[0]) : undefined;
  const selectedDocumentField =
    artifact?.kind === "Document" ? (artifact.spec.fields.find((field) => field.id === selectedId) ?? artifact.spec.fields[0]) : undefined;
  const selectedRelationships =
    artifact?.kind === "Ontology" && selectedOntologyType
      ? artifact.spec.relationships.filter(
          (relationship) => relationship.sourceTypeId === selectedOntologyType.id || relationship.targetTypeId === selectedOntologyType.id,
        )
      : [];
  const selectedRelationship =
    artifact?.kind === "Ontology"
      ? artifact.spec.relationships.find((relationship) => relationship.id === selectedRelationshipId)
      : undefined;
  const ontologyUsage =
    artifact?.kind === "Ontology" ? (ONTOLOGY_USAGE.get(`ladder://ontologies/builtin/${artifact.metadata.name}`) ?? []) : [];
  const previewSliver = async () => {
    if (artifact?.kind !== "Ontology" || !selectedOntologyType) return;
    setSliceLoading(true);
    try {
      setSlicePreview({
        seedId: selectedOntologyType.id,
        result: await compiler.sliceOntology(source, { typeIds: [selectedOntologyType.id] }),
      });
    } finally {
      setSliceLoading(false);
    }
  };

  return (
    <main className="structured-artifact-studio">
      <header className="structured-artifact-header">
        <div>
          <button aria-label="Back" className="icon-button" onClick={onBack} type="button">
            <ArrowLeft size={16} />
          </button>
          <Brand />
          <span className="header-divider" />
          <div className="structured-artifact-title">
            <strong>{titleFor(artifact, artifactKind)}</strong>
            <small>
              Standalone {artifactKind} project{savedAt ? ` · saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
            </small>
          </div>
        </div>
        <div>
          <span className={`artifact-validation-status ${errors.length ? "error" : "valid"}`}>
            {validating ? (
              "Checking…"
            ) : errors.length ? (
              <>
                <AlertTriangle size={13} /> {errors.length} error{errors.length === 1 ? "" : "s"}
              </>
            ) : (
              <>
                <CheckCircle2 size={13} /> Valid {artifactKind}
              </>
            )}
          </span>
          <ThemeToggle compact />
          <button
            className="primary-button"
            disabled={!dirty || validating || errors.length > 0 || !artifact}
            onClick={() => void save()}
            type="button"
          >
            <Save size={14} /> Save {artifactKind}
          </button>
        </div>
      </header>

      <section className={`structured-artifact-layout ${artifactKind === "ontology" ? "ontology-artifact-layout" : ""}`}>
        {artifactKind === "document" ? (
          <aside className="structured-artifact-nav">
            <header>
              <span className="eyebrow">{label} structure</span>
              <strong>
                {artifact?.kind === "Ontology" ? `${artifact.spec.types.length} types` : `${artifact?.spec.fields.length ?? 0} fields`}
              </strong>
            </header>
            <label className="form-search">
              <Search size={13} aria-hidden="true" />
              <input
                aria-label={`Search ${artifactKind}`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${artifactKind}…`}
                value={query}
              />
            </label>
            <div className="structured-artifact-list">
              {documentFields.map((field) => (
                <button
                  className={selectedDocumentField?.id === field.id ? "active" : undefined}
                  key={field.id}
                  onClick={() => setSelectedId(field.id)}
                  type="button"
                >
                  <FileText size={14} />
                  <span>
                    <strong>{field.label}</strong>
                    <small>
                      {field.dataType}
                      {field.required ? " · required" : ""}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="structured-artifact-preview" aria-label={`${label} preview`}>
          <header>
            <span className="eyebrow">{sourceSystem ? `${sourceSystem} source` : "Portable artifact"}</span>
            <h1>{titleFor(artifact, artifactKind)}</h1>
            <p>{artifact?.metadata.description}</p>
          </header>
          {breakingChanges.length > 0 ? (
            <section className="ontology-breaking-change" role="alert">
              <AlertTriangle size={17} />
              <div>
                <strong>Breaking ontology change</strong>
                <p>{breakingChanges.slice(0, 3).join(" · ")}</p>
                <small>Review affected bundles and publish a new ontology version before replacing the saved source.</small>
              </div>
            </section>
          ) : null}
          {artifact?.kind === "Ontology" && selectedOntologyType ? (
            <div className="ontology-visual-workspace">
              <section className="ontology-canvas-panel">
                <header>
                  <div>
                    <strong>Relationship canvas</strong>
                    <small>
                      {artifact.spec.types.length} types · {artifact.spec.relationships.length} relationships
                    </small>
                  </div>
                  <label className="form-search">
                    <Search aria-hidden="true" size={13} />
                    <input
                      aria-label="Search ontology canvas"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find a type…"
                      value={query}
                    />
                  </label>
                </header>
                <OntologyCanvas
                  ontology={artifact}
                  onSelectRelationship={(id) => {
                    const relationship = artifact.spec.relationships.find((candidate) => candidate.id === id);
                    setSelectedRelationshipId(id);
                    if (relationship) setSelectedId(relationship.sourceTypeId);
                  }}
                  onSelectType={(id) => {
                    setSelectedId(id);
                    setSelectedRelationshipId(null);
                  }}
                  query={query}
                  selectedRelationshipId={selectedRelationshipId}
                  selectedTypeId={selectedRelationship ? null : selectedOntologyType.id}
                />
              </section>
              <article className="artifact-detail-card ontology-selection-inspector" aria-label="Ontology selection inspector">
                {selectedRelationship ? (
                  <>
                    <header>
                      <span>Relationship</span>
                      <code>{selectedRelationship.id}</code>
                    </header>
                    <h2>{selectedRelationship.label}</h2>
                    <p>{selectedRelationship.description}</p>
                    <dl className="ontology-relationship-details">
                      <div>
                        <dt>Source type</dt>
                        <dd>{selectedRelationship.sourceTypeId}</dd>
                      </div>
                      <div>
                        <dt>Target type</dt>
                        <dd>{selectedRelationship.targetTypeId}</dd>
                      </div>
                      <div>
                        <dt>Cardinality</dt>
                        <dd>{selectedRelationship.cardinality}</dd>
                      </div>
                      <div>
                        <dt>Required</dt>
                        <dd>{selectedRelationship.required ? "Yes" : "No"}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <header>
                      <span>Entity type</span>
                      <code>{selectedOntologyType.id}</code>
                    </header>
                    <h2>{selectedOntologyType.label}</h2>
                    <p>{selectedOntologyType.description}</p>
                    <div className="artifact-property-grid">
                      {selectedOntologyType.properties.map((property) => (
                        <section key={property.id}>
                          <div>
                            <strong>{property.label}</strong>
                            <code>{property.dataType}</code>
                          </div>
                          <p>{property.description}</p>
                          <small>
                            {property.required ? "Required" : "Optional"}
                            {property.identifier ? " · Identifier" : ""}
                          </small>
                        </section>
                      ))}
                    </div>
                  </>
                )}
                <section className="ontology-impact-panel">
                  <header>
                    <div>
                      <strong>Workflow sliver impact</strong>
                      <small>{ontologyUsage.length ? `Used by ${ontologyUsage.join(", ")}` : "No curated bundle usage"}</small>
                    </div>
                    <button className="quiet-button" disabled={sliceLoading} onClick={() => void previewSliver()} type="button">
                      {sliceLoading ? "Calculating…" : "Preview sliver"}
                    </button>
                  </header>
                  {slicePreview?.seedId === selectedOntologyType.id ? (
                    <div className="ontology-sliver-result">
                      <span>
                        <strong>{slicePreview.result.includedTypeIds.length}</strong> types
                      </span>
                      <span>
                        <strong>{slicePreview.result.includedPropertyRefs.length}</strong> properties
                      </span>
                      <span>
                        <strong>{slicePreview.result.includedRelationshipIds.length}</strong> relationships
                      </span>
                      <p>
                        {Object.entries(slicePreview.result.inclusionReasons)
                          .slice(0, 3)
                          .map(([id, reasons]) => `${id}: ${reasons.join(", ")}`)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : (
                    <p>Selecting a type seeds deterministic dependency closure; the preview explains every included element.</p>
                  )}
                </section>
                <footer>
                  {selectedRelationships.length} connected relationships · {ontologyUsage.length} curated bundle usages
                </footer>
              </article>
            </div>
          ) : null}
          {artifact?.kind === "Document" && selectedDocumentField ? (
            <article className="artifact-detail-card document-detail-card">
              <header>
                <span>{artifact.spec.documentType.replaceAll("_", " ")}</span>
                <code>{selectedDocumentField.dataType}</code>
              </header>
              <h2>{selectedDocumentField.label}</h2>
              <p>{selectedDocumentField.description}</p>
              <dl>
                <div>
                  <dt>Field name</dt>
                  <dd>{selectedDocumentField.name}</dd>
                </div>
                <div>
                  <dt>Requirement</dt>
                  <dd>{selectedDocumentField.required ? "Required" : "Optional"}</dd>
                </div>
                <div>
                  <dt>Ontology</dt>
                  <dd>{selectedDocumentField.ontologyPropertyRef ?? "Not bound"}</dd>
                </div>
                <div>
                  <dt>Source path</dt>
                  <dd>{selectedDocumentField.sourcePath ?? "Native Ladder field"}</dd>
                </div>
              </dl>
              <footer>
                {artifact.spec.sections
                  .filter((section) => section.fieldIds.includes(selectedDocumentField.id))
                  .map((section) => section.title)
                  .join(" · ") || "Unsectioned field"}
              </footer>
            </article>
          ) : null}
        </section>

        <aside className="structured-artifact-source">
          <header>
            <div>
              <span className="eyebrow">Compiler source</span>
              <strong>Portable YAML</strong>
            </div>
            <span>{dirty ? "Unsaved changes" : "Saved"}</span>
          </header>
          <textarea
            aria-label={`${label} YAML source`}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            value={source}
          />
          <section className="structured-diagnostics" aria-label="Compiler diagnostics">
            {diagnostics.length === 0 ? (
              <p>No compiler diagnostics.</p>
            ) : (
              diagnostics.slice(0, 6).map((diagnostic) => (
                <p className={diagnostic.severity} key={`${diagnostic.code}-${diagnostic.path}-${diagnostic.message}`}>
                  <strong>{diagnostic.code}</strong>
                  {diagnostic.message}
                </p>
              ))
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
