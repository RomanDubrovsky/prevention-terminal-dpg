import { invoke } from "@tauri-apps/api/core";

import { normalizeInstallationLocation, type InstallationMeta } from "./installation_meta.ts";
import { syncTerminalCloudAfterOnboarding } from "./federation_client.ts";
import type { OrgProfile, OrgProfileInput, SpecialistProfile, SpecialistProfileInput } from "./terminal_profiles.ts";
import {
  inferManagerScope,
  orgTypeToOrganizationType,
  type OrgTypePreset,
  type ManagerScope,
  type TerminalConfig,
  type TerminalConfigInput,
  type TerminalMode,
  type WorkspacePreset,
} from "./terminal_config.ts";
import type { InstallationMetaInput } from "./installation_meta.ts";

export async function persistTerminalSetup(args: {
  installationInput: InstallationMetaInput;
  orgDraft: OrgProfileInput;
  specialistPayload: SpecialistProfileInput;
  edition: string;
  mode: TerminalMode;
  workspacePreset: WorkspacePreset;
  orgType: OrgTypePreset | "";
  managerScopeChoice: ManagerScope | null;
  jobTitle: string;
  childCode: string;
  parentCode: string;
  parentIn: string;
  childIn: string;
  modules: Record<string, boolean>;
  registryEnabled: boolean;
  isManagerPreset: boolean;
}): Promise<{
  meta: InstallationMeta;
  orgProfile: OrgProfile;
  specialistProfile: SpecialistProfile;
  terminalConfig: TerminalConfig;
}> {
  const finalModules = { ...args.modules };
  if (args.registryEnabled) finalModules.reception_journal = true;
  finalModules.consumer_app_link = false;

  const normalizedInstallation = normalizeInstallationLocation(args.installationInput);
  const managerScope = inferManagerScope(
    args.orgType || null,
    args.workspacePreset,
    args.managerScopeChoice,
  );

  const meta = await invoke<InstallationMeta>("installation_save_meta", {
    input: {
      ...normalizedInstallation,
      organization_type: orgTypeToOrganizationType(args.orgType || null),
    },
  });
  await invoke("db_save_org_profile", { payload: args.orgDraft });
  await invoke("db_save_specialist_profile", { payload: args.specialistPayload });

  const terminalInput: TerminalConfigInput = {
    edition: args.edition,
    mode: args.mode,
    workspace_preset: args.workspacePreset,
    org_type: args.orgType || null,
    manager_scope: managerScope,
    job_title: args.jobTitle,
    child_invite_code: args.childCode,
    parent_invite_code: args.isManagerPreset ? args.parentCode : null,
    parent_invite_in: args.parentIn || null,
    child_invite_in: args.childIn || null,
    consumer_app: null,
    enabled_modules: finalModules,
    registry_enabled: args.registryEnabled,
  };
  const terminalConfig = await invoke<TerminalConfig>("terminal_save_config", { input: terminalInput });

  const [orgProfile, specialistProfile] = await Promise.all([
    invoke<OrgProfile | null>("db_get_org_profile"),
    invoke<SpecialistProfile | null>("db_get_specialist_profile"),
  ]);
  if (!orgProfile || !specialistProfile) throw new Error("profiles were not saved");

  await syncTerminalCloudAfterOnboarding({
    terminalConfig,
    installId: meta.install_id,
    meta,
    orgProfile,
    country: normalizedInstallation.country,
    settlement: normalizedInstallation.settlement,
    organizationName: normalizedInstallation.organization_label,
  }).catch(() => {});

  return { meta, orgProfile, specialistProfile, terminalConfig };
}
