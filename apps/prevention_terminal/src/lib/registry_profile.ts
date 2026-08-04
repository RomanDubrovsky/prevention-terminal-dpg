/** Карточка в реестре — персональные данные, только при включённом реестре. */

export type CaseRecordKind = "registry_subject" | "consultation_lite" | "situation";

export type RegistryGender = "male" | "female" | "other" | "unknown";

export interface RegistryProfile {
  full_name: string;
  gender: RegistryGender;
  age_years: number | null;
  grade_class: string;
  birth_date: string;
  phone: string;
  email: string;
  address: string;
  /** Законный представитель / контактное лицо (для школьников — родитель). */
  contact_person: string;
  notes: string;
}

export const REGISTRY_GENDER_LABELS: Record<RegistryGender, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другое",
  unknown: "Не указан",
};

export const REGISTRY_GENDER_LABELS_EN: Record<RegistryGender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  unknown: "Unspecified",
};

/** Варианты пола в форме — в RU без «Другое». */
export function registryGenderChoices(locale: string): RegistryGender[] {
  const all: RegistryGender[] = ["unknown", "male", "female", "other"];
  if (locale.startsWith("ru")) return ["unknown", "male", "female"];
  return all;
}

export function normalizeRegistryGenderForLocale(
  gender: RegistryGender,
  locale: string,
): RegistryGender {
  if (locale.startsWith("ru") && gender === "other") return "unknown";
  return gender;
}

export function registryGenderLabel(gender: RegistryGender, locale: string): string {
  const norm = normalizeRegistryGenderForLocale(gender, locale);
  const isIntl = locale.startsWith("en") || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edition") === "intl");
  return isIntl ? REGISTRY_GENDER_LABELS_EN[norm] : REGISTRY_GENDER_LABELS[norm];
}

export function emptyRegistryProfile(): RegistryProfile {
  return {
    full_name: "",
    gender: "unknown",
    age_years: null,
    grade_class: "",
    birth_date: "",
    phone: "",
    email: "",
    address: "",
    contact_person: "",
    notes: "",
  };
}

export function parseRegistryProfile(raw: unknown): RegistryProfile {
  if (!raw || typeof raw !== "object") return emptyRegistryProfile();
  const o = raw as Record<string, unknown>;
  const gender = String(o.gender || "unknown");
  const ageRaw = o.age_years;
  const age =
    ageRaw === null || ageRaw === undefined || ageRaw === ""
      ? null
      : Number(ageRaw);
  return {
    full_name: String(o.full_name || "").trim(),
    gender: (["male", "female", "other", "unknown"].includes(gender)
      ? gender
      : "unknown") as RegistryGender,
    age_years: Number.isFinite(age) && age !== null && age >= 0 ? Math.floor(age) : null,
    grade_class: String(o.grade_class || "").trim(),
    birth_date: String(o.birth_date || "").trim(),
    phone: String(o.phone || "").trim(),
    email: String(o.email || "").trim(),
    address: String(o.address || "").trim(),
    contact_person: String(o.contact_person || "").trim(),
    notes: String(o.notes || "").trim(),
  };
}

export function formatRegistryProfileLine(profile: RegistryProfile): string {
  const parts = [profile.full_name];
  if (profile.grade_class) parts.push(profile.grade_class);
  if (profile.age_years != null) parts.push(`${profile.age_years} лет`);
  return parts.filter(Boolean).join(" · ");
}

export function registryProfileForAi(profile: RegistryProfile, locale = "ru"): string {
  const lines = [
    profile.full_name ? `ФИО: ${profile.full_name}` : "",
    profile.gender !== "unknown"
      ? `Пол: ${registryGenderLabel(profile.gender, locale)}`
      : "",
    profile.age_years != null ? `Возраст: ${profile.age_years}` : "",
    profile.grade_class ? `Класс / группа: ${profile.grade_class}` : "",
    profile.birth_date ? `Дата рождения: ${profile.birth_date}` : "",
    profile.phone ? `Телефон: ${profile.phone}` : "",
    profile.email ? `Email: ${profile.email}` : "",
    profile.address ? `Адрес: ${profile.address}` : "",
    profile.contact_person ? `Контактное лицо: ${profile.contact_person}` : "",
    profile.notes ? `Заметки: ${profile.notes}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
