/**
 * Compose specialist dashboard view model from L1, period metrics, inbox, situation cases.
 */

import { fetchResearchMonthlyMetrics, type ResearchMonthlyMetrics } from "./research_contribution.ts";
import { getCaseArtifacts } from "./case_store.ts";
import { listSituationCases } from "./registry_store.ts";
import { listLeads, type LeadRow } from "./inbox_client.ts";
import { getSitePortal } from "./site_portal.ts";
import { fetchSpecialistDashboardL1 } from "./specialist_dashboard.ts";
import { dashboardPeriodRange, type DashboardPeriod } from "./dashboard_period.ts";
import { collectProblemThemeStats } from "./problem_theme_stats.ts";
import type { SpecialistWorkspaceView } from "./workspace_nav.ts";

export interface DashboardMetricTile {
  id: string;
  label: string;
  value: number;
  hint?: string;
  nav?: SpecialistWorkspaceView;
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  detail: string;
  nav?: SpecialistWorkspaceView;
}

export interface DashboardDistRow {
  key: string;
  label: string;
  count: number;
}

export interface SpecialistDashboardBundle {
  header: { specialistName: string; orgName: string };
  period: DashboardPeriod;
  periodLabel: string;
  tiles: DashboardMetricTile[];
  attention: DashboardAttentionItem[];
  preventionTiers: {
    universal: DashboardDistRow[];
    selective: DashboardDistRow[];
    indicated: DashboardDistRow[];
    secondary: DashboardDistRow[];
    tertiary: DashboardDistRow[];
  };
  problems: DashboardDistRow[];
  inbox: { total: number; open: number; converted: number };
  commercial: boolean;
}

import { t } from "./i18n.ts";

const Y_LABELS: Record<string, string> = {
  Y1_Normal: t("Норма", "Normal"),
  Y2_Risk: t("Риск", "Risk"),
  Y3_Problem: t("Проблема", "Problem"),
  Y4_Crisis_Clinical: t("Кризис", "Crisis"),
};

const X_LABELS: Record<string, string> = {
  X1_Intake: t("Приём", "Intake"),
  X2_Diag: t("Диагностика", "Diagnostics"),
  X3_Intervention: t("Вмешательство", "Intervention"),
  X4_Support: t("Сопровождение", "Support"),
  X5_Close: t("Завершение", "Completed"),
};

function toResearchSlug(value: string): string {
  return value
    .split("")
    .map((c) => (/[a-zA-Z0-9]/.test(c) ? c.toLowerCase() : "_"))
    .join("");
}

function metricPrefixed(
  metrics: ResearchMonthlyMetrics,
  prefix: string,
  labels: Record<string, string>,
): DashboardDistRow[] {
  const rows: DashboardDistRow[] = [];
  for (const [labelKey, label] of Object.entries(labels)) {
    const slug = toResearchSlug(labelKey);
    const count = Number(metrics[`${prefix}${slug}`] || 0);
    if (count > 0) rows.push({ key: labelKey, label, count });
  }
  for (const [key, count] of Object.entries(metrics)) {
    if (!key.startsWith(prefix) || !Number.isFinite(count) || count <= 0) continue;
    const slug = key.slice(prefix.length);
    if (Object.keys(labels).some((k) => toResearchSlug(k) === slug)) continue;
    rows.push({ key: slug, label: slug, count: Number(count) });
  }
  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
  return rows;
}

function summarizeInbox(leads: LeadRow[]) {
  let open = 0;
  let converted = 0;
  for (const lead of leads) {
    const s = String(lead.status || "new").toLowerCase();
    if (s === "converted") converted += 1;
    else if (s !== "closed") open += 1;
  }
  return { total: leads.length, open, converted };
}

