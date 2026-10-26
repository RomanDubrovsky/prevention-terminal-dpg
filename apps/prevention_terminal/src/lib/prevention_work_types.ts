import {
  PREVENTION_LINK_GUIDE,
  PREVENTION_LINK_LABELS_RU,
  PREVENTION_TIER_LABELS_RU,
  preventionLinkGuideGrouped,
  type PreventionLink,
  type PreventionTier,
} from "./prevention_link.ts";

export interface PreventionWorkTypeCatalogItem {
  id: string;
  link: PreventionLink;
  tier: PreventionTier;
  label: string;
}

export interface PreventionWorkTypesSelection {
  catalog: string[];
  custom: string[];
}

export const PREVENTION_WORK_TYPE_CATALOG: PreventionWorkTypeCatalogItem[] = PREVENTION_LINK_GUIDE.flatMap(
  (entry) =>
    entry.workTypes.map((label, index) => ({
      id: `${entry.link}_${index}`,
      link: entry.link,
      tier: entry.tier,
      label,
    })),
);

const CATALOG_BY_ID = new Map(PREVENTION_WORK_TYPE_CATALOG.map((item) => [item.id, item]));

export function emptyPreventionWorkTypes(): PreventionWorkTypesSelection {
  return { catalog: [], custom: [] };
}

export function parsePreventionWorkTypesJson(raw: string): PreventionWorkTypesSelection {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return emptyPreventionWorkTypes();
  try {
    const parsed = JSON.parse(trimmed) as Partial<PreventionWorkTypesSelection>;
    const catalog = Array.isArray(parsed.catalog)
      ? parsed.catalog
          .map((id) => String(id || "").trim())
          .filter((id) => CATALOG_BY_ID.has(id))
      : [];
    const custom = Array.isArray(parsed.custom)
      ? parsed.custom.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    return { catalog: [...new Set(catalog)], custom };
  } catch {
    return emptyPreventionWorkTypes();
  }
}

export function serializePreventionWorkTypes(selection: PreventionWorkTypesSelection): string {
  const catalog = [...new Set(selection.catalog.filter((id) => CATALOG_BY_ID.has(id)))];
  const custom = selection.custom.map((item) => item.trim()).filter(Boolean);
  if (!catalog.length && !custom.length) return "{}";
  return JSON.stringify({ catalog, custom });
}

export function hasPreventionWorkTypes(selection: PreventionWorkTypesSelection): boolean {
  return selection.catalog.length > 0 || selection.custom.length > 0;
}

export function preventionWorkTypeLabel(id: string): string {
  return CATALOG_BY_ID.get(id)?.label ?? id;
}

export function toggleCatalogWorkType(
  selection: PreventionWorkTypesSelection,
  id: string,
): PreventionWorkTypesSelection {
  if (!CATALOG_BY_ID.has(id)) return selection;
  const catalog = new Set(selection.catalog);
  if (catalog.has(id)) catalog.delete(id);
  else catalog.add(id);
  return { ...selection, catalog: [...catalog] };
}

export function addCustomWorkType(
  selection: PreventionWorkTypesSelection,
  text: string,
): PreventionWorkTypesSelection {
  const value = text.trim();
  if (!value) return selection;
  const lower = value.toLowerCase();
  if (selection.custom.some((item) => item.toLowerCase() === lower)) return selection;
  return { ...selection, custom: [...selection.custom, value] };
}

export function removeCustomWorkType(
  selection: PreventionWorkTypesSelection,
  index: number,
): PreventionWorkTypesSelection {
  if (index < 0 || index >= selection.custom.length) return selection;
  return { ...selection, custom: selection.custom.filter((_, i) => i !== index) };
}

export function formatPreventionWorkTypesSummary(selection: PreventionWorkTypesSelection): string {
  const labels = [
    ...selection.catalog.map((id) => preventionWorkTypeLabel(id)),
    ...selection.custom,
  ].filter(Boolean);
  if (!labels.length) return "";
  if (labels.length <= 2) return labels.join("; ");
  return `${labels.slice(0, 2).join("; ")} и ещё ${labels.length - 2}`;
}

export function formatPreventionWorkTypesForAi(selection: PreventionWorkTypesSelection): string {
  const labels = [
    ...selection.catalog.map((id) => preventionWorkTypeLabel(id)),
    ...selection.custom,
  ].filter(Boolean);
  if (!labels.length) return "";
  return labels.map((item) => `• ${item}`).join("\n");
}

export interface PreventionWorkTypesTierGroup {
  tier: PreventionTier;
  label: string;
  links: {
    link: PreventionLink;
    linkLabel: string;
    items: PreventionWorkTypeCatalogItem[];
  }[];
}

export function preventionWorkTypesGroupedByTier(): PreventionWorkTypesTierGroup[] {
  return preventionLinkGuideGrouped().map((group) => ({
    tier: group.tier,
    label: PREVENTION_TIER_LABELS_RU[group.tier],
    links: group.entries.map((entry) => ({
      link: entry.link,
      linkLabel: PREVENTION_LINK_LABELS_RU[entry.link],
      items: PREVENTION_WORK_TYPE_CATALOG.filter((item) => item.link === entry.link),
    })),
  }));
}

export function filterPreventionWorkTypesCatalog(
  groups: PreventionWorkTypesTierGroup[],
  query: string,
): PreventionWorkTypesTierGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      ...group,
      links: group.links
        .map((linkGroup) => ({
          ...linkGroup,
          items: linkGroup.items.filter(
            (item) =>
              item.label.toLowerCase().includes(needle) ||
              linkGroup.linkLabel.toLowerCase().includes(needle),
          ),
        }))
        .filter((linkGroup) => linkGroup.items.length > 0),
    }))
    .filter((group) => group.links.length > 0);
}
