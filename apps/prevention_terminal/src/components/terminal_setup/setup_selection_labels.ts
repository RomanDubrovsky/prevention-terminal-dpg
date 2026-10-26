import { isBundleEnabled, SPECIALIST_PRODUCT_BUNDLES } from "../../lib/onboarding_bundles.ts";
import {
  ONBOARDING_ORG_SEGMENT,
  ONBOARDING_PROFILE_ROLE_LABEL,
  presetLabel,
} from "../../lib/terminal_config.ts";
import type { SetupSection } from "../../lib/terminal_setup_constants.ts";
import type { TerminalSetupState } from "../../lib/use_terminal_setup.ts";

/** Human-readable summary of what was chosen on a completed setup step. */
export function setupStepSelectionLabel(
  step: SetupSection,
  setup: TerminalSetupState,
  locale: string,
): string | null {
  const isRu = locale.startsWith("ru");
  const {
    orgType,
    profileRole,
    workspacePreset,
    isManagerPreset,
    territorialManager,
    schoolLike,
    parentIn,
    childIn,
    installationDraft,
    displayName,
    modules,
  } = setup;

  switch (step) {
    case "org":
      if (orgType === "education") {
        return isRu ? "Психологическая служба в системе образования" : "Education System";
      }
      if (orgType === "commercial") {
        return isRu ? "Коммерческий психологический центр" : "Commercial Center (IDA)";
      }
      return null;
    case "profile":
      if (profileRole === "psychologist") return isRu ? "Психолог" : "Psychologist";
      if (profileRole === "director") return isRu ? "Руководитель" : "Director / Manager";
      if (profileRole === "territorial_admin") return isRu ? "Орган управления" : "Authority Coordinator";
      return ONBOARDING_PROFILE_ROLE_LABEL[profileRole]?.title ?? null;
    case "federation": {
      if (workspacePreset === "educator_lite") {
        return parentIn.trim()
          ? (isRu ? "Связь с руководителем" : "Connected to manager")
          : (isRu ? "Без связи с руководителем" : "Autonomous");
      }
      if (workspacePreset === "specialist") {
        return parentIn.trim()
          ? (isRu ? "Подключён к руководителю" : "Connected to manager")
          : (isRu ? "Автономный режим" : "Autonomous mode");
      }
      if (isManagerPreset && territorialManager) {
        return childIn.trim()
          ? (isRu ? "Организация подключена" : "Organization connected")
          : (isRu ? "Организации не подключены" : "No organizations connected");
      }
      if (isManagerPreset) {
        return childIn.trim()
          ? (isRu ? "Специалист подключён" : "Specialist connected")
          : (isRu ? "Специалисты не подключены" : "No specialists connected");
      }
      return presetLabel(workspacePreset, locale);
    }
    case "organization": {
      const parts: string[] = [];
      const org = installationDraft.organization_label.trim();
      if (org) parts.push(org);
      const place = installationDraft.settlement.trim();
      if (place) parts.push(place);
      if (parts.length > 0) return parts.join(", ");
      const name = displayName.trim();
      return name || (isRu ? "Не заполнено" : "Not specified");
    }
    case "modules": {
      const bundles = SPECIALIST_PRODUCT_BUNDLES.filter((b) => !b.schoolLikeOnly || schoolLike);
      const enabled = bundles.filter((b) => isBundleEnabled(b.id, modules));
      if (enabled.length === 0) return isRu ? "Модули не выбраны" : "No modules selected";
      if (enabled.length === 1) return isRu ? enabled[0].title_ru : (enabled[0].title_en || enabled[0].title_ru);
      const n = enabled.length;
      if (!isRu) return `${n} modules`;
      const modWord = n % 10 === 1 && n % 100 !== 11 ? "модуль" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "модуля" : "модулей";
      return `${n} ${modWord}`;
    }
    case "site_widgets":
      return isRu ? "Виджеты для сайта" : "Site widgets";
    default:
      return null;
  }
}
