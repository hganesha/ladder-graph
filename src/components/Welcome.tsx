import {
  ArrowRight,
  Atom,
  BadgeDollarSign,
  Beaker,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  Cable,
  Calculator,
  Camera,
  ChevronDown,
  CircleHelp,
  Code2,
  Database,
  Feather,
  FileText,
  GraduationCap,
  HandCoins,
  HardHat,
  HeartPulse,
  Images,
  type LucideIcon,
  Megaphone,
  Microscope,
  Music2,
  Newspaper,
  PackageOpen,
  PenTool,
  Plane,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ARTIFACT_INDEX, SUBJECT_AREAS } from "../generated/catalog";
import { INPUT_CONTRACT_PRESETS } from "../lib/inputContracts";
import { deleteProject, listProjects, listUserTemplates, type UserTemplateRecord } from "../lib/persistence";
import { roleSubcategory } from "../lib/roleCategories";
import { ROLE_TEMPLATES, roleTemplatesForSubject } from "../lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../lib/templates";
import {
  USER_ASSETS_SUBJECT,
  userAgentTemplate,
  userProjectWorkflow,
  userWorkflowTemplate,
  type UserAgentTemplate,
  type UserWorkflowTemplate,
} from "../lib/userCatalogAssets";
import { useStudioStore } from "../store/useStudioStore";
import type { InputModality, ProjectRecord } from "../types";
import { Brand } from "./Brand";
import { LazyHelpDialog } from "./LazyHelpDialog";
import { StorageDialog } from "./StorageDialog";
import { ThemeToggle } from "./ThemeToggle";
import { UniversalCatalogSearch } from "./UniversalCatalogSearch";

const catalogLabelCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const compareCatalogLabels = (left: string, right: string) => catalogLabelCollator.compare(left, right);

const SUBJECT_AREA_ICONS: Record<string, LucideIcon> = {
  "Accounting, tax & audit": Calculator,
  "Agriculture & food systems": Beaker,
  "Airline flight operations": Plane,
  "Architecture & design": Building2,
  "Astronomy & space": Sparkles,
  "Biology & bioinformatics": Beaker,
  "Chemistry & materials science": Beaker,
  "Clinical & health sciences": HeartPulse,
  "Core patterns": Sparkles,
  "Crisis & emergency management": ShieldCheck,
  "Customer success & support": Target,
  "Data & analytics engineering": Database,
  "DevOps & site reliability": Code2,
  "Education & assessment": GraduationCap,
  "Energy & utilities": Atom,
  "Environmental & climate science": Atom,
  "Event planning & hospitality": Target,
  "Fashion & textiles": Sparkles,
  "Film, video & post-production": Images,
  "Finance & risk": BadgeDollarSign,
  "Gaming & interactive media": Sparkles,
  "Geospatial & earth observation": Images,
  "Go-to-market": Megaphone,
  "HR & talent operations": Target,
  Humanities: BookOpen,
  "Insurance & underwriting": ShieldCheck,
  "Journalism & verification": Newspaper,
  "Legal & contracts": Scale,
  "Life sciences & GxP operations": Microscope,
  "Linguistics & language preservation": Feather,
  "Manufacturing & industrial operations": Building2,
  "Marketing & growth": Megaphone,
  Mathematics: Calculator,
  Multimodal: Images,
  Music: Music2,
  "Oil & gas drilling & well operations": HardHat,
  "Office productivity": Cable,
  "Personal development": Target,
  Photography: Camera,
  Physics: Atom,
  "Product design": PenTool,
  "Product management": Boxes,
  "Public sector procurement & grants": HandCoins,
  "Quality assurance & compliance": ShieldCheck,
  "Real estate & construction": Building2,
  Research: Beaker,
  "Robotics & embodied AI": Atom,
  "Sales & business development": Megaphone,
  "Scientific peer review & publishing": BookOpen,
  Security: ShieldCheck,
  "Social sciences & policy": BookOpen,
  "Software engineering": Code2,
  "Supply chain & logistics": Boxes,
  "Transportation & mobility": Boxes,
  Writing: Feather,
  [USER_ASSETS_SUBJECT]: UserRound,
};

