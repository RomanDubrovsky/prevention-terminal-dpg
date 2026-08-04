/**
 * Реестр типовых форм педагога-психолога (методичка, Новосибирск).
 * Источник: docs/forms/ru_school_psychologist/nsk_methodical_pack_forms_1-16.pdf
 *
 * Экспорт строится через единый 4-колоночный DATA_STREAM (как Architect / document_service),
 * даже если в бланке больше граф — лишнее уходит в PASSPORT или склеивается в ячейки.
 */

import type { ActivityKind } from "./taxonomy.ts";

export type SchoolFormId =
  | "form_01_year_plan"
  | "form_02_month_plan"
  | "form_02a_week_plan"
  | "form_03a_cycleogram_dou"
  | "form_03b_cycleogram_school"
  | "journal_4a_diagnostic"
  | "journal_4b_consultation"
  | "journal_4c_correction_individual"
  | "journal_4d_correction_group"
  | "journal_4e_enlightenment"
  | "journal_4f_expert"
  | "journal_4g_org_method"
  | "form_05a_statistics"
  | "form_05_analytical_report"
  | "form_06_conclusion"
  | "form_07_ipp_card"
  | "form_08_group_program"
  | "form_09_individual_program"
  | "form_11_protocol"
  | "form_12_consilium"
  | "form_14_methods_registry"
  | "form_15_characteristic"
  | "form_16_parent_consent";

export type SchoolFormCategory =
  | "period_plan"
  | "workload_journal"
  | "cycleogram"
  | "aggregate_report"
  | "case_artifact"
  | "plan_card";

export interface SchoolFormColumn {
  /** Заголовок в печатном бланке (как в PDF). */
  source: string;
  /** Ключ поля в данных / work_entry. */
  field: string;
}

export interface SchoolFormFourColSpec {
  headers: [string, string, string, string];
  /** Индексы source-колонок (0-based), которые попадают в каждую из 4 колонок DOCX. */
  pack: [number[], number[], number[], number[]];
  widths?: [number, number, number, number];
}

export interface SchoolFormDefinition {
  id: SchoolFormId;
  number: string;
  title: string;
  category: SchoolFormCategory;
  sourceColumns: SchoolFormColumn[];
  fourCol: SchoolFormFourColSpec;
  /** Откуда берутся строки при автозаполнении. */
  dataSource:
    | { kind: "work_entries"; activityKinds: ActivityKind[] }
    | { kind: "consultations" }
    | { kind: "period_plan"; period: "year" | "month" | "week" }
    | { kind: "cycleogram"; preset: "dou" | "school" }
    | { kind: "aggregates"; template: "form_05a" | "form_05" }
    | { kind: "plan_card"; planType: "group" | "ipr" | "organization" }
    | { kind: "case_artifact"; artifactType: string }
    | { kind: "methods_catalog" };
  notes?: string;
}

/** Семь журналов 4А–Ж: буква в методичке ≠ порядок в списке видов работ. */
export const SCHOOL_JOURNAL_FORM_IDS: SchoolFormId[] = [
  "journal_4a_diagnostic",
  "journal_4b_consultation",
  "journal_4c_correction_individual",
  "journal_4d_correction_group",
  "journal_4e_enlightenment",
  "journal_4f_expert",
  "journal_4g_org_method",
];

