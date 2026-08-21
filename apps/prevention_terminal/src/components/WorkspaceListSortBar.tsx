import { t } from "../lib/i18n.ts";

interface SortOption<T extends string> {
  id: T;
  label: string;
}

interface WorkspaceListSortBarProps<T extends string> {
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function WorkspaceListSortBar<T extends string>(props: WorkspaceListSortBarProps<T>) {
  const { options, value, onChange, className = "" } = props;
  return (
    <div
      className={`consultation-journal-sort workspace-list-sort${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={t("Сортировка списка", "List Sorting")}
    >
      <span className="muted tiny consultation-journal-sort-label">{t("Сортировка", "Sorting")}</span>
      <div className="consultation-journal-sort-options">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={value === opt.id ? "active" : ""}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
