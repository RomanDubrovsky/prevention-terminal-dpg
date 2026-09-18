/** Five-level prevention scale (Gordon, 1983) — parity with core/taxonomy.py */

export const PREVENTION_LINK_VALUES = [
  "L1_universal",
  "L2_selective",
  "L3_indicated",
  "L4_secondary",
  "L5_tertiary",
] as const;

export type PreventionLink = (typeof PREVENTION_LINK_VALUES)[number];

export type PreventionTier = "primary" | "secondary" | "tertiary";

export const PREVENTION_TIER_LABELS_RU: Record<PreventionTier, string> = {
  primary: "Primary Prevention",
  secondary: "Secondary Prevention",
  tertiary: "Tertiary Prevention",
};

export const PREVENTION_LINK_LABELS_RU: Record<PreventionLink, string> = {
  L1_universal: "Universal Prevention",
  L2_selective: "Selective Prevention",
  L3_indicated: "Indicated Prevention",
  L4_secondary: "Secondary Prevention",
  L5_tertiary: "Tertiary Prevention",
};

/** Краткая подсказка под выбранным значением. */
export const PREVENTION_LINK_HINTS_RU: Record<PreventionLink, string> = {
  L1_universal: "Вся популяция или молодёжная субпопуляция, территориальный уровень",
  L2_selective: "Группы риска с общим высоким уровнем стресса, без выраженных нарушений",
  L3_indicated: "Представители групп риска со специфическими признаками поведенческих трудностей",
  L4_secondary: "Лица с диагнозом или выраженными нарушениями поведенческих, социальных или правовых норм",
  L5_tertiary: "Лица после лечения или преодоления острой фазы кризиса",
};

export interface PreventionLinkGuideEntry {
  link: PreventionLink;
  tier: PreventionTier;
  audience: string;
  workTypes: string[];
}

/** Опорный классификатор видов работ по звеньям (выжимка методического текста). */
export const PREVENTION_LINK_GUIDE: PreventionLinkGuideEntry[] = [
  {
    link: "L1_universal",
    tier: "primary",
    audience: PREVENTION_LINK_HINTS_RU.L1_universal,
    workTypes: [
      "Законодательные меры, социальные нормы и общественные инициативы",
      "Информирование через СМИ, полиграфию, массовые мероприятия (праздники, конкурсы, игры, постановки)",
      "Интеграция в школьную программу: жизненные навыки, эмоциональный интеллект, безопасность в жизни и интернете",
      "Программы психологической грамотности для учащихся, родителей и педагогов",
    ],
  },
  {
    link: "L2_selective",
    tier: "primary",
    audience: PREVENTION_LINK_HINTS_RU.L2_selective,
    workTypes: [
      "Раннее выявление представителей групп риска",
      "Групповая работа: беседы, дискуссии, тренинги, групповые консультации (стресс, развод родителей, отношения, насилие)",
      "Сетевое воздействие: «равный — равному», родительские клубы, лидеры мнений",
      "Индивидуальная работа: психологическое консультирование и психотерапия",
      "Дистанционная психологическая поддержка (телефоны доверия, боты)",
    ],
  },
  {
    link: "L3_indicated",
    tier: "primary",
    audience: PREVENTION_LINK_HINTS_RU.L3_indicated,
    workTypes: [
      "Выявление: наблюдение, тесты, диагностические интервью",
      "Программы «равный — равному» по наркомании, насилию, ЗППП, ВИЧ, суициду",
      "Психологическое сопровождение: индивидуальное, групповое, семейное",
      "Педагогическое сопровождение: ИОП, занятость, досуг",
      "Социальное сопровождение случая и кейс-менеджмент: реадаптация, медицина, трудоустройство, правовая помощь",
    ],
  },
  {
    link: "L4_secondary",
    tier: "secondary",
    audience: PREVENTION_LINK_HINTS_RU.L4_secondary,
    workTypes: [
      "Экстренная психологическая помощь; обучение персонала алгоритму действий при ЧС",
      "Медицинская, наркологическая, психиатрическая и психотерапевтическая помощь",
      "Аутрич в местах концентрации труднодоступных групп риска",
      "Социальное и юридическое сопровождение задержанных подростков (НКО и правоохранительная система)",
    ],
  },
  {
    link: "L5_tertiary",
    tier: "tertiary",
    audience: PREVENTION_LINK_HINTS_RU.L5_tertiary,
    workTypes: [
      "Физическая и психологическая реабилитация после выздоровления или острой стадии",
      "Социальная реадаптация; работа с семьёй и учебным коллективом",
      "Долгосрочная поддержка, группы самопомощи",
    ],
  },
];

export function preventionLinkGuideGrouped(): { tier: PreventionTier; label: string; entries: PreventionLinkGuideEntry[] }[] {
  const order: PreventionTier[] = ["primary", "secondary", "tertiary"];
  return order.map((tier) => ({
    tier,
    label: PREVENTION_TIER_LABELS_RU[tier],
    entries: PREVENTION_LINK_GUIDE.filter((entry) => entry.tier === tier),
  }));
}

export function isPreventionLink(value: string): value is PreventionLink {
  return (PREVENTION_LINK_VALUES as readonly string[]).includes(value);
}

export function preventionLinkLabel(value: string): string {
  if (isPreventionLink(value)) return PREVENTION_LINK_LABELS_RU[value];
  return value.trim() || "—";
}
