import type { ReactNode } from "react";

interface AiCreateReportBlockProps {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  hint: string;
  idleLabel?: string;
  busyLabel?: string;
  children?: ReactNode;
}

/** Shared teal full-width report button chrome used by case + consultation. */
export default function AiCreateReportBlock(props: AiCreateReportBlockProps) {
  const {
    busy,
    disabled,
    onClick,
    hint,
    idleLabel = "Сформировать отчет",
    busyLabel = "Формируем отчёт…",
    children,
  } = props;
  return (
    <div className="consultation-create-report">
      <button
        type="button"
        className="ob-btn consultation-create-report-btn"
        disabled={busy || disabled}
        onClick={onClick}
      >
        {busy ? busyLabel : idleLabel}
      </button>
      <p className="muted tiny">{hint}</p>
      {children}
    </div>
  );
}
