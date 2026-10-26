/** Target audience for group work, IPR and organization programs (local JSON). */

export type AudienceGroupId = "students" | "parents" | "educators";

export type StudentAgeBand =
  | "6_10"
  | "11_14"
  | "15_18"
  | "mixed"
  | "adults"
  | "teens"
  | "children"
  | "junior_middle"
  | "senior_lead"
  | "management";

export type AudienceContext = "education" | "commercial" | "corporate";

/**
 * Категории целевых групп:
 * 1. universal - Все учащиеся / Все сотрудники / Все клиенты
 * 2. selective - Дети в ТЖС / Команды повышенной нагрузки / Клиенты в кризисе
 * 3. indicated - Первые признаки трудностей / Выгорание и стресс / Симптомы тревоги
 * 4. secondary - Профучёт (ВШУ) / Тимлиды и руководители / Длительная терапия
 * 5. tertiary - Восстановление после кризиса / Реинтеграция / Постреабилитация
 * 6. sen - ОВЗ / Особые образовательные потребности (в образовании)
 * 7. gifted - Одарённые / Высокомотивированные (в образовании)
 * 8. custom - Свой вариант (вписать вручную)
 */
export const TARGET_CATEGORY_VALUES = [
  "universal",
  "selective",
  "indicated",
  "secondary",
  "tertiary",
  "sen",
  "gifted",
  "custom",
] as const;

export type TargetCategory = (typeof TARGET_CATEGORY_VALUES)[number];

export const CORPORATE_TARGET_CATEGORY_VALUES: TargetCategory[] = [
  "universal",
  "selective",
  "indicated",
  "secondary",
  "tertiary",
  "custom",
];

export const COMMERCIAL_TARGET_CATEGORY_VALUES: TargetCategory[] = [
  "universal",
  "selective",
  "indicated",
  "secondary",
  "tertiary",
  "custom",
];

export const EDUCATION_TARGET_CATEGORY_VALUES: TargetCategory[] = [
  "universal",
  "selective",
  "indicated",
  "secondary",
  "tertiary",
  "sen",
  "gifted",
  "custom",
];

export const LEGACY_CATEGORY_MAP: Record<string, TargetCategory> = {
  normotypic: "universal",
  risk: "selective",
  deviant: "secondary",
};

/* --- Метки категорий для школьного/образовательного контекста --- */
export const TARGET_CATEGORY_LABELS_RU: Record<TargetCategory, string> = {
  universal: "Все учащиеся (общая группа / весь класс)",
  selective: "Дети в трудной жизненной ситуации и группы риска (высокий стресс, кризис в семье)",
  indicated: "Обучающиеся с первыми признаками трудностей (конфликты, пропуски, риск зависимостей)",
  secondary: "Обучающиеся на профилактическом учёте (ВШУ, КДНиЗП) или с нарушениями поведения",
  tertiary: "Обучающиеся после кризисных ситуаций (восстановление, адаптация и поддержка)",
  sen: "Обучающиеся с ОВЗ / особыми образовательными потребностями",
  gifted: "Одарённые / высокомотивированные обучающиеся",
  custom: "✍️ Свой вариант целевой группы...",
};

export const TARGET_CATEGORY_LABELS_EN: Record<TargetCategory, string> = {
  universal: "All students (whole class / general group)",
  selective: "Students in difficult life situations & risk groups (high stress, family crisis)",
  indicated: "Students with early signs of difficulties (conflicts, truancy, substance risks)",
  secondary: "Students on school/juvenile prevention records or with behavioral issues",
  tertiary: "Students post-crisis (recovery, adaptation and support)",
  sen: "Students with disabilities / special educational needs",
  gifted: "Gifted / High-achieving students",
  custom: "✍️ Custom target group...",
};

