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
  "general_school",
  "ppms_center",
  "cve_college",
  "higher_education",
  "correctional",
  "supplementary",
  "camp_vacation",
  "pre_primary",
  "edu_other",
  // Legacy compatibility values
  "primary",
  "lower_secondary",
  "upper_secondary",
  "bachelor",
  "master",
  "doctoral",
] as const;

export type EducationOrgType = (typeof EDUCATION_ORG_TYPE_VALUES)[number];

export const EDUCATION_ORG_TYPE_LABEL: Record<EducationOrgType, string> = {
  general_school: "Общеобразовательная школа (школа, гимназия, лицей)",
  ppms_center: "ППМС-центр (центр психолого-педагогической помощи)",
  cve_college: "СПО (колледж, техникум, училище)",
  higher_education: "ВУЗ (университет, институт, академия)",
  correctional: "Коррекционная школа / интернат (ОВЗ, адаптированные программы)",
  supplementary: "Дополнительное образование (творчество, спорт, школы искусств)",
  camp_vacation: "Организация отдыха и оздоровления детей (лагерь, летний отдых)",
  pre_primary: "Дошкольное образование (детский сад)",
  edu_other: "Другой тип организации образования",
  // Legacy aliases
  primary: "Начальное общее",
  lower_secondary: "Основное общее",
  upper_secondary: "Среднее общее / СПО",
  bachelor: "Бакалавриат",
  master: "Магистратура",
  doctoral: "Докторантура",
};

/** Primary active list shown in selectors (without legacy duplicates) */
export const SELECTABLE_EDUCATION_ORG_TYPES: EducationOrgType[] = [
  "general_school",
  "ppms_center",
  "cve_college",
  "higher_education",
  "correctional",
  "supplementary",
  "camp_vacation",
  "pre_primary",
  "edu_other",
];

/** Типы организаций внутри сферы «Молодёжная политика». */
export const YOUTH_ORG_TYPE_VALUES = [
  "youth_municipal_center",
  "youth_regional_center",
  "youth_club_space",
  "youth_authority",
  "youth_other",
] as const;

export type YouthOrgType = (typeof YOUTH_ORG_TYPE_VALUES)[number];

export const YOUTH_ORG_TYPE_LABEL: Record<YouthOrgType, string> = {
  youth_municipal_center: "Муниципальный молодёжный центр / учреждение",
  youth_regional_center: "Региональный молодёжный центр / ресурсный центр",
  youth_club_space: "Подростково-молодёжный клуб / открытое пространство (ПМК)",
  youth_authority: "Орган по делам молодёжи (комитет / управление)",
  youth_other: "Другая организация молодёжной политики",
};

/** Типы организаций внутри коммерческой / частной практики. */
export const COMMERCIAL_ORG_TYPE_VALUES = [
  "private_office",
  "commercial_center",
  "online_practice",
  "commercial_other",
] as const;

export type CommercialOrgType = (typeof COMMERCIAL_ORG_TYPE_VALUES)[number];

export const COMMERCIAL_ORG_TYPE_LABEL: Record<CommercialOrgType, string> = {
  private_office: "Кабинет частной практики",
  commercial_center: "Психологический / консультационный центр",
  online_practice: "Онлайн-практика",
  commercial_other: "Другое",
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
    case "general_school":
      return { isced_level: 2, org_kind: "combined_school" };
    case "ppms_center":
      return { isced_level: 2, org_kind: "psych_support_center" };
    case "cve_college":
      return { isced_level: 3, org_kind: "combined_school" };
    case "higher_education":
      return { isced_level: 6, org_kind: "other" };
    case "correctional":
      return { isced_level: 2, org_kind: "special_education" };
    case "supplementary":
      return { isced_level: 2, org_kind: "out_of_school" };
    case "camp_vacation":
      return { isced_level: 2, org_kind: "out_of_school" };
    case "pre_primary":
      return { isced_level: 0, org_kind: "combined_school" };
    case "edu_other":
      return { isced_level: 2, org_kind: "other" };
    case "primary":
      return { isced_level: 1, org_kind: "combined_school" };
    case "lower_secondary":
      return { isced_level: 2, org_kind: "combined_school" };
    case "upper_secondary":
      return { isced_level: 3, org_kind: "combined_school" };
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
  if (isced_level === 6 || isced_level === 7 || isced_level === 8) return "higher_education";
  if (isced_level === 0) return "pre_primary";
  if (isced_level === 3) return "cve_college";
  return "general_school";
}
