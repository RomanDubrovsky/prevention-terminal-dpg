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
      if (orgType === "education" || orgType === "commercial") {
        return ONBOARDING_ORG_SEGMENT[orgType].title;
      }
      return null;
    case "profile":
      return ONBOARDING_PROFILE_ROLE_LABEL[profileRole]?.title ?? null;
    case "federation": {
      if (workspacePreset === "educator_lite") {
        return parentIn.trim() ? "Связь с руководителем" : "Без связи с руководителем";
      }
      if (workspacePreset === "specialist") {
        return parentIn.trim() ? "Подключён к руководителю" : "Автономный режим";
      }
      if (isManagerPreset && territorialManager) {
        return childIn.trim() ? "Организация подключена" : "Организации не подключены";
      }
      if (isManagerPreset) {
        return childIn.trim() ? "Специалист подключён" : "Специалисты не подключены";
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
      return name || "Не заполнено";
    }
    case "modules": {
      const bundles = SPECIALIST_PRODUCT_BUNDLES.filter((b) => !b.schoolLikeOnly || schoolLike);
      const enabled = bundles.filter((b) => isBundleEnabled(b.id, modules));
      if (enabled.length === 0) return "Модули не выбраны";
      if (enabled.length === 1) return locale.startsWith("ru") ? enabled[0].title_ru : (enabled[0].title_en || enabled[0].title_ru);
      const n = enabled.length;
      const modWord = n % 10 === 1 && n % 100 !== 11 ? "модуль" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "модуля" : "модулей";
      return `${n} ${modWord}`;
    }
    case "site_widgets":
      return "Виджеты для сайта";
    default:
      return null;
  }
}