export const TARGET_CATEGORY_HINTS_RU: Record<TargetCategory, string> = {
  universal: "Работа со всем классом: развитие навыков общения, эмоциональной грамотности, сплочение и здоровая атмосфера в коллективе",
  selective: "Поддержка ребят в трудных обстоятельствах: кризис в семье, потеря близких, высокий уровень стресса, сложности адаптации",
  indicated: "Помощь при ранних тревожных сигналах: частые конфликты, прогулы уроков, первые пробы курения/вейпов или риск буллинга",
  secondary: "Работа с ребятами на внутришкольном учёте или КДНиЗП: коррекция поведения, соблюдение школьных правил, предотвращение правонарушений",
  tertiary: "Бережная адаптация: восстановление после тяжёлого эмоционального кризиса, травмы или длительного лечения",
  sen: "Инклюзивные группы: доступные задания, развитие самостоятельности и общения со сверстниками, комфортный темп",
  gifted: "Поддержка увлечённых ребят: развитие гибких навыков, командная работа, защита от перегрузок и страха ошибок",
  custom: "Укажите вашу группу, если нужного варианта нет в списке выше",
};

/* --- Метки категорий для корпоративного контекста (Corporate Health) --- */
export const CORPORATE_CATEGORY_LABELS_RU: Partial<Record<TargetCategory, string>> = {
  universal: "Все сотрудники (общая группа / отдел / кросс-функциональная команда)",
  selective: "Команды повышенной нагрузки и риска (спринты, релизы, кризисные проекты)",
  indicated: "Сотрудники с первыми признаками выгорания и стресса (перегрузка, бессонница, трения)",
  secondary: "Тимлиды, руководители и ключевые эксперты (управление выгоранием команд, медиация)",
  tertiary: "Сотрудники после острых кризисов (восстановление, возвращение после отпуска/больничного)",
  sen: "Сотрудники с особыми потребностями / ограниченными возможностями здоровья",
  gifted: "HiPo / Таланты и программа преемственности лидеров",
  custom: "✍️ Свой вариант целевой группы...",
};

export const CORPORATE_CATEGORY_LABELS_EN: Partial<Record<TargetCategory, string>> = {
  universal: "All employees (whole team / department / cross-functional group)",
  selective: "High-workload & risk teams (sprints, releases, crunch projects)",
  indicated: "Employees with early signs of burnout & stress (overload, sleep issues, friction)",
  secondary: "Team leads, engineering managers & key experts (burnout prevention, mediation)",
  tertiary: "Employees post-crisis (rehabilitation, recovery after burnout leave)",
  sen: "Employees with accessibility needs / special accommodations",
  gifted: "HiPo / High Potential leaders & talent pool",
  custom: "✍️ Custom target group...",
};

export const CORPORATE_CATEGORY_HINTS_RU: Partial<Record<TargetCategory, string>> = {
  universal: "Программы для всего коллектива: развитие стрессоустойчивости, когнитивной гигиены, психологической безопасности и командного взаимодействия",
  selective: "Поддержка команд в период пиковых перегрузок, реструктуризаций, сжатых дедлайнов и высоких рисков выгорания",
  indicated: "Ранняя помощь при признаках хронического стресса, снижения вовлеченности, конфликтов и токсичной коммуникации",
  secondary: "Прокачка навыков сохранения емкости команды, фасилитации сложных ретроспектив, управления конфликтами и делегирования",
  tertiary: "Пошаговая реинтеграция и снижение нагрузки после глубокого эмоционального истощения или кризиса",
  sen: "Адаптация рабочего места, снижение сенсорных перегрузок, комфортные условия для инклюзивного найма",
  gifted: "Поддержка ключевых талантов: баланс амбиций и восстановления, профилактика перфекционизма и самозванца",
  custom: "Укажите вашу целевую аудиторию, если нужного варианта нет в списке выше",
};

