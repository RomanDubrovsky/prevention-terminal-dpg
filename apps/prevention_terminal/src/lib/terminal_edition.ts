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
    const params = new URLSearchParams(window.location.search);
    const p = (params.get("edition") || params.get("lang") || params.get("locale") || "").toLowerCase();
    if (p === "ru") return "ru";
    if (p === "intl" || p === "en") return "intl";

    const path = window.location.pathname.toLowerCase();
    if (path.startsWith("/ru") || path.includes("/ru/")) {
      return "ru";
    }
    if (path.startsWith("/en") || path.includes("/en/")) {
      return "intl";
    }

    const host = window.location.hostname.toLowerCase();
    // Russian domains (prevention-ai.ru, ida-psy.ru, any .ru domain)
    if (
      host.endsWith(".ru") ||
      host.includes(".ru:") ||
      host.startsWith("ru.") ||
      host.includes("prevention-ai.ru") ||
      host.includes("ida-psy.ru")
    ) {
      return "ru";
    }

    // International domains (ida-psy.pro, prevention.school, teenology.care, any .pro / .school domain)
    if (
      host.endsWith(".pro") ||
      host.includes(".pro:") ||
      host.endsWith(".school") ||
      host.includes(".school:") ||
      host.includes("prevention.school") ||
      host.includes("ida-psy.pro") ||
      host.includes("ida-ai.chat") ||
      host.includes("teenology.care")
    ) {
      return "intl";
    }

    try {
      const stored = localStorage.getItem("terminal_edition");
      if (stored === "ru") return "ru";
      if (stored === "intl" || stored === "en") return "intl";
    } catch {}

    const envVal = (typeof import.meta.env !== "undefined" && import.meta.env.VITE_TERMINAL_EDITION) ||
                   (typeof process !== "undefined" && process.env && process.env.VITE_TERMINAL_EDITION);
    if (envVal) {
      return envVal.toLowerCase() === "intl" || envVal.toLowerCase() === "en" ? "intl" : "ru";
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
  return id === "ru" ? "Россия" : "International (prevention.school)";
}
