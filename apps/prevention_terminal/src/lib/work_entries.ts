/**
 * Универсальный журнал нагрузки (work_entries) — ядро для форм 4А–Ж.
 */

import { invoke } from "@tauri-apps/api/core";

import {
  getSchoolForm,
  type SchoolFormId,
} from "./school_psychologist_forms.ts";
import {
  ACTIVITY_KIND_DEFAULT_MINUTES,
  ACTIVITY_KIND_VALUES,
  type ActivityKind,
} from "./taxonomy.ts";

export type EffortPhase = "" | "prep" | "delivery" | "analysis" | "admin";
export type VisitKind = "" | "primary" | "repeat";
export type AudienceContingent = "" | "students" | "teachers" | "parents" | "staff" | "admin";

export interface WorkEntry {
  entry_id: string;
  work_date: string;
  minutes_actual: number;
  activity_kind: ActivityKind;
  effort_phase: EffortPhase;
  title: string;
  notes: string;
  subject_label: string;
  case_id: string | null;
  plan_id: string | null;
  audience_note: string;
  audience_contingent: AudienceContingent;
  time_start: string;
  time_end: string;
  referrer: string;
  visit_kind: VisitKind;
  anonymous_code: string;
  event_form: string;
  diagnostic_kind: string;
  co_executors_text: string;
  created_at: string;
  updated_at: string;
}

export type WorkEntryDraft = Omit<WorkEntry, "created_at" | "updated_at">;

export const ACTIVITY_KIND_LABEL_RU: Readonly<Record<ActivityKind, string>> = {
  intake: "Первичный приём",
  individual_session: "Инд. занятие / коррекция",
  group_session: "Групповое занятие",
  family_session: "Семейная консультация",
  assessment: "Диагностика / обследование",
  consultation: "Консультирование",
  program_event: "Просветительское мероприятие",
  referral: "Направление",
  evaluation: "Экспертиза / оценка",
  methodology_work: "Орг.-метод. работа",
  admin_other: "Админ. / прочее",
};

export const VISIT_KIND_LABEL_RU: Record<VisitKind, string> = {
  "": "—",
  primary: "Первичная",
  repeat: "Повторная",
};

export const AUDIENCE_CONTINGENT_LABEL_RU: Record<AudienceContingent, string> = {
  "": "—",
  students: "Учащиеся",
  teachers: "Педагоги",
  parents: "Родители",
  staff: "Сотрудники",
  admin: "Администрация",
};

export const EFFORT_PHASE_LABEL_RU: Record<EffortPhase, string> = {
  "": "—",
  prep: "Подготовка",
  delivery: "Проведение",
  analysis: "Анализ / разбор",
  admin: "Оформление",
};

/** Вкладки журналов в UI (все + семь масок методички). */
export type WorkloadJournalTab = "all" | SchoolFormId;

export const WORKLOAD_JOURNAL_TABS: { id: WorkloadJournalTab; label: string }[] = [
  { id: "all", label: "Все записи" },
  { id: "journal_4a_diagnostic", label: "4А Диагностика" },
  { id: "journal_4b_consultation", label: "4Б Консультирование" },
  { id: "journal_4c_correction_individual", label: "4В Инд. коррекция" },
  { id: "journal_4d_correction_group", label: "4Г Групповая" },
  { id: "journal_4e_enlightenment", label: "4Д Просветительская" },
  { id: "journal_4f_expert", label: "4Е Экспертная" },
  { id: "journal_4g_org_method", label: "4Ж Орг.-метод." },
];

export function activityKindsForJournalTab(tab: WorkloadJournalTab): ActivityKind[] | null {
  if (tab === "all") return null;
  const def = getSchoolForm(tab);
  if (def.dataSource.kind === "work_entries") return [...def.dataSource.activityKinds];
  if (def.dataSource.kind === "consultations") return ["consultation", "family_session"];
  return null;
}

export function defaultActivityKindForTab(tab: WorkloadJournalTab): ActivityKind {
  const kinds = activityKindsForJournalTab(tab);
  if (kinds?.length) return kinds[0]!;
  return "consultation";
}

export function newWorkEntryId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `we-${Date.now().toString(36)}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  const label = now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return { from, to, label };
}

export function emptyWorkEntryDraft(tab: WorkloadJournalTab = "all"): WorkEntryDraft {
  const kind = defaultActivityKindForTab(tab);
  return {
    entry_id: "",
    work_date: todayIsoDate(),
    minutes_actual: ACTIVITY_KIND_DEFAULT_MINUTES[kind],
    activity_kind: kind,
    effort_phase: "",
    title: "",
    notes: "",
    subject_label: "",
    case_id: null,
    plan_id: null,
    audience_note: "",
    audience_contingent: "",
    time_start: "",
    time_end: "",
    referrer: "",
    visit_kind: "",
    anonymous_code: "",
    event_form: "",
    diagnostic_kind: "",
    co_executors_text: "",
  };
}

function formatWorkDatetime(entry: WorkEntry): string {
  const date = entry.work_date;
  if (entry.time_start && entry.time_end) return `${date} ${entry.time_start}–${entry.time_end}`;
  if (entry.time_start) return `${date} ${entry.time_start}`;
  return date;
}

/** Значение поля бланка из записи нагрузки. */
export function workEntryFieldValue(
  entry: WorkEntry,
  field: string,
  rowNo: number,
): string {
  switch (field) {
    case "row_no":
      return String(rowNo);
    case "work_date":
      return entry.work_date;
    case "work_datetime":
      return formatWorkDatetime(entry);
    case "subject_name":
      return entry.subject_label || entry.title;
    case "subject_code":
      return entry.anonymous_code || entry.subject_label || "—";
    case "age":
      return entry.audience_note;
    case "referrer":
      return entry.referrer;
    case "diagnostic_kind":
      return entry.diagnostic_kind || ACTIVITY_KIND_LABEL_RU[entry.activity_kind];
    case "reason":
      return entry.title;
    case "problems":
      return entry.notes;
    case "dynamics":
      return entry.notes;
    case "participants":
      return entry.subject_label || entry.audience_note;
    case "audience_note":
      return entry.audience_note;
    case "event_form":
      return entry.event_form;
    case "activity_label":
      return ACTIVITY_KIND_LABEL_RU[entry.activity_kind];
    default:
      if (field in entry) {
        const raw = entry[field as keyof WorkEntry];
        return raw == null ? "" : String(raw);
      }
      return "";
  }
}

/** Строка источника для экспорта школьной формы. */
export function workEntryToSourceRow(
  formId: SchoolFormId,
  entry: WorkEntry,
  rowNo: number,
): string[] {
  const def = getSchoolForm(formId);
  return def.sourceColumns.map((col) => workEntryFieldValue(entry, col.field, rowNo));
}

export function totalWorkEntryMinutes(entries: WorkEntry[]): number {
  return entries.reduce((sum, e) => sum + (Number(e.minutes_actual) > 0 ? e.minutes_actual : 0), 0);
}

export interface ListWorkEntriesQuery {
  activityKinds?: ActivityKind[];
  fromDate?: string;
  toDate?: string;
}

export async function listWorkEntries(query: ListWorkEntriesQuery = {}): Promise<WorkEntry[]> {
  const rows = await invoke<WorkEntry[]>("db_list_work_entries", {
    activityKinds: query.activityKinds?.length ? query.activityKinds : null,
    fromDate: query.fromDate || null,
    toDate: query.toDate || null,
  });
  return rows.map(normalizeWorkEntry);
}

export async function addWorkEntry(entry: WorkEntryDraft): Promise<void> {
  await invoke("db_add_work_entry", {
    entryId: entry.entry_id,
    workDate: entry.work_date,
    minutesActual: entry.minutes_actual,
    activityKind: entry.activity_kind,
    title: entry.title,
    notes: entry.notes,
    subjectLabel: entry.subject_label,
    effortPhase: entry.effort_phase || null,
    caseId: entry.case_id,
    planId: entry.plan_id,
    audienceNote: entry.audience_note || null,
    audienceContingent: entry.audience_contingent || null,
    timeStart: entry.time_start || null,
    timeEnd: entry.time_end || null,
    referrer: entry.referrer || null,
    visitKind: entry.visit_kind || null,
    anonymousCode: entry.anonymous_code || null,
    eventForm: entry.event_form || null,
    diagnosticKind: entry.diagnostic_kind || null,
    coExecutorsText: entry.co_executors_text || null,
  });
}

export async function updateWorkEntry(
  entryId: string,
  patch: Partial<WorkEntryDraft>,
): Promise<void> {
  await invoke("db_update_work_entry", {
    entryId,
    payload: {
      work_date: patch.work_date,
      minutes_actual: patch.minutes_actual,
      activity_kind: patch.activity_kind,
      effort_phase: patch.effort_phase,
      title: patch.title,
      notes: patch.notes,
      subject_label: patch.subject_label,
      case_id: patch.case_id !== undefined ? patch.case_id : undefined,
      plan_id: patch.plan_id !== undefined ? patch.plan_id : undefined,
      audience_note: patch.audience_note,
      audience_contingent: patch.audience_contingent,
      time_start: patch.time_start,
      time_end: patch.time_end,
      referrer: patch.referrer,
      visit_kind: patch.visit_kind,
      anonymous_code: patch.anonymous_code,
      event_form: patch.event_form,
      diagnostic_kind: patch.diagnostic_kind,
      co_executors_text: patch.co_executors_text,
    },
  });
}

export async function deleteWorkEntry(entryId: string): Promise<void> {
  await invoke("db_delete_work_entry", { entryId });
}

function normalizeWorkEntry(row: WorkEntry): WorkEntry {
  const kind = ACTIVITY_KIND_VALUES.includes(row.activity_kind as ActivityKind)
    ? (row.activity_kind as ActivityKind)
    : "admin_other";
  return {
    ...row,
    activity_kind: kind,
    case_id: row.case_id || null,
    plan_id: row.plan_id || null,
    effort_phase: (row.effort_phase || "") as EffortPhase,
    visit_kind: (row.visit_kind || "") as VisitKind,
    audience_contingent: (row.audience_contingent || "") as AudienceContingent,
  };
}

/** activity_kind options for journal tab (subset of all 11). */
export function activityKindOptionsForTab(tab: WorkloadJournalTab): ActivityKind[] {
  const kinds = activityKindsForJournalTab(tab);
  return kinds ?? [...ACTIVITY_KIND_VALUES];
}
