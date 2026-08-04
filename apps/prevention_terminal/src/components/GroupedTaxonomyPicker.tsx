import { useEffect, useMemo, useState } from "react";

import {
  addCustomSessionTag,
  formatSessionTagSelectionSummary,
  removeCustomSessionTag,
  toggleSessionTagCatalog,
  type SessionTagCatalogItem,
  type SessionTagSelection,
} from "../lib/session_tagging.ts";
import {
  problemKeyGroupsForOrg,
  problemKeyAllowedMap,
  problemKeyLabel,
} from "../lib/taxonomy_picker.ts";
import {
  readTaxonomyGroupsMode,
  writeTaxonomyGroupsMode,
  type TaxonomyGroupsMode,
} from "../lib/taxonomy_groups_ui.ts";
import TaxonomyGroupsToolbar from "./TaxonomyGroupsToolbar.tsx";

interface GroupedTaxonomyPickerProps {
  title: string;
  hint?: string;
  commercial: boolean;
  value: SessionTagSelection;
  onChange: (value: SessionTagSelection) => void;
  disabled?: boolean;
  customPlaceholder?: string;
}

export default function GroupedTaxonomyPicker(props: GroupedTaxonomyPickerProps) {
  const {
    title,
    hint,
    commercial,
    value,
    onChange,
    disabled,
    customPlaceholder = "Если нет в списке — опишите свой вариант",
  } = props;
  const [filter, setFilter] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [groupsMode, setGroupsMode] = useState<TaxonomyGroupsMode>(() => readTaxonomyGroupsMode());

  const allowed = useMemo(() => problemKeyAllowedMap(commercial), [commercial]);
  const groups = useMemo(() => problemKeyGroupsForOrg(commercial), [commercial]);
  const summary = formatSessionTagSelectionSummary(value, problemKeyLabel);
  const filtering = filter.trim().length > 0;

  const visibleGroups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((grp) => ({
        ...grp,
        keys: grp.keys.filter((key) => {
          const label = problemKeyLabel(key).toLowerCase();
          return label.includes(needle) || key.toLowerCase().includes(needle);
        }),
      }))
      .filter((grp) => grp.keys.length > 0);
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

  function handleAddCustom() {
    const next = addCustomSessionTag(value, customDraft);
    if (next.custom.length !== value.custom.length) {
      onChange(next);
      setCustomDraft("");
    }
  }

  return (
    <div className="grouped-taxonomy-picker field wide">
      <div className="catalog-checkbox-picker-head">
        <span>{title}</span>
        {hint ? <p className="muted tiny">{hint}</p> : null}
      </div>

      <label className="field">
        <span className="tiny muted">Поиск</span>
        <input
          type="search"
          value={filter}
          disabled={disabled}
          placeholder="Начните вводить название…"
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
        <p className="muted tiny">По запросу ничего не найдено.</p>
      ) : (
        visibleGroups.map((grp) => {
          const open = filtering || openGroupIds.has(grp.id);
          const selectedInGroup = grp.keys.filter((key) => value.catalog.includes(key)).length;
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
                  <span className="muted tiny"> · выбрано {selectedInGroup}</span>
                ) : null}
              </summary>
              <ul className="catalog-checkbox-options">
                {grp.keys.map((key) => {
                  const item: SessionTagCatalogItem = { id: key, label: problemKeyLabel(key) };
                  const checked = value.catalog.includes(key);
                  return (
                    <li key={key}>
                      <label className={`catalog-checkbox-option${checked ? " checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onChange(toggleSessionTagCatalog(value, key, allowed))}
                        />
                        <span>{item.label}</span>
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
          <span className="tiny muted">Свой вариант</span>
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
              Добавить
            </button>
          </div>
        </label>
        {value.custom.length > 0 ? (
          <ul className="catalog-checkbox-custom-list">
            {value.custom.map((text, index) => (
              <li key={`${text}-${index}`}>
                <span>{text}</span>
                <button
                  type="button"
                  className="catalog-checkbox-remove"
                  disabled={disabled}
                  aria-label={`Удалить «${text}»`}
                  onClick={() => onChange(removeCustomSessionTag(value, index))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {summary ? <p className="muted tiny catalog-checkbox-summary">Выбрано: {summary}</p> : null}
    </div>
  );
}
