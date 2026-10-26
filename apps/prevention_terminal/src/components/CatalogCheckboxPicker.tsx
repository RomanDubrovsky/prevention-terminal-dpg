import { useMemo, useState } from "react";

import {
  addCustomSessionTag,
  filterSessionTagCatalog,
  formatSessionTagSelectionSummary,
  removeCustomSessionTag,
  toggleSessionTagCatalog,
  type SessionTagCatalogItem,
  type SessionTagSelection,
} from "../lib/session_tagging.ts";

interface CatalogCheckboxPickerProps {
  title: string;
  hint?: string;
  catalog: SessionTagCatalogItem[];
  allowedIds: Map<string, SessionTagCatalogItem>;
  value: SessionTagSelection;
  onChange: (value: SessionTagSelection) => void;
  labelForId: (id: string) => string;
  disabled?: boolean;
  customPlaceholder?: string;
  allowCustom?: boolean;
}

export default function CatalogCheckboxPicker(props: CatalogCheckboxPickerProps) {
  const {
    title,
    hint,
    catalog,
    allowedIds,
    value,
    onChange,
    labelForId,
    disabled,
    customPlaceholder = "Если нет в списке — опишите свой вариант",
    allowCustom = true,
  } = props;
  const [filter, setFilter] = useState("");
  const [customDraft, setCustomDraft] = useState("");

  const visibleItems = useMemo(() => filterSessionTagCatalog(catalog, filter), [catalog, filter]);
  const summary = formatSessionTagSelectionSummary(value, labelForId);

  function handleAddCustom() {
    const next = addCustomSessionTag(value, customDraft);
    if (next.custom.length !== value.custom.length) {
      onChange(next);
      setCustomDraft("");
    }
  }

  return (
    <div className="catalog-checkbox-picker field wide">
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

      <ul className="catalog-checkbox-options">
        {visibleItems.length === 0 ? (
          <li className="muted tiny">По запросу ничего не найдено.</li>
        ) : (
          visibleItems.map((item) => {
            const checked = value.catalog.includes(item.id);
            return (
              <li key={item.id}>
                <label className={`catalog-checkbox-option${checked ? " checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onChange(toggleSessionTagCatalog(value, item.id, allowedIds))}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            );
          })
        )}
      </ul>

      {allowCustom && (
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
      )}

      {summary ? <p className="muted tiny catalog-checkbox-summary">Выбрано: {summary}</p> : null}
    </div>
  );
}
