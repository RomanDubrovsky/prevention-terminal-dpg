/**
 * Phase 3.8 — чистая логика журнала действий специалиста.
 *
 * Здесь нет React, DOM и Tauri IPC: только типы и расчёты. UI-компонент
 * `WorkLogPanel` использует эти функции для итогов по кейсу, а тесты
 * гоняют их через `node:test`.
 */

export const WORK_LOG_ACTIONS = [
  "consultation",
  "call",
  "document",
  "observation",
  "other",
] as const;

export type WorkLogAction = (typeof WORK_LOG_ACTIONS)[number];

export const WORK_LOG_ACTION_LABEL: Record<WorkLogAction, string> = {
  consultation: "Консультация",
  call: "Звонок / переписка",
  document: "Документы",
  observation: "Наблюдение",
  other: "Другое",
};

export interface WorkLogEntry {
  entry_id: string;
  case_id: string;
  action_kind: WorkLogAction;
  minutes: number;
  note: string;
  created_at: string;
}

export function totalWorkMinutes(entries: readonly Pick<WorkLogEntry, "minutes">[]): number {
  return entries.reduce((acc, entry) => {
    const minutes = Number.isFinite(entry.minutes) ? entry.minutes : 0;
    return acc + Math.max(0, minutes);
  }, 0);
}

export function formatWorkDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

export function newWorkLogEntryId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const hex = (n: number) =>
    Math.floor(Math.random() * Math.pow(16, n))
      .toString(16)
      .padStart(n, "0");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

export async function updateWorkLogEntry(
  entryId: string,
  patch: { minutes?: number; note?: string },
): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("db_update_work_log_entry", {
    entryId,
    payload: {
      minutes: patch.minutes,
      note: patch.note,
    },
  });
}
