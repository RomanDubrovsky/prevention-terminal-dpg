import { useEffect, useMemo, useState, type ReactNode } from "react";
import { t } from "../lib/i18n.ts";

import {
  addCustomSessionTag,
  removeCustomSessionTag,
  type SessionTagSelection,
} from "../lib/session_tagging.ts";
import {
  clientIntakeThemeGroups,
  formatIntakeThemesSummary,
  intakeThemeSelectionFromDraft,
  themeMatchesFilter,
  toSessionProblemThemes,
  toggleIntakeTheme,
  type IntakeThemeSelection,
} from "../lib/client_intake_themes.ts";
import {
  readTaxonomyGroupsMode,
  writeTaxonomyGroupsMode,
  type TaxonomyGroupsMode,
} from "../lib/taxonomy_groups_ui.ts";
import TaxonomyGroupsToolbar from "./TaxonomyGroupsToolbar.tsx";

interface ClientIntakeThemesPickerProps {
  title: string;
  hint?: string;
  commercial: boolean;
  value: SessionTagSelection & { intake_theme_ids?: string[] };
  onChange: (value: SessionTagSelection & { intake_theme_ids?: string[] }) => void;
  disabled?: boolean;
  customPlaceholder?: string;
  aiAction?: ReactNode;
}

export default function ClientIntakeThemesPicker(props: ClientIntakeThemesPickerProps) {
  const {
    title,
    hint,
    commercial,
    value,
    onChange,
    disabled,
    customPlaceholder = t("Если темы нет в списке — опишите своими словами", "If topic is not in the list — describe in your own words"),
    aiAction,
  } = props;
  const [filter, setFilter] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [groupsMode, setGroupsMode] = useState<TaxonomyGroupsMode>(() => readTaxonomyGroupsMode());

  const selection = useMemo(
    () => intakeThemeSelectionFromDraft(value, commercial),
    [commercial, value],
  );
  const groups = useMemo(() => clientIntakeThemeGroups(), []);
  const summary = formatIntakeThemesSummary(selection);
  const filtering = filter.trim().length > 0;

  const visibleGroups = useMemo(() => {
    const needle = filter.trim();
    if (!needle) return groups;
    return groups
      .map((grp) => ({
        ...grp,
        themes: grp.themes.filter((theme) => themeMatchesFilter(theme, needle)),
      }))
      .filter((grp) => grp.themes.length > 0);
  }, [filter, groups]);

  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => {
    const mode = readTaxonomyGroupsMode();
    return mode === "expanded" ? new Set(groups.map((g) => g.id)) : new Set();
  });

  useEffect(() => {
    if (groupsMode === "expanded") {
      setOpenGroupIds(new Set(groups.map((g) => g.id)));
    } else if (!filtering) {
      setOpenGroupIds(new Set());
    }
  }, [groups, groupsMode, filtering]);

  function setMode(mode: TaxonomyGroupsMode) {
    setGroupsMode(mode);
    writeTaxonomyGroupsMode(mode);
    setOpenGroupIds(mode === "expanded" ? new Set(groups.map((g) => g.id)) : new Set());
  }

  function toggleGroup(id: string) {
    setOpenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function emit(next: IntakeThemeSelection) {
    onChange(toSessionProblemThemes(next));
  }

  function handleAddCustom() {
    const base: SessionTagSelection = { catalog: selection.catalog, custom: selection.custom };
    const nextCustom = addCustomSessionTag(base, customDraft);
    if (nextCustom.custom.length !== base.custom.length) {
      emit({ ...selection, custom: nextCustom.custom });
      setCustomDraft("");
    }
  }

  return (
    <div className="grouped-taxonomy-picker client-intake-themes-picker field wide">
      <div className="catalog-checkbox-picker-head">
        <div className="catalog-checkbox-picker-head-row">
          <span>{title}</span>
          {aiAction}
        </div>
        {hint ? <p className="muted tiny">{hint}</p> : null}
      </div>

      <label className="field">
        <span className="tiny muted">{t("Поиск по формулировке", "Search by keyword")}</span>
        <input
          type="search"
          value={filter}
          disabled={disabled}
          placeholder={t("Например: тревога, развод, подросток…", "e.g. anxiety, divorce, adolescent...")}
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>

      <TaxonomyGroupsToolbar
        mode={groupsMode}
        disabled={disabled}
        onExpandAll={() => setMode("expanded")}
        onCollapseAll={() => setMode("collapsed")}
      />

      {visibleGroups.length === 0 ? (
        <p className="muted tiny">{t("По запросу ничего не найдено — добавьте свой вариант ниже.", "No results found — add a custom option below.")}</p>
      ) : (
        visibleGroups.map((grp) => {
          const open = filtering || openGroupIds.has(grp.id);
          const selectedInGroup = grp.themes.filter((t) =>
            selection.intake_theme_ids.includes(t.id),
          ).length;
          return (
            <details key={grp.id} className="grouped-taxonomy-group" open={open}>
              <summary
                className="grouped-taxonomy-group-label"
                onClick={(e) => {
                  e.preventDefault();
                  if (!filtering && !disabled) toggleGroup(grp.id);
                }}
              >
                {grp.label}
                {selectedInGroup > 0 ? (
                  <span className="muted tiny">{t(` · выбрано ${selectedInGroup}`, ` · selected ${selectedInGroup}`)}</span>
                ) : null}
              </summary>
              <ul className="catalog-checkbox-options">
                {grp.themes.map((theme) => {
                  const checked = selection.intake_theme_ids.includes(theme.id);
                  return (
                    <li key={theme.id}>
                      <label className={`catalog-checkbox-option${checked ? " checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => emit(toggleIntakeTheme(selection, theme.id, commercial))}
                        />
                        <span>{theme.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })
      )}

      <div className="catalog-checkbox-custom">
        <label className="field">
          <span className="tiny muted">{t("Свой вариант", "Custom option")}</span>
          <div className="catalog-checkbox-custom-row">
            <input
              type="text"
              value={customDraft}
              disabled={disabled}
              placeholder={customPlaceholder}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
            />
            <button
              type="button"
              className="ob-btn secondary"
              disabled={disabled || !customDraft.trim()}
              onClick={handleAddCustom}
            >
              {t("Добавить", "Add")}
            </button>
          </div>
        </label>
        {selection.custom.length > 0 ? (
          <ul className="catalog-checkbox-custom-list">
            {selection.custom.map((text, index) => (
              <li key={`${text}-${index}`}>
                <span>{text}</span>
                <button
                  type="button"
                  className="catalog-checkbox-remove"
                  disabled={disabled}
                  aria-label={t(`Удалить «${text}»`, `Remove '${text}'`)}
                  onClick={() => {
                    const next = removeCustomSessionTag(
                      { catalog: selection.catalog, custom: selection.custom },
                      index,
                    );
                    emit({ ...selection, custom: next.custom });
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {summary ? <p className="muted tiny catalog-checkbox-summary">{t("Выбрано: ", "Selected: ")}{summary}</p> : null}
    </div>
  );
}
