import React, { useState, useEffect, useMemo } from "react";
import { t } from "../lib/i18n.ts";
import { PROBLEM_KEY_LABELS_RU } from "../lib/taxonomy_picker.ts";
import { isDemoModeActive } from "../lib/staging_demo_seed.ts";

export type MaterialFormat = "protocol" | "blank" | "guide" | "checklist" | "article" | "test";
export type TargetAudience = "school_psychologist" | "private_practice" | "director" | "parents_teachers" | "all";

export interface LibraryMaterialItem {
  id: string;
  title: string;
  subtitle?: string;
  format: MaterialFormat;
  audience: TargetAudience;
  tags: string[]; // Problem keys (e.g. PREV_BULL, DEV_EMO) or custom keywords
  author: string;
  date: string;
  readTime?: string;
  downloadsCount?: number;
  description: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  externalUrl?: string;
  isCustom?: boolean;
}

const STORAGE_KEY = "terminal_methodological_library_v1";

export function getFormatLabel(format: MaterialFormat): { label: string; icon: string; color: string; bg: string } {
  switch (format) {
    case "protocol": return { label: t("Протокол", "Protocol"), icon: "📋", color: "#4f46e5", bg: "#eef2ff" };
    case "blank": return { label: t("Бланк согласия / документа", "Consent Form / Template"), icon: "📑", color: "#0891b2", bg: "#ecfeff" };
    case "guide": return { label: t("Методичка / Гайд", "Manual / Guide"), icon: "📘", color: "#16a34a", bg: "#f0fdf4" };
    case "checklist": return { label: t("Чек-лист", "Checklist"), icon: "✅", color: "#d97706", bg: "#fffbeb" };
    case "test": return { label: t("Диагностика / Тест", "Assessment / Test"), icon: "📊", color: "#9333ea", bg: "#faf5ff" };
    case "article": return { label: t("Научная публикация", "Scientific Publication"), icon: "🔬", color: "#2563eb", bg: "#eff6ff" };
  }
}

export function getAudienceLabel(audience: TargetAudience): string {
  switch (audience) {
    case "all": return t("Для всех специалистов", "All Specialists");
    case "school_psychologist": return t("Школьный педагог-психолог", "School Psychologist");
    case "private_practice": return t("Частная практика / IDA Pro", "Private Practice / IDA Pro");
    case "director": return t("Руководитель / Директор", "Director / Principal");
    case "parents_teachers": return t("Для родителей и педагогов", "Parents & Teachers");
  }
}

const FORMAT_LABELS = new Proxy({}, {
  get(_t, prop: string) {
    return getFormatLabel(prop as MaterialFormat);
  }
}) as Record<MaterialFormat, { label: string; icon: string; color: string; bg: string }>;

const AUDIENCE_LABELS = new Proxy({}, {
  get(_t, prop: string) {
    return getAudienceLabel(prop as TargetAudience);
  }
}) as Record<TargetAudience, string>;

// Keyword mapping for Smart Auto-Tagging
const TAXONOMY_KEYWORD_RULES: { keys: string[]; keywords: string[] }[] = [
  {
    keys: ["PREV_BULL", "PREV_CYBER"],
    keywords: ["буллинг", "травл", "моббинг", "кибербуллинг", "агресси", "травли", "бойкот", "издевател"],
  },
  {
    keys: ["DEV_EMO", "DEV_WILL"],
    keywords: ["тревог", "тревожн", "страх", "паник", "стресс", "апати", "депресси", "злост", "агресс", "эмоци", "срыв", "саморегуляц", "suds"],
  },
  {
    keys: ["REL_FAM", "REL_DEP"],
    keywords: ["семь", "родител", "мама", "папа", "детско-родительск", "конфликт в семье", "сепарат", "созависим", "развод"],
  },
  {
    keys: ["PREV_DEL", "PREV_VICT"],
    keywords: ["суицид", "самоповрежден", "селфхарм", "веществ", "риск", "насили", "жертв", "травм", "чс", "кризис"],
  },
  {
    keys: ["EDU_LRN", "EDU_SELF", "EDU_CAREER"],
    keywords: ["учеб", "оценк", "егэ", "огэ", "экзамен", "профориентац", "школ", "мотивац", "прокрастинац", "урок"],
  },
  {
    keys: ["ORG_LAW", "SEX_CONSENT"],
    keywords: ["согласи", "152-фз", "закон", "бланк", "регламент", "положен", "нормативн", "договор", "конфиденциальност", "безопасност"],
  },
  {
    keys: ["ORG_BURN", "ORG_SUP", "ORG_CLIM"],
    keywords: ["выгоран", "супервизи", "интервизи", "климат", "усталост", "профилактика выгорания", "поддержк специалиста", "команд"],
  },
  {
    keys: ["DEV_COMM", "REL_PEER"],
    keywords: ["общен", "дружб", "одиночеств", "сверстник", "социализац", "контакт", "адаптац", "группов"],
  },
];

