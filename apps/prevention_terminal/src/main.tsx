import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { initGlobalErrorTelemetry } from "./lib/frontend_telemetry.ts";
import "./styles.css";

// Initialize global window.onerror & unhandledrejection interception for AI auto-healing
initGlobalErrorTelemetry();

// Auto-reload on stale build chunk preload errors (MIME type mismatch on old hashes)
function handleChunkError() {
  const reloaded = sessionStorage.getItem("chunk_reload_retry");
  if (!reloaded) {
    sessionStorage.setItem("chunk_reload_retry", "true");
    window.location.reload();
  }
}

window.addEventListener("vite:preloadError", handleChunkError);

window.addEventListener("unhandledrejection", (event) => {
  const reason = String(event?.reason || "");
  if (
    reason.includes("Failed to fetch dynamically imported module") ||
    reason.includes("error loading dynamically imported module") ||
    reason.includes("Importing a module script failed") ||
    reason.includes("Loading chunk")
  ) {
    event.preventDefault();
    handleChunkError();
  }
});

// Clear stale Service Worker registrations that may cache old HTML/assets
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
