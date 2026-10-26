import { t } from "../lib/i18n.ts";

export const WORKLOAD_INTRO = t(
  "Здесь фиксируется время работы для циклограммы, хронометража и журналов 4А–Ж. Это отдельный контур от кейсов и профилактической аналитики: одна запись может попасть в отчёт завучу даже без открытого кейса.",
  "Log work hours, workload distribution, and official activity logs. This operates independently from cases and analytics: single activities can be documented directly."
);

export const WORKLOAD_JOURNAL_HINT = t(
  "Вкладки 4А–Ж — это те же журналы из методички, только как фильтры списка. Записи можно добавлять вручную или (позже) подтягивать из консультаций и групповых планов.",
  "Journal tabs filter activities by category. You can add entries manually or pull them automatically from consultations and group programs."
);

export const WORKLOAD_EXPORT_HINT = t(
  "Экспорт собирает Word-таблицу по бланку выбранного журнала. Лишние графы бланка склеиваются в четыре колонки — как в остальных документах Prevention.",
  "Export generates a formatted Word (.docx) table for the selected journal."
);

export const WORKLOAD_CONSULTATION_4B_NOTE = t(
  "Полный протокол консультации (DAP) остаётся во вкладке «Консультации». Здесь — строка нагрузки для журнала 4Б: время, код, повод, динамика.",
  "Full consultation protocol (SOAP/DAP) is stored in 'Consultations'. Here is the workload log row: time, client code, reason, dynamics."
);
