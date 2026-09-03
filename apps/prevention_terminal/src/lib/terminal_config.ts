import modulesJson from "../config/terminal_modules.json" with { type: "json" };
import type { OrgKind } from "./taxonomy.ts";

export type TerminalMode = "specialist" | "manager";
export type OrgTypePreset = "education" | "preventive_public" | "commercial" | "";
export type WorkspacePreset = "manager" | "specialist" | "educator_lite";
export type SpecialistRoleChoice = "specialist" | "educator_lite";
export type ManagerScope = "institution" | "territorial";

export interface TerminalModuleDef {
  id: string;
  always_on?: boolean;
  paid?: boolean;
  school_only?: boolean;
  manager_only?: boolean;
  workspace_only?: boolean;
  specialist_only?: boolean;
  requires_registry?: boolean;
  educator_lite_default?: boolean;
  educator_lite_free?: boolean;
  school_default?: boolean;
  commercial_default?: boolean;
  title_ru: string;
  title_en: string;
  description_ru: string;
  description_en: string;
}

export interface TerminalConfig {
  terminal_user_id: string;
  edition: string;
  mode: TerminalMode;
  workspace_preset: WorkspacePreset;
  org_type: OrgTypePreset | null;
  manager_scope: ManagerScope | null;
  job_title: string;
  child_invite_code: string;
  parent_invite_code: string | null;
  parent_invite_in: string | null;
  child_invite_in: string | null;
  consumer_app: string | null;
  enabled_modules: Record<string, boolean>;
  registry_enabled: boolean;
  /** Opt-in: обезличенная месячная статистика для исследований. */
  research_contribution_enabled?: boolean;
  research_contribution_consented_at?: string | null;
  research_contribution_consent_version?: string | null;
  research_contribution_last_period_key?: string | null;
  registry_vault_initialized?: boolean;
  registry_recovery_key_hash?: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
  /** Contact email of the primary user for account recovery. */
  contact_email?: string | null;
  /** Optional: sync endpoint URLs */
  sync_endpoints?: string[];
  /** Optional: P2P secret */
  p2p_secret?: string;
  /** Optional: Custom checkout URL for Enterprise/B2B2C partners */
  partner_checkout_url?: string | null;
}

export interface TerminalConfigInput {
  edition: string;
  mode: TerminalMode;
  workspace_preset: WorkspacePreset;
  org_type: OrgTypePreset | null;
  manager_scope?: ManagerScope | null;
  job_title: string;
  child_invite_code: string;
  parent_invite_code: string | null;
  parent_invite_in: string | null;
  child_invite_in: string | null;
  consumer_app: string | null;
  enabled_modules: Record<string, boolean>;
  registry_enabled: boolean;
  /** Optional sync endpoints */
  sync_endpoints?: string[];
  /** Optional P2P secret */
  p2p_secret?: string;
  /** Contact email of the primary user (for cloud-based account recovery). */
  contact_email?: string | null;
  research_contribution_enabled?: boolean;
  research_contribution_consented_at?: string | null;
  research_contribution_consent_version?: string | null;
  research_contribution_last_period_key?: string | null;
  registry_vault_initialized?: boolean;
  registry_recovery_key_hash?: string | null;
  /** Optional: Custom checkout URL for Enterprise/B2B2C partners */
  partner_checkout_url?: string | null;
}

export const ORG_TYPE_PRESET_LABEL: Record<
  Exclude<OrgTypePreset, "">,
  { title: string; hint: string }
> = {
  education: {
    title: "Образовательная организация",
    hint: "Школы, колледжи, детские сады, вузы",
  },
  preventive_public: {
    title: "Иная гос. / мун. организация профилактики",
    hint: "Молодёжная политика, центры профилактики с подростками",
  },
  commercial: {
    title: "Коммерческий психологический центр",
    hint: "Частные услуги, IDA Kit",
  },
};

/** First onboarding fork (school vs commercial center). */
export const ONBOARDING_ORG_SEGMENT: Record<
  "education" | "commercial",
  { title: string; hint: string }
> = {
  education: {
    title: "Психологическая служба в системе образования",
    hint: "Школа, колледж, ДОУ, муниципальная или региональная служба в контуре образования",
  },
  commercial: {
    title: "Коммерческий психологический центр",
    hint: "Частная клиника, центр, сеть специалистов — IDA Kit и платные услуги",
  },
};

