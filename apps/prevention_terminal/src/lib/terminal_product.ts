import productsJson from "../config/terminal_products.json" with { type: "json" };
import type { OrgTypePreset } from "./terminal_config.ts";
import {
  DEFAULT_SITE_PAGE_PATHS,
  parseSitePagePaths,
  serializeSitePagePaths,
  type SitePagePaths,
} from "./site_pages.ts";

export type TerminalProductId = "platform" | "ida" | "school";

export interface TerminalProductConfig {
  title_ru: string;
  org_segment: "education" | "commercial" | null;
  consumer_app: string | null;
  distribution_url?: string;
  default_site_origin?: string;
  site_path_chat?: string;
  site_path_consult?: string;
  site_path_register?: string;
  site_path_iconostasis?: string;
}

const products = productsJson.products as Record<TerminalProductId, TerminalProductConfig>;

export function getTerminalProductId(): TerminalProductId {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("ida-psy.pro") || host.includes("ida-ai.chat") || host.includes("ida.chat") || host.includes("ida")) {
      return "ida";
    }
    if (host.includes("prevention.school") || host.includes("teenology.care")) {
      return "school";
    }
  }
  const raw = String(import.meta.env.VITE_TERMINAL_PRODUCT || "platform")
    .trim()
    .toLowerCase();
  if (raw === "ida" || raw === "school") return raw;
  return "platform";
}

export function getTerminalProductConfig(): TerminalProductConfig {
  return products[getTerminalProductId()] ?? products.platform;
}

/** Fixed org segment for product builds; null = user chooses in onboarding. */
export function getProductOrgSegmentForId(
  productId: TerminalProductId,
): Exclude<OrgTypePreset, ""> | null {
  const seg = (products[productId] ?? products.platform).org_segment;
  if (seg === "education" || seg === "commercial") return seg;
  return null;
}

export function getProductOrgSegment(): Exclude<OrgTypePreset, ""> | null {
  return getProductOrgSegmentForId(getTerminalProductId());
}

export function isIdaProduct(): boolean {
  return getTerminalProductId() === "ida";
}

export function isSchoolProduct(): boolean {
  return getTerminalProductId() === "school";
}

export function productSiteDefaults(): { origin: string; paths: SitePagePaths } | null {
  const cfg = getTerminalProductConfig();
  if (!cfg.default_site_origin?.trim()) return null;
  return {
    origin: cfg.default_site_origin.trim(),
    paths: {
      chat: cfg.site_path_chat || DEFAULT_SITE_PAGE_PATHS.chat,
      consult: cfg.site_path_consult || DEFAULT_SITE_PAGE_PATHS.consult,
      register: cfg.site_path_register || DEFAULT_SITE_PAGE_PATHS.register,
      iconostasis: cfg.site_path_iconostasis || DEFAULT_SITE_PAGE_PATHS.iconostasis,
    },
  };
}

export function defaultSitePagePathsJsonForProduct(): string {
  const d = productSiteDefaults();
  if (!d) return serializeSitePagePaths(parseSitePagePaths(""));
  return serializeSitePagePaths(d.paths);
}
