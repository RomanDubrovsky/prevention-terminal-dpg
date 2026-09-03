import { getTerminalEdition } from "./terminal_edition.ts";

/**
 * A very lightweight i18n utility.
 * If we are running in the 'intl' edition, it returns the english string (if provided).
 * Otherwise it defaults to the russian string.
 */
export function t(ruString: string, enString?: string): string {
  const edition = getTerminalEdition();
  if (edition === "intl" && enString) {
    return enString;
  }
  return ruString;
}
