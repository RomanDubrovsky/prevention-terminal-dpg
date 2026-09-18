import type { DomainConfig } from "./types.ts";

export const ruDomainConfig: DomainConfig = {
  protocols: {
    caseExpertise: [
      { id: "child_profile", label: "Характеристика" },
      { id: "conclusion", label: "025/у" },
      { id: "fba", label: "ФАП" },
      { id: "bip", label: "BIP" },
      { id: "mdr", label: "ППк" },
      { id: "audit", label: "Аудит" },
    ],
    iprExpertise: [
      { id: "child_profile", label: "Характеристика" },
      { id: "conclusion", label: "025/у" },
      { id: "fba", label: "ФАП" },
      { id: "mdr", label: "ППк" },
    ],
  },
  aiPrompts: {
    conclusion: "Сформируй психологическое заключение по структуре формы 025/у на основе предоставленных материалов.",
    mdr: "Сформируй заключение ППк по предоставленным материалам.",
  },
  labels: {
    conclusion: "025/у",
    mdr: "ППк",
    fba: "ФАП",
    bip: "BIP",
    child_profile: "Характеристика",
    audit: "Аудит",
    program_audit: "Анализ профилактической программы",
  },
};
