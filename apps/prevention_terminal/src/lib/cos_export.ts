/**
 * Маппинг данных Prevention AI Terminal → ЦОС «Цифровой психолог».
 *
 * Логика: психолог ведёт работу в нашем терминале (журнал консультаций,
 * кейсы, нагрузка), а этот модуль автоматически преобразует данные
 * в формат, который требует ЦОС для отчётности.
 */

import type { ActivityKind } from "./taxonomy.ts";
import type { SituationKind } from "./case_meta.ts";
import type { VisitKind, AudienceContingent, WorkEntry } from "./work_entries.ts";
import type {
  CosTopic,
  CosTargetCategory,
  CosFormat,
  CosStatus,
  CosActivityKind,
  CosJournalEntry,
  CosReportByTopic,
  CosReportByCategory,
} from "./cos_taxonomy.ts";

// ---------------------------------------------------------------------------
// 1. Тематика обращения: наш situation_kind → ЦОС тематика
// ---------------------------------------------------------------------------
const SITUATION_TO_COS_TOPIC: Record<string, CosTopic> = {
  // School kinds
  conflict_bullying: "Травля, насилие",
  student_support: "Социальная адаптация",
  family_school: "Проблема взаимоотношений детей и родителей",
  prevention_event: "Социальная адаптация",
  // Commercial kinds (fallback mapping)
  individual_therapy: "Социальная адаптация",
  couple_therapy: "Проблемы в семье",
  group_program: "Социальная адаптация",
  corporate_request: "Социальная адаптация",
};

export function mapSituationToCosTopic(kind: string): string {
  return SITUATION_TO_COS_TOPIC[kind] || "Социальная адаптация";
}

// ---------------------------------------------------------------------------
// 2. Целевая категория: наш audience_contingent + org_class → ЦОС категория
// ---------------------------------------------------------------------------

/** Класс/группа → возрастная категория ЦОС */
export function mapGradeToAgeCategory(orgClass: string): CosTargetCategory {
  if (!orgClass) return "Иная категория детей";

  const cleaned = orgClass.replace(/[^\dА-Яа-я]/g, "").toLowerCase();

  // Дошкольные группы
  if (/младш|средн|старш|подготовит|дошк|доу|дс|садик/i.test(orgClass)) {
    return "3-6 лет";
  }

  // Извлекаем номер класса
  const classMatch = cleaned.match(/^(\d+)/);
  if (classMatch) {
    const num = parseInt(classMatch[1], 10);
    if (num >= 1 && num <= 4) return "7-11 лет";
    if (num >= 5 && num <= 9) return "12-15 лет";
    if (num >= 10 && num <= 11) return "16-18 лет";
  }

  return "Иная категория детей";
}

/** Наш audience_contingent → ЦОС целевая категория */
export function mapAudienceToCategory(contingent: AudienceContingent, orgClass?: string): CosTargetCategory {
  switch (contingent) {
    case "parents": return "Родитель (законный представитель)";
    case "teachers": return "Педагог";
    case "staff":
    case "admin": return "Специалист";
    case "students": return mapGradeToAgeCategory(orgClass || "");
    default: return mapGradeToAgeCategory(orgClass || "");
  }
}

// ---------------------------------------------------------------------------
// 3. Вид деятельности: наш activity_kind → ЦОС вид
// ---------------------------------------------------------------------------
const ACTIVITY_TO_COS: Record<ActivityKind, CosActivityKind> = {
  intake: "Психологическое консультирование",
  individual_session: "Психокоррекция",
  group_session: "Психокоррекция",
  family_session: "Психологическое консультирование",
  assessment: "Психодиагностика",
  consultation: "Психологическое консультирование",
  program_event: "Психологическое просвещение",
  referral: "Психологическое консультирование",
  evaluation: "Психодиагностика",
  methodology_work: "Психопрофилактика",
  admin_other: "Психопрофилактика",
};

export function mapActivityToCos(kind: ActivityKind): CosActivityKind {
  return ACTIVITY_TO_COS[kind] || "Психологическое консультирование";
}

// ---------------------------------------------------------------------------
// 4. Повторное обращение: наш visit_kind → ЦОС поле
// ---------------------------------------------------------------------------
export function mapVisitKindToCos(vk: VisitKind): string {
  switch (vk) {
    case "primary": return "—";
    case "repeat": return "Да";
    default: return "—";
  }
}

// ---------------------------------------------------------------------------
// 5. Формат консультации (по умолчанию «Очный» — основной формат работы)
// ---------------------------------------------------------------------------
export function mapFormatToCos(format?: string): CosFormat {
  if (format === "video") return "Видео";
  if (format === "chat") return "Текстовый чат";
  return "Очный";
}

// ---------------------------------------------------------------------------
// 6. Статус (наши записи всегда «состоялись», т.к. фиксируются по факту)
// ---------------------------------------------------------------------------
export function mapStatusToCos(status?: string): CosStatus {
  if (status === "cancelled") return "Консультация не состоялась: Пользователь не пришел";
  if (status === "interrupted") return "Консультация прервалась";
  return "Консультация завершена";
}