export const SCHOOL_PSYCHOLOGIST_FORM_REGISTRY: Record<SchoolFormId, SchoolFormDefinition> = {
  form_01_year_plan: {
    id: "form_01_year_plan",
    number: "1",
    title: "План работы на учебный год",
    category: "period_plan",
    sourceColumns: [
      { source: "Контингент", field: "audience_contingent" },
      { source: "Вид деятельности", field: "activity_label" },
      { source: "Предполагаемые формы и средства", field: "forms_and_means" },
      { source: "Цели и задачи", field: "goals" },
      { source: "Сроки", field: "period" },
    ],
    fourCol: {
      headers: ["Контингент / вид", "Формы и средства", "Цели и задачи", "Сроки"],
      pack: [[0, 1], [2], [3], [4]],
      widths: [1.4, 2.2, 2.6, 1.2],
    },
    dataSource: { kind: "period_plan", period: "year" },
  },
  form_02_month_plan: {
    id: "form_02_month_plan",
    number: "2",
    title: "Дифференцированный план на месяц",
    category: "period_plan",
    sourceColumns: [
      { source: "Виды профессиональной деятельности", field: "activity_label" },
      { source: "Срок проведения", field: "period" },
      { source: "Участники (возрастная группа)", field: "audience_note" },
      { source: "Формы и средства проф. деятельности", field: "forms_and_means" },
      { source: "Ожидаемые результаты", field: "expected_results" },
    ],
    fourCol: {
      headers: ["Вид деятельности", "Срок", "Участники", "Формы / результат"],
      pack: [[0], [1], [2], [3, 4]],
      widths: [1.6, 1.2, 1.6, 2.0],
    },
    dataSource: { kind: "period_plan", period: "month" },
  },
  form_02a_week_plan: {
    id: "form_02a_week_plan",
    number: "2А",
    title: "План работы на рабочую неделю",
    category: "period_plan",
    sourceColumns: [
      { source: "Дата", field: "work_date" },
      { source: "Планируемые мероприятия", field: "title" },
      { source: "Время и место проведения", field: "time_and_place" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата", "Мероприятия", "Время и место", "Примечание"],
      pack: [[0], [1], [2], [3]],
      widths: [1.0, 2.8, 1.6, 1.0],
    },
    dataSource: { kind: "period_plan", period: "week" },
  },
  form_03a_cycleogram_dou: {
    id: "form_03a_cycleogram_dou",
    number: "3А",
    title: "Циклограмма (дошкольное учреждение)",
    category: "cycleogram",
    sourceColumns: [
      { source: "День недели", field: "weekday" },
      { source: "Время", field: "time_slot" },
      { source: "Содержание работы", field: "title" },
    ],
    fourCol: {
      headers: ["День недели", "Время", "Содержание", "Минуты"],
      pack: [[0], [1], [2], []],
      widths: [1.2, 1.2, 3.2, 0.8],
    },
    dataSource: { kind: "cycleogram", preset: "dou" },
    notes: "Четвёртая колонка — фактические минуты из work_entry.",
  },
  form_03b_cycleogram_school: {
    id: "form_03b_cycleogram_school",
    number: "3Б",
    title: "Циклограмма (образовательное учреждение)",
    category: "cycleogram",
    sourceColumns: [
      { source: "День недели", field: "weekday" },
      { source: "Время", field: "time_slot" },
      { source: "Содержание работы", field: "title" },
    ],
    fourCol: {
      headers: ["День недели", "Время", "Содержание", "Минуты"],
      pack: [[0], [1], [2], []],
      widths: [1.2, 1.2, 3.2, 0.8],
    },
    dataSource: { kind: "cycleogram", preset: "school" },
  },
  journal_4a_diagnostic: {
    id: "journal_4a_diagnostic",
    number: "4А",
    title: "Журнал диагностики",
    category: "workload_journal",
    sourceColumns: [
      { source: "Дата, время", field: "work_datetime" },
      { source: "Ф.И.О.", field: "subject_name" },
      { source: "Возраст", field: "age" },
      { source: "От кого поступил запрос", field: "referrer" },
      { source: "Характер диагностики", field: "diagnostic_kind" },
      { source: "Примечания / рекомендации", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата и время", "Обследуемый", "Запрос и характер", "Примечания"],
      pack: [[0], [1, 2], [3, 4], [5]],
      widths: [1.2, 1.6, 2.4, 1.2],
    },
    dataSource: { kind: "work_entries", activityKinds: ["assessment"] },
  },
  journal_4b_consultation: {
    id: "journal_4b_consultation",
    number: "4Б",
    title: "Журнал консультирования",
    category: "workload_journal",
    sourceColumns: [
      { source: "№ п/п", field: "row_no" },
      { source: "Время проведения", field: "work_datetime" },
      { source: "Консультируемые (код)", field: "subject_code" },
      { source: "Повод обращения", field: "reason" },
      { source: "Проблемы (выявленные)", field: "problems" },
      { source: "Динамика изменений", field: "dynamics" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Время", "Консультируемые", "Повод и проблемы", "Динамика / примечание"],
      pack: [[1], [2], [3, 4], [5, 6]],
      widths: [1.0, 1.6, 2.6, 1.2],
    },
    dataSource: { kind: "consultations" },
    notes: "Первичная/повторная и анонимный код — поля consultation / work_entry.",
  },
  journal_4c_correction_individual: {
    id: "journal_4c_correction_individual",
    number: "4В",
    title: "Журнал инд. коррекционно-развивающей работы",
    category: "workload_journal",
    sourceColumns: [
      { source: "Дата", field: "work_date" },
      { source: "С кем проводится занятие", field: "subject_name" },
      { source: "Тема занятия", field: "title" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата", "С кем", "Тема", "Примечание"],
      pack: [[0], [1], [2], [3]],
      widths: [1.0, 1.8, 2.6, 1.0],
    },
    dataSource: { kind: "work_entries", activityKinds: ["individual_session"] },
  },
  journal_4d_correction_group: {
    id: "journal_4d_correction_group",
    number: "4Г",
    title: "Журнал групповой коррекционно-развивающей работы",
    category: "workload_journal",
    sourceColumns: [
      { source: "№ п/п", field: "row_no" },
      { source: "Список участников", field: "participants" },
      { source: "Дата проведения", field: "work_date" },
      { source: "Тема и название занятия", field: "title" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата", "Участники", "Тема занятия", "Примечание"],
      pack: [[2], [1], [3], [4]],
      widths: [1.0, 2.2, 2.4, 1.0],
    },
    dataSource: { kind: "work_entries", activityKinds: ["group_session"] },
  },
  journal_4e_enlightenment: {
    id: "journal_4e_enlightenment",
    number: "4Д",
    title: "Журнал просветительской работы",
    category: "workload_journal",
    sourceColumns: [
      { source: "Дата проведения", field: "work_date" },
      { source: "Категория слушателей", field: "audience_note" },
      { source: "Форма мероприятия", field: "event_form" },
      { source: "Тема", field: "title" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата", "Слушатели", "Форма и тема", "Примечание"],
      pack: [[0], [1], [2, 3], [4]],
      widths: [1.0, 1.6, 2.8, 1.0],
    },
    dataSource: { kind: "work_entries", activityKinds: ["program_event"] },
  },
  journal_4f_expert: {
    id: "journal_4f_expert",
    number: "4Е",
    title: "Журнал экспертной работы",
    category: "workload_journal",
    sourceColumns: [
      { source: "Дата проведения", field: "work_date" },
      { source: "Цель проведения, форма", field: "title" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата", "Цель и форма", "Примечание", ""],
      pack: [[0], [1], [2], []],
      widths: [1.0, 3.4, 2.0, 0.2],
    },
    dataSource: { kind: "work_entries", activityKinds: ["evaluation", "referral"] },
  },
  journal_4g_org_method: {
    id: "journal_4g_org_method",
    number: "4Ж",
    title: "Журнал организационно-методической работы",
    category: "workload_journal",
    sourceColumns: [
      { source: "Дата", field: "work_date" },
      { source: "Содержание работы", field: "title" },
      { source: "Примечание", field: "notes" },
    ],
    fourCol: {
      headers: ["Дата", "Содержание", "Примечание", ""],
      pack: [[0], [1], [2], []],
      widths: [1.0, 3.6, 2.0, 0.2],
    },
    dataSource: { kind: "work_entries", activityKinds: ["methodology_work", "admin_other"] },
  },
  form_05a_statistics: {
    id: "form_05a_statistics",
    number: "5А",
    title: "Статистическая справка",
    category: "aggregate_report",
    sourceColumns: [],
    fourCol: {
      headers: ["Показатель", "Дети", "Взрослые", "Итого"],
      pack: [[], [], [], []],
      widths: [2.4, 1.4, 1.4, 1.2],
    },
    dataSource: { kind: "aggregates", template: "form_05a" },
    notes: "Таблица счётчиков; возрастные корзины — отдельный блок PASSPORT.",
  },
  form_05_analytical_report: {
    id: "form_05_analytical_report",
    number: "5",
    title: "Аналитический отчёт за учебный год",
    category: "aggregate_report",
    sourceColumns: [],
    fourCol: {
      headers: [
        "Направление",
        "Учащиеся",
        "Педагоги / родители",
        "Администрация",
      ],
      pack: [[], [], [], []],
      widths: [1.6, 1.6, 1.6, 1.6],
    },
    dataSource: { kind: "aggregates", template: "form_05" },
    notes: "Сводная таблица п.5 + нарратив ИИ в JUSTIFICATION.",
  },
  form_06_conclusion: {
    id: "form_06_conclusion",
    number: "6",
    title: "Заключение по психодиагностике",
    category: "case_artifact",
    sourceColumns: [],
    fourCol: {
      headers: ["Задание / блок", "Факты", "Интерпретация", "Рекомендации"],
      pack: [[], [], [], []],
      widths: [1.4, 2.0, 2.0, 1.0],
    },
    dataSource: { kind: "case_artifact", artifactType: "diagnostic_conclusion" },
    notes: "Варианты 6А–Г — подтип шаблона; основной текст в PASSPORT.",
  },
  form_07_ipp_card: {
    id: "form_07_ipp_card",
    number: "7",
    title: "ИПП-карта ребёнка",
    category: "case_artifact",
    sourceColumns: [],
    fourCol: {
      headers: ["Сфера", "Наблюдения", "Динамика", "Рекомендации"],
      pack: [[], [], [], []],
      widths: [1.2, 2.4, 1.6, 1.2],
    },
    dataSource: { kind: "case_artifact", artifactType: "ipp_card" },
  },
  form_08_group_program: {
    id: "form_08_group_program",
    number: "8",
    title: "Программа работы с группой",
    category: "plan_card",
    sourceColumns: [],
    fourCol: {
      headers: ["№ / тема", "Цели и задачи", "Формы работы", "Часы / дата"],
      pack: [[], [], [], []],
      widths: [1.4, 2.4, 2.0, 1.6],
    },
    dataSource: { kind: "plan_card", planType: "group" },
  },
  form_09_individual_program: {
    id: "form_09_individual_program",
    number: "9",
    title: "Программа инд. коррекционных занятий",
    category: "plan_card",
    sourceColumns: [],
    fourCol: {
      headers: ["Этап", "Действие", "Срок", "Результат"],
      pack: [[], [], [], []],
      widths: [1.0, 2.8, 1.2, 1.4],
    },
    dataSource: { kind: "plan_card", planType: "ipr" },
  },
  form_11_protocol: {
    id: "form_11_protocol",
    number: "11",
    title: "Протокол беседы / занятия / обследования",
    category: "case_artifact",
    sourceColumns: [],
    fourCol: {
      headers: ["Этап", "Ход", "Наблюдения", "Примечания"],
      pack: [[], [], [], []],
      widths: [1.0, 2.8, 2.0, 1.6],
    },
    dataSource: { kind: "case_artifact", artifactType: "session_protocol" },
  },
  form_12_consilium: {
    id: "form_12_consilium",
    number: "12",
    title: "Представление на школьный консилиум",
    category: "case_artifact",
    sourceColumns: [],
    fourCol: {
      headers: ["Сфера", "Факты", "Оценка", "Рекомендации"],
      pack: [[], [], [], []],
      widths: [1.2, 2.4, 1.6, 1.2],
    },
    dataSource: { kind: "case_artifact", artifactType: "consilium_brief" },
  },
  form_14_methods_registry: {
    id: "form_14_methods_registry",
    number: "14",
    title: "Реестр диагностических методик",
    category: "workload_journal",
    sourceColumns: [
      { source: "Название методики", field: "title" },
      { source: "Возраст", field: "age_range" },
      { source: "Направленность", field: "focus" },
      { source: "Автор, источник", field: "source_ref" },
    ],
    fourCol: {
      headers: ["Методика", "Возраст", "Направленность", "Автор / источник"],
      pack: [[0], [1], [2], [3]],
      widths: [2.0, 1.2, 2.0, 1.2],
    },
    dataSource: { kind: "methods_catalog" },
  },
  form_15_characteristic: {
    id: "form_15_characteristic",
    number: "15",
    title: "Психолого-педагогическая характеристика",
    category: "case_artifact",
    sourceColumns: [],
    fourCol: {
      headers: ["Блок", "Наблюдения", "Оценка", "Рекомендации"],
      pack: [[], [], [], []],
      widths: [1.2, 2.6, 1.6, 1.0],
    },
    dataSource: { kind: "case_artifact", artifactType: "child_characteristic" },
  },
  form_16_parent_consent: {
    id: "form_16_parent_consent",
    number: "16",
    title: "Согласие родителей на обследование",
    category: "case_artifact",
    sourceColumns: [],
    fourCol: {
      headers: ["Сторона", "ФИО / подпись", "Дата", "Примечание"],
      pack: [[], [], [], []],
      widths: [1.6, 2.4, 1.2, 1.2],
    },
    dataSource: { kind: "case_artifact", artifactType: "parent_consent" },
    notes: "В основном PASSPORT; таблица — для реквизитов подписей.",
  },
};

export function getSchoolForm(id: SchoolFormId): SchoolFormDefinition {
  return SCHOOL_PSYCHOLOGIST_FORM_REGISTRY[id];
}

export function journalFormForActivityKind(kind: ActivityKind): SchoolFormId | null {
  for (const id of SCHOOL_JOURNAL_FORM_IDS) {
    const def = SCHOOL_PSYCHOLOGIST_FORM_REGISTRY[id];
    if (def.dataSource.kind === "work_entries" && def.dataSource.activityKinds.includes(kind)) {
      return id;
    }
  }
  if (kind === "consultation" || kind === "family_session") return "journal_4b_consultation";
  return null;
}

/** Склеивает значения ячеек источника в 4 колонки DOCX. */
export function packRowToFourCol(
  sourceValues: string[],
  pack: SchoolFormFourColSpec["pack"],
): [string, string, string, string] {
  const join = (indices: number[]) =>
    indices
      .map((i) => String(sourceValues[i] ?? "").trim())
      .filter(Boolean)
      .join("; ");
  return [join(pack[0]), join(pack[1]), join(pack[2]), join(pack[3])];
}

export function serializeDataStreamBody(rows: string[][]): string {
  return rows
    .map((cells) => `[ROW]${cells.map((c) => c.replace(/\|/g, "/")).join("|")}[/ROW]`)
    .join("\n");
}

export function buildSchoolFormDataStream(
  formId: SchoolFormId,
  sourceRows: string[][],
): { headers: [string, string, string, string]; body: string } {
  const def = getSchoolForm(formId);
  const packed = sourceRows.map((row) => packRowToFourCol(row, def.fourCol.pack));
  return {
    headers: def.fourCol.headers,
    body: serializeDataStreamBody(packed),
  };
}
