import { Component, type ErrorInfo, type ReactNode } from "react";
import { downloadText } from "../lib/download";
import { useStudioStore } from "../store/useStudioStore";

interface ErrorBoundaryProps {
  children: ReactNode;
  scope?: string;
  onExit?: () => void;
  workflowRecovery?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Ladder Graph ${this.props.scope ?? "workspace"} crashed.`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  private exportCurrentSource = () => {
    const { source } = useStudioStore.getState();
    downloadText("ladder-graph-recovery.yaml", source, "application/yaml;charset=utf-8");
  };

  private restoreLastValid = () => {
    const store = useStudioStore.getState();
    void store.setSource(store.lastValidSource, false).finally(this.reset);
  };

  private openLibrary = () => {
    useStudioStore.getState().setView("gallery");
    this.props.onExit?.();
    this.reset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const scope = this.props.scope ?? "workspace";
    const workflowRecovery = this.props.workflowRecovery ?? true;
    return (
      <main className="recovery-screen" role="alert">
        <section className="recovery-card">
          <p className="eyebrow">Recovery mode</p>
          <h1>The {scope} stopped unexpectedly</h1>
          <p>
            {workflowRecovery
              ? "Your local source is still available. Export it now, restore the last valid version, or return to the library."
              : "Your saved local data is still available. Return to the library to reopen this workspace or reload the application."}
          </p>
          <pre>{this.state.error.message || "Unknown rendering error"}</pre>
          <div className="recovery-actions">
            {workflowRecovery ? (
              <>
                <button className="primary-button" type="button" onClick={this.exportCurrentSource}>
                  Export current YAML
                </button>
                <button className="quiet-button" type="button" onClick={this.restoreLastValid}>
                  Restore last valid
                </button>
              </>
            ) : null}
            <button className="quiet-button" type="button" onClick={this.openLibrary}>
              Open library
            </button>
            <button className="quiet-button" type="button" onClick={() => window.location.reload()}>
              Reload application
            </button>
          </div>
        </section>
      </main>
    );
  }
}
