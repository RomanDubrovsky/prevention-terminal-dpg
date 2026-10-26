import React, { useState, useMemo, useEffect } from "react";
import { type CreatorCourse, loadCourseStudents, DEFAULT_COURSES } from "../../lib/course_students_store.ts";
import { type WebinarItem, loadWebinars } from "../../lib/webinars_store.ts";
import { slugifyCenterId } from "../../lib/center_id.ts";

export type AfishaWidgetMode = "school" | "single" | "topic" | "all";
export type AfishaFormatFilter = "all" | "featured" | "courses" | "live" | "recordings";

export interface AfishaTopicOption {
  id: string;
  label: string;
  icon: string;
}

export const PSYCHOLOGY_TOPICS: AfishaTopicOption[] = [
  { id: "all", label: "Все направления", icon: "✨" },
  { id: "cbt_anxiety", label: "КПТ, тревога и стресс", icon: "🧠" },
  { id: "family_couples", label: "Семейная и парная терапия", icon: "💑" },
  { id: "child_teen", label: "Детская и подростковая психология", icon: "🌱" },
  { id: "trauma_crisis", label: "Травма, кризисы и ПТСР", icon: "🛡️" },
  { id: "supervision_practice", label: "Супервизия и разбор кейсов", icon: "🔍" },
  { id: "ai_practice", label: "ИИ-инструменты и частная практика", icon: "🤖" },
];

export function getTopicDisplayLabel(topicTag?: string): string {
  if (!topicTag || topicTag === "all") return "";
  const found = PSYCHOLOGY_TOPICS.find(
    (t) => t.id === topicTag || t.label.toLowerCase() === topicTag.toLowerCase()
  );
  if (found) return `${found.icon} ${found.label}`;
  return `🏷️ ${topicTag}`;
}

export interface AfishaUnifiedCard {
  id: string;
  kind: "course" | "webinar" | "recording";
  title: string;
  description: string;
  speakerOrAuthor: string;
  schoolName: string;
  topicTag: string;
  priceRub: number;
  paymentUrl?: string;
  isFeatured: boolean;
  publishToGlobalCatalog: boolean;
  dateLabel?: string;
  durationLabel?: string;
  lessonsCount?: number;
  participantsCount?: number;
  actionUrl: string;
  roomName?: string;
  courseId?: string;
  recordingId?: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  role: string;
  experience: string;
  bio: string;
  badge: string;
  avatarIcon: string;
}

export interface StudentReview {
  id: string;
  author: string;
  role: string;
  text: string;
  rating: number;
  courseTitle: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

const DEFAULT_TEACHERS: TeacherProfile[] = [
  {
    id: "t-1",
    name: "Д.В. Ковалёв",
    role: "Клинический психолог, супервизор",
    experience: "14+ лет практики",
    bio: "Специалист по краткосрочной КПТ тревожных, фобических и панических расстройств. Автор практических руководств для психологов.",
    badge: "КПТ и кризисы",
    avatarIcon: "👨‍⚕️",
  },
  {
    id: "t-2",
    name: "Е.А. Морозова",
    role: "Кандидат психологических наук, семейный терапевт",
    experience: "18+ лет практики",
    bio: "Ведущий супервизор института, специалист по системной семейной психотерапии, циркулярному интервью и кризисам в паре.",
    badge: "Семья и пары",
    avatarIcon: "👩‍🏫",
  },
  {
    id: "t-3",
    name: "А.С. Светлова",
    role: "Детский и подростковый психолог",
    experience: "10+ лет практики",
    bio: "Кризисный психолог, эксперт по коррекции эмоционально-поведенческих трудностей, самоповреждающего поведения и работе с родителями.",
    badge: "Дети и подростки",
    avatarIcon: "👩‍💼",
  },
  {
    id: "t-4",
    name: "М.И. Романов",
    role: "Психолог-практик, эксперт IDA по протоколам",
    experience: "12+ лет практики",
    bio: "Специалист по структурированию частной практики, внедрению цифровых протоколов помощи и подготовке к супервизиям.",
    badge: "Протоколы и супервизия",
    avatarIcon: "👨‍💻",
  },
];

const DEFAULT_REVIEWS: StudentReview[] = [
  {
    id: "rev-1",
    author: "Ольга Васильева",
    role: "Практикующий психолог-консультант",
    courseTitle: "Практикум по КПТ тревожных состояний",
    rating: 5,
    text: "Очень практичный формат — без схоластики и академической воды. Готовые терапевтические протоколы сессий и бланки я начала применять на клиентах уже на второй неделе обучения!",
  },
  {
    id: "rev-2",
    author: "Сергей Мельников",
    role: "Семейный системный психолог",
    courseTitle: "Системная семейная терапия в парах",
    rating: 5,
    text: "Регулярные живые супервизии и разбор реальных ситуаций позволили структурировать работу со сложными конфликтными семьями. Кабинет удобный, всё открывается прямо с телефона.",
  },
  {
    id: "rev-3",
    author: "Анна Корнеева",
    role: "Клинический психолог",
    courseTitle: "Психологическая помощь подросткам",
    rating: 5,
    text: "Официальный сертификат с защищённым QR-кодом подтвердил мою квалификацию перед клиентами. Огромная благодарность преподавателям за чуткую поддержку и разбор домашних заданий.",
  },
];

const DEFAULT_FAQS: FaqEntry[] = [
  {
    id: "faq-1",
    question: "Как я получу доступ к курсу или вебинару после оплаты?",
    answer:
      "Сразу после оплаты вы получаете персональный код доступа (например, st-e9x1) на email и экран подтверждения. Нажмите «🔑 Вход в кабинет студента» в шапке сайта, введите ваш email или код — и все материалы, видеозаписи и задания сразу станут доступны.",
  },
  {
    id: "faq-2",
    question: "Нужно ли скачивать Zoom или другие сторонние программы?",
    answer:
      "Нет. Все живые вебинары, видеоуроки, тесты и материалы работают напрямую в защищённом веб-кабинете в любом браузере (на компьютере, планшете или смартфоне).",
  },
  {
    id: "faq-3",
    question: "Выдаётся ли сертификат после окончания программы?",
    answer:
      "Да. После прохождения всех уроков и выполнения практических заданий курса автоматически формируется официальный именной сертификат с уникальным QR-кодом для проверки подлинности в едином реестре выпускников.",
  },
  {
    id: "faq-4",
    question: "Как происходит оплата и безопасны ли платежи?",
    answer:
      "Оплата поступает напрямую автору/школе через официальный интернет-эквайринг (ЮKassa, Т-Банк, СБП или Prodamus) по защищённому протоколу 3D-Secure с выдачей официального фискального чека 54-ФЗ. Платформа не удерживает скрытых комиссий.",
  },
  {
    id: "faq-5",
    question: "На какой срок предоставляется доступ к материалам?",
    answer:
      "Доступ к приобретённым курсам и записям вебинаров является бессрочным. Вы можете возвращаться к конспектам, схемам протоколов и видео в любое удобное время.",
  },
];

const COURSES_STORAGE_KEY = "ida_creator_courses_v3";
const WEBINARS_STORAGE_KEY = "ida_creator_webinars_v2";

const PARTNER_FEDERAL_SEED: AfishaUnifiedCard[] = [
  {
    id: "fed-course-cbt",
    kind: "course",
    title: "Практикум по КПТ тревожных и панических состояний",
    description:
      "Пошаговые алгоритмы работы с паническими атаками, ипохондрией и генерализованной тревогой. Готовые бланки, протоколы первой сессии и демонстрационные разборы.",
    speakerOrAuthor: "Д.В. Ковалёв, клинический психолог",
    schoolName: "Моя школа психологии",
    topicTag: "cbt_anxiety",
    priceRub: 14900,
    isFeatured: true,
    publishToGlobalCatalog: true,
    durationLabel: "8 недель · 12 уроков",
    lessonsCount: 12,
    participantsCount: 284,
    actionUrl: "/?course=course-1&role=student",
    courseId: "course-1",
  },
  {
    id: "fed-web-family",
    kind: "webinar",
    title: "Живой разбор: Системная семейная терапия при затяжном кризисе в паре",
    description:
      "Открытый практический эфир с супервизией реального кейса, анализом циркулярных паттернов и техникой передоговаривания партнёров.",
    speakerOrAuthor: "Е.А. Морозова, семейный психотерапевт",
    schoolName: "Моя школа психологии",
    topicTag: "family_couples",
    priceRub: 0,
    isFeatured: true,
    publishToGlobalCatalog: true,
    dateLabel: `${new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)} в 19:00`,
    durationLabel: "90 мин",
    participantsCount: 165,
    actionUrl: "/?room=room-family-crisis&mode=webinar&role=listener",
    roomName: "room-family-crisis",
  },
  {
    id: "fed-course-teen",
    kind: "course",
    title: "Психологическая помощь подросткам и работа с родителями",
    description:
      "Методика первичного контакта с подростком, профилактика самоповреждающего поведения, буллинга и выстраивание доверительного союза с семьёй.",
    speakerOrAuthor: "А.С. Светлова, подростковый психолог",
    schoolName: "Моя школа психологии",
    topicTag: "child_teen",
    priceRub: 9500,
    isFeatured: false,
    publishToGlobalCatalog: true,
    durationLabel: "6 недель · 9 уроков",
    lessonsCount: 9,
    participantsCount: 190,
    actionUrl: "/?course=course-1&role=student",
    courseId: "course-1",
  },
  {
    id: "fed-web-supervision",
    kind: "webinar",
    title: "Клиническая супервизия: Сложные клиенты в частной практике",
    description:
      "Практический разбор тупиковых ситуаций в терапии, работа с сопротивлением и сохранение эмоциональной устойчивости психолога.",
    speakerOrAuthor: "М.И. Романов, ведущий супервизор",
    schoolName: "Моя школа психологии",
    topicTag: "supervision_practice",
    priceRub: 1500,
    isFeatured: true,
    publishToGlobalCatalog: true,
    dateLabel: `${new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10)} в 18:30`,
    durationLabel: "120 мин",
    participantsCount: 88,
    actionUrl: "/?room=room-supervision-live&mode=webinar&role=listener",
    roomName: "room-supervision-live",
  },
];

export function resolveSchoolDisplayName(raw?: string): string {
  // If user has saved their custom school name in settings, read it as fallback
  let customSettingsName = "";
  if (typeof window !== "undefined") {
    try {
      const rawSettings = localStorage.getItem("ida_school_site_settings_v1");
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed?.schoolName && typeof parsed.schoolName === "string" && parsed.schoolName.trim()) {
          customSettingsName = parsed.schoolName.trim();
        }
      }
    } catch {}
  }

  const defaultFallback = customSettingsName || "Моя школа психологии";
  if (!raw || !raw.trim()) return defaultFallback;
  const clean = raw.trim();
  const slug = clean.toLowerCase();

  if (
    slug === "akademiya-prakticheskoy-psihologii-ida" ||
    slug === "akademiya-prakticheskoy-psihologii" ||
    slug === "moya-shkola-psihologii" ||
    slug === "shkola-psihologii" ||
    slug === "moya-shkola" ||
    slug === "ida-academy" ||
    slug === "academy" ||
    slug === "ida" ||
    slug === "default"
  ) {
    return defaultFallback;
  }
  if (slug === "institut-prakticheskoy-kpt" || slug === "institut-sovremennoy-kpt") {
    return "Институт современной КПТ";
  }
  if (slug === "masterskaya-semeynogo-konsultirovaniya") {
    return "Мастерская семейного консультирования";
  }
  if (slug === "shkola-detskoy-i-podrostkovoy-praktiki") {
    return "Школа детской и подростковой практики";
  }

  if (slug.includes("-")) {
    return clean
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return clean;
}

function getBaseOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://web.academy.ida-psy.ru";
}

export function loadUnifiedAfishaItems(defaultSchoolName = "Моя школа психологии"): {
  localItems: AfishaUnifiedCard[];
  allFederalItems: AfishaUnifiedCard[];
  courses: CreatorCourse[];
  webinars: WebinarItem[];
} {
  const origin = getBaseOrigin();
  const readableSchool = resolveSchoolDisplayName(defaultSchoolName);
  let courses: CreatorCourse[] = [];
  let webinars: WebinarItem[] = [];

  try {
    const rawCourses = localStorage.getItem(COURSES_STORAGE_KEY);
    if (rawCourses) {
      const parsed = JSON.parse(rawCourses);
      if (Array.isArray(parsed) && parsed.length > 0) courses = parsed;
    }
  } catch {}

  if (courses.length === 0) {
    courses = DEFAULT_COURSES;
  }

  try {
    const rawWebinars = localStorage.getItem(WEBINARS_STORAGE_KEY);
    if (rawWebinars) {
      const parsed = JSON.parse(rawWebinars);
      if (Array.isArray(parsed) && parsed.length > 0) webinars = parsed;
    } else {
      webinars = loadWebinars();
    }
  } catch {
    webinars = loadWebinars();
  }

  const localItems: AfishaUnifiedCard[] = [];
  const schoolSlugFilter = defaultSchoolName ? slugifyCenterId(defaultSchoolName) : "";

  for (const c of courses) {
    if (c.status === "draft") continue;
    const itemSchool = c.schoolName || readableSchool;
    const itemSchoolSlug = slugifyCenterId(itemSchool);

    if (
      schoolSlugFilter &&
      itemSchoolSlug !== schoolSlugFilter &&
      itemSchool !== readableSchool &&
      schoolSlugFilter !== "akademiya-prakticheskoy-psihologii-ida"
    ) {
      continue;
    }

    localItems.push({
      id: `course:${c.id}`,
      kind: "course",
      title: c.title,
      description: c.description || "Практический курс для психологов и специалистов помогающих профессий.",
      speakerOrAuthor: c.authorName || "Ведущий преподаватель",
      schoolName: readableSchool,
      topicTag: c.topicTag || "cbt_anxiety",
      priceRub: typeof c.priceRub === "number" ? c.priceRub : 12900,
      paymentUrl: c.paymentUrl,
      isFeatured: c.isFeatured ?? true,
      publishToGlobalCatalog: c.publishToGlobalCatalog ?? true,
      durationLabel: `${c.lessons?.length || 8} уроков · Практика`,
      lessonsCount: c.lessons?.length || 8,
      participantsCount: 142,
      actionUrl: `${origin}/?course=${encodeURIComponent(c.id)}&role=student`,
      courseId: c.id,
    });
  }

  for (const w of webinars) {
    const isFinished = w.status === "finished" || Boolean(w.recording);
    const monPrice = w.recording?.monetization?.isPaid ? (w.recording?.monetization?.priceRub || 0) : (w.priceRub || 0);
    const payUrl = w.recording?.monetization?.paymentUrl || w.paymentUrl;
    const recId = w.recording?.id || w.id;
    const itemSchool = w.schoolName || readableSchool;
    const itemSchoolSlug = slugifyCenterId(itemSchool);

    if (
      schoolSlugFilter &&
      itemSchoolSlug !== schoolSlugFilter &&
      itemSchool !== readableSchool &&
      schoolSlugFilter !== "akademiya-prakticheskoy-psihologii-ida"
    ) {
      continue;
    }

    localItems.push({
      id: `webinar:${w.id}`,
      kind: isFinished ? "recording" : "webinar",
      title: w.title,
      description: w.description || "Практический вебинар с разбором клинических ситуаций и ответами на вопросы.",
      speakerOrAuthor: w.speakerName || "Ведущий эксперт",
      schoolName: readableSchool,
      topicTag: w.topicTag || "supervision_practice",
      priceRub: monPrice,
      paymentUrl: payUrl,
      isFeatured: w.isFeatured ?? !isFinished,
      publishToGlobalCatalog: w.publishToGlobalCatalog ?? true,
      dateLabel: `${w.scheduledDate || "24 октября"} в ${w.scheduledTime || "19:00"}`,
      durationLabel: `${w.durationMinutes || 90} мин`,
      participantsCount: w.registeredCount || 64,
      actionUrl: isFinished
        ? `${origin}/?mode=recording&id=${encodeURIComponent(recId)}`
        : `${origin}/?room=${encodeURIComponent(w.roomName)}&mode=webinar&role=listener&title=${encodeURIComponent(w.title)}&time=${encodeURIComponent(`${w.scheduledDate} ${w.scheduledTime}`)}&speaker=${encodeURIComponent(w.speakerName || "Ведущий")}`,
      roomName: w.roomName,
      recordingId: isFinished ? recId : undefined,
    });
  }

  const baseItems = localItems.length > 0 ? localItems : PARTNER_FEDERAL_SEED;
  const publishedLocal = baseItems.filter((item) => item.publishToGlobalCatalog);
  const allFederalItems = [...publishedLocal, ...PARTNER_FEDERAL_SEED.filter((f) => !publishedLocal.some((p) => p.id === f.id))];

  return { localItems: baseItems, allFederalItems, courses, webinars };
}

