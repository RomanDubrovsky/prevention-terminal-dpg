import { useEffect, useId, useMemo, useState } from "react";

import {
  filterRegistrySubjectsByFio,
  type RegistrySubjectSummary,
} from "../lib/registry_store.ts";
import { t } from "../lib/i18n.ts";

export interface RegistrySubjectFioFieldProps {
  subjects: RegistrySubjectSummary[];
  selectedCaseId: string | null;
  onSelect: (row: RegistrySubjectSummary | null) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Школьный реестр: показывать «класс / группа» в подсказках. */
  showGradeClass?: boolean;
}

/** Поле ФИО с подсказками из реестра (консультации, ИПР и т.д.). */
export default function RegistrySubjectFioField(props: RegistrySubjectFioFieldProps) {
  const {
    subjects,
    selectedCaseId,
    onSelect,
    label = t("ФИО", "Full Name"),
    hint = t("Начните вводить фамилию — выберите человека из реестра.", "Start typing a last name — choose a person from the registry."),
    placeholder = t("Иванов Иван Иванович", "John Doe"),
    disabled,
    showGradeClass = true,
  } = props;

  const listId = useId();
  const selected = subjects.find((s) => s.case_id === selectedCaseId) ?? null;
  const [query, setQuery] = useState(selected?.profile.full_name ?? "");

  useEffect(() => {
    setQuery(selected?.profile.full_name ?? "");
  }, [selectedCaseId, selected?.profile.full_name]);

  const matches = useMemo(
    () => filterRegistrySubjectsByFio(subjects, query, selectedCaseId),
    [query, selectedCaseId, subjects],
  );

  const showSuggest = !disabled && query.trim().length >= 2 && matches.length > 0;

  function pick(row: RegistrySubjectSummary) {
    onSelect(row);
    setQuery(row.profile.full_name);
  }

  return (
    <label className="field wide registry-fio-field">
      <span>{label}</span>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={showSuggest ? listId : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (selectedCaseId) onSelect(null);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!selectedCaseId && query.trim()) {
              const exact = subjects.find(
                (s) => s.profile.full_name.toLowerCase() === query.trim().toLowerCase(),
              );
              if (exact) pick(exact);
            }
          }, 150);
        }}
      />
      {hint && <span className="muted tiny registry-fio-hint">{hint}</span>}
      {showSuggest && (
        <ul id={listId} className="registry-fio-suggest" role="listbox">
          {matches.map((row) => (
            <li key={row.case_id}>
              <button
                type="button"
                role="option"
                className="registry-fio-suggest-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <strong>{row.profile.full_name}</strong>
                {(showGradeClass ? row.profile.grade_class : "") || row.profile.age_years != null ? (
                  <span className="muted tiny">
                    {[
                      showGradeClass ? row.profile.grade_class : "",
                      row.profile.age_years != null ? t(`${row.profile.age_years} лет`, `${row.profile.age_years} y.o.`) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && matches.length === 0 && !selectedCaseId && (
        <span className="muted tiny registry-fio-hint">
          {t("В реестре нет такого ФИО — добавьте человека в разделе «Реестр».", "No such name in registry — add this person under 'Registry'.")}
        </span>
      )}
    </label>
  );
}