export async function loadSpecialistDashboardBundle(args: {
  period: DashboardPeriod;
  commercial: boolean;
}): Promise<SpecialistDashboardBundle> {
  const { period, commercial } = args;
  const range = dashboardPeriodRange(period);

  const [l1, metrics, situations, portal, problems] = await Promise.all([
    fetchSpecialistDashboardL1(),
    fetchResearchMonthlyMetrics(range.periodStart, range.periodEnd).catch(
      () => ({}) as ResearchMonthlyMetrics,
    ),
    listSituationCases().catch(() => []),
    getSitePortal().catch(() => null),
    collectProblemThemeStats({
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
    }).catch(() => []),
  ]);

  let leads: LeadRow[] = [];
  try {
    leads = await listLeads(portal?.center_id, 500);
  } catch {
    leads = [];
  }
  const inbox = summarizeInbox(leads);

  const consultationCount =
    period === "all"
      ? l1.total_consultation_count
      : Number(metrics.consultation_count ?? (period === "week" ? l1.week_consultation_count : 0));
  const workMinutes =
    period === "all"
      ? Number(metrics.work_minutes || 0) || l1.week_actual_minutes
      : Number(
          metrics.work_minutes ??
            (period === "week" ? l1.week_actual_minutes || l1.week_consultation_minutes : 0),
        );
  const groupCount =
    period === "all"
      ? l1.group_sessions_count
      : Number(metrics.group_session_count || 0);
  const elevated =
    period === "all"
      ? l1.elevated_risk_sessions
      : Number(metrics.elevated_risk_sessions || 0);

  const activeCases = commercial
    ? situations.length
    : l1.active_cases_count || situations.length;

  let casesWithoutReport = 0;
  if (commercial && situations.length) {
    const sample = situations.slice(0, 40);
    const arts = await Promise.all(
      sample.map((row) => getCaseArtifacts(row.case_id).catch(() => ({}))),
    );
    for (const a of arts) {
      const text = String(
        (a as { situation_report?: { text?: string } }).situation_report?.text || "",
      ).trim();
      if (!text) casesWithoutReport += 1;
    }
  }

  const tiles: DashboardMetricTile[] = [
    {
      id: "coverage",
      label: t("Охват (Первичная)", "Coverage (Primary)"),
      value: consultationCount,
      hint: `${t("Всего", "Total")} ${range.label}`,
      nav: "consultations",
    },
    {
      id: "risk_groups",
      label: t("Группы риска (Вторичная)", "Risk Groups (Secondary)"),
      value: groupCount + activeCases,
      hint: commercial ? t("Кейсы и группы", "Cases & Groups") : t("На сопровождении", "Under Monitoring"),
      nav: "group_work",
    },
    {
      id: "crisis",
      label: t("Кризисы (Третичная)", "Crisis (Tertiary)"),
      value: elevated,
      hint: t("Повышенный риск", "Elevated Risk"),
      nav: "consultations",
    },
    {
      id: "minutes",
      label: t("Минуты работы", "Work Minutes"),
      value: workMinutes,
      hint: range.label,
      nav: "consultations",
    },
    {
      id: "referrals",
      label: t("Маршрутизация", "Routing & Referrals"),
      value: l1.cases_with_overdue_steps.length,
      hint: t("Перенаправления", "Referrals"),
      nav: "ipr",
    },
    {
      id: "inbox",
      label: t("Заявки inbox", "Inbox Leads"),
      value: inbox.open,
      hint: inbox.total ? `${t("всего", "total")} ${inbox.total}` : t("нет заявок", "no leads"),
      nav: "settings",
    },
  ];

  const attention: DashboardAttentionItem[] = [];
  if (inbox.open > 0) {
    attention.push({
      id: "inbox-open",
      title: t("Открытые заявки", "Open Leads"),
      detail: `${inbox.open} ${t("требуют ответа ·", "require response ·")} ${inbox.converted} ${t("с карточкой", "with card")}`,
      nav: "settings",
    });
  }
  if (!commercial && l1.crisis_requests_count > 0) {
    attention.push({
      id: "crisis",
      title: t("Кризисные обращения", "Crisis Requests"),
      detail: String(l1.crisis_requests_count),
      nav: "consultations",
    });
  }
  if (!commercial && l1.open_requests_count > 0) {
    attention.push({
      id: "requests",
      title: t("Открытые обращения", "Open Requests"),
      detail: String(l1.open_requests_count),
    });
  }
  if (elevated > 0) {
    attention.push({
      id: "elevated",
      title: t("Сессии с повышенным риском", "Elevated Risk Sessions"),
      detail: `${elevated} ${range.label}`,
      nav: "consultations",
    });
  }
  if (casesWithoutReport > 0) {
    attention.push({
      id: "no-report",
      title: t("Кейсы без отчёта", "Cases Without Report"),
      detail: `${casesWithoutReport} ${t("из просмотренных", "of reviewed")}`,
      nav: "case_workspace",
    });
  }
  if (!commercial && l1.cases_with_overdue_steps.length > 0) {
    attention.push({
      id: "ipr-overdue",
      title: t("Просроченные шаги ИПР", "Overdue ISP Steps"),
      detail: `${l1.cases_with_overdue_steps.length} ${t("дел", "cases")}`,
      nav: "ipr",
    });
  }

    const rawY = metricPrefixed(metrics, "y_level_", Y_LABELS);
    const rawX = metricPrefixed(metrics, "x_stage_", X_LABELS);
    
    const universal = [
      ...rawY.filter(r => r.key === "Y1_Normal"),
      ...rawX.filter(r => r.key === "X1_Intake" || r.key === "X2_Diag" || r.key === "X5_Close")
    ];
    
    const selective = [
      ...rawY.filter(r => r.key === "Y2_Risk"),
    ];
    if (groupCount > 0) selective.push({ key: "group", label: t("Групповая профилактика", "Group Prevention"), count: groupCount });
    
    const indicated = [
      ...rawY.filter(r => r.key === "Y3_Problem"),
      ...rawX.filter(r => r.key === "X3_Intervention")
    ];

    const secondary = [
      ...rawY.filter(r => r.key === "Y4_Crisis_Clinical")
    ];

    const tertiary = [
      ...rawX.filter(r => r.key === "X4_Support")
    ];

  return {
    header: {
      specialistName: l1.specialist_name,
      orgName: l1.org_name,
    },
    period,
    periodLabel: range.label,
    tiles,
    attention,
    preventionTiers: { universal, selective, indicated, secondary, tertiary },
    problems,
    inbox,
    commercial,
  };
}
