import type { DomainConfig } from "./types.ts";

export const intlDomainConfig: DomainConfig = {
  protocols: {
    caseExpertise: [
      { id: "child_profile", label: "Profile" },
      { id: "conclusion", label: "Psychological Report" },
      { id: "fba", label: "FBA" },
      { id: "bip", label: "BIP" },
      { id: "mdr", label: "MDR" },
      { id: "audit", label: "Audit" },
    ],
    iprExpertise: [
      { id: "child_profile", label: "Profile" },
      { id: "conclusion", label: "Psychological Report" },
      { id: "fba", label: "FBA" },
      { id: "mdr", label: "MDR" },
    ],
  },
  aiPrompts: {
    conclusion: "Draft a comprehensive psychological report based on the provided materials.",
    mdr: "Draft a Multi-Disciplinary Review (MDR) based on the provided materials.",
  },
  labels: {
    conclusion: "Psychological Report",
    mdr: "MDR",
    fba: "FBA",
    bip: "BIP",
    child_profile: "Profile",
    audit: "Audit",
    program_audit: "Program Audit",
  },
};
