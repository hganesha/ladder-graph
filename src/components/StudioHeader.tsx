import {
  ArrowLeft,
  Braces,
  Cable,
  CheckCircle2,
  CircleHelp,
  Code2,
  Columns2,
  Database,
  Download,
  FileUp,
  Minus,
  Plus,
  Redo2,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { useStudioStore } from "../store/useStudioStore";
import type { Target } from "../types";
import { Brand } from "./Brand";
import { download } from "./OutputPanel";
import { ThemeToggle } from "./ThemeToggle";

export function StudioHeader({
  onHelp,
  onStorage,
  mcpPaired,
}: {
  onHelp: () => void;
  onStorage: () => void;
  mcpPaired: boolean;
}) {
  const state = useStudioStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const errors = state.analysis?.diagnostics.filter((item) => item.severity === "error").length ?? 0;
  const warnings = state.analysis?.diagnostics.filter((item) => item.severity === "warning").length ?? 0;
  const workflow = state.analysis?.normalized;

  return (
    <header className="studio-header">
      <div className="header-left">
        <button className="icon-button" aria-label="Back to gallery" title="Back to gallery" onClick={() => state.setView("gallery")}>
          <ArrowLeft size={16} />
        </button>
        <Brand compact />
        <span className="header-divider" />
        <div className="workflow-title">
          <strong>{workflow?.metadata.title ?? "Invalid YAML"}</strong>
          <small>{workflow?.metadata.description ?? "Fix the source to resume visual editing."}</small>
        </div>
      </div>
      <div className="header-actions">
        <ThemeToggle compact />
        <button className="icon-button" title="Intro and help" aria-label="Open intro and help" onClick={onHelp} type="button">
          <CircleHelp size={15} aria-hidden="true" />
        </button>
        <button
          className="status-button"
          onClick={() => state.toggleDiagnostics(true)}
          aria-label={`${errors} errors and ${warnings} warnings`}
        >
          {errors ? (
            <span className="status-error">{errors} errors</span>
          ) : (
            <span className="status-ok">
              <CheckCircle2 size={13} />
              Valid
            </span>
          )}
          {warnings > 0 && <span>{warnings} warnings</span>}
        </button>
        <button
          className="icon-button secondary-action"
          title="Undo"
          aria-label="Undo"
          disabled={!state.past.length}
          onClick={() => void state.undo()}
        >
          <Undo2 size={15} />
        </button>
        <button
          className="icon-button secondary-action"
          title="Redo"
          aria-label="Redo"
          disabled={!state.future.length}
          onClick={() => void state.redo()}
        >
          <Redo2 size={15} />
        </button>
        <fieldset className="node-spacing-control secondary-action">
          <legend className="sr-only">Node spacing</legend>
          <button
            type="button"
            title="Decrease node spacing"
            aria-label="Decrease node spacing"
            disabled={state.nodeSpacing <= 0.8}
            onClick={() => void state.adjustNodeSpacing(-1)}
          >
            <Minus size={14} />
          </button>
          <output aria-label={`Node spacing ${Math.round(state.nodeSpacing * 100)} percent`}>{Math.round(state.nodeSpacing * 100)}%</output>
          <button
            type="button"
            title="Increase node spacing"
            aria-label="Increase node spacing"
            disabled={state.nodeSpacing >= 1.6}
            onClick={() => void state.adjustNodeSpacing(1)}
          >
            <Plus size={14} />
          </button>
        </fieldset>
        <fieldset className="mode-switch">
          <legend className="sr-only">Editor view</legend>
          <button
            className={state.centerMode === "canvas" ? "active" : ""}
            onClick={() => state.setCenterMode("canvas")}
            aria-label="Canvas view"
          >
            <Code2 size={14} />
          </button>
          <button
            className={state.centerMode === "split" ? "active" : ""}
            onClick={() => state.setCenterMode("split")}
            aria-label="Split canvas and YAML"
          >
            <Columns2 size={14} />
          </button>
          <button
            className={state.centerMode === "source" ? "active" : ""}
            onClick={() => state.setCenterMode("source")}
            aria-label="YAML source view"
          >
            <Braces size={14} />
          </button>
        </fieldset>
        <select
          className="target-select"
          value={state.target}
          onChange={(event) => void state.setTarget(event.target.value as Target)}
          aria-label="Compile target"
        >
          <option value="codex">Codex</option>
          <option value="claude">Claude</option>
          <option value="hermes">Hermes Agent</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
        </select>
        <button className="compile-button" disabled={state.busy} onClick={() => void state.compile()}>
          <WandSparkles size={15} />
          <span>{state.busy ? "Checking…" : "Compile"}</span>
        </button>
        <button
          className={`mcp-status-button ${mcpPaired ? "paired" : ""}`}
          title={mcpPaired ? "MCP paired — open companion settings" : "Set up MCP companion"}
          aria-label={mcpPaired ? "MCP paired — open companion settings" : "Set up MCP companion"}
          onClick={onStorage}
        >
          <Cable size={14} />
          <span>MCP</span>
          <i aria-hidden="true" />
        </button>
        <button className="icon-button" title="Import YAML" aria-label="Import YAML" onClick={() => fileRef.current?.click()}>
          <FileUp size={15} />
        </button>
        <button
          className="icon-button"
          title="Export YAML"
          aria-label="Export YAML"
          onClick={() => download(`${workflow?.metadata.name ?? "workflow"}.yaml`, state.source, "application/yaml")}
        >
          <Download size={15} />
        </button>
        <button className="icon-button" title="Storage" aria-label="Storage details" onClick={onStorage}>
          <Database size={15} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".yaml,.yml,text/yaml,application/yaml"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2_000_000) {
              setImportError("Import is larger than 2 MB.");
              return;
            }
            await state.setSource(await file.text());
            setImportError("");
            event.target.value = "";
          }}
        />
      </div>
      <section className="mobile-workspace-tools" aria-label="Mobile editor controls">
        <fieldset className="mode-switch mobile-mode-switch">
          <legend className="sr-only">Editor view</legend>
          <button
            className={state.centerMode === "canvas" ? "active" : ""}
            onClick={() => state.setCenterMode("canvas")}
            aria-label="Canvas view"
          >
            <Code2 size={15} />
          </button>
          <button
            className={state.centerMode === "split" ? "active" : ""}
            onClick={() => state.setCenterMode("split")}
            aria-label="Split canvas and YAML"
          >
            <Columns2 size={15} />
          </button>
          <button
            className={state.centerMode === "source" ? "active" : ""}
            onClick={() => state.setCenterMode("source")}
            aria-label="YAML source view"
          >
            <Braces size={15} />
          </button>
        </fieldset>
        <select
          className="target-select mobile-target-select"
          value={state.target}
          onChange={(event) => void state.setTarget(event.target.value as Target)}
          aria-label="Compile target"
        >
          <option value="codex">Codex</option>
          <option value="claude">Claude</option>
          <option value="hermes">Hermes Agent</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
        </select>
        <button
          className="icon-button"
          title="Diagnostics"
          aria-label={`${errors} errors and ${warnings} warnings`}
          onClick={() => state.toggleDiagnostics(true)}
        >
          <CheckCircle2 size={15} />
        </button>
        <button className="icon-button" title="Import YAML" aria-label="Import YAML" onClick={() => fileRef.current?.click()}>
          <FileUp size={15} />
        </button>
        <button
          className="icon-button"
          title="Export YAML"
          aria-label="Export YAML"
          onClick={() => download(`${workflow?.metadata.name ?? "workflow"}.yaml`, state.source, "application/yaml")}
        >
          <Download size={15} />
        </button>
        <button
          className={`icon-button mobile-mcp-button ${mcpPaired ? "paired" : ""}`}
          title={mcpPaired ? "MCP paired — open companion settings" : "Set up MCP companion"}
          aria-label={mcpPaired ? "MCP paired — open companion settings" : "Set up MCP companion"}
          onClick={onStorage}
        >
          <Cable size={15} />
        </button>
        <button className="icon-button" title="Storage" aria-label="Storage details" onClick={onStorage}>
          <Database size={15} />
        </button>
        <button className="icon-button" title="Intro and help" aria-label="Open intro and help" onClick={onHelp} type="button">
          <CircleHelp size={15} aria-hidden="true" />
        </button>
      </section>
      {importError && <div className="import-error">{importError}</div>}
    </header>
  );
}
