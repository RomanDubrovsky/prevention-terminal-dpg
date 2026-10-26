import {
  emptyProgressNote,
  NOTE_TEMPLATE_PRESETS,
  parseWorkLogNote,
  RISK_LEVELS,
  SESSION_MODALITIES,
  UNIFIED_NOTE_FORMAT,
  type NoteTemplatePreset,
  type RiskLevel,
  type SessionModality,
  type UnifiedProgressNote,
} from "./progress_note.ts";
import {
  formatConsultationSessionTagsForAi,
  hasConsultationSessionTags,
  parseConsultationSessionTags,
  type ConsultationSessionTags,
} from "./session_tagging.ts";
import { EMPTY_ARTIFACTS, type SessionArtifacts } from "./section_artifacts.ts";
import { formatExpertArtifactsBlock, mergeExpertArtifacts } from "./expert_bridge.ts";

export const CONSULTATION_SESSION_FORMAT = "consultation_session_v1" as const;

/** Парная консультация: совместный визит или поочерёдные индивидуальные по одной проблеме. */
export type PairVisitMode = "joint" | "alternating";

export interface ConsultationPairMeta {
  mode: PairVisitMode;
  /** Второй участник — только маркеры, без ФИО. */
  coParticipant: string;
  /** Связанное личное дело (опционально, коммерческий центр). */
  linkedCaseId?: string;
}

export interface ConsultationSessionPayload {
  format: typeof CONSULTATION_SESSION_FORMAT;
  progress: UnifiedProgressNote;
  artifacts: SessionArtifacts;
  visitDate?: string;
  pair?: ConsultationPairMeta;
  /** Сырой рассказ специалиста (общение с ИИ); рабочий контур — progress + segments. */
  clinicalNarrative?: string;
  /** Тематика (task_kind) и методы (method_tag) — структурированные галочки. */
  sessionTags?: ConsultationSessionTags;
}

export function emptyConsultationSession(preset: NoteTemplatePreset = "dap"): ConsultationSessionPayload {
  return {
    format: CONSULTATION_SESSION_FORMAT,
    progress: emptyProgressNote(preset),
    artifacts: { ...EMPTY_ARTIFACTS },
    sessionTags: undefined,
  };
}

export function serializeConsultationSession(payload: ConsultationSessionPayload): string {
  return JSON.stringify({
    format: CONSULTATION_SESSION_FORMAT,
    templatePreset: payload.progress.templatePreset,
    goal: payload.progress.goal.trim(),
    observations: payload.progress.observations.trim(),
    intervention: payload.progress.intervention.trim(),
    assessmentResponse: payload.progress.assessmentResponse.trim(),
    plan: payload.progress.plan.trim(),
    modality: payload.progress.modality,
    riskLevel: payload.progress.riskLevel,
    visitDate: payload.visitDate?.trim() || undefined,
    pair: payload.pair,
    clinicalNarrative: payload.clinicalNarrative?.trim() || undefined,
    sessionTags:
      payload.sessionTags && hasConsultationSessionTags(payload.sessionTags)
        ? payload.sessionTags
        : undefined,
    artifacts: payload.artifacts,
  });
}

export function parseConsultationSession(raw: string): ConsultationSessionPayload {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    const legacy = parseWorkLogNote(trimmed);
    if (legacy.kind === "structured") {
      return { format: CONSULTATION_SESSION_FORMAT, progress: legacy.content, artifacts: { ...EMPTY_ARTIFACTS } };
    }
    return {
      format: CONSULTATION_SESSION_FORMAT,
      progress: { ...emptyProgressNote(), goal: legacy.text },
      artifacts: { ...EMPTY_ARTIFACTS },
    };
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.format === CONSULTATION_SESSION_FORMAT) {
      return {
        format: CONSULTATION_SESSION_FORMAT,
        progress: progressFromSessionObject(parsed),
        artifacts: normalizeArtifacts(parsed.artifacts),
        visitDate: String(parsed.visitDate || "") || undefined,
        pair: normalizePair(parsed.pair),
        clinicalNarrative: String(parsed.clinicalNarrative || "") || undefined,
        sessionTags: parsed.sessionTags != null ? parseConsultationSessionTags(parsed.sessionTags) : undefined,
      };
    }
    if (parsed.format === UNIFIED_NOTE_FORMAT || String(parsed.format || "").endsWith("_v1")) {
      const progress = parseWorkLogNote(trimmed);
      return {
        format: CONSULTATION_SESSION_FORMAT,
        progress: progress.kind === "structured" ? progress.content : emptyProgressNote(),
        artifacts: { ...EMPTY_ARTIFACTS },
      };
    }
  } catch {
    /* fall through */
  }
  const fallback = parseWorkLogNote(trimmed);
  return {
    format: CONSULTATION_SESSION_FORMAT,
    progress: fallback.kind === "structured" ? fallback.content : emptyProgressNote(),
    artifacts: { ...EMPTY_ARTIFACTS },
  };
}

