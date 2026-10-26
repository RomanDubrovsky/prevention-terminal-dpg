import { invoke } from "@tauri-apps/api/core";

export interface CaseAiContextRow {
  notesSanitized: string;
  yLevel: string;
  xStage: string;
  topicTags: string;
}

/** Build privacy-safe case context block for journal AI (max 4k chars). */
export async function loadCaseAiContext(caseId: string): Promise<string> {
  if (!caseId.trim()) return "";
  try {
    const row = await invoke<CaseAiContextRow | null>("db_get_case_ai_context", {
      caseId,
    });
    if (!row) return "";
    const parts = [
      row.notesSanitized?.trim(),
      row.yLevel ? `Уровень Y: ${row.yLevel}` : "",
      row.xStage ? `Этап X: ${row.xStage}` : "",
      row.topicTags ? `Темы: ${row.topicTags}` : "",
    ].filter(Boolean);
    return parts.join("\n").slice(0, 4000);
  } catch {
    return "";
  }
}
