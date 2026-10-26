import { t } from "./i18n.ts";

/** User-facing copy for consultation client modes (registry vs pseudonym). */

export const PSEUDONYM_MODE_LABEL = t("Псевдоним (без персональных данных)", "Pseudonym (no personal data)");

export const PSEUDONYM_MODE_HINT = t(
  "Короткая метка вместо ФИО — для визитов без полных персональных данных в реестре.",
  "Short label instead of full name — for visits without complete personal data in the registry.",
);

export const PSEUDONYM_ACK_LABEL = t(
  "Понимаю: не ввожу полные персональные данные — только псевдоним или метку.",
  "I understand: I do not enter full personal data — only a pseudonym or a label.",
);

export const PSEUDONYM_NEW_CARD_LABEL = t("Новый псевдоним", "New Pseudonym");

export const PSEUDONYM_LIST_TITLE = t("Псевдонимы", "Pseudonyms");

/** Shared AI narrative / report chrome. */
export const AI_NARRATIVE_HINT_FILL = t(
  "Напишите или надиктуйте развёрнуто — затем «Заполнить с помощью ИИ». После автоматического заполнения поля ниже можно будет поправить вручную.",
  "Write or dictate in detail — then 'Fill with AI'. After automatic generation, the fields below can be edited manually.",
);

export const AI_NARRATIVE_HINT_CASE_REPORT = t(
  "Напишите или надиктуйте развёрнуто — затем «Сформировать отчет». Отчёт учитывает уже сделанные экспертизы и сводки из карточек участников (если имена совпали). После заполнения текст можно поправить вручную.",
  "Write or dictate in detail — then 'Generate report'. The report takes into account already completed assessments and participant summaries (if names match). After generation, the text can be edited manually.",
);

export const AI_FILL_IDLE = t("Заполнить с помощью ИИ", "Fill with AI");
export const AI_FILL_BUSY = t("ИИ заполняет…", "AI is filling…");

export const AI_REPORT_IDLE = t("Сформировать отчет", "Generate report");
export const AI_REPORT_BUSY = t("Формируем отчёт…", "Generating report…");

export const AI_CASE_REPORT_HINT = t(
  "Отчёт по всему делу: контекст кейса и материалы из индивидуальных карточек участников.",
  "Report on the whole case: case context and materials from individual participant cards.",
);

export const AI_CONSULTATION_REPORT_HINT = t(
  "Итоговый документ по всему делу и экспертизам. Сохраняется здесь же с датой в названии.",
  "Final document on the entire case and assessments. Saved here with the date in its name.",
);
