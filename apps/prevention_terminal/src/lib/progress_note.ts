/**
 * Unified progress note (v2): one schema, DAP/BIRP/GIRP as hint presets only.
 *
 * Stored in work_log_entries.note as JSON with format = progress_note_v2.
 * Legacy dap_v1 / birp_v1 / girp_v1 are normalized on read.
 */

import presetConfig from "../../../../config/progress_note_presets.json" with { type: "json" };
import { t } from "./i18n.ts";

type PresetHintBlock = {
  focus_en?: string;
  focus_ru?: string;
  hint_ru?: string;
};

const presetHints = presetConfig.presets as Record<string, PresetHintBlock>;

function presetHintText(block: PresetHintBlock, locale = "ru"): string {
  if (locale.startsWith("ru")) {
    return String(block.hint_ru || block.focus_ru || block.focus_en || "");
  }
  return String(block.focus_en || block.hint_ru || block.focus_ru || "");
}

export const UNIFIED_NOTE_FORMAT = "progress_note_v2" as const;

/** Hint preset — does not change stored fields, only UI guidance. */
export const NOTE_TEMPLATE_PRESETS = ["dap", "birp", "girp"] as const;
export type NoteTemplatePreset = (typeof NOTE_TEMPLATE_PRESETS)[number];

/** @deprecated Legacy storage ids — read-only migration */
export const DAP_NOTE_FORMAT = "dap_v1" as const;
export const BIRP_NOTE_FORMAT = "birp_v1" as const;
export const GIRP_NOTE_FORMAT = "girp_v1" as const;

const LEGACY_FORMATS = [DAP_NOTE_FORMAT, BIRP_NOTE_FORMAT, GIRP_NOTE_FORMAT] as const;
type LegacyNoteFormat = (typeof LEGACY_FORMATS)[number];

export const SESSION_MODALITIES = [
  "individual",
  "pair",
  "family",
  "group",
  "phone",
  "online",
] as const;
export type SessionModality = (typeof SESSION_MODALITIES)[number];

