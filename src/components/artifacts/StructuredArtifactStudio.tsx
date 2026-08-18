import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText, Plus, Save, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { parse, stringify } from "yaml";
import { compiler } from "../../compiler/client";
import { ARTIFACT_TEMPLATES } from "../../generated/artifactCatalog";
import { downloadText } from "../../lib/download";
import {
  addOntologyProperty,
  addOntologyRelationship,
  addOntologyType,
  createBlankOntology,
  updateOntologyProperty,
  updateOntologyRelationship,
  updateOntologyType,
} from "../../lib/ontologyEditor";
import { ontologyUsage as buildOntologyUsage, usageForType } from "../../lib/ontologyUsage";
import { exportOntologyToOwl } from "../../lib/owlExport";
import { importOwlRdfXml, type OwlImportResult } from "../../lib/owlImport";
import { saveArtifactProject } from "../../lib/persistence";
import { useOntologyStore } from "../../store/useOntologyStore";
import type {
  Diagnostic,
  LadderDocument,
  Ontology,
  OntologyCardinality,
  OntologyDataType,
  OntologySliceResult,
  ProjectRecord,
} from "../../types";
import { Brand } from "../Brand";
import { ThemeToggle } from "../ThemeToggle";
import { OntologyCanvas } from "./OntologyCanvas";
import { OntologyTree } from "./OntologyTree";

