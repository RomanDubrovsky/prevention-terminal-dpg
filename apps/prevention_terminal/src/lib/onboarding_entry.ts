/**
 * Deep-link entry from prevention.school landings into terminal onboarding.
 *
 *   ?entry=education   — школьная психологическая служба (шаг org пропускается)
 *   ?entry=commercial  — коммерческий центр
 *   ?entry=educator    — сразу рабочее поле педагога (без визарда)
 *
 * Aliases: ?org=education|commercial
 */

import type { OrgTypePreset } from "./terminal_config.ts";
import {
  getProductOrgSegmentForId,
  getTerminalProductId,
  type TerminalProductId,
} from "./terminal_product.ts";

export type OnboardingEntryKind = "default" | "education" | "commercial" | "educator";

export interface OnboardingEntry {
  kind: OnboardingEntryKind;
  orgType: Exclude<OrgTypePreset, ""> | null;
  skipOrgStep: boolean;
  /** URL deep-link vs build-time product line (ida / school). */
  presetSource?: "url" | "product" | "none";
}

const ENTRY_ALIASES: Record<string, OnboardingEntryKind> = {
  education: "education",
  school: "education",
  schools: "education",
  commercial: "commercial",
  center: "commercial",
  centers: "commercial",
  ida: "commercial",
  institute: "commercial",
  irpp: "commercial",
  educator: "educator",
  educator_lite: "educator",
  pedagog: "educator",
  teacher: "educator",
};

function readEntryParam(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("entry") || params.get("org") || params.get("preset") || "").trim().toLowerCase();
}

export function parseOnboardingEntry(raw = readEntryParam()): OnboardingEntry {
  const kind = ENTRY_ALIASES[raw] || "default";
  if (kind === "educator") {
    return { kind, orgType: "education", skipOrgStep: true };
  }
  if (kind === "education") {
    return { kind, orgType: "education", skipOrgStep: true };
  }
  if (kind === "commercial") {
    return { kind, orgType: "commercial", skipOrgStep: true };
  }
  return { kind: "default", orgType: null, skipOrgStep: false };
}

/** Build-time product (ida / school) or URL ?entry= overrides org step visibility. */
export function resolveOnboardingEntryForProduct(
  raw: string,
  productId: TerminalProductId,
): OnboardingEntry {
  const seg = getProductOrgSegmentForId(productId);
  if (seg === "commercial") {
    return {
      kind: "commercial",
      orgType: "commercial",
      skipOrgStep: true,
      presetSource: "product",
    };
  }
  if (seg === "education") {
    return {
      kind: "education",
      orgType: "education",
      skipOrgStep: true,
      presetSource: "product",
    };
  }
  const parsed = parseOnboardingEntry(raw);
  if (parsed.skipOrgStep && parsed.orgType) {
    return { ...parsed, presetSource: "url" };
  }
  return { ...parsed, presetSource: "none" };
}

export function resolveOnboardingEntry(raw = readEntryParam()): OnboardingEntry {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("ida-psy.pro") || host.includes("ida-ai.chat") || host.includes("ida.chat") || host.includes("ida")) {
      return {
        kind: "commercial",
        orgType: "commercial",
        skipOrgStep: true,
        presetSource: "product",
      };
    }
    if (host.includes("prevention.school") || host.includes("teenology.care")) {
      return {
        kind: "education",
        orgType: "education",
        skipOrgStep: true,
        presetSource: "product",
      };
    }
  }
  return resolveOnboardingEntryForProduct(raw, getTerminalProductId());
}

/** Staging / marketing URL with entry preset (path only — host from deploy). */
export function terminalStagingEntryUrl(entry: Exclude<OnboardingEntryKind, "default">): string {
  const base = "/terminal/staging/";
  return `${base}?entry=${entry}`;
}

/** Buyer demo with seeded fictional data. */
export function terminalStagingDemoUrl(workspace: "specialist" | "manager" = "specialist"): string {
  return workspace === "manager" ? "/terminal/staging/?demo=manager" : "/terminal/staging/?demo=1";
}
