import { invoke } from "@tauri-apps/api/core";

import { PREVENTION_LINK_VALUES, preventionLinkLabel } from "./prevention_link.ts";
import { taskKindLabel } from "./session_tagging.ts";
import type {
  DashboardL1Header,
  ManagerDashboardTotals,
  MonthlySevereRow,
  PreventionLevelRow,
  ThreatCategoryRow,
  YearPlanTaskProgress,
} from "./dashboard_l1.ts";

export type {
  ThreatCategoryRow,
  PreventionLevelRow,
  MonthlySevereRow,
  ManagerDashboardTotals,
  YearPlanTaskProgress,
} from "./dashboard_l1.ts";

/** Local L1 dashboard for director — threats vs 5-level prevention response. */
export interface ManagerDashboardL1 extends DashboardL1Header {
  threats: ThreatCategoryRow[];
  prevention_levels: PreventionLevelRow[];
  monthly_severe: MonthlySevereRow[];
  year_plan_progress: YearPlanTaskProgress[];
  totals: ManagerDashboardTotals;
}

export async function fetchManagerDashboardL1(): Promise<ManagerDashboardL1> {
  return invoke<ManagerDashboardL1>("db_manager_dashboard_l1");
}

const TASK_KIND_LABELS_RU: Record<string, string> = {
  bullying_victim: "Bullying (Victim)",
  bullying_aggressor: "Bullying (Aggressor)",
  self_harm_suicidal: "Self-harm / Suicidal",
  academic_motivation: "Academic Motivation",
  family_conflict: "Family Conflict",
  family_crisis: "Family Crisis",
  addiction_substance: "Substance Addiction",
  addiction_screen: "Screen Addiction",
  anxiety_fears: "Anxiety / Fears",
  depressive_state: "Depressive State",
  loneliness_isolation: "Loneliness / Isolation",
  identity_self_esteem: "Identity / Self-esteem",
  trauma_experience: "Trauma Experience",
  criminal_behavior: "Delinquency",
  other: "Other",
  elevated_consultation: "Elevated Risk Consultations",
};

export function threatCategoryLabel(key: string): string {
  return TASK_KIND_LABELS_RU[key] ?? taskKindLabel(key);
}

export function preventionPlanPct(row: PreventionLevelRow): number {
  const planned = row.planned_hours * 60 + row.planned_reach;
  const actual = row.actual_hours * 60 + row.actual_reach;
  if (planned <= 0) return actual > 0 ? 100 : 0;
  return Math.min(200, Math.round((actual * 100) / planned));
}

export function lastMonths(count = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${d.getFullYear()}-${month}`);
  }
  return out;
}

export function formatMonthLabel(month: string): string {
  const [year, mm] = month.split("-");
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const idx = Number.parseInt(mm || "1", 10) - 1;
  return `${names[idx] ?? mm} ${year?.slice(2) ?? ""}`.trim();
}

export interface PreventionLinkSummary {
  prevention_link: string;
  label: string;
  planned_hours: number;
  planned_reach: number;
  actual_hours: number;
  actual_reach: number;
  plan_pct: number;
}

/** Roll up prevention rows across months per L1–L5 link. */
export function summarizePreventionByLink(rows: PreventionLevelRow[]): PreventionLinkSummary[] {
  const map = new Map<string, PreventionLinkSummary>();
  for (const link of PREVENTION_LINK_VALUES) {
    map.set(link, {
      prevention_link: link,
      label: preventionLinkLabel(link),
      planned_hours: 0,
      planned_reach: 0,
      actual_hours: 0,
      actual_reach: 0,
      plan_pct: 0,
    });
  }
  for (const row of rows) {
    const bucket = map.get(row.prevention_link as (typeof PREVENTION_LINK_VALUES)[number]);
    if (!bucket) continue;
    bucket.planned_hours += row.planned_hours;
    bucket.planned_reach += row.planned_reach;
    bucket.actual_hours += row.actual_hours;
    bucket.actual_reach += row.actual_reach;
  }
  for (const bucket of map.values()) {
    bucket.plan_pct = preventionPlanPct({
      prevention_link: bucket.prevention_link,
      month: "",
      planned_hours: bucket.planned_hours,
      planned_reach: bucket.planned_reach,
      actual_hours: bucket.actual_hours,
      actual_reach: bucket.actual_reach,
    });
  }
  return [...map.values()];
}

export interface ThreatHeatmapCell {
  incidents: number;
  severe: number;
  avgSeverity: number;
}

/** Matrix category × month for heatmap table. */
export function buildThreatHeatmap(
  threats: ThreatCategoryRow[],
  months: string[],
): Map<string, Map<string, ThreatHeatmapCell>> {
  const matrix = new Map<string, Map<string, ThreatHeatmapCell>>();
  for (const row of threats) {
    if (!months.includes(row.month)) continue;
    let byMonth = matrix.get(row.category_key);
    if (!byMonth) {
      byMonth = new Map();
      matrix.set(row.category_key, byMonth);
    }
    byMonth.set(row.month, {
      incidents: row.incidents,
      severe: row.severe_incidents,
      avgSeverity: row.avg_severity,
    });
  }
  return matrix;
}
