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
  if (cfg.title_ru === "Prevention Terminal — школа" && isIntl) {
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
