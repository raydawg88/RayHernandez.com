import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { useThemeStore } from "./stores/useThemeStore";
import { preloadFileSystemData } from "./stores/useFilesStore";
import { initializeI18n } from "./lib/i18n";

// ============================================================================
// CHUNK LOAD ERROR HANDLING
// ============================================================================
const handlePreloadError = (event: Event) => {
  console.warn("[RayOS] Chunk load failed:", event);

  if (!navigator.onLine) {
    console.warn("[RayOS] Skipping reload - device is offline");
    return;
  }

  const reloadKey = "rayos-stale-reload";
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload, 10) < 10000) {
    return;
  }

  sessionStorage.setItem(reloadKey, String(now));
  window.location.reload();
};

window.addEventListener("vite:preloadError", handlePreloadError);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("vite:preloadError", handlePreloadError);
  });
}

// Preload filesystem data early
preloadFileSystemData();

const bootstrap = async () => {
  // Initialize i18n before rendering
  await initializeI18n();

  // Hydrate theme from localStorage before rendering
  useThemeStore.getState().hydrate();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();
