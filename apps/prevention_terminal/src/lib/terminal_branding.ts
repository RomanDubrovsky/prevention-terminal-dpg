import { getTerminalEdition } from "./terminal_edition.ts";
import { getTerminalProductConfig, isIdaProduct } from "./terminal_product.ts";

/** App shell title (header, DOCX meta). */
export function terminalAppTitle(mode?: "specialist" | "manager" | "educator_lite" | "onboarding"): string {
  const isIntl = getTerminalEdition() === "intl";
  if (!isIntl) {
    if (mode === "onboarding") {
      return "Настройка рабочего места";
    }
    if (mode === "manager") {
      return "Рабочее место директора";
    }
    if (mode === "educator_lite") {
      return "Рабочее место педагога";
    }
    return "Рабочее место психолога";
  }
  if (mode === "onboarding") {
    return "Workspace Setup";
  }
  if (mode === "manager") {
    return "Director Workspace";
  }
  if (mode === "educator_lite") {
    return "Educator Workspace";
  }
  const cfg = getTerminalProductConfig();
  if (isIntl) {
    if (isIdaProduct() || (cfg.title_ru && cfg.title_ru.includes("IDA"))) {
      return "IDA Commercial Kit — Workspace";
    }
    return "Prevention Terminal — School Beta";
  }
  return cfg.title_ru + " Beta";
}

/** Subtitle under the main title in the shell header. */
export function terminalWorkspaceSubtitle(mode: "specialist" | "manager" | "educator_lite" | "onboarding"): string {
  const isIntl = getTerminalEdition() === "intl";
  if (mode === "onboarding") {
    return isIntl ? "Setup" : "Настройка";
  }
  return "";
}

export function terminalDocxCreator(): string {
  return isIdaProduct() ? "IDA-Terminal" : "Prevention Terminal";
}

export interface MainLandingInfo {
  url: string;
  label: string;
  sublabel?: string;
}

export interface TerminalHeaderBranding {
  brandMark: string;
  brandPrefix: string;
  brandHighlight: string;
  betaBadge: string;
  landingUrl: string;
  landingTitle: string;
  roleLabel: string;
}

/** Get structured branding details for the top workspace header. */
export function getTerminalHeaderBranding(mode?: "specialist" | "manager" | "educator_lite" | "onboarding"): TerminalHeaderBranding {
  const isIntl = getTerminalEdition() === "intl";
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const roleLabel =
    mode === "onboarding"
      ? isIntl ? "Workspace Setup" : "Настройка"
      : mode === "manager"
      ? isIntl ? "Director Workspace" : "Кабинет руководителя"
      : mode === "educator_lite"
      ? isIntl ? "Educator Workspace" : "Кабинет педагога"
      : isIntl ? "Specialist Workspace" : "Кабинет психолога";

  if (host.includes("academy")) {
    return {
      brandMark: "🎙️",
      brandPrefix: isIntl ? "Academy" : "Академия",
      brandHighlight: "IDA",
      betaBadge: "Beta",
      landingUrl: isIntl ? "https://academy.ida-psy.pro" : "https://academy.ida-psy.ru",
      landingTitle: isIntl ? "Go to IDA Academy (academy.ida-psy.pro)" : "Перейти на сайт Академии IDA (academy.ida-psy.ru)",
      roleLabel,
    };
  }
  if (host.includes("corporate-health")) {
    return {
      brandMark: "🏢",
      brandPrefix: isIntl ? "Corporate" : "Корпоративное",
      brandHighlight: isIntl ? "Health" : "Здоровье",
      betaBadge: "Beta",
      landingUrl: isIntl ? "https://corporate-health.ida-psy.pro" : "https://corporate-health.ida-psy.pro",
      landingTitle: isIntl ? "Go to Corporate Health (corporate-health.ida-psy.pro)" : "Перейти на сайт Корпоративное Здоровье",
      roleLabel,
    };
  }
  if (host.includes("teenology")) {
    return {
      brandMark: "🧭",
      brandPrefix: "Teenology",
      brandHighlight: ".AI",
      betaBadge: "Beta",
      landingUrl: isIntl ? "https://teenology.care" : "https://teenology-ai.ru",
      landingTitle: isIntl ? "Go to Teenology" : "Перейти на сайт Teenology",
      roleLabel,
    };
  }
  if (host.includes("prevention") || host.includes("school") || isIntl) {
    return {
      brandMark: isIntl ? "P" : "П",
      brandPrefix: isIntl ? "Prevention" : "Профилактика",
      brandHighlight: ".AI",
      betaBadge: "Beta",
      landingUrl: isIntl ? "https://prevention.school" : "https://prevention-ai.ru",
      landingTitle: isIntl ? "Go to prevention.school" : "Перейти на сайт Профилактика.AI (prevention-ai.ru)",
      roleLabel,
    };
  }
  if (host.includes("ida-psy.pro")) {
    return {
      brandMark: "I",
      brandPrefix: "IDA",
      brandHighlight: "Psy",
      betaBadge: "Beta",
      landingUrl: "https://ida-psy.pro",
      landingTitle: "Go to IDA Psy (ida-psy.pro)",
      roleLabel,
    };
  }
  // Default IDA
  return {
    brandMark: "I",
    brandPrefix: "IDA",
    brandHighlight: "Psy",
    betaBadge: "Beta",
    landingUrl: isIntl ? "https://ida-psy.pro" : "https://ida-psy.ru",
    landingTitle: isIntl ? "Go to IDA Psy (ida-psy.pro)" : "Перейти на сайт IDA Psy (ida-psy.ru)",
    roleLabel,
  };
}

/** Get the primary marketing / landing website for the current workspace domain. */
export function getMainLandingInfo(): MainLandingInfo {
  if (typeof window === "undefined") {
    return { url: "https://ida-psy.ru", label: "На сайт", sublabel: "Главная страница" };
  }
  const host = window.location.hostname.toLowerCase();
  if (host.includes("academy")) {
    return { url: "https://academy.ida-psy.ru", label: "Сайт Академии", sublabel: "academy.ida-psy.ru" };
  }
  if (host.includes("corporate-health")) {
    return { url: "https://corporate-health.ida-psy.pro", label: "На сайт", sublabel: "corporate-health.ida-psy.pro" };
  }
  if (host.includes("teenology")) {
    return { url: "https://teenology-ai.ru", label: "Сайт Teenology", sublabel: "teenology-ai.ru" };
  }
  if (host.includes("prevention") || host.includes("school")) {
    return { url: "https://prevention-ai.ru", label: "Сайт Школы", sublabel: "prevention-ai.ru" };
  }
  if (host.includes("ida-psy.pro")) {
    return { url: "https://ida-psy.pro", label: "Сайт IDA", sublabel: "ida-psy.pro" };
  }
  return { url: "https://ida-psy.ru", label: "Сайт IDA", sublabel: "ida-psy.ru" };
}
