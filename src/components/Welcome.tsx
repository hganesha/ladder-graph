import {
  ArrowRight,
  Atom,
  Beaker,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  Cable,
  Calculator,
  ChevronDown,
  CircleHelp,
  Code2,
  Feather,
  FileText,
  HardHat,
  Images,
  Megaphone,
  Music2,
  PackageOpen,
  PenTool,
  Plane,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ARTIFACT_INDEX } from "../generated/catalog";
import { INPUT_CONTRACT_PRESETS } from "../lib/inputContracts";
import { listProjects } from "../lib/persistence";
import { roleSubcategory } from "../lib/roleCategories";
import { ROLE_TEMPLATES, roleTemplatesForSubject } from "../lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../lib/templates";
import { useStudioStore } from "../store/useStudioStore";
import type { InputModality, ProjectRecord } from "../types";
import { Brand } from "./Brand";
import { LazyHelpDialog } from "./LazyHelpDialog";
import { StorageDialog } from "./StorageDialog";
import { ThemeToggle } from "./ThemeToggle";
import { UniversalCatalogSearch } from "./UniversalCatalogSearch";

const DESCRIBED_WORKFLOW_AREAS = [
  { name: "Core patterns", description: "Reusable orchestration shapes for critique and bounded refinement.", icon: Sparkles },
  { name: "Research", description: "Evidence collection, literature synthesis, and research quality gates.", icon: Beaker },
  { name: "Software engineering", description: "Implementation, debugging, testing, architecture, and release risk.", icon: Code2 },
  { name: "Product management", description: "Opportunity framing, feature definition, feasibility, and decisions.", icon: Boxes },
  { name: "Product design", description: "Journey audits, critique, accessibility, redesign, and validation.", icon: PenTool },
  { name: "Go-to-market", description: "Customer urgency, positioning, competitive framing, and launch tests.", icon: Megaphone },
  { name: "Security", description: "Threat modeling, privacy review, mitigations, and readiness gates.", icon: ShieldCheck },
  {
    name: "Multimodal",
    description: "Image, video, speech, music, and transcription routing with cost, safety, and provenance gates.",
    icon: Images,
  },
  {
    name: "Architecture & design",
    description: "Building design, engineering, interiors, compliance, performance, cost, and coordinated delivery.",
    icon: Building2,
  },
  {
    name: "Humanities",
    description: "Philosophy, history, close reading, source criticism, rhetoric, and interdisciplinary inquiry.",
    icon: BookOpen,
  },
  {
    name: "Writing",
    description: "Developmental editing, prose, creative practice, memoir, academic argument, and voice preservation.",
    icon: Feather,
  },
  {
    name: "Personal development",
    description: "Values-aligned goals, behavior design, productivity systems, career discernment, and reflection.",
    icon: Target,
  },
  {
    name: "Mathematics",
    description: "Trigonometry, algebra, optimization, formal proofs, and mathematical visualization.",
    icon: Calculator,
  },
  {
    name: "Music",
    description: "Audio analysis, recommendation, composition, songwriting, arrangement, and orchestration.",
    icon: Music2,
  },
  {
    name: "Physics",
    description: "Problem solving, dimensional checks, simulation, experimental analysis, and model validation.",
    icon: Atom,
  },
  {
    name: "Supply chain & logistics",
    description: "Demand, inventory, supplier risk, logistics exceptions, and S&OP decisions.",
    icon: Boxes,
  },
  {
    name: "HR & talent operations",
    description: "Structured selection, fairness review, workforce capacity, compensation, and onboarding.",
    icon: Target,
  },
  {
    name: "Sales & business development",
    description: "Account research, qualification, outreach, deal review, and competitive positioning.",
    icon: Megaphone,
  },
  {
    name: "Customer success & support",
    description: "Support triage, escalations, knowledge management, churn risk, and customer insight.",
    icon: Target,
  },
  {
    name: "Marketing & growth",
    description: "Campaigns, experiments, discovery, distribution, brand review, and measured lift.",
    icon: Megaphone,
  },
  {
    name: "Accounting, tax & audit",
    description: "Classification, reconciliation, tax research, controls, audit evidence, and disclosure.",
    icon: Calculator,
  },
  {
    name: "Manufacturing & industrial operations",
    description: "Reliability, process quality, line optimization, FMEA, validation, and supplier quality.",
    icon: Building2,
  },
  {
    name: "Energy & utilities",
    description: "Generation forecasts, grid balancing, outage response, asset health, and compliance.",
    icon: Atom,
  },
  {
    name: "Transportation & mobility",
    description: "Fleet operations, networks, dispatch, autonomy safety, transit, and incident response.",
    icon: Boxes,
  },
  {
    name: "Real estate & construction",
    description: "Valuation, permits, estimating, scheduling, contract risk, and building performance.",
    icon: Building2,
  },
  {
    name: "Agriculture & food systems",
    description: "Agronomy, crop monitoring, precision application, traceability, safety, and yield.",
    icon: Beaker,
  },
  {
    name: "Chemistry & materials science",
    description: "Molecular design, synthesis, characterization, scale-up, laboratory safety, and experiments.",
    icon: Beaker,
  },
  {
    name: "Biology & bioinformatics",
    description: "Variant interpretation, pipelines, systems models, protocols, biostatistics, and stewardship.",
    icon: Beaker,
  },
  {
    name: "Environmental & climate science",
    description: "Emissions, climate impact, conservation, compliance, disaster risk, and data quality.",
    icon: Atom,
  },
  {
    name: "Astronomy & space",
    description: "Observation planning, data reduction, trajectories, satellite operations, and instruments.",
    icon: Sparkles,
  },
  {
    name: "Geospatial & earth observation",
    description: "Remote sensing, geospatial data, land use, cartography, validation, and privacy.",
    icon: Images,
  },
  {
    name: "Gaming & interactive media",
    description: "Game systems, NPC behavior, procedural content, narrative, playtesting, and live balance.",
    icon: Sparkles,
  },
  {
    name: "Film, video & post-production",
    description: "Editorial, VFX, colour, sound, finishing, delivery pipelines, and quality control.",
    icon: Images,
  },
  {
    name: "Fashion & textiles",
    description: "Trends, sustainable materials, technical fit, sourcing, merchandising, and compliance.",
    icon: Sparkles,
  },
  {
    name: "Social sciences & policy",
    description: "Surveys, qualitative coding, public opinion, policy impact, ethics, and evidence synthesis.",
    icon: BookOpen,
  },
  {
    name: "Linguistics & language preservation",
    description: "Field documentation, language analysis, corpora, translation, variation, and revitalization.",
    icon: Feather,
  },
  {
    name: "Insurance & underwriting",
    description: "Claims, underwriting, actuarial review, fraud analysis, policy wording, and catastrophe risk.",
    icon: ShieldCheck,
  },
  {
    name: "Event planning & hospitality",
    description: "Venues, vendors, guest experience, production schedules, safety, and budget control.",
    icon: Target,
  },
  {
    name: "Quality assurance & compliance",
    description: "Regulatory change, controls, audit evidence, certification, CAPA, and quality systems.",
    icon: ShieldCheck,
  },
  {
    name: "DevOps & site reliability",
    description: "Incident command, diagnosis, capacity, releases, observability, and postmortems.",
    icon: Code2,
  },
  {
    name: "Robotics & embodied AI",
    description: "Manipulation, coordination, perception, safety, simulation, and deployment readiness.",
    icon: Atom,
  },
  {
    name: "Scientific peer review & publishing",
    description: "Methodology, statistics, reproducibility, citation integrity, and editorial decisions.",
    icon: BookOpen,
  },
  {
    name: "Crisis & emergency management",
    description: "Incident intake, operations, logistics, communications, recovery, and after-action review.",
    icon: ShieldCheck,
  },
  {
    name: "Airline flight operations",
    description: "Dispatch, fuel planning, operational barriers, airworthiness, and ordered release authority.",
    icon: Plane,
  },
  {
    name: "Oil & gas drilling & well operations",
    description: "Well design, anti-collision, control barriers, integrity, permits, and drill-ahead decisions.",
    icon: HardHat,
  },
] as const;