/* --- Метки категорий для психологических центров / частной практики (IDA) --- */
export const COMMERCIAL_CATEGORY_LABELS_RU: Partial<Record<TargetCategory, string>> = {
  universal: "Все клиенты / открытая группа (навыки саморегуляции, эмоциональная грамотность)",
  selective: "Клиенты в кризисных ситуациях и группе риска (тяжелый стресс, развод, утрата)",
  indicated: "Клиенты с тревожными или депрессивными проявлениями (выгорание, фобии, конфликты)",
  secondary: "Участники длительных терапевтических программ (проработка травмы, глубокая коррекция)",
  tertiary: "Восстановление и постреабилитационная поддержка (поддерживающие встречи)",
  sen: "Клиенты с ОВЗ и нейроотличиями (РАС, СДВГ)",
  gifted: "Высокочувствительные и одарённые клиенты",
  custom: "✍️ Свой вариант целевой группы...",
};

export const COMMERCIAL_CATEGORY_LABELS_EN: Partial<Record<TargetCategory, string>> = {
  universal: "All clients / open group (self-regulation skills, emotional literacy)",
  selective: "Clients in crisis & risk groups (severe stress, divorce, grief)",
  indicated: "Clients with anxiety or depressive symptoms (burnout, phobias, conflicts)",
  secondary: "Participants of long-term therapy programs (trauma processing, deep therapy)",
  tertiary: "Post-rehabilitation & recovery support (ongoing support groups)",
  sen: "Clients with disabilities and neurodivergence (ASD, ADHD)",
  gifted: "Highly sensitive & gifted individuals",
  custom: "✍️ Custom target group...",
};

export const COMMERCIAL_CATEGORY_HINTS_RU: Partial<Record<TargetCategory, string>> = {
  universal: "Тематические психологические группы, тренинги осознанности, коммуникативные воркшопы",
  selective: "Группы поддержки в трудных жизненных обстоятельствах, кризисная стабилизация",
  indicated: "Терапевтические группы целенаправленной проработки симптомов и поведенческих паттернов",
  secondary: "Глубокая терапия, проработка травматического опыта, поддержка устойчивой ремиссии",
  tertiary: "Поддерживающие встречи, интеграция нового опыта в повседневную жизнь",
  sen: "Адаптированные терапевтические форматы с учётом индивидуальных особенностей",
  gifted: "Проработка синдрома самозванца, эмоциональной регуляции и перегрузок",
  custom: "Укажите вашу целевую аудиторию, если нужного варианта нет в списке выше",
};

export interface StructuredAudienceRow {
  group: AudienceGroupId;
  enabled: boolean;
  count: number | null;
  ageBand?: StudentAgeBand;
}

export interface TargetAudienceData {
  mode: "structured" | "free_text";
  freeText: string;
  category: TargetCategory;
  customCategory?: string;
  groups: StructuredAudienceRow[];
}

export const AUDIENCE_GROUP_LABELS: Record<AudienceGroupId, string> = {
  students: "Учащиеся / воспитанники",
  parents: "Родители / законные представители",
  educators: "Педагоги / специалисты",
};

export const AUDIENCE_GROUP_LABELS_BY_CONTEXT: Record<
  AudienceContext,
  Record<AudienceGroupId, { ru: string; en: string }>
> = {
  education: {
    students: { ru: "Учащиеся / воспитанники", en: "Students / Learners" },
    parents: { ru: "Родители / законные представители", en: "Parents / Guardians" },
    educators: { ru: "Педагоги / специалисты", en: "Educators / Specialists" },
  },
  commercial: {
    students: { ru: "Клиенты / участники группы", en: "Clients / Group Participants" },
    parents: { ru: "Члены семьи / близкие / партнёры", en: "Family Members / Partners" },
    educators: { ru: "Специалисты / ко-терапевты", en: "Specialists / Co-therapists" },
  },
  corporate: {
    students: { ru: "Сотрудники / специалисты", en: "Employees / Team Members" },
    parents: { ru: "Тимлиды / руководители направлений", en: "Team Leads / Managers" },
    educators: { ru: "HR / HRBP / Коучи и фасилитаторы", en: "HR / HRBP / Facilitators" },
  },
};

