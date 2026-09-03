import { useMemo, useState } from "react";

import { PREVENTION_LINK_LABELS_RU, type PreventionLink } from "../lib/prevention_link.ts";
import {
  addCustomWorkType,
  filterPreventionWorkTypesCatalog,
  formatPreventionWorkTypesSummary,
  preventionWorkTypesGroupedByTier,
  removeCustomWorkType,
  toggleCatalogWorkType,
  type PreventionWorkTypesSelection,
} from "../lib/prevention_work_types.ts";

interface PreventionWorkTypesPickerProps {
  value: PreventionWorkTypesSelection;
  onChange: (value: PreventionWorkTypesSelection) => void;
  preventionLink?: PreventionLink | "";
  disabled?: boolean;
  /** School: flat checkbox list without tier/link headings. */
  compact?: boolean;
  allowCustom?: boolean;
}

export default function PreventionWorkTypesPicker(props: PreventionWorkTypesPickerProps) {
  const { value, onChange, preventionLink, disabled, compact = false, allowCustom = true } = props;
  const [filter, setFilter] = useState("");
  const [customDraft, setCustomDraft] = useState("");

  const grouped = useMemo(() => preventionWorkTypesGroupedByTier(), []);
  const visibleGroups = useMemo(
    () => filterPreventionWorkTypesCatalog(grouped, filter),
    [grouped, filter],
  );
  const summary = formatPreventionWorkTypesSummary(value);

  function handleAddCustom() {
    const next = addCustomWorkType(value, customDraft);
    if (next.custom.length !== value.custom.length) {
      onChange(next);
      setCustomDraft("");
    }
  }

  return (
    <div className="prevention-work-types-picker field wide">
      <div className="prevention-work-types-head">
        <span>Виды профилактической работы</span>
        <p className="muted tiny">
          Отметьте один или несколько пунктов из справочника. Если нужного вида нет — добавьте свой.
        </p>
      </div>

      {preventionLink && !compact ? (
        <p className="muted tiny prevention-work-types-link-hint">
          Звено: <strong>{PREVENTION_LINK_LABELS_RU[preventionLink]}</strong> — подходящие виды выделены ниже.
        </p>
      ) : null}

      {!compact && (
      <label className="field">
        <span className="tiny muted">Поиск по справочнику</span>
        <input
          type="search"
          value={filter}
          disabled={disabled}
          placeholder="Например: групповая, тренинг, кейс-менеджмент…"
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>
      )}

      <div className={`prevention-work-types-catalog${compact ? " prevention-work-types-catalog--compact" : ""}`}>
        {visibleGroups.length === 0 ? (
          <p className="muted tiny">По запросу ничего не найдено.</p>
        ) : compact ? (
          <ul className="prevention-work-types-options prevention-work-types-options--flat">
            {visibleGroups.flatMap((group) =>
              group.links.flatMap((linkGroup) =>
                linkGroup.items.map((item) => {
                  const checked = value.catalog.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label className={`prevention-work-type-option${checked ? " checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onChange(toggleCatalogWorkType(value, item.id))}
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  );
                }),
              ),
            )}
          </ul>
        ) : (
          visibleGroups.map((group) => (
            <section key={group.tier} className="prevention-work-types-tier">
              <h4>{group.label}</h4>
              {group.links.map((linkGroup) => (
                <div
                  key={linkGroup.link}
                  className={`prevention-work-types-link-group${
                    preventionLink === linkGroup.link ? " prevention-work-types-link-group-active" : ""
                  }`}
                >
                  <h5>{linkGroup.linkLabel}</h5>
                  <ul className="prevention-work-types-options">
                    {linkGroup.items.map((item) => {
                      const checked = value.catalog.includes(item.id);
                      return (
                        <li key={item.id}>
                          <label className={`prevention-work-type-option${checked ? " checked" : ""}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => onChange(toggleCatalogWorkType(value, item.id))}
                            />
                            <span>{item.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      {allowCustom && (
      <div className="prevention-work-types-custom">
        <label className="field">
          <span className="tiny muted">Свой вариант</span>
          <div className="prevention-work-types-custom-row">
            <input
              type="text"
              value={customDraft}
              disabled={disabled}
              placeholder="Если нет в списке — опишите вид работы"
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
          <ul className="prevention-work-types-custom-list">
            {value.custom.map((text, index) => (
              <li key={`${text}-${index}`}>
                <span>{text}</span>
                <button
                  type="button"
                  className="prevention-work-types-remove"
                  disabled={disabled}
                  aria-label={`Удалить «${text}»`}
                  onClick={() => onChange(removeCustomWorkType(value, index))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      )}

      {summary ? <p className="muted tiny prevention-work-types-summary">Выбрано: {summary}</p> : null}
    </div>
  );
}