export function autoDetectTaxonomyTags(text: string): string[] {
  const lower = text.toLowerCase();
  const detected = new Set<string>();

  for (const rule of TAXONOMY_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        rule.keys.forEach((k) => detected.add(k));
        break;
      }
    }
  }

  return Array.from(detected);
}

const INITIAL_MATERIALS: LibraryMaterialItem[] = [
  {
    id: "mat-protocol-suds-grounding",
    title: "Протокол экстренной стабилизации и деэскалации (SUDS / Grounding 5-4-3-2-1)",
    subtitle: "Пошаговый клинический протокол первой помощи при острой тревоге, панических атаках и аффекте",
    format: "protocol",
    audience: "all",
    tags: ["DEV_EMO", "PREV_VICT"],
    author: "Комитет доказательной практики IDA",
    date: "14.10.2026",
    readTime: "5 мин",
    downloadsCount: 142,
    description:
      "Экспресс-алгоритм заземления и снижения субъективного уровня дистресса (SUDS) с 10 до 3 баллов. Включает технику ориентации в пространстве 5-4-3-2-1, билатеральное дыхание по квадрату и речевые скрипты нормализации состояния без птичьего языка.",
    content: `## Протокол экстренной стабилизации (SUDS / 5-4-3-2-1)

### 1. Оценка исходного напряжения
- Спросите: «Если оценить твоё состояние от 0 до 10, где 10 — максимальная буря или паника, а 0 — абсолютное спокойствие, на сколько баллов сейчас?» (Фиксируем SUDS_0).

### 2. Заземление и контакт с телом
1. **5 предметов:** «Назови 5 предметов вокруг, которые ты видишь прямо сейчас (например: часы на стене, лампа, блокнот...)».
2. **4 ощущения:** «Назови 4 вещи, которые ты чувствуешь телом (стопы плотно на полу, спина касается стула, прохлада воздуха на ладонях...)».
3. **3 звука:** «Прислушайся и назови 3 звука вокруг (гул компьютера, шум за окном, звук дыхания...)».
4. **2 запаха:** «Почувствуй 2 запаха рядом».
5. **1 вкус:** «Ощути вкус во рту или сделай глоток воды».

### 3. Дыхательный квадрат (4-4-4-4)
- Вдох носом на 4 счета → Задержка 4 счета → Выдох через рот на 4 счета → Задержка 4 счета.
- Повторить 3–4 цикла.

### 4. Контрольная оценка (SUDS_final)
- Если балл снизился до 3–4 — переходим к обычному диалогу.`,
  },
  {
    id: "mat-blank-parent-consent-152fz",
    title: "Бланк информированного добровольного согласия родителя на психологическое сопровождение (152-ФЗ)",
    subtitle: "Юридически выверенный шаблон согласия для школы, детского сада и частного психологического центра",
    format: "blank",
    audience: "school_psychologist",
    tags: ["ORG_LAW", "REL_FAM", "SEX_CONSENT"],
    author: "Правовой отдел платформы Prevention",
    date: "10.10.2026",
    readTime: "3 мин",
    downloadsCount: 215,
    description:
      "Типовой бланк согласия законного представителя ребенка на диагностику, индивидуальные консультации и коррекционно-развивающую работу. Соответствует ФЗ № 152-ФЗ «О персональных данных» и рекомендациям Минпросвещения РФ.",
    content: `ИНФОРМИРОВАННОЕ ДОБРОВОЛЬНОЕ СОГЛАСИЕ
на психолого-педагогическое сопровождение обучающегося

Я, ______________________________________________________________________,
являясь родителем (законным представителем) _______________________________,
обучающегося в ______ классе (группе),

даю согласие на:
1. Психодиагностическое обследование (исследование познавательной, эмоционально-волевой сферы и профориентации).
2. Участие в развивающих и профилактических групповых занятиях.
3. Индивидуальные консультации педагога-психолога при наличии запроса или эмоциональных трудностей.

Специалист обязуется соблюдать конфиденциальность личных данных в соответствии с ФЗ № 152-ФЗ.

Дата: «____» ____________ 202__ г.
Подпись: _________________ / ________________________ /`,
  },
  {
    id: "mat-guide-bullying-protocol",
    title: "Антибуллинговый регламент: алгоритм действий педагога-психолога и администрации при выявлении травли",
    subtitle: "Практическое руководство по деэскалации школьного буллинга и кибербуллинга",
    format: "guide",
    audience: "school_psychologist",
    tags: ["PREV_BULL", "PREV_CYBER", "ORG_LAW"],
    author: "Научно-методический совет Prevention School",
    date: "08.10.2026",
    readTime: "10 мин",
    downloadsCount: 310,
    description:
      "Пошаговый протокол работы со случаями травли в образовательной среде: разделение ролей (агрессор, преследуемый, свидетели), правила проведения индивидуальных и классных бесед без публичного шельмования, вовлечение классного руководителя и родителей.",
    content: `## Антибуллинговый регламент (Краткий протокол)

### Шаг 1. Безопасность жертвы (немедленно)
- Прекратить прямой контакт жертвы с инициаторами травли в неконтролируемых зонах.
- Индивидуальная беседа с пострадавшим учеником: «Ты не виноват(а) в том, что происходит. Мы рядом и остановим это».

### Шаг 2. Индивидуальные беседы с инициатором и активными участниками
- Никаких очных очных «разборок» и очных встреч агрессора с жертвой на первом этапе!
- Формат беседы с преследователем: безоценочная фиксация фактов («Мы знаем, что в чате/в классе происходят такие действия. В нашей школе это неприемлемо и не будет продолжаться»).

### Шаг 3. Работа с классом (группой свидетелей)
- Проведение классного часа по правилам сообщества и личным границам без упоминания имен участников конфликта.
- Определение конкретных правил безопасного поведения и взаимной поддержки.`,
  },
  {
    id: "mat-checklist-suicide-risk",
    title: "Чек-лист экспресс-оценки суицидального и самоповреждающего риска у подростков",
    subtitle: "Критерии красных флагов, шкала оценки критичности и алгоритм немедленного реагирования",
    format: "checklist",
    audience: "school_psychologist",
    tags: ["DEV_EMO", "PREV_DEL", "DEV_SELF"],
    author: "Кризисная служба IDA",
    date: "01.10.2026",
    readTime: "4 мин",
    downloadsCount: 189,
    description:
      "Скрининговый чек-лист для фиксации вербальных и поведенческих маркеров риска: самоповреждения, раздача личных вещей, резкая социальная изоляция, прямые и косвенные высказывания. Четкие инструкции, когда необходимо немедленное привлечение медиков и законных представителей.",
    content: `## Чек-лист оценки маркеров риска

### 🚨 Красные флаги (Немедленные действия):
[ ] Прямые суицидальные намерения или план («Я знаю, как это сделать», фиксация даты/способа).
[ ] Прощальные посты, раздача ценных вещей, закрытие аккаунтов.
[ ] Свежие множественные следы самоповреждений.

### ⚠️ Желтые флаги (Зона повышенного внимания):
[ ] Резкий спад успеваемости и полный уход в себя.
[ ] Тематические рисунки, стихи о смерти и бессмысленности.
[ ] Жалобы на чувство невыносимой душевной боли или тупика.

### Действия специалиста:
1. Не оставлять подростка одного.
2. Немедленно уведомить директора и вызвать законного представителя.
3. Оформить направление на консультацию к детскому психиатру/врачу-специалисту.`,
  },
  {
    id: "mat-guide-burnout-prevention",
    title: "Гайд по психогигиене и профилактике профессионального выгорания специалистов помогающих профессий",
    subtitle: "Практическое руководство по сохранению ресурса, балансу нагрузки и выстраиванию профессиональных границ",
    format: "guide",
    audience: "all",
    tags: ["ORG_BURN", "ORG_SUP", "ORG_CLIM"],
    author: "Супервизорский центр IDA Pro",
    date: "25.09.2026",
    readTime: "8 мин",
    downloadsCount: 174,
    description:
      "Система самодиагностики фаз эмоционального выгорания (напряжение, резистенция, истощение). Практические инструменты: декомпрессионные паузы между клиентами, экологичное завершение сложного рабочего дня, протокол подготовки к супервизии.",
    content: `## Профилактика выгорания: 5 правил психогигиены

1. **Правило буфера между сессиями:** Минимум 10–15 минут без экрана и документации между приёмами.
2. **Ритуал завершения рабочего дня:** Физическое закрытие журнала/ноутбука и ментальная фраза: «Рабочий день окончен, все задачи клиентов остаются в кабинете».
3. **Регулярная супервизия:** Разбор тяжёлых случаев раз в 2–4 недели для снятия контрпереноса и вторичной травматизации.
4. **Цифровые границы:** Никаких консультаций в мессенджерах после 19:00 и в выходные дни.`,
  },
  {
    id: "mat-test-class-climate",
    title: "Методика экспресс-оценки социально-психологического климата и безопасности в классе / коллективе",
    subtitle: "Адаптированный опросник для выявления скрытых конфликтов и групповой сплоченности",
    format: "test",
    audience: "school_psychologist",
    tags: ["ORG_CLIM", "PREV_BULL", "DEV_COMM"],
    author: "Лаборатория превентивной психологии",
    date: "18.09.2026",
    readTime: "6 мин",
    downloadsCount: 128,
    description:
      "Анкета из 12 вопросов для быстрой оценки эмоционального самочувствия школьников в классе. Позволяет за 15 минут выявить уровень доверия к педагогам, наличие группировок и изолированных учащихся.",
  },
  {
    id: "mat-article-public-health-ai",
    title: "Эволюция системы общественного здравоохранения: от биомедицинской модели к доказательной профилактике",
    subtitle: "Исторический и методологический контекст биопсихосоциальной парадигмы",
    format: "article",
    audience: "all",
    tags: ["ORG_LAW", "DEV_EMO"],
    author: "Научно-исследовательский департамент Prevention",
    date: "12.09.2026",
    readTime: "12 мин",
    downloadsCount: 95,
    externalUrl: "https://prevention-ai.ru/articles/evolution-of-public-health-ai/",
    description:
      "Фундаментальный обзор перехода от традиционной парадигмы лечения соматических патологий к биопсихосоциальной модели и превентивным интервенциям в популяции. Анализ структуры факторов риска, резистентности и роли цифровых инструментов.",
  },
  {
    id: "mat-article-mhpss-ai-exoskeleton",
    title: "Взросление MHPSS-AI: от стихийных промптов к когнитивному экзоскелету психолога",
    subtitle: "Архитектура и красные линии ассистивного ИИ в охране психического здоровья",
    format: "article",
    audience: "all",
    tags: ["ORG_SUP", "ORG_LAW"],
    author: "Научно-исследовательский департамент Prevention",
    date: "05.09.2026",
    readTime: "15 мин",
    downloadsCount: 112,
    externalUrl: "https://prevention-ai.ru/articles/mhpss-ai-exoskeleton/",
    description:
      "Методический разбор архитектуры гибридного ИИ для службы охраны психического здоровья. Принцип «экзоскелета специалиста», протокольный контроль, локальный защищенный контур (152-ФЗ) и защита от клинических галлюцинаций.",
  },
];

