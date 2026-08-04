import type { InstallationMetaInput } from "./installation_meta.ts";
import type { WorkspacePreset } from "./terminal_config.ts";

export type SetupSection =
  | "org"
  | "profile"
  | "federation"
  | "organization"
  | "modules"
  | "site_widgets";

export const DEFAULT_INSTALLATION: InstallationMetaInput = {
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

export function buildVisibleSetupSections(
  preset: WorkspacePreset,
  opts?: { skipOrgStep?: boolean; territorialManager?: boolean; includeAdvancedOrganization?: boolean },
): SetupSection[] {
  const steps: SetupSection[] = [];
  if (!opts?.skipOrgStep) steps.push("org");
  if (preset === "educator_lite") {
    steps.push("federation");
    return steps;
  }
  steps.push("profile", "federation");
  if (opts?.includeAdvancedOrganization) steps.push("organization");
  if (preset === "specialist") steps.push("modules");
  else if (preset === "manager" && !opts?.territorialManager) {
    steps.push("site_widgets");
  }
  return steps;
}

export function setupSectionTitle(step: SetupSection): string {
  const map: Record<SetupSection, string> = {
    org: "Тип организации",
    profile: "Профиль",
    federation: "Сеть",
    organization: "Организация",
    modules: "Модули",
    site_widgets: "Сайт",
  };
  return map[step];
}
