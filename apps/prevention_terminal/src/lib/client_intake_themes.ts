/**
 * Клиентский каталог запросов для коммерческого intake (IDA Kit).
 * В UI — человеческие формулировки; в данных — канонические problem_key.
 *
 * Внешние справочники центров использовались только для gap-check («не упустили ли тему»),
 * не как ориентир для копирования. Канон — problem_key в taxonomy_engine.
 *
 * Не расширяем PROBLEM_KEYS: протоколы, match и аналитика остаются на 27 кодах TCM+IDA.
 */

import { problemKeyAllowedMap, problemKeyLabel } from "./taxonomy_picker.ts";

export interface ClientIntakeTheme {
  id: string;
  label: string;
  label_en?: string;
  group: string;
  /** Один или несколько problem_key; при выборе темы все ключи попадают в catalog. */
  problemKeys: string[];
  /** Дополнительные слова для поиска. */
  aliases?: string[];
}

/** Группы клиентских тем (карточка и приём, IDA Kit). */

export function clientIntakeThemeLabel(theme: ClientIntakeTheme): string {
  const isIntl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edition') === 'intl';
  return isIntl && theme.label_en ? theme.label_en : theme.label;
}

export function clientIntakeGroupLabel(group: {id: string; label: string; label_en?: string}): string {
  const isIntl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edition') === 'intl';
  return isIntl && group.label_en ? group.label_en : group.label;
}

export const CLIENT_INTAKE_THEME_GROUPS: { id: string; label: string; label_en?: string }[] = [
  { id: "family_parenting", label: "Семья и родительство", label_en: "Family & Parenting" },
  { id: "relationships", label: "Отношения и близость", label_en: "Relationships & Intimacy" },
  { id: "emotions", label: "Эмоции, тревога, настроение", label_en: "Emotions, Anxiety & Mood" },
  { id: "behavior_risk", label: "Поведение, зависимости, риски", label_en: "Behavior, Addictions & Risks" },
  { id: "self_identity", label: "Самопознание и личность", label_en: "Self-Discovery & Identity" },
  { id: "social", label: "Социальная жизнь", label_en: "Social Life" },
  { id: "education_career", label: "Учёба, карьера, цели", label_en: "Education, Career & Goals" },
  { id: "body_health", label: "Тело, сон, здоровье", label_en: "Body, Sleep & Health" },
  { id: "crisis_loss", label: "Кризисы и потери", label_en: "Crises & Loss" },
  { id: "work_burnout", label: "Работа и выгорание", label_en: "Work & Burnout" },
  { id: "sexuality", label: "Сексуальность", label_en: "Sexuality" },
  { id: "other", label: "Другое (свой вариант)", label_en: "Other (custom)" },
];

/**
 * Клиентские темы intake → problem_key.
 * Формулировки: продуктовая редакция + сверка на пробелы с практикой центров (июль 2026).
 */
