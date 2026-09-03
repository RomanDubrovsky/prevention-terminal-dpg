/** Product-level checkboxes shown in specialist onboarding (maps to technical modules). */

export interface SpecialistProductBundle {
  id: string;
  title_ru: string;
  title_en: string;
  description_ru: string;
  description_en: string;
  moduleKeys: string[];
  /** Shown only for education / preventive_public org types. */
  schoolLikeOnly?: boolean;
  defaultChecked?: boolean;
}

export const SPECIALIST_PRODUCT_BUNDLES: SpecialistProductBundle[] = [
  {
    id: "ai_assistant",
    title_ru: "ИИ-Помощник",
    title_en: "AI Assistant",
    description_ru: "Персональный ИИ-ассистент для помощи в разборе ситуаций, супервизии и планировании.",
    description_en: "Personal AI assistant for case analysis, supervision, and planning.",
    moduleKeys: ["ai_assistant"],
    defaultChecked: true,
  },
  {
    id: "academy",
    title_ru: "Академия ИИ",
    title_en: "Academy",
    description_ru: "Интерактивная база знаний и обучающие материалы.",
    description_en: "Interactive knowledge base and learning materials.",
    moduleKeys: ["academy"],
    defaultChecked: true,
  },
  {
    id: "cases",
    title_ru: "Кейсы",
    title_en: "Cases",
    description_ru: "Реестр кейсов (заявки, карточки клиентов и общая база).",
    description_en: "Case registry (leads, client cards, and shared database).",
    moduleKeys: ["reception_journal"],
  },
  {
    id: "consultations",
    title_ru: "Консультации",
    title_en: "Consultations",
    description_ru: "Журнал ведения индивидуальных консультаций и сессий.",
    description_en: "Individual consultation and session journal.",
    moduleKeys: ["consultation_journal"],
  },
  {
    id: "ipr",
    title_ru: "ИПР",
    title_en: "IPR",
    description_ru: "Индивидуальная программа реабилитации (личное дело ребёнка).",
    description_en: "Individual education plan (child record).",
    moduleKeys: ["ipr"],
    schoolLikeOnly: true,
  },
  {
    id: "group_work",
    title_ru: "Групповая работа",
    title_en: "Group Work",
    description_ru: "Журнал и конструктор групповых профилактических занятий.",
    description_en: "Group prevention session builder and journal.",
    moduleKeys: ["group_sessions"],
  },
  {
    id: "safe_environment",
    title_ru: "Безопасная среда",
    title_en: "Safe Environment",
    description_ru: "Программа мониторинга безопасной среды образовательной организации.",
    description_en: "School-wide safe environment monitoring program.",
    moduleKeys: ["safe_environment"],
    schoolLikeOnly: true,
  },
];

export const MANAGER_PRODUCT_BUNDLES: SpecialistProductBundle[] = [
  {
    id: "ai_assistant",
    title_ru: "ИИ-Чат специалистов",
    title_en: "AI Assistant",
    description_ru: "Персональный чат-ассистент для разбора клиентских случаев (для специалистов; по умолчанию отключён для руководителей).",
    description_en: "Personal chat assistant for client case analysis (for specialists; disabled by default for managers).",
    moduleKeys: ["ai_assistant"],
  },
  {
    id: "academy",
    title_ru: "Академия ИИ",
    title_en: "Academy",
    description_ru: "Интерактивная база знаний и обучающие материалы.",
    description_en: "Interactive knowledge base and learning materials.",
    moduleKeys: ["academy"],
  },
];

export function bundleModuleKeys(bundleId: string): string[] {
  const all = [...SPECIALIST_PRODUCT_BUNDLES, ...MANAGER_PRODUCT_BUNDLES];
  return all.find((b) => b.id === bundleId)?.moduleKeys ?? [bundleId];
}

export function isBundleEnabled(
  bundleId: string,
  modules: Record<string, boolean>,
): boolean {
  const keys = bundleModuleKeys(bundleId);
  if (keys.length === 0) return false;
  return keys.every((k) => {
    if (modules[k] !== undefined) return modules[k];
    const bundle = SPECIALIST_PRODUCT_BUNDLES.find((b) => b.id === bundleId);
    return bundle?.defaultChecked ?? true;
  });
}

export function setBundleEnabled(
  bundleId: string,
  enabled: boolean,
  modules: Record<string, boolean>,
): Record<string, boolean> {
  const next = { ...modules };
  for (const key of bundleModuleKeys(bundleId)) {
    next[key] = enabled;
  }
  return next;
}