function progressFromSessionObject(parsed: Record<string, unknown>): UnifiedProgressNote {
  const presetRaw = String(parsed.templatePreset || "dap");
  const preset = (NOTE_TEMPLATE_PRESETS as readonly string[]).includes(presetRaw)
    ? (presetRaw as NoteTemplatePreset)
    : "dap";
  const modalityRaw = String(parsed.modality || "individual");
  const modality = (SESSION_MODALITIES as readonly string[]).includes(modalityRaw)
    ? (modalityRaw as SessionModality)
    : "individual";
  const riskRaw = String(parsed.riskLevel || "none");
  const riskLevel = (RISK_LEVELS as readonly string[]).includes(riskRaw)
    ? (riskRaw as RiskLevel)
    : "none";
  return {
    format: UNIFIED_NOTE_FORMAT,
    templatePreset: preset,
    goal: String(parsed.goal || ""),
    observations: String(parsed.observations || ""),
    intervention: String(parsed.intervention || ""),
    assessmentResponse: String(parsed.assessmentResponse || ""),
    plan: String(parsed.plan || ""),
    modality,
    riskLevel,
  };
}

function normalizePair(value: unknown): ConsultationPairMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const mode = o.mode === "alternating" ? "alternating" : o.mode === "joint" ? "joint" : null;
  if (!mode) return undefined;
  return {
    mode,
    coParticipant: String(o.coParticipant || "").trim(),
    linkedCaseId: String(o.linkedCaseId || "").trim() || undefined,
  };
}

function normalizeArtifacts(value: unknown): SessionArtifacts {
  if (!value || typeof value !== "object") return { ...EMPTY_ARTIFACTS };
  const o = value as Record<string, unknown>;
  return {
    plan_text: String(o.plan_text || ""),
    report_text: String(o.report_text || ""),
    plan_segments: (o.plan_segments as Record<string, string>) || undefined,
    report_segments: (o.report_segments as Record<string, string>) || undefined,
    expert: (o.expert as SessionArtifacts["expert"]) || undefined,
    architect_handoff: String(o.architect_handoff || "") || undefined,
  };
}

export function buildConsultationAiContext(
  progress: UnifiedProgressNote,
  artifacts: SessionArtifacts,
  caseContext: string,
  options?: {
    visitDate?: string;
    pair?: ConsultationPairMeta;
    caseExpert?: SessionArtifacts["expert"];
    priorVisitsNote?: string;
    clinicalNarrative?: string;
    sessionTags?: ConsultationSessionTags;
  },
): string {
  const expertBlock = formatExpertArtifactsBlock(
    mergeExpertArtifacts([options?.caseExpert, artifacts.expert]),
  );
  const pairLine =
    progress.modality === "pair" && options?.pair
      ? `Парная консультация (${options.pair.mode === "joint" ? "совместный визит" : "поочерёдно по одной проблеме"})${
          options.pair.coParticipant ? `: ${options.pair.coParticipant}` : ""
        }`
      : "";
  const parts = [
    caseContext,
    options?.priorVisitsNote || "",
    options?.visitDate ? `Дата посещения: ${options.visitDate}` : "",
    pairLine,
    `Протокол сессии (${progress.templatePreset.toUpperCase()}):`,
    `Формат: ${progress.modality}`,
    `Цель: ${progress.goal}`,
    `Наблюдения: ${progress.observations}`,
    `Вмешательство: ${progress.intervention}`,
    `Оценка: ${progress.assessmentResponse}`,
    `План: ${progress.plan}`,
    options?.sessionTags && hasConsultationSessionTags(options.sessionTags)
      ? formatConsultationSessionTagsForAi(options.sessionTags)
      : "",
    options?.clinicalNarrative
      ? `Сырой рассказ специалиста (для оцифровки, не итоговый документ):\n${options.clinicalNarrative}`
      : "",
    artifacts.plan_text ? `Сохранённый план консультации:\n${artifacts.plan_text}` : "",
    artifacts.report_text ? `Сохранённый отчёт:\n${artifacts.report_text}` : "",
    expertBlock,
  ].filter(Boolean);
  return parts.join("\n");
}