const describedAreaNames = new Set<string>(DESCRIBED_WORKFLOW_AREAS.map((area) => area.name));
export const WORKFLOW_AREAS = [
  ...DESCRIBED_WORKFLOW_AREAS,
  ...[...new Set(WORKFLOW_TEMPLATES.map((template) => template.area))]
    .filter((name) => !describedAreaNames.has(name))
    .map((name) => ({
      name,
      description: `Specialist ${name.toLowerCase()} workflows and reusable agent templates.`,
      icon: Workflow,
    })),
];
export const CATALOG_SEARCH_SUBJECTS = WORKFLOW_AREAS.map(({ name, description }) => ({ name, description }));

type LibraryTab = "workflows" | "agents" | "forms" | "documents" | "ontologies";
type ModalityFilter = "all" | InputModality;
type GalleryView = "starters" | "recent";
const BUNDLE_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "workflow-bundle");
const FORM_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "form");
const DOCUMENT_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "document");
const ONTOLOGY_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "ontology");
const ARTIFACT_INDUSTRY_BY_AREA: Record<string, string> = {
  "Energy & utilities": "energy",
  "Finance & risk": "fs",
  "Clinical & health sciences": "healthcare",
  "Insurance & underwriting": "insurance",
  "Legal & contracts": "legal",
  "Manufacturing & industrial operations": "manufacturing",
  "Real estate & construction": "real_estate",
};

export function Welcome({
  onBlank,
  onBundle = () => undefined,
  onForm = () => undefined,
  onDocument = () => undefined,
  onOntology = () => undefined,
}: {
  onBlank: () => void;
  onBundle?: (project?: ProjectRecord, templateId?: string) => void;
  onForm?: (project?: ProjectRecord, templateId?: string) => void;
  onDocument?: (project?: ProjectRecord, templateId?: string) => void;
  onOntology?: (project?: ProjectRecord, templateId?: string) => void;
}) {
  const openTemplate = useStudioStore((state) => state.openTemplate);
  const openAgentTemplate = useStudioStore((state) => state.openAgentTemplate);
  const openProject = useStudioStore((state) => state.openProject);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeArea, setActiveArea] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("subject");
    return WORKFLOW_AREAS.some((area) => area.name === requested) ? requested! : "Core patterns";
  });
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [activeGalleryView, setActiveGalleryView] = useState<GalleryView>("starters");
  const [activeLibraryTab, setActiveLibraryTab] = useState<LibraryTab>("workflows");
  const [catalogQuery, setCatalogQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");

  const selectedArea = WORKFLOW_AREAS.find((area) => area.name === activeArea) ?? WORKFLOW_AREAS[0];
  const selectedTemplates = WORKFLOW_TEMPLATES.filter(
    (template) => template.area === selectedArea.name && (modality === "all" || template.modalities.includes(modality)),
  );
  const selectedAgents = roleTemplatesForSubject(selectedArea.name).filter(
    (agent) => modality === "all" || agent.modalities.includes(modality),
  );
  const selectedArtifactIndustry = ARTIFACT_INDUSTRY_BY_AREA[selectedArea.name];
  const selectedForms = selectedArtifactIndustry
    ? FORM_TEMPLATES.filter((template) => template.path.startsWith(`${selectedArtifactIndustry}/`))
    : [];
  const selectedDocuments = selectedArtifactIndustry
    ? DOCUMENT_TEMPLATES.filter((template) => template.path.startsWith(`${selectedArtifactIndustry}/`))
    : [];
  const selectedOntologies = selectedArtifactIndustry
    ? ONTOLOGY_TEMPLATES.filter((template) => template.path.startsWith(`${selectedArtifactIndustry}/`))
    : [];
  const SelectedAreaIcon = selectedArea.icon;

  const handleGalleryViewKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextView: GalleryView | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      nextView = activeGalleryView === "starters" ? "recent" : "starters";
    } else if (event.key === "Home") {
      nextView = "starters";
    } else if (event.key === "End") {
      nextView = "recent";
    }
    if (!nextView) return;
    event.preventDefault();
    setActiveGalleryView(nextView);
    requestAnimationFrame(() => document.getElementById(`gallery-tab-${nextView}`)?.focus());
  };

  useEffect(() => {
    let active = true;
    void listProjects().then((records) => {
      if (active) setProjects(records);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>(".catalog-search-inline input")?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const browseSubject = (event: Event) => {
      const subject = (event as CustomEvent<string>).detail;
      if (!WORKFLOW_AREAS.some((area) => area.name === subject)) return;
      setActiveArea(subject);
      setActiveGalleryView("starters");
      setCatalogQuery("");
    };
    window.addEventListener("ladder-browse-subject", browseSubject);
    return () => window.removeEventListener("ladder-browse-subject", browseSubject);
  }, []);

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        <div className="welcome-header-actions">
          <button className="quiet-button" onClick={() => setMcpOpen(true)} type="button" aria-label="Open MCP companion">
            <Cable size={16} aria-hidden="true" />
            <span>MCP</span>
          </button>
          <button aria-label="Intro & help" className="quiet-button welcome-help-button" onClick={() => setHelpOpen(true)} type="button">
            <CircleHelp size={16} aria-hidden="true" />
            <span>Intro &amp; help</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <section
        className={`gallery-section workflow-library ${catalogQuery.trim().length >= 2 ? "search-active" : ""}`}
        aria-labelledby="gallery-title"
      >
        <div className="section-heading library-heading">
          <div>
            <h1 id="gallery-title">Workflow library</h1>
            <p>Start from a proven workflow or agent template, or reopen work saved in this browser.</p>
          </div>
          <div className="library-create-actions" aria-label="Create new project">
            <button aria-label="New workflow" className="quiet-button new-workflow-button" onClick={onBlank} type="button">
              <Workflow size={15} aria-hidden="true" /> <span>New workflow</span>
            </button>
            <button aria-label="New bundle" className="quiet-button" onClick={() => onBundle(undefined, "__new__")} type="button">
              <PackageOpen size={15} aria-hidden="true" /> <span>New bundle</span>
            </button>
            <button aria-label="New ontology" className="quiet-button" onClick={() => onOntology(undefined, "__new__")} type="button">
              <Boxes size={15} aria-hidden="true" /> <span>New ontology</span>
            </button>
          </div>
        </div>
        <UniversalCatalogSearch
          onBrowseSubject={(subject) => {
            setActiveArea(subject);
            setActiveGalleryView("starters");
          }}
          onCreateWithAgent={openAgentTemplate}
          onInspectDocument={(templateId) => onDocument(undefined, templateId)}
          onOpenForm={(templateId) => onForm(undefined, templateId)}
          onOpenWorkflow={openTemplate}
          onQueryChange={setCatalogQuery}
          query={catalogQuery}
          subjects={CATALOG_SEARCH_SUBJECTS}
        />
        <div className="gallery-view-tabs" role="tablist" aria-label="Workflow library view">
          <button
            aria-controls="gallery-panel-starters"
            aria-label="Starter workflows"
            aria-selected={activeGalleryView === "starters"}
            className={activeGalleryView === "starters" ? "active" : undefined}
            id="gallery-tab-starters"
            onClick={() => setActiveGalleryView("starters")}
            onKeyDown={handleGalleryViewKeyDown}
            role="tab"
            tabIndex={activeGalleryView === "starters" ? 0 : -1}
            type="button"
          >
            Starter workflows <small>{WORKFLOW_TEMPLATES.length + ROLE_TEMPLATES.length}</small>
          </button>
          <button
            aria-controls="gallery-panel-recent"
            aria-label="Recent projects"
            aria-selected={activeGalleryView === "recent"}
            className={activeGalleryView === "recent" ? "active" : undefined}
            id="gallery-tab-recent"
            onClick={() => setActiveGalleryView("recent")}
            onKeyDown={handleGalleryViewKeyDown}
            role="tab"
            tabIndex={activeGalleryView === "recent" ? 0 : -1}
            type="button"
          >
            Recent projects <small>{projects.length}</small>
          </button>
        </div>

        {activeGalleryView === "starters" ? (
          <section aria-labelledby="gallery-tab-starters" className="gallery-view-panel" id="gallery-panel-starters" role="tabpanel">
            <fieldset className="library-controls">
              <legend className="sr-only">Starter workflow filters</legend>
              <label className="subject-area-control">
                <span className="eyebrow">Subject area</span>
                <span className="subject-area-select">
                  <SelectedAreaIcon size={15} aria-hidden="true" />
                  <select aria-label="Subject area" value={activeArea} onChange={(event) => setActiveArea(event.target.value)}>
                    {WORKFLOW_AREAS.map((area) => (
                      <option key={area.name} value={area.name}>
                        {area.name} (
                        {WORKFLOW_TEMPLATES.filter((template) => template.area === area.name).length +
                          roleTemplatesForSubject(area.name).length}
                        )
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </span>
              </label>
              <div className="starting-point-control">
                <span className="eyebrow">Starting point</span>
                <div className="library-tabs" role="tablist" aria-label="Starting point type">
                  <button
                    aria-label="Workflows"
                    aria-controls="library-panel"
                    aria-selected={activeLibraryTab === "workflows"}
                    className={activeLibraryTab === "workflows" ? "active" : undefined}
                    id="library-tab-workflows"
                    onClick={() => setActiveLibraryTab("workflows")}
                    role="tab"
                    tabIndex={activeLibraryTab === "workflows" ? 0 : -1}
                    type="button"
                  >
                    <Workflow size={15} aria-hidden="true" /> Workflows <small>{selectedTemplates.length}</small>
                  </button>
                  <button
                    aria-label="Forms"
                    aria-controls="library-panel"
                    aria-selected={activeLibraryTab === "forms"}
                    className={activeLibraryTab === "forms" ? "active" : undefined}
                    id="library-tab-forms"
                    onClick={() => setActiveLibraryTab("forms")}
                    role="tab"
                    tabIndex={activeLibraryTab === "forms" ? 0 : -1}
                    type="button"
                  >
                    <FileText size={15} aria-hidden="true" /> Forms <small>{selectedForms.length}</small>
                  </button>
                  <button
                    aria-label="Documents"
                    aria-controls="library-panel"
                    aria-selected={activeLibraryTab === "documents"}
                    className={activeLibraryTab === "documents" ? "active" : undefined}
                    id="library-tab-documents"
                    onClick={() => setActiveLibraryTab("documents")}
                    role="tab"
                    tabIndex={activeLibraryTab === "documents" ? 0 : -1}
                    type="button"
                  >
                    <BookOpen size={15} aria-hidden="true" /> Documents <small>{selectedDocuments.length}</small>
                  </button>
                  <button
                    aria-label="Ontologies"
                    aria-controls="library-panel"
                    aria-selected={activeLibraryTab === "ontologies"}
                    className={activeLibraryTab === "ontologies" ? "active" : undefined}
                    id="library-tab-ontologies"
                    onClick={() => setActiveLibraryTab("ontologies")}
                    role="tab"
                    tabIndex={activeLibraryTab === "ontologies" ? 0 : -1}
                    type="button"
                  >
                    <Boxes size={15} aria-hidden="true" /> Ontologies <small>{selectedOntologies.length}</small>
                  </button>
                  <button
                    aria-label="Agents"
                    aria-controls="library-panel"
                    aria-selected={activeLibraryTab === "agents"}
                    className={activeLibraryTab === "agents" ? "active" : undefined}
                    id="library-tab-agents"
                    onClick={() => setActiveLibraryTab("agents")}
                    role="tab"
                    tabIndex={activeLibraryTab === "agents" ? 0 : -1}
                    type="button"
                  >
                    <Bot size={15} aria-hidden="true" /> Agents <small>{selectedAgents.length}</small>
                  </button>
                </div>
              </div>
              <label className="modality-filter">
                <span className="eyebrow">Modality</span>
                <select
                  aria-label="Filter by modality"
                  value={modality}
                  onChange={(event) => setModality(event.target.value as ModalityFilter)}
                >
                  <option value="all">All modalities</option>
                  {INPUT_CONTRACT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <section aria-labelledby={`library-tab-${activeLibraryTab}`} className="workflow-tab-panel" id="library-panel" role="tabpanel">
              <div className="workflow-group-heading">
                <span aria-hidden="true">
                  <SelectedAreaIcon size={17} />
                </span>
                <div>
                  <h2>{selectedArea.name}</h2>
                  <p>{selectedArea.description}</p>
                </div>
              </div>
              {activeLibraryTab === "workflows" ? (
                <>
                  <div className="template-grid tabbed-template-grid">
                    {selectedTemplates.map((template) => (
                      <button
                        aria-label={`Open ${template.title} in studio`}
                        className="template-card"
                        key={template.id}
                        onClick={() => void openTemplate(template.id)}
                        style={{ "--accent": template.accent } as React.CSSProperties}
                      >
                        <div className="topology-art" aria-hidden="true">
                          <SelectedAreaIcon />
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="template-meta">
                          <span>{template.eyebrow}</span>
                          <span>{template.topology}</span>
                        </div>
                        <h3>{template.title}</h3>
                        <p>{template.description}</p>
                        <strong>
                          Open in studio <ArrowRight size={14} />
                        </strong>
                      </button>
                    ))}
                    {selectedTemplates.length === 0 && <p className="library-empty">No workflows match this modality.</p>}
                  </div>
                  <section className="curated-bundles" aria-labelledby="curated-bundles-title">
                    <header>
                      <div>
                        <span className="eyebrow">Portable solution contracts</span>
                        <h3 id="curated-bundles-title">Curated workflow bundles</h3>
                      </div>
                      <span>{BUNDLE_TEMPLATES.length} bundles</span>
                    </header>
                    <div className="bundle-launch-grid">
                      {BUNDLE_TEMPLATES.map((template) => (
                        <button
                          aria-label={`Open ${template.title}`}
                          className="bundle-launch-card"
                          key={template.id}
                          onClick={() => onBundle(undefined, template.id)}
                          type="button"
                        >
                          <span className="bundle-launch-icon" aria-hidden="true">
                            <PackageOpen size={22} />
                          </span>
                          <span>
                            <small>{template.path.split("/")[0].replaceAll("_", " ")} · curated bundle</small>
                            <strong>{template.title}</strong>
                            <span>{template.description}</span>
                          </span>
                          <span className="bundle-launch-action">
                            Open <ArrowRight size={15} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : activeLibraryTab === "agents" ? (
                <div className="template-grid tabbed-template-grid agent-template-grid">
                  {selectedAgents.map((agent) => (
                    <button
                      aria-label={`Start workflow with ${agent.name}`}
                      className="template-card agent-template-card"
                      key={agent.id}
                      onClick={() => void openAgentTemplate(agent.id)}
                      style={{ "--accent": "#e86b5d" } as React.CSSProperties}
                    >
                      <div className="agent-card-icon" aria-hidden="true">
                        <Bot />
                      </div>
                      <div className="template-meta">
                        <span>{roleSubcategory(agent)}</span>
                        <span>{agent.skills.length} skills</span>
                      </div>
                      <h3>{agent.name}</h3>
                      <p>{agent.role}</p>
                      <div className="agent-skill-list" aria-hidden="true">
                        {agent.skills.slice(0, 3).map((skill) => (
                          <span key={skill}>{skill}</span>
                        ))}
                      </div>
                      <strong>
                        Create workflow <ArrowRight size={14} />
                      </strong>
                    </button>
                  ))}
                  {selectedAgents.length === 0 && <p className="library-empty">No agents match this modality.</p>}
                </div>
              ) : activeLibraryTab === "forms" ? (
                <div className="template-grid tabbed-template-grid form-template-grid">
                  {selectedForms.map((form) => (
                    <button
                      aria-label={`Open ${form.title} form`}
                      className="template-card form-template-card"
                      key={form.id}
                      onClick={() => onForm(undefined, form.id)}
                    >
                      <div className="agent-card-icon" aria-hidden="true">
                        <FileText />
                      </div>
                      <div className="template-meta">
                        <span>{form.path.split("/")[0].replaceAll("_", " ")}</span>
                        <span>Portable form</span>
                      </div>
                      <h3>{form.title}</h3>
                      <p>{form.description}</p>
                      <strong>
                        Open form studio <ArrowRight size={14} />
                      </strong>
                    </button>
                  ))}
                  {selectedForms.length === 0 && <p className="library-empty">No forms for this subject area.</p>}
                </div>
              ) : activeLibraryTab === "documents" ? (
                <div className="template-grid tabbed-template-grid form-template-grid">
                  {selectedDocuments.map((document) => (
                    <button
                      aria-label={`Open ${document.title} document`}
                      className="template-card form-template-card"
                      key={document.id}
                      onClick={() => onDocument(undefined, document.id)}
                    >
                      <div className="agent-card-icon" aria-hidden="true">
                        <BookOpen />
                      </div>
                      <div className="template-meta">
                        <span>{document.path.split("/")[0].replaceAll("_", " ")}</span>
                        <span>Document contract</span>
                      </div>
                      <h3>{document.title}</h3>
                      <p>{document.description}</p>
                      <strong>
                        Inspect document schema <ArrowRight size={14} />
                      </strong>
                    </button>
                  ))}
                  {selectedDocuments.length === 0 && <p className="library-empty">No document contracts for this subject area.</p>}
                </div>
              ) : (
                <div className="template-grid tabbed-template-grid form-template-grid">
                  {selectedOntologies.map((ontology) => (
                    <button
                      aria-label={`Open ${ontology.title} ontology`}
                      className="template-card form-template-card"
                      key={ontology.id}
                      onClick={() => onOntology(undefined, ontology.id)}
                    >
                      <div className="agent-card-icon" aria-hidden="true">
                        <Boxes />
                      </div>
                      <div className="template-meta">
                        <span>{ontology.path.split("/")[0].replaceAll("_", " ")}</span>
                        <span>Semantic contract</span>
                      </div>
                      <h3>{ontology.title}</h3>
                      <p>{ontology.description}</p>
                      <strong>
                        Explore ontology <ArrowRight size={14} />
                      </strong>
                    </button>
                  ))}
                  {selectedOntologies.length === 0 && <p className="library-empty">No ontology for this subject area.</p>}
                </div>
              )}
            </section>
          </section>
        ) : (
          <section
            aria-labelledby="gallery-tab-recent"
            className="gallery-view-panel recent-projects-panel"
            id="gallery-panel-recent"
            role="tabpanel"
          >
            <div className="recent-projects-heading">
              <div>
                <span className="eyebrow">Saved in this browser</span>
                <h2>Recent projects</h2>
              </div>
              <span>{projects.length} saved</span>
            </div>
            {projects.length > 0 ? (
              <div className="recent-list">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() =>
                      project.artifactKind === "workflow-bundle"
                        ? onBundle(project)
                        : project.artifactKind === "form"
                          ? onForm(project)
                          : project.artifactKind === "document"
                            ? onDocument(project)
                            : project.artifactKind === "ontology"
                              ? onOntology(project)
                              : void openProject(project)
                    }
                  >
                    <span>
                      <strong>{project.name}</strong>
                      <small>{new Date(project.updatedAt).toLocaleString()}</small>
                    </span>
                    <span className="target-pill">{project.target}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="recent-empty">
                <PackageOpen size={24} aria-hidden="true" />
                <strong>No saved projects yet</strong>
                <p>Workflows you create or open will appear here.</p>
                <button className="quiet-button" onClick={() => setActiveGalleryView("starters")} type="button">
                  Browse starter workflows
                </button>
              </div>
            )}
          </section>
        )}
      </section>

      <footer className="welcome-footer">
        <span>Open source · offline-first · no account · never runs agents</span>
        <span>LGIR v1alpha1</span>
      </footer>
      {mcpOpen ? <StorageDialog onClose={() => setMcpOpen(false)} /> : null}
      {helpOpen ? <LazyHelpDialog onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
