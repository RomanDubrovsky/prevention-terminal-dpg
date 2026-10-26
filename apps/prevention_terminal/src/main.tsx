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

window.addEventListener("error", (event) => {
  const msg = (event.message || "").toLowerCase();
  if (
    msg.includes("unable to preload css") ||
    msg.includes("failed to fetch dynamically imported module")
  ) {
    event.preventDefault();
    handleChunkError();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = String(event?.reason || "").toLowerCase();
  if (
    reason.includes("failed to fetch dynamically imported module") ||
    reason.includes("unable to preload css") ||
    reason.includes("error loading dynamically imported module") ||
    reason.includes("importing a module script failed") ||
    reason.includes("loading chunk")
  ) {
    event.preventDefault();
    handleChunkError();
  }
});

// Service Worker registration for offline and weak connection caching
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  const isAcademyOrWeb =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("academy.ida-psy.ru") ||
     window.location.hostname.includes("web.academy") ||
     new URLSearchParams(window.location.search).get("mode") === "academy" ||
     new URLSearchParams(window.location.search).get("tab") === "academy");

  if (isAcademyOrWeb) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
