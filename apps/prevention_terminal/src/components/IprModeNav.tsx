export type IprMainMode = "card" | "plan" | "report";

interface IprModeNavProps {
  mode: IprMainMode;
  onChange: (mode: IprMainMode) => void;
  planFilled?: boolean;
  reportFilled?: boolean;
}

const MODES: { id: IprMainMode; label: string; hint: string }[] = [
  { id: "card", label: "Карточка", hint: "Настройки и темы" },
  { id: "plan", label: "План ИПР", hint: "Список шагов и таблица" },
  { id: "report", label: "Отчет", hint: "Реализация и итоги" },
];

export default function IprModeNav(props: IprModeNavProps) {
  const { mode, onChange, planFilled = false, reportFilled = false } = props;

  return (
    <div className="consultation-mode-nav" role="tablist" aria-label="Раздел ИПР">
      {MODES.map((item) => {
        let filled = false;
        if (item.id === "plan" && planFilled) filled = true;
        if (item.id === "report" && reportFilled) filled = true;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`consultation-mode-nav-btn${mode === item.id ? " active" : ""}${filled ? " filled" : ""}`}
            aria-selected={mode === item.id}
            onClick={() => onChange(item.id)}
          >
            <strong>{item.label}</strong>
            <span className="muted tiny">{item.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
