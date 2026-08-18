import { ArrowLeft, CircleHelp, Download, Monitor, Redo2, Save, Smartphone, Undo2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { compiler } from "../../compiler/client";
import { importFormJson } from "../../lib/formJsonImport";
import { createFormOutputFiles } from "../../lib/formOutputs";
import { useFormStore } from "../../store/useFormStore";
import { Brand } from "../Brand";
import { LazyHelpDialog } from "../LazyHelpDialog";
import { ThemeToggle } from "../ThemeToggle";
import { FormCanvas } from "./FormCanvas";
import { FormDiagnostics } from "./FormDiagnostics";
import { FormInspector } from "./FormInspector";
import { FormOutline } from "./FormOutline";
import { FormPreview } from "./FormPreview";
import { FormSourceEditor } from "./FormSourceEditor";

function downloadFile(name: string, mimeType: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function FormStudio({
  initialSource,
  ontologySource,
  onBack,
  onSave,
  contextLabel = "First-class form artifact",
  saveLabel = "Apply to bundle",
}: {
  initialSource: string;
  ontologySource?: string;
  onBack: () => void;
  onSave: (source: string) => void;
  contextLabel?: string;
  saveLabel?: string;
}) {
  const source = useFormStore((state) => state.source);
  const form = useFormStore((state) => state.form);
  const diagnostics = useFormStore((state) => state.diagnostics);
  const busy = useFormStore((state) => state.busy);
  const mode = useFormStore((state) => state.mode);
  const viewport = useFormStore((state) => state.viewport);
  const pastLength = useFormStore((state) => state.past.length);
  const futureLength = useFormStore((state) => state.future.length);
  const load = useFormStore((state) => state.load);
  const setMode = useFormStore((state) => state.setMode);
  const setViewport = useFormStore((state) => state.setViewport);
  const undo = useFormStore((state) => state.undo);
  const redo = useFormStore((state) => state.redo);
  const setSource = useFormStore((state) => state.setSource);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorCount = diagnostics.filter((item) => item.severity === "error").length;
  const dirty = source !== initialSource;
  const shortcutState = useRef({ busy, errorCount, onSave, source });
  shortcutState.current = { busy, errorCount, onSave, source };

  useEffect(() => {
    void load(initialSource, ontologySource);
  }, [initialSource, load, ontologySource]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? redo() : undo());
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        const current = shortcutState.current;
        if (!current.errorCount && !current.busy) current.onSave(current.source);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  return (
    <main className="form-studio">
      <header className="form-studio-header">
        <div>
          <button aria-label="Back" className="icon-button" onClick={onBack} type="button">
            <ArrowLeft size={16} />
          </button>
          <Brand compact />
          <span className="header-divider" />
          <div>
            <strong>{form?.metadata.title ?? "Form studio"}</strong>
            <small>{dirty ? "Unsaved form changes" : contextLabel}</small>
          </div>
        </div>
        <div>
          <button aria-label="Undo" className="icon-button" disabled={!pastLength} onClick={() => void undo()} type="button">
            <Undo2 size={15} />
          </button>
          <button aria-label="Redo" className="icon-button" disabled={!futureLength} onClick={() => void redo()} type="button">
            <Redo2 size={15} />
          </button>
          <ThemeToggle compact />
          <button aria-label="Open form help" className="icon-button" onClick={() => setHelpOpen(true)} title="Form help" type="button">
            <CircleHelp size={15} aria-hidden="true" />
          </button>
          <button aria-label="Import JSON" className="quiet-button" onClick={() => fileRef.current?.click()} type="button">
            <Upload size={14} /> Import JSON
          </button>
          <input
            accept=".json,application/json,application/schema+json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 2_000_000) throw new Error("Import is larger than 2 MB.");
                const imported = importFormJson(await file.text(), file.name);
                const analysis = await compiler.analyzeArtifact(imported.source);
                if (!analysis.ok) {
                  const firstError = analysis.diagnostics.find((diagnostic) => diagnostic.severity === "error");
                  throw new Error(firstError?.message ?? "The JSON does not describe a valid form.");
                }
                await setSource(imported.source);
                setImportError("");
                setImportMessage(`Imported ${imported.fieldCount} ${imported.fieldCount === 1 ? "field" : "fields"} from ${file.name}.`);
              } catch (error) {
                setImportMessage("");
                setImportError(error instanceof Error ? error.message : "JSON import failed.");
              } finally {
                event.target.value = "";
              }
            }}
            ref={fileRef}
            type="file"
          />
          <button
            className="quiet-button"
            disabled={!form || Boolean(errorCount)}
            onClick={() => {
              if (!form) return;
              for (const file of createFormOutputFiles(form)) downloadFile(file.name, file.mimeType, file.content);
            }}
            type="button"
          >
            <Download size={14} /> Export outputs
          </button>
          <button className="compile-button" disabled={busy || Boolean(errorCount)} onClick={() => onSave(source)} type="button">
            <Save size={14} /> {saveLabel}
          </button>
        </div>
      </header>

      <div className="form-studio-toolbar">
        <div role="tablist" aria-label="Form editor views">
          {(["builder", "preview", "source"] as const).map((item) => (
            <button
              aria-selected={mode === item}
              className={mode === item ? "active" : undefined}
              key={item}
              onClick={() => setMode(item)}
              role="tab"
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div>
          {importError || importMessage ? (
            <span className={importError ? "form-import-status error" : "form-import-status"} role={importError ? "alert" : "status"}>
              {importError || importMessage}
            </span>
          ) : null}
          {mode === "preview" ? (
            <fieldset className="form-viewport-control">
              <legend className="sr-only">Preview width</legend>
              <button
                aria-label="Desktop preview"
                className={viewport === "desktop" ? "active" : undefined}
                onClick={() => setViewport("desktop")}
                type="button"
              >
                <Monitor size={14} /> Desktop
              </button>
              <button
                aria-label="Narrow preview"
                className={viewport === "narrow" ? "active" : undefined}
                onClick={() => setViewport("narrow")}
                type="button"
              >
                <Smartphone size={14} /> Narrow
              </button>
            </fieldset>
          ) : (
            <span className="form-save-status">{busy ? "Validating…" : `${errorCount} errors · ${dirty ? "draft" : "saved"}`}</span>
          )}
        </div>
      </div>

      <div className="form-studio-layout">
        <FormOutline />
        <section className="form-studio-center" role="tabpanel">
          {mode === "builder" ? <FormCanvas /> : null}
          {mode === "preview" ? (
            <div className={`form-preview-viewport ${viewport}`}>{form ? <FormPreview form={form} /> : null}</div>
          ) : null}
          {mode === "source" ? <FormSourceEditor /> : null}
        </section>
        <FormInspector />
        <FormDiagnostics />
      </div>
      {helpOpen ? <LazyHelpDialog initialTopic="forms" onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
