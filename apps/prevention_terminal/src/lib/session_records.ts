export interface SessionDraft {
  /** School / legacy: combined source line. */
  requestSource: string;
  presentingProblem: string;
  familyContext: string;
  schoolContext: string;
  strengths: string;
  riskNotes: string;
  goals: string;
  /** Commercial primary: who initiated contact. */
  contactedBy?: string;
  /** Commercial primary: focus of the request if not the applicant. */
  concernFor?: string;
  /**
   * Commercial primary: gender of this card’s consultation subject
   * (the person being consulted — usually who came, not «по поводу кого»).
   */
  concernSubjectGender?: string;
  /** Commercial primary: age of this card’s consultation subject (years). */
  concernSubjectAge?: string;
  /** Commercial primary: self / family / org / referral. */
  initiative?: string;
  /** Commercial primary: narrative of reasons for contact (not clinical problems). */
  primaryDescription?: string;
  primaryDescription_notes?: string;
  riskNotes_notes?: string;
  /** Canonical problem_key codes (taxonomy). */
  problemThemes?: { catalog: string[]; custom: string[]; intake_theme_ids?: string[] };
}

export interface SessionRecord {
  record_id: string;
  case_id: string;
  session_no: number;
  content_json: string;
  recorded_at: string;
  created_at: string;
}

export const EMPTY_SESSION_DRAFT: SessionDraft = {
  requestSource: "",
  presentingProblem: "",
  familyContext: "",
  schoolContext: "",
  strengths: "",
  riskNotes: "",
  goals: "",
  contactedBy: "",
  concernFor: "",
  concernSubjectGender: "",
  concernSubjectAge: "",
  initiative: "",
  primaryDescription: "",
  primaryDescription_notes: "",
  riskNotes_notes: "",
};

const SESSION_DRAFT_TEXT_KEYS = [
  "requestSource",
  "presentingProblem",
  "familyContext",
  "schoolContext",
  "strengths",
  "riskNotes",
  "goals",
  "contactedBy",
  "concernFor",
  "concernSubjectGender",
  "concernSubjectAge",
  "initiative",
  "primaryDescription",
] as const;

export function hasSessionDraftContent(draft: SessionDraft): boolean {
  const hasThemes =
    (draft.problemThemes?.catalog.length ?? 0) > 0 ||
    (draft.problemThemes?.custom.length ?? 0) > 0 ||
    (draft.problemThemes?.intake_theme_ids?.length ?? 0) > 0;
  if (hasThemes) return true;
  return SESSION_DRAFT_TEXT_KEYS.some((key) => String(draft[key] ?? "").trim().length > 0);
}

export function parseSessionContent(raw: string): SessionDraft {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionDraft> & {
      problemThemes?: { catalog?: string[]; custom?: string[]; intake_theme_ids?: string[] };
    };
    const themes = parsed.problemThemes;
    return {
      requestSource: parsed.requestSource ?? "",
      presentingProblem: parsed.presentingProblem ?? "",
      familyContext: parsed.familyContext ?? "",
      schoolContext: parsed.schoolContext ?? "",
      strengths: parsed.strengths ?? "",
      riskNotes: parsed.riskNotes ?? "",
      goals: parsed.goals ?? "",
      contactedBy: parsed.contactedBy ?? "",
      concernFor: parsed.concernFor ?? "",
      concernSubjectGender: parsed.concernSubjectGender ?? "",
      concernSubjectAge: parsed.concernSubjectAge ?? "",
      initiative: parsed.initiative ?? "",
      primaryDescription: parsed.primaryDescription ?? "",
      primaryDescription_notes: parsed.primaryDescription_notes ?? "",
      riskNotes_notes: parsed.riskNotes_notes ?? "",
      ...(themes
        ? {
            problemThemes: {
              catalog: Array.isArray(themes.catalog) ? themes.catalog.map(String) : [],
              custom: Array.isArray(themes.custom) ? themes.custom.map(String) : [],
              ...(Array.isArray(themes.intake_theme_ids) && themes.intake_theme_ids.length
                ? { intake_theme_ids: themes.intake_theme_ids.map(String) }
                : {}),
            },
          }
        : {}),
    };
  } catch {
    return EMPTY_SESSION_DRAFT;
  }
}

export function newSessionRecordId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
