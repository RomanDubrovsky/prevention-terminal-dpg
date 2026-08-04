/**
 * Cloud federation client (T2): register node, attach invite, rollup, aggregate upload.
 */

import { platformApiBase } from "./platform_api.ts";
import type { TerminalConfig } from "./terminal_config.ts";
import type { OrgProfile } from "./terminal_profiles.ts";
import type { InstallationMeta } from "./installation_meta.ts";
import { isDemoModeActive, readDemoWorkspace } from "./staging_demo_seed.ts";

function apiBase(): string {
  return platformApiBase();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export interface RollupTerritorySlice {
  key: string;
  label: string;
  group_by: string;
  nodes: number;
  contributing_nodes: number;
  suppressed: boolean;
  k_floor: number;
  metrics: Record<string, number | string>;
  organizations?: Array<{
    terminal_user_id: string;
    organization_name?: string;
    settlement?: string;
    region?: string;
  }>;
}

export interface ManagerRollup {
  contributing_nodes: number;
  suppressed: boolean;
  k_floor: number;
  metrics: Record<string, number | string>;
  territories?: RollupTerritorySlice[];
  group_by?: string;
}

export interface RollupResponse {
  ok: boolean;
  rollup: ManagerRollup;
}

export interface PendingLinkRow {
  link_id?: string;
  child_terminal_user_id: string;
  organization_name?: string;
  settlement?: string;
  region?: string;
  org_snapshot?: Record<string, unknown>;
}

export async function registerTerminalNode(args: {
  terminalConfig: TerminalConfig;
  installId?: string;
  meta?: InstallationMeta;
  orgProfile?: OrgProfile;
  organizationName?: string;
}): Promise<void> {
  const { terminalConfig: cfg } = args;
  const meta = args.meta;
  await postJson("/api/terminal/nodes/register", {
    terminal_user_id: cfg.terminal_user_id,
    install_id: args.installId,
    mode: cfg.mode,
    child_invite_code: cfg.child_invite_code,
    parent_invite_code: cfg.parent_invite_code,
    country: meta?.country,
    region: meta?.region,
    municipality: meta?.municipality,
    settlement: meta?.settlement,
    geo_lat: meta?.lat ?? undefined,
    geo_lon: meta?.lng ?? undefined,
    organization_name: args.organizationName ?? meta?.organization_label,
    org_type: cfg.org_type,
    manager_scope: cfg.manager_scope,
    workspace_preset: cfg.workspace_preset,
    approx_learner_count: args.orgProfile?.approx_learner_count ?? undefined,
    isced_level: args.orgProfile?.isced_level ?? undefined,
    org_snapshot: args.orgProfile
      ? {
          organization_name: args.orgProfile.display_name,
          org_type: cfg.org_type,
          settlement: meta?.settlement,
          region: meta?.region,
          municipality: meta?.municipality,
          approx_learner_count: args.orgProfile.approx_learner_count,
          approx_learner_ovz_count: args.orgProfile.approx_learner_ovz_count,
          isced_level: args.orgProfile.isced_level,
          org_sphere: args.orgProfile.org_sphere,
          org_sphere_other: args.orgProfile.org_sphere_other,
          education_org_type: args.orgProfile.education_org_type,
          org_kind: args.orgProfile.org_kind,
        }
      : {},
    enabled_modules: cfg.enabled_modules,
  });
}

export async function attachFederationInvite(
  terminalUserId: string,
  inviteCode: string,
): Promise<void> {
  if (!inviteCode.trim()) return;
  await postJson("/api/terminal/federation/attach", {
    terminal_user_id: terminalUserId,
    invite_code: inviteCode.trim(),
  });
}

export async function fetchManagerRollup(terminalUserId: string): Promise<ManagerRollup> {
  // Demo mode: return rich mock rollup without hitting API
  if (isDemoModeActive()) {
    const ws = readDemoWorkspace();
    if (ws === "manager" || ws === "school") {
      return buildSchoolManagerDemoRollup();
    }
    if (ws === "authority") {
      return buildAuthorityDemoRollup();
    }
  }
  const q = encodeURIComponent(terminalUserId);
  const data = await getJson<RollupResponse>(`/api/terminal/federation/rollup?terminal_user_id=${q}`);
  return data.rollup;
}

export async function fetchPendingFederationLinks(
  terminalUserId: string,
): Promise<PendingLinkRow[]> {
  const q = encodeURIComponent(terminalUserId);
  const data = await getJson<{ ok: boolean; pending: PendingLinkRow[] }>(
    `/api/terminal/federation/pending?terminal_user_id=${q}`,
  );
  return data.pending || [];
}

export async function approveFederationLink(
  parentTerminalUserId: string,
  childTerminalUserId: string,
): Promise<void> {
  await postJson("/api/terminal/federation/approve", {
    parent_terminal_user_id: parentTerminalUserId,
    child_terminal_user_id: childTerminalUserId,
  });
}

export async function uploadWeeklyAggregate(args: {
  terminalUserId: string;
  metrics: Record<string, number>;
}): Promise<void> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  await postJson("/api/terminal/aggregate", {
    terminal_user_id: args.terminalUserId,
    period_start: start.toISOString().slice(0, 10),
    period_end: now.toISOString().slice(0, 10),
    metrics: args.metrics,
  });
}

