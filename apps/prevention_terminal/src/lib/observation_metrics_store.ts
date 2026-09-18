import { t } from "./i18n";

export interface ObservationMetric {
  id: string;
  title: string;
  description: string;
  isStandard: boolean; // Стандартные (ФГОС) нельзя удалить, но можно временно отключить
  enabled: boolean;
}

export const DEFAULT_STANDARD_METRICS: ObservationMetric[] = [
  { id: "std_1", title: t("Агрессивность и конфликтность", "Aggression and conflict"), description: t("Вербальная или физическая агрессия к сверстникам, участие в травле, вспышки гнева", "Verbal/physical aggression, bullying, outbursts"), isStandard: true, enabled: true },
  { id: "std_2", title: t("Социальная изоляция", "Social isolation"), description: t("Одиночество на переменах, отвержение классом, отсутствие контактов с ровесниками", "Loneliness, rejection by peers, lack of contacts"), isStandard: true, enabled: true },
  { id: "std_3", title: t("Оппозиционно-вызывающее поведение", "Oppositional defiant behavior"), description: t("Открытый саботаж правил, демонстративное неподчинение, грубость педагогам", "Sabotaging rules, defiance, rudeness to teachers"), isStandard: true, enabled: true },
  { id: "std_4", title: t("Эмоциональная нестабильность", "Emotional instability"), description: t("Апатия, подавленность, плаксивость, видимая тревога, резкие перепады настроения", "Apathy, depression, anxiety, mood swings"), isStandard: true, enabled: true },
  { id: "std_5", title: t("Учебная дезадаптация", "Academic maladaptation"), description: t("Резкое беспричинное снижение успеваемости, отказ от работы на уроке, частые прогулы", "Sudden grade drop, refusal to work, truancy"), isStandard: true, enabled: true },
  { id: "std_6", title: t("Внешние физические маркеры", "Physical markers"), description: t("Систематически неопрятный вид, признаки недосыпа, следы селфхарма, подозрение на употребление ПАВ", "Unkempt look, lack of sleep, self-harm marks, substance use suspicion"), isStandard: true, enabled: true },
];

const STORAGE_KEY = "prevention_observation_metrics_v1";

export function loadObservationMetrics(): ObservationMetric[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STANDARD_METRICS;
    const parsed: ObservationMetric[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_STANDARD_METRICS;
    return parsed;
  } catch (err) {
    console.error("Failed to load observation metrics", err);
    return DEFAULT_STANDARD_METRICS;
  }
}

export function saveObservationMetrics(metrics: ObservationMetric[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  } catch (err) {
    console.error("Failed to save observation metrics", err);
  }
}

export function getActiveObservationMetrics(): ObservationMetric[] {
  return loadObservationMetrics().filter(m => m.enabled);
}
