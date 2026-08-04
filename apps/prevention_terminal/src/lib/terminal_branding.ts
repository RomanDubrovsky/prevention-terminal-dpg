import { getTerminalEdition } from "./terminal_edition.ts";
import { getTerminalProductConfig, isIdaProduct } from "./terminal_product.ts";

/** App shell title (header, DOCX meta). */
export function terminalAppTitle(): string {
  const isIntl = getTerminalEdition() === "intl";
  const cfg = getTerminalProductConfig();
  if (cfg.title_ru === "Prevention Terminal — школа" && isIntl) {
    return "Prevention Terminal — School";
  }
  return cfg.title_ru;
}

/** Subtitle under the main title in the shell header. */
export function terminalWorkspaceSubtitle(mode: "specialist" | "manager" | "educator_lite" | "onboarding"): string {
  const isIntl = getTerminalEdition() === "intl";
  if (mode === "manager") {
    return isIntl ? "Specialist Dashboard" : "Дашборд руководителя";
  }
  if (mode === "educator_lite") {
    return isIntl ? "Educator Lite — Free Mode" : "Педагог lite — бесплатный режим";
  }
  return isIntl ? "Workspace Configuration" : "Настройка рабочего места";
}

export function terminalDocxCreator(): string {
  return isIdaProduct() ? "IDA-Terminal" : "Prevention Terminal";
}
