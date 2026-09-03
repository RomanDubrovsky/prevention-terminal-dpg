import { invoke } from "@tauri-apps/api/core";

import type {
  CasePreview,
  DashboardL1Header,
  RequestPreview,
  YearPlanTaskProgress,
} from "./dashboard_l1.ts";

export type { RequestPreview, CasePreview, YearPlanTaskProgress } from "./dashboard_l1.ts";

/** Local L1 dashboard — specialist workload without PII in cloud uploads. */
export interface SpecialistDashboardL1 extends DashboardL1Header {
  specialist_name: string;
  week_planned_minutes: number;
  week_actual_minutes: number;
  week_contract_minutes: number;
  week_load_pct: number;
  week_consultation_count: number;
  week_consultation_minutes: number;
  total_consultation_count: number;
  elevated_risk_sessions: number;
  open_requests_count: number;
  crisis_requests_count: number;
  oldest_open_requests: RequestPreview[];
  active_cases_count: number;
  cases_with_overdue_steps: CasePreview[];
  year_plan_progress: YearPlanTaskProgress[];
  group_sessions_count: number;
}

export async function fetchSpecialistDashboardL1(): Promise<SpecialistDashboardL1> {
  return invoke<SpecialistDashboardL1>("db_dashboard_l1");
}

export function uploadMetricsFromDashboard(d: SpecialistDashboardL1) {
  return {
    case_count: d.active_cases_count,
    consultation_count: d.total_consultation_count,
    work_minutes: d.week_actual_minutes,
    ipr_count: d.cases_with_overdue_steps.length,
    group_session_count: d.group_sessions_count ?? 0,
    reception_entries: d.open_requests_count,
    new_cases_in_period: d.active_cases_count,
    active_cases: d.active_cases_count,
  };
}
