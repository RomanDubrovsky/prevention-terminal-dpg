import {
  LEGACY_THEME_TO_PROBLEM_KEY,
  problemKeyLabel,
  PROBLEM_KEY_LABELS_RU,
} from "./taxonomy_picker.ts";
import { INTERVENTION_TECHNIQUE_REGISTRY } from "./intervention_techniques.ts";
import { t } from "./i18n.ts";
import {
  SESSION_FORMAT_CATALOG,
  SESSION_FORMAT_LABELS_RU,
  SESSION_FORMAT_VALUES,
  sessionFormatLabel,
  type SessionFormatId,
} from "./session_format.ts";

/** Mirror of core/taxonomy_engine.py METHOD_TAG_VALUES */
export const METHOD_TAG_VALUES = [
  "cbt",
  "nvc",
  "ta",
  "schema",
  "fairy_tale",
  "gestalt",
  "psychoanalysis",
  "dbt",
  "sfbt",
  "act",
  "family_sys",
  "provocative",
] as const;

export type MethodTag = (typeof METHOD_TAG_VALUES)[number];

export const METHOD_TAG_LABELS_RU: Record<MethodTag, string> = {
  cbt: t("КПТ", "CBT"),
  nvc: t("ННО / ненасильственное общение", "NVC / nonviolent communication"),
  ta: t("Транзактный анализ", "Transactional Analysis"),
  schema: t("Схема-терапия", "Schema Therapy"),
  fairy_tale: t("Сказкотерапия", "Narrative Therapy"),
  gestalt: t("Гештальт", "Gestalt"),
  psychoanalysis: t("Психоанализ", "Psychoanalysis"),
  dbt: t("ДБТ", "DBT"),
  sfbt: t("Краткосрочная терапия, ориентированная на решение", "Solution-Focused Brief Therapy"),
  act: t("ACT / принятие и ответственность", "ACT / Acceptance & Commitment"),
  family_sys: t("Семейные системы", "Family Systems"),
  provocative: t("Провокативная терапия", "Provocative Therapy"),
};

export interface SessionTagCatalogItem {
  id: string;
  label: string;
}

export interface SessionTagSelection {
  catalog: string[];
  custom: string[];
  /** Commercial client-theme ids (card + visit share the same checklist). */
  intake_theme_ids?: string[];
}

export interface ConsultationSessionTags {
  /** Canonical problem_key codes (taxonomy_engine). */
  themes: SessionTagSelection;
  /** Clinical session format — what happened in the room. */
  formats: SessionTagSelection;
  methods: SessionTagSelection;
  /** Named interventions (KB / textbook layer) — rollup to method_tag for stats. */
  techniques: SessionTagSelection;
}

const TECHNIQUE_CATALOG_BY_ID = new Map(
  INTERVENTION_TECHNIQUE_REGISTRY.map((item) => [
    item.code,
    { id: item.code, label: item.labelRu },
  ]),
);

const FORMAT_CATALOG_BY_ID = new Map(
  SESSION_FORMAT_CATALOG.map((item) => [item.id, { id: item.id, label: item.label }]),
);

export const SESSION_FORMAT_TAG_CATALOG = [...FORMAT_CATALOG_BY_ID.values()];

export { SESSION_FORMAT_VALUES, SESSION_FORMAT_LABELS_RU, sessionFormatLabel };
export type { SessionFormatId };

const METHOD_CATALOG_BY_ID = new Map(
  METHOD_TAG_VALUES.map((id) => [id, { id, label: METHOD_TAG_LABELS_RU[id] }]),
);

export const SESSION_METHOD_CATALOG: SessionTagCatalogItem[] = [...METHOD_CATALOG_BY_ID.values()];

/** @deprecated Use problemKeyCatalogForOrg — kept for tests migrating off TASK_KIND. */
export const SESSION_THEME_CATALOG: SessionTagCatalogItem[] = Object.entries(PROBLEM_KEY_LABELS_RU).map(
  ([id, label]) => ({ id, label }),
);

export function taskKindLabel(id: string): string {
  return problemKeyLabel(id);
}

export function methodTagLabel(id: string): string {
  return METHOD_TAG_LABELS_RU[id as MethodTag] ?? id;
}

export function emptySessionTagSelection(): SessionTagSelection {
  return { catalog: [], custom: [] };
}

export function emptyConsultationSessionTags(): ConsultationSessionTags {
  return {
    themes: emptySessionTagSelection(),
    formats: emptySessionTagSelection(),
    methods: emptySessionTagSelection(),
    techniques: emptySessionTagSelection(),
  };
}

