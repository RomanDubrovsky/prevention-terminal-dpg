export interface ManagerAiPrompt {
  id: string;
  label: string;
  hint: string;
  message: string;
}

/** Preset supervisor prompts — require AI subscription for managers. */
export const MANAGER_AI_ANALYTICS_PROMPTS: ManagerAiPrompt[] = [
  {
    id: "interpret",
    label: "Интерпретировать свод",
    hint: "Что значат цифры на дашборде для руководителя?",
    message:
      "Analyze the aggregated dashboard rollup. Explain in plain language what is happening in the organization, without any PII.",
  },
  {
    id: "priorities",
    label: "Приоритеты недели",
    hint: "На что направить управленческое внимание",
    message:
      "Based on the dashboard rollup, suggest 3-5 priorities for the manager for the upcoming week regarding prevention and psychological wellbeing.",
  },
  {
    id: "risks",
    label: "Риски и тренды",
    hint: "Сигналы отклонений в агрегированных данных",
    message:
      "Highlight potential risks and trends based on aggregated metrics. Indicate which metrics deserve attention and why.",
  },
  {
    id: "methods",
    label: "Методические рекомендации",
    hint: "Что усилить в службе",
    message:
      "Provide methodological recommendations to the manager: what to strengthen in the work of the psychological service/center, based on the rollup.",
  },
  {
    id: "report",
    label: "Пункты для отчета",
    hint: "Краткие тезисы для выступления или совещания",
    message:
      "Prepare brief talking points for a management report (5-7 items) based on the aggregated rollup — without names or PII.",
  },
];
