import {
  ArrowLeft,
  Braces,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Code2,
  Columns2,
  Database,
  Download,
  FileUp,
  Image as ImageIcon,
  Minus,
  Plus,
  Redo2,
  Search,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadText } from "../lib/download";
import type { GraphImageFormat } from "../lib/graphImage";
import { useStudioStore } from "../store/useStudioStore";
import type { Target } from "../types";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

export function StudioHeader({
  onApply,
  onBack,
  onHelp,
  onSearch,
  onStorage,
  canExportImage,
  mcpPaired,
  onExportImage,
}: {
  onApply?: () => void;
  onBack?: () => void;
  onHelp: () => void;
  onSearch?: () => void;
  onStorage: () => void;
  canExportImage: boolean;
  mcpPaired: boolean;
  onExportImage: (format: GraphImageFormat) => Promise<void>;
}) {
  const state = useStudioStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const errors = state.analysis?.diagnostics.filter((item) => item.severity === "error").length ?? 0;
  const warnings = state.analysis?.diagnostics.filter((item) => item.severity === "warning").length ?? 0;
  const workflow = state.analysis?.normalized;
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState<GraphImageFormat | null>(null);

  useEffect(() => {
    setTitleDraft(workflow?.metadata.title ?? workflow?.metadata.name ?? "");
    setDescriptionDraft(workflow?.metadata.description ?? "");
  }, [workflow?.metadata.description, workflow?.metadata.name, workflow?.metadata.title]);

  const saveTitle = async (value: string) => {
    const title = value.trim();
    if (!workflow || !title) {
      setTitleDraft(workflow?.metadata.title ?? workflow?.metadata.name ?? "");
      return;
    }
    setTitleDraft(title);
    if (title !== workflow.metadata.title) await state.patchWorkflowMetadata({ title });
  };

  const saveDescription = async (value: string) => {
    const description = value.trim();
    if (!workflow) return;
    setDescriptionDraft(description);
    if (description !== (workflow.metadata.description ?? "")) await state.patchWorkflowMetadata({ description });
  };

  const exportImage = async (format: GraphImageFormat) => {
    setExportError("");
    setExporting(format);
    try {
      await onExportImage(format);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The graph image could not be exported.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <header className="studio-header">
      <div className="header-left">
        <button
          className="icon-button"
          aria-label={onBack ? "Back to bundle" : "Back to gallery"}
          title={onBack ? "Back to bundle" : "Back to gallery"}
          onClick={onBack ?? (() => state.setView("gallery"))}
        >
          <ArrowLeft size={16} />
        </button>
        <Brand compact />
        <span className="header-divider" />
        {workflow ? (
          <div className="workflow-title workflow-metadata-fields">
            <input
              aria-label="Workflow name"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={(event) => void saveTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <input
              aria-label="Workflow description"
              placeholder="Add workflow details"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onBlur={(event) => void saveDescription(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </div>
        ) : (
          <div className="workflow-title">
            <strong>Invalid YAML</strong>
            <small>Fix the source to resume visual editing.</small>
          </div>
        )}
      </div>
      <div className="header-actions">
        {onSearch ? (
          <button className="catalog-search-trigger" onClick={onSearch} type="button" aria-label="Search catalog">
            <Search size={14} aria-hidden="true" />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
        ) : null}
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
        {onApply ? (
          <button
            className="compile-button studio-apply-button"
            disabled={state.busy || !state.analysis?.ok}
            onClick={onApply}
            type="button"
          >
            <Check size={15} />
            <span>Apply to bundle</span>
          </button>
        ) : null}
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
        <ExportMenu
          canExportImage={canExportImage}
          exporting={exporting}
          name={workflow?.metadata.name ?? "workflow"}
          onExportImage={exportImage}
          source={state.source}
        />
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
        <ExportMenu
          canExportImage={canExportImage}
          exporting={exporting}
          name={workflow?.metadata.name ?? "workflow"}
          onExportImage={exportImage}
          source={state.source}
        />
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
      {(importError || exportError) && <div className="import-error">{importError || exportError}</div>}
    </header>
  );
}

function ExportMenu({
  canExportImage,
  exporting,
  name,
  onExportImage,
  source,
}: {
  canExportImage: boolean;
  exporting: GraphImageFormat | null;
  name: string;
  onExportImage: (format: GraphImageFormat) => Promise<void>;
  source: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as globalThis.Node)) detailsRef.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const close = () => detailsRef.current?.removeAttribute("open");
  const exportImage = (format: GraphImageFormat) => {
    close();
    void onExportImage(format);
  };

  return (
    <details
      className="export-menu"
      ref={detailsRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        close();
        detailsRef.current?.querySelector<HTMLElement>("summary")?.focus();
      }}
    >
      <summary className="icon-button" title="Download workflow" aria-label="Download workflow">
        <Download size={15} />
        <ChevronDown className="export-menu-chevron" size={9} aria-hidden="true" />
      </summary>
      <div className="export-menu-popover" role="menu" aria-label="Download format">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            close();
            downloadText(`${name}.yaml`, source, "application/yaml");
          }}
        >
          <Braces size={15} aria-hidden="true" />
          <span>
            <strong>YAML source</strong>
            <small>Editable workflow definition</small>
          </span>
        </button>
        <button type="button" role="menuitem" disabled={!canExportImage || Boolean(exporting)} onClick={() => exportImage("png")}>
          <ImageIcon size={15} aria-hidden="true" />
          <span>
            <strong>{exporting === "png" ? "Creating PNG…" : "PNG image"}</strong>
            <small>High-resolution raster image</small>
          </span>
        </button>
        <button type="button" role="menuitem" disabled={!canExportImage || Boolean(exporting)} onClick={() => exportImage("svg")}>
          <ImageIcon size={15} aria-hidden="true" />
          <span>
            <strong>{exporting === "svg" ? "Creating SVG…" : "SVG image"}</strong>
            <small>Scalable canvas snapshot</small>
          </span>
        </button>
        {!canExportImage ? <p>Switch to Canvas or Split view to download an image.</p> : null}
      </div>
    </details>
  );
}