export const CLIENT_INTAKE_THEMES: ClientIntakeTheme[] = [
  {
    id: "teen_parenting",
    label: "Помощь подростку, проблемы в воспитании",
    label_en: "Adolescent support, parenting challenges",
    group: "family_parenting",
    problemKeys: ["REL_FAM", "DEV_WILL"],
    aliases: ["подросток", "воспитание", "родитель"],
  },
  {
    id: "child_problems",
    label: "Проблемы с детьми (ребёнком)",
    label_en: "Child-related problems",
    group: "family_parenting",
    problemKeys: ["REL_FAM", "DEV_EMO"],
    aliases: ["ребёнок", "дети"],
  },
  {
    id: "family_issues",
    label: "Семейные проблемы",
    label_en: "Family problems",
    group: "family_parenting",
    problemKeys: ["REL_FAM"],
  },
  {
    id: "divorce",
    label: "Развод",
    label_en: "Divorce",
    group: "family_parenting",
    problemKeys: ["REL_FAM"],
    aliases: ["расставание родителей"],
  },
  {
    id: "adult_children_parents",
    label: "Отношения родителей с уже взрослыми детьми",
    label_en: "Relationships between parents and adult children",
    group: "family_parenting",
    problemKeys: ["REL_FAM"],
    aliases: ["взрослые дети", "родители"],
  },
  {
    id: "family_patterns",
    label: "Повторяющиеся семейные паттерны, родовые сценарии",
    label_en: "Recurring family patterns, generational scripts",
    group: "family_parenting",
    problemKeys: ["REL_FAM", "DEV_SELF"],
    aliases: ["родовые", "паттерн"],
  },
  {
    id: "conflicts",
    label: "Конфликты (в семье и на работе)",
    label_en: "Conflicts (family and workplace)",
    group: "family_parenting",
    problemKeys: ["REL_FAM", "ORG_CLIM"],
    aliases: ["ссора", "конфликт"],
  },
  {
    id: "codependency",
    label: "Созависимость, зависимость в отношениях",
    label_en: "Codependency, relationship addiction",
    group: "relationships",
    problemKeys: ["REL_DEP"],
    aliases: ["созависимость"],
  },
  {
    id: "emotional_dependency",
    label: "Эмоциональная зависимость от другого человека",
    label_en: "Emotional dependency on another person",
    group: "relationships",
    problemKeys: ["REL_DEP"],
    aliases: ["расставание", "привязанность"],
  },
  {
    id: "infidelity",
    label: "Измена",
    label_en: "Infidelity",
    group: "relationships",
    problemKeys: ["REL_DEP", "REL_FAM"],
  },
  {
    id: "jealousy",
    label: "Патологическая ревность",
    label_en: "Pathological jealousy",
    group: "relationships",
    problemKeys: ["REL_DEP", "REL_LOVE"],
  },
  {
    id: "dating_difficulties",
    label: "Трудности в построении отношений с противоположным полом",
    label_en: "Difficulties building romantic relationships",
    group: "relationships",
    problemKeys: ["REL_LOVE", "DEV_COMM"],
    aliases: ["знакомства", "партнёр"],
  },
  {
    id: "loneliness",
    label: "Одиночество",
    label_en: "Loneliness",
    group: "social",
    problemKeys: ["REL_PEER", "DEV_COMM"],
  },
  {
    id: "social_adaptation",
    label: "Социальная адаптация, социофобия",
    label_en: "Social adaptation, social phobia",
    group: "social",
    problemKeys: ["DEV_COMM", "REL_PEER"],
    aliases: ["социофобия", "страх людей"],
  },
  {
    id: "surroundings",
    label: "Отношения с окружающими",
    label_en: "Relationships with others",
    group: "social",
    problemKeys: ["DEV_COMM", "REL_PEER"],
  },
  {
    id: "low_self_esteem",
    label: "Низкая самооценка",
    label_en: "Low self-esteem",
    group: "self_identity",
    problemKeys: ["DEV_SELF"],
    aliases: ["самооценка", "неуверенность"],
  },
  {
    id: "know_yourself",
    label: "Проблемы с пониманием своих желаний (узнать себя)",
    label_en: "Difficulty understanding one's own desires (self-discovery)",
    group: "self_identity",
    problemKeys: ["DEV_SELF"],
    aliases: ["идентичность", "кто я"],
  },
  {
    id: "assertiveness",
    label: "Проблемы с проявлением желаний и отстаиванием мнения",
    label_en: "Difficulty expressing desires and defending opinions",
    group: "self_identity",
    problemKeys: ["DEV_WILL", "DEV_COMM"],
    aliases: ["границы", "ассертивность"],
  },
  {
    id: "midlife_crisis",
    label: "Кризис среднего возраста",
    label_en: "Midlife crisis",
    group: "self_identity",
    problemKeys: ["DEV_SELF", "DEV_EMO"],
  },
  {
    id: "emotional_poverty",
    label: "Бедность эмоциональной жизни",
    label_en: "Emotional numbness",
    group: "emotions",
    problemKeys: ["DEV_EMO"],
  },
  {
    id: "depression_apathy",
    label: "Депрессивное состояние, апатия, отсутствие смысла жизни",
    label_en: "Depression, apathy, loss of meaning",
    group: "emotions",
    problemKeys: ["DEV_EMO"],
    aliases: ["депрессия", "апатия", "смысл"],
  },
  {
    id: "anxiety_panic",
    label: "Панические атаки, повышенный уровень тревоги",
    label_en: "Panic attacks, elevated anxiety",
    group: "emotions",
    problemKeys: ["DEV_EMO"],
    aliases: ["тревога", "паника", "ПА"],
  },
  {
    id: "fears_phobias",
    label: "Страхи и фобии",
    label_en: "Fears and phobias",
    group: "emotions",
    problemKeys: ["DEV_EMO"],
    aliases: ["фобия", "страх"],
  },
  {
    id: "stress",
    label: "Стресс",
    label_en: "Stress",
    group: "emotions",
    problemKeys: ["DEV_EMO"],
  },
  {
    id: "neurosis",
    label: "Неврозы и эмоциональные расстройства",
    label_en: "Neuroses and emotional disorders",
    group: "emotions",
    problemKeys: ["DEV_EMO"],
    aliases: ["невроз"],
  },
  {
    id: "obsessive",
    label: "Навязчивое поведение, мысли",
    label_en: "Obsessive behavior and thoughts",
    group: "emotions",
    problemKeys: ["DEV_EMO", "DEV_WILL"],
    aliases: ["ОКР", "навязчивость"],
  },
  {
    id: "sleep",
    label: "Нарушения сна, бессонница, кошмары",
    label_en: "Sleep disorders, insomnia, nightmares",
    group: "body_health",
    problemKeys: ["DEV_EMO", "DEV_TIME"],
    aliases: ["бессонница", "сон"],
  },
  {
    id: "psychosomatic",
    label: "Психосоматика, вопросы здоровья",
    label_en: "Psychosomatic issues, health concerns",
    group: "body_health",
    problemKeys: ["DEV_EMO"],
    aliases: ["соматика", "здоровье"],
  },
  {
    id: "eating",
    label: "Нарушение пищевого поведения",
    label_en: "Eating disorders",
    group: "body_health",
    problemKeys: ["DEV_EMO", "DEV_WILL"],
    aliases: ["РПП", "переедание", "анорексия", "булимия"],
  },
  {
    id: "aggression",
    label: "Агрессивность, приступы гнева",
    label_en: "Aggression, anger outbursts",
    group: "behavior_risk",
    problemKeys: ["PREV_AGGR"],
    aliases: ["гнев", "агрессия"],
  },
  {
    id: "addictions",
    label: "Зависимости (алкоголь, наркотики, табак, компьютер)",
    label_en: "Addictions (alcohol, drugs, tobacco, gaming)",
    group: "behavior_risk",
    problemKeys: ["PREV_DEL"],
    aliases: ["алкоголь", "наркотики", "игромания"],
  },
  {
    id: "suicide",
    label: "Суицидальное поведение",
    label_en: "Suicidal behavior",
    group: "crisis_loss",
    problemKeys: ["PREV_VICT"],
    aliases: ["суицид", "самоповреждение"],
  },
  {
    id: "violence_trauma",
    label: "Травма насилия (физического, психического или сексуального)",
    label_en: "Trauma from violence (physical, psychological, or sexual)",
    group: "crisis_loss",
    problemKeys: ["PREV_VICT", "SEX_SAFETY"],
    aliases: ["насилие", "травма"],
  },
  {
    id: "bereavement",
    label: "Потеря, смерть близкого человека",
    label_en: "Loss, death of a loved one",
    group: "crisis_loss",
    problemKeys: ["PREV_VICT", "DEV_EMO"],
    aliases: ["горе", "утрата"],
  },
  {
    id: "life_crises",
    label: "Помощь в проживании кризисов",
    label_en: "Support through life crises",
    group: "crisis_loss",
    problemKeys: ["DEV_EMO", "PREV_VICT"],
  },
  {
    id: "psych_disorder_suspicion",
    label: "Подозрение на психическое расстройство",
    label_en: "Suspected mental disorder",
    group: "crisis_loss",
    problemKeys: ["DEV_EMO"],
    aliases: ["психиатр", "диагноз"],
  },
  {
    id: "burnout",
    label: "Выгорание (эмоциональное, профессиональное)",
    label_en: "Burnout (emotional, professional)",
    group: "work_burnout",
    problemKeys: ["ORG_BURN"],
    aliases: ["выгорание"],
  },
  {
    id: "business_difficulties",
    label: "Сложности в бизнесе",
    label_en: "Business difficulties",
    group: "work_burnout",
    problemKeys: ["ORG_CLIM", "EDU_CAREER"],
    aliases: ["бизнес", "предприниматель"],
  },
  {
    id: "money_problems",
    label: "Проблемы с деньгами",
    label_en: "Financial problems",
    group: "work_burnout",
    problemKeys: ["ORG_LAW"],
    aliases: ["финансы", "долги"],
  },
  {
    id: "career_orientation",
    label: "Сложности в выборе профессии и карьеры. Профориентация",
    label_en: "Career choice and orientation",
    group: "education_career",
    problemKeys: ["EDU_CAREER", "EDU_PATH"],
    aliases: ["профориентация", "карьера"],
  },
  {
    id: "decision_goals",
    label: "Сложности с выбором, принятием решения. Постановка цели",
    label_en: "Decision-making difficulties, goal setting",
    group: "education_career",
    problemKeys: ["DEV_WILL", "EDU_CAREER"],
    aliases: ["решение", "цель"],
  },
  {
    id: "goal_support",
    label: "Психологическая поддержка на пути к поставленной цели",
    label_en: "Psychological support toward achieving goals",
    group: "education_career",
    problemKeys: ["EDU_CAREER", "DEV_WILL"],
  },
  {
    id: "learning",
    label: "Учёба, мотивация, школа (подросток / молодой взрослый)",
    label_en: "Studies, motivation, school (adolescent / young adult)",
    group: "education_career",
    problemKeys: ["EDU_LRN", "EDU_SELF"],
    aliases: ["школа", "экзамены"],
  },
  {
    id: "sexuality",
    label: "Секс, сексуальность",
    label_en: "Sex, sexuality",
    group: "sexuality",
    problemKeys: ["SEX_RELATIONS", "SEX_CONSENT"],
    aliases: ["сексуальность"],
  },
  {
    id: "fertility",
    label: "Психологическое бесплодие, подготовка к беременности и родам",
    label_en: "Psychological infertility, pregnancy and birth preparation",
    group: "sexuality",
    problemKeys: ["SEX_RELATIONS", "DEV_EMO"],
    aliases: ["беременность", "бесплодие"],
  },
  {
    id: "serious_illness",
    label: "Сопровождение тяжелобольного, помощь родственникам",
    label_en: "Supporting seriously ill patients, helping relatives",
    group: "crisis_loss",
    problemKeys: ["PREV_VICT", "REL_FAM"],
    aliases: ["онкология", "болезнь"],
  },
  {
    id: "dreams",
    label: "Сновидения, анализ сновидений",
    label_en: "Dreams, dream analysis",
    group: "self_identity",
    problemKeys: ["DEV_SELF"],
    aliases: ["сны"],
  },
  {
    id: "bullying",
    label: "Травля, буллинг (школа, среда)",
    label_en: "Bullying (school, social environment)",
    group: "behavior_risk",
    problemKeys: ["PREV_BULL"],
  },
  {
    id: "cyber_risks",
    label: "Онлайн-риски, соцсети, кибербуллинг",
    label_en: "Online risks, social media, cyberbullying",
    group: "behavior_risk",
    problemKeys: ["PREV_CYBER"],
  },
];

