import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GraphImageFormat } from "../lib/graphImage";
import { companionPairingState } from "../lib/mcpCompanion";
import { useStudioStore, useStudioStoreApi } from "../store/useStudioStore";
import { Diagnostics } from "./Diagnostics";
import { ErrorBoundary } from "./ErrorBoundary";
import { GraphCanvas, type GraphCanvasHandle } from "./GraphCanvas";
import { Inspector } from "./Inspector";
import { LazyHelpDialog } from "./LazyHelpDialog";
import { OutputPanel } from "./OutputPanel";
import { Palette } from "./Palette";
import { SourceEditor } from "./SourceEditor";
import { StorageDialog } from "./StorageDialog";
import { StudioHeader } from "./StudioHeader";

export function Studio({
  draftLabel = "Local draft",
  onApply,
  onBack,
  onSearch,
}: {
  draftLabel?: string;
  onApply?: () => void;
  onBack?: () => void;
  onSearch?: () => void;
} = {}) {
  const state = useStudioStore();
  const store = useStudioStoreApi();
  const [storageOpen, setStorageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mcpPaired, setMcpPaired] = useState(false);
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  useEffect(() => {
    if (!state.analysis) void store.getState().setSource(state.source, false);
  }, [state.analysis, state.source, store]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 880px)");
    const closeDesktopPanels = (event?: MediaQueryListEvent) => {
      if (!(event?.matches ?? mobile.matches)) return;
      const current = store.getState();
      if (current.paletteOpen) current.togglePalette();
      if (current.inspectorOpen) current.toggleInspector();
    };
    closeDesktopPanels();
    mobile.addEventListener("change", closeDesktopPanels);
    return () => mobile.removeEventListener("change", closeDesktopPanels);
  }, [store]);
  useEffect(() => {
    void companionPairingState().then((status) => setMcpPaired(status.paired));
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void store.getState().compile();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? store.getState().redo() : store.getState().undo());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  const closeMobilePanel = () => {
    const current = store.getState();
    if (current.paletteOpen) current.togglePalette();
    if (current.inspectorOpen) current.toggleInspector();
  };
  const openPalette = () => {
    const current = store.getState();
    if (current.inspectorOpen && window.matchMedia("(max-width: 880px)").matches) current.toggleInspector();
    if (!current.paletteOpen) current.togglePalette();
  };
  const openInspector = () => {
    const current = store.getState();
    if (current.paletteOpen && window.matchMedia("(max-width: 880px)").matches) current.togglePalette();
    if (!current.inspectorOpen) current.toggleInspector();
  };
  const closeStorage = () => {
    setStorageOpen(false);
    void companionPairingState().then((status) => setMcpPaired(status.paired));
  };

  return (
    <main
      className={`studio-shell ${state.paletteOpen ? "palette-visible" : ""} ${state.inspectorOpen ? "inspector-visible" : ""} ${state.outputOpen ? "output-visible" : ""}`}
    >
      <StudioHeader
        canExportImage={state.centerMode !== "source"}
        mcpPaired={mcpPaired}
        onApply={onApply}
        onBack={onBack}
        onExportImage={(format: GraphImageFormat) =>
          graphCanvasRef.current?.exportImage(format) ?? Promise.reject(new Error("Open the canvas before exporting an image."))
        }
        onHelp={() => setHelpOpen(true)}
        onSearch={onSearch}
        onStorage={() => setStorageOpen(true)}
      />
      <div className="studio-workspace">
        {!state.paletteOpen && (
          <button className="panel-restore panel-restore-left" type="button" aria-label="Open library" onClick={openPalette}>
            <PanelLeftOpen size={15} />
            <span>Library</span>
          </button>
        )}
        {state.paletteOpen && <Palette />}
        <section className={`center-workspace mode-${state.centerMode}`}>
          {state.centerMode !== "source" && <GraphCanvas ref={graphCanvasRef} />}
          {state.centerMode !== "canvas" && <SourceEditor />}
        </section>
        {state.inspectorOpen && (
          <ErrorBoundary scope="inspector">
            <Inspector />
          </ErrorBoundary>
        )}
        {!state.inspectorOpen && (
          <button className="panel-restore panel-restore-right" type="button" aria-label="Open inspector" onClick={openInspector}>
            <span>Inspector</span>
            <PanelRightOpen size={15} />
          </button>
        )}
      </div>
      {(state.paletteOpen || state.inspectorOpen) && (
        <button
          className={`mobile-panel-scrim ${state.paletteOpen ? "after-palette" : "before-inspector"}`}
          type="button"
          aria-label="Close open panel"
          onClick={closeMobilePanel}
        />
      )}
      <footer className="studio-statusbar">
        <span>
          {state.analysis?.stats.nodes ?? 0} nodes · {state.analysis?.stats.edges ?? 0} edges · {state.analysis?.stats.maxParallelism ?? 0}{" "}
          max parallel
        </span>
        <span>
          {state.savedAt
            ? `Saved locally ${new Date(state.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : draftLabel}
        </span>
        <span className="wasm-ready">Rust/WASM core</span>
      </footer>
      {state.diagnosticsOpen && <Diagnostics />}
      {state.outputOpen && <OutputPanel />}
      {storageOpen && <StorageDialog onClose={closeStorage} />}
      {helpOpen ? <LazyHelpDialog initialTopic="workflow" onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
