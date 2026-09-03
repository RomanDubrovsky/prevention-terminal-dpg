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
  contactEmail?: string;
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
    contact_email: args.contactEmail || args.terminalConfig.contact_email || undefined,
    enabled_modules: cfg.enabled_modules,
  });
}

export interface TerminalNodeLookupResult {
  found: boolean;
  node: {
    terminal_user_id: string;
    mode: string;
    workspace_preset: string;
    org_type: string | null;
    manager_scope: string | null;
    child_invite_code: string;
    parent_invite_code: string | null;
    org_snapshot: Record<string, unknown>;
    organization_name?: string;
    settlement?: string;
    region?: string;
    enabled_modules: Record<string, boolean>;
    contact_email?: string;
  } | null;
}

export async function lookupTerminalByEmail(
  email: string,
): Promise<TerminalNodeLookupResult> {
  const q = encodeURIComponent(email.trim().toLowerCase());
  const data = await getJson<{ ok: boolean; found: boolean; node: TerminalNodeLookupResult["node"] }>(
    `/api/terminal/nodes/lookup-by-email?email=${q}`,
  );
  return { found: data.found, node: data.node };
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
  if (isDemoModeActive()) {
    return [];
  }
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
  });
}

export async function uploadSupervisionMetrics(args: {
  terminalUserId: string;
  adherenceScore: number | null;
  learningOpportunities: string[];
}): Promise<void> {
  const metrics: Record<string, number> = {};
  if (args.adherenceScore !== null) {
    metrics["adherence_score_sum"] = args.adherenceScore;
    metrics["adherence_score_count"] = 1;
  }
  for (const gap of args.learningOpportunities) {
    const key = `skill_gap_${gap.replace(/\s+/g, "_")}`;
    metrics[key] = (metrics[key] || 0) + 1;
  }
  
  const now = new Date();
  await postJson("/api/terminal/aggregate", {
    terminal_user_id: args.terminalUserId,
    period_start: now.toISOString().slice(0, 10),
    period_end: now.toISOString().slice(0, 10),
    metrics: metrics,
  });
}

/** РћР±РµР·Р»РёС‡РµРЅРЅС‹Р№ РјРµСЃСЏС‡РЅС‹Р№ РІРєР»Р°Рґ РІ РёСЃСЃР»РµРґРѕРІР°РЅРёСЏ (РѕС‚РґРµР»СЊРЅРѕ РѕС‚ federation rollup). */
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
  contactEmail?: string;
}): Promise<string | null> {

  try {
    await registerTerminalNode(args);
    const cfg = args.terminalConfig;
    const invite =
      cfg.mode === "specialist" ? cfg.parent_invite_in : cfg.child_invite_in;
    if (invite) {
      await attachFederationInvite(cfg.terminal_user_id, invite).catch((e) => {
        console.warn("Federation attach invite notice:", e);
      });
    }
    return null;
  } catch (err) {
    return String(err);
  }
}

// ---------------------------------------------------------------------------
// Demo rollup builders вЂ” used only in staging demo mode
// ---------------------------------------------------------------------------

function buildSchoolManagerDemoRollup(): ManagerRollup {
  return {
    contributing_nodes: 1,
    suppressed: false,
    k_floor: 3,
    metrics: {
      organization_name: "РЁРєРѕР»Р° в„–12",
      total_students: 850,
      prevention_universal_coverage: "90%",
      prevention_selective_risk_groups: 45,
      prevention_indicative_active_incidents: 12,
      incidents_grade_5_6: 2,
      incidents_grade_7_bullying_outbreak: 8,
      incidents_grade_8_9: 2,
      fba_created: 3,
      mdr_created: 2,
      consultations_conducted: 15,
      mediation_sessions: 0,
      incidents_growth_vs_last_month: "+15%",
      staff_overwork_index: "High",
      top_learning_opportunities: "РњРµРґРёР°С†РёСЏ РєРѕРЅС„Р»РёРєС‚РѕРІ (0 СЃРµСЃСЃРёР№ РїСЂРё 12 РёРЅС†РёРґРµРЅС‚Р°С…)",
    },
  };
}

function buildAuthorityDemoRollup(): ManagerRollup {
  return {
    contributing_nodes: 5,
    suppressed: false,
    k_floor: 3,
    metrics: {
      organization_name: "РўРµСЂСЂРёС‚РѕСЂРёР°Р»СЊРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ РѕР±СЂР°Р·РѕРІР°РЅРёСЏ",
      total_students: 4500,
      prevention_universal_coverage: "82%",
      prevention_selective_risk_groups: 320,
      prevention_indicative_active_incidents: 45,
      critical_incidents_level_5: 3,
      critical_incidents_location: "РЁРєРѕР»Р° в„–12 (2 РёРЅС†РёРґРµРЅС‚Р°), РЁРєРѕР»Р° в„–8 (1 РёРЅС†РёРґРµРЅС‚)",
      fba_created: 14,
      mdr_created: 8,
      consultations_conducted: 120,
      mediation_sessions: 2,
      incidents_growth_vs_last_month: "+8%",
      staff_overwork_index: "Medium",
      top_learning_opportunities: "РљСЂРёР·РёСЃРЅР°СЏ РёРЅС‚РµСЂРІРµРЅС†РёСЏ, РњРµРґРёР°С†РёСЏ РєРѕРЅС„Р»РёРєС‚РѕРІ",
    },
    territories: [
      { key: "demo-school-321", label: "Школа №12 (Очаг)", group_by: "organization", nodes: 1, contributing_nodes: 1, suppressed: false, k_floor: 3, metrics: { consultation_count: 12, group_session_count: 4, active_cases: 3, ipr_count: 2, work_minutes: 720, new_cases_in_period: 3, case_count: 5, reception_entries: 8 },
      },
      {
        key: "school_lyceum3",
        label: "Р›РёС†РµР№ в„–3",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 19, group_session_count: 5, active_cases: 8, ipr_count: 4, work_minutes: 1140, new_cases_in_period: 6, case_count: 10, reception_entries: 12 },
      },
      {
        key: "school_dialog",
        label: "Р“РёРјРЅР°Р·РёСЏ В«Р”РёР°Р»РѕРіВ»",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 24, group_session_count: 4, active_cases: 9, ipr_count: 3, work_minutes: 1440, new_cases_in_period: 5, case_count: 12, reception_entries: 15 },
      },
      {
        key: "school_sosh21",
        label: "РЎРћРЁ в„–21",
        group_by: "organization",
        nodes: 1,
        contributing_nodes: 1,
        suppressed: false,
        k_floor: 3,
        metrics: { consultation_count: 18, group_session_count: 3, active_cases: 7, ipr_count: 3, work_minutes: 1080, new_cases_in_period: 4, case_count: 8, reception_entries: 11 },
      },
      {
        key: "school_internat",
        label: "РЁРєРѕР»Р°-РёРЅС‚РµСЂРЅР°С‚ в„–7",
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

