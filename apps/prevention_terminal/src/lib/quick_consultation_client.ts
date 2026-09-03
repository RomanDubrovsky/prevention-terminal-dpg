/**
 * Минимальная карточка клиента для журнала консультаций —
 * без маркеров таксономии и без многосторонней «ситуации».
 */

import { invoke } from "@tauri-apps/api/core";

import { buildCasePassport, emptyDraft, newCaseId } from "./case.ts";
import { defaultSituationKind } from "./case_meta.ts";
import { saveCaseArtifacts } from "./case_store.ts";

export async function createConsultationClientCard(args: {
  title: string;
  commercial: boolean;
}): Promise<string> {
  const title = args.title.trim();
  if (!title) {
    throw new Error("Укажите короткое название — как вы узнаете клиента в работе.");
  }
  const caseId = newCaseId();
  const passport = buildCasePassport(emptyDraft());
  await invoke("db_insert_case", {
    caseId,
    taxonomyPassportJson: JSON.stringify(passport),
    notesSanitized: "",
    aliases: [],
  });
  await saveCaseArtifacts(caseId, {
    record_kind: "consultation_lite",
    situation_title: title,
    situation_kind: defaultSituationKind(args.commercial),
  });
  return caseId;
}
