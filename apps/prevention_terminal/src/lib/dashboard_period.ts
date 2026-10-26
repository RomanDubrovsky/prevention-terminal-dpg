import { t } from "./i18n.ts";

/** Period filter for specialist dashboard. */

export type DashboardPeriod = "week" | "month" | "all";

export const DASHBOARD_PERIOD_OPTIONS = [
  { id: "week", get label() { return t("Неделя", "Week"); } },
  { id: "month", get label() { return t("Месяц", "Month"); } },
  { id: "all", get label() { return t("Всё время", "All time"); } },
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Inclusive UTC date range for research/L1 period queries. */
export function dashboardPeriodRange(
  period: DashboardPeriod,
  now = new Date(),
): { periodStart: string; periodEnd: string; label: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "all") {
    return {
      periodStart: "1970-01-01",
      periodEnd: toIsoDate(end),
      label: t("за всё время", "for all time"),
    };
  }
  if (period === "month") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return {
      periodStart: toIsoDate(start),
      periodEnd: toIsoDate(end),
      label: t("за месяц", "for the month"),
    };
  }
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    periodStart: toIsoDate(start),
    periodEnd: toIsoDate(end),
    label: t("за неделю", "for the week"),
  };
}
