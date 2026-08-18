import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Braces,
  Check,
  CheckCircle2,
  CircleDot,
  Combine,
  Download,
  FileCheck2,
  FileInput,
  FileOutput,
  FileUp,
  GitBranch,
  Github,
  HardDrive,
  Library,
  Link2,
  LockKeyhole,
  Network,
  PackageOpen,
  Play,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

export type HelpTopicId = "overview" | "start" | "workflow" | "validate" | "bundle" | "forms" | "ontology" | "trust";

interface HelpPage {
  id: HelpTopicId;
  eyebrow: string;
  title: string;
  description: string;
  content: ReactNode;
}

const Card = ({ icon: Icon, title, children }: { icon: typeof Network; title: string; children: ReactNode }) => (
  <article className="help-card">
    <Icon size={18} aria-hidden="true" />
    <h3>{title}</h3>
    <p>{children}</p>
  </article>
);

const Callout = ({
  icon: Icon,
  title,
  children,
  primary = false,
}: {
  icon: typeof Network;
  title: string;
  children: ReactNode;
  primary?: boolean;
}) => (
  <div className={`help-callout ${primary ? "help-callout-primary" : ""}`}>
    <Icon size={18} aria-hidden="true" />
    <div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  </div>
);

const HELP_PAGES: HelpPage[] = [
  {
    id: "overview",
    eyebrow: "01 · Orient",
    title: "What Ladder Graph makes",
    description:
      "Choose the artifact that matches the handoff you need. Ladder Graph creates portable, inspectable files; it does not run agents or contact a model provider.",
    content: (
      <>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={Network} title="Workflow">
            Use when another tool needs ordered roles, typed handoffs, decisions, or bounded loops.
          </Card>
          <Card icon={PackageOpen} title="Bundle">
            Use when a workflow must travel with forms, documents, ontology context, and explicit bindings.
          </Card>
          <Card icon={FileCheck2} title="Contract">
            Use a form, document, or ontology when shared structure matters without a workflow.
          </Card>
        </div>
        <Callout icon={Sparkles} title="Start from the handoff" primary>
          Ask what the receiving agent or application must understand, then build only the artifact needed to make that handoff unambiguous.
        </Callout>
        <div className="help-inline-note">
          <LockKeyhole size={16} aria-hidden="true" />
          <span>Artifacts can declare tools and permissions. Your host application still owns authorization and execution.</span>
        </div>
      </>
    ),
  },
  {
    id: "start",
    eyebrow: "02 · Orient",
    title: "Choose a starting point",
    description:
      "Start with the closest working shape, then replace its domain details. Begin blank only when the structure itself is new.",
    content: (
      <>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={Library} title="Use a starter">
            Pick a template with the same flow of work, even if its subject is different.
          </Card>
          <Card icon={HardDrive} title="Reopen local work">
            Use My library when you already have a saved project or revision to continue.
          </Card>
          <Card icon={Play} title="Begin blank">
            Add the smallest valid path first, then introduce branching and iteration deliberately.
          </Card>
        </div>
        <Callout icon={CheckCircle2} title="A starter saves structure, not wording">
          Keep its useful topology or contract shape. Replace sample roles, instructions, fields, and descriptions with your own.
        </Callout>
        <div className="help-inline-note">
          <FileUp size={16} aria-hidden="true" />
          <span>Import YAML, JSON, or OWL when the source already represents the artifact you want to continue.</span>
        </div>
      </>
    ),
  },
  {
    id: "workflow",
    eyebrow: "03 · Workflows",
    title: "Design a workflow",
    description: "Build the smallest path that can complete the task. Add branching or iteration only where a decision truly requires it.",
    content: (
      <>
        <figure className="help-flow">
          <figcaption className="sr-only">Example workflow: input, agent, evaluation, bounded revision, output</figcaption>
          {[
            { icon: Play, label: "Input", name: "Brief", color: "var(--cyan)" },
            { icon: Bot, label: "Agent", name: "Draft", color: "var(--coral)" },
            { icon: ShieldCheck, label: "Evaluate", name: "Critique", color: "var(--purple)" },
            { icon: Network, label: "Loop", name: "Revise ×3", color: "var(--pink)" },
            { icon: CheckCircle2, label: "Output", name: "Result", color: "var(--green)" },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div className="help-flow-part" key={item.label}>
                <div className="help-flow-node" style={{ "--help-accent": item.color } as CSSProperties}>
                  <span>
                    <Icon size={14} aria-hidden="true" /> {item.label}
                  </span>
                  <strong>{item.name}</strong>
                </div>
                {index < 4 ? <ArrowRight className="help-flow-arrow" size={16} aria-hidden="true" /> : null}
              </div>
            );
          })}
        </figure>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={CircleDot} title="Define responsibility">
            Each node should own one outcome. Put success criteria in the instructions, not only the label.
          </Card>
          <Card icon={GitBranch} title="Choose the edge">
            Use dependency for order, data for typed values, and control for a conditional route.
          </Card>
          <Card icon={Combine} title="Bound every loop">
            Give revisions an exit condition and a maximum count so the handoff cannot run forever.
          </Card>
        </div>
      </>
    ),
  },
  {
    id: "validate",
    eyebrow: "04 · Workflows",
    title: "Validate and compile",
    description:
      "Treat validation as a design review. Fix blocking structure first, then decide whether each target warning is acceptable for your host.",
    content: (
      <>
        <div className="help-diagnostic-example">
          <header>
            <span className="help-severity-error">
              <AlertTriangle size={14} aria-hidden="true" /> Error
            </span>
            <code>LGIR-LOOP-UNBOUNDED</code>
          </header>
          <div>
            <Network size={28} aria-hidden="true" />
            <span>
              <strong>Revision can continue forever</strong>
              <p>Add an iteration limit and an exit condition before compiling.</p>
            </span>
            <span className="help-repair-example" aria-hidden="true">
              <WandSparkles size={14} /> Apply safe repair
            </span>
          </div>
        </div>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={AlertTriangle} title="Resolve errors">
            Errors block compilation. Select the affected node or source path and fix the underlying structure.
          </Card>
          <Card icon={FileCheck2} title="Review warnings">
            Warnings identify risk or target limits. They require a decision, not automatic dismissal.
          </Card>
          <Card icon={Download} title="Choose the consumer">
            Compile for the environment that will actually read and enforce the artifact.
          </Card>
        </div>
        <ul className="help-targets" aria-label="Compile targets">
          <li>Codex</li>
          <li>Claude</li>
          <li>Hermes Agent</li>
          <li>Python</li>
          <li>TypeScript</li>
        </ul>
        <section className="help-capabilities" aria-label="Capability report labels">
          <div>
            <span className="help-capability-native">Native</span>
            <p>The target directly supports it.</p>
          </div>
          <div>
            <span className="help-capability-instructional">Instructional</span>
            <p>The artifact asks the host to enforce it.</p>
          </div>
          <div>
            <span className="help-capability-unsupported">Unsupported</span>
            <p>Change the design or target.</p>
          </div>
        </section>
      </>
    ),
  },
  {
    id: "bundle",
    eyebrow: "05 · Package",
    title: "Assemble a bundle",
    description:
      "Use a bundle when the workflow is not useful by itself. Package every contract the receiving system needs to interpret inputs, outputs, and domain terms.",
    content: (
      <>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={Network} title="Choose the workflow">
            The workflow is the plan and the bundle's primary dependency.
          </Card>
          <Card icon={FileInput} title="Attach contracts">
            Add only forms, documents, and ontology context the workflow actually uses.
          </Card>
          <Card icon={Link2} title="Bind exact references">
            Connect workflow values to the fields or ontology properties that define them.
          </Card>
        </div>
        <Callout icon={PackageOpen} title="Compile the package together" primary>
          Bundle diagnostics catch missing assets and broken bindings. Export only after the package is valid for the selected target.
        </Callout>
        <div className="help-inline-note">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>A smaller bundle is easier to review. Prefer explicit bindings over carrying an entire catalog “just in case.”</span>
        </div>
      </>
    ),
  },
  {
    id: "forms",
    eyebrow: "06 · Package",
    title: "Forms and documents",
    description:
      "Use forms for structured collection and documents for durable records. Design the contract around the decision it supports, not the editor layout.",
    content: (
      <>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={FileInput} title="Collect">
            Ask only for fields needed by the next workflow step. Mark required data deliberately.
          </Card>
          <Card icon={Braces} title="Constrain">
            Choose data types, enum values, and safe validation another system can enforce.
          </Card>
          <Card icon={FileOutput} title="Hand off">
            Preview the human experience, then export schema and presentation contracts together.
          </Card>
        </div>
        <Callout icon={CircleDot} title="Write help for the decision">
          Field help should explain format, evidence, or consequence. Do not repeat the field label.
        </Callout>
        <div className="help-checklist">
          <strong>Before applying a form</strong>
          <ul>
            <li>
              <Check size={14} /> Required fields are truly required
            </li>
            <li>
              <Check size={14} /> Preview works at narrow width
            </li>
            <li>
              <Check size={14} /> Output names match bindings
            </li>
          </ul>
        </div>
      </>
    ),
  },
  {
    id: "ontology",
    eyebrow: "07 · Package",
    title: "Model an ontology",
    description:
      "Use an ontology when several artifacts need the same meaning for entities, properties, and relationships. Model shared language, not every fact in the domain.",
    content: (
      <>
        <div className="help-card-grid help-card-grid-three">
          <Card icon={CircleDot} title="Types">
            Name stable entities that forms, documents, and workflows refer to.
          </Card>
          <Card icon={Braces} title="Properties">
            Define reusable identifiers and values with explicit types and cardinality.
          </Card>
          <Card icon={Network} title="Relationships">
            Connect types when the relationship changes interpretation or validation.
          </Card>
        </div>
        <Callout icon={Sparkles} title="Prefer a focused sliver" primary>
          When a workflow needs only part of an ontology, export the relevant types and relationships instead of the full model.
        </Callout>
        <div className="help-inline-note">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Renaming shared IDs can break forms, documents, and bindings. Review usage before saving a breaking change.</span>
        </div>
      </>
    ),
  },
  {
    id: "trust",
    eyebrow: "08 · Trust",
    title: "Save, export and connect",
    description: "Separate convenient local state from durable backups, and declared connector requirements from real authorization.",
    content: (
      <>
        <div className="help-safety-grid">
          <article>
            <HardDrive size={20} aria-hidden="true" />
            <div>
              <strong>Save locally</strong>
              <p>Projects and revisions live in this browser. Clearing site data can remove them.</p>
            </div>
          </article>
          <article>
            <Download size={20} aria-hidden="true" />
            <div>
              <strong>Export a backup</strong>
              <p>Export important work in its portable source or bundle format.</p>
            </div>
          </article>
          <article>
            <FileUp size={20} aria-hidden="true" />
            <div>
              <strong>Import as data</strong>
              <p>Imported source is parsed and validated; it is never executed as code.</p>
            </div>
          </article>
          <article>
            <Link2 size={20} aria-hidden="true" />
            <div>
              <strong>Connect explicitly</strong>
              <p>MCP pairing enables approved file workflows; it does not grant arbitrary access.</p>
            </div>
          </article>
        </div>
        <div className="help-checklist">
          <strong>Before handoff</strong>
          <ul>
            <li>
              <Check size={14} /> Validation is understood
            </li>
            <li>
              <Check size={14} /> A durable export exists
            </li>
            <li>
              <Check size={14} /> The host owns every permission
            </li>
          </ul>
        </div>
        <div className="help-about-card help-about-card-compact">
          <div className="help-about-copy">
            <span>Open source</span>
            <strong>Ladder Graph</strong>
            <p>Inspect the implementation, follow development, or contribute.</p>
          </div>
          <a href="https://github.com/hganesha/ladder-graph" rel="noreferrer" target="_blank">
            <Github size={17} aria-hidden="true" /> View on GitHub <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </>
    ),
  },
];