export const ONBOARDING_ORG_SEGMENT_OPTIONS = ["education", "commercial"] as const;

/** Step 2 — who uses the terminal (educator is not here; direct ?entry=educator). */
export type OnboardingProfileRole = "psychologist" | "director" | "territorial_admin";

export const ONBOARDING_PROFILE_ROLE_LABEL: Record<
  OnboardingProfileRole,
  { title: string; hintEducation: string; hintCommercial: string; jobTitleEducation: string; jobTitleCommercial: string }
> = {
  psychologist: {
    title: "Психолог",
    hintEducation:
      "образовательной или иной организации, осуществляющей профилактическую работу с детьми и молодежью: Рабочее место специалиста — журнал ведения приёма, защищённый реестр, ИИ-помощник в планировании и подготовке отчётности",
    hintCommercial: "Документооборот, ИИ-помощник, Отчётность",
    jobTitleEducation: "Педагог-психолог",
    jobTitleCommercial: "Психолог",
  },
  director: {
    title: "Руководитель",
    hintEducation:
      "Осуществляющей профилактическую работу с детьми и молодёжью: панель управления профилактической работой в организации",
    hintCommercial: "Мониторинг работы психологов",
    jobTitleEducation: "Директор",
    jobTitleCommercial: "Директор центра",
  },
  territorial_admin: {
    title: "Орган управления системой образования или иного ведомства, осуществляющего профилактику",
    hintEducation:
      "Панель управления профилактической работой на территории. Верификация источников данных осуществляется самими пользователями. Источники привязаны к административно-территориальному делению",
    hintCommercial: "",
    jobTitleEducation: "Координатор профилактики",
    jobTitleCommercial: "",
  },
};

export function profileRolesForOrgSegment(org: "education" | "commercial"): OnboardingProfileRole[] {
  return org === "education"
    ? ["psychologist", "director", "territorial_admin"]
    : ["psychologist", "director"];
}

export function managerScopeForProfileRole(role: OnboardingProfileRole): ManagerScope | null {
  if (role === "territorial_admin") return "territorial";
  if (role === "director") return "institution";
  return null;
}

/** Defaults applied when user picks a profile role (step 2). */
export interface OnboardingRolePreset {
  jobTitle: string;
  organizationPlaceholder: string;
  /** Prefill org name only when field is still empty. */
  organizationLabelIfEmpty: string;
  orgKind: OrgKind;
  weeklyHours: number;
}

const ONBOARDING_ROLE_PRESETS: Record<
  OnboardingProfileRole,
  Record<"education" | "commercial", OnboardingRolePreset>
> = {
  psychologist: {
    education: {
      jobTitle: "Педагог-психолог",
      organizationPlaceholder: "ГБОУ Школа №123",
      organizationLabelIfEmpty: "",
      orgKind: "combined_school",
      weeklyHours: 36,
    },
    commercial: {
      jobTitle: "Психолог",
      organizationPlaceholder: "Центр «Синхронизация»",
      organizationLabelIfEmpty: "",
      orgKind: "psych_support_center",
      weeklyHours: 30,
    },
  },
  director: {
    education: {
      jobTitle: "Директор",
      organizationPlaceholder: "ГБОУ Школа №123",
      organizationLabelIfEmpty: "",
      orgKind: "combined_school",
      weeklyHours: 0,
    },
    commercial: {
      jobTitle: "Директор центра",
      organizationPlaceholder: "Центр «Синхронизация»",
      organizationLabelIfEmpty: "",
      orgKind: "psych_support_center",
      weeklyHours: 0,
    },
  },
  territorial_admin: {
    education: {
      jobTitle: "Координатор профилактики",
      organizationPlaceholder: "Управление образования (муниципалитет / регион)",
      organizationLabelIfEmpty: "Управление образования",
      orgKind: "other",
      weeklyHours: 0,
    },
    commercial: {
      jobTitle: "Координатор профилактики",
      organizationPlaceholder: "Центр «Синхронизация»",
      organizationLabelIfEmpty: "",
      orgKind: "psych_support_center",
      weeklyHours: 0,
    },
  },
};

export function onboardingRolePreset(
  role: OnboardingProfileRole,
  org: "education" | "commercial",
): OnboardingRolePreset {
  return ONBOARDING_ROLE_PRESETS[role][org];
}

