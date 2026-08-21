import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Auto-reload on stale build chunk preload errors (MIME type mismatch on old hashes)
window.addEventListener("vite:preloadError", () => {
  const reloaded = sessionStorage.getItem("chunk_reload_retry");
  if (!reloaded) {
    sessionStorage.setItem("chunk_reload_retry", "true");
    window.location.reload();
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
    <App />
  </React.StrictMode>
);
