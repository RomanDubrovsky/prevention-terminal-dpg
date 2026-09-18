/**
 * Lazy-loaded terminal module bundles (post-onboarding code splitting).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

import { inferWorkspacePreset, isTerminalModuleEnabled, type TerminalConfig } from "./terminal_config.ts";

export type ModuleBundleId =
  | "reporting_panel"
  | "reception_journal"
  | "consultation_journal"
  | "ipr"
  | "consumer_app_link"
  | "inbox"
  | "manager_admin"
  | "rollup"
  | "ai_workspace"
  | "document_upload";

type AnyProps = any;

const LOADERS: Record<ModuleBundleId, () => Promise<{ default: ComponentType<AnyProps> }>> = {
  reporting_panel: () => import("../components/LocalReportingPanel.tsx"),
  reception_journal: () => import("../components/IntakeForm.tsx"),
  consultation_journal: () => import("../components/ConsultationJournalPanel.tsx"),
  ipr: () => import("../components/IprExportPanel.tsx"),
  consumer_app_link: () => import("../components/ConsumerBridgePanel.tsx"),
  inbox: () => import("../components/InboxPanel.tsx"),
  manager_admin: () => import("../components/ManagerAdminPanel.tsx"),
  rollup: () => import("../components/DashboardRollupPanel.tsx"),
  ai_workspace: () => import("../components/AiModesPanel.tsx"),
  document_upload: () => import("../components/DocumentUploadPanel.tsx"),
};

export const lazyModules: Record<ModuleBundleId, LazyExoticComponent<ComponentType<AnyProps>>> = {
  reporting_panel: lazy(LOADERS.reporting_panel),
  reception_journal: lazy(LOADERS.reception_journal),
  consultation_journal: lazy(LOADERS.consultation_journal),
  ipr: lazy(LOADERS.ipr),
  consumer_app_link: lazy(LOADERS.consumer_app_link),
  inbox: lazy(LOADERS.inbox),
  manager_admin: lazy(LOADERS.manager_admin),
  rollup: lazy(LOADERS.rollup),
  ai_workspace: lazy(LOADERS.ai_workspace),
  document_upload: lazy(LOADERS.document_upload),
};

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return isTerminalModuleEnabled(cfg, id);
}

/** Preload enabled module chunks after onboarding (fire-and-forget). */
export async function preloadEnabledModuleBundles(cfg: TerminalConfig): Promise<ModuleBundleId[]> {
  const preset = inferWorkspacePreset(cfg);
  const ids: ModuleBundleId[] = [];
  const tasks: Promise<void>[] = [];

  if (preset === "educator_lite") {
    ids.push("ai_workspace");
    tasks.push(LOADERS.ai_workspace().then(() => undefined));
    await Promise.allSettled(tasks);
    try {
      localStorage.setItem("terminal_modules_preloaded", JSON.stringify({ at: Date.now(), ids }));
    } catch {
      /* ignore */
    }
    return ids;
  }

  if (modEnabled(cfg, "reporting_panel")) {
    ids.push("reporting_panel");
    tasks.push(LOADERS.reporting_panel().then(() => undefined));
  }
  if (cfg.mode === "manager") {
    ids.push("inbox", "rollup", "manager_admin");
    tasks.push(
      LOADERS.inbox().then(() => undefined),
      LOADERS.rollup().then(() => undefined),
      LOADERS.manager_admin().then(() => undefined),
    );
  } else {
    if (modEnabled(cfg, "reception_journal") || modEnabled(cfg, "embed_client_widget")) {
      ids.push("inbox");
      tasks.push(LOADERS.inbox().then(() => undefined));
    }
    if (modEnabled(cfg, "reception_journal")) {
      ids.push("reception_journal");
      tasks.push(LOADERS.reception_journal().then(() => undefined));
    }
    if (modEnabled(cfg, "consultation_journal")) {
      ids.push("consultation_journal");
      tasks.push(LOADERS.consultation_journal().then(() => undefined));
    }
    if (modEnabled(cfg, "ipr")) {
      ids.push("ipr");
      tasks.push(LOADERS.ipr().then(() => undefined));
    }
    if (modEnabled(cfg, "consumer_app_link")) {
      ids.push("consumer_app_link");
      tasks.push(LOADERS.consumer_app_link().then(() => undefined));
    }
    ids.push("document_upload", "ai_workspace");
    tasks.push(LOADERS.document_upload().then(() => undefined), LOADERS.ai_workspace().then(() => undefined));
  }

  await Promise.allSettled(tasks);
  try {
    localStorage.setItem("terminal_modules_preloaded", JSON.stringify({ at: Date.now(), ids }));
  } catch {
    /* ignore */
  }
  return ids;
}