// ---------------------------------------------------------------------------
// 7. Сборка записи журнала ЦОС из нашего WorkEntry
// ---------------------------------------------------------------------------
export interface CosExportContext {
  /** ФИО из реестра (или псевдоним) */
  fullName: string;
  /** Дата рождения из реестра */
  birthDate: string;
  /** Класс/группа из реестра */
  orgClass: string;
  /** Тип ситуации из кейса */
  situationKind: string;
}

export function buildCosJournalEntry(
  entry: WorkEntry,
  ctx: CosExportContext,
  index: number,
): CosJournalEntry {
  const topic = mapSituationToCosTopic(ctx.situationKind || "");
  const targetCategory = mapAudienceToCategory(
    entry.audience_contingent || "",
    ctx.orgClass,
  );

  return {
    index,
    date: entry.work_date,
    fullName: ctx.fullName || entry.subject_label || "Псевдоним",
    birthDate: ctx.birthDate || "—",
    topic,
    targetCategory,
    problems: topic,
    activityKind: mapActivityToCos(entry.activity_kind),
    status: mapStatusToCos(),
    isRepeat: mapVisitKindToCos(entry.visit_kind),
    healthReferral: "—",
    rightsReferral: "—",
  };
}

// ---------------------------------------------------------------------------
// 8. Агрегация: сводный отчёт по тематике обращений
// ---------------------------------------------------------------------------
export function buildCosReportByTopic(entries: CosJournalEntry[]): CosReportByTopic[] {
  const map = new Map<string, CosReportByTopic>();

  for (const e of entries) {
    let row = map.get(e.topic);
    if (!row) {
      row = {
        topic: e.topic,
        total: 0,
        age3_6: 0,
        age7_11: 0,
        age12_15: 0,
        age16_18: 0,
        parents: 0,
        teachers: 0,
        specialists: 0,
      };
      map.set(e.topic, row);
    }
    row.total++;
    switch (e.targetCategory) {
      case "3-6 лет": row.age3_6++; break;
      case "7-11 лет": row.age7_11++; break;
      case "12-15 лет": row.age12_15++; break;
      case "16-18 лет": row.age16_18++; break;
      case "Родитель (законный представитель)": row.parents++; break;
      case "Педагог": row.teachers++; break;
      case "Специалист": row.specialists++; break;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// 9. Агрегация: сводный отчёт по целевой категории
// ---------------------------------------------------------------------------
export function buildCosReportByCategory(entries: CosJournalEntry[]): CosReportByCategory[] {
  const map = new Map<string, CosReportByCategory>();

  for (const e of entries) {
    let row = map.get(e.targetCategory);
    if (!row) {
      row = {
        category: e.targetCategory,
        total: 0,
        age3_6: 0,
        age7_11: 0,
        age12_15: 0,
        age16_18: 0,
        parents: 0,
        teachers: 0,
        specialists: 0,
      };
      map.set(e.targetCategory, row);
    }
    row.total++;
    switch (e.targetCategory) {
      case "3-6 лет": row.age3_6++; break;
      case "7-11 лет": row.age7_11++; break;
      case "12-15 лет": row.age12_15++; break;
      case "16-18 лет": row.age16_18++; break;
      case "Родитель (законный представитель)": row.parents++; break;
      case "Педагог": row.teachers++; break;
      case "Специалист": row.specialists++; break;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// 10. Генерация TSV (Tab-Separated Values) для вставки в Excel / ЦОС
// ---------------------------------------------------------------------------
export function cosJournalToTsv(entries: CosJournalEntry[]): string {
  const header = [
    "№ п/п",
    "Дата консультации",
    "ФИО",
    "Дата рождения",
    "Тематика обращения",
    "Целевая категория",
    "Проблемы",
    "Вид деятельности",
    "Статус консультации",
    "Повторное обращение",
    "Конс. здравоохранения",
    "Конс. защиты прав",
  ].join("\t");

  const rows = entries.map((e) =>
    [
      e.index,
      e.date,
      e.fullName,
      e.birthDate,
      e.topic,
      e.targetCategory,
      e.problems,
      e.activityKind,
      e.status,
      e.isRepeat,
      e.healthReferral,
      e.rightsReferral,
    ].join("\t"),
  );

  return [header, ...rows].join("\n");
}

export function cosReportByTopicToTsv(rows: CosReportByTopic[]): string {
  const header = [
    "№",
    "Тематика обращений",
    "Всего",
    "3-6 лет",
    "7-11 лет",
    "12-15 лет",
    "16-18 лет",
    "Родители",
    "Педагоги",
    "Специалисты",
  ].join("\t");

  const lines = rows.map((r, i) =>
    [i + 1, r.topic, r.total, r.age3_6, r.age7_11, r.age12_15, r.age16_18, r.parents, r.teachers, r.specialists].join("\t"),
  );

  return [header, ...lines].join("\n");
}
