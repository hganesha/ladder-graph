import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Studio } from "./components/Studio";
import { UniversalCatalogSearch } from "./components/UniversalCatalogSearch";
import { CATALOG_SEARCH_SUBJECTS, Welcome } from "./components/Welcome";
import { useStudioStore } from "./store/useStudioStore";
import type { ProjectRecord } from "./types";

const BundleStudio = lazy(() => import("./components/BundleStudio"));
const StandaloneFormStudio = lazy(() => import("./components/form/StandaloneFormStudio"));
const StructuredArtifactStudio = lazy(() => import("./components/artifacts/StructuredArtifactStudio"));

export default function App() {
  const view = useStudioStore((state) => state.view);
  const openBlank = useStudioStore((state) => state.openBlank);
  const [catalogSearchOpen, setCatalogSearchOpen] = useState(false);
  const [bundleLaunch, setBundleLaunch] = useState<{ project?: ProjectRecord; templateId?: string } | undefined>(undefined);
  const [formLaunch, setFormLaunch] = useState<{ project?: ProjectRecord; templateId?: string; initialSource?: string } | undefined>(
    undefined,
  );
  const [structuredLaunch, setStructuredLaunch] = useState<
    { artifactKind: "ontology" | "document"; project?: ProjectRecord; templateId?: string } | undefined
  >(undefined);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void useStudioStore.getState().compile();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? useStudioStore.getState().redo() : useStudioStore.getState().undo());
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCatalogSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const openNodeForm = (event: Event) => {
      const detail = (event as CustomEvent<{ templateId?: string; initialSource?: string }>).detail;
      setFormLaunch(detail);
    };
    window.addEventListener("ladder-open-form", openNodeForm);
    return () => window.removeEventListener("ladder-open-form", openNodeForm);
  }, []);

  let content: ReactNode;
  if (bundleLaunch !== undefined) {
    content = (
      <Suspense fallback={<div className="workspace-loading">Opening bundle workspace…</div>}>
        <BundleStudio
          key={bundleLaunch.project?.id ?? bundleLaunch.templateId ?? "new-bundle"}
          initialProject={bundleLaunch.project}
          initialTemplateId={bundleLaunch.templateId}
          onBack={() => setBundleLaunch(undefined)}
        />
      </Suspense>
    );
  } else if (formLaunch !== undefined) {
    content = (
      <Suspense fallback={<div className="workspace-loading">Opening form studio…</div>}>
        <StandaloneFormStudio
          key={formLaunch.project?.id ?? formLaunch.templateId ?? formLaunch.initialSource ?? "new-form"}
          initialProject={formLaunch.project}
          initialSource={formLaunch.initialSource}
          initialTemplateId={formLaunch.templateId}
          onBack={() => setFormLaunch(undefined)}
        />
      </Suspense>
    );
  } else if (structuredLaunch !== undefined) {
    content = (
      <Suspense fallback={<div className="workspace-loading">Opening {structuredLaunch.artifactKind} studio…</div>}>
        <StructuredArtifactStudio
          key={`${structuredLaunch.artifactKind}:${structuredLaunch.project?.id ?? structuredLaunch.templateId ?? "new"}`}
          artifactKind={structuredLaunch.artifactKind}
          initialProject={structuredLaunch.project}
          initialTemplateId={structuredLaunch.templateId}
          onBack={() => setStructuredLaunch(undefined)}
        />
      </Suspense>
    );
  } else {
    content =
      view === "gallery" ? (
        <Welcome
          onBlank={() => void openBlank()}
          onBundle={(project, templateId) => setBundleLaunch({ project, templateId })}
          onForm={(project, templateId) => setFormLaunch({ project, templateId })}
          onDocument={(project, templateId) => setStructuredLaunch({ artifactKind: "document", project, templateId })}
          onOntology={(project, templateId) => setStructuredLaunch({ artifactKind: "ontology", project, templateId })}
        />
      ) : (
        <Studio onSearch={() => setCatalogSearchOpen(true)} />
      );
  }

  const resetSpecialWorkspaces = () => {
    setBundleLaunch(undefined);
    setFormLaunch(undefined);
    setStructuredLaunch(undefined);
  };

  return (
    <>
      {content}
      {catalogSearchOpen ? (
        <UniversalCatalogSearch
          onBrowseSubject={(subject) => {
            resetSpecialWorkspaces();
            const parameters = new URLSearchParams(window.location.search);
            parameters.delete("q");
            parameters.set("subject", subject);
            window.history.pushState(window.history.state, "", `${window.location.pathname}?${parameters.toString()}`);
            useStudioStore.getState().setView("gallery");
            window.dispatchEvent(new CustomEvent("ladder-browse-subject", { detail: subject }));
          }}
          onClose={() => setCatalogSearchOpen(false)}
          onCreateWithAgent={async (templateId) => {
            resetSpecialWorkspaces();
            await useStudioStore.getState().openAgentTemplate(templateId);
          }}
          onInspectDocument={(templateId) => {
            setBundleLaunch(undefined);
            setFormLaunch(undefined);
            setStructuredLaunch({ artifactKind: "document", templateId });
          }}
          onOpenBundle={(templateId) => {
            setFormLaunch(undefined);
            setStructuredLaunch(undefined);
            setBundleLaunch({ templateId });
          }}
          onOpenForm={(templateId) => {
            setBundleLaunch(undefined);
            setStructuredLaunch(undefined);
            setFormLaunch({ templateId });
          }}
          onOpenWorkflow={async (templateId) => {
            resetSpecialWorkspaces();
            await useStudioStore.getState().openTemplate(templateId);
          }}
          onOpenOntology={(templateId) => {
            setBundleLaunch(undefined);
            setFormLaunch(undefined);
            setStructuredLaunch({ artifactKind: "ontology", templateId });
          }}
          subjects={CATALOG_SEARCH_SUBJECTS}
          variant="dialog"
        />
      ) : null}
    </>
  );
}