export const RISK_LEVELS = ["none", "low", "moderate", "high", "crisis"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface UnifiedProgressNote {
  format: typeof UNIFIED_NOTE_FORMAT;
  templatePreset: NoteTemplatePreset;
  goal: string;
  observations: string;
  intervention: string;
  assessmentResponse: string;
  plan: string;
  modality: SessionModality;
  riskLevel: RiskLevel;
  goal_notes?: string;
  observations_notes?: string;
  intervention_notes?: string;
  assessmentResponse_notes?: string;
  plan_notes?: string;
}

export type ProgressNoteContent = UnifiedProgressNote;

export const PRESET_LABELS: Record<NoteTemplatePreset, string> = {
  dap: "DAP",
  birp: "BIRP",
  girp: "GIRP",
};

export const PRESET_HINTS: Record<NoteTemplatePreset, string> = {
  dap: presetHintText(presetHints.dap),
  birp: presetHintText(presetHints.birp),
  girp: presetHintText(presetHints.girp),
};

export const MODALITY_LABELS: Record<SessionModality, string> = {
  individual: t("Индивидуальная", "Individual"),
  pair: t("Парная (двое по одному запросу)", "Couple (two on same request)"),
  family: t("Семейная", "Family"),
  group: t("Групповая", "Group"),
  phone: t("Телефон / переписка", "Phone / correspondence"),
  online: t("Онлайн", "Online"),
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  none: t("Рисков не выявлено", "No risks identified"),
  low: t("Низкий риск", "Low risk"),
  moderate: t("Умеренный риск", "Moderate risk"),
  high: t("Высокий риск", "High risk"),
  crisis: t("Кризис / нужна срочная эскалация", "Crisis / urgent escalation needed"),
};

export const UNIFIED_SECTION_KEYS = [
  "goal",
  "observations",
  "intervention",
  "assessmentResponse",
  "plan",
] as const;

export type UnifiedSectionKey = (typeof UNIFIED_SECTION_KEYS)[number];

export const UNIFIED_SECTION_TITLES: Record<UnifiedSectionKey, string> = {
  goal: t("Проблема", "Problem"),
  observations: t("Что было на встрече", "What happened during the session"),
  intervention: t("Что делали", "What was done"),
  assessmentResponse: t("Текущие выводы", "Current conclusions"),
  plan: t("Рекомендации и задания", "Recommendations and tasks"),
};

/** Simplified visit form labels (consultation v2 UI). */
export const VISIT_STRUCTURE_KEYS = [
  "observations",
  "intervention",
  "assessmentResponse",
  "plan",
] as const;

export type VisitStructureKey = (typeof VISIT_STRUCTURE_KEYS)[number];

export const VISIT_STRUCTURE_TITLES: Record<VisitStructureKey, string> = {
  observations: t("Что было на встрече", "Session observations"),
  intervention: t("Что делали", "Interventions"),
  assessmentResponse: t("Текущие выводы", "Current assessment"),
  plan: t("Рекомендации и задания", "Recommendations & assignments"),
};

export const VISIT_STRUCTURE_HINTS: Record<VisitStructureKey, string> = {
  observations: t("Жалобы, факты, поведение, как проходила встреча.", "Complaints, facts, behavior, how the session went."),
  intervention: t("Техники, вопросы, упражнения, ваши действия.", "Techniques, questions, exercises, your actions."),
  assessmentResponse: t("Ваша интерпретация, динамика, отклик клиента.", "Your interpretation, dynamics, client's response."),
  plan: t("Домашнее задание, следующая встреча, договорённости.", "Homework, next session, agreements."),
};

const PRESET_SECTION_HINTS: Record<NoteTemplatePreset, Record<UnifiedSectionKey, string>> = {
  dap: {
    goal: t("По желанию: с чем пришли или тема встречи.", "Optional: what they came with or the theme of the session."),
    observations: t("Data: жалобы, факты, поведение и контекст (субъективное + объективное).", "Data: complaints, facts, behavior, and context (subjective + objective)."),
    intervention: t("Что делали на сессии — техники, вопросы, упражнения.", "What was done in the session — techniques, questions, exercises."),
    assessmentResponse: t("Assessment: ваша интерпретация, динамика, риски, отклик клиента.", "Assessment: your interpretation, dynamics, risks, client's response."),
    plan: t("Plan: домашнее задание, следующая встреча, согласования.", "Plan: homework, next session, agreements."),
  },
  birp: {
    goal: t("Фокус встречи, если был явный запрос.", "Focus of the session, if there was a clear request."),
    observations: t("Behavior: что делал и говорил клиент, эмоции, реакции.", "Behavior: what the client did and said, emotions, reactions."),
    intervention: t("Intervention: ваши техники и действия на сессии.", "Intervention: your techniques and actions in the session."),
    assessmentResponse: t("Response: как клиент отреагировал; краткая профессиональная оценка.", "Response: how the client reacted; brief professional assessment."),
    plan: t("Plan: шаги до следующего контакта.", "Plan: steps until next contact."),
  },
  girp: {
    goal: t("Goal: цель сессии или шаг ИПР, к которому вели работу.", "Goal: session objective or IRP step being worked towards."),
    observations: t("Контекст и исходная точка относительно цели.", "Context and starting point relative to the goal."),
    intervention: t("Intervention: методы для достижения цели.", "Intervention: methods to achieve the goal."),
    assessmentResponse: t("Response: прогресс к цели, что получилось.", "Response: progress towards the goal, outcomes."),
    plan: t("Plan: корректировка цели, частота встреч, ДЗ.", "Plan: goal adjustment, frequency of sessions, HW."),
  },
};

export function sectionHint(preset: NoteTemplatePreset, key: UnifiedSectionKey): string {
  return PRESET_SECTION_HINTS[preset][key];
}

export type ParsedWorkLogNote =
  | { kind: "structured"; content: UnifiedProgressNote; migratedFrom?: LegacyNoteFormat }
  | { kind: "legacy"; text: string };

export function emptyProgressNote(preset: NoteTemplatePreset = "dap"): UnifiedProgressNote {
  return {
    format: UNIFIED_NOTE_FORMAT,
    templatePreset: preset,
    goal: "",
    observations: "",
    intervention: "",
    assessmentResponse: "",
    plan: "",
    modality: "individual",
    riskLevel: "none",
  };
}

export const EMPTY_DAP_NOTE = emptyProgressNote("dap");

export function hasProgressNoteContent(content: UnifiedProgressNote): boolean {
  return UNIFIED_SECTION_KEYS.some((key) => content[key].trim().length > 0);
}

export function serializeProgressNote(content: UnifiedProgressNote): string {
  return JSON.stringify({
    format: UNIFIED_NOTE_FORMAT,
    templatePreset: content.templatePreset,
    goal: content.goal.trim(),
    observations: content.observations.trim(),
    intervention: content.intervention.trim(),
    assessmentResponse: content.assessmentResponse.trim(),
    plan: content.plan.trim(),
    modality: content.modality,
    riskLevel: content.riskLevel,
    goal_notes: content.goal_notes?.trim() || undefined,
    observations_notes: content.observations_notes?.trim() || undefined,
    intervention_notes: content.intervention_notes?.trim() || undefined,
    assessmentResponse_notes: content.assessmentResponse_notes?.trim() || undefined,
    plan_notes: content.plan_notes?.trim() || undefined,
  });
}

export function parseWorkLogNote(raw: string): ParsedWorkLogNote {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "structured", content: emptyProgressNote() };
  }
  if (!trimmed.startsWith("{")) {
    return { kind: "legacy", text: trimmed };
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const format = parsed.format;

    if (format === UNIFIED_NOTE_FORMAT) {
      return {
        kind: "structured",
        content: normalizeUnified(parsed),
      };
    }

    if (isLegacyFormat(format)) {
      return {
        kind: "structured",
        content: migrateLegacy(format, parsed),
        migratedFrom: format,
      };
    }

    return { kind: "legacy", text: trimmed };
  } catch {
    return { kind: "legacy", text: trimmed };
  }
}

