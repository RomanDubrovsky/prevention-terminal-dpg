/** Russian labels for federation rollup and local dashboard metrics. */

export const ROLLUP_METRIC_LABELS: Record<string, string> = {
  consultation_count: "Консультации (всего)",
  case_count: "Кейсы",
  active_cases: "Активные дела",
  new_cases_in_period: "Новые кейсы за период",
  ipr_count: "ИПР",
  group_session_count: "Групповые занятия",
  work_minutes: "Минуты работы",
  reception_entries: "Записи приема",
  adherence_score_avg: "Соответствие протоколам (%)",
  adherence_score_sum: "Сумма баллов качества",
  adherence_score_count: "Проверено сессий",
  elevated_risk_sessions: "Сессии с повышенным риском",
  contributing_nodes: "Подключено специалистов",
};

export const ROLLUP_METRIC_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Универсальная профилактика",
    keys: ["consultation_count", "reception_entries", "work_minutes"],
  },
  {
    title: "Селективная профилактика",
    keys: ["group_session_count", "new_cases_in_period"],
  },
  {
    title: "Индикативная профилактика",
    keys: ["active_cases", "ipr_count", "case_count"],
  },
  {
    title: "Качество и Обучение",
    keys: ["adherence_score_avg"],
  },
];

export function rollupMetricLabel(key: string): string {
  return ROLLUP_METRIC_LABELS[key] ?? key;
}

export function formatMinutesShort(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function loadPctTone(pct: number): "ok" | "warn" | "high" {
  if (pct >= 100) return "high";
  if (pct >= 85) return "warn";
  return "ok";
}