function parseSelection(
  raw: unknown,
  allowed: Map<string, SessionTagCatalogItem>,
): SessionTagSelection {
  if (!raw || typeof raw !== "object") return emptySessionTagSelection();
  const parsed = raw as Partial<SessionTagSelection>;
  const allowedSet = new Set(allowed.keys());
  const catalog = Array.isArray(parsed.catalog)
    ? parsed.catalog
        .map((id) => {
          const key = String(id || "").trim();
          if (allowed.has(key)) return key;
          const mapped = LEGACY_THEME_TO_PROBLEM_KEY[key];
          if (mapped && allowedSet.has(mapped)) return mapped;
          return "";
        })
        .filter(Boolean)
    : [];
  const custom = Array.isArray(parsed.custom)
    ? parsed.custom.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const intake_theme_ids = Array.isArray(
    (parsed as SessionTagSelection).intake_theme_ids,
  )
    ? (parsed as SessionTagSelection).intake_theme_ids!
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : undefined;
  return {
    catalog: [...new Set(catalog)],
    custom,
    ...(intake_theme_ids?.length ? { intake_theme_ids: [...new Set(intake_theme_ids)] } : {}),
  };
}

export function parseConsultationSessionTags(
  raw: unknown,
  allowedThemeIds?: Map<string, SessionTagCatalogItem>,
): ConsultationSessionTags {
  if (!raw || typeof raw !== "object") return emptyConsultationSessionTags();
  const parsed = raw as Partial<ConsultationSessionTags>;
  const themeAllowed =
    allowedThemeIds ??
    new Map(SESSION_THEME_CATALOG.map((item) => [item.id, item]));
  return {
    themes: parseSelection(parsed.themes, themeAllowed),
    formats: parseSelection(parsed.formats, FORMAT_CATALOG_BY_ID),
    methods: parseSelection(parsed.methods, METHOD_CATALOG_BY_ID),
    techniques: parseSelection(parsed.techniques ?? emptySessionTagSelection(), TECHNIQUE_CATALOG_BY_ID),
  };
}

export function hasSessionTagSelection(selection: SessionTagSelection): boolean {
  return (
    selection.catalog.length > 0 ||
    selection.custom.length > 0 ||
    (selection.intake_theme_ids?.length ?? 0) > 0
  );
}

export function hasConsultationSessionTags(tags: ConsultationSessionTags): boolean {
  return (
    hasSessionTagSelection(tags.themes) ||
    hasSessionTagSelection(tags.formats) ||
    hasSessionTagSelection(tags.methods) ||
    hasSessionTagSelection(tags.techniques)
  );
}

export function toggleSessionTagCatalog(
  selection: SessionTagSelection,
  id: string,
  allowed: Map<string, SessionTagCatalogItem>,
): SessionTagSelection {
  if (!allowed.has(id)) return selection;
  const catalog = new Set(selection.catalog);
  if (catalog.has(id)) catalog.delete(id);
  else catalog.add(id);
  return { ...selection, catalog: [...catalog] };
}

export function addCustomSessionTag(selection: SessionTagSelection, text: string): SessionTagSelection {
  const value = text.trim();
  if (!value) return selection;
  const lower = value.toLowerCase();
  if (selection.custom.some((item) => item.toLowerCase() === lower)) return selection;
  return { ...selection, custom: [...selection.custom, value] };
}

export function removeCustomSessionTag(selection: SessionTagSelection, index: number): SessionTagSelection {
  if (index < 0 || index >= selection.custom.length) return selection;
  return { ...selection, custom: selection.custom.filter((_, i) => i !== index) };
}

function labelsForSelection(
  selection: SessionTagSelection,
  labelFn: (id: string) => string,
): string[] {
  return [...selection.catalog.map((id) => labelFn(id)), ...selection.custom].filter(Boolean);
}

export function formatSessionTagSelectionSummary(
  selection: SessionTagSelection,
  labelFn: (id: string) => string,
): string {
  const labels = labelsForSelection(selection, labelFn);
  if (!labels.length) return "";
  if (labels.length <= 2) return labels.join("; ");
  return `${labels.slice(0, 2).join("; ")} и ещё ${labels.length - 2}`;
}