export const WORKFLOW_AREAS = SUBJECT_AREAS.map(({ name }) => ({
  name,
  label: name,
  description: `${WORKFLOW_TEMPLATES.filter((template) => template.area === name).length} workflows and ${roleTemplatesForSubject(name).length} reusable agents.`,
  icon: SUBJECT_AREA_ICONS[name] ?? Workflow,
})).sort((left, right) => compareCatalogLabels(left.label, right.label));
export const CATALOG_SEARCH_SUBJECTS = WORKFLOW_AREAS.map(({ name, description }) => ({ name, description }));

const ALL_SUBJECT_AREA = {
  name: ":all",
  label: "All subject areas",
  description: "Every workflow, agent, form, document, ontology, and curated bundle in the catalog.",
  icon: Workflow,
};
const SUBJECT_AREA_OPTIONS = [ALL_SUBJECT_AREA, ...WORKFLOW_AREAS];
const DEFAULT_SUBJECT_AREA =
  WORKFLOW_AREAS.find((area) => area.name === "Core patterns")?.name ?? WORKFLOW_AREAS[0]?.name ?? ALL_SUBJECT_AREA.name;
type LibraryTab = "workflows" | "bundles" | "agents" | "forms" | "documents" | "ontologies";
type ModalityFilter = "all" | InputModality;
type GalleryView = "starters" | "recent";
const BUNDLE_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "workflow-bundle").sort((left, right) =>
  compareCatalogLabels(left.title, right.title),
);
const FORM_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "form").sort((left, right) =>
  compareCatalogLabels(left.title, right.title),
);
const DOCUMENT_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "document").sort((left, right) =>
  compareCatalogLabels(left.title, right.title),
);
const ONTOLOGY_TEMPLATES = ARTIFACT_INDEX.filter((artifact) => artifact.kind === "ontology").sort((left, right) =>
  compareCatalogLabels(left.title, right.title),
);

