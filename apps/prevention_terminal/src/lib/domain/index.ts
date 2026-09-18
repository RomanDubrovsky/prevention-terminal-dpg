import { getTerminalEdition } from "../terminal_edition.ts";
import { ruDomainConfig } from "./ru.ts";
import { intlDomainConfig } from "./intl.ts";
import type { DomainConfig } from "./types.ts";

export function getDomainConfig(edition?: string): DomainConfig {
  const ed = edition || getTerminalEdition();
  return ed === "intl" ? intlDomainConfig : ruDomainConfig;
}

export * from "./types.ts";
