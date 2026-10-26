import { invoke } from "@tauri-apps/api/core";

import type { TerminalConfig, TerminalConfigInput } from "./terminal_config.ts";

/** Enable named registry from the Registry workspace tab. */
export async function enableSpecialistRegistry(cfg: TerminalConfig): Promise<TerminalConfig> {
  const enabled_modules = {
    ...cfg.enabled_modules,
    reception_journal: true,
    consultation_journal: cfg.enabled_modules.consultation_journal !== false,
  };

  const input: TerminalConfigInput = {
    edition: cfg.edition,
    mode: cfg.mode,
    workspace_preset: cfg.workspace_preset,
    org_type: cfg.org_type,
    manager_scope: cfg.manager_scope,
    job_title: cfg.job_title,
    child_invite_code: cfg.child_invite_code,
    parent_invite_code: cfg.parent_invite_code,
    parent_invite_in: cfg.parent_invite_in,
    child_invite_in: cfg.child_invite_in,
    consumer_app: cfg.consumer_app,
    enabled_modules,
    registry_enabled: true,
  };

  return invoke<TerminalConfig>("terminal_save_config", { input });
}