type StructuredKind = "ontology" | "document";
type ParsedArtifact = Ontology | LadderDocument;
const ONTOLOGY_DATA_TYPES: OntologyDataType[] = [
  "string",
  "integer",
  "number",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "array",
  "object",
];
const ONTOLOGY_CARDINALITIES: OntologyCardinality[] = ["one-to-one", "one-to-many", "many-to-one", "many-to-many"];
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
  const initialSource =
    initialProject?.yaml ??
    template?.yaml ??
    (artifactKind === "ontology" && initialTemplateId === "__new__" ? stringify(createBlankOntology()) : (fallback?.yaml ?? ""));
  const [source, setSource] = useState(initialSource);
  const [savedSource, setSavedSource] = useState(initialTemplateId === "__new__" && !initialProject ? "" : initialSource);
  const [comparisonSource, setComparisonSource] = useState(initialSource);
  const [projectId, setProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(initialProject?.updatedAt ?? null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [validating, setValidating] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [slicePreview, setSlicePreview] = useState<{ seedId: string; result: OntologySliceResult } | undefined>(undefined);
  const [sliceLoading, setSliceLoading] = useState(false);
  const [owlImport, setOwlImport] = useState<OwlImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const ontologyView = useOntologyStore((state) => state.view);
  const setOntologyView = useOntologyStore((state) => state.setView);
  const reconcileOntologyStore = useOntologyStore((state) => state.reconcile);
  const owlInput = useRef<HTMLInputElement>(null);
  const artifact = useMemo(() => parseArtifact(source, artifactKind), [artifactKind, source]);
  const initialOntology = useMemo(() => {
    const initial = parseArtifact(comparisonSource, artifactKind);
    return initial?.kind === "Ontology" ? initial : undefined;
  }, [artifactKind, comparisonSource]);
  const label = artifactKind === "ontology" ? "Ontology" : "Document";

  useEffect(() => {
    if (artifact?.kind === "Ontology") reconcileOntologyStore(artifact);
  }, [artifact, reconcileOntologyStore]);

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
  const ontologyUsageEntries = useMemo(
    () => (artifact?.kind === "Ontology" ? buildOntologyUsage(artifact, ARTIFACT_TEMPLATES) : []),
    [artifact],
  );
  const selectedTypeUsage = selectedOntologyType ? usageForType(ontologyUsageEntries, selectedOntologyType.id) : [];
  const commitOntology = (next: Ontology, selection: { typeId?: string | null; relationshipId?: string | null } = {}) => {
    setSource(stringify(next, { lineWidth: 110 }));
    if ("typeId" in selection) setSelectedId(selection.typeId ?? null);
    if ("relationshipId" in selection) setSelectedRelationshipId(selection.relationshipId ?? null);
    setSlicePreview(undefined);
  };
  const createType = () => {
    if (artifact?.kind !== "Ontology") return;
    const added = addOntologyType(artifact);
    commitOntology(added.ontology, { typeId: added.typeId, relationshipId: null });
  };
  const createProperty = () => {
    if (artifact?.kind !== "Ontology" || !selectedOntologyType) return;
    const added = addOntologyProperty(artifact, selectedOntologyType.id);
    commitOntology(added.ontology, { typeId: selectedOntologyType.id, relationshipId: null });
  };
  const createRelationship = () => {
    if (artifact?.kind !== "Ontology") return;
    const added = addOntologyRelationship(artifact, selectedOntologyType?.id);
    const relationship = added.ontology.spec.relationships.find((candidate) => candidate.id === added.relationshipId);
    commitOntology(added.ontology, {
      typeId: relationship?.sourceTypeId ?? selectedOntologyType?.id ?? null,
      relationshipId: added.relationshipId,
    });
  };
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

  const startNewOntology = () => {
    const nextSource = stringify(createBlankOntology(), { lineWidth: 110 });
    setSource(nextSource);
    setSavedSource("");
    setComparisonSource(nextSource);
    setProjectId(null);
    setSavedAt(null);
    setSelectedId("entity");
    setSelectedRelationshipId(null);
    setSlicePreview(undefined);
    setOwlImport(null);
    setImportError(null);
  };

  const importOwl = async (file: File) => {
    setImportError(null);
    try {
      const imported = importOwlRdfXml(await file.text(), file.name);
      const nextSource = stringify(imported.ontology, { lineWidth: 110 });
      setSource(nextSource);
      setSavedSource("");
      setComparisonSource(nextSource);
      setProjectId(null);
      setSavedAt(null);
      setSelectedId(imported.ontology.spec.types[0]?.id ?? null);
      setSelectedRelationshipId(null);
      setSlicePreview(undefined);
      setOwlImport(imported);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "OWL import failed.");
    } finally {
      if (owlInput.current) owlInput.current.value = "";
    }
  };

  const exportOwl = () => {
    if (artifact?.kind !== "Ontology" || errors.length > 0 || validating) return;
    const filename = `${artifact.metadata.name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "ontology"}.owl`;
    downloadText(filename, exportOntologyToOwl(artifact), "application/rdf+xml;charset=utf-8");
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
          {artifactKind === "ontology" ? (
            <>
              <input
                accept=".owl,.rdf,.xml,application/rdf+xml,application/xml,text/xml"
                aria-label="OWL file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importOwl(file);
                }}
                ref={owlInput}
                type="file"
              />
              <button className="quiet-button ontology-header-action" onClick={startNewOntology} type="button">
                <Plus size={14} /> New ontology
              </button>
              <button className="quiet-button ontology-header-action" onClick={() => owlInput.current?.click()} type="button">
                <Upload size={14} /> Import OWL
              </button>
              <button
                className="quiet-button ontology-header-action"
                disabled={artifact?.kind !== "Ontology" || validating || errors.length > 0}
                onClick={exportOwl}
                type="button"
              >
                <Download size={14} /> Export OWL
              </button>
            </>
          ) : null}
          <button
            className="primary-button"
            disabled={!dirty || validating || errors.length > 0 || !artifact}
            onClick={() => void save()}
            type="button"
          >
            <Save size={14} /> {artifactKind === "ontology" ? "Save" : `Save ${artifactKind}`}
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
          <header className={artifactKind === "ontology" ? "structured-artifact-accessible-title" : undefined}>
            <span className="eyebrow">{sourceSystem ? `${sourceSystem} source` : "Portable artifact"}</span>
            <h1>{titleFor(artifact, artifactKind)}</h1>
            <p>{artifact?.metadata.description}</p>
          </header>
          {owlImport ? (
            <section className="owl-import-report" aria-label="OWL import report">
              <CheckCircle2 size={16} />
              <div>
                <strong>
                  Imported {owlImport.stats.types} {owlImport.stats.types === 1 ? "type" : "types"}, {owlImport.stats.properties}{" "}
                  {owlImport.stats.properties === 1 ? "property" : "properties"}, and {owlImport.stats.relationships}{" "}
                  {owlImport.stats.relationships === 1 ? "relationship" : "relationships"}
                </strong>
                <p>RDF/XML OWL was normalized into Ladder’s portable ontology contract. The original file is never executed.</p>
                {owlImport.warnings.length ? (
                  <ul>
                    {owlImport.warnings.map((warning) => (
                      <li key={`${warning.code}-${warning.message}`}>
                        <code>{warning.code}</code> {warning.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ) : null}
          {importError ? (
            <section className="owl-import-report error" role="alert">
              <AlertTriangle size={16} />
              <div>
                <strong>OWL import failed</strong>
                <p>{importError}</p>
              </div>
            </section>
          ) : null}
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
          {artifact?.kind === "Ontology" ? (
            <div className="ontology-visual-workspace">
              <section className="ontology-canvas-panel">
                <header>
                  <div>
                    <strong>{ontologyView === "graph" ? "Relationship canvas" : "Type and property tree"}</strong>
                    <small>
                      {artifact.spec.types.length} types · {artifact.spec.relationships.length} relationships
                    </small>
                  </div>
                  <div className="ontology-canvas-actions">
                    <fieldset className="ontology-view-switch">
                      <legend className="sr-only">Ontology view</legend>
                      <button
                        className={ontologyView === "graph" ? "active" : undefined}
                        onClick={() => setOntologyView("graph")}
                        type="button"
                      >
                        Graph
                      </button>
                      <button
                        className={ontologyView === "tree" ? "active" : undefined}
                        onClick={() => setOntologyView("tree")}
                        type="button"
                      >
                        Tree
                      </button>
                    </fieldset>
                    <button className="quiet-button" onClick={createType} type="button">
                      <Plus size={13} /> Add entity
                    </button>
                    <button className="quiet-button" onClick={createRelationship} type="button">
                      <Plus size={13} /> Add relationship
                    </button>
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
                {ontologyView === "graph" ? (
                  <OntologyCanvas
                    ontology={artifact}
                    onConnectTypes={(sourceTypeId, targetTypeId) => {
                      const added = addOntologyRelationship(artifact, sourceTypeId);
                      const next = updateOntologyRelationship(added.ontology, added.relationshipId, { targetTypeId });
                      commitOntology(next, { typeId: sourceTypeId, relationshipId: added.relationshipId });
                    }}
                    onSelectRelationship={(id) => {
                      const relationship = artifact.spec.relationships.find((candidate) => candidate.id === id);
                      setSelectedRelationshipId(id);
                      if (relationship) setSelectedId(relationship.sourceTypeId);
                    }}
                    onSelectType={(id) => {
                      setSelectedId(id);
                      setSelectedRelationshipId(null);
                    }}
                    onUpdateType={(id, patch) =>
                      commitOntology(updateOntologyType(artifact, id, patch), { typeId: id, relationshipId: null })
                    }
                    query={query}
                    selectedRelationshipId={selectedRelationshipId}
                    selectedTypeId={selectedRelationship ? null : (selectedOntologyType?.id ?? null)}
                  />
                ) : (
                  <OntologyTree
                    ontology={artifact}
                    onSelectType={(id) => {
                      setSelectedId(id);
                      setSelectedRelationshipId(null);
                    }}
                    selectedTypeId={selectedOntologyType?.id ?? null}
                  />
                )}
              </section>
              <article className="artifact-detail-card ontology-selection-inspector" aria-label="Ontology selection inspector">
                {selectedRelationship ? (
                  <>
                    <header>
                      <span>Relationship</span>
                      <code>{selectedRelationship.id}</code>
                    </header>
                    <h2>{selectedRelationship.label}</h2>
                    <div className="ontology-editor-fields">
                      <label>
                        Relationship label
                        <input
                          aria-label="Relationship label"
                          onChange={(event) =>
                            commitOntology(updateOntologyRelationship(artifact, selectedRelationship.id, { label: event.target.value }), {
                              relationshipId: selectedRelationship.id,
                            })
                          }
                          value={selectedRelationship.label}
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          aria-label="Relationship description"
                          onChange={(event) =>
                            commitOntology(
                              updateOntologyRelationship(artifact, selectedRelationship.id, { description: event.target.value }),
                              { relationshipId: selectedRelationship.id },
                            )
                          }
                          value={selectedRelationship.description ?? ""}
                        />
                      </label>
                      <div className="ontology-editor-grid">
                        <label>
                          Source entity
                          <select
                            aria-label="Relationship source entity"
                            onChange={(event) =>
                              commitOntology(
                                updateOntologyRelationship(artifact, selectedRelationship.id, { sourceTypeId: event.target.value }),
                                { typeId: event.target.value, relationshipId: selectedRelationship.id },
                              )
                            }
                            value={selectedRelationship.sourceTypeId}
                          >
                            {artifact.spec.types.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Target entity
                          <select
                            aria-label="Relationship target entity"
                            onChange={(event) =>
                              commitOntology(
                                updateOntologyRelationship(artifact, selectedRelationship.id, { targetTypeId: event.target.value }),
                                { relationshipId: selectedRelationship.id },
                              )
                            }
                            value={selectedRelationship.targetTypeId}
                          >
                            {artifact.spec.types.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Cardinality
                          <select
                            aria-label="Relationship cardinality"
                            onChange={(event) =>
                              commitOntology(
                                updateOntologyRelationship(artifact, selectedRelationship.id, {
                                  cardinality: event.target.value as OntologyCardinality,
                                }),
                                { relationshipId: selectedRelationship.id },
                              )
                            }
                            value={selectedRelationship.cardinality}
                          >
                            {ONTOLOGY_CARDINALITIES.map((cardinality) => (
                              <option key={cardinality} value={cardinality}>
                                {cardinality.replaceAll("-", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="ontology-checkbox-field">
                          <input
                            aria-label="Relationship required"
                            checked={Boolean(selectedRelationship.required)}
                            onChange={(event) =>
                              commitOntology(
                                updateOntologyRelationship(artifact, selectedRelationship.id, { required: event.target.checked }),
                                { relationshipId: selectedRelationship.id },
                              )
                            }
                            type="checkbox"
                          />
                          Required relationship
                        </label>
                      </div>
                    </div>
                  </>
                ) : selectedOntologyType ? (
                  <>
                    <header>
                      <span>Entity type</span>
                      <code>{selectedOntologyType.id}</code>
                    </header>
                    <h2>{selectedOntologyType.label}</h2>
                    <div className="ontology-editor-fields">
                      <label>
                        Entity label
                        <input
                          aria-label="Entity label"
                          onChange={(event) =>
                            commitOntology(updateOntologyType(artifact, selectedOntologyType.id, { label: event.target.value }), {
                              typeId: selectedOntologyType.id,
                              relationshipId: null,
                            })
                          }
                          value={selectedOntologyType.label}
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          aria-label="Entity description"
                          onChange={(event) =>
                            commitOntology(updateOntologyType(artifact, selectedOntologyType.id, { description: event.target.value }), {
                              typeId: selectedOntologyType.id,
                              relationshipId: null,
                            })
                          }
                          value={selectedOntologyType.description ?? ""}
                        />
                      </label>
                    </div>
                    <div className="ontology-property-heading">
                      <div>
                        <strong>Attributes</strong>
                        <small>{selectedOntologyType.properties.length} defined</small>
                      </div>
                      <button className="quiet-button" onClick={createProperty} type="button">
                        <Plus size={13} /> Add attribute
                      </button>
                    </div>
                    <div className="artifact-property-grid">
                      {selectedOntologyType.properties.map((property) => (
                        <section key={property.id}>
                          <code>{property.id}</code>
                          <label>
                            Attribute label
                            <input
                              aria-label={`Attribute ${property.id} label`}
                              onChange={(event) =>
                                commitOntology(
                                  updateOntologyProperty(artifact, selectedOntologyType.id, property.id, { label: event.target.value }),
                                  { typeId: selectedOntologyType.id, relationshipId: null },
                                )
                              }
                              value={property.label}
                            />
                          </label>
                          <label>
                            Data type
                            <select
                              aria-label={`Attribute ${property.id} data type`}
                              onChange={(event) =>
                                commitOntology(
                                  updateOntologyProperty(artifact, selectedOntologyType.id, property.id, {
                                    dataType: event.target.value as OntologyDataType,
                                  }),
                                  { typeId: selectedOntologyType.id, relationshipId: null },
                                )
                              }
                              value={property.dataType}
                            >
                              {ONTOLOGY_DATA_TYPES.map((dataType) => (
                                <option key={dataType} value={dataType}>
                                  {dataType}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Description
                            <textarea
                              aria-label={`Attribute ${property.id} description`}
                              onChange={(event) =>
                                commitOntology(
                                  updateOntologyProperty(artifact, selectedOntologyType.id, property.id, {
                                    description: event.target.value,
                                  }),
                                  { typeId: selectedOntologyType.id, relationshipId: null },
                                )
                              }
                              value={property.description ?? ""}
                            />
                          </label>
                          <div className="ontology-property-flags">
                            <label>
                              <input
                                aria-label={`Attribute ${property.id} required`}
                                checked={Boolean(property.required)}
                                onChange={(event) =>
                                  commitOntology(
                                    updateOntologyProperty(artifact, selectedOntologyType.id, property.id, {
                                      required: event.target.checked,
                                    }),
                                    { typeId: selectedOntologyType.id, relationshipId: null },
                                  )
                                }
                                type="checkbox"
                              />
                              Required
                            </label>
                            <label>
                              <input
                                aria-label={`Attribute ${property.id} identifier`}
                                checked={Boolean(property.identifier)}
                                onChange={(event) =>
                                  commitOntology(
                                    updateOntologyProperty(artifact, selectedOntologyType.id, property.id, {
                                      identifier: event.target.checked,
                                    }),
                                    { typeId: selectedOntologyType.id, relationshipId: null },
                                  )
                                }
                                type="checkbox"
                              />
                              Identifier
                            </label>
                          </div>
                        </section>
                      ))}
                      {selectedOntologyType.properties.length === 0 ? (
                        <p className="ontology-property-empty">No attributes yet. Add one to define this entity’s data contract.</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="bundle-empty-state">
                    <p>This ontology has no entities.</p>
                    <button className="primary-button" onClick={createType} type="button">
                      <Plus size={14} /> Add first entity
                    </button>
                  </div>
                )}
                {selectedOntologyType ? (
                  <section className="ontology-impact-panel">
                    <header>
                      <div>
                        <strong>Workflow sliver impact</strong>
                        <small>
                          {selectedTypeUsage.length ? `${selectedTypeUsage.length} workflow and artifact usages` : "No indexed usage"}
                        </small>
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
                    {selectedTypeUsage.length ? (
                      <ul className="ontology-usage-list" aria-label="Ontology type usage">
                        {selectedTypeUsage.map((usage) => (
                          <li key={`${usage.kind}-${usage.id}`}>
                            <span>{usage.kind.replace("workflow-bundle", "bundle")}</span>
                            <strong>{usage.title}</strong>
                            <small>
                              {usage.propertyRefs.filter((reference) => reference.startsWith(`${selectedOntologyType.id}.`)).length}{" "}
                              properties
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ) : null}
                <footer>
                  {selectedRelationships.length} connected relationships · {selectedTypeUsage.length} indexed usages
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