/** Обезличенный месячный вклад в исследования (отдельно от federation rollup). */
export async function uploadResearchContribution(args: {
  terminalUserId: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
  context: Record<string, string | number>;
}): Promise<void> {
  await postJson("/api/terminal/aggregate", {
    terminal_user_id: args.terminalUserId,
    purpose: "research",
    period_start: args.periodStart,
    period_end: args.periodEnd,
    metrics: args.metrics,
    context: args.context,
  });
}

export async function syncTerminalCloudAfterOnboarding(args: {
  terminalConfig: TerminalConfig;
  installId?: string;
  meta?: InstallationMeta;
  orgProfile?: OrgProfile;
  country?: string;
  settlement?: string;
  organizationName?: string;
}): Promise<string | null> {
  try {
    await registerTerminalNode(args);
    const cfg = args.terminalConfig;
    const invite =
      cfg.mode === "specialist" ? cfg.parent_invite_in : cfg.child_invite_in;
    if (invite) {
      await attachFederationInvite(cfg.terminal_user_id, invite);
    }
    return null;
  } catch (err) {
    return String(err);
  }
}

// ---------------------------------------------------------------------------
// Demo rollup builders — used only in staging demo mode
// ---------------------------------------------------------------------------

function buildSchoolManagerDemoRollup(): ManagerRollup {
  return {
    contributing_nodes: 1,
    suppressed: false,
    k_floor: 3,
    metrics: {
      consultation_count: 12,
      reception_entries: 8,
      work_minutes: 720,
      group_session_count: 4,
      new_cases_in_period: 3,
      active_cases: 3,
      ipr_count: 2,
      case_count: 5,
    },
  };
}

function buildAuthorityDemoRollup(): ManagerRollup {
  return {
    contributing_nodes: 5,
    suppressed: false,
    k_floor: 3,
    metrics: {
      consultation_count: 87,
      reception_entries: 54,
      work_minutes: 5220,
      group_session_count: 18,
      new_cases_in_period: 21,
      active_cases: 34,
      ipr_count: 14,
      case_count: 41,
    },
    territories: [
      {
        key: "school_321",
        label: "ГБОУ Школа №321",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 12, group_session_count: 4, active_cases: 3, ipr_count: 2, work_minutes: 720, new_cases_in_period: 3, case_count: 5, reception_entries: 8 },
      },
      {
        key: "school_lyceum3",
        label: "Лицей №3",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 19, group_session_count: 5, active_cases: 8, ipr_count: 4, work_minutes: 1140, new_cases_in_period: 6, case_count: 10, reception_entries: 12 },
      },
      {
        key: "school_dialog",
        label: "Гимназия «Диалог»",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 24, group_session_count: 4, active_cases: 9, ipr_count: 3, work_minutes: 1440, new_cases_in_period: 5, case_count: 12, reception_entries: 15 },
      },
      {
        key: "school_sosh21",
        label: "СОШ №21",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 18, group_session_count: 3, active_cases: 7, ipr_count: 3, work_minutes: 1080, new_cases_in_period: 4, case_count: 8, reception_entries: 11 },
      },
      {
        key: "school_internat",
        label: "Школа-интернат №7",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 14, group_session_count: 2, active_cases: 7, ipr_count: 2, work_minutes: 840, new_cases_in_period: 3, case_count: 6, reception_entries: 8 },
      },
    ],
  };
}
