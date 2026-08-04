import {
  ORG_KIND_VALUES,
  type IscedLevel,
  type OrgKind,
} from "./taxonomy.ts";
import {
  EDUCATION_ORG_TYPE_VALUES,
  ORG_SPHERE_VALUES,
  type EducationOrgType,
  type OrgSphere,
} from "./org_sphere.ts";

export type { EducationOrgType, OrgSphere } from "./org_sphere.ts";
export {
  EDUCATION_ORG_TYPE_LABEL,
  EDUCATION_ORG_TYPE_VALUES,
  ORG_SPHERE_LABEL,
  ORG_SPHERE_VALUES,
  defaultOrgSphereForSegment,
  educationOrgTypeToLegacy,
  legacyToEducationOrgType,
} from "./org_sphere.ts";

export interface OrgProfile {
  display_name: string;
  isced_level: IscedLevel;
  org_kind: OrgKind;
  normative_overrides: string;
  approx_learner_count: number | null;
  org_sphere: OrgSphere;
  org_sphere_other: string;
  education_org_type: EducationOrgType | null;
  approx_learner_ovz_count: number | null;
}

export interface OrgProfileInput {
  display_name: string;
  isced_level: IscedLevel;
  org_kind: OrgKind;
  normative_overrides?: string;
  approx_learner_count?: number | null;
  org_sphere?: OrgSphere;
  org_sphere_other?: string;
  education_org_type?: EducationOrgType | null;
  approx_learner_ovz_count?: number | null;
}

export interface SpecialistProfile {
  display_name: string;
  role_text: string;
  weekly_contract_minutes: number;
  rate_type?: "fixed" | "percent";
  rate_value?: number;
}

export interface SpecialistProfileInput {
  display_name: string;
  role_text: string;
  weekly_contract_minutes: number;
  rate_type?: "fixed" | "percent";
  rate_value?: number;
}

export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  combined_school: "Школа / несколько уровней",
  special_education: "Специальное образование",
  out_of_school: "Дополнительное образование",
  psych_support_center: "Психологический центр",
  private_practice: "Частная практика",
  other: "Другое",
};

export const EDUCATION_LEVEL_LABEL: Record<IscedLevel, string> = {
  0: "Дошкольное образование",
  1: "Начальное общее",
  2: "Основное общее",
  3: "Среднее общее / СПО",
  4: "Послесреднее нетретичное",
  5: "Короткий цикл высшего",
  6: "Бакалавриат",
  7: "Магистратура",
  8: "Докторантура",
};

/** @deprecated Use EDUCATION_LEVEL_LABEL — kept for imports elsewhere during transition */
export const ISCED_LEVEL_LABEL = EDUCATION_LEVEL_LABEL;

export const DEFAULT_ORG_PROFILE: OrgProfileInput = {
  display_name: "",
  isced_level: 2,
  org_kind: "combined_school",
  normative_overrides: "{}",
  approx_learner_count: null,
  org_sphere: "education_system",
  org_sphere_other: "",
  education_org_type: "lower_secondary",
  approx_learner_ovz_count: null,
};

export const DEFAULT_SPECIALIST_PROFILE: SpecialistProfileInput = {
  display_name: "",
  role_text: "Педагог-психолог",
  weekly_contract_minutes: 2160,
  rate_type: "fixed",
  rate_value: 0.0,
};

export interface ValidateOrgProfileOptions {
  requireEducationOrgType?: boolean;
  requireOrgSphereOther?: boolean;
  requireLearnerCount?: boolean;
}

export function isOrgProfileComplete(profile: OrgProfile | null): boolean {
  return Boolean(profile?.display_name.trim() && ORG_KIND_VALUES.includes(profile.org_kind));
}

export function isSpecialistProfileComplete(profile: SpecialistProfile | null): boolean {
  return Boolean(
    profile?.display_name.trim() &&
      profile.role_text.trim() &&
      profile.weekly_contract_minutes >= 0,
  );
}

export function validateOrgProfileDraft(
  input: OrgProfileInput,
  options: ValidateOrgProfileOptions = {},
): string | null {
  const requireEducationOrgType = options.requireEducationOrgType ?? false;
  const requireOrgSphereOther = options.requireOrgSphereOther ?? false;
  const requireLearnerCount = options.requireLearnerCount ?? false;
  const orgSphere = input.org_sphere ?? "education_system";

  if (!input.display_name.trim()) return "Укажите название организации.";
  if (!ORG_SPHERE_VALUES.includes(orgSphere)) return "Выберите сферу.";
  if (requireOrgSphereOther && orgSphere === "other" && !String(input.org_sphere_other || "").trim()) {
    return "Укажите название иной сферы.";
  }
  if (requireEducationOrgType && orgSphere === "education_system") {
    const eduType = input.education_org_type;
    if (!eduType || !EDUCATION_ORG_TYPE_VALUES.includes(eduType)) {
      return "Выберите тип организации.";
    }
  }
  if (!ORG_KIND_VALUES.includes(input.org_kind)) return "Выберите тип организации.";
  if (requireLearnerCount) {
    const count = input.approx_learner_count;
    if (count == null || count < 1) {
      return "Укажите примерное число обучающихся или воспитанников.";
    }
  }
  if (input.approx_learner_count != null && input.approx_learner_count < 0) {
    return "Число обучающихся не может быть отрицательным.";
  }
  if (input.approx_learner_ovz_count != null && input.approx_learner_ovz_count < 0) {
    return "Число обучающихся с ОВЗ не может быть отрицательным.";
  }
  if (
    input.approx_learner_count != null &&
    input.approx_learner_ovz_count != null &&
    input.approx_learner_ovz_count > input.approx_learner_count
  ) {
    return "Число обучающихся с ОВЗ не может превышать общее число.";
  }
  try {
    JSON.parse(input.normative_overrides || "{}");
  } catch {
    return "Нормативы времени должны быть валидным JSON.";
  }
  return null;
}

export function validateSpecialistProfileDraft(input: SpecialistProfileInput): string | null {
  if (!input.display_name.trim()) return "Укажите имя специалиста.";
  if (!input.role_text.trim()) return "Укажите роль специалиста.";
  if (input.weekly_contract_minutes < 0 || input.weekly_contract_minutes > 10080) {
    return "Недельная нагрузка должна быть от 0 до 168 часов.";
  }
  return null;
}
