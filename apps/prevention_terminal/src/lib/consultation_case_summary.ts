import { getCaseArtifacts, saveCaseArtifacts } from "./case_store.ts";

export const CONSULTATION_CASE_SUMMARY_FORMAT = "consultation_case_summary_v1" as const;

export interface ConsultationCaseSummary {
  format: typeof CONSULTATION_CASE_SUMMARY_FORMAT;
  /** Right column: AI / canonical interpretation. */
  conclusions: string;
  recommendations: string;
  dynamics: string;
  homework?: string;
  /** Left column: specialist notes / corrections for AI refine. */
  conclusions_notes?: string;
  recommendations_notes?: string;
  dynamics_notes?: string;
  homework_notes?: string;
  plan_text?: string;
  report_text?: string;
  /** ISO time when report was generated — used in document link title. */
  report_created_at?: string;
  client_report_text?: string;
  updated_at?: string;
}

export function emptyConsultationCaseSummary(): ConsultationCaseSummary {
  return {
    format: CONSULTATION_CASE_SUMMARY_FORMAT,
    conclusions: "",
    recommendations: "",
    dynamics: "",
  };
}

export function parseConsultationCaseSummary(raw: unknown): ConsultationCaseSummary {
  if (!raw || typeof raw !== "object") return emptyConsultationCaseSummary();
  const o = raw as Record<string, unknown>;
  return {
    format: CONSULTATION_CASE_SUMMARY_FORMAT,
    conclusions: String(o.conclusions || "").trim(),
    recommendations: String(o.recommendations || "").trim(),
    dynamics: String(o.dynamics || "").trim(),
    homework: String(o.homework || "").trim() || undefined,
    conclusions_notes: String(o.conclusions_notes || "").trim() || undefined,
    recommendations_notes: String(o.recommendations_notes || "").trim() || undefined,
    dynamics_notes: String(o.dynamics_notes || "").trim() || undefined,
    homework_notes: String(o.homework_notes || "").trim() || undefined,
    client_report_text: String(o.client_report_text || "").trim() || undefined,
    plan_text: String(o.plan_text || "").trim() || undefined,
    report_text: String(o.report_text || "").trim() || undefined,
    report_created_at: String(o.report_created_at || "").trim() || undefined,
    updated_at: String(o.updated_at || "") || undefined,
  };
}

export async function loadConsultationCaseSummary(caseId: string): Promise<ConsultationCaseSummary> {
  const artifacts = await getCaseArtifacts(caseId);
  const nested = (artifacts as Record<string, unknown>).consultation_case_summary;
  return parseConsultationCaseSummary(nested);
}

export async function saveConsultationCaseSummary(
  caseId: string,
  summary: ConsultationCaseSummary,
): Promise<ConsultationCaseSummary> {
  const payload = {
    ...summary,
    format: CONSULTATION_CASE_SUMMARY_FORMAT,
    updated_at: new Date().toISOString(),
  };
  await saveCaseArtifacts(caseId, {
    consultation_case_summary: payload,
  } as Record<string, unknown>);
  return payload;
}
