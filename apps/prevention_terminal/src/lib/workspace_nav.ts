import { isCommercialOrg } from "./case_meta.ts";
import { isTerminalModuleEnabled } from "./terminal_config.ts";
import type { TerminalConfig } from "./terminal_config.ts";
import { t } from "./i18n.ts";
import { isCorporateProduct } from "./terminal_product.ts";

export type SpecialistWorkspaceView =
  | "dashboard"
  | "inbox"
  | "calendar"
  | "webinars"
  | "case_workspace"
  | "registry"
  | "observations"
  | "consultations"
  | "ipr"
  | "group_work"
  | "workload"
  | "analytical_report"
  | "safe_environment"
  | "ai_consultant"
  | "academy"
  | "library"
  | "articles"
  | "ida_clients"
  | "my_profile"
  | "feedback"
  | "video_room"
  | "settings";

export type ManagerWorkspaceView =
  | "dashboard"
  | "inbox"
  | "leads"
  | "specialists"
  | "users"
  | "webinars"
  | "video_room"
  | "ai_consultant"
  | "academy"
  | "library"
  | "articles"
  | "feedback"
  | "settings"
  | "analytical_report"
  | "finances";

export type WorkspaceNavIconId =
  | "dashboard"
  | "inbox"
  | "calendar"
  | "cases"
  | "registry"
  | "observations"
  | "consultations"
  | "ipr"
  | "group"
  | "workload"
  | "analytical_report"
  | "safety"
  | "ai"
  | "academy"
  | "library"
  | "person"
  | "feedback"
  | "video"
  | "finances"
  | "globe"
  | "settings";

/** General chat bot only — expert/architect live inside work sections. */
export const AI_MODE_NAV: { id: SpecialistWorkspaceView; label: string; icon: WorkspaceNavIconId }[] = [
  { id: "ai_consultant", label: t('ИИ-Помощник', 'AI Assistant'), icon: "ai" },
];

export interface WorkspaceNavItem {
  id: SpecialistWorkspaceView | ManagerWorkspaceView;
  label: string;
  icon: WorkspaceNavIconId;
  group?: "work" | "ai" | "system";
  tier?: "primary" | "secondary" | "system";
  /** Shown dimmed; click opens paywall instead of view. */
  locked?: boolean;
  /** Highlighted inside the primary tool cluster (green). */
  highlightCluster?: boolean;
  /** Highlighted inside the AI/Academy cluster (violet). */
  aiCluster?: boolean;
  /** Highlighted inside the purple cluster (Cases to Safe Environment). */
  purpleCluster?: boolean;
  /** Badge count (e.g. unread messages). Shows red dot when > 0. */
  badge?: number;
}


const WORK_NAV: WorkspaceNavItem[] = [
  // --- Top Focus Tools ---
  { id: "dashboard", label: t('Дашборд', 'Dashboard'), icon: "dashboard", group: "work" },
  { id: "inbox", label: t('Входящие', 'Inbox'), icon: "inbox", group: "work", highlightCluster: true },
  { id: "calendar", label: t('Календарь', 'Calendar'), icon: "calendar", group: "work" },
  { id: "academy", label: t('Академия', 'Academy'), icon: "academy", group: "work" },
  { id: "library", label: t('Библиотека', 'Library'), icon: "library", group: "work" },
  { id: "ai_consultant", label: t('ИИ-Помощник', 'AI Assistant'), icon: "ai", group: "work", aiCluster: true },
  { id: "registry", label: t('Реестр', 'Registry'), icon: "registry", group: "work" },

  // --- Purple Cluster (Cases & Workflows) ---
  { id: "case_workspace", label: t('Кейсы', 'Cases'), icon: "cases", group: "work", purpleCluster: true },
  { id: "observations", label: t('Журнал наблюдений', 'Observations'), icon: "observations", group: "work", purpleCluster: true },
  { id: "consultations", label: t('Консультации', 'Consultations'), icon: "consultations", group: "work", purpleCluster: true },
  { id: "ipr", label: t('ИПР', 'ISP'), icon: "ipr", group: "work", purpleCluster: true },
  { id: "group_work", label: t('Групповая работа', 'Group Work'), icon: "group", group: "work", purpleCluster: true },
  { id: "safe_environment", label: t('Безопасная среда', 'Safe Environment'), icon: "safety", group: "work", purpleCluster: true },

  // --- Reports, Commercial Workload & Learning ---
  { id: "analytical_report", label: t('Отчетность', 'Reporting'), icon: "analytical_report", group: "work" },
  { id: "workload", label: t('Учет и выплаты', 'Accounting and Payments'), icon: "workload", group: "work" },
];

const FEEDBACK_NAV: WorkspaceNavItem = {
  id: "feedback",
  label: t('Обратная связь', 'Feedback'),
  icon: "feedback",
  group: "system",
};

const SETTINGS_NAV: WorkspaceNavItem = {
  id: "settings",
  label: t('Настройки', 'Settings'),
  icon: "settings",
  group: "system",
};

