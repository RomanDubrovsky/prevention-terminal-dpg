/** Product-level checkboxes shown in specialist onboarding (maps to technical modules). */

export interface SpecialistProductBundle {
  id: string;
  title_ru: string;
  description_ru: string;
  moduleKeys: string[];
  /** Shown only for education / preventive_public org types. */
  schoolLikeOnly?: boolean;
}

export const SPECIALIST_PRODUCT_BUNDLES: SpecialistProductBundle[] = [
  {
    id: "cases",
    title_ru: "Cases (Кейсы)",
    description_ru: "Реестр кейсов (заявки, карточки клиентов и общая база).",
    moduleKeys: ["reception_journal"],
  },
  {
    id: "consultations",
    title_ru: "Consultations (Консультации)",
    description_ru: "Журнал ведения индивидуальных консультаций и сессий.",
    moduleKeys: ["consultation_journal"],
  },
  {
    id: "ipr",
    title_ru: "IPR (ИПР)",
    description_ru: "Индивидуальная программа реабилитации (личное дело ребёнка).",
    moduleKeys: ["ipr"],
    schoolLikeOnly: true,
  },
  {
    id: "group_work",
    title_ru: "Group Work (Групповая работа)",
    description_ru: "Журнал и конструктор групповых профилактических занятий.",
    moduleKeys: ["group_sessions"],
  },
  {
    id: "safe_environment",
    title_ru: "Safe Environment (Безопасная среда)",
    description_ru: "Программа мониторинга безопасной среды образовательной организации.",
    moduleKeys: ["safe_environment"],
    schoolLikeOnly: true,
  },
  {
    id: "academy",
    title_ru: "Academy (Академия)",
    description_ru: "Интерактивная Академия ИИ с лекциями и тестированием.",
    moduleKeys: ["academy"],
  },
];

export function bundleModuleKeys(bundleId: string): string[] {
  return SPECIALIST_PRODUCT_BUNDLES.find((b) => b.id === bundleId)?.moduleKeys ?? [];
}

export function isBundleEnabled(
  bundleId: string,
  modules: Record<string, boolean>,
): boolean {
  const keys = bundleModuleKeys(bundleId);
  if (keys.length === 0) return false;
  return keys.every((k) => modules[k]);
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