const THEME_BY_ID = new Map(CLIENT_INTAKE_THEMES.map((row) => [row.id, row]));

export interface IntakeThemeSelection {
  intake_theme_ids: string[];
  catalog: string[];
  custom: string[];
}

export function emptyIntakeThemeSelection(): IntakeThemeSelection {
  return { intake_theme_ids: [], catalog: [], custom: [] };
}

export function catalogFromIntakeThemeIds(themeIds: string[], commercial: boolean): string[] {
  const allowed = problemKeyAllowedMap(commercial);
  const keys = new Set<string>();
  for (const id of themeIds) {
    const theme = THEME_BY_ID.get(id);
    if (!theme) continue;
    for (const key of theme.problemKeys) {
      if (allowed.has(key)) keys.add(key);
    }
  }
  return [...keys];
}

export function intakeThemeSelectionFromDraft(
  raw: { catalog?: string[]; custom?: string[]; intake_theme_ids?: string[] } | undefined,
  commercial: boolean,
): IntakeThemeSelection {
  const custom = Array.isArray(raw?.custom)
    ? raw!.custom!.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const explicitIds = Array.isArray(raw?.intake_theme_ids)
    ? raw!.intake_theme_ids!.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const catalogRaw = Array.isArray(raw?.catalog)
    ? raw!.catalog!.map((s) => String(s || "").trim()).filter((k) =>
        problemKeyAllowedMap(commercial).has(k),
      )
    : [];

  if (explicitIds.length > 0) {
    const intake_theme_ids = [...new Set(explicitIds)];
    return {
      intake_theme_ids,
      catalog: catalogFromIntakeThemeIds(intake_theme_ids, commercial),
      custom: [...new Set(custom)],
    };
  }

  const inferred = inferIntakeThemeIdsFromCatalog(catalogRaw);
  return {
    intake_theme_ids: inferred,
    catalog: [...new Set(catalogRaw)],
    custom: [...new Set(custom)],
  };
}

