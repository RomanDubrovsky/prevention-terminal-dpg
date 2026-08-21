export interface InstallationMeta {
  install_id: string;
  country: string;
  region: string;
  municipality: string;
  settlement: string;
  lat?: number | null;
  lng?: number | null;
  organization_type: string;
  organization_label: string;
  org_unit_id: string | null;
  org_unit_status: string;
  telemetry_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstallationMetaInput {
  country: string;
  region: string;
  municipality: string;
  settlement: string;
  lat?: number | null;
  lng?: number | null;
  organization_type: string;
  organization_label: string;
  telemetry_consent: boolean;
}

export const ORGANIZATION_TYPES = [
  "school",
  "private_practice",
  "psychological_center",
  "ngo",
  "other",
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_TYPE_LABEL: Record<OrganizationType, string> = {
  school: "Школа / колледж",
  private_practice: "Частная практика",
  psychological_center: "Психологический центр",
  ngo: "НКО / проект",
  other: "Другое",
};

export interface ValidateInstallationOptions {
  requireOrgLabel?: boolean;
  requireOrgType?: boolean;
  requireSettlement?: boolean;
}

export function normalizeInstallationLocation(input: InstallationMetaInput): InstallationMetaInput {
  const settlement = input.settlement.trim();
  const country = input.country.trim() || "RU";
  if (!settlement) return { ...input, country };
  const region = input.region.trim() || settlement;
  const municipality = input.municipality.trim() || region;
  return { ...input, settlement, region, municipality, country };
}

export function isInstallationMetaComplete(meta: InstallationMeta | null): boolean {
  if (!meta) return false;
  const loc = normalizeInstallationLocation(meta);
  return (
    loc.country.trim().length > 0 &&
    loc.settlement.trim().length > 0 &&
    loc.organization_type.trim().length > 0 &&
    loc.organization_label.trim().length > 0
  );
}

export function validateInstallationDraft(
  input: InstallationMetaInput,
  options: ValidateInstallationOptions = {},
): string | null {
  const requireOrgLabel = options.requireOrgLabel ?? true;
  const requireOrgType = options.requireOrgType ?? true;
  const requireSettlement = options.requireSettlement ?? true;

  const loc = normalizeInstallationLocation(input);
  if (requireSettlement && !loc.settlement.trim()) {
    return "Укажите населённый пункт на карте.";
  }
  if (requireOrgType && !input.organization_type.trim()) return "Выберите тип организации.";
  if (requireOrgLabel && !input.organization_label.trim()) return "Укажите название организации.";
  return null;
}
