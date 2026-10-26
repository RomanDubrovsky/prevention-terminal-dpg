import { invoke } from "@tauri-apps/api/core";

import { detectApproximateLocation } from "./geo_detect.ts";
import { syncTerminalCloudAfterOnboarding } from "./federation_client.ts";
import {
  normalizeInstallationLocation,
  type InstallationMeta,
  type InstallationMetaInput,
} from "./installation_meta.ts";
import {
  DEFAULT_ORG_PROFILE,
  type OrgProfile,
  type OrgProfileInput,
  type SpecialistProfile,
  type SpecialistProfileInput,
} from "./terminal_profiles.ts";
import {
  defaultEnabledModules,
  genInviteCode,
  inferManagerScope,
  orgTypeToOrganizationType,
  type TerminalConfig,
  type TerminalConfigInput,
} from "./terminal_config.ts";
import { getTerminalEdition } from "./terminal_edition.ts";

const DEFAULT_INSTALLATION: InstallationMetaInput = {
  country: "RU",
  region: "",
  municipality: "",
  settlement: "",
  lat: null,
  lng: null,
  organization_type: "school",
  organization_label: "",
  telemetry_consent: false,
};

/** One-shot educator lite setup — no wizard (landings ?entry=educator). */
export async function bootstrapEducatorLiteInstallation(): Promise<{
  meta: InstallationMeta;
  orgProfile: OrgProfile;
  specialistProfile: SpecialistProfile;
  terminalConfig: TerminalConfig;
}> {
  const edition = getTerminalEdition();
  const geo = await detectApproximateLocation();
  const installationInput = normalizeInstallationLocation({
    ...DEFAULT_INSTALLATION,
    country: geo.country || "RU",
    region: geo.region,
    municipality: geo.municipality,
    settlement: geo.settlement,
    lat: geo.lat ?? null,
    lng: geo.lng ?? null,
    organization_type: orgTypeToOrganizationType("education"),
    organization_label: "",
    telemetry_consent: false,
  });

  const orgPayload: OrgProfileInput = {
    display_name: DEFAULT_ORG_PROFILE.display_name || "Образовательная организация",
    isced_level: 2,
    org_kind: "combined_school",
    normative_overrides: "{}",
    approx_learner_count: null,
    org_sphere: "education_system",
    org_sphere_other: "",
    education_org_type: "lower_secondary",
    approx_learner_ovz_count: null,
  };
  const specialistPayload: SpecialistProfileInput = {
    display_name: "Педагог",
    role_text: "Педагог",
    weekly_contract_minutes: 0,
  };

  const meta = await invoke<InstallationMeta>("installation_save_meta", { input: installationInput });
  await invoke("db_save_org_profile", { payload: orgPayload });
  await invoke("db_save_specialist_profile", { payload: specialistPayload });

  const modules = defaultEnabledModules("specialist", "education", "educator_lite");
  modules.consumer_app_link = false;

  const terminalInput: TerminalConfigInput = {
    edition,
    mode: "specialist",
    workspace_preset: "educator_lite",
    org_type: "education",
    manager_scope: inferManagerScope("education", "educator_lite"),
    job_title: "Педагог",
    child_invite_code: genInviteCode("CHILD"),
    parent_invite_code: null,
    parent_invite_in: null,
    child_invite_in: null,
    consumer_app: null,
    enabled_modules: modules,
    registry_enabled: false,
  };
  const terminalConfig = await invoke<TerminalConfig>("terminal_save_config", { input: terminalInput });

  const [orgProfile, specialistProfile] = await Promise.all([
    invoke<OrgProfile | null>("db_get_org_profile"),
    invoke<SpecialistProfile | null>("db_get_specialist_profile"),
  ]);
  if (!orgProfile || !specialistProfile) {
    throw new Error("educator_bootstrap_profiles_missing");
  }

  await syncTerminalCloudAfterOnboarding({
    terminalConfig,
    installId: meta.install_id,
    meta,
    orgProfile,
    country: installationInput.country,
    settlement: installationInput.settlement,
    organizationName: installationInput.organization_label,
  }).catch(() => {});

  return { meta, orgProfile, specialistProfile, terminalConfig };
}