export function toSessionProblemThemes(sel: IntakeThemeSelection): {
  catalog: string[];
  custom: string[];
  intake_theme_ids?: string[];
} {
  return {
    catalog: sel.catalog,
    custom: sel.custom,
    intake_theme_ids: sel.intake_theme_ids.length ? sel.intake_theme_ids : undefined,
  };
}

export function toggleIntakeTheme(
  sel: IntakeThemeSelection,
  themeId: string,
  commercial: boolean,
): IntakeThemeSelection {
  const theme = THEME_BY_ID.get(themeId);
  if (!theme) return sel;
  const ids = new Set(sel.intake_theme_ids);
  if (ids.has(themeId)) ids.delete(themeId);
  else ids.add(themeId);
  const intake_theme_ids = [...ids];
  return {
    intake_theme_ids,
    catalog: catalogFromIntakeThemeIds(intake_theme_ids, commercial),
    custom: sel.custom,
  };
}

export function clientIntakeThemeGroups(): { id: string; label: string; label_en?: string; themes: ClientIntakeTheme[] }[] {
  return CLIENT_INTAKE_THEME_GROUPS.map((grp) => ({
    ...grp,
    themes: CLIENT_INTAKE_THEMES.filter((t) => t.group === grp.id),
  })).filter((grp) => grp.themes.length > 0);
}

