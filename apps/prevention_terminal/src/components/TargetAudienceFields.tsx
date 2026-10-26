import { useEffect } from "react";
import {
  AGE_BAND_OPTIONS_BY_CONTEXT,
  defaultAgeBandForContext,
  getAudienceGroupLabel,
  getTargetCategoriesForContext,
  getTargetCategoryHint,
  getTargetCategoryLabel,
  resolveAudienceContext,
  type AudienceContext,
  type StudentAgeBand,
  type TargetAudienceData,
  type TargetCategory,
} from "../lib/target_audience.ts";
import { isIntlEdition, t } from "../lib/i18n.ts";

interface TargetAudienceFieldsProps {
  value: TargetAudienceData;
  onChange: (next: TargetAudienceData) => void;
  disabled?: boolean;
  /** Свободный текст — для последующей обработки ИИ; доступен только с подпиской. */
  aiEnabled?: boolean;
  /** Контекст организации: образование, коммерческая практика (IDA) или корпоративный (Corporate Health) */
  context?: AudienceContext;
}

export default function TargetAudienceFields(props: TargetAudienceFieldsProps) {
  const { value, onChange, disabled, aiEnabled = false, context } = props;
  const ctx: AudienceContext = context || resolveAudienceContext();
  const isEn = isIntlEdition();

  useEffect(() => {
    if (!aiEnabled && value.mode === "free_text") {
      onChange({ ...value, mode: "structured" });
    }
  }, [aiEnabled, value.mode]);

  function setMode(mode: TargetAudienceData["mode"]) {
    if (mode === "free_text" && !aiEnabled) return;
    onChange({ ...value, mode });
  }

  function setCategory(category: TargetCategory) {
    onChange({ ...value, category });
  }

  function setCustomCategory(customCategory: string) {
    onChange({ ...value, customCategory });
  }

  function updateGroup(
    group: TargetAudienceData["groups"][number]["group"],
    patch: Partial<TargetAudienceData["groups"][number]>,
  ) {
    onChange({
      ...value,
      groups: value.groups.map((row) => (row.group === group ? { ...row, ...patch } : row)),
    });
  }

  const currentCategory = value.category || "universal";
  const categoryValues = getTargetCategoriesForContext(ctx);
  const categoryHint = getTargetCategoryHint(currentCategory, ctx);
  const ageBandOptions = AGE_BAND_OPTIONS_BY_CONTEXT[ctx] || AGE_BAND_OPTIONS_BY_CONTEXT.education;

  const customCategoryPlaceholder =
    ctx === "corporate"
      ? t(
          "Например: Новые тимлиды на испытательном сроке, дежурная смена SRE...",
          "e.g. New leads on probation, on-call SRE shift...",
        )
      : ctx === "commercial"
        ? t(
            "Например: Женская группа поддержки, участники после развода...",
            "e.g. Women's support group, post-divorce clients...",
          )
        : t(
            "Например: Подростки-сироты и опекаемые, кадетские классы, студенты 1 курса...",
            "e.g. Foster teens, cadet classes, 1st year students...",
          );

  const freeTextPlaceholder =
    ctx === "corporate"
      ? t(
          "Например: Backend-команда (12 чел.), тимлиды финтеха (4 чел.)",
          "e.g. Backend team (12 people), fintech leads (4 people)",
        )
      : ctx === "commercial"
        ? t(
            "Например: Группа тревожности (8 чел.), родственники (4 чел.)",
            "e.g. Anxiety group (8 people), family members (4 people)",
          )
        : t(
            "Например: 7А–7В классы (28 чел.), родители 5–6 классов",
            "e.g. Grades 7A-7B (28 students), parents of 5-6th graders",
          );

  return (
    <div className="target-audience-fields">
      <div className="target-audience-category-block">
        <label className="field wide">
          <span>{t("Целевая группа", "Target audience")}</span>
          <select
            value={currentCategory}
            disabled={disabled}
            onChange={(e) => setCategory(e.target.value as TargetCategory)}
          >
            {categoryValues.map((catKey) => (
              <option key={catKey} value={catKey}>
                {getTargetCategoryLabel(catKey, ctx, isEn ? "en" : "ru")}
              </option>
            ))}
          </select>
        </label>

        {currentCategory === "custom" && (
          <label className="field wide target-audience-custom-field">
            <span>{t("Впишите свой вариант целевой группы", "Enter custom target group")}</span>
            <input
              type="text"
              value={value.customCategory || ""}
              disabled={disabled}
              placeholder={customCategoryPlaceholder}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          </label>
        )}

        {categoryHint && (
          <p className="muted tiny target-audience-category-hint">
            💡 {categoryHint}
          </p>
        )}
      </div>

      <div
        className="target-audience-mode"
        role="radiogroup"
        aria-label={t("Способ указания состава участников", "Participants specification mode")}
      >
        <label className="target-audience-mode-option">
          <input
            type="radio"
            name="audience-mode"
            checked={value.mode === "structured"}
            disabled={disabled}
            onChange={() => setMode("structured")}
          />
          <span>{t("Состав участников и охват", "Participants and reach")}</span>
        </label>
        <label className={`target-audience-mode-option${!aiEnabled ? " locked" : ""}`}>
          <input
            type="radio"
            name="audience-mode"
            checked={value.mode === "free_text"}
            disabled={disabled || !aiEnabled}
            onChange={() => setMode("free_text")}
          />
          <span>{t("Свободный текст (для ИИ)", "Free text (for AI)")}</span>
        </label>
      </div>

      {!aiEnabled && value.mode === "free_text" && (
        <p className="muted tiny target-audience-ai-hint">
          {t(
            "Свободный текст предназначен для последующей обработки ИИ (целевая группа и охват в отчёте). Для этого режима нужна подписка ИИ — используйте поля ниже или подключите подписку в шапке терминала.",
            "Free text is for AI processing. AI subscription is required.",
          )}
        </p>
      )}

      {value.mode === "free_text" ? (
        <>
          {aiEnabled && (
            <p className="muted tiny target-audience-ai-hint">
              {t(
                "Опишите целевую группу свободно — ИИ разберёт формулировку при формировании плана и отчёта.",
                "Describe target audience in free text — AI will parse it when generating plan and report.",
              )}
            </p>
          )}
          <label className="field wide">
            <span>{t("Участники (свободный ввод)", "Participants (free text)")}</span>
            <textarea
              rows={2}
              value={value.freeText}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, freeText: e.target.value })}
              placeholder={freeTextPlaceholder}
            />
          </label>
        </>
      ) : (
        <div className="target-audience-groups">
          {value.groups.map((row) => (
            <div key={row.group} className="target-audience-row">
              <label className="target-audience-check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={disabled}
                  onChange={(e) => updateGroup(row.group, { enabled: e.target.checked })}
                />
                <span>{getAudienceGroupLabel(row.group, ctx, isEn ? "en" : "ru")}</span>
              </label>
              {row.enabled && row.group === "students" && (
                <label className="field target-audience-age">
                  <span className="tiny muted">
                    {ctx === "corporate" ? t("Уровень / роль", "Level / Role") : t("Возраст", "Age")}
                  </span>
                  <select
                    value={row.ageBand || defaultAgeBandForContext(ctx)}
                    disabled={disabled}
                    onChange={(e) =>
                      updateGroup(row.group, { ageBand: e.target.value as StudentAgeBand })
                    }
                  >
                    {ageBandOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isEn ? opt.labelEn : opt.labelRu}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {row.enabled && (
                <label className="field target-audience-count">
                  <span className="tiny muted">{t("Человек", "Persons")}</span>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    placeholder="—"
                    value={row.count ?? ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      const num = v === "" ? null : Number(v);
                      updateGroup(row.group, {
                        count: Number.isFinite(num) && num !== null && num >= 0 ? num : null,
                      });
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
