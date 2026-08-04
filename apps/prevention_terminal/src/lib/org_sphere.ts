import type { IscedLevel, OrgKind } from "./taxonomy.ts";

/** Сфера профилактической работы организации (аналитика / дашборды). */
export const ORG_SPHERE_VALUES = [
  "education_system",
  "youth_policy",
  "social_work",
  "law_enforcement",
  "other",
] as const;

export type OrgSphere = (typeof ORG_SPHERE_VALUES)[number];

export const ORG_SPHERE_LABEL: Record<OrgSphere, string> = {
  education_system: "Система образования",
  youth_policy: "Молодёжная политика",
  social_work: "Социальная работа",
  law_enforcement: "Правоохранительные органы",
  other: "Иная",
};

/** Тип организации внутри сферы «Система образования» (RU, edition RU). */
export const EDUCATION_ORG_TYPE_VALUES = [
  "pre_primary",
  "primary",
  "lower_secondary",
  "upper_secondary",
  "supplementary",
  "correctional",
  "ppms_center",
  "bachelor",
  "master",
  "doctoral",
] as const;

export type EducationOrgType = (typeof EDUCATION_ORG_TYPE_VALUES)[number];

export const EDUCATION_ORG_TYPE_LABEL: Record<EducationOrgType, string> = {
  pre_primary: "Дошкольное образование",
  primary: "Начальное общее",
  lower_secondary: "Основное общее",
  upper_secondary: "Среднее общее / СПО",
  supplementary: "Дополнительное образование",
  correctional: "Коррекционная школа",
  ppms_center: "ППМС-центр",
  bachelor: "Бакалавриат",
  master: "Магистратура",
  doctoral: "Докторантура",
};

export function defaultOrgSphereForSegment(orgType: "education" | "commercial" | ""): OrgSphere {
  if (orgType === "education") return "education_system";
  if (orgType === "commercial") return "other";
  return "education_system";
}

export function educationOrgTypeToLegacy(
  educationOrgType: EducationOrgType,
): { isced_level: IscedLevel; org_kind: OrgKind } {
  switch (educationOrgType) {
    case "pre_primary":
      return { isced_level: 0, org_kind: "combined_school" };
    case "primary":
      return { isced_level: 1, org_kind: "combined_school" };
    case "lower_secondary":
      return { isced_level: 2, org_kind: "combined_school" };
    case "upper_secondary":
      return { isced_level: 3, org_kind: "combined_school" };
    case "supplementary":
      return { isced_level: 2, org_kind: "out_of_school" };
    case "correctional":
      return { isced_level: 2, org_kind: "special_education" };
    case "ppms_center":
      return { isced_level: 2, org_kind: "psych_support_center" };
    case "bachelor":
      return { isced_level: 6, org_kind: "other" };
    case "master":
      return { isced_level: 7, org_kind: "other" };
    case "doctoral":
      return { isced_level: 8, org_kind: "other" };
    default:
      return { isced_level: 2, org_kind: "combined_school" };
  }
}

/** Восстановить тип организации из legacy isced/org_kind при загрузке старых профилей. */
export function legacyToEducationOrgType(
  isced_level: IscedLevel,
  org_kind: OrgKind,
): EducationOrgType {
  if (org_kind === "out_of_school") return "supplementary";
  if (org_kind === "special_education") return "correctional";
  if (org_kind === "psych_support_center") return "ppms_center";
  if (isced_level === 6) return "bachelor";
  if (isced_level === 7) return "master";
  if (isced_level === 8) return "doctoral";
  if (isced_level === 0) return "pre_primary";
  if (isced_level === 1) return "primary";
  if (isced_level === 3) return "upper_secondary";
  if (isced_level === 4 || isced_level === 5) return "lower_secondary";
  return "lower_secondary";
}
