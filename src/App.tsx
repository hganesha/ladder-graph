import { lazy, Suspense, useEffect, useState } from "react";
import { Studio } from "./components/Studio";
import { Welcome } from "./components/Welcome";
import { useStudioStore } from "./store/useStudioStore";

const BundleStudio = lazy(() => import("./components/BundleStudio"));

export default function App() {
  const view = useStudioStore((state) => state.view);
  const openBlank = useStudioStore((state) => state.openBlank);
  const [bundleOpen, setBundleOpen] = useState(false);

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

  if (bundleOpen) {
    return (
      <Suspense fallback={<div className="workspace-loading">Opening bundle workspace…</div>}>
        <BundleStudio onBack={() => setBundleOpen(false)} />
      </Suspense>
    );
  }
  return view === "gallery" ? <Welcome onBlank={() => void openBlank()} onBundle={() => setBundleOpen(true)} /> : <Studio />;
}
