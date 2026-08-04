import editionsJson from "../config/terminal_editions.json" with { type: "json" };

export type TerminalEditionId = "intl" | "ru";
export type MapProvider = "google" | "yandex";

export interface TerminalEdition {
  distribution_url: string;
  paywall_url?: string;
  lite_pwa_url: string;
  dashboard_url: string;
  map_provider: MapProvider;
  locale_default: string;
  locales: string[];
  identity_gateway: string | null;
  aggregate_api: string;
  data_residency?: string;
}

const editions = editionsJson.editions as Record<TerminalEditionId, TerminalEdition>;

export function getTerminalEdition(): TerminalEditionId {
  if (typeof window !== "undefined") {
    const p = new URLSearchParams(window.location.search).get("edition");
    if (p === "ru") return "ru";
    if (p === "intl") return "intl";
    if (window.location.pathname.includes("/ru/") || window.location.pathname.startsWith("/ru")) {
      return "ru";
    }
    if (
      window.location.hostname.includes("irpp-edu.ru") ||
      window.location.hostname.includes("ru.prevention.school") ||
      window.location.hostname.includes("ida-ai.chat") ||
      window.location.hostname.includes("ida.chat") ||
      window.location.hostname.includes("ida-ai.design") ||
      window.location.hostname.startsWith("ru.")
    ) {
      return "ru";
    }
    try {
      const stored = localStorage.getItem("terminal_edition");
      if (stored === "ru") return "ru";
      if (stored === "intl") return "intl";
    } catch {}

    const envVal = (typeof import.meta.env !== "undefined" && import.meta.env.VITE_TERMINAL_EDITION) ||
                   (typeof process !== "undefined" && process.env && process.env.VITE_TERMINAL_EDITION);
    if (envVal) {
      return envVal.toLowerCase() === "intl" ? "intl" : "ru";
    }

    if (typeof navigator !== "undefined" && navigator.language && navigator.language.toLowerCase().startsWith("ru")) {
      return "ru";
    }
  }
  const envVal = (typeof import.meta.env !== "undefined" && import.meta.env.VITE_TERMINAL_EDITION) ||
                 (typeof process !== "undefined" && process.env && process.env.VITE_TERMINAL_EDITION);
  const raw = (envVal || "ru").toLowerCase();
  return raw === "intl" ? "intl" : "ru";
}

export function getEditionConfig(): TerminalEdition {
  return editions[getTerminalEdition()];
}

export function editionLabel(id: TerminalEditionId): string {
  return id === "ru" ? "Россия (irpp-edu.ru)" : "International (prevention.school)";
}