/** Связь вкладки меню с техническим модулем (галочки онбординга / настройки). */
const NAV_MODULE_GATE: Partial<Record<SpecialistWorkspaceView, string | string[]>> = {
  registry: ["ipr", "reception_journal"],
  observations: "observations",
  calendar: ["consultation_journal", "reception_journal"],
  case_workspace: "reception_journal",
  consultations: ["consultation_journal", "reception_journal"],
  video_room: ["consultation_journal", "reception_journal"],
  ipr: "ipr",
  group_work: "group_sessions",
  safe_environment: "safe_environment",
  ai_consultant: "ai_assistant",
};

export interface NavCustomModuleDef {
  id: SpecialistWorkspaceView;
  label: string;
  description: string;
  category: "main" | "purple" | "reports";
  schoolOnly?: boolean;
  commercialOnly?: boolean;
}

export const SPECIALIST_CUSTOMIZABLE_MODULES: NavCustomModuleDef[] = [
  // Основные разделы
  { id: "dashboard", label: "Дашборд", description: "Сводка дня, расписание, аналитика и фокус внимания", category: "main" },
  { id: "inbox", label: "Входящие", description: "Заявки, чаты с клиентами и системные уведомления", category: "main" },
  { id: "calendar", label: "Календарь", description: "Расписание консультаций, мероприятий и сессий", category: "main" },
  { id: "academy", label: "Академия", description: "Учебные курсы, видеолекции, эфиры и вебинары платформы", category: "main" },
  { id: "library", label: "Библиотека (Методфонд)", description: "Методический фонд, бланки, протоколы, гайды и дайджест", category: "main" },
  { id: "ai_consultant", label: "ИИ-Помощник", description: "ИИ-супервизор, генерация документов и подсказки", category: "main" },

  // Рабочий фиолетовый блок
  { id: "case_workspace", label: "Кейсы и реестр", description: "Карточки клиентов, электронные дела и сессии", category: "purple" },
  { id: "observations", label: "Журнал наблюдений", description: "Фиксация поведенческих маркеров и сигналов риска", category: "purple", schoolOnly: true },
  { id: "consultations", label: "Консультации", description: "Журнал индивидуальных приёмов и протоколов", category: "purple" },
  { id: "ipr", label: "ИПР (Маршрут)", description: "Индивидуальные программы развития и сопровождения", category: "purple", schoolOnly: true },
  { id: "group_work", label: "Групповая работа", description: "Тренинги, групповые занятия и мастер-классы", category: "purple" },
  { id: "safe_environment", label: "Безопасная среда", description: "Оценка психологического климата и безопасности", category: "purple", schoolOnly: true },

  // Дополнительно / Отчётность
  { id: "analytical_report", label: "Отчетность (Форма 5)", description: "Сводные государственные отчеты педагога-психолога", category: "reports", schoolOnly: true },
  { id: "workload", label: "Учет и выплаты", description: "Расчет часов, стоимости приемов и баланс специалиста", category: "reports", commercialOnly: true },
];

/** Возвращает дефолтный набор видимости разделов с учетом направления (школа или коммерция/IDA) */
export function getDefaultNavModules(isCommercial: boolean): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const item of SPECIALIST_CUSTOMIZABLE_MODULES) {
    if (isCommercial) {
      // Для коммерческой ветки исключаем школьные формы
      if (item.schoolOnly) {
        result[item.id] = false;
      } else {
        result[item.id] = true;
      }
    } else {
      // Для школы/госсектора исключаем коммерческий биллинг
      if (item.commercialOnly) {
        result[item.id] = false;
      } else {
        result[item.id] = true;
      }
    }
  }
  return result;
}

function navViewEnabled(cfg: TerminalConfig, view: SpecialistWorkspaceView): boolean {
  // 1. Проверяем точечный пользовательский флаг для конкретного пункта меню (если явно выключен):
  if (cfg.enabled_modules?.[view] === false) {
    return false;
  }

  // 2. Проверяем технические модули онбординга:
  const gate = NAV_MODULE_GATE[view];
  if (!gate) return true;
  const ids = Array.isArray(gate) ? gate : [gate];
  return ids.some((id) => isTerminalModuleEnabled(cfg, id));
}

