/** Architect doc picker — mirrors orchestrator category → plan/report flow. */

export type ArchitectCategoryId = "consultation" | "ipr" | "ipr_report" | "group" | "safety";
export type ArchitectStageId = "plan" | "report";

export interface ArchitectCategory {
  id: ArchitectCategoryId;
  label: string;
  hint: string;
}

export interface ArchitectStage {
  id: ArchitectStageId;
  label: string;
}

/** Canonical display names from `document_service.ARCHITECT_DOC_REGISTRY`. */
export const ARCHITECT_DOC_REGISTRY: Record<string, { label: string; category: ArchitectCategoryId; stage: ArchitectStageId }> = {
  consultation_plan: {
    label: "План индивидуальной консультации",
    category: "consultation",
    stage: "plan",
  },
  consultation_report: {
    label: "Отчёт о проведении индивидуальной консультации",
    category: "consultation",
    stage: "report",
  },
  ipr_plan: {
    label: "План ИПР",
    category: "ipr",
    stage: "plan",
  },
  ipr_report: {
    label: "Отчёт о реализации ИПР",
    category: "ipr",
    stage: "report",
  },
  group_plan: {
    label: "План группового занятия",
    category: "group",
    stage: "plan",
  },
  group_report: {
    label: "Отчёт о проведении группового занятия",
    category: "group",
    stage: "report",
  },
  organization_plan: {
    label: "План профилактической программы организации",
    category: "safety",
    stage: "plan",
  },
  organization_report: {
    label: "Отчёт о реализации программы организации",
    category: "safety",
    stage: "report",
  },
};

export const ARCHITECT_CATEGORIES: ArchitectCategory[] = [
  { id: "consultation", label: "Консультация", hint: "Индивидуальная работа со случаем" },
  { id: "ipr", label: "ИПР", hint: "Индивидуальный профилактический маршрут" },
  { id: "group", label: "Групповая работа", hint: "Профилактическое групповое занятие" },
  { id: "safety", label: "Безопасная среда", hint: "Программа организации / школьная профилактика" },
];

export const ARCHITECT_STAGES: ArchitectStage[] = [
  { id: "plan", label: "План" },
  { id: "report", label: "Отчёт" },
];

/** Same mapping as `orchestrator_service` arch_stage_plan/report handlers. */
export function resolveArchitectDocType(category: ArchitectCategoryId, stage: ArchitectStageId): string {
  if (category === "consultation") return `consultation_${stage}`;
  if (category === "group") return `group_${stage}`;
  if (category === "safety") return `organization_${stage}`;
  return `${category}_${stage}`;
}

export function architectDocLabel(docType: string): string {
  return ARCHITECT_DOC_REGISTRY[docType]?.label || docType;
}

export function parseArchitectDocType(docType: string): { category: ArchitectCategoryId; stage: ArchitectStageId } | null {
  const meta = ARCHITECT_DOC_REGISTRY[docType];
  if (!meta) return null;
  return { category: meta.category, stage: meta.stage };
}
