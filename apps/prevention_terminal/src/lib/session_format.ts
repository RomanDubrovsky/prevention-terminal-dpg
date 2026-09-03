/** Clinical session format — what happened in the room (distinct from method_tag). */
import { t } from "./i18n.ts";

export const SESSION_FORMAT_VALUES = [
  "diagnostic",
  "motivational_interview",
  "psychoeducation",
  "mediation",
  "therapy_work",
  "crisis",
  "closing_review",
] as const;

export type SessionFormatId = (typeof SESSION_FORMAT_VALUES)[number];

export const SESSION_FORMAT_LABELS_RU: Record<SessionFormatId, string> = {
  diagnostic: t("Диагностическая / intake-беседа", "Diagnostic / intake interview"),
  motivational_interview: t("Мотивационное интервью", "Motivational interview"),
  psychoeducation: t("Психообразование", "Psychoeducation"),
  mediation: t("Медиация / переговоры", "Mediation / negotiation"),
  therapy_work: t("Рабочая терапевтическая сессия", "Therapeutic work session"),
  crisis: t("Кризисное вмешательство", "Crisis intervention"),
  closing_review: t("Завершающая / ревизия целей", "Closing / goal review"),
};

export interface SessionFormatCatalogItem {
  id: SessionFormatId;
  label: string;
}

export const SESSION_FORMAT_CATALOG: SessionFormatCatalogItem[] = SESSION_FORMAT_VALUES.map((id) => ({
  id,
  label: SESSION_FORMAT_LABELS_RU[id],
}));

export function sessionFormatLabel(id: string): string {
  return SESSION_FORMAT_LABELS_RU[id as SessionFormatId] ?? id;
}
