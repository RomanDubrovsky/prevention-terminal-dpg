import CatalogCheckboxPicker from "./CatalogCheckboxPicker.tsx";
import ClientIntakeThemesPicker from "./ClientIntakeThemesPicker.tsx";
import GroupedTaxonomyPicker from "./GroupedTaxonomyPicker.tsx";
import {
  methodTagLabel,
  profileIncludesMethods,
  SESSION_FORMAT_TAG_CATALOG,
  SESSION_METHOD_CATALOG,
  sessionFormatLabel,
  type ConsultationSessionTags,
  type SessionTagsProfile,
} from "../lib/session_tagging.ts";
import { problemKeyAllowedMap } from "../lib/taxonomy_picker.ts";
import { useMemo, type ReactNode } from "react";
import { t } from "../lib/i18n.ts";

const PROFILE_COPY: Record<
  SessionTagsProfile,
  { intro: string; themesHint: string; methodsHint?: string; themesTitle: string }
> = {
  consultation: {
    intro: t(
      "Темы сопровождения — тот же справочник формулировок, что и причины обращения в карточке. Формат и методы — таксономия платформы.",
      "Support themes — same wording dictionary as reasons for referral in the profile. Format and methods — platform taxonomy."
    ),
    themesTitle: t("Темы сопровождения", "Support themes"),
    themesHint: t(
      "Что берёте в работу на этом приёме (можно несколько). Те же пункты, что в карточке.",
      "What you are working on during this session (can select multiple). Same items as in the profile."
    ),
    methodsHint: t("method_tag: через какую оптику работали (КПТ, ННО…).", "method_tag: what lens you worked through (CBT, NVC...)."),
  },
  group: {
    intro: t("Тематический фокус цикла групповой работы — те же формулировки, что в консультациях.", "Thematic focus of the group work cycle — same wording as in consultations."),
    themesTitle: t("Темы работы", "Themes of work"),
    themesHint: t("С какими темами связан этот план занятий.", "What themes this lesson plan is related to."),
  },
  ipr: {
    intro: t("Тематика и методы плана ИПР — единый справочник для отчётности и контекста ИИ.", "Themes and methods of the IRP plan — unified dictionary for reporting and AI context."),
    themesTitle: t("Темы маршрута", "Route themes"),
    themesHint: t("Основные темы плана.", "Main themes of the plan."),
    methodsHint: t("method_tag, заложенные в план.", "method_tag included in the plan."),
  },
  themes_only: {
    intro: t("Только тематический фокус работы.", "Only the thematic focus of the work."),
    themesTitle: t("Темы работы", "Themes of work"),
    themesHint: t("Выберите темы для работы.", "Select themes for work."),
  },
  formats_methods: {
    intro: t("Форматы и методы работы без привязки к конкретным темам.", "Formats and methods of work without linking to specific themes."),
    themesTitle: t("Форматы", "Formats"),
    themesHint: t("Форматы взаимодействия.", "Interaction formats."),
    methodsHint: t("Методы работы.", "Methods of work."),
  },
};

interface SessionTagsEditorProps {
  profile: SessionTagsProfile;
  commercial: boolean;
  value: ConsultationSessionTags;
  onChange: (value: ConsultationSessionTags) => void;
  disabled?: boolean;
  aiAction?: ReactNode;
  /** Hide problem_key picker (e.g. step 3 — formats/methods only). */
  hideThemes?: boolean;
  /** Hide format/method pickers (e.g. step 2 — themes only). */
  hideFormatsAndMethods?: boolean;
}

export default function SessionTagsEditor(props: SessionTagsEditorProps) {
  const {
    profile,
    commercial,
    value,
    onChange,
    disabled,
    aiAction,
    hideThemes = false,
    hideFormatsAndMethods = false,
  } = props;
  const copy = PROFILE_COPY[profile];
  const showMethods = profileIncludesMethods(profile);
  const useClientThemes = commercial;

  const methodAllowed = useMemo(
    () => new Map(SESSION_METHOD_CATALOG.map((item) => [item.id, item])),
    [],
  );
  const formatAllowed = useMemo(
    () => new Map(SESSION_FORMAT_TAG_CATALOG.map((item) => [item.id, item])),
    [],
  );

  return (
    <div className="consultation-session-tags field wide">
      <div className="consultation-session-tags-head">
        <p className="muted tiny consultation-session-tags-intro">{copy.intro}</p>
        {aiAction && !useClientThemes ? aiAction : null}
      </div>
      {!hideThemes ? (
        useClientThemes ? (
          <ClientIntakeThemesPicker
            title={copy.themesTitle}
            hint={copy.themesHint}
            commercial={commercial}
            value={value.themes}
            onChange={(themes) => onChange({ ...value, themes })}
            disabled={disabled}
            customPlaceholder={t("Например: конфликт с учителем", "For example: conflict with a teacher")}
            aiAction={aiAction}
          />
        ) : (
          <GroupedTaxonomyPicker
            title={copy.themesTitle}
            hint={copy.themesHint}
            commercial={commercial}
            value={value.themes}
            onChange={(themes) => onChange({ ...value, themes })}
            disabled={disabled}
            customPlaceholder={t("Например: конфликт с учителем", "For example: conflict with a teacher")}
          />
        )
      ) : null}
      {showMethods && profile === "consultation" && !hideFormatsAndMethods ? (
        <CatalogCheckboxPicker
          title={t("Формат сессии", "Session format")}
          hint={t("Что делали в кабинете: диагностика, медиация, рабочая сессия…", "What was done in the office: diagnostics, mediation, working session...")}
          catalog={SESSION_FORMAT_TAG_CATALOG}
          allowedIds={formatAllowed}
          value={value.formats}
          labelForId={sessionFormatLabel}
          onChange={(formats) => onChange({ ...value, formats })}
          disabled={disabled}
          customPlaceholder={t("Например: супервизия коллеги", "For example: peer supervision")}
        />
      ) : null}
      {showMethods && !hideFormatsAndMethods ? (
        <CatalogCheckboxPicker
          title={t("Терапевтические подходы", "Therapeutic approaches")}
          hint={copy.methodsHint}
          catalog={SESSION_METHOD_CATALOG}
          allowedIds={methodAllowed}
          value={value.methods}
          labelForId={methodTagLabel}
          onChange={(methods) => onChange({ ...value, methods })}
          disabled={disabled}
          customPlaceholder={t("Например: арт-терапия, метафорические карты", "For example: art therapy, metaphorical cards")}
        />
      ) : null}
    </div>
  );
}

export { problemKeyAllowedMap };
