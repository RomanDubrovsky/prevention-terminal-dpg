import { t } from "./i18n.ts";
import type { CaseSummary } from "./case_store.ts";
import type { RegistrySubjectSummary, ConsultationClientRow } from "./registry_store.ts";
import type { IprRecord } from "./ipr_store.ts";
import type { GroupSessionEntry } from "./group_sessions.ts";

/** Сортировка списков людей / карточек (консультации, реестр, ИПР). */
export const PERSON_CARD_SORT_OPTIONS = [
  { id: "name_asc", label: t("По имени", "By Name") },
  { id: "created_desc", label: t("Сначала новые", "Newest First") },
  { id: "created_asc", label: t("Сначала старые", "Oldest First") },
  { id: "updated_desc", label: t("Последний визит", "Last Visit") },
] as const;

export type PersonCardSort = (typeof PERSON_CARD_SORT_OPTIONS)[number]["id"];

/** Только по дате (групповая работа). */
export const DATE_ONLY_SORT_OPTIONS = [
  { id: "created_desc", label: t("Сначала новые", "Newest First") },
  { id: "created_asc", label: t("Сначала старые", "Oldest First") },
] as const;

export type DateOnlySort = (typeof DATE_ONLY_SORT_OPTIONS)[number]["id"];

/** @deprecated alias */
export const CONSULTATION_JOURNAL_SORT_OPTIONS = PERSON_CARD_SORT_OPTIONS;
/** @deprecated alias */
export type ConsultationJournalSort = PersonCardSort;

function epochSeconds(raw: string | undefined): number {
  const text = String(raw || "").trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    const sec = Number.parseInt(text, 10);
    return Number.isFinite(sec) ? sec : 0;
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function compareCreated(a: string | undefined, b: string | undefined, asc: boolean): number {
  const diff = epochSeconds(a) - epochSeconds(b);
  return asc ? diff : -diff;
}

function compareUpdated(a: string | undefined, b: string | undefined): number {
  return epochSeconds(b) - epochSeconds(a);
}

function caseTitle(row: CaseSummary): string {
  return (row.situation_title || "").trim().toLowerCase();
}

function registryName(row: RegistrySubjectSummary): string {
  return (row.profile.full_name || row.situation_title || "").trim().toLowerCase();
}

function iprTitle(row: IprRecord): string {
  return (row.title || "").trim().toLowerCase();
}

function groupSessionSortEpoch(row: GroupSessionEntry): number {
  const fromSessionDate = Date.parse(String(row.session_date || ""));
  if (Number.isFinite(fromSessionDate)) return fromSessionDate;
  return epochSeconds(row.created_at) * 1000;
}

function sortByPersonCardDates<T>(
  copy: T[],
  getCreated: (row: T) => string | undefined,
  getUpdated: (row: T) => string | undefined,
  sort: PersonCardSort,
): T[] {
  if (sort === "created_desc") {
    copy.sort((a, b) => compareCreated(getCreated(a), getCreated(b), false));
  } else if (sort === "created_asc") {
    copy.sort((a, b) => compareCreated(getCreated(a), getCreated(b), true));
  } else {
    copy.sort((a, b) => {
      const byVisit = compareUpdated(getUpdated(a), getUpdated(b));
      if (byVisit !== 0) return byVisit;
      return compareCreated(getCreated(a), getCreated(b), false);
    });
  }
  return copy;
}

export function sortCaseSummaries(rows: CaseSummary[], sort: PersonCardSort): CaseSummary[] {
  const copy = [...rows];
  if (sort === "name_asc") {
    copy.sort((a, b) => caseTitle(a).localeCompare(caseTitle(b), "ru"));
    return copy;
  }
  return sortByPersonCardDates(copy, (r) => r.created_at, (r) => r.updated_at, sort);
}

export function sortRegistrySubjects(
  rows: RegistrySubjectSummary[],
  sort: PersonCardSort,
): RegistrySubjectSummary[] {
  const copy = [...rows];
  if (sort === "name_asc") {
    copy.sort((a, b) => registryName(a).localeCompare(registryName(b), "ru"));
    return copy;
  }
  return sortByPersonCardDates(copy, (r) => r.created_at, (r) => r.updated_at, sort);
}

export function sortConsultationClients(
  rows: ConsultationClientRow[],
  sort: PersonCardSort,
): ConsultationClientRow[] {
  const copy = [...rows];
  if (sort === "name_asc") {
    copy.sort((a, b) =>
      (a.title || "").trim().toLowerCase().localeCompare((b.title || "").trim().toLowerCase(), "ru"),
    );
    return copy;
  }
  return sortByPersonCardDates(copy, (r) => r.created_at, (r) => r.created_at, sort);
}

export function sortIprRecords(rows: IprRecord[], sort: PersonCardSort): IprRecord[] {
  const copy = [...rows];
  if (sort === "name_asc") {
    copy.sort((a, b) => iprTitle(a).localeCompare(iprTitle(b), "ru"));
    return copy;
  }
  return sortByPersonCardDates(copy, (r) => r.created_at, (r) => r.updated_at, sort);
}

export function sortGroupSessions(rows: GroupSessionEntry[], sort: PersonCardSort | DateOnlySort): GroupSessionEntry[] {
  const copy = [...rows];
  if (sort === "name_asc") {
    copy.sort((a, b) =>
      String(a.title || "")
        .trim()
        .toLowerCase()
        .localeCompare(String(b.title || "").trim().toLowerCase(), "ru"),
    );
    return copy;
  }
  copy.sort((a, b) => {
    const diff = groupSessionSortEpoch(a) - groupSessionSortEpoch(b);
    return sort === "created_asc" ? diff : -diff;
  });
  return copy;
}
