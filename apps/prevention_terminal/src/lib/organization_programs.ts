import { invoke } from "@tauri-apps/api/core";

import { preventionLinkLabel } from "./prevention_link.ts";
import {
  formatPreventionWorkTypesForAi,
  parsePreventionWorkTypesJson,
} from "./prevention_work_types.ts";
import { EMPTY_ARTIFACTS, type SessionArtifacts } from "./section_artifacts.ts";
import {
  formatTargetAudienceForAi,
  formatTargetAudienceSummary,
  parseTargetAudienceJson,
} from "./target_audience.ts";

export interface OrganizationProgramEntry {
  program_id: string;
  title: string;
  program_year: string;
  scope: string;
  notes: string;
  plan_text: string;
  report_text: string;
  artifacts_json: string;
  audience_json: string;
  prevention_link: string;
  prevention_work_types_json: string;
  created_at: string;
  updated_at: string;
}

export type OrganizationProgramDraft = Omit<
  OrganizationProgramEntry,
  "created_at" | "updated_at" | "artifacts_json"
> & { artifacts?: SessionArtifacts };

export function newOrganizationProgramId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `op-${Date.now().toString(36)}`;
}

export function parseProgramArtifacts(raw: string): SessionArtifacts {
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

export function serializeProgramArtifacts(artifacts: SessionArtifacts): string {
  return JSON.stringify(artifacts);
}

export function buildOrganizationProgramAiContext(
  entry: Pick<
    OrganizationProgramEntry,
    | "title"
    | "program_year"
    | "scope"
    | "notes"
    | "plan_text"
    | "report_text"
    | "artifacts_json"
    | "audience_json"
    | "prevention_link"
    | "prevention_work_types_json"
  >,
): string {
  const artifacts = parseProgramArtifacts(entry.artifacts_json);
  const audience = formatTargetAudienceForAi(parseTargetAudienceJson(entry.audience_json));
  const workTypes = formatPreventionWorkTypesForAi(
    parsePreventionWorkTypesJson(entry.prevention_work_types_json),
  );
  const lines = [
    `Программа: ${entry.title}`,
    entry.program_year ? `Период: ${entry.program_year}` : "",
    entry.prevention_link ? `Звено профилактики: ${preventionLinkLabel(entry.prevention_link)}` : "",
    workTypes ? `Виды профилактической работы:\n${workTypes}` : "",
    audience || (entry.scope ? `Охват: ${entry.scope}` : ""),
    entry.notes ? `Заметки: ${entry.notes}` : "",
    entry.plan_text ? `Сохранённый план:\n${entry.plan_text}` : "",
    entry.report_text ? `Сохранённый отчёт:\n${entry.report_text}` : "",
    artifacts.expert?.program_audit?.text
      ? `Аудит программы:\n${artifacts.expert.program_audit.text}`
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function listOrganizationPrograms(): Promise<OrganizationProgramEntry[]> {
  return invoke<OrganizationProgramEntry[]>("db_list_organization_programs");
}

export async function addOrganizationProgram(
  entry: Omit<OrganizationProgramDraft, "plan_text" | "report_text"> & {
    plan_text?: string;
    report_text?: string;
    audience_json?: string;
    prevention_link?: string;
    prevention_work_types_json?: string;
  },
): Promise<void> {
  await invoke("db_add_organization_program", {
    programId: entry.program_id,
    title: entry.title,
    programYear: entry.program_year,
    scope: entry.scope,
    notes: entry.notes,
  });
  const plan = entry.plan_text?.trim();
  const report = entry.report_text?.trim();
  const audience = entry.audience_json?.trim();
  const preventionLink = entry.prevention_link?.trim();
  const workTypesJson = entry.prevention_work_types_json?.trim();
  if (plan || report || audience || preventionLink || workTypesJson) {
    await updateOrganizationProgram(entry.program_id, {
      plan_text: plan,
      report_text: report,
      audience_json: audience,
      prevention_link: preventionLink,
      prevention_work_types_json: workTypesJson,
    });
  }
}

export async function updateOrganizationProgram(
  programId: string,
  patch: Partial<
    Pick<
      OrganizationProgramDraft,
      | "title"
      | "program_year"
      | "scope"
      | "notes"
      | "plan_text"
      | "report_text"
      | "audience_json"
      | "prevention_link"
      | "prevention_work_types_json"
    >
  > & { artifacts?: SessionArtifacts },
): Promise<void> {
  const payload: Record<string, string | undefined> = {
    title: patch.title,
    program_year: patch.program_year,
    scope: patch.scope,
    notes: patch.notes,
    plan_text: patch.plan_text,
    report_text: patch.report_text,
    audience_json: patch.audience_json,
    prevention_link: patch.prevention_link,
    prevention_work_types_json: patch.prevention_work_types_json,
  };
  if (patch.artifacts) {
    payload.artifacts_json = serializeProgramArtifacts(patch.artifacts);
  }
  await invoke("db_update_organization_program", {
    programId,
    payload,
  });
}

export function audienceScopeSummary(audienceJson: string, legacyScope = ""): string {
  const summary = formatTargetAudienceSummary(parseTargetAudienceJson(audienceJson));
  return summary || legacyScope.trim();
}