function artifactsForSubject<T extends { path: string }>(templates: T[], subject: string): T[] {
  if (subject === ALL_SUBJECT_AREA.name) return templates;
  const prefixes = SUBJECT_AREAS.find((area) => area.name === subject)?.artifactPathPrefixes ?? [];
  return templates.filter((template) => prefixes.some((prefix) => template.path.startsWith(prefix)));
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  const normalizedPrefix = prefix.replace(/\/+$/, "");
  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

function subjectForAgent(agent: (typeof ROLE_TEMPLATES)[number]): string {
  if (agent.areas.includes(USER_ASSETS_SUBJECT)) return USER_ASSETS_SUBJECT;
  const declaredArea = agent.areas.find((area) => SUBJECT_AREAS.some((subject) => subject.name === area));
  if (declaredArea) return declaredArea;

  const explicitlyAssignedArea = SUBJECT_AREAS.find((subject) => subject.agentIds.includes(agent.id));
  if (explicitlyAssignedArea) return explicitlyAssignedArea.name;

  return (
    SUBJECT_AREAS.flatMap((subject) =>
      subject.agentPathPrefixes.map((prefix) => ({ name: subject.name, prefix: prefix.replace(/\/+$/, "") })),
    )
      .filter(({ prefix }) => pathMatchesPrefix(agent.path, prefix))
      .sort((left, right) => right.prefix.length - left.prefix.length || compareCatalogLabels(left.name, right.name))[0]?.name ??
    "Uncategorized"
  );
}

function agentMatchesSubject(agent: (typeof ROLE_TEMPLATES)[number], subjectName: string): boolean {
  if (agent.areas.includes(subjectName)) return true;
  const subject = SUBJECT_AREAS.find((candidate) => candidate.name === subjectName);
  if (!subject) return false;
  return subject.agentIds.includes(agent.id) || subject.agentPathPrefixes.some((prefix) => pathMatchesPrefix(agent.path, prefix));
}

function subjectForArtifact(artifact: (typeof ARTIFACT_INDEX)[number]): string {
  return (
    SUBJECT_AREAS.flatMap((subject) =>
      subject.artifactPathPrefixes.map((prefix) => ({ name: subject.name, prefix: prefix.replace(/\/+$/, "") })),
    )
      .filter(({ prefix }) => pathMatchesPrefix(artifact.path, prefix))
      .sort((left, right) => right.prefix.length - left.prefix.length || compareCatalogLabels(left.name, right.name))[0]?.name ??
    "Uncategorized"
  );
}

function CatalogItemCollection<T>({
  emptyMessage,
  gridClassName,
  groupBySubject,
  items,
  pluralLabel,
  renderItem,
  singularLabel,
  subjectForItem,
}: {
  emptyMessage: string;
  gridClassName: string;
  groupBySubject: boolean;
  items: T[];
  pluralLabel: string;
  renderItem: (item: T) => React.ReactNode;
  singularLabel: string;
  subjectForItem: (item: T) => string;
}) {
  if (items.length === 0) {
    return (
      <div className={gridClassName}>
        <p className="library-empty">{emptyMessage}</p>
      </div>
    );
  }

  if (!groupBySubject) return <div className={gridClassName}>{items.map(renderItem)}</div>;

  const groupedItems = Array.from(
    items.reduce((groups, item) => {
      const subject = subjectForItem(item);
      groups.set(subject, [...(groups.get(subject) ?? []), item]);
      return groups;
    }, new Map<string, T[]>()),
  ).sort(([left], [right]) => compareCatalogLabels(left, right));

  return (
    <div className="catalog-subject-groups">
      {groupedItems.map(([subject, subjectItems]) => {
        const SubjectIcon = SUBJECT_AREA_ICONS[subject] ?? Workflow;
        return (
          <section aria-label={`${subject} ${pluralLabel}`} className="catalog-subject-group" key={subject}>
            <header>
              <div className="catalog-subject-title">
                <SubjectIcon aria-hidden="true" size={16} />
                <h3>{subject}</h3>
              </div>
              <span>
                {subjectItems.length} {subjectItems.length === 1 ? singularLabel : pluralLabel}
              </span>
            </header>
            <div className={gridClassName}>{subjectItems.map(renderItem)}</div>
          </section>
        );
      })}
    </div>
  );
}

function subjectItemCount(subject: string): number {
  const workflows =
    subject === ALL_SUBJECT_AREA.name
      ? WORKFLOW_TEMPLATES.length
      : WORKFLOW_TEMPLATES.filter((template) => template.area === subject).length;
  const agents = subject === ALL_SUBJECT_AREA.name ? ROLE_TEMPLATES.length : roleTemplatesForSubject(subject).length;
  return (
    workflows +
    agents +
    artifactsForSubject(BUNDLE_TEMPLATES, subject).length +
    artifactsForSubject(FORM_TEMPLATES, subject).length +
    artifactsForSubject(DOCUMENT_TEMPLATES, subject).length +
    artifactsForSubject(ONTOLOGY_TEMPLATES, subject).length
  );
}

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
  const openUserTemplate = useStudioStore((state) => state.openUserTemplate);
  const openProject = useStudioStore((state) => state.openProject);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserTemplateRecord[]>([]);
  const [includeUserAssets, setIncludeUserAssets] = useState(false);
  const [activeArea, setActiveArea] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("subject");
    return SUBJECT_AREA_OPTIONS.some((area) => area.name === requested) ? requested! : DEFAULT_SUBJECT_AREA;
  });
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [activeGalleryView, setActiveGalleryView] = useState<GalleryView>("starters");
  const [activeLibraryTab, setActiveLibraryTab] = useState<LibraryTab>("workflows");
  const [catalogQuery, setCatalogQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectDeleteError, setProjectDeleteError] = useState("");

  const selectedArea = SUBJECT_AREA_OPTIONS.find((area) => area.name === activeArea) ?? WORKFLOW_AREAS[0];
  const allSubjectsSelected = selectedArea.name === ALL_SUBJECT_AREA.name;
  const userWorkflowTemplates = useMemo(
    () =>
      [...userTemplates.map(userWorkflowTemplate), ...projects.map(userProjectWorkflow)].filter(
        (template): template is UserWorkflowTemplate => Boolean(template),
      ),
    [projects, userTemplates],
  );
  const userAgentTemplates = useMemo(
    () => userTemplates.map(userAgentTemplate).filter((template): template is UserAgentTemplate => Boolean(template)),
    [userTemplates],
  );
  const userAssetCount = userWorkflowTemplates.length + userAgentTemplates.length;
  const availableWorkflowTemplates = includeUserAssets ? [...WORKFLOW_TEMPLATES, ...userWorkflowTemplates] : WORKFLOW_TEMPLATES;
  const availableAgentTemplates = includeUserAssets ? [...ROLE_TEMPLATES, ...userAgentTemplates] : ROLE_TEMPLATES;
  const selectedTemplates = availableWorkflowTemplates
    .filter(
      (template) =>
        (allSubjectsSelected || template.area === selectedArea.name) && (modality === "all" || template.modalities.includes(modality)),
    )
    .sort((left, right) => compareCatalogLabels(left.title, right.title));
  const selectedAgents = (
    allSubjectsSelected ? availableAgentTemplates : availableAgentTemplates.filter((agent) => agentMatchesSubject(agent, selectedArea.name))
  )
    .filter((agent) => modality === "all" || agent.modalities.includes(modality))
    .sort((left, right) => compareCatalogLabels(left.name, right.name));
  const selectedBundles = artifactsForSubject(BUNDLE_TEMPLATES, selectedArea.name);
  const selectedForms = artifactsForSubject(FORM_TEMPLATES, selectedArea.name);
  const selectedDocuments = artifactsForSubject(DOCUMENT_TEMPLATES, selectedArea.name);
  const selectedOntologies = artifactsForSubject(ONTOLOGY_TEMPLATES, selectedArea.name);
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

  const handleDeleteProject = async (project: ProjectRecord) => {
    const confirmed = window.confirm(
      `Delete “${project.name}”? This permanently removes the project and its saved revisions from this browser.`,
    );
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    setProjectDeleteError("");
    try {
      await deleteProject(project.id);
      setProjects((current) => current.filter((record) => record.id !== project.id));
    } catch {
      setProjectDeleteError(`Could not delete “${project.name}”. Please try again.`);
    } finally {
      setDeletingProjectId(null);
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([listProjects(), listUserTemplates()]).then(([projectRecords, templateRecords]) => {
      if (!active) return;
      setProjects(projectRecords);
      setUserTemplates(templateRecords);
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
          <nav className="library-create-actions" aria-label="Create new project">
            <button aria-label="New workflow" className="quiet-button new-workflow-button" onClick={onBlank} type="button">
              <Workflow size={15} aria-hidden="true" /> <span>New workflow</span>
            </button>
            <button aria-label="New bundle" className="quiet-button" onClick={() => onBundle(undefined, "__new__")} type="button">
              <PackageOpen size={15} aria-hidden="true" /> <span>New bundle</span>
            </button>
            <button aria-label="New ontology" className="quiet-button" onClick={() => onOntology(undefined, "__new__")} type="button">
              <Boxes size={15} aria-hidden="true" /> <span>New ontology</span>
            </button>
          </nav>
        </div>
        <UniversalCatalogSearch
          onBrowseSubject={(subject) => {
            setActiveArea(subject);
            setActiveGalleryView("starters");
          }}
          onCreateWithAgent={openAgentTemplate}
          onInspectDocument={(templateId) => onDocument(undefined, templateId)}
          onOpenBundle={(templateId) => onBundle(undefined, templateId)}
          onOpenForm={(templateId) => onForm(undefined, templateId)}
          onOpenOntology={(templateId) => onOntology(undefined, templateId)}
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
                    {SUBJECT_AREA_OPTIONS.map((area) => (
                      <option key={area.name} value={area.name}>
                        {area.label} ({subjectItemCount(area.name)})
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
                    aria-label="Bundles"
                    aria-controls="library-panel"
                    aria-selected={activeLibraryTab === "bundles"}
                    className={activeLibraryTab === "bundles" ? "active" : undefined}
                    id="library-tab-bundles"
                    onClick={() => setActiveLibraryTab("bundles")}
                    role="tab"
                    tabIndex={activeLibraryTab === "bundles" ? 0 : -1}
                    type="button"
                  >
                    <PackageOpen size={15} aria-hidden="true" /> Bundles <small>{selectedBundles.length}</small>
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
              <label className={`user-assets-filter ${userAssetCount === 0 ? "disabled" : ""}`}>
                <span className="eyebrow">Personal library</span>
                <span className="user-assets-toggle">
                  <input
                    aria-label="Include your assets"
                    checked={includeUserAssets}
                    disabled={userAssetCount === 0}
                    onChange={(event) => setIncludeUserAssets(event.target.checked)}
                    type="checkbox"
                  />
                  <span aria-hidden="true" className="toggle-track">
                    <span />
                  </span>
                  <span>
                    Include your assets <small>{userAssetCount}</small>
                  </span>
                </span>
              </label>
            </fieldset>
            <section aria-labelledby={`library-tab-${activeLibraryTab}`} className="workflow-tab-panel" id="library-panel" role="tabpanel">
              <div className="workflow-group-heading">
                <span aria-hidden="true">
                  <SelectedAreaIcon size={17} />
                </span>
                <div>
                  <h2>{selectedArea.label}</h2>
                  <p>{selectedArea.description}</p>
                </div>
              </div>
              {activeLibraryTab === "workflows" ? (
                <CatalogItemCollection
                  emptyMessage="No workflows match this modality."
                  gridClassName="template-grid tabbed-template-grid"
                  groupBySubject={allSubjectsSelected}
                  items={selectedTemplates}
                  pluralLabel="workflows"
                  renderItem={(template) => {
                    const ItemSubjectIcon = SUBJECT_AREA_ICONS[template.area] ?? Workflow;
                    const { userProject, userRecord } = template as Partial<UserWorkflowTemplate>;
                    const userAsset = userProject ?? userRecord;
                    return (
                      <button
                        aria-label={`Open ${template.title} in studio`}
                        className="template-card"
                        data-asset-origin={userAsset ? "user" : "builtin"}
                        key={`${userAsset ? "user" : "builtin"}:${template.id}`}
                        onClick={() =>
                          void (userProject
                            ? openProject(userProject)
                            : userRecord
                              ? openUserTemplate(userRecord)
                              : openTemplate(template.id))
                        }
                        style={{ "--accent": template.accent } as React.CSSProperties}
                      >
                        <div className="topology-art" aria-hidden="true">
                          <ItemSubjectIcon />
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="template-meta">
                          <span>{userProject ? "Yours · project" : userRecord ? "Yours · workflow" : template.eyebrow}</span>
                          <span>{template.topology}</span>
                        </div>
                        <h3>{template.title}</h3>
                        <p>{template.description}</p>
                        <strong>
                          Open in studio <ArrowRight size={14} />
                        </strong>
                      </button>
                    );
                  }}
                  singularLabel="workflow"
                  subjectForItem={(template) => template.area}
                />
              ) : activeLibraryTab === "bundles" ? (
                <section className="curated-bundles" aria-labelledby="curated-bundles-title">
                  <header>
                    <div>
                      <span className="eyebrow">Portable solution contracts</span>
                      <h3 id="curated-bundles-title">Curated workflow bundles</h3>
                    </div>
                    <span>
                      {selectedBundles.length} {selectedBundles.length === 1 ? "bundle" : "bundles"}
                    </span>
                  </header>
                  <CatalogItemCollection
                    emptyMessage="No bundles for this subject area."
                    gridClassName="bundle-launch-grid"
                    groupBySubject={allSubjectsSelected}
                    items={selectedBundles}
                    pluralLabel="bundles"
                    renderItem={(template) => (
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
                    )}
                    singularLabel="bundle"
                    subjectForItem={subjectForArtifact}
                  />
                </section>
              ) : activeLibraryTab === "agents" ? (
                <CatalogItemCollection
                  emptyMessage="No agents match this modality."
                  gridClassName="template-grid tabbed-template-grid agent-template-grid"
                  groupBySubject={allSubjectsSelected}
                  items={selectedAgents}
                  pluralLabel="agents"
                  renderItem={(agent) => {
                    const subject = allSubjectsSelected ? subjectForAgent(agent) : selectedArea.name;
                    const ItemSubjectIcon = SUBJECT_AREA_ICONS[subject] ?? Bot;
                    const userRecord = (agent as Partial<UserAgentTemplate>).userRecord;
                    return (
                      <button
                        aria-label={`Start workflow with ${agent.name}`}
                        className="template-card agent-template-card"
                        data-asset-origin={userRecord ? "user" : "builtin"}
                        key={`${userRecord ? "user" : "builtin"}:${agent.id}`}
                        onClick={() => void (userRecord ? openUserTemplate(userRecord) : openAgentTemplate(agent.id))}
                        style={{ "--accent": "#e86b5d" } as React.CSSProperties}
                      >
                        <div className="agent-card-icon" aria-hidden="true">
                          <ItemSubjectIcon />
                        </div>
                        <div className="template-meta">
                          <span>{userRecord ? "Yours · agent" : roleSubcategory(agent)}</span>
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
                    );
                  }}
                  singularLabel="agent"
                  subjectForItem={subjectForAgent}
                />
              ) : activeLibraryTab === "forms" ? (
                <CatalogItemCollection
                  emptyMessage="No forms for this subject area."
                  gridClassName="template-grid tabbed-template-grid form-template-grid"
                  groupBySubject={allSubjectsSelected}
                  items={selectedForms}
                  pluralLabel="forms"
                  renderItem={(form) => (
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
                  )}
                  singularLabel="form"
                  subjectForItem={subjectForArtifact}
                />
              ) : activeLibraryTab === "documents" ? (
                <CatalogItemCollection
                  emptyMessage="No document contracts for this subject area."
                  gridClassName="template-grid tabbed-template-grid form-template-grid"
                  groupBySubject={allSubjectsSelected}
                  items={selectedDocuments}
                  pluralLabel="documents"
                  renderItem={(document) => (
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
                  )}
                  singularLabel="document"
                  subjectForItem={subjectForArtifact}
                />
              ) : (
                <CatalogItemCollection
                  emptyMessage="No ontology for this subject area."
                  gridClassName="template-grid tabbed-template-grid form-template-grid"
                  groupBySubject={allSubjectsSelected}
                  items={selectedOntologies}
                  pluralLabel="ontologies"
                  renderItem={(ontology) => (
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
                  )}
                  singularLabel="ontology"
                  subjectForItem={subjectForArtifact}
                />
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
            {projectDeleteError ? (
              <p className="recent-project-error" role="alert">
                {projectDeleteError}
              </p>
            ) : null}
            {projects.length > 0 ? (
              <div className="recent-list">
                {projects.map((project) => (
                  <div className="recent-project-card" key={project.id}>
                    <button
                      aria-label={`Open ${project.name}`}
                      className="recent-project-open"
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
                      type="button"
                    >
                      <span>
                        <strong>{project.name}</strong>
                        <small>{new Date(project.updatedAt).toLocaleString()}</small>
                      </span>
                      <span className="target-pill">{project.target}</span>
                    </button>
                    <button
                      aria-label={`Delete ${project.name}`}
                      className="recent-project-delete"
                      disabled={deletingProjectId === project.id}
                      onClick={() => void handleDeleteProject(project)}
                      title={`Delete ${project.name}`}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
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
      {helpOpen ? <LazyHelpDialog initialTopic="overview" onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
