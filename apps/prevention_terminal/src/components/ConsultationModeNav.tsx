import { t } from "../lib/i18n.ts";

export type ConsultationMainMode = "visits" | "expertise" | "summary";

interface ConsultationModeNavProps {
  mode: ConsultationMainMode;
  onChange: (mode: ConsultationMainMode) => void;
  summaryFilled?: boolean;
}

const MODES: { id: ConsultationMainMode; label: string; hint: string }[] = [
  { id: "visits", label: t("Приёмы", "Visits"), hint: t("Темы и история визитов", "Topics & visit history") },
  { id: "expertise", label: t("Экспертиза", "Expertise"), hint: t("Документы и анализ", "Documents & analysis") },
  { id: "summary", label: t("Итог", "Summary"), hint: t("Выводы и динамика дела", "Conclusions & case dynamics") },
];

export default function ConsultationModeNav(props: ConsultationModeNavProps) {
  const { mode, onChange, summaryFilled = false } = props;

  return (
    <div className="consultation-mode-nav" role="tablist" aria-label={t("Раздел консультации", "Consultation section")}>
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className={`consultation-mode-nav-btn${mode === item.id ? " active" : ""}${item.id === "summary" && summaryFilled ? " filled" : ""}`}
          aria-selected={mode === item.id}
          onClick={() => onChange(item.id)}
        >
          <strong>{item.label}</strong>
          <span className="muted tiny">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
