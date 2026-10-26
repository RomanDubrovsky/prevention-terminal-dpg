/**
 * Registry vault backup (.vault.enc) — local only, zero-knowledge.
 * Works offline; no Supabase / cloud.ru dependency.
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type { TerminalConfig, TerminalConfigInput } from "./terminal_config.ts";
import { isWebStaging } from "./web_staging.ts";

export interface RegistryVaultVerifyResult {
  ok: boolean;
  subject_count: number;
  exported_at: string;
}

export interface RegistryVaultRestoreResult {
  imported: number;
  skipped: number;
}

export function isRegistryVaultReady(cfg: TerminalConfig): boolean {
  return (
    cfg.registry_enabled === true &&
    cfg.registry_vault_initialized === true &&
    Boolean(cfg.registry_recovery_key_hash?.trim())
  );
}

export function needsRegistryVaultSetup(cfg: TerminalConfig): boolean {
  return cfg.registry_enabled === true && !isRegistryVaultReady(cfg);
}

export async function generateRecoveryKeyDisplay(): Promise<string> {
  return invoke<string>("registry_generate_recovery_key");
}

export async function hashRecoveryKey(recoveryKey: string): Promise<string> {
  return invoke<string>("registry_recovery_key_hash", { recoveryKey });
}

export function terminalConfigToInput(cfg: TerminalConfig): TerminalConfigInput {
  return {
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
    enabled_modules: cfg.enabled_modules,
    registry_enabled: cfg.registry_enabled,
    registry_vault_initialized: cfg.registry_vault_initialized,
    registry_recovery_key_hash: cfg.registry_recovery_key_hash,
    research_contribution_enabled: cfg.research_contribution_enabled,
    research_contribution_consented_at: cfg.research_contribution_consented_at,
    research_contribution_consent_version: cfg.research_contribution_consent_version,
    research_contribution_last_period_key: cfg.research_contribution_last_period_key,
  };
}

export async function saveRegistryVaultSetup(args: {
  cfg: TerminalConfig;
  recoveryKey: string;
}): Promise<TerminalConfig> {
  const hash = await hashRecoveryKey(args.recoveryKey);
  const input: TerminalConfigInput = {
    ...terminalConfigToInput(args.cfg),
    registry_vault_initialized: true,
    registry_recovery_key_hash: hash,
  };
  return invoke<TerminalConfig>("terminal_save_config", { input });
}

export async function verifyRecoveryKeyAgainstConfig(
  recoveryKey: string,
  cfg: TerminalConfig,
): Promise<boolean> {
  const hash = cfg.registry_recovery_key_hash?.trim();
  if (!hash) return false;
  const candidate = await hashRecoveryKey(recoveryKey);
  return candidate === hash;
}

function defaultBackupFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `registry-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.vault.enc`;
}

export async function exportRegistryVaultBackup(recoveryKey: string): Promise<void> {
  const base64 = await invoke<string>("registry_export_backup", { recoveryKey });
  if (isWebStaging()) {
    downloadBase64File(base64, defaultBackupFilename());
    return;
  }
  const target = await save({
    defaultPath: defaultBackupFilename(),
    filters: [{ name: "Registry vault", extensions: ["vault.enc", "enc"] }],
  });
  if (!target || typeof target !== "string") return;
  await invoke("save_vault_backup", { targetPath: target, base64Data: base64 });
}

export async function verifyRegistryVaultBackupFile(
  recoveryKey: string,
): Promise<RegistryVaultVerifyResult> {
  const base64 = await pickVaultBackupBase64();
  if (!base64) throw new Error("Файл не выбран.");
  return invoke<RegistryVaultVerifyResult>("registry_verify_backup", {
    base64Data: base64,
    recoveryKey,
  });
}

export async function restoreRegistryVaultBackup(
  recoveryKey: string,
): Promise<RegistryVaultRestoreResult> {
  const base64 = await pickVaultBackupBase64();
  if (!base64) throw new Error("Файл не выбран.");
  return invoke<RegistryVaultRestoreResult>("registry_restore_backup", {
    base64Data: base64,
    recoveryKey,
  });
}

async function pickVaultBackupBase64(): Promise<string | null> {
  if (isWebStaging()) {
    return pickVaultFileInBrowser();
  }
  const source = await open({
    multiple: false,
    filters: [{ name: "Registry vault", extensions: ["vault.enc", "enc"] }],
  });
  if (!source || typeof source !== "string") return null;
  return invoke<string>("read_vault_backup_file", { sourcePath: source });
}

function downloadBase64File(base64: string, filename: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickVaultFileInBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vault.enc,.enc,application/octet-stream";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
        resolve(btoa(binary));
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    };
    input.click();
  });
}