export interface AcademyAfishaViewProps {
  mode?: AfishaWidgetMode;
  schoolNameFilter?: string;
  topicFilter?: string;
  singleItemId?: string;
  theme?: "light" | "dark";
  showStudentLogin?: boolean;
  showPsychologistPromo?: boolean;
  paymentGatewayLabel?: string;
  partnerRef?: string;
  isEmbed?: boolean;
  onOpenStudentCourse?: (courseId: string, studentCode?: string) => void;
  onOpenPsychologistWorkspace?: () => void;
}

export function AcademyAfishaView({
  mode = "school",
  schoolNameFilter,
  topicFilter = "all",
  singleItemId,
  theme = "light",
  showStudentLogin = true,
  showPsychologistPromo = true,
  paymentGatewayLabel,
  partnerRef,
  isEmbed = false,
  onOpenStudentCourse,
  onOpenPsychologistWorkspace,
}: AcademyAfishaViewProps) {
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(theme);
  const isDark = currentTheme === "dark";

  const [formatTab, setFormatTab] = useState<AfishaFormatFilter>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>(topicFilter || "all");
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>("faq-1");

  // Student Login Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const schoolDisplayName = useMemo(
    () => resolveSchoolDisplayName(schoolNameFilter),
    [schoolNameFilter]
  );

  useEffect(() => {
    if (topicFilter) setSelectedTopic(topicFilter);
  }, [topicFilter]);

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  const { localItems, allFederalItems, courses } = useMemo(
    () => loadUnifiedAfishaItems(schoolDisplayName),
    [schoolDisplayName]
  );

  const basePool = useMemo(() => {
    if (mode === "single" && singleItemId) {
      const found = [...localItems, ...allFederalItems].find((x) => x.id === singleItemId);
      return found ? [found] : localItems.slice(0, 1);
    }
    if (mode === "school") {
      return localItems.length > 0 ? localItems : allFederalItems;
    }
    return allFederalItems;
  }, [mode, singleItemId, localItems, allFederalItems]);

  const availableSchools = useMemo(() => {
    const set = new Set<string>();
    basePool.forEach((item) => {
      if (item.schoolName) set.add(item.schoolName);
    });
    return Array.from(set);
  }, [basePool]);

  const availableTopics = useMemo(() => {
    const map = new Map<string, AfishaTopicOption>();
    PSYCHOLOGY_TOPICS.forEach((t) => map.set(t.id, t));
    basePool.forEach((card) => {
      if (card.topicTag && card.topicTag !== "all" && !map.has(card.topicTag)) {
        map.set(card.topicTag, {
          id: card.topicTag,
          label: card.topicTag,
          icon: "🏷️",
        });
      }
    });
    return Array.from(map.values());
  }, [basePool]);

  const filteredCards = useMemo(() => {
    return basePool.filter((card) => {
      if (mode === "single" && singleItemId) {
        return card.id === singleItemId;
      }
      if (formatTab === "featured" && !card.isFeatured) return false;
      if (formatTab === "courses" && card.kind !== "course") return false;
      if (formatTab === "live" && card.kind !== "webinar") return false;
      if (formatTab === "recordings" && card.kind !== "recording") return false;

      const activeTopic = mode === "topic" && topicFilter && topicFilter !== "all" ? topicFilter : selectedTopic;
      if (activeTopic !== "all" && card.topicTag !== activeTopic) return false;

      if (mode === "all" && selectedSchool !== "all" && card.schoolName !== selectedSchool) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = card.title.toLowerCase().includes(q);
        const matchDesc = card.description.toLowerCase().includes(q);
        const matchAuthor = card.speakerOrAuthor.toLowerCase().includes(q);
        const matchSchool = card.schoolName.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAuthor && !matchSchool) return false;
      }

      return true;
    });
  }, [basePool, mode, singleItemId, formatTab, selectedTopic, topicFilter, selectedSchool, searchQuery]);

  const handleStudentLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = loginInput.trim();
    if (!trimmed) {
      setLoginError("Введите персональный код доступа (например, st-e9x1) или ваш Email");
      return;
    }

    const students = loadCourseStudents();
    const matched = students.find(
      (s) =>
        s.accessCode.toLowerCase() === trimmed.toLowerCase() ||
        (s.email && s.email.toLowerCase() === trimmed.toLowerCase())
    );

    const targetCourseId = matched?.courseIds?.[0] || courses[0]?.id || "course-1";
    const targetCode = matched?.accessCode || trimmed;

    setShowLoginModal(false);
    setLoginError(null);

    if (onOpenStudentCourse) {
      onOpenStudentCourse(targetCourseId, targetCode);
    } else {
      window.location.href = `${getBaseOrigin()}/?course=${encodeURIComponent(targetCourseId)}&student=${encodeURIComponent(targetCode)}&role=student`;
    }
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const colors = useMemo(() => {
    return isDark
      ? {
          bg: "#090d16",
          pageBg: "#060911",
          cardBg: "#0f172a",
          cardHoverBg: "#131f37",
          panelBg: "#0b1322",
          border: "rgba(255, 255, 255, 0.1)",
          borderLight: "rgba(255, 255, 255, 0.05)",
          textPrimary: "#f8fafc",
          textSecondary: "#94a3b8",
          textMuted: "#64748b",
          accent: "#14b8a6",
          accentDark: "#0f766e",
          accentLight: "rgba(20, 184, 166, 0.12)",
          accentBorder: "rgba(20, 184, 166, 0.3)",
          accentGradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
          heroGradient: "radial-gradient(ellipse at top, rgba(20, 184, 166, 0.18) 0%, rgba(9, 13, 22, 0) 70%)",
          tagBg: "rgba(255, 255, 255, 0.06)",
          shadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
          shadowHover: "0 20px 40px -15px rgba(20, 184, 166, 0.2)",
        }
      : {
          bg: "#f8fafc",
          pageBg: "#ffffff",
          cardBg: "#ffffff",
          cardHoverBg: "#f1f5f9",
          panelBg: "#f1f5f9",
          border: "#e2e8f0",
          borderLight: "#edf2f7",
          textPrimary: "#0f172a",
          textSecondary: "#475569",
          textMuted: "#94a3b8",
          accent: "#0f766e",
          accentDark: "#115e59",
          accentLight: "#f0fdfa",
          accentBorder: "#99f6e4",
          accentGradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
          heroGradient: "radial-gradient(ellipse at top, #e6fffa 0%, #ffffff 70%)",
          tagBg: "#f1f5f9",
          shadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
          shadowHover: "0 12px 30px rgba(15, 118, 110, 0.12)",
        };
  }, [isDark]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.pageBg,
        color: colors.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        lineHeight: 1.5,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 1. TOP HEADER & NAVBAR (Sticky) */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: isDark ? "rgba(9, 13, 22, 0.92)" : "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${colors.border}`,
          padding: "0 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Brand Emblem & School Title */}
          <div
            onClick={() => scrollToSection("hero")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: colors.accentGradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)",
              }}
            >
              🏛️
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: "1.05rem", color: colors.textPrimary, letterSpacing: "-0.01em" }}>
                  {schoolDisplayName}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: colors.accentLight,
                    color: isDark ? "#2dd4bf" : "#0f766e",
                    border: `1px solid ${colors.accentBorder}`,
                  }}
                >
                  ✓ Верифицировано
                </span>
              </div>
              <div style={{ fontSize: "0.74rem", color: colors.textSecondary }}>
                Практическое психологическое образование и супервизии
              </div>
            </div>
          </div>

          {/* Quick Nav Anchors (Desktop) */}
          {!isEmbed && (
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
              className="academy-desktop-nav"
            >
              <button
                type="button"
                onClick={() => scrollToSection("catalog")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Программы
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("advantages")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Преимущества
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("teachers")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Преподаватели
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("faq")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Вопросы
              </button>
            </nav>
          )}

          {/* Right Header Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setCurrentTheme(isDark ? "light" : "dark")}
              title="Переключить тему (светлая/тёмная)"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.cardBg,
                color: colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              {isDark ? "☀️" : "🌙"}
            </button>

            {/* Student Cabinet Login Button */}
            {showStudentLogin && (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: `1.5px solid ${colors.accent}`,
                  background: colors.accentLight,
                  color: isDark ? "#2dd4bf" : colors.accent,
                  fontSize: "0.86rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 10px rgba(15, 118, 110, 0.15)",
                }}
              >
                <span>🔑 Вход для студентов</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section
        id="hero"
        style={{
          position: "relative",
          padding: isEmbed ? "32px 20px 24px" : "64px 20px 48px",
          background: colors.heroGradient,
          borderBottom: `1px solid ${colors.border}`,
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "6px 14px",
                borderRadius: 999,
                background: colors.accentLight,
                color: isDark ? "#2dd4bf" : "#0f766e",
                border: `1px solid ${colors.accentBorder}`,
              }}
            >
              🎓 Официальная образовательная витрина
            </span>
            {paymentGatewayLabel && (
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: colors.tagBg,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                }}
              >
                💳 Прямая оплата: {paymentGatewayLabel}
              </span>
            )}
          </div>

          {/* Main Title */}
          <h1
            style={{
              margin: "0 auto 16px auto",
              fontSize: isEmbed ? "1.8rem" : "2.6rem",
              fontWeight: 900,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              maxWidth: 900,
              color: colors.textPrimary,
            }}
          >
            {mode === "all"
              ? "Единая афиша курсов, супервизий и живых вебинаров"
              : mode === "single"
                ? filteredCards[0]?.title || "Учебная программа"
                : schoolDisplayName}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              margin: "0 auto 28px auto",
              fontSize: isEmbed ? "0.95rem" : "1.12rem",
              color: colors.textSecondary,
              maxWidth: 780,
              lineHeight: 1.6,
            }}
          >
            {mode === "all"
              ? "Практические программы, супервизии и открытые эфиры от ведущих психологических школ и сертифицированных практиков."
              : "Прикладные алгоритмы консультаций, разборы реальных клиентских случаев, готовые терапевтические протоколы и официальные сертификаты с QR-проверкой."}
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 40,
            }}
          >
            <button
              type="button"
              onClick={() => scrollToSection("catalog")}
              style={{
                padding: "13px 28px",
                borderRadius: 12,
                border: "none",
                background: colors.accentGradient,
                color: "#ffffff",
                fontSize: "0.98rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 6px 20px rgba(15, 118, 110, 0.28)",
              }}
            >
              <span>📚 Смотреть программы обучения</span>
              <span>↓</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              style={{
                padding: "13px 24px",
                borderRadius: 12,
                border: `1.5px solid ${colors.border}`,
                background: colors.cardBg,
                color: colors.textPrimary,
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>🔑 Войти в учебный кабинет</span>
              <span>→</span>
            </button>
          </div>

          {/* Trust Metrics Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              maxWidth: 960,
              margin: "0 auto",
              padding: "18px 24px",
              borderRadius: 16,
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              boxShadow: colors.shadow,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: colors.accent }}>1 200+</div>
              <div style={{ fontSize: "0.78rem", color: colors.textSecondary }}>Выпускников и практиков</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: colors.accent }}>100%</div>
              <div style={{ fontSize: "0.78rem", color: colors.textSecondary }}>Практическая отработка кейсов</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: colors.accent }}>0%</div>
              <div style={{ fontSize: "0.78rem", color: colors.textSecondary }}>Комиссий — прямая оплата автору</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: colors.accent }}>24 / 7</div>
              <div style={{ fontSize: "0.78rem", color: colors.textSecondary }}>Бессрочный доступ в кабинете</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SCHOOL ADVANTAGES SECTION */}
      {!isEmbed && (
        <section
          id="advantages"
          style={{
            padding: "60px 20px",
            background: colors.bg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isDark ? "#2dd4bf" : "#0f766e",
                }}
              >
                💡 Здравый смысл против схоластики
              </span>
              <h2
                style={{
                  margin: "8px 0 10px 0",
                  fontSize: "1.85rem",
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Почему психологи выбирают программы школы
              </h2>
              <p style={{ margin: 0, fontSize: "0.95rem", color: colors.textSecondary, maxWidth: 680, marginLeft: "auto", marginRight: "auto" }}>
                Обучение построено на понятном человеческом языке, протоколах доказательной терапии и отработке реальных навыков.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 20,
              }}
            >
              {[
                {
                  icon: "🧠",
                  title: "Готовые протоколы сессий",
                  desc: "Пошаговый план первой встречи, алгоритмы работы со сложными темами, речевые модули и терапевтические бланки для клиентов.",
                },
                {
                  icon: "👥",
                  title: "Живые супервизии и разборы",
                  desc: "Регулярный разбор клинических кейсов в малых группах под руководством опытных супервизоров и экспертов.",
                },
                {
                  icon: "🎥",
                  title: "Кабинет без лишнего софта",
                  desc: "Все лекции, видео без Zoom, конспекты и тесты доступны в вашем личном кабинете на любом телефоне или ноутбуке.",
                },
                {
                  icon: "📜",
                  title: "Официальные сертификаты",
                  desc: "Именные документы с индивидуальным защищённым QR-кодом для подтверждения квалификации в частной практике.",
                },
              ].map((adv, i) => (
                <div
                  key={i}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: "24px 20px",
                    boxShadow: colors.shadow,
                  }}
                >
                  <div
                    style={{
                      fontSize: "2rem",
                      marginBottom: 12,
                      width: 50,
                      height: 50,
                      borderRadius: 12,
                      background: colors.accentLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {adv.icon}
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 800, color: colors.textPrimary }}>
                    {adv.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: colors.textSecondary, lineHeight: 1.55 }}>
                    {adv.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. SHOWCASE & CATALOG SECTION */}
      <section
        id="catalog"
        style={{
          padding: "50px 20px",
          background: colors.pageBg,
          flex: 1,
        }}
      >
        <div style={{ maxWidth: 1150, margin: "0 auto" }}>
          {/* Showcase Section Header */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 28,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: isDark ? "#2dd4bf" : "#0f766e",
                }}
              >
                ✨ Каталог программ и эфиров
              </span>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "1.75rem", fontWeight: 800, color: colors.textPrimary }}>
                {mode === "all" ? "Все доступные программы" : `Учебные программы: ${schoolDisplayName}`}
              </h2>
            </div>

            {/* Quick search input */}
            <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Поиск по названию, спикеру..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${colors.border}`,
                  background: colors.cardBg,
                  color: colors.textPrimary,
                  fontSize: "0.86rem",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Format Tabs Bar */}
          {mode !== "single" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 14,
                background: colors.panelBg,
                border: `1px solid ${colors.border}`,
                marginBottom: 24,
              }}
            >
              {/* Format Filter Pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(
                  [
                    { id: "all", label: "🌟 Все программы" },
                    { id: "featured", label: "🔥 Хиты" },
                    { id: "courses", label: "📚 Практические курсы" },
                    { id: "live", label: "🎙️ Живые эфиры" },
                    { id: "recordings", label: "🎬 Записи" },
                  ] as { id: AfishaFormatFilter; label: string }[]
                ).map((tab) => {
                  const active = formatTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormatTab(tab.id)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: `1px solid ${active ? colors.accent : colors.border}`,
                        background: active ? colors.accent : colors.cardBg,
                        color: active ? "#ffffff" : colors.textPrimary,
                        fontSize: "0.82rem",
                        fontWeight: active ? 800 : 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Topic Select */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.78rem", color: colors.textSecondary, fontWeight: 600 }}>Тема:</span>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.cardBg,
                    color: colors.textPrimary,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  {availableTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.icon} {topic.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Cards Grid */}
          {filteredCards.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                borderRadius: 16,
                border: `1.5px dashed ${colors.border}`,
                background: colors.cardBg,
                color: colors.textSecondary,
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>📭</div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: colors.textPrimary, marginBottom: 6 }}>
                По выбранным параметрам программ не найдено
              </div>
              <p style={{ margin: "0 auto 16px auto", fontSize: "0.88rem", maxWidth: 460 }}>
                Попробуйте выбрать «Все программы» или очистить строку поиска, чтобы увидеть полный каталог.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormatTab("all");
                  setSelectedTopic("all");
                  setSelectedSchool("all");
                  setSearchQuery("");
                }}
                style={{
                  padding: "9px 20px",
                  borderRadius: 10,
                  border: `1px solid ${colors.accent}`,
                  background: colors.accentLight,
                  color: isDark ? "#2dd4bf" : colors.accent,
                  fontSize: "0.84rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mode === "single" ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 22,
              }}
            >
              {filteredCards.map((card) => {
                const topicMeta = PSYCHOLOGY_TOPICS.find((t) => t.id === card.topicTag);
                const isCourse = card.kind === "course";
                const isLive = card.kind === "webinar";

                return (
                  <div
                    key={card.id}
                    style={{
                      borderRadius: 18,
                      border: `1.5px solid ${card.isFeatured ? colors.accentBorder : colors.border}`,
                      background: colors.cardBg,
                      padding: "22px 24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: card.isFeatured ? colors.shadowHover : colors.shadow,
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Top Decorative Color Accent Bar */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: isCourse
                          ? "linear-gradient(90deg, #0f766e, #14b8a6)"
                          : isLive
                            ? "linear-gradient(90deg, #10b981, #34d399)"
                            : "linear-gradient(90deg, #6366f1, #a855f7)",
                      }}
                    />

                    <div>
                      {/* Badges Row */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: isCourse
                                ? isDark
                                  ? "rgba(20, 184, 166, 0.2)"
                                  : "#ccfbf1"
                                : isLive
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "#dcfce7"
                                  : isDark
                                    ? "rgba(139, 92, 246, 0.2)"
                                    : "#ede9fe",
                              color: isCourse
                                ? isDark
                                  ? "#2dd4bf"
                                  : "#0f766e"
                                : isLive
                                  ? isDark
                                    ? "#6ee7b7"
                                    : "#15803d"
                                  : isDark
                                    ? "#c4b5fd"
                                    : "#6d28d9",
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {isCourse ? "📚 Практический курс" : isLive ? "🎙️ Живой эфир" : "🎬 Запись интенсива"}
                          </span>

                          {card.isFeatured && (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                padding: "4px 9px",
                                borderRadius: 6,
                                background: isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7",
                                color: isDark ? "#fcd34d" : "#b45309",
                              }}
                            >
                              🔥 Хит
                            </span>
                          )}
                        </div>

                        {(() => {
                          const displayTopic = getTopicDisplayLabel(card.topicTag);
                          if (!displayTopic) return null;
                          return (
                            <span style={{ fontSize: "0.74rem", color: colors.textSecondary, fontWeight: 600 }}>
                              {displayTopic}
                            </span>
                          );
                        })()}
                      </div>

                      {/* School Emblem / Author Tag */}
                      <div
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          color: colors.accent,
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>🏛️ {card.schoolName}</span>
                      </div>

                      {/* Title & Description */}
                      <h3
                        style={{
                          margin: "0 0 10px 0",
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          lineHeight: 1.35,
                          color: colors.textPrimary,
                        }}
                      >
                        {card.title}
                      </h3>
                      <p
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: "0.86rem",
                          color: colors.textSecondary,
                          lineHeight: 1.55,
                        }}
                      >
                        {card.description}
                      </p>
                    </div>

                    <div>
                      {/* Meta Pills (Speaker, Date, Duration, Lessons) */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          fontSize: "0.78rem",
                          color: colors.textSecondary,
                          padding: "12px 0",
                          marginBottom: 16,
                          borderTop: `1px solid ${colors.borderLight}`,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}
                      >
                        <span>👤 {card.speakerOrAuthor}</span>
                        {card.dateLabel && <span>🗓 {card.dateLabel}</span>}
                        {card.durationLabel && <span>⏱ {card.durationLabel}</span>}
                        {typeof card.participantsCount === "number" && (
                          <span>👥 {card.participantsCount} практиков</span>
                        )}
                      </div>

                      {/* Price & CTA Row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "0.72rem", color: colors.textMuted }}>Стоимость участия</div>
                          <div
                            style={{
                              fontSize: "1.2rem",
                              fontWeight: 900,
                              color: card.priceRub > 0 ? colors.textPrimary : "#059669",
                            }}
                          >
                            {card.priceRub > 0 ? `${card.priceRub.toLocaleString("ru-RU")} ₽` : "Бесплатно"}
                          </div>
                        </div>

                        <a
                          href={card.paymentUrl || card.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!card.paymentUrl && card.kind === "course" && card.courseId && onOpenStudentCourse) {
                              e.preventDefault();
                              onOpenStudentCourse(card.courseId);
                            }
                          }}
                          style={{
                            padding: "10px 18px",
                            borderRadius: 10,
                            background: colors.accentGradient,
                            color: "#ffffff",
                            textDecoration: "none",
                            fontSize: "0.86rem",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            boxShadow: "0 4px 12px rgba(15, 118, 110, 0.22)",
                          }}
                        >
                          <span>
                            {card.kind === "course"
                              ? card.priceRub > 0
                                ? "Записаться на курс →"
                                : "Открыть курс →"
                              : card.kind === "webinar"
                                ? "Участвовать в эфире →"
                                : "Смотреть запись →"}
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 5. FACULTY & INSTRUCTORS SECTION */}
      {!isEmbed && (
        <section
          id="teachers"
          style={{
            padding: "60px 20px",
            background: colors.bg,
            borderTop: `1px solid ${colors.border}`,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isDark ? "#2dd4bf" : "#0f766e",
                }}
              >
                👥 Преподавательский состав
              </span>
              <h2 style={{ margin: "6px 0 10px 0", fontSize: "1.85rem", fontWeight: 800, color: colors.textPrimary }}>
                Преподаватели и ведущие супервизоры
              </h2>
              <p style={{ margin: 0, fontSize: "0.92rem", color: colors.textSecondary, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
                Практикующие психологи, клинические специалисты и супервизоры с многолетним стажем работы с реальными клиентами.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              {DEFAULT_TEACHERS.map((teacher) => (
                <div
                  key={teacher.id}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: "22px 20px",
                    boxShadow: colors.shadow,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: colors.accentLight,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.6rem",
                          border: `1px solid ${colors.accentBorder}`,
                        }}
                      >
                        {teacher.avatarIcon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "1rem", color: colors.textPrimary }}>
                          {teacher.name}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: colors.accent, fontWeight: 700 }}>
                          {teacher.experience}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: colors.textPrimary, marginBottom: 6 }}>
                      {teacher.role}
                    </div>

                    <p style={{ margin: 0, fontSize: "0.82rem", color: colors.textSecondary, lineHeight: 1.5 }}>
                      {teacher.bio}
                    </p>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${colors.borderLight}` }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: colors.tagBg,
                        color: colors.textSecondary,
                      }}
                    >
                      🏷️ {teacher.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. HOW LEARNING WORKS (4 STEPS) */}
      {!isEmbed && (
        <section
          id="how-it-works"
          style={{
            padding: "60px 20px",
            background: colors.pageBg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isDark ? "#2dd4bf" : "#0f766e",
                }}
              >
                🧭 Простой и прозрачный процесс
              </span>
              <h2 style={{ margin: "6px 0 10px 0", fontSize: "1.85rem", fontWeight: 800, color: colors.textPrimary }}>
                Как проходит обучение
              </h2>
              <p style={{ margin: 0, fontSize: "0.92rem", color: colors.textSecondary }}>
                От выбора программы до получения официального сертификата
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {[
                {
                  step: "01",
                  title: "Выбор программы",
                  desc: "Изучите каталог курсов и расписание эфиров, выберите подходящее направление для вашей практики.",
                },
                {
                  step: "02",
                  title: "Прямая оплата",
                  desc: "Оплатите участие напрямую автору через официальный эквайринг школы без скрытых комиссий.",
                },
                {
                  step: "03",
                  title: "Мгновенный доступ",
                  desc: "Получите персональный код доступа и войдите в учебный кабинет со всеми лекциями и материалами.",
                },
                {
                  step: "04",
                  title: "Сертификат и супервизия",
                  desc: "Сдавайте практические задания, участвуйте в супервизиях и получите официальный сертификат.",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: colors.panelBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: "24px 20px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: 900,
                      color: isDark ? "#2dd4bf" : colors.accent,
                      opacity: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    {s.step}
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem", fontWeight: 800, color: colors.textPrimary }}>
                    {s.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.84rem", color: colors.textSecondary, lineHeight: 1.5 }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. REVIEWS & TESTIMONIALS */}
      {!isEmbed && (
        <section
          id="reviews"
          style={{
            padding: "60px 20px",
            background: colors.bg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isDark ? "#2dd4bf" : "#0f766e",
                }}
              >
                💬 Обратная связь
              </span>
              <h2 style={{ margin: "6px 0 10px 0", fontSize: "1.85rem", fontWeight: 800, color: colors.textPrimary }}>
                Отзывы практикующих психологов
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {DEFAULT_REVIEWS.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: "24px 22px",
                    boxShadow: colors.shadow,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, color: "#f59e0b", fontSize: "0.95rem" }}>
                      {"★".repeat(rev.rating)}
                    </div>
                    <p style={{ margin: "0 0 16px 0", fontSize: "0.88rem", color: colors.textPrimary, lineHeight: 1.6, fontStyle: "italic" }}>
                      «{rev.text}»
                    </p>
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.borderLight}`, paddingTop: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem", color: colors.textPrimary }}>
                      {rev.author}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: colors.textSecondary }}>
                      {rev.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. FAQ ACCORDION SECTION */}
      {!isEmbed && (
        <section
          id="faq"
          style={{
            padding: "60px 20px",
            background: colors.pageBg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ maxWidth: 840, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <span
                style={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isDark ? "#2dd4bf" : "#0f766e",
                }}
              >
                ❓ Ответы на частые вопросы
              </span>
              <h2 style={{ margin: "6px 0 10px 0", fontSize: "1.85rem", fontWeight: 800, color: colors.textPrimary }}>
                Часто задаваемые вопросы
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {DEFAULT_FAQS.map((faq) => {
                const isOpen = expandedFaq === faq.id;
                return (
                  <div
                    key={faq.id}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${isOpen ? colors.accentBorder : colors.border}`,
                      background: colors.cardBg,
                      overflow: "hidden",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : faq.id)}
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: colors.textPrimary }}>
                        {faq.question}
                      </span>
                      <span
                        style={{
                          fontSize: "1.1rem",
                          color: colors.accent,
                          transform: isOpen ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        ↓
                      </span>
                    </button>

                    {isOpen && (
                      <div
                        style={{
                          padding: "0 20px 18px 20px",
                          fontSize: "0.88rem",
                          color: colors.textSecondary,
                          lineHeight: 1.6,
                        }}
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 9. PROMO BANNER -> PSYCHOLOGIST WORKSPACE */}
      {showPsychologistPromo && (
        <section style={{ padding: "30px 20px", background: colors.bg }}>
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "20px 26px",
              borderRadius: 16,
              background: isDark
                ? "linear-gradient(135deg, rgba(15, 118, 110, 0.25) 0%, rgba(79, 70, 229, 0.22) 100%)"
                : "linear-gradient(135deg, #f0fdfa 0%, #eef2ff 100%)",
              border: `1px solid ${isDark ? "rgba(20, 184, 166, 0.4)" : "#99f6e4"}`,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              boxShadow: colors.shadow,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: "1rem", color: colors.textPrimary, marginBottom: 4 }}>
                🚀 Вы практикующий психолог или руководитель учебного центра?
              </div>
              <div style={{ fontSize: "0.85rem", color: colors.textSecondary, maxWidth: 700 }}>
                Откройте свой защищённый Рабочий кабинет IDA: защищённая видеосвязь без Zoom, база клиентов Local-First, протоколы сессий и собственная онлайн-студия курсов со 100% сохранением оплат.
              </div>
            </div>

            <a
              href={partnerRef ? `https://ida-psy.pro/?ref=${encodeURIComponent(partnerRef)}` : "https://ida-psy.pro"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (onOpenPsychologistWorkspace) {
                  e.preventDefault();
                  onOpenPsychologistWorkspace();
                }
              }}
              style={{
                padding: "11px 22px",
                borderRadius: 10,
                background: colors.accentGradient,
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "0.88rem",
                fontWeight: 800,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)",
              }}
            >
              Открыть кабинет психолога →
            </a>
          </div>
        </section>
      )}

      {/* 10. MODERN FOOTER */}
      <footer
        style={{
          background: isDark ? "#04070d" : "#0f172a",
          color: "#94a3b8",
          padding: "48px 20px 32px 20px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 32,
            marginBottom: 36,
          }}
        >
          {/* Col 1: Brand & Desc */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: colors.accentGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                🏛️
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#f8fafc" }}>
                {schoolDisplayName}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.55 }}>
              Официальная платформа практического психологического образования, живых супервизий и курсов повышения квалификации.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#f8fafc", marginBottom: 12 }}>
              Разделы школы
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
              <li>
                <a
                  href="#catalog"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("catalog");
                  }}
                  style={{ color: "#94a3b8", textDecoration: "none" }}
                >
                  Каталог курсов и вебинаров
                </a>
              </li>
              <li>
                <a
                  href="#advantages"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("advantages");
                  }}
                  style={{ color: "#94a3b8", textDecoration: "none" }}
                >
                  Преимущества обучения
                </a>
              </li>
              <li>
                <a
                  href="#teachers"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("teachers");
                  }}
                  style={{ color: "#94a3b8", textDecoration: "none" }}
                >
                  Преподаватели и супервизоры
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection("faq");
                  }}
                  style={{ color: "#94a3b8", textDecoration: "none" }}
                >
                  Вопросы и ответы
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Student Cabinet Entrance */}
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#f8fafc", marginBottom: 12 }}>
              Кабинет студента
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.82rem", lineHeight: 1.5 }}>
              Войдите по вашему персональному коду доступа из письма или Email.
            </p>
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(20, 184, 166, 0.4)",
                background: "rgba(20, 184, 166, 0.15)",
                color: "#2dd4bf",
                fontSize: "0.82rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              🔑 Войти в мои курсы
            </button>
          </div>
        </div>

        {/* Legal Disclaimer & Copyright */}
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            paddingTop: 20,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: "0.76rem",
          }}
        >
          <div>
            © {new Date().getFullYear()} {schoolDisplayName}. Все права защищены.
          </div>
          <div style={{ color: "#64748b" }}>
            Платформа работает на базе защищённых технологий IDA (Local-First LMS & WebRTC). Прямой приём оплат.
          </div>
        </div>
      </footer>

      {/* 11. STUDENT LOGIN MODAL */}
      {showLoginModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 13, 22, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowLoginModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 20,
              background: colors.cardBg,
              border: `1.5px solid ${colors.border}`,
              padding: "28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.3rem" }}>🔑</span>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: colors.textPrimary }}>
                  Вход в кабинет студента
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: colors.textSecondary,
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 18px 0", fontSize: "0.85rem", color: colors.textSecondary, lineHeight: 1.5 }}>
              Введите ваш персональный код доступа из письма об оплате (например, <code>st-e9x1</code>) или Email, указанный при регистрации.
            </p>

            <form onSubmit={handleStudentLoginSubmit}>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                placeholder="Код доступа (например, st-e9x1) или Email"
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${colors.border}`,
                  background: colors.panelBg,
                  color: colors.textPrimary,
                  fontSize: "0.92rem",
                  marginBottom: 12,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />

              {loginError && (
                <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 12 }}>
                  ⚠️ {loginError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.textSecondary,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    border: "none",
                    background: colors.accentGradient,
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)",
                  }}
                >
                  Войти в мои курсы →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * КОНСТРУКТОР-ГЕНЕРАТОР ВИДЖЕТА АФИШИ И ВИТРИНЫ ДЛЯ САЙТОВ ШКОЛ
 * ========================================================================== */

export interface AcademyAfishaGeneratorProps {
  defaultSchoolName?: string;
  initialMode?: AfishaWidgetMode;
  initialSingleItemId?: string;
  theme?: "light" | "dark";
  onOpenStudentCourse?: (courseId: string, studentCode?: string) => void;
  onOpenPsychologistWorkspace?: () => void;
}

export function AcademyAfishaGenerator({
  defaultSchoolName = "Академия практической психологии",
  initialMode = "school",
  initialSingleItemId = "",
  theme = "light",
  onOpenStudentCourse,
  onOpenPsychologistWorkspace,
}: AcademyAfishaGeneratorProps) {
  const isDark = theme === "dark";
  const [publishScenario, setPublishScenario] = useState<"no_site" | "embed_site">("no_site");
  const [widgetMode, setWidgetMode] = useState<AfishaWidgetMode>(initialMode);
  const [schoolName, setSchoolName] = useState<string>(defaultSchoolName);
  const [selectedTopic, setSelectedTopic] = useState<string>("cbt_anxiety");
  const [selectedSingleId, setSelectedSingleId] = useState<string>(initialSingleItemId);
  const [paymentGateway, setPaymentGateway] = useState<string>("ЮKassa / СБП (Прямая оплата на счёт школы)");
  const [partnerRef, setPartnerRef] = useState<string>("school-partner");
  const [widgetTheme, setWidgetTheme] = useState<"light" | "dark">(theme);
  const [showStudentLogin, setShowStudentLogin] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const { localItems } = useMemo(() => loadUnifiedAfishaItems(schoolName), [schoolName]);

  const generatorAvailableTopics = useMemo(() => {
    const map = new Map<string, AfishaTopicOption>();
    PSYCHOLOGY_TOPICS.forEach((t) => map.set(t.id, t));
    localItems.forEach((card) => {
      if (card.topicTag && card.topicTag !== "all" && !map.has(card.topicTag)) {
        map.set(card.topicTag, {
          id: card.topicTag,
          label: card.topicTag,
          icon: "🏷️",
        });
      }
    });
    return Array.from(map.values());
  }, [localItems]);

  useEffect(() => {
    if (initialSingleItemId) {
      setWidgetMode("single");
      setSelectedSingleId(initialSingleItemId);
    }
  }, [initialSingleItemId]);

  useEffect(() => {
    if (!selectedSingleId && localItems.length > 0) {
      setSelectedSingleId(localItems[0].id);
    }
  }, [localItems, selectedSingleId]);

  const embedDirectUrl = useMemo(() => {
    const origin = getBaseOrigin();
    const params = new URLSearchParams();
    params.set("embed_afisha", "1");
    params.set("afisha_mode", widgetMode);
    if (schoolName.trim()) {
      params.set("school", slugifyCenterId(schoolName.trim()));
    }
    if (widgetMode === "topic") params.set("topic", selectedTopic);
    if (widgetMode === "single" && selectedSingleId) params.set("item", selectedSingleId);
    if (paymentGateway.trim()) params.set("gateway", paymentGateway.trim());
    if (partnerRef.trim()) params.set("ref", partnerRef.trim());
    params.set("theme", widgetTheme);
    params.set("student_login", showStudentLogin ? "1" : "0");
    return `${origin}/?${params.toString()}`;
  }, [widgetMode, schoolName, selectedTopic, selectedSingleId, paymentGateway, partnerRef, widgetTheme, showStudentLogin]);

  const publicDirectPageUrl = useMemo(() => {
    const origin = getBaseOrigin();
    const params = new URLSearchParams();
    params.set("mode", "afisha");
    if (schoolName.trim()) {
      params.set("school", slugifyCenterId(schoolName.trim()));
    }
    if (widgetMode === "single" && selectedSingleId) params.set("item", selectedSingleId);
    if (widgetMode === "topic") params.set("topic", selectedTopic);
    return `${origin}/?${params.toString()}`;
  }, [widgetMode, schoolName, selectedSingleId, selectedTopic]);

  const embedHtmlSnippet = useMemo(() => {
    return `<!-- Витрина курсов, вебинаров и Вход для студентов (${schoolName}) -->