export function formatIntakeThemesSummary(sel: IntakeThemeSelection): string {
  const isIntl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edition') === 'intl';
  const labels = sel.intake_theme_ids
    .map((id) => {
      const theme = THEME_BY_ID.get(id);
      return theme ? clientIntakeThemeLabel(theme) : id;
    })
    .filter(Boolean);
  const parts = [...labels, ...sel.custom];
  if (!parts.length && !sel.catalog.length) return "";
  if (!parts.length) {
    return sel.catalog.map((k) => problemKeyLabel(k)).join(", ");
  }
  const codesStr = isIntl ? "codes:" : "коды:";
  const codes = sel.catalog.length
    ? ` · ${codesStr} ${[...new Set(sel.catalog.map((k) => problemKeyLabel(k)))].join(", ")}`
    : "";
  return `${parts.join("; ")}${codes}`;
}

export function themeMatchesFilter(theme: ClientIntakeTheme, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  if (theme.label.toLowerCase().includes(n)) return true;
  if (theme.id.toLowerCase().includes(n)) return true;
  for (const key of theme.problemKeys) {
    if (key.toLowerCase().includes(n)) return true;
    if (problemKeyLabel(key).toLowerCase().includes(n)) return true;
  }
  for (const alias of theme.aliases || []) {
    if (alias.toLowerCase().includes(n)) return true;
  }
  return false;
}

/**
 * Map AI / legacy problem_key catalog → client theme checkboxes.
 * Prefers a single-key theme per code so галочки light up without flooding the list.
 */
export function inferIntakeThemeIdsFromCatalog(catalog: string[]): string[] {
  const needed = [...new Set(catalog.map((k) => String(k || "").trim()).filter(Boolean))];
  if (!needed.length) return [];
  const neededSet = new Set(needed);
  const covered = new Set<string>();
  const picked: string[] = [];

  for (const key of needed) {
    if (covered.has(key)) continue;
    const exact = CLIENT_INTAKE_THEMES.find(
      (t) => t.problemKeys.length === 1 && t.problemKeys[0] === key,
    );
    if (exact) {
      picked.push(exact.id);
      covered.add(key);
      continue;
    }
    const multi = CLIENT_INTAKE_THEMES.find(
      (t) =>
        t.problemKeys.includes(key) &&
        t.problemKeys.every((k) => neededSet.has(k)),
    );
    if (multi) {
      picked.push(multi.id);
      for (const k of multi.problemKeys) {
        if (neededSet.has(k)) covered.add(k);
      }
    }
  }
  return [...new Set(picked)];
}