const HELP_GROUPS: { label: string; pageIds: HelpTopicId[] }[] = [
  { label: "Orient", pageIds: ["overview", "start"] },
  { label: "Workflows", pageIds: ["workflow", "validate"] },
  { label: "Package", pageIds: ["bundle", "forms", "ontology"] },
  { label: "Trust", pageIds: ["trust"] },
];
const PAGE_INDEX = new Map(HELP_PAGES.map((item, index) => [item.id, index]));

export function HelpDialog({ onClose, initialTopic = "overview" }: { onClose: () => void; initialTopic?: HelpTopicId }) {
  const [page, setPage] = useState(() => PAGE_INDEX.get(initialTopic) ?? 0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = HELP_PAGES[page];

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (event.key === "ArrowLeft" && page > 0) {
        event.preventDefault();
        setPage((value) => value - 1);
      }
      if (event.key === "ArrowRight" && page < HELP_PAGES.length - 1) {
        event.preventDefault();
        setPage((value) => value + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, page]);

  const keepFocusInside = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop help-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-describedby="help-description"
        aria-labelledby="help-title"
        aria-modal="true"
        className="help-dialog"
        onKeyDown={keepFocusInside}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <header className="help-dialog-header">
          <div>
            <span className="help-dialog-mark">
              <Network size={17} aria-hidden="true" />
            </span>
            <span>
              <strong>Intro &amp; help</strong>
              <small>Choose a task, not a tour</small>
            </span>
          </div>
          <div className="help-header-actions">
            <span aria-live="polite">
              {String(page + 1).padStart(2, "0")} / {String(HELP_PAGES.length).padStart(2, "0")}
            </span>
            <button aria-label="Close help" onClick={onClose} ref={closeRef} type="button">
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="help-dialog-body">
          <nav aria-label="Help topics" className="help-page-nav">
            {HELP_GROUPS.map((group) => (
              <section className="help-nav-group" key={group.label}>
                <h3>{group.label}</h3>
                {group.pageIds.map((id) => {
                  const index = PAGE_INDEX.get(id) ?? 0;
                  const item = HELP_PAGES[index];
                  return (
                    <button aria-current={page === index ? "page" : undefined} key={item.id} onClick={() => setPage(index)} type="button">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.title}</strong>
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
          <label className="help-topic-picker">
            <span>Help topic</span>
            <select aria-label="Help topic" onChange={(event) => setPage(Number(event.target.value))} value={page}>
              {HELP_PAGES.map((item, index) => (
                <option key={item.id} value={index}>
                  {String(index + 1).padStart(2, "0")} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <article className="help-page" key={current.id}>
            <header>
              <p className="eyebrow">{current.eyebrow}</p>
              <h2 id="help-title">{current.title}</h2>
              <p id="help-description">{current.description}</p>
            </header>
            <div className="help-page-content">{current.content}</div>
          </article>
        </div>
        <footer className="help-dialog-footer">
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> move · <kbd>Esc</kbd> close
          </span>
          <div>
            <button className="help-secondary-button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} type="button">
              <ArrowLeft size={15} /> Back
            </button>
            {page < HELP_PAGES.length - 1 ? (
              <button className="help-primary-button" onClick={() => setPage((value) => value + 1)} type="button">
                Next <ArrowRight size={15} />
              </button>
            ) : (
              <button className="help-primary-button" onClick={onClose} type="button">
                Done <Check size={15} />
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
