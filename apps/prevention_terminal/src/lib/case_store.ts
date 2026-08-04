import { invoke } from "@tauri-apps/api/core";

import type { SituationKind } from "./case_meta.ts";
import type { CaseIdaLeadLink } from "./ida_intake_bridge.ts";
import type { CaseRecordKind, RegistryProfile } from "./registry_profile.ts";
import type { SessionArtifacts } from "./section_artifacts.ts";

export type ExternalLinkScope = "case" | "participant" | "event";

export interface CaseExternalLink {
  id: string;
  app: "teenology" | "ida";
  scope: ExternalLinkScope;
  token_ref?: string;
  participant_alias_id?: string;
  active_from?: string;
  active_until?: string;
  snapshot?: Record<string, string>;
}

/** Link from situation-case alias to an individual consultation card (no ФИО). */
export interface CaseParticipantCardLink {
  alias_id: string;
  role: string;
  role_no: number;
  /** Matched consultation / registry card id, if found by local name. */
  card_case_id?: string;
}

export interface CaseAiAnalysis {
  id: string;
  label: string;
  text: string;
  saved_at: string;
}

export interface CaseArtifactsPayload {
  record_kind?: CaseRecordKind;
  registry_profile?: RegistryProfile;
  situation_title?: string;
  situation_kind?: SituationKind | string;
  situation_notes_append?: string;
  situation_synthesis?: { text: string; saved_at?: string };
  /** Итоговый отчёт по многостороннему кейсу. */
  situation_report?: { text: string; saved_at?: string };
  /** Alias → individual card links for pulling card expertises into case reports. */
  participant_links?: CaseParticipantCardLink[];
  expert?: SessionArtifacts["expert"];
  expert_by_participant?: Record<
    string,
    Partial<Record<import("./section_artifacts.ts").ExpertProtocolId, import("./section_artifacts.ts").ExpertArtifact>>
  >;
  external_links?: CaseExternalLink[];
  /** Локальная заявка IDA inbox, привязанная к делу. */
  ida_lead?: CaseIdaLeadLink;
  updated_at?: string;
  /** Сводка: выводы, рекомендации, динамика (консультации). */
  consultation_case_summary?: import("./consultation_case_summary.ts").ConsultationCaseSummary;
  /** История всех ИИ-анализов и заключений по кейсу. */
  ai_analyses?: CaseAiAnalysis[];
}

export interface CaseSummary {
  case_id: string;
  situation_title: string;
  situation_kind: string;
  participant_count: number;
  y_level: string;
  x_stage: string;
  created_at: string;
  updated_at: string;
}

export async function listCaseSummaries(): Promise<CaseSummary[]> {
  return invoke<CaseSummary[]>("db_list_case_summaries");
}

export function parseCaseArtifacts(raw: string): CaseArtifactsPayload {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return {};
  try {
    return JSON.parse(trimmed) as CaseArtifactsPayload;
  } catch {
    return {};
  }
}

export async function getCaseArtifacts(caseId: string): Promise<CaseArtifactsPayload> {
  const raw = await invoke<string>("db_get_case_artifacts", { caseId });
  return parseCaseArtifacts(raw);
}

export async function saveCaseArtifacts(
  caseId: string,
  patch: Partial<CaseArtifactsPayload>,
): Promise<CaseArtifactsPayload> {
  const existing = await getCaseArtifacts(caseId);
  const merged: CaseArtifactsPayload = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.expert_by_participant) {
    merged.expert_by_participant = {
      ...(existing.expert_by_participant || {}),
      ...patch.expert_by_participant,
    };
  }
  if (patch.external_links) {
    merged.external_links = patch.external_links;
  }
  if (patch.ai_analyses) {
    merged.ai_analyses = [
      ...(existing.ai_analyses || []),
      ...patch.ai_analyses,
    ];
  }
  await invoke("db_update_case_artifacts", {
    caseId,
    payload: {
      case_artifacts_json: JSON.stringify(merged),
    },
  });
  return merged;
}