<div id="ida-academy-afisha-widget" style="width: 100%; min-height: 700px;">
  <iframe
    src="${embedDirectUrl}"
    style="width: 100%; min-height: 720px; border: none; border-radius: 16px; overflow: hidden;"
    allow="fullscreen; clipboard-write; encrypted-media"
    loading="lazy"
    title="Витрина курсов и вебинаров — ${schoolName}"
  ></iframe>
</div>`;
  }, [embedDirectUrl, schoolName]);

  const colors = {
    bg: isDark ? "#0f172a" : "#ffffff",
    cardBg: isDark ? "#131d31" : "#ffffff",
    panelBg: isDark ? "#1e293b" : "#f8fafc",
    border: isDark ? "rgba(255, 255, 255, 0.12)" : "#cbd5e1",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#475569",
    accent: "#0f766e",
    accentHover: "#115e59",
    accentBg: isDark ? "rgba(20, 184, 166, 0.18)" : "#f0fdfa",
    accentBorder: isDark ? "rgba(20, 184, 166, 0.35)" : "#99f6e4",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Configuration Card */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: "1.15rem", fontWeight: 700, color: colors.textPrimary }}>
              Витрина и сайт школы
            </h1>
            <p style={{ margin: 0, fontSize: "0.82rem", color: colors.textSecondary }}>
              Публичная страница с курсами, вебинарами и входом для студентов.
            </p>
          </div>

          {/* Scenario Segmented Switcher */}
          <div
            style={{
              display: "inline-flex",
              background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
              padding: 3,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setPublishScenario("no_site")}
              style={{
                border: "none",
                background: publishScenario === "no_site" ? (isDark ? "#334155" : "#ffffff") : "transparent",
                color: publishScenario === "no_site" ? colors.textPrimary : colors.textSecondary,
                fontWeight: publishScenario === "no_site" ? 600 : 400,
                fontSize: "0.78rem",
                padding: "5px 12px",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: publishScenario === "no_site" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              🔗 Ссылка (Telegram / Taplink)
            </button>
            <button
              type="button"
              onClick={() => setPublishScenario("embed_site")}
              style={{
                border: "none",
                background: publishScenario === "embed_site" ? (isDark ? "#334155" : "#ffffff") : "transparent",
                color: publishScenario === "embed_site" ? colors.textPrimary : colors.textSecondary,
                fontWeight: publishScenario === "embed_site" ? 600 : 400,
                fontSize: "0.78rem",
                padding: "5px 12px",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: publishScenario === "embed_site" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              💻 Виджет на сайт (Tilda / WP)
            </button>
          </div>
        </div>

        {/* Customizer Controls */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            padding: "14px",
            borderRadius: 8,
            background: colors.panelBg,
            border: `1px solid ${colors.border}`,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
              Что отображать:
            </label>
            <select
              value={widgetMode}
              onChange={(e) => setWidgetMode(e.target.value as AfishaWidgetMode)}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.textPrimary,
                fontSize: "0.8rem",
              }}
            >
              <option value="school">Вся витрина (Курсы + Эфиры)</option>
              <option value="single">Один курс или вебинар</option>
              <option value="topic">Подборка по теме</option>
            </select>

            {widgetMode === "topic" && (
              <div style={{ marginTop: 6 }}>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.textPrimary,
                    fontSize: "0.78rem",
                  }}
                >
                  {generatorAvailableTopics.filter((t) => t.id !== "all").map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {widgetMode === "single" && localItems.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <select
                  value={selectedSingleId}
                  onChange={(e) => setSelectedSingleId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.textPrimary,
                    fontSize: "0.78rem",
                  }}
                >
                  {localItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
              Название школы:
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Название вашей школы"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.textPrimary,
                fontSize: "0.8rem",
                boxSizing: "border-box",
                marginBottom: 6,
              }}
            />
            <select
              value={paymentGateway}
              onChange={(e) => setPaymentGateway(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.textPrimary,
                fontSize: "0.78rem",
              }}
            >
              <option value="ЮKassa / СБП (Прямая оплата на счёт школы)">ЮKassa / СБП</option>
              <option value="Prodamus (Платёжная страница школы)">Prodamus</option>
              <option value="Т-Касса / Тинькофф (Расчётный счёт ИП/ООО)">Т-Банк / Касса</option>
              <option value="">Не указывать</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
              Оформление:
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: colors.textPrimary, marginBottom: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showStudentLogin}
                onChange={(e) => setShowStudentLogin(e.target.checked)}
              />
              <span>Кнопка «Вход студента»</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.74rem", color: colors.textSecondary }}>Тема:</span>
              <button
                type="button"
                onClick={() => setWidgetTheme("light")}
                style={{
                  padding: "3px 8px",
                  borderRadius: 5,
                  border: `1px solid ${widgetTheme === "light" ? colors.accent : colors.border}`,
                  background: widgetTheme === "light" ? colors.accent : colors.bg,
                  color: widgetTheme === "light" ? "#fff" : colors.textSecondary,
                  fontSize: "0.74rem",
                  cursor: "pointer",
                }}
              >
                ☀️ Светлая
              </button>
              <button
                type="button"
                onClick={() => setWidgetTheme("dark")}
                style={{
                  padding: "3px 8px",
                  borderRadius: 5,
                  border: `1px solid ${widgetTheme === "dark" ? colors.accent : colors.border}`,
                  background: widgetTheme === "dark" ? colors.accent : colors.bg,
                  color: widgetTheme === "dark" ? "#fff" : colors.textSecondary,
                  fontSize: "0.74rem",
                  cursor: "pointer",
                }}
              >
                🌙 Тёмная
              </button>
            </div>
          </div>
        </div>

        {/* Output Action Box */}
        {publishScenario === "no_site" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: colors.panelBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            <input
              readOnly
              value={publicDirectPageUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                background: colors.bg,
                color: colors.textPrimary,
                fontFamily: "monospace",
                fontSize: "0.8rem",
              }}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(publicDirectPageUrl);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2500);
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: copiedUrl ? "#059669" : colors.accent,
                color: "#ffffff",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {copiedUrl ? "✓ Скопировано" : "Скопировать"}
            </button>
            <a
              href={publicDirectPageUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.textPrimary,
                fontSize: "0.8rem",
                fontWeight: 600,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Открыть ↗
            </a>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: colors.panelBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: colors.textSecondary }}>
                HTML-код для вставки (Tilda T123 / WordPress / Bitrix):
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(embedHtmlSnippet);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2500);
                }}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: copiedCode ? "#059669" : colors.accent,
                  color: "#ffffff",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copiedCode ? "✓ Код скопирован" : "Скопировать код"}
              </button>
            </div>
            <textarea
              readOnly
              rows={3}
              value={embedHtmlSnippet}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.textPrimary,
                fontFamily: "monospace",
                fontSize: "0.76rem",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}
      </div>

      {/* Live Interactive Preview */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "20px",
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: colors.textPrimary }}>
            Предпросмотр витрины
          </h2>
        </div>

        <AcademyAfishaView
          mode={widgetMode}
          schoolNameFilter={schoolName}
          topicFilter={widgetMode === "topic" ? selectedTopic : "all"}
          singleItemId={widgetMode === "single" ? selectedSingleId : undefined}
          theme={widgetTheme}
          showStudentLogin={showStudentLogin}
          showPsychologistPromo={true}
          paymentGatewayLabel={paymentGateway || undefined}
          partnerRef={partnerRef}
          isEmbed={false}
          onOpenStudentCourse={onOpenStudentCourse}
          onOpenPsychologistWorkspace={onOpenPsychologistWorkspace}
        />
      </div>
    </div>
  );
}
