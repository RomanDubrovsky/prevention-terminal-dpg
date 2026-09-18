import { isCommercialOrg } from "./case_meta.ts";
import { isTerminalModuleEnabled } from "./terminal_config.ts";
import type { TerminalConfig } from "./terminal_config.ts";
import { t } from "./i18n.ts";

export type SpecialistWorkspaceView =
  | "dashboard"
  | "inbox"
  | "calendar"
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
  | "ida_clients"
  | "my_profile"
  | "feedback"
  | "video_room"
  | "settings";

export type ManagerWorkspaceView = "dashboard" | "inbox" | "leads" | "specialists" | "users" | "ai_consultant" | "academy" | "feedback" | "settings" | "analytical_report";

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
  | "person"
  | "feedback"
  | "video"
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
}

const WORK_NAV: WorkspaceNavItem[] = [
  // --- Top Focus Tools ---
  { id: "dashboard", label: t('Дашборд', 'Dashboard'), icon: "dashboard", group: "work" },
  { id: "inbox", label: t('Входящие', 'Inbox'), icon: "inbox", group: "work", highlightCluster: true },
  { id: "calendar", label: t('Календарь', 'Calendar'), icon: "calendar", group: "work" },
  { id: "ai_consultant", label: t('ИИ-Помощник', 'AI Assistant'), icon: "ai", group: "work", aiCluster: true },
  { id: "registry", label: t('Реестр', 'Registry'), icon: "registry", group: "work" },

  // --- Purple Cluster (Cases & Workflows) ---
  { id: "case_workspace", label: t('Кейсы', 'Cases'), icon: "cases", group: "work", purpleCluster: true },
  { id: "observations", label: t('Журнал наблюдений', 'Observations'), icon: "observations", group: "work", purpleCluster: true },
  { id: "consultations", label: t('Консультации', 'Consultations'), icon: "consultations", group: "work", purpleCluster: true },
  { id: "video_room", label: t('Видео-сессии', 'Video Sessions'), icon: "video", group: "work", purpleCluster: true },
  { id: "ipr", label: t('ИПР', 'ISP'), icon: "ipr", group: "work", purpleCluster: true },
  { id: "group_work", label: t('Групповая работа', 'Group Work'), icon: "group", group: "work", purpleCluster: true },
  { id: "safe_environment", label: t('Безопасная среда', 'Safe Environment'), icon: "safety", group: "work", purpleCluster: true },

  // --- Reports, Commercial Workload & Learning ---
  { id: "analytical_report", label: t('Годовой отчет', 'Annual Report'), icon: "analytical_report", group: "work" },
  { id: "workload", label: t('Нагрузка', 'Workload'), icon: "workload", group: "work" },
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
  observations: ["ipr", "reception_journal"],
  calendar: ["consultation_journal", "reception_journal"],
  case_workspace: "reception_journal",
  consultations: ["consultation_journal", "reception_journal"],
  video_room: ["consultation_journal", "reception_journal"],
  ipr: "ipr",
  group_work: "group_sessions",
  safe_environment: "safe_environment",
  ai_consultant: "ai_assistant",
};

function isModuleEnabled(cfg: TerminalConfig, id: string): boolean {
  return isTerminalModuleEnabled(cfg, id);
}

function navViewEnabled(cfg: TerminalConfig, view: SpecialistWorkspaceView): boolean {
  const gate = NAV_MODULE_GATE[view];
  if (!gate) return true;
  const ids = Array.isArray(gate) ? gate : [gate];
  return ids.some((id) => isModuleEnabled(cfg, id));
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
      if (item.id === "registry") {
        mapped = {
          ...item,
          label: t('Реестр', 'Registry')
        };
      }
      if (item.id === "ai_consultant") {
        mapped = { ...item, locked: aiLocked };
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
  
  const items: WorkspaceNavItem[] = [
    { id: "dashboard", label: isTerritorialAuth ? t('Макро-дашборд', 'Macro-Dashboard') : t('Дашборд', 'Dashboard'), icon: "dashboard", group: "work" },
  ];
  
  if (!isComm) {
    items.push({ id: "analytical_report", label: t('Отчетность (Ф10/11)', 'Reporting'), icon: "report", group: "work" });
  }

  if (isComm) {
    items.push({ id: "leads", label: t('Реестр заявок', 'Leads Registry'), icon: "registry", group: "work" });
  }
  
  if (!isTerritorialAuth) {
    items.push({ id: "users", label: t('Пользователи', 'Users'), icon: "person", group: "work" });
    items.push({ id: "specialists", label: t('Специалисты', 'Specialists'), icon: "cases", group: "work" });
  }
  
  if (cfg ? isTerminalModuleEnabled(cfg, "ai_assistant") : true) {
    items.push({ id: "ai_consultant", label: t('ИИ-Помощник', 'AI Assistant'), icon: "ai", group: "work", aiCluster: true, locked: aiLocked });
  }
  // IDA Companion clients — скрыто до завершения доработки
  // if (cfg ? isCommercialOrg(cfg as any) : false) {
  //   items.push({ id: "ida_clients", label: t('Клиенты IDA', 'IDA Clients'), icon: "person", group: "system" });
  // }
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