export function formatConsultationSessionTagsSummary(tags: ConsultationSessionTags): string {
  const themes = formatSessionTagSelectionSummary(tags.themes, problemKeyLabel);
  const formats = formatSessionTagSelectionSummary(tags.formats, sessionFormatLabel);
  const methods = formatSessionTagSelectionSummary(tags.methods, methodTagLabel);
  const parts = [
    themes ? `темы: ${themes}` : "",
    formats ? `формат: ${formats}` : "",
    methods ? `методы: ${methods}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function formatConsultationSessionTagsForAi(tags: ConsultationSessionTags): string {
  const themeLabels = labelsForSelection(tags.themes, problemKeyLabel);
  const methodLabels = labelsForSelection(tags.methods, methodTagLabel);
  const lines: string[] = [];
  if (themeLabels.length) {
    lines.push("Тематика работы (problem_key):");
    lines.push(...themeLabels.map((item) => `• ${item}`));
  }
  const formatLabels = labelsForSelection(tags.formats, sessionFormatLabel);
  if (formatLabels.length) {
    lines.push("Формат сессии:");
    lines.push(...formatLabels.map((item) => `• ${item}`));
  }
  if (methodLabels.length) {
    lines.push("Терапевтические подходы (method_tag):");
    lines.push(...methodLabels.map((item) => `• ${item}`));
  }
  return lines.join("\n");
}

export function filterSessionTagCatalog(
  catalog: SessionTagCatalogItem[],
  query: string,
): SessionTagCatalogItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return catalog;
  return catalog.filter((item) => item.label.toLowerCase().includes(needle));
}

export type SessionTagsProfile = "consultation" | "group" | "ipr" | "themes_only" | "formats_methods";

export type SessionTags = ConsultationSessionTags;

export interface AiSessionTagsSuggestion {
  /** Canonical problem_key codes. */
  theme_ids?: string[];
  format_ids?: string[];
  method_ids?: string[];
  technique_ids?: string[];
  custom_themes?: string[];
  custom_formats?: string[];
  custom_methods?: string[];
  custom_techniques?: string[];
}

export function profileIncludesMethods(profile: SessionTagsProfile): boolean {
  return profile !== "group";
}

export function parseSessionTagsJson(raw: string): ConsultationSessionTags {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return emptyConsultationSessionTags();
  try {
    return parseConsultationSessionTags(JSON.parse(trimmed));
  } catch {
    return emptyConsultationSessionTags();
  }
}

export function serializeSessionTags(tags: ConsultationSessionTags): string {
  if (!hasConsultationSessionTags(tags)) return "{}";
  return JSON.stringify(tags);
}

function mergeTagSelection(
  current: SessionTagSelection,
  catalogIds: string[],
  custom: string[],
  allowed: Map<string, SessionTagCatalogItem>,
  mode: "replace" | "append",
): SessionTagSelection {
  const allowedSet = new Set(allowed.keys());
  const normalized = catalogIds
    .map((id) => {
      const key = String(id || "").trim();
      if (allowed.has(key)) return key;
      const mapped = LEGACY_THEME_TO_PROBLEM_KEY[key];
      if (mapped && allowedSet.has(mapped)) return mapped;
      return "";
    })
    .filter(Boolean);
  const nextCatalog =
    mode === "replace"
      ? normalized.filter((id) => allowed.has(id))
      : [...new Set([...current.catalog, ...normalized.filter((id) => allowed.has(id))])];
  let nextCustom = mode === "replace" ? [...custom] : [...current.custom];
  for (const item of custom) {
    nextCustom = addCustomSessionTag({ catalog: nextCatalog, custom: nextCustom }, item).custom;
  }
  const catalogUnchanged =
    nextCatalog.length === current.catalog.length &&
    nextCatalog.every((id) => current.catalog.includes(id));
  return {
    catalog: nextCatalog,
    custom: nextCustom,
    ...(catalogUnchanged && current.intake_theme_ids?.length
      ? { intake_theme_ids: [...current.intake_theme_ids] }
      : {}),
  };
}

export function applyAiSessionTagsSuggestion(
  current: ConsultationSessionTags,
  suggestion: AiSessionTagsSuggestion,
  profile: SessionTagsProfile,
  mode: "replace" | "append" = "append",
  allowedThemeIds?: Map<string, SessionTagCatalogItem>,
): ConsultationSessionTags {
  const themeAllowed =
    allowedThemeIds ??
    new Map(SESSION_THEME_CATALOG.map((item) => [item.id, item]));
  const themes = mergeTagSelection(
    current.themes,
    suggestion.theme_ids || [],
    suggestion.custom_themes || [],
    themeAllowed,
    mode,
  );
  const formats = mergeTagSelection(
    current.formats ?? emptySessionTagSelection(),
    suggestion.format_ids || [],
    suggestion.custom_formats || [],
    FORMAT_CATALOG_BY_ID,
    mode,
  );
  if (!profileIncludesMethods(profile)) {
    return { themes, formats, methods: emptySessionTagSelection(), techniques: emptySessionTagSelection() };
  }
  const methods = mergeTagSelection(
    current.methods,
    suggestion.method_ids || [],
    suggestion.custom_methods || [],
    METHOD_CATALOG_BY_ID,
    mode,
  );
  const techniques = mergeTagSelection(
    current.techniques ?? emptySessionTagSelection(),
    suggestion.technique_ids || [],
    suggestion.custom_techniques || [],
    TECHNIQUE_CATALOG_BY_ID,
    mode,
  );
  return { themes, formats, methods, techniques };
}

export function aiSuggestionFromSessionTags(tags: ConsultationSessionTags): AiSessionTagsSuggestion {
  return {
    theme_ids: [...tags.themes.catalog],
    format_ids: [...tags.formats.catalog],
    method_ids: [...tags.methods.catalog],
    technique_ids: [...tags.techniques.catalog],
    custom_themes: [...tags.themes.custom],
    custom_formats: [...tags.formats.custom],
    custom_methods: [...tags.methods.custom],
    custom_techniques: [...tags.techniques.custom],
  };
}