export function isElevatedRisk(level: RiskLevel): boolean {
  return level === "moderate" || level === "high" || level === "crisis";
}

export function setProgressNoteField(
  content: UnifiedProgressNote,
  key: UnifiedSectionKey | "modality" | "riskLevel" | "templatePreset",
  value: string,
): UnifiedProgressNote {
  return { ...content, [key]: value } as UnifiedProgressNote;
}

/** Merge AI segments into draft — fills empty fields; appends when field already has text. */
export type AiMergeMode = "append" | "replace";

export function countFilledSections(content: UnifiedProgressNote): number {
  return UNIFIED_SECTION_KEYS.filter((key) => content[key].trim().length > 0).length;
}

export function applyProgressNoteSegments(
  draft: UnifiedProgressNote,
  segments: Record<string, string>,
  preset: NoteTemplatePreset = draft.templatePreset,
  mergeMode: AiMergeMode = "append",
): UnifiedProgressNote {
  const next: UnifiedProgressNote = { ...draft, templatePreset: preset };
  for (const key of UNIFIED_SECTION_KEYS) {
    const aiVal = String(segments[key] ?? "").trim();
    if (!aiVal) continue;
    if (mergeMode === "replace") {
      next[key] = aiVal;
    } else {
      const cur = next[key].trim();
      next[key] = cur ? `${cur}\n\n${aiVal}` : aiVal;
    }
  }
  const risk = String(segments.riskLevel ?? "").trim().toLowerCase();
  if ((RISK_LEVELS as readonly string[]).includes(risk)) {
    next.riskLevel = risk as RiskLevel;
  }
  return next;
}

