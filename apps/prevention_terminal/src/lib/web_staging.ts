/** Browser staging on prevention.school — no Tauri, no master password. */

export function isWebStaging(): boolean {
  return import.meta.env.VITE_TERMINAL_STAGING === "true";
}

const STORAGE_KEY = "prevention_terminal_staging_v1";
const AI_PREVIEW_KEY = "prevention_terminal_staging_ai_preview";

export const STAGING_AI_PREVIEW_EVENT = "prevention-terminal-staging-ai-preview";

export interface StagingStore {
  unlocked: boolean;
  installationMeta: Record<string, unknown> | null;
  orgProfile: Record<string, unknown> | null;
  specialistProfile: Record<string, unknown> | null;
  terminalConfig: Record<string, unknown> | null;
  sitePortal: Record<string, unknown> | null;
  cases: Record<string, unknown>[];
  sessionRecords: Record<string, unknown>[];
  workLog: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  groupSessions: Record<string, unknown>[];
  workEntries: Record<string, unknown>[];
  organizationPrograms: Record<string, unknown>[];
  iprs: Record<string, unknown>[];
  iprSteps: Record<string, unknown>[];
  caseAliases: Record<string, unknown>[];
  /** Staging / demo inbox leads (web only). */
  leads?: Record<string, unknown>[];
  calendarSlots?: Record<string, unknown>[];
}

function emptyStore(): StagingStore {
  return {
    unlocked: true,
    installationMeta: null,
    orgProfile: null,
    specialistProfile: null,
    terminalConfig: null,
    sitePortal: null,
    cases: [],
    sessionRecords: [],
    workLog: [],
    requests: [],
    groupSessions: [],
    workEntries: [],
    organizationPrograms: [],
    iprs: [],
    iprSteps: [],
    caseAliases: [],
    leads: [],
    calendarSlots: [],
  };
}

export function readStagingStore(): StagingStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

export function writeStagingStore(store: StagingStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function resetStagingStore(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Clear staging data and reopen onboarding (keeps ?entry= / ?demo= from URL). */
export function resetStagingSetup(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(AI_PREVIEW_KEY);
  try {
    localStorage.removeItem("prevention_terminal_demo_flag");
    localStorage.removeItem("prevention_terminal_demo_version");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export function readStagingAiPreview(): boolean {
  if (!isWebStaging() || typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(AI_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStagingAiPreview(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AI_PREVIEW_KEY, enabled ? "1" : "0");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STAGING_AI_PREVIEW_EVENT));
  }
}