export const STUDENT_AGE_BAND_LABELS: Record<StudentAgeBand, string> = {
  "6_10": "6–10 лет (младшие школьники)",
  "11_14": "11–14 лет (подростки)",
  "15_18": "15–18 лет (старшеклассники)",
  mixed: "Смешанный возраст",
  adults: "Взрослые (18+)",
  teens: "Подростки (12–17 лет)",
  children: "Дети (6–11 лет)",
  junior_middle: "Junior / Middle специалисты",
  senior_lead: "Senior / Lead эксперты",
  management: "Руководители направлений",
};

export const AGE_BAND_OPTIONS_BY_CONTEXT: Record<
  AudienceContext,
  { value: StudentAgeBand; labelRu: string; labelEn: string }[]
> = {
  education: [
    { value: "6_10", labelRu: "6–10 лет (младшие школьники)", labelEn: "6–10 years (Primary)" },
    { value: "11_14", labelRu: "11–14 лет (подростки)", labelEn: "11–14 years (Middle school)" },
    { value: "15_18", labelRu: "15–18 лет (старшеклассники)", labelEn: "15–18 years (High school)" },
    { value: "mixed", labelRu: "Смешанный возраст", labelEn: "Mixed ages" },
  ],
  commercial: [
    { value: "adults", labelRu: "Взрослые (18+)", labelEn: "Adults (18+)" },
    { value: "teens", labelRu: "Подростки (12–17 лет)", labelEn: "Teens (12–17 years)" },
    { value: "children", labelRu: "Дети (6–11 лет)", labelEn: "Children (6–11 years)" },
    { value: "mixed", labelRu: "Смешанный возраст", labelEn: "Mixed ages" },
  ],
  corporate: [
    { value: "senior_lead", labelRu: "Senior / Lead эксперты", labelEn: "Senior / Lead Experts" },
    { value: "junior_middle", labelRu: "Junior / Middle специалисты", labelEn: "Junior / Middle Specialists" },
    { value: "management", labelRu: "Руководители направлений", labelEn: "Engineering Managers / Dept Heads" },
    { value: "mixed", labelRu: "Все уровни (смешанный состав)", labelEn: "All levels (Mixed)" },
  ],
};

const DEFAULT_GROUPS: StructuredAudienceRow[] = [
  { group: "students", enabled: true, count: null, ageBand: "11_14" },
  { group: "parents", enabled: false, count: null },
  { group: "educators", enabled: false, count: null },
];

export function resolveAudienceContext(
  cfgOrType?: { org_type?: string; org_sphere?: string } | string | boolean | null,
  isCommercialParam?: boolean,
): AudienceContext {
  if (typeof cfgOrType === "boolean") {
    if (cfgOrType) return "corporate";
    if (isCommercialParam) return "commercial";
    return "education";
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("corporate-health") || host.includes("corporate")) {
      return "corporate";
    }
    if (host.includes("ida-psy") || host.includes("ida.chat") || host.includes("ida-ai")) {
      return "commercial";
    }
    if (host.includes("prevention.school") || host.includes("teenology")) {
      return "education";
    }
  }
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.VITE_TERMINAL_PRODUCT === "string"
  ) {
    const p = import.meta.env.VITE_TERMINAL_PRODUCT.toLowerCase();
    if (p === "corporate") return "corporate";
    if (p === "ida") return "commercial";
    if (p === "school") return "education";
  }
  if (typeof cfgOrType === "string") {
    if (cfgOrType === "corporate") return "corporate";
    if (cfgOrType === "commercial" || cfgOrType === "ida") return "commercial";
    return "education";
  }
  if (cfgOrType?.org_sphere === "corporate") {
    return "corporate";
  }
  if (cfgOrType?.org_type === "commercial") {
    return "commercial";
  }
  return "education";
}

export function getTargetCategoriesForContext(context: AudienceContext): readonly TargetCategory[] {
  if (context === "corporate") return CORPORATE_TARGET_CATEGORY_VALUES;
  if (context === "commercial") return COMMERCIAL_TARGET_CATEGORY_VALUES;
  return EDUCATION_TARGET_CATEGORY_VALUES;
}

