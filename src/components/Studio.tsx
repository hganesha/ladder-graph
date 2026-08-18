import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GraphImageFormat } from "../lib/graphImage";
import { companionPairingState } from "../lib/mcpCompanion";
import { useStudioStore } from "../store/useStudioStore";
import { Diagnostics } from "./Diagnostics";
import { GraphCanvas, type GraphCanvasHandle } from "./GraphCanvas";
import { Inspector } from "./Inspector";
import { LazyHelpDialog } from "./LazyHelpDialog";
import { OutputPanel } from "./OutputPanel";
import { Palette } from "./Palette";
import { SourceEditor } from "./SourceEditor";
import { StorageDialog } from "./StorageDialog";
import { StudioHeader } from "./StudioHeader";

export function Studio({ onSearch }: { onSearch?: () => void } = {}) {
  const state = useStudioStore();
  const [storageOpen, setStorageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mcpPaired, setMcpPaired] = useState(false);
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  useEffect(() => {
    if (!state.analysis) void useStudioStore.getState().setSource(state.source, false);
  }, [state.analysis, state.source]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 880px)");
    const closeDesktopPanels = (event?: MediaQueryListEvent) => {
      if (!(event?.matches ?? mobile.matches)) return;
      const current = useStudioStore.getState();
      if (current.paletteOpen) current.togglePalette();
      if (current.inspectorOpen) current.toggleInspector();
    };
    closeDesktopPanels();
    mobile.addEventListener("change", closeDesktopPanels);
    return () => mobile.removeEventListener("change", closeDesktopPanels);
  }, []);
  useEffect(() => {
    void companionPairingState().then((status) => setMcpPaired(status.paired));
  }, []);

  const closeMobilePanel = () => {
    const current = useStudioStore.getState();
    if (current.paletteOpen) current.togglePalette();
    if (current.inspectorOpen) current.toggleInspector();
  };
  const openPalette = () => {
    const current = useStudioStore.getState();
    if (current.inspectorOpen && window.matchMedia("(max-width: 880px)").matches) current.toggleInspector();
    if (!current.paletteOpen) current.togglePalette();
  };
  const openInspector = () => {
    const current = useStudioStore.getState();
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
        {state.inspectorOpen && <Inspector />}
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
            : "Local draft"}
        </span>
        <span className={state.runtime === "wasm" ? "wasm-ready" : "fallback-ready"}>
          {state.runtime === "wasm" ? "Rust/WASM core" : "Safe web core"}
        </span>
      </footer>
      {state.diagnosticsOpen && <Diagnostics />}
      {state.outputOpen && <OutputPanel />}
      {storageOpen && <StorageDialog onClose={closeStorage} />}
      {helpOpen ? <LazyHelpDialog onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