export const TERMINAL_MODULES = (modulesJson.modules as unknown) as Record<string, TerminalModuleDef>;

export function normalizeOrgTypePreset(raw: string | null | undefined): OrgTypePreset {
  if (raw === "government") return "education";
  if (raw === "education" || raw === "preventive_public" || raw === "commercial") return raw;
  return "";
}

export function isSchoolLikeOrg(orgType: OrgTypePreset | null): boolean {
  return orgType === "education" || orgType === "preventive_public";
}

export function inferManagerScope(
  orgType: OrgTypePreset | null,
  preset: WorkspacePreset,
  explicitScope?: ManagerScope | null,
): ManagerScope | null {
  if (preset !== "manager") return null;
  if (explicitScope === "institution" || explicitScope === "territorial") {
    return explicitScope;
  }
  if (orgType === "preventive_public") return "territorial";
  return "institution";
}

export function moduleList(): TerminalModuleDef[] {
  return Object.values(TERMINAL_MODULES);
}

/** Учитывает org_type: школьные модули (ИПР, «Безопасная среда») недоступны в commercial. */
export function isTerminalModuleEnabled(cfg: TerminalConfig, moduleId: string): boolean {
  const mod = TERMINAL_MODULES[moduleId];
  if (mod?.school_only && !isSchoolLikeOrg(cfg.org_type)) {
    return false;
  }
  const preset = inferWorkspacePreset(cfg);
  if (moduleId === "academy") {
    return cfg.enabled_modules?.[moduleId] === true;
  }
  if (preset === "manager" && (moduleId === "ai_assistant" || moduleId === "academy")) {
    return cfg.enabled_modules?.[moduleId] === true;
  }
  return cfg.enabled_modules?.[moduleId] !== false;
}