export function getTargetCategoryLabel(
  category: TargetCategory,
  context: AudienceContext = "education",
  lang: "ru" | "en" = "ru",
): string {
  if (context === "corporate") {
    const dict = lang === "en" ? CORPORATE_CATEGORY_LABELS_EN : CORPORATE_CATEGORY_LABELS_RU;
    if (dict[category]) return dict[category]!;
  } else if (context === "commercial") {
    const dict = lang === "en" ? COMMERCIAL_CATEGORY_LABELS_EN : COMMERCIAL_CATEGORY_LABELS_RU;
    if (dict[category]) return dict[category]!;
  }
  const fallbackDict = lang === "en" ? TARGET_CATEGORY_LABELS_EN : TARGET_CATEGORY_LABELS_RU;
  return fallbackDict[category] || fallbackDict.universal;
}

export function getTargetCategoryHint(
  category: TargetCategory,
  context: AudienceContext = "education",
): string {
  if (context === "corporate") {
    if (CORPORATE_CATEGORY_HINTS_RU[category]) return CORPORATE_CATEGORY_HINTS_RU[category]!;
  } else if (context === "commercial") {
    if (COMMERCIAL_CATEGORY_HINTS_RU[category]) return COMMERCIAL_CATEGORY_HINTS_RU[category]!;
  }
  return TARGET_CATEGORY_HINTS_RU[category] || "";
}

export function getAudienceGroupLabel(
  group: AudienceGroupId,
  context: AudienceContext = "education",
  lang: "ru" | "en" = "ru",
): string {
  const cDict = AUDIENCE_GROUP_LABELS_BY_CONTEXT[context] || AUDIENCE_GROUP_LABELS_BY_CONTEXT.education;
  return cDict[group]?.[lang] || AUDIENCE_GROUP_LABELS[group] || group;
}

export function getAgeBandLabel(
  band: StudentAgeBand | string | undefined,
  context: AudienceContext = "education",
  lang: "ru" | "en" = "ru",
): string {
  if (!band) return "";
  const opts = AGE_BAND_OPTIONS_BY_CONTEXT[context] || AGE_BAND_OPTIONS_BY_CONTEXT.education;
  const match = opts.find((o) => o.value === band);
  if (match) return lang === "en" ? match.labelEn : match.labelRu;
  return STUDENT_AGE_BAND_LABELS[band as StudentAgeBand] || band;
}

export function defaultAgeBandForContext(context: AudienceContext): StudentAgeBand {
  if (context === "corporate") return "senior_lead";
  if (context === "commercial") return "adults";
  return "11_14";
}

export function emptyTargetAudience(context: AudienceContext = "education"): TargetAudienceData {
  const defaultBand = defaultAgeBandForContext(context);
  return {
    mode: "structured",
    freeText: "",
    category: "universal",
    customCategory: "",
    groups: [
      { group: "students", enabled: true, count: null, ageBand: defaultBand },
      { group: "parents", enabled: false, count: null },
      { group: "educators", enabled: false, count: null },
    ],
  };
}

export function parseTargetAudienceJson(raw: string | undefined | null): TargetAudienceData {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return emptyTargetAudience();
  try {
    const parsed = JSON.parse(trimmed) as Partial<TargetAudienceData>;
    const mode = parsed.mode === "free_text" ? "free_text" : "structured";
    const freeText = String(parsed.freeText || "");
    const rawCat = String(parsed.category || "");
    let category: TargetCategory = "universal";
    if (TARGET_CATEGORY_VALUES.includes(rawCat as TargetCategory)) {
      category = rawCat as TargetCategory;
    } else if (rawCat in LEGACY_CATEGORY_MAP) {
      category = LEGACY_CATEGORY_MAP[rawCat];
    }
    const customCategory = typeof parsed.customCategory === "string" ? parsed.customCategory.trim() : "";

    const byId = new Map<AudienceGroupId, StructuredAudienceRow>();
    for (const row of DEFAULT_GROUPS) {
      byId.set(row.group, { ...row });
    }
    if (Array.isArray(parsed.groups)) {
      for (const item of parsed.groups) {
        const group = item?.group;
        if (group !== "students" && group !== "parents" && group !== "educators") continue;
        const countRaw = item?.count;
        const count =
          countRaw === null || countRaw === undefined || (countRaw as any) === ""
            ? null
            : Number(countRaw);
        byId.set(group, {
          group,
          enabled: Boolean(item?.enabled),
          count: Number.isFinite(count) && count !== null && count >= 0 ? Math.floor(count) : null,
          ageBand: group === "students" && item?.ageBand ? (item.ageBand as StudentAgeBand) : undefined,
        });
      }
    }
    return {
      mode,
      freeText,
      category,
      customCategory,
      groups: DEFAULT_GROUPS.map((row) => byId.get(row.group) || { ...row }),
    };
  } catch {
    return emptyTargetAudience();
  }
}