export default function LibraryWorkspace(): React.ReactElement {
  const [materials, setMaterials] = useState<LibraryMaterialItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch (err) {
        console.error("Failed to load library materials from localStorage", err);
      }
    }
    return isDemoModeActive() ? INITIAL_MATERIALS : [];
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "popular">("recent");
  const [viewMode, setViewMode] = useState<"catalog" | "digest">("catalog");
  const [activePreviewItem, setActivePreviewItem] = useState<LibraryMaterialItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [digestCopiedToast, setDigestCopiedToast] = useState(false);

  // New material modal state
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newFormat, setNewFormat] = useState<MaterialFormat>("protocol");
  const [newAudience, setNewAudience] = useState<TargetAudience>("all");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newExternalUrl, setNewExternalUrl] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  // Save materials when updated
  const saveMaterials = (items: LibraryMaterialItem[]) => {
    setMaterials(items);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.error("Failed to save materials", err);
      }
    }
  };

  // Live auto-tag detection for modal
  useEffect(() => {
    if (!showAddModal) return;
    const combinedText = `${newTitle} ${newSubtitle} ${newDescription} ${newContent}`;
    const detected = autoDetectTaxonomyTags(combinedText);
    if (detected.length > 0) {
      setNewTags((prev) => {
        const merged = new Set([...prev, ...detected]);
        return Array.from(merged);
      });
    }
  }, [newTitle, newSubtitle, newDescription, newContent, showAddModal]);

  // Handle Add Item
  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: LibraryMaterialItem = {
      id: `custom-mat-${Date.now()}`,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || undefined,
      format: newFormat,
      audience: newAudience,
      tags: newTags.length > 0 ? newTags : ["DEV_EMO"],
      author: newAuthor.trim() || "Специалист центра",
      date: new Date().toLocaleDateString("ru-RU"),
      readTime: "5 мин",
      downloadsCount: 1,
      description: newDescription.trim(),
      content: newContent.trim() || undefined,
      externalUrl: newExternalUrl.trim() || undefined,
      isCustom: true,
    };

    saveMaterials([newItem, ...materials]);
    setShowAddModal(false);

    // Reset fields
    setNewTitle("");
    setNewSubtitle("");
    setNewDescription("");
    setNewContent("");
    setNewExternalUrl("");
    setNewAuthor("");
    setNewTags([]);
  };

  // Filter & Sort
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      // Format match
      if (selectedFormat !== "all" && item.format !== selectedFormat) return false;

      // Tag match
      if (selectedTag !== "all" && !item.tags.includes(selectedTag)) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tagText = item.tags.map((tKey) => PROBLEM_KEY_LABELS_RU[tKey] || tKey).join(" ").toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSubtitle = (item.subtitle || "").toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inAuthor = item.author.toLowerCase().includes(q);
        const inTags = tagText.includes(q);
        if (!inTitle && !inSubtitle && !inDesc && !inAuthor && !inTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "popular") {
        return (b.downloadsCount || 0) - (a.downloadsCount || 0);
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      return 0; // default list order
    });
  }, [materials, selectedFormat, selectedTag, searchQuery, sortBy]);

  // Smart Digest Groups (by key taxonomy areas)
  const digestGroups = useMemo(() => {
    const groups: {
      id: string;
      title: string;
      icon: string;
      description: string;
      tagKeys: string[];
      items: LibraryMaterialItem[];
    }[] = [
      {
        id: "bullying",
        title: "Профилактика буллинга, травли и кибербезопасность",
        icon: "🚨",
        description: "Готовые алгоритмы вмешательства, антибуллинговые регламенты и памятки по сетевой безопасности.",
        tagKeys: ["PREV_BULL", "PREV_CYBER", "PREV_VICT"],
        items: [],
      },
      {
        id: "crisis_emotions",
        title: "Эмоциональное состояние, острая тревога и кризис",
        icon: "💔",
        description: "Протоколы деэскалации, техники заземления (SUDS), скрининг суицидального и самоповреждающего риска.",
        tagKeys: ["DEV_EMO", "PREV_DEL", "PREV_AGGR", "DEV_WILL"],
        items: [],
      },
      {
        id: "family_relationships",
        title: "Семья, детско-родительские отношения и контакт",
        icon: "👨‍👩‍👧",
        description: "Методики консультаций родителей, преодоление сопротивления и сепарационные кризисы.",
        tagKeys: ["REL_FAM", "REL_DEP", "REL_PEER"],
        items: [],
      },
      {
        id: "law_regulations",
        title: "Нормативно-правовая база, регламенты и согласия",
        icon: "⚖️",
        description: "Бланки по 152-ФЗ, локальные нормативные акты и юридические правила взаимодействия.",
        tagKeys: ["ORG_LAW", "SEX_CONSENT"],
        items: [],
      },
      {
        id: "study_motivation",
        title: "Учёба, мотивация, экзамены и профориентация",
        icon: "🎓",
        description: "Снижение экзаменационного стресса, саморегуляция и профориентационные гайды.",
        tagKeys: ["EDU_LRN", "EDU_SELF", "EDU_CAREER"],
        items: [],
      },
      {
        id: "burnout_supervision",
        title: "Психогигиена специалиста, супервизия и климат",
        icon: "🛡️",
        description: "Профилактика выгорания, чек-листы баланса ресурсов и подготовка к интервизиям.",
        tagKeys: ["ORG_BURN", "ORG_SUP", "ORG_CLIM"],
        items: [],
      },
    ];

    materials.forEach((mat) => {
      groups.forEach((grp) => {
        if (mat.tags.some((tKey) => grp.tagKeys.includes(tKey))) {
          if (!grp.items.some((i) => i.id === mat.id)) {
            grp.items.push(mat);
          }
        }
      });
    });

    return groups.filter((g) => g.items.length > 0);
  }, [materials]);

  // Copy Smart Digest to clipboard
  const handleCopyDigest = () => {
    let digestText = `📚 УМНЫЙ ДАЙДЖЕСТ МЕТОДИЧЕСКИХ МАТЕРИАЛОВ ДЛЯ КОЛЛЕГ\n` +
      `Актуальная сводка практических протоколов и бланков (Методический фонд Prevention / IDA)\n\n`;

    digestGroups.forEach((group) => {
      digestText += `== ${group.icon} ${group.title.toUpperCase()} ==\n`;
      group.items.forEach((item, idx) => {
        digestText += `${idx + 1}. ${item.title} (${FORMAT_LABELS[item.format].label})\n`;
        digestText += `   • Суть: ${item.description}\n`;
        digestText += `   • Автор: ${item.author} | Дата: ${item.date}\n\n`;
      });
    });

    navigator.clipboard.writeText(digestText);
    setDigestCopiedToast(true);
    setTimeout(() => setDigestCopiedToast(false), 3000);
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1280px", margin: "0 auto", color: "var(--foreground, #0f172a)" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "28px",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          paddingBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 800,
                color: "#6366f1",
                background: "rgba(99, 102, 241, 0.1)",
                padding: "4px 12px",
                borderRadius: "999px",
                display: "inline-block",
              }}
            >
              📚 {t("Методический фонд", "Methodological Fund")}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                background: "#f1f5f9",
                padding: "4px 10px",
                borderRadius: "8px",
              }}
            >
              {materials.length} {t("материалов", "materials")}
            </span>
          </div>

          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            {t("Библиотека методических материалов", "Methodological Library")}
          </h1>
          <p style={{ color: "var(--muted-foreground, #64748b)", fontSize: "0.92rem", margin: 0, maxWidth: "720px", lineHeight: 1.45 }}>
            {t(
              "Практические протоколы первой помощи, бланки информированных согласий, диагностические чек-листы, методические гайды и научные публикации для специалистов и руководителей.",
              "Practical protocols, consent forms, diagnostic checklists, guides, and scientific publications."
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Switch Digest / Catalog */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              onClick={() => setViewMode("catalog")}
              style={{
                border: "none",
                background: viewMode === "catalog" ? "#ffffff" : "transparent",
                color: viewMode === "catalog" ? "#0f172a" : "#64748b",
                fontWeight: viewMode === "catalog" ? 700 : 500,
                fontSize: "0.85rem",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: viewMode === "catalog" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              📂 Каталог материалов
            </button>
            <button
              onClick={() => setViewMode("digest")}
              style={{
                border: "none",
                background: viewMode === "digest" ? "#6366f1" : "transparent",
                color: viewMode === "digest" ? "#ffffff" : "#64748b",
                fontWeight: viewMode === "digest" ? 700 : 500,
                fontSize: "0.85rem",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: viewMode === "digest" ? "0 1px 3px rgba(99,102,241,0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              ✨ Умный дайджест
            </button>
          </div>

          {/* Add Material Button */}
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: "#0284c7",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "9px 16px",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
            }}
          >
            <span>➕</span>
            <span>Прикрепить материал</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE: SMART DIGEST */}
      {viewMode === "digest" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Digest Banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              borderRadius: "16px",
              padding: "24px 28px",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
              boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.3)",
            }}
          >
            <div style={{ maxWidth: "750px" }}>
              <div style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", opacity: 0.9, marginBottom: "4px" }}>
                ✨ Умный дайджест по свежим материалам
              </div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: "1.4rem", fontWeight: 800 }}>
                Тематическая выжимка ключевых методик для коллег
              </h2>
              <p style={{ margin: 0, fontSize: "0.92rem", opacity: 0.9, lineHeight: 1.4 }}>
                Все материалы автоматически структурированы по проблемным кластерам нашей доказательной таксономии.
                Используйте краткую сводку для планерок, педсоветов и обмена опытом с коллегами.
              </p>
            </div>

            <button
              onClick={handleCopyDigest}
              style={{
                background: "#ffffff",
                color: "#4f46e5",
                border: "none",
                borderRadius: "10px",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📋</span>
              <span>{digestCopiedToast ? "Скопировано в буфер!" : "Скопировать дайджест"}</span>
            </button>
          </div>

          {/* Groups of digest */}
          <div style={{ display: "grid", gap: "24px" }}>
            {digestGroups.map((group) => (
              <div
                key={group.id}
                style={{
                  background: "var(--bg-card, #ffffff)",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  borderRadius: "16px",
                  padding: "22px 26px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <span style={{ fontSize: "1.5rem" }}>{group.icon}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#1e293b" }}>
                      {group.title}
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.84rem", color: "#64748b" }}>
                      {group.description}
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                  {group.items.map((item) => {
                    const fmt = FORMAT_LABELS[item.format];
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActivePreviewItem(item)}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "16px",
                          background: "#fafbfd",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#6366f1";
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e2e8f0";
                          e.currentTarget.style.transform = "none";
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: fmt.color,
                                background: fmt.bg,
                                padding: "2px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              {fmt.icon} {fmt.label}
                            </span>
                            <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>{item.date}</span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", marginBottom: "6px", lineHeight: 1.35 }}>
                            {item.title}
                          </div>

                          <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {item.description}
                          </p>
                        </div>

                        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem", color: "#64748b" }}>
                          <span>✍️ {item.author}</span>
                          <span style={{ color: "#4f46e5", fontWeight: 700 }}>Открыть →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* VIEW MODE: CATALOG / ALL MATERIALS */
        <div>
          {/* Filters & Search Toolbar */}
          <div
            style={{
              background: "var(--bg-card, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {/* Search + Sort row */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Поиск по названию, автору, ключевым словам или теме..."
                  style={{
                    width: "100%",
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "0.9rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>Сортировка:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "0.84rem",
                    color: "#1e293b",
                    outline: "none",
                  }}
                >
                  <option value="recent">Сначала новые</option>
                  <option value="popular">По популярности</option>
                  <option value="title">По названию (А-Я)</option>
                </select>
              </div>
            </div>

            {/* Format Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700, minWidth: "75px" }}>Формат:</span>
              <button
                onClick={() => setSelectedFormat("all")}
                style={{
                  border: "none",
                  background: selectedFormat === "all" ? "#0f172a" : "#f1f5f9",
                  color: selectedFormat === "all" ? "#ffffff" : "#475569",
                  borderRadius: "8px",
                  padding: "5px 12px",
                  fontSize: "0.8rem",
                  fontWeight: selectedFormat === "all" ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                Все форматы ({materials.length})
              </button>
              {(Object.keys(FORMAT_LABELS) as MaterialFormat[]).map((fmtKey) => {
                const count = materials.filter((m) => m.format === fmtKey).length;
                if (count === 0) return null;
                const isSelected = selectedFormat === fmtKey;
                const fmt = FORMAT_LABELS[fmtKey];
                return (
                  <button
                    key={fmtKey}
                    onClick={() => setSelectedFormat(fmtKey)}
                    style={{
                      border: "none",
                      background: isSelected ? fmt.color : "#f1f5f9",
                      color: isSelected ? "#ffffff" : "#475569",
                      borderRadius: "8px",
                      padding: "5px 12px",
                      fontSize: "0.8rem",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>{fmt.icon}</span>
                    <span>{fmt.label}</span>
                    <span style={{ opacity: 0.8, fontSize: "0.72rem" }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Taxonomy Topic Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700, minWidth: "75px" }}>Тема таксономии:</span>
              <button
                onClick={() => setSelectedTag("all")}
                style={{
                  border: "none",
                  background: selectedTag === "all" ? "#4f46e5" : "#f1f5f9",
                  color: selectedTag === "all" ? "#ffffff" : "#475569",
                  borderRadius: "8px",
                  padding: "4px 10px",
                  fontSize: "0.78rem",
                  fontWeight: selectedTag === "all" ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                Все темы
              </button>
              {Array.from(new Set(materials.flatMap((m) => m.tags))).map((tagKey) => {
                const isSelected = selectedTag === tagKey;
                const label = PROBLEM_KEY_LABELS_RU[tagKey] || tagKey;
                return (
                  <button
                    key={tagKey}
                    onClick={() => setSelectedTag(tagKey)}
                    style={{
                      border: "none",
                      background: isSelected ? "#4f46e5" : "#f1f5f9",
                      color: isSelected ? "#ffffff" : "#475569",
                      borderRadius: "8px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Materials Grid */}
          {filteredMaterials.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                background: "#f8fafc",
                borderRadius: "16px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "8px" }}>📂</span>
              <h3 style={{ margin: "0 0 6px 0", color: "#1e293b", fontSize: "1.1rem" }}>
                {materials.length === 0
                  ? t("В библиотеке пока нет документов", "No documents in the library yet")
                  : t("По вашему запросу ничего не найдено", "Nothing found for your request")}
              </h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.88rem" }}>
                {materials.length === 0
                  ? t("Вы можете прикрепить собственные методические гайды, бланки и регламенты через кнопку «Прикрепить материал».", "You can attach your own guides, forms, and protocols using the 'Attach material' button.")
                  : t("Попробуйте изменить поисковые слова или сбросить фильтры по формату и темам.", "Try changing search terms or resetting filters.")}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "20px" }}>
              {filteredMaterials.map((item) => {
                const fmt = FORMAT_LABELS[item.format];
                return (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--bg-card, #ffffff)",
                      border: "1px solid var(--border-color, #e2e8f0)",
                      borderRadius: "14px",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                        <span
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: fmt.color,
                            background: fmt.bg,
                            padding: "3px 9px",
                            borderRadius: "6px",
                          }}
                        >
                          {fmt.icon} {fmt.label}
                        </span>

                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                          ⏱️ {item.readTime || "5 мин"}
                        </span>
                      </div>

                      {/* Title & Subtitle */}
                      <h2 style={{ fontSize: "1.08rem", fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a", lineHeight: 1.35 }}>
                        {item.title}
                      </h2>

                      {item.subtitle && (
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "8px", fontWeight: 500, lineHeight: 1.3 }}>
                          {item.subtitle}
                        </div>
                      )}

                      <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "#475569", lineHeight: 1.45 }}>
                        {item.description}
                      </p>

                      {/* Taxonomy Tags */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "14px" }}>
                        {item.tags.map((tKey) => (
                          <span
                            key={tKey}
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              color: "#4338ca",
                              background: "#e0e7ff",
                              padding: "2px 7px",
                              borderRadius: "6px",
                            }}
                          >
                            🏷️ {PROBLEM_KEY_LABELS_RU[tKey] || tKey}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "0.78rem",
                        color: "#64748b",
                      }}
                    >
                      <div>
                        <div>✍️ {item.author}</div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{item.date} • {AUDIENCE_LABELS[item.audience]}</div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        {item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              textDecoration: "none",
                              background: "#4f46e5",
                              color: "#ffffff",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>Читать</span>
                            <span>↗</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => setActivePreviewItem(item)}
                            style={{
                              border: "none",
                              background: "#4f46e5",
                              color: "#ffffff",
                              padding: "6px 14px",
                              borderRadius: "8px",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              cursor: "pointer",
                            }}
                          >
                            Открыть
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PREVIEW MODAL */}
      {activePreviewItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setActivePreviewItem(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "780px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "#f8fafc",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: FORMAT_LABELS[activePreviewItem.format].color,
                      background: FORMAT_LABELS[activePreviewItem.format].bg,
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {FORMAT_LABELS[activePreviewItem.format].icon} {FORMAT_LABELS[activePreviewItem.format].label}
                  </span>
                  <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                    {AUDIENCE_LABELS[activePreviewItem.audience]}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                  {activePreviewItem.title}
                </h3>
              </div>

              <button
                onClick={() => setActivePreviewItem(null)}
                style={{
                  border: "none",
                  background: "#e2e8f0",
                  color: "#475569",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, fontSize: "0.92rem", lineHeight: 1.6, color: "#334155" }}>
              {activePreviewItem.subtitle && (
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#475569", marginBottom: "14px" }}>
                  {activePreviewItem.subtitle}
                </div>
              )}

              <div style={{ background: "#f1f5f9", padding: "12px 16px", borderRadius: "10px", marginBottom: "18px", fontSize: "0.88rem", color: "#334155" }}>
                <strong>Краткое описание:</strong> {activePreviewItem.description}
              </div>

              {/* Content text or markdown */}
              {activePreviewItem.content ? (
                <div
                  style={{
                    background: "#fafafa",
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "18px",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                  }}
                >
                  {activePreviewItem.content}
                </div>
              ) : (
                <p>Полный текст материала доступен в онлайн-ресурсе платформы или доступен для скачивания.</p>
              )}

              {/* Tags in preview */}
              <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>Теги таксономии:</span>
                {activePreviewItem.tags.map((tKey) => (
                  <span
                    key={tKey}
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "#4338ca",
                      background: "#e0e7ff",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {PROBLEM_KEY_LABELS_RU[tKey] || tKey}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Автор: <strong>{activePreviewItem.author}</strong> ({activePreviewItem.date})
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {activePreviewItem.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${activePreviewItem.title}\n\n${activePreviewItem.content}`
                      );
                      alert("Текст материала скопирован в буфер обмена!");
                    }}
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    📋 Скопировать текст
                  </button>
                )}

                <button
                  onClick={() => setActivePreviewItem(null)}
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 18px",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD MATERIAL MODAL */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "720px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                  ➕ Загрузка методического материала в фонд
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                  Материал будет доступен коллегам и автоматически размечен тегами таксономии.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  border: "none",
                  background: "#e2e8f0",
                  color: "#475569",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  Название материала *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Например: Протокол работы со случаем травли в 7 классе"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Subtitle */}
              <div>
                <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  Подзаголовок / контекст
                </label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="Например: Пошаговая инструкция для классного руководителя и психолога"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Format & Audience */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                    Формат материала
                  </label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value as MaterialFormat)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.88rem",
                      background: "#ffffff",
                      outline: "none",
                    }}
                  >
                    <option value="protocol">📋 Протокол</option>
                    <option value="blank">📑 Бланк согласия / документа</option>
                    <option value="guide">📘 Методичка / Гайд</option>
                    <option value="checklist">✅ Чек-лист</option>
                    <option value="test">📊 Диагностика / Тест</option>
                    <option value="article">🔬 Научная публикация</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                    Целевая аудитория
                  </label>
                  <select
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value as TargetAudience)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.88rem",
                      background: "#ffffff",
                      outline: "none",
                    }}
                  >
                    <option value="all">Для всех специалистов</option>
                    <option value="school_psychologist">Школьный педагог-психолог</option>
                    <option value="private_practice">Частная практика / IDA Pro</option>
                    <option value="director">Руководитель / Директор</option>
                    <option value="parents_teachers">Для родителей и педагогов</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  Краткое описание (в чём суть и польза) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Опишите, какую проблему решает материал и в каких случаях применяется..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Content / Text / Link */}
              <div>
                <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  Текст протокола / методики или ссылка
                </label>
                <textarea
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Вставьте полный текст протокола, чек-листа или инструкции..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Auto-detected & manual tags */}
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  🏷️ Умные теги таксономии (определяются автоматически)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                  {newTags.map((tagKey) => (
                    <span
                      key={tagKey}
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        color: "#4338ca",
                        background: "#e0e7ff",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>{PROBLEM_KEY_LABELS_RU[tagKey] || tagKey}</span>
                      <button
                        type="button"
                        onClick={() => setNewTags(newTags.filter((t) => t !== tagKey))}
                        style={{ border: "none", background: "transparent", color: "#6366f1", cursor: "pointer", padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {newTags.length === 0 && (
                    <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      Начните вводить название и описание — теги проставятся сами!
                    </span>
                  )}
                </div>

                {/* Quick Add Tag Dropdown */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !newTags.includes(e.target.value)) {
                        setNewTags([...newTags, e.target.value]);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.8rem",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">+ Добавить тему из базы знаний...</option>
                    {Object.entries(PROBLEM_KEY_LABELS_RU).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label} ({k})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Author */}
              <div>
                <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  Автор / Источник
                </label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="Например: Иванова А.В., педагог-психолог / ЦППМСП"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 20px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Сохранить в фонд
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
