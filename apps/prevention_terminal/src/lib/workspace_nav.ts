import { isCommercialOrg } from "./case_meta.ts";
import { isTerminalModuleEnabled } from "./terminal_config.ts";
import type { TerminalConfig } from "./terminal_config.ts";
import { t } from "./i18n.ts";

export type SpecialistWorkspaceView =
  | "dashboard"
  | "calendar"
  | "case_workspace"
  | "registry"
  | "consultations"
  | "ipr"
  | "group_work"
  | "workload"
  | "analytical_report"
  | "safe_environment"
  | "ai_consultant"
  | "academy"
  | "my_profile"
  | "settings";

export type ManagerWorkspaceView = "dashboard" | "ai_consultant" | "academy" | "settings";

export type WorkspaceNavIconId =
  | "dashboard"
  | "calendar"
  | "cases"
  | "registry"
  | "consultations"
  | "ipr"
  | "group"
  | "workload"
  | "analytical_report"
  | "safety"
  | "ai"
  | "academy"
  | "person"
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
  /** Shown dimmed; click opens paywall instead of view. */
  locked?: boolean;
  /** Highlighted inside the primary tool cluster (green). */
  highlightCluster?: boolean;
  /** Highlighted inside the AI/Academy cluster (violet). */
  aiCluster?: boolean;
}

const WORK_NAV: WorkspaceNavItem[] = [
  { id: "dashboard", label: t('Дашборд', 'Dashboard'), icon: "dashboard", group: "work" },
  { id: "calendar", label: t('Календарь', 'Calendar'), icon: "calendar", group: "work" },
  { id: "registry", label: t('Реестр', 'Registry'), icon: "registry", group: "work" },
  { id: "case_workspace", label: t('Кейсы', 'Cases'), icon: "cases", group: "work", highlightCluster: true },
  { id: "consultations", label: t('Консультации', 'Consultations'), icon: "consultations", group: "work", highlightCluster: true },
  { id: "ipr", label: t('ИПР', 'ISP'), icon: "ipr", group: "work", highlightCluster: true },
  { id: "group_work", label: t('Групповая работа', 'Group Work'), icon: "group", group: "work", highlightCluster: true },
  { id: "safe_environment", label: t('Безопасная среда', 'Safe Environment'), icon: "safety", group: "work", highlightCluster: true },
  { id: "workload", label: t('Нагрузка', 'Workload'), icon: "workload", group: "work" },
  { id: "analytical_report", label: t('Годовой отчет', 'Annual Report'), icon: "analytical_report", group: "work" },
  { id: "ai_consultant", label: t('ИИ-Помощник', 'AI Assistant'), icon: "ai", group: "work", aiCluster: true },
  { id: "academy", label: t('Академия', 'Academy'), icon: "academy", group: "system", aiCluster: true },
];

const SETTINGS_NAV: WorkspaceNavItem = {
  id: "settings",
  label: t('Настройки', 'Settings'),
  icon: "settings",
  group: "system",
};

/** Связь вкладки меню с техническим модулем (галочки онбординга / настройки). */
const NAV_MODULE_GATE: Partial<Record<SpecialistWorkspaceView, string | string[]>> = {
  registry: ["ipr", "reception_journal"],
  calendar: ["consultation_journal", "reception_journal"],
  case_workspace: "reception_journal",
  consultations: ["consultation_journal", "reception_journal"],
  ipr: "ipr",
  group_work: "group_sessions",
  safe_environment: "safe_environment",
  academy: "academy",
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
      return navViewEnabled(cfg, item.id as SpecialistWorkspaceView);
    }).map((item) => {
      let mapped = item;
      if (item.id === "ai_consultant") {
        mapped = { ...item, locked: aiLocked };
      }
      if (item.id === "workload" && isComm) {
        mapped = { ...item, label: t('Учет и выплаты', 'Accounting and Payments') };
      }
      return mapped;
    }),
    SETTINGS_NAV,
  ];
}

export function buildManagerNav(opts?: { aiSubscriptionActive?: boolean }): WorkspaceNavItem[] {
  const aiLocked = opts?.aiSubscriptionActive === false;
  return [
    { id: "dashboard", label: t('Дашборд', 'Dashboard'), icon: "dashboard", group: "work" },
    { id: "ai_consultant", label: t('ИИ-Помощник', 'AI Assistant'), icon: "ai", group: "work", aiCluster: true, locked: aiLocked },
    { id: "academy", label: t('Академия', 'Academy'), icon: "academy", group: "system", aiCluster: true },
    SETTINGS_NAV,
  ];
}

export function isAiWorkspaceView(view: SpecialistWorkspaceView): boolean {
  return view === "ai_consultant";
}

export function defaultSpecialistView(): SpecialistWorkspaceView {
  return "dashboard";
}