export function serializeTargetAudience(data: TargetAudienceData): string {
  const isCustom = data.category === "custom";
  const customText = (data.customCategory || "").trim();
  return JSON.stringify({
    mode: data.mode,
    freeText: data.freeText.trim(),
    category: data.category || "universal",
    ...(isCustom && customText ? { customCategory: customText } : {}),
    groups: data.groups.map((row) => ({
      group: row.group,
      enabled: row.enabled,
      count: row.count,
      ...(row.group === "students" ? { ageBand: row.ageBand || "11_14" } : {}),
    })),
  });
}

export function formatTargetAudienceSummary(
  data: TargetAudienceData,
  context: AudienceContext = "education",
): string {
  if (data.mode === "free_text") return data.freeText.trim();
  const isCustom = data.category === "custom";
  const customText = (data.customCategory || "").trim();
  const categoryLabel = isCustom
    ? (customText ? `Свой вариант: ${customText}` : "Свой вариант")
    : getTargetCategoryLabel(data.category, context, "ru");
  const parts: string[] = [`Целевая группа: ${categoryLabel}`];
  for (const row of data.groups) {
    if (!row.enabled) continue;
    let line = getAudienceGroupLabel(row.group, context, "ru");
    if (row.group === "students" && row.ageBand) {
      const bandLabel = getAgeBandLabel(row.ageBand, context, "ru");
      if (bandLabel) {
        line += ` (${bandLabel})`;
      }
    }
    if (row.count != null && row.count > 0) {
      line += ` — охват ${row.count} чел.`;
    }
    parts.push(line);
  }
  return parts.join("; ");
}

export function formatTargetAudienceForAi(
  data: TargetAudienceData,
  context: AudienceContext = "education",
): string {
  if (data.mode === "free_text") {
    const text = data.freeText.trim();
    return text ? `Целевая группа (свободный ввод): ${text}` : "";
  }
  const isCustom = data.category === "custom";
  const customText = (data.customCategory || "").trim();
  const categoryLabel = isCustom
    ? (customText ? `Свой вариант: ${customText}` : "Свой вариант целевой группы")
    : getTargetCategoryLabel(data.category, context, "ru");
  const categoryHint = isCustom ? "" : getTargetCategoryHint(data.category, context);
  const lines = [
    `Целевая группа: ${categoryLabel}${categoryHint ? ` (${categoryHint})` : ""}`,
  ];
  const activeGroups = data.groups.filter((r) => r.enabled);
  if (activeGroups.length > 0) {
    lines.push("Состав участников и охват:");
    for (const row of activeGroups) {
      let line = `- ${getAudienceGroupLabel(row.group, context, "ru")}`;
      if (row.group === "students" && row.ageBand) {
        const bandLabel = getAgeBandLabel(row.ageBand, context, "ru");
        if (bandLabel) {
          line += `, ${context === "corporate" ? "уровень/роль" : "возраст"}: ${bandLabel}`;
        }
      }
      if (row.count != null && row.count > 0) {
        line += `, охват: ${row.count} чел.`;
      }
      lines.push(line);
    }
  }
  return lines.join("\n");
}