export function genInviteCode(prefix: string): string {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${part}`;
}

export function needsRoleStep(_mode: TerminalMode, _orgType: OrgTypePreset | null): boolean {
  return false;
}

const HIDDEN_ONBOARDING_MODULE_IDS = new Set([
  "ai_consultant_lite",
  "consumer_app_link",
  "reception_journal",
  "consultation_journal",
]);

const SITE_SETTINGS_MODULE_IDS = new Set([
  "embed_client_widget",
  "specialist_registration_widget",
  "specialist_iconostasis",
]);

export function moduleOfferedInOnboarding(
  preset: WorkspacePreset,
  mod: TerminalModuleDef,
  orgType?: OrgTypePreset | null,
): boolean {
  if (mod.always_on || HIDDEN_ONBOARDING_MODULE_IDS.has(mod.id)) {
    return false;
  }
  if (preset === "educator_lite" || preset === "specialist") return false;

  if (preset === "manager") {
    if (mod.specialist_only || mod.workspace_only || mod.manager_only) return false;
    if (orgType === "commercial") return Boolean(mod.commercial_default);
    if (isSchoolLikeOrg(orgType ?? null)) {
      return Boolean(mod.manager_only) || mod.id === "reporting_panel" || Boolean(mod.school_default);
    }
    return Boolean(mod.manager_only) || mod.id === "reporting_panel";
  }
  return false;
}

export function resolveWorkspacePreset(
  mode: TerminalMode,
  orgType: OrgTypePreset | null,
  roleChoice: SpecialistRoleChoice | null,
): WorkspacePreset {
  if (mode === "manager") return "manager";
  if (orgType === "commercial") return "specialist";
  if (roleChoice === "educator_lite") return "educator_lite";
  return "specialist";
}

export function inferWorkspacePreset(cfg: TerminalConfig): WorkspacePreset {
  const wp = cfg.workspace_preset;
  if (wp === "manager" || wp === "specialist" || wp === "educator_lite") return wp;
  if (cfg.mode === "manager") return "manager";
  const mods = cfg.enabled_modules || {};
  if (mods.ai_consultant_lite && !mods.consultation_journal && !mods.reception_journal) {
    return "educator_lite";
  }
  return "specialist";
}

export function isEducatorLite(cfg: TerminalConfig | null): boolean {
  if (!cfg) return false;
  return inferWorkspacePreset(cfg) === "educator_lite";
}

export function isManagerPreset(cfg: TerminalConfig | null): boolean {
  if (!cfg) return false;
  return inferWorkspacePreset(cfg) === "manager";
}

export function isTerritorialManager(cfg: TerminalConfig | null): boolean {
  if (!cfg) return false;
  return (
    inferWorkspacePreset(cfg) === "manager" &&
    (cfg.manager_scope === "territorial" || cfg.org_type === "preventive_public")
  );
}

export function defaultEnabledModules(
  mode: TerminalMode,
  orgType: OrgTypePreset | null,
  workspacePreset?: WorkspacePreset,
): Record<string, boolean> {
  const normalizedOrg = orgType ? normalizeOrgTypePreset(orgType) || orgType : null;
  const preset =
    workspacePreset ??
    resolveWorkspacePreset(mode, normalizedOrg, isSchoolLikeOrg(normalizedOrg) ? "specialist" : null);

  if (preset === "educator_lite") {
    return {
      reporting_panel: false,
      ai_consultant_lite: true,
      group_sessions: true,
      reception_journal: false,
      consultation_journal: false,
      ipr: false,
      consumer_app_link: false,
      embed_client_widget: false,
      specialist_registration_widget: false,
      specialist_iconostasis: false,
    };
  }

  const out: Record<string, boolean> = {};
  for (const mod of moduleList()) {
    if (mod.id === "ai_consultant_lite") {
      out[mod.id] = false;
      continue;
    }
    if (mod.id === "consumer_app_link") {
      out[mod.id] = false;
      continue;
    }
    if (SITE_SETTINGS_MODULE_IDS.has(mod.id)) {
      out[mod.id] = false;
      continue;
    }
    if (mod.manager_only && preset !== "manager") {
      out[mod.id] = false;
      continue;
    }
    if (mod.specialist_only && preset === "manager") {
      out[mod.id] = false;
      continue;
    }
    if (mod.workspace_only && preset === "manager") {
      out[mod.id] = false;
      continue;
    }
    if (mod.school_only && !isSchoolLikeOrg(normalizedOrg)) {
      out[mod.id] = false;
      continue;
    }
    if (preset === "manager" && (mod.id === "ai_assistant" || mod.id === "academy")) {
      out[mod.id] = false;
      continue;
    }
    out[mod.id] = true;
  }
  return out;
}

export function isTerminalConfigComplete(cfg: TerminalConfig | null): boolean {
  if (!cfg?.onboarding_complete) return false;
  if (!cfg.mode || !cfg.child_invite_code.trim()) return false;
  const preset = inferWorkspacePreset(cfg);
  if (preset === "manager" && !cfg.parent_invite_code?.trim()) return false;
  if (preset === "educator_lite") {
    return cfg.enabled_modules.ai_consultant_lite === true || cfg.enabled_modules.group_sessions === true;
  }
  return Object.values(cfg.enabled_modules).some(Boolean);
}

export function orgTypeToOrganizationType(orgType: OrgTypePreset | null): string {
  const normalized = orgType ? normalizeOrgTypePreset(orgType) || orgType : "";
  if (normalized === "education") return "school";
  if (normalized === "preventive_public") return "ngo";
  if (normalized === "commercial") return "psychological_center";
  return "private_practice";
}

export function moduleTitle(mod: TerminalModuleDef, locale: string): string {
  return locale.startsWith("ru") ? mod.title_ru : mod.title_en;
}

export function moduleDescription(mod: TerminalModuleDef, locale: string): string {
  return locale.startsWith("ru") ? mod.description_ru : mod.description_en;
}

export function modulesForPreset(preset: WorkspacePreset): string[] {
  if (preset === "educator_lite") return ["ai_consultant_lite", "group_sessions"];
  if (preset === "manager") {
    return moduleList()
      .filter((m) => m.manager_only || m.id === "reporting_panel")
      .map((m) => m.id);
  }
  return moduleList()
    .filter((m) => !m.manager_only && m.id !== "ai_consultant_lite")
    .map((m) => m.id);
}

export function presetLabel(preset: WorkspacePreset, locale: string): string {
  const ru: Record<WorkspacePreset, string> = {
    manager: "Дашборд руководителя",
    specialist: "Специалист (психолог)",
    educator_lite: "Педагог lite",
  };
  const en: Record<WorkspacePreset, string> = {
    manager: "Manager dashboard",
    specialist: "Specialist",
    educator_lite: "Educator lite",
  };
  return locale.startsWith("ru") ? ru[preset] : en[preset];
}

export const WEEKLY_HOURS_MAX = 168;

export function minutesToWeeklyHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function weeklyHoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}