function normalizeUnified(parsed: Record<string, unknown>): UnifiedProgressNote {
  const preset = isTemplatePreset(parsed.templatePreset) ? parsed.templatePreset : "dap";
  return {
    format: UNIFIED_NOTE_FORMAT,
    templatePreset: preset,
    goal: String(parsed.goal ?? ""),
    observations: String(parsed.observations ?? ""),
    intervention: String(parsed.intervention ?? ""),
    assessmentResponse: String(parsed.assessmentResponse ?? ""),
    plan: String(parsed.plan ?? ""),
    modality: isModality(parsed.modality) ? parsed.modality : "individual",
    riskLevel: isRiskLevel(parsed.riskLevel) ? parsed.riskLevel : "none",
    goal_notes: parsed.goal_notes ? String(parsed.goal_notes) : undefined,
    observations_notes: parsed.observations_notes ? String(parsed.observations_notes) : undefined,
    intervention_notes: parsed.intervention_notes ? String(parsed.intervention_notes) : undefined,
    assessmentResponse_notes: parsed.assessmentResponse_notes ? String(parsed.assessmentResponse_notes) : undefined,
    plan_notes: parsed.plan_notes ? String(parsed.plan_notes) : undefined,
  };
}

function migrateLegacy(format: LegacyNoteFormat, parsed: Record<string, unknown>): UnifiedProgressNote {
  const modality = isModality(parsed.modality) ? parsed.modality : "individual";
  const riskLevel = isRiskLevel(parsed.riskLevel) ? parsed.riskLevel : "none";
  const plan = String(parsed.plan ?? "");

  switch (format) {
    case BIRP_NOTE_FORMAT:
      return {
        format: UNIFIED_NOTE_FORMAT,
        templatePreset: "birp",
        goal: "",
        observations: String(parsed.behavior ?? ""),
        intervention: String(parsed.intervention ?? ""),
        assessmentResponse: String(parsed.response ?? ""),
        plan,
        modality,
        riskLevel,
      };
    case GIRP_NOTE_FORMAT:
      return {
        format: UNIFIED_NOTE_FORMAT,
        templatePreset: "girp",
        goal: String(parsed.goal ?? ""),
        observations: "",
        intervention: String(parsed.intervention ?? ""),
        assessmentResponse: String(parsed.response ?? ""),
        plan,
        modality,
        riskLevel,
      };
    default:
      return {
        format: UNIFIED_NOTE_FORMAT,
        templatePreset: "dap",
        goal: "",
        observations: String(parsed.data ?? ""),
        intervention: "",
        assessmentResponse: String(parsed.assessment ?? ""),
        plan,
        modality,
        riskLevel,
      };
  }
}

function isLegacyFormat(value: unknown): value is LegacyNoteFormat {
  return typeof value === "string" && LEGACY_FORMATS.includes(value as LegacyNoteFormat);
}

function isTemplatePreset(value: unknown): value is NoteTemplatePreset {
  return typeof value === "string" && NOTE_TEMPLATE_PRESETS.includes(value as NoteTemplatePreset);
}

function isModality(value: unknown): value is SessionModality {
  return typeof value === "string" && SESSION_MODALITIES.includes(value as SessionModality);
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && RISK_LEVELS.includes(value as RiskLevel);
}

// Backward-compatible aliases
export const hasDapContent = hasProgressNoteContent;
export const serializeWorkLogNote = serializeProgressNote;

// Deprecated exports for any external refs
export const PROGRESS_NOTE_FORMATS = NOTE_TEMPLATE_PRESETS;
export type ProgressNoteFormat = NoteTemplatePreset;
export const FORMAT_LABELS = PRESET_LABELS;
export const FORMAT_HINTS = PRESET_HINTS;
