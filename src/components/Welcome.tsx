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
  HardHat,
  Images,
  Megaphone,
  Music2,
  PenTool,
  Plane,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listProjects } from "../lib/persistence";
import { roleSubcategory } from "../lib/roleCategories";
import { ROLE_TEMPLATES, roleTemplatesForSubject } from "../lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../lib/templates";
import { useStudioStore } from "../store/useStudioStore";
import type { ProjectRecord } from "../types";
import { Brand } from "./Brand";
import { LazyHelpDialog } from "./LazyHelpDialog";
import { StorageDialog } from "./StorageDialog";
import { ThemeToggle } from "./ThemeToggle";

const WORKFLOW_AREAS = [
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

type LibraryTab = "workflows" | "agents";

export function Welcome({ onBlank }: { onBlank: () => void }) {
  const openTemplate = useStudioStore((state) => state.openTemplate);
  const openAgentTemplate = useStudioStore((state) => state.openAgentTemplate);
  const openProject = useStudioStore((state) => state.openProject);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeArea, setActiveArea] = useState<(typeof WORKFLOW_AREAS)[number]["name"]>("Core patterns");
  const [helpOpen, setHelpOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [activeLibraryTab, setActiveLibraryTab] = useState<LibraryTab>("workflows");
  const [areaChooserOpen, setAreaChooserOpen] = useState(true);
  const areaRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedArea = WORKFLOW_AREAS.find((area) => area.name === activeArea) ?? WORKFLOW_AREAS[0];
  const selectedTemplates = WORKFLOW_TEMPLATES.filter((template) => template.area === selectedArea.name);
  const selectedAgents = roleTemplatesForSubject(selectedArea.name);
  const SelectedAreaIcon = selectedArea.icon;

  const focusArea = (index: number) => {
    const nextArea = WORKFLOW_AREAS[index];
    if (!nextArea) return;
    setActiveArea(nextArea.name);
    areaRefs.current[index]?.focus();
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

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        <div className="welcome-header-actions">
          <button className="quiet-button" onClick={() => setMcpOpen(true)} type="button" aria-label="Open MCP companion">
            <Cable size={16} aria-hidden="true" />
            <span>MCP</span>
          </button>
          <button className="quiet-button welcome-help-button" onClick={() => setHelpOpen(true)} type="button">
            <CircleHelp size={16} aria-hidden="true" />
            <span>Intro &amp; help</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <section className="gallery-section workflow-library" aria-labelledby="gallery-title">
        <div className="section-heading library-heading">
          <div>
            <h1 id="gallery-title">Starter workflows</h1>
            <p>
              Choose a subject area, then start from one of {WORKFLOW_TEMPLATES.length} workflows or {ROLE_TEMPLATES.length} agent
              templates.
            </p>
          </div>
          <button className="quiet-button new-workflow-button" onClick={onBlank}>
            New workflow <ArrowRight size={15} />
          </button>
        </div>
        <button
          aria-controls="subject-area-selector"
          aria-expanded={areaChooserOpen}
          aria-label={`Choose a subject area, selected ${selectedArea.name}`}
          className="subject-area-toggle"
          onClick={() => setAreaChooserOpen((open) => !open)}
          type="button"
        >
          <span className="eyebrow">1 · Choose a subject area</span>
          <span className="subject-area-toggle-selection">
            <SelectedAreaIcon size={14} aria-hidden="true" />
            <span>{selectedArea.name}</span>
            <ChevronDown className={areaChooserOpen ? "expanded" : undefined} size={14} aria-hidden="true" />
          </span>
        </button>
        <fieldset className="workflow-tabs subject-area-selector" hidden={!areaChooserOpen} id="subject-area-selector">
          <legend className="sr-only">Subject areas</legend>
          {WORKFLOW_AREAS.map((area, index) => {
            const AreaIcon = area.icon;
            const selected = area.name === activeArea;
            return (
              <button
                aria-pressed={selected}
                className={selected ? "active" : undefined}
                id={`subject-area-${index}`}
                key={area.name}
                onClick={() => setActiveArea(area.name)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    focusArea((index + 1) % WORKFLOW_AREAS.length);
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    focusArea((index - 1 + WORKFLOW_AREAS.length) % WORKFLOW_AREAS.length);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusArea(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusArea(WORKFLOW_AREAS.length - 1);
                  }
                }}
                ref={(element) => {
                  areaRefs.current[index] = element;
                }}
                type="button"
              >
                <AreaIcon size={15} aria-hidden="true" />
                <span>{area.name}</span>
                <small aria-hidden="true">
                  {WORKFLOW_TEMPLATES.filter((template) => template.area === area.name).length + roleTemplatesForSubject(area.name).length}
                </small>
              </button>
            );
          })}
        </fieldset>
        <div className="library-tab-heading">
          <span className="eyebrow">2 · Choose a starting point</span>
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
              <Workflow size={15} /> Workflows <small>{selectedTemplates.length}</small>
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
              <Bot size={15} /> Agents <small>{selectedAgents.length}</small>
            </button>
          </div>
        </div>
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
            </div>
          ) : (
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
            </div>
          )}

          {activeLibraryTab === "workflows" && projects.length > 0 && (
            <section className="recent-section" aria-labelledby="recent-title">
              <div className="eyebrow">Saved in this browser</div>
              <h2 id="recent-title">Recent projects</h2>
              <div className="recent-list">
                {projects.slice(0, 5).map((project) => (
                  <button key={project.id} onClick={() => void openProject(project)}>
                    <span>
                      <strong>{project.name}</strong>
                      <small>{new Date(project.updatedAt).toLocaleString()}</small>
                    </span>
                    <span className="target-pill">{project.target}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
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
