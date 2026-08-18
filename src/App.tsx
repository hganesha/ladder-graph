import { lazy, Suspense, useEffect, useState } from "react";
import { Studio } from "./components/Studio";
import { Welcome } from "./components/Welcome";
import { useStudioStore } from "./store/useStudioStore";
import type { ProjectRecord } from "./types";

const BundleStudio = lazy(() => import("./components/BundleStudio"));
const StandaloneFormStudio = lazy(() => import("./components/form/StandaloneFormStudio"));
const StructuredArtifactStudio = lazy(() => import("./components/artifacts/StructuredArtifactStudio"));

export default function App() {
  const view = useStudioStore((state) => state.view);
  const openBlank = useStudioStore((state) => state.openBlank);
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

  if (bundleLaunch !== undefined) {
    return (
      <Suspense fallback={<div className="workspace-loading">Opening bundle workspace…</div>}>
        <BundleStudio
          initialProject={bundleLaunch.project}
          initialTemplateId={bundleLaunch.templateId}
          onBack={() => setBundleLaunch(undefined)}
        />
      </Suspense>
    );
  }
  if (formLaunch !== undefined) {
    return (
      <Suspense fallback={<div className="workspace-loading">Opening form studio…</div>}>
        <StandaloneFormStudio
          initialProject={formLaunch.project}
          initialSource={formLaunch.initialSource}
          initialTemplateId={formLaunch.templateId}
          onBack={() => setFormLaunch(undefined)}
        />
      </Suspense>
    );
  }
  if (structuredLaunch !== undefined) {
    return (
      <Suspense fallback={<div className="workspace-loading">Opening {structuredLaunch.artifactKind} studio…</div>}>
        <StructuredArtifactStudio
          artifactKind={structuredLaunch.artifactKind}
          initialProject={structuredLaunch.project}
          initialTemplateId={structuredLaunch.templateId}
          onBack={() => setStructuredLaunch(undefined)}
        />
      </Suspense>
    );
  }
  return view === "gallery" ? (
    <Welcome
      onBlank={() => void openBlank()}
      onBundle={(project, templateId) => setBundleLaunch({ project, templateId })}
      onForm={(project, templateId) => setFormLaunch({ project, templateId })}
      onDocument={(project, templateId) => setStructuredLaunch({ artifactKind: "document", project, templateId })}
      onOntology={(project, templateId) => setStructuredLaunch({ artifactKind: "ontology", project, templateId })}
    />
  ) : (
    <Studio />
  );
}
