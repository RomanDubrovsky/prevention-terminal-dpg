import { invoke } from "@tauri-apps/api/core";

import { preventionLinkLabel } from "./prevention_link.ts";
import {
  formatPreventionWorkTypesForAi,
  parsePreventionWorkTypesJson,
} from "./prevention_work_types.ts";
import {
  formatConsultationSessionTagsForAi,
  parseSessionTagsJson,
} from "./session_tagging.ts";
import { EMPTY_ARTIFACTS, type SessionArtifacts } from "./section_artifacts.ts";
import {
  formatTargetAudienceForAi,
  parseTargetAudienceJson,
} from "./target_audience.ts";

export interface GroupSessionEntry {
  session_id: string;
  title: string;
  session_date: string;
  duration_minutes: number;
  theme: string;
  notes: string;
  plan_text: string;
  report_text: string;
  artifacts_json: string;
  audience_json: string;
  prevention_link: string;
  prevention_work_types_json: string;
  session_tags_json: string;
  created_at: string;
  updated_at: string;
}

export type GroupSessionDraft = Omit<GroupSessionEntry, "created_at" | "updated_at">;

export function newGroupSessionId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `gs-${Date.now().toString(36)}`;
}

export function parseGroupSessionArtifacts(raw: string): SessionArtifacts {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return { ...EMPTY_ARTIFACTS };
  try {
    const parsed = JSON.parse(trimmed) as SessionArtifacts;
    return {
      plan_text: parsed.plan_text,
      report_text: parsed.report_text,
      plan_segments: parsed.plan_segments,
      report_segments: parsed.report_segments,
      expert: parsed.expert,
      architect_handoff: parsed.architect_handoff,
    };
  } catch {
    return { ...EMPTY_ARTIFACTS };
  }
}

export function buildGroupSessionAiContext(
  entry: Pick<
    GroupSessionEntry,
    | "title"
    | "session_date"
    | "duration_minutes"
    | "theme"
    | "notes"
    | "plan_text"
    | "report_text"
    | "audience_json"
    | "prevention_link"
    | "prevention_work_types_json"
    | "session_tags_json"
  >,
): string {
  const audience = formatTargetAudienceForAi(parseTargetAudienceJson(entry.audience_json));
  const workTypes = formatPreventionWorkTypesForAi(
    parsePreventionWorkTypesJson(entry.prevention_work_types_json),
  );
  const sessionTags = formatConsultationSessionTagsForAi(
    parseSessionTagsJson(entry.session_tags_json ?? "{}"),
  );
  const lines = [
    `Название плана: ${entry.title}`,
    `Дата (ориентир): ${entry.session_date}`,
    `Длительность (ориентир): ${entry.duration_minutes} мин`,
    entry.prevention_link
      ? `Звено профилактики: ${preventionLinkLabel(entry.prevention_link)}`
      : "",
    workTypes ? `Виды профилактической работы:\n${workTypes}` : "",
    sessionTags,
    audience,
    entry.theme ? `Тема / фокус: ${entry.theme}` : "",
    entry.notes ? `Заметки специалиста: ${entry.notes}` : "",
    entry.plan_text ? `Сохранённый план:\n${entry.plan_text}` : "",
    entry.report_text ? `Сохранённый отчёт:\n${entry.report_text}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function listGroupSessions(): Promise<GroupSessionEntry[]> {
  return invoke<GroupSessionEntry[]>("db_list_group_sessions");
}

export async function addGroupSession(
  entry: Omit<
    GroupSessionDraft,
    "plan_text" | "report_text" | "audience_json" | "artifacts_json" | "prevention_link" | "prevention_work_types_json"
  > & {
    plan_text?: string;
    report_text?: string;
    audience_json?: string;
    artifacts?: SessionArtifacts;
    prevention_link?: string;
    prevention_work_types_json?: string;
    session_tags_json?: string;
  },
): Promise<void> {
  await invoke("db_add_group_session", {
    sessionId: entry.session_id,
    title: entry.title,
    sessionDate: entry.session_date,
    durationMinutes: entry.duration_minutes,
    theme: entry.theme,
    notes: entry.notes,
  });
  const plan = entry.plan_text?.trim();
  const report = entry.report_text?.trim();
  const audience = entry.audience_json?.trim();
  const preventionLink = entry.prevention_link?.trim();
  const workTypesJson = entry.prevention_work_types_json?.trim();
  const sessionTagsJson = entry.session_tags_json?.trim();
  const artifacts = entry.artifacts;
  if (plan || report || audience || preventionLink || workTypesJson || sessionTagsJson || artifacts) {
    await updateGroupSession(entry.session_id, {
      plan_text: plan,
      report_text: report,
      audience_json: audience,
      prevention_link: preventionLink,
      prevention_work_types_json: workTypesJson,
      session_tags_json: sessionTagsJson,
      artifacts,
    });
  }
}

export async function updateGroupSession(
  sessionId: string,
  patch: Partial<
    Pick<
      GroupSessionDraft,
      | "title"
      | "session_date"
      | "duration_minutes"
      | "theme"
      | "notes"
      | "plan_text"
      | "report_text"
      | "audience_json"
      | "prevention_link"
      | "prevention_work_types_json"
      | "session_tags_json"
    >
  > & { artifacts?: SessionArtifacts },
): Promise<void> {
  const artifactsJson =
    patch.artifacts != null ? JSON.stringify(patch.artifacts) : undefined;
  await invoke("db_update_group_session", {
    sessionId,
    payload: {
      title: patch.title,
      session_date: patch.session_date,
      duration_minutes: patch.duration_minutes,
      theme: patch.theme,
      notes: patch.notes,
      plan_text: patch.plan_text,
      report_text: patch.report_text,
      audience_json: patch.audience_json,
      prevention_link: patch.prevention_link,
      prevention_work_types_json: patch.prevention_work_types_json,
      session_tags_json: patch.session_tags_json,
      artifacts_json: artifactsJson,
    },
  });
}
