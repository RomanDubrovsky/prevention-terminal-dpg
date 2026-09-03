import { invoke } from "@tauri-apps/api/core";

import { RESEARCH_CONSENT_VERSION } from "../content/research_contribution_copy.ts";
import type { InstallationMeta } from "./installation_meta.ts";
import { uploadResearchContribution } from "./federation_client.ts";
import type { TerminalConfig, TerminalConfigInput } from "./terminal_config.ts";

export type ResearchMonthlyMetrics = Record<string, number>;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Календарный месяц, за который отправляем (обычно предыдущий). */
export function researchUploadPeriod(now = new Date()): {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
} {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const prevYear = m === 0 ? y - 1 : y;
  const prevMonth = m === 0 ? 11 : m - 1;
  const start = new Date(Date.UTC(prevYear, prevMonth, 1));
  const end = new Date(Date.UTC(prevYear, prevMonth + 1, 0));
  return {
    periodKey: `${prevYear}-${pad2(prevMonth + 1)}`,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export function isResearchContributionEnabled(cfg: TerminalConfig): boolean {
  return cfg.research_contribution_enabled === true;
}

export function shouldUploadResearchContribution(
  cfg: TerminalConfig,
  now = new Date(),
): boolean {
  if (!isResearchContributionEnabled(cfg)) return false;
  const { periodKey } = researchUploadPeriod(now);
  return cfg.research_contribution_last_period_key !== periodKey;
}

export async function researchParticipantId(terminalUserId: string): Promise<string> {
  const payload = new TextEncoder().encode(`prevention_research_v1|${terminalUserId}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TAXONOMY_PREFIXES = ["y_level_", "x_stage_", "problem_", "method_tag_", "technique_"];

/** Скрываем детальные коды при очень малой активности (k-anonymity lite). */
export function applyResearchKAnonymity(metrics: ResearchMonthlyMetrics): ResearchMonthlyMetrics {
  const activity =
    (metrics.consultation_count ?? 0) +
    (metrics.work_minutes ?? 0) +
    (metrics.group_session_count ?? 0);
  if (activity >= 3) return metrics;
  const out: ResearchMonthlyMetrics = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (TAXONOMY_PREFIXES.some((p) => key.startsWith(p))) continue;
    out[key] = value;
  }
  out.suppressed_low_volume = 1;
  return out;
}

export function terminalConfigToInput(cfg: TerminalConfig): TerminalConfigInput {
  return {
    edition: cfg.edition,
    mode: cfg.mode,
    workspace_preset: cfg.workspace_preset,
    org_type: cfg.org_type,
    manager_scope: cfg.manager_scope,
    job_title: cfg.job_title,
    child_invite_code: cfg.child_invite_code,
    parent_invite_code: cfg.parent_invite_code,
    parent_invite_in: cfg.parent_invite_in,
    child_invite_in: cfg.child_invite_in,
    consumer_app: cfg.consumer_app,
    enabled_modules: cfg.enabled_modules,
    registry_enabled: cfg.registry_enabled,
    research_contribution_enabled: cfg.research_contribution_enabled,
    research_contribution_consented_at: cfg.research_contribution_consented_at,
    research_contribution_consent_version: cfg.research_contribution_consent_version,
    research_contribution_last_period_key: cfg.research_contribution_last_period_key,
  };
}

export async function saveResearchContributionEnabled(args: {
  cfg: TerminalConfig;
  enabled: boolean;
}): Promise<TerminalConfig> {
  const nowIso = new Date().toISOString();
  const input: TerminalConfigInput = {
    ...terminalConfigToInput(args.cfg),
    research_contribution_enabled: args.enabled,
    research_contribution_consented_at: args.enabled ? nowIso : null,
    research_contribution_consent_version: args.enabled ? RESEARCH_CONSENT_VERSION : null,
    research_contribution_last_period_key: args.enabled
      ? args.cfg.research_contribution_last_period_key
      : null,
  };
  return invoke<TerminalConfig>("terminal_save_config", { input });
}

export async function fetchResearchMonthlyMetrics(
  periodStart: string,
  periodEnd: string,
): Promise<ResearchMonthlyMetrics> {
  const raw = await invoke<{ metrics: ResearchMonthlyMetrics }>("db_research_monthly_metrics", {
    periodStart,
    periodEnd,
  });
  return raw.metrics ?? {};
}

export async function maybeUploadResearchContribution(args: {
  cfg: TerminalConfig;
  meta?: InstallationMeta | null;
  now?: Date;
}): Promise<{
  uploaded: boolean;
  periodKey?: string;
  error?: string;
  terminalConfig?: TerminalConfig;
}> {
  const now = args.now ?? new Date();
  if (!shouldUploadResearchContribution(args.cfg, now)) {
    return { uploaded: false };
  }
  const period = researchUploadPeriod(now);
  try {
    const metrics = applyResearchKAnonymity(
      await fetchResearchMonthlyMetrics(period.periodStart, period.periodEnd),
    );
    const participantId = await researchParticipantId(args.cfg.terminal_user_id);
    await uploadResearchContribution({
      terminalUserId: args.cfg.terminal_user_id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      metrics,
      context: {
        edition: args.cfg.edition,
        org_type: args.cfg.org_type || "unknown",
        workspace_preset: args.cfg.workspace_preset,
        country: args.meta?.country || "",
        region: args.meta?.region || "",
        consent_version: args.cfg.research_contribution_consent_version || RESEARCH_CONSENT_VERSION,
        participant_id: participantId,
        registry_enabled: args.cfg.registry_enabled ? 1 : 0,
      },
    });
    const input: TerminalConfigInput = {
      ...terminalConfigToInput(args.cfg),
      research_contribution_last_period_key: period.periodKey,
    };
    const terminalConfig = await invoke<TerminalConfig>("terminal_save_config", { input });
    return { uploaded: true, periodKey: period.periodKey, terminalConfig };
  } catch (err) {
    return {
      uploaded: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
