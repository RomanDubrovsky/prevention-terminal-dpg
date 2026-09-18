/**
 * Local problem_key tallies for specialist dashboard (no cloud, no FIO).
 */

import { invoke } from "@tauri-apps/api/core";

import { parseConsultationSession } from "./consultation_session.ts";
import { listGroupSessions } from "./group_sessions.ts";
import { listConsultationClients } from "./registry_store.ts";
import { parseSessionTagsJson } from "./session_tagging.ts";
import {
  LEGACY_THEME_TO_PROBLEM_KEY,
  problemKeyLabel,
} from "./taxonomy_picker.ts";
import type { WorkLogEntry } from "./worklog.ts";

export interface ProblemThemeStatRow {
  key: string;
  label: string;
  count: number;
}

function epochInRange(createdAt: string, periodStart: string, periodEnd: string): boolean {
  const sec = Number.parseInt(createdAt, 10);
  if (!Number.isFinite(sec)) return false;
  const iso = new Date(sec * 1000).toISOString().slice(0, 10);
  return iso >= periodStart && iso <= periodEnd;
}

function normalizeThemeId(raw: string): string {
  const key = String(raw || "").trim();
  if (!key) return "";
  return LEGACY_THEME_TO_PROBLEM_KEY[key] || key;
}

function bump(map: Map<string, number>, id: string): void {
  const key = normalizeThemeId(id);
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

/** Count tagged problem themes in consultations + group sessions for a period. */
export async function collectProblemThemeStats(args: {
  periodStart: string;
  periodEnd: string;
  maxCases?: number;
}): Promise<ProblemThemeStatRow[]> {
  const { periodStart, periodEnd, maxCases = 60 } = args;
  const counts = new Map<string, number>();

  try {
    const clients = await listConsultationClients();
    const sample = clients.slice(0, maxCases);
    for (const client of sample) {
      let entries: WorkLogEntry[] = [];
      try {
        entries = await invoke<WorkLogEntry[]>("db_list_work_log_entries", {
          caseId: client.case_id,
        });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.action_kind !== "consultation") continue;
        if (!epochInRange(entry.created_at, periodStart, periodEnd)) continue;
        const session = parseConsultationSession(entry.note);
        const catalog = session.sessionTags?.themes.catalog || [];
        for (const id of catalog) bump(counts, id);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const groups = await listGroupSessions();
    for (const row of groups) {
      const date = String(row.session_date || "").slice(0, 10);
      if (!date || date < periodStart || date > periodEnd) continue;
      const tags = parseSessionTagsJson(String(row.session_tags_json || ""));
      for (const id of tags.themes.catalog) bump(counts, id);
    }
  } catch {
    /* ignore */
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: problemKeyLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
    .slice(0, 12);
}