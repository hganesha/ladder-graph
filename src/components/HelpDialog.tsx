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
  FileUp,
  GitBranch,
  Github,
  HardDrive,
  Library,
  LockKeyhole,
  Network,
  PanelRight,
  Play,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";

interface HelpPage {
  eyebrow: string;
  title: string;
  description: string;
  content: ReactNode;
}

const BUILD_STEPS = [
  {
    icon: Library,
    title: "Open a starter workflow",
    copy: "Choose a familiar pattern from the gallery. Starting from a working shape is faster than building from a blank canvas.",
  },
  {
    icon: CircleDot,
    title: "Select a node",
    copy: "Click a node on the canvas to edit its role, instructions, inputs, outputs, and required capabilities in the Inspector.",
  },
  {
    icon: GitBranch,
    title: "Connect the work",
    copy: "Use dependency edges to order work, data edges to pass a typed value, and control edges to route a condition.",
  },
  {
    icon: Braces,
    title: "Check the source",
    copy: "Canvas, Split, and YAML views show the same workflow. Use Split when you want to see how a visual edit changes the YAML.",
  },
];

const HELP_PAGES: HelpPage[] = [
  {
    eyebrow: "01 · Start here",
    title: "Build your first workflow",
    description:
      "Ladder Graph helps you design, validate, and compile agent workflows. It creates instructions or code for another tool to run—it never runs agents or contacts a model provider.",
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
        <div className="help-callout help-callout-primary">
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <strong>The fastest way to begin</strong>
            <p>Open a starter workflow whose shape resembles your task, then replace its roles and instructions with your own.</p>
          </div>
        </div>
        <div className="help-card-grid help-card-grid-three">
          <article className="help-card">
            <Library size={18} aria-hidden="true" />
            <h3>Start with a shape</h3>
            <p>Templates include useful patterns such as draft-and-critique, parallel review, research, and approval gates.</p>
          </article>
          <article className="help-card">
            <FileCheck2 size={18} aria-hidden="true" />
            <h3>Catch structural errors</h3>
            <p>Validation finds broken connections, invalid contracts, and loops that could continue forever.</p>
          </article>
          <article className="help-card">
            <WandSparkles size={18} aria-hidden="true" />
            <h3>Compile one artifact</h3>
            <p>Choose a target and receive one self-contained Markdown, Python, or TypeScript file.</p>
          </article>
        </div>
      </>
    ),
  },
  {
    eyebrow: "02 · Build",
    title: "Build on the canvas",
    description: "Most edits follow the same four-step path. The canvas and YAML remain synchronized while you work.",
    content: (
      <>
        <ol className="help-step-grid">
          {BUILD_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <span className="help-step-number">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={18} aria-hidden="true" />
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </li>
            );
          })}
        </ol>
        <figure className="help-landmarks">
          <figcaption className="sr-only">Studio layout</figcaption>
          <div>
            <Library size={17} aria-hidden="true" />
            <strong>Library</strong>
            <span>Add nodes and workflow shapes</span>
          </div>
          <div className="help-landmark-canvas">
            <Network size={19} aria-hidden="true" />
            <strong>Canvas / Split / YAML</strong>
            <span>Arrange the workflow and inspect its source</span>
          </div>
          <div>
            <PanelRight size={17} aria-hidden="true" />
            <strong>Inspector</strong>
            <span>Configure the selected node</span>
          </div>
        </figure>
        <div className="help-inline-note">
          <Combine size={16} aria-hidden="true" />
          <span>
            Begin with <strong>Input → Agent → Output</strong>. Add conditions, loops, joins, and approvals only when the workflow needs
            them.
          </span>
        </div>
      </>
    ),
  },
  {
    eyebrow: "03 · Validate",
    title: "Fix issues before compiling",
    description:
      "The status button in the header shows whether the workflow is valid. Errors block compilation; warnings call attention to risks but do not block it.",
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
              <p>This loop needs an iteration limit and an exit condition before the workflow can compile.</p>
            </span>
            <span className="help-repair-example" aria-hidden="true">
              <WandSparkles size={14} aria-hidden="true" /> Apply safe repair
            </span>
          </div>
        </div>
        <ol className="help-action-list">
          <li>
            <span>1</span>
            <div>
              <strong>Open the status button</strong>
              <p>Read the explanation and select the affected node or source path.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Apply a safe repair when offered</strong>
              <p>The repair edits the workflow for you. Review the change in Split or YAML view.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Check the capability label</strong>
              <p>“Instructional” means the target is told what to do, but your host application does not mechanically enforce it.</p>
            </div>
          </li>
        </ol>
        <div className="help-callout">
          <CheckCircle2 size={17} aria-hidden="true" />
          <div>
            <strong>Ready to compile</strong>
            <p>Continue when the header says Valid. Review any remaining warnings before exporting the artifact.</p>
          </div>
        </div>
      </>
    ),
  },
  {
    eyebrow: "04 · Compile",
    title: "Choose a target and export",
    description:
      "Select the environment that will consume the workflow. Ladder Graph validates target support, then creates one file for you to copy or download.",
    content: (
      <>
        <ul className="help-targets" aria-label="Compile targets">
          <li>Codex</li>
          <li>Claude</li>
          <li>Hermes Agent</li>
          <li>Python</li>
          <li>TypeScript</li>
        </ul>
        <ol className="help-compile-path">
          <li>
            <span>
              <CircleDot size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Choose the target</strong>
              <p>Use the target menu in the header before compiling.</p>
            </div>
          </li>
          <li>
            <span>
              <WandSparkles size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Select Compile</strong>
              <p>Errors must be fixed first. Warnings remain visible for review.</p>
            </div>
          </li>
          <li>
            <span>
              <FileCheck2 size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Review target support</strong>
              <p>The capability report explains how each requested feature is represented.</p>
            </div>
          </li>
          <li>
            <span>
              <Download size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Copy or download</strong>
              <p>Install the Markdown in your agent harness or import the generated module into your application.</p>
            </div>
          </li>
        </ol>
        <section className="help-capabilities" aria-labelledby="help-capabilities-title">
          <h3 className="sr-only" id="help-capabilities-title">
            Capability report labels
          </h3>
          <div>
            <span className="help-capability-native">Native</span>
            <p>The target directly supports this feature.</p>
          </div>
          <div>
            <span className="help-capability-instructional">Instructional</span>
            <p>The artifact describes the behavior in instructions.</p>
          </div>
          <div>
            <span className="help-capability-unsupported">Unsupported</span>
            <p>Change the workflow or choose another target.</p>
          </div>
        </section>
      </>
    ),
  },
  {
    eyebrow: "05 · Save safely",
    title: "Keep a durable copy",
    description:
      "Projects and revisions are saved in this browser. That is convenient local state, not a backup—export important workflows as YAML.",
    content: (
      <>
        <div className="help-safety-grid">
          <article>
            <HardDrive size={20} aria-hidden="true" />
            <div>
              <strong>Saved locally</strong>
              <p>No account or cloud sync is required. Clearing site data can remove your projects.</p>
            </div>
          </article>
          <article>
            <Download size={20} aria-hidden="true" />
            <div>
              <strong>Export a backup</strong>
              <p>Use Export YAML for any workflow you would be unhappy to lose.</p>
            </div>
          </article>
          <article>
            <FileUp size={20} aria-hidden="true" />
            <div>
              <strong>Imports stay data</strong>
              <p>Imported YAML is validated and displayed. It is never executed as shell, Python, JavaScript, or HTML.</p>
            </div>
          </article>
          <article>
            <LockKeyhole size={20} aria-hidden="true" />
            <div>
              <strong>Permissions stay external</strong>
              <p>Artifacts can name required skills and connectors, but cannot install them or grant access.</p>
            </div>
          </article>
        </div>
        <div className="help-checklist">
          <strong>Before you leave</strong>
          <ul>
            <li>
              <Check size={14} aria-hidden="true" /> The header says Valid
            </li>
            <li>
              <Check size={14} aria-hidden="true" /> Target capability warnings are understood
            </li>
            <li>
              <Check size={14} aria-hidden="true" /> Important work has been exported as YAML
            </li>
          </ul>
        </div>
      </>
    ),
  },
  {
    eyebrow: "06 · About",
    title: "About Ladder Graph",
    description: "An open-source visual studio for designing, validating, and compiling agent workflows.",
    content: (<div className="help-about-card">
        <div className="help-about-mark" aria-hidden="true">
       <Brand compact />
        </div>
        <div className="help-about-copy">
          <span>Created by</span>
          <strong>Hari Venkataraman with Codex</strong>
          <p>Explore the source, follow development, or contribute on GitHub.</p>
        </div>
        <a href="https://github.com/hganesha/ladder-graph" rel="noreferrer" target="_blank">
          <Github size={17} aria-hidden="true" />
          View on GitHub
          <ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
    ),
  },
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
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
      'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
              <small>Ladder Graph essentials</small>
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
          <nav aria-label="Help pages" className="help-page-nav">
            {HELP_PAGES.map((item, index) => (
              <button aria-current={page === index ? "page" : undefined} key={item.title} onClick={() => setPage(index)} type="button">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </nav>

          <article className="help-page" key={current.title}>
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
