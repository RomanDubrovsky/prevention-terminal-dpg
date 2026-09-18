import { buildCaseBrainContext } from "./case_brain_context.ts";

export interface SupervisionPayload {
  format: "prevention_case_supervision";
  version: number;
  exported_at: string;
  case_id: string;
  title: string;
  context_text: string;
}

export interface ExportSupervisionResult {
  token: string;
  contextLength: number;
  hasContent: boolean;
  payload: SupervisionPayload;
}

/** Serialize a case details into a base64 encoded anonymous brief token with metadata. */
export async function exportAnonymousCaseBriefData(caseId: string, caseTitle: string): Promise<ExportSupervisionResult> {
  const contextText = await buildCaseBrainContext(caseId, { commercial: true });
  const payload: SupervisionPayload = {
    format: "prevention_case_supervision",
    version: 1,
    exported_at: new Date().toISOString(),
    case_id: caseId,
    title: caseTitle || "Анонимный случай",
    context_text: contextText,
  };
  const json = JSON.stringify(payload);
  const token = btoa(unescape(encodeURIComponent(json)));
  const cleanLen = (contextText || "").trim().length;
  return {
    token,
    contextLength: cleanLen,
    hasContent: cleanLen > 40,
    payload,
  };
}

/** Serialize a case details into a base64 encoded anonymous brief token. */
export async function exportAnonymousCaseBrief(caseId: string, caseTitle: string): Promise<string> {
  const res = await exportAnonymousCaseBriefData(caseId, caseTitle);
  return res.token;
}

/** Parse and import a shared anonymous case brief token. */
export function importAnonymousCaseBrief(token: string): SupervisionPayload {
  try {
    const json = decodeURIComponent(escape(atob(token.trim())));
    const parsed = JSON.parse(json) as SupervisionPayload;
    if (parsed.format !== "prevention_case_supervision") {
      throw new Error("Неверный формат токена супервизии");
    }
    return parsed;
  } catch (e) {
    throw new Error("Не удалось распознать токен супервизии. Убедитесь, что скопировали его полностью.");
  }
}
