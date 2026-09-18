/**
 * Global Frontend Error Telemetry & Reporting.
 * Automatically intercepts uncaught exceptions, window.onerror, and unhandledrejection
 * and posts them to /api/support/ticket so that the Self-Healing AI Watchdog can diagnose and notify.
 */

import { PLATFORM_API_CANONICAL } from "./platform_api.ts";

const reportedErrors = new Set<string>();

export function reportFrontendError(error: Error | any, context?: string) {
  try {
    const message = error?.message || String(error || "Unknown frontend error");
    const stack = error?.stack || "";
    const url = typeof window !== "undefined" ? window.location.href : "";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

    // Throttling: do not report the exact same error multiple times per page session
    const fingerprint = `${message}:${stack.slice(0, 100)}`;
    if (reportedErrors.has(fingerprint)) {
      return;
    }
    reportedErrors.add(fingerprint);

    const body = {
      userId: "00000000-0000-0000-0000-000000000001",
      app_id: "terminal_frontend",
      category: "technical_error",
      message: `[Frontend UI Error]: ${message}${context ? ` (${context})` : ""}`,
      client_meta: {
        url,
        userAgent,
        stack,
        viewport: typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight } : null,
        timestamp: new Date().toISOString(),
      },
    };

    const endpoint = `${PLATFORM_API_CANONICAL}/api/support/ticket`;

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Failsafe: logging error reporting itself should never crash the app
  }
}

export function initGlobalErrorTelemetry() {
  if (typeof window === "undefined") return;

  window.onerror = (message, source, lineno, colno, error) => {
    reportFrontendError(error || new Error(String(message)), `at ${source}:${lineno}:${colno}`);
  };

  window.addEventListener("unhandledrejection", (event) => {
    reportFrontendError(event.reason || new Error("Unhandled Promise Rejection"), "unhandledrejection");
  });
}
