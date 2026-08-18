import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/syne/600.css";
import "@fontsource/syne/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
import { applyTheme, getInitialTheme } from "./lib/theme";
import { sweepOrphanedRevisionBodies } from "./lib/persistence";

registerSW({ immediate: true });
applyTheme(getInitialTheme(), false);
void sweepOrphanedRevisionBodies();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary scope="application">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