export function buildSpecialistNav(
  cfg: TerminalConfig,
  _locale = "ru",
  opts?: { aiSubscriptionActive?: boolean },
): WorkspaceNavItem[] {
  const aiLocked = opts?.aiSubscriptionActive === false;
  const isComm = isCommercialOrg(cfg);
  
  return [
    ...WORK_NAV.filter((item) => {
      // "Accounting and Payments" (workload ID) should only show in commercial (IDA Kit)
      if (item.id === "workload" && !isComm) {
        return false;
      }
      // "Observations" should only show in school branch, hide for commercial (IDA Kit)
      if (item.id === "observations" && isComm) {
        return false;
      }
      // "Analytical Report" (Form 5) should only show in school branch, hide for commercial (IDA Kit)
      if (item.id === "analytical_report" && isComm) {
        return false;
      }
      return navViewEnabled(cfg, item.id as SpecialistWorkspaceView);
    }).map((item) => {
      let mapped = item;
      if (item.id === "academy") {
        mapped = {
          ...item,
          label: t('Академия', 'Academy'),
          icon: "academy",
        };
      }
      if (item.id === "library") {
        mapped = {
          ...item,
          label: t('Библиотека', 'Library'),
          icon: "library",
        };
      }
      if (item.id === "registry") {
        mapped = {
          ...item,
          label: t('Реестр', 'Registry')
        };
      }
      if (item.id === "ai_consultant") {
        mapped = { ...item, locked: aiLocked };
      }
      if (item.id === "my_profile") {
        mapped = { ...item, label: t('Анкета', 'Profile'), icon: "person" };
      }
      if (item.id === "workload" && isComm) {
        mapped = { ...item, label: t('Учет и выплаты', 'Accounting and Payments') };
      }
      return mapped;
    }),
    { ...FEEDBACK_NAV, tier: "system" as const },
    { ...SETTINGS_NAV, tier: "system" as const },
  ];
}

export function buildManagerNav(
  opts?: { aiSubscriptionActive?: boolean; commercial?: boolean; territorial?: boolean },
  cfg?: TerminalConfig,
): WorkspaceNavItem[] {
  const aiLocked = opts?.aiSubscriptionActive === false;
  const isComm = opts?.commercial || (cfg && cfg.org_type === "commercial");
  const isTerritorialAuth = opts?.territorial && !isComm;
  const isCorp = isCorporateProduct() || (typeof window !== "undefined" && window.location.hostname.includes("corporate-health"));
  
  const items: WorkspaceNavItem[] = [
    { 
      id: "dashboard", 
      label: isCorp 
        ? t('📊 Пульс компании и риски', '📊 Company Pulse & Risks')
        : isTerritorialAuth 
          ? t('Макро-дашборд', 'Macro-Dashboard') 
          : t('Дашборд', 'Dashboard'), 
      icon: "dashboard", 
      group: "work" 
    },
    { 
      id: "inbox", 
      label: isCorp ? t('📥 Запросы сотрудников (EAP)', '📥 EAP Requests') : t('Входящие', 'Inbox'), 
      icon: "inbox", 
      group: "work", 
      highlightCluster: true 
    },
  ];
  
  if (!isComm && !isCorp) {
    items.push({ id: "analytical_report", label: t('Отчетность (Ф10/11)', 'Reporting'), icon: "report" as any, group: "work" });
  }

  if (isComm || isCorp) {
    items.push({ 
      id: "leads", 
      label: isCorp ? t('Журнал обращений', 'Consultation Requests') : t('Реестр заявок', 'Leads Registry'), 
      icon: "registry", 
      group: "work" 
    });
    items.push({ 
      id: "finances", 
      label: isCorp ? t('💵 Бюджет и ROI программы', '💵 Wellbeing Budget & ROI') : t('Финансы и ДДС', 'Finances & Cash Flow'), 
      icon: "finances", 
      group: "work" 
    });
  }

  items.push({ 
    id: "academy", 
    label: isCorp ? t('🎓 Программы и воркшопы', '🎓 Programs & Workshops') : t('Академия', 'Academy'), 
    icon: "academy", 
    group: "work" 
  });
  items.push({ 
    id: "library", 
    label: isCorp ? t('📚 База знаний Wellbeing', '📚 Wellbeing KB') : t('Библиотека', 'Library'), 
    icon: "library", 
    group: "work" 
  });

  if (!isTerritorialAuth) {
    items.push({ 
      id: "users", 
      label: isCorp ? t('👥 Доступы и координаторы', '👥 Team & Access') : t('Пользователи', 'Users'), 
      icon: "person", 
      group: "work" 
    });
    items.push({ 
      id: "specialists", 
      label: isCorp ? t('🧑‍⚕️ Пул экспертов и психологов', '🧑‍⚕️ Psychologists & Experts') : t('Специалисты', 'Specialists'), 
      icon: "cases", 
      group: "work" 
    });
  }
  
  if (cfg ? isTerminalModuleEnabled(cfg, "ai_assistant") : true) {
    items.push({ 
      id: "ai_consultant", 
      label: isCorp ? t('ИИ-Аналитик Wellbeing', 'Wellbeing AI Analyst') : t('ИИ-Помощник', 'AI Assistant'), 
      icon: "ai", 
      group: "work", 
      aiCluster: true, 
      locked: aiLocked 
    });
  }
  items.push(FEEDBACK_NAV);
  items.push(SETTINGS_NAV);
  return items;
}

export function isAiWorkspaceView(view: SpecialistWorkspaceView): boolean {
  return view === "ai_consultant";
}

export function defaultSpecialistView(): SpecialistWorkspaceView {
  return "dashboard";
}
