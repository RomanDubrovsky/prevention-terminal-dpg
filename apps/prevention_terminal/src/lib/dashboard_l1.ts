/** Shared L1 dashboard shapes (specialist + manager, local SQLite). */

export interface DashboardL1Header {
  org_name: string;
  school_year: string;
}

export interface RequestPreview {
  id: string;
  received_at: string;
  source: string;
  subject_shadow_id: string;
  topic_text: string;
  urgency: string;
  status: string;
}

export interface CasePreview {
  case_id: string;
  primary_task_kind: string;
  overdue_steps: number;
}

export interface YearPlanTaskProgress {
  task_id: string;
  title: string;
  planned_minutes: number;
  actual_minutes: number;
  progress_pct: number;
}

export interface ThreatCategoryRow {
  category_key: string;
  month: string;
  incidents: number;
  severe_incidents: number;
  avg_severity: number;
}

export interface PreventionLevelRow {
  prevention_link: string;
  month: string;
  planned_hours: number;
  planned_reach: number;
  actual_hours: number;
  actual_reach: number;
}

export interface MonthlySevereRow {
  month: string;
  severe_incidents: number;
  elevated_consultations: number;
}

export interface ManagerDashboardTotals {
  active_cases: number;
  open_requests: number;
  crisis_requests: number;
  group_sessions_year: number;
  organization_programs_year: number;
  case_status_funnel?: CaseStatusFunnel;
  target_group_effectiveness?: TargetGroupEffectivenessRow[];
}

export interface CaseStatusFunnel {
  draft: number;
  active: number;
  completed: number;
  archived: number;
  total: number;
}

export interface TargetGroupEffectivenessRow {
  target_key: string;
  target_label: string;
  problem_category: string;
  total_cases: number;
  active_cases: number;
  completed_cases: number;
  archived_cases: number;
  effectiveness_pct: number;
  avg_duration_days: number;
}
