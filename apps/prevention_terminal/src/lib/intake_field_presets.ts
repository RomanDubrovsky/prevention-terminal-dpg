import { t } from "./i18n.ts";
export interface IntakePresetOption {
  id: string;
  label: string;
}

export const CUSTOM_PRESET_ID = "__custom__";

export const CONTACTED_BY_PRESETS: IntakePresetOption[] = [
  { id: "client", label: t("Клиент", "Client") },
  { id: "partner", label: t("Партнёр", "Partner") },
  { id: "parent", label: t("Родитель / законный представитель", "Parent / legal guardian") },
  { id: "relative", label: t("Родственник", "Relative") },
  { id: "org_rep", label: t("Представитель организации", "Organization representative") },
  { id: CUSTOM_PRESET_ID, label: t("Свой вариант…", "Custom...") },
];

export const CONCERN_FOR_PRESETS: IntakePresetOption[] = [
  { id: "client", label: t("Клиент (сам заявитель)", "Client (applicant)") },
  { id: "child", label: t("Ребёнок / подросток", "Child / adolescent") },
  { id: "partner", label: t("Партнёр", "Partner") },
  { id: "parent", label: t("Родитель", "Parent") },
  { id: "relative", label: t("Родственник", "Relative") },
  { id: CUSTOM_PRESET_ID, label: t("Свой вариант…", "Custom...") },
];

export const INITIATIVE_PRESETS: IntakePresetOption[] = [
  { id: "self", label: t("Сам клиент", "Client themselves") },
  { id: "relative", label: t("Родственник", "Relative") },
  { id: "organization", label: t("Организация / учреждение", "Organization / institution") },
  { id: "referral", label: t("Направление специалиста", "Specialist referral") },
  { id: "court", label: t("Суд / госорган", "Court / government agency") },
  { id: "recommendation", label: t("Рекомендация", "Recommendation") },
  { id: CUSTOM_PRESET_ID, label: t("Свой вариант…", "Custom...") },
];

export function presetLabels(options: IntakePresetOption[]): string[] {
  return options.filter((o) => o.id !== CUSTOM_PRESET_ID).map((o) => o.label);
}

export function resolvePresetSelectValue(
  value: string,
  options: IntakePresetOption[],
): { selectValue: string; customText: string } {
  const trimmed = value.trim();
  if (!trimmed) return { selectValue: "", customText: "" };
  const match = options.find((o) => o.id !== CUSTOM_PRESET_ID && o.label === trimmed);
  if (match) return { selectValue: match.id, customText: "" };
  return { selectValue: CUSTOM_PRESET_ID, customText: trimmed };
}

export function presetValueFromSelect(
  selectValue: string,
  customText: string,
  options: IntakePresetOption[],
): string {
  if (!selectValue) return "";
  if (selectValue === CUSTOM_PRESET_ID) return customText.trim();
  return options.find((o) => o.id === selectValue)?.label ?? customText.trim();
}
