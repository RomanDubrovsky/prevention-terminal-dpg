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
    label: "Управленческий отчет (PDCA)",
    hint: "Сформировать отчет по 5 шагам: оценка, задачи, действия, эффективность, рекомендации",
    message:
      "ТВОЯ РОЛЬ: ИИ-Аналитик (Директорский Дашборд).\nЗАДАЧА: Проанализировать статистику (метрики) по организации и сформировать четкий управленческий отчет на основе цикла PDCA.\n\nФОРМАТ ОТЧЕТА (СТРОГО 5 БЛОКОВ):\n\n1. Оценка ситуации (по уровням профилактики)\n- Универсальная, Селективная, Индикативная. Выдели очаги напряжения.\n\n2. Задачи для исправления ситуации\n- Сформулируй 2-3 измеримые управленческие задачи (OKR).\n\n3. Фактические действия по исполнению задач\n- Что уже сделано сотрудниками (по данным метрик: ФАП, ППк, сессии).\n\n4. Оценка эффективности\n- Сопоставь усилия (п.3) и текущую динамику инцидентов.\n\n5. Управленческие рекомендации\n- Дай жесткие, практичные советы руководителю.\n\nСТИЛЬ: Деловой, без воды, используй маркеры.",
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
