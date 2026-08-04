import { parseConsultationSession } from "../lib/consultation_session.ts";
import type { WorkLogEntry } from "../lib/worklog.ts";
import { t } from "../lib/i18n.ts";

export type VisitSelection =
  | { kind: "visit"; entryId: string }
  | { kind: "new-visit" };

export interface ConsultationVisitStripProps {
  visits: WorkLogEntry[];
  selection: VisitSelection;
  onSelect: (next: VisitSelection) => void;
}

function formatEpochDate(epochSeconds: string): string {
  const sec = Number.parseInt(epochSeconds, 10);
  if (!Number.isFinite(sec)) return "";
  return new Date(sec * 1000).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function visitTileLabel(entry: WorkLogEntry): string {
  try {
    const session = parseConsultationSession(entry.note);
    if (session.visitDate) {
      const d = new Date(session.visitDate);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    }
  } catch {
    /* ignore */
  }
  return formatEpochDate(entry.created_at) || t("Приём", "Visit");
}

function visitTileMeta(entry: WorkLogEntry): string {
  const mins = Number(entry.minutes);
  return Number.isFinite(mins) && mins > 0 ? `${mins} ${t("мин", "min")}` : t("сохранён", "saved");
}

export default function ConsultationVisitStrip(props: ConsultationVisitStripProps) {
  const { visits, selection, onSelect } = props;

  return (
    <div className="consultation-visit-strip" role="tablist" aria-label={t("Приёмы", "Visits")}>
      {visits.map((entry) => (
        <button
          key={entry.entry_id}
          type="button"
          role="tab"
          className={`consultation-visit-tile${selection.kind === "visit" && selection.entryId === entry.entry_id ? " active" : ""} filled`}
          aria-selected={selection.kind === "visit" && selection.entryId === entry.entry_id}
          onClick={() => onSelect({ kind: "visit", entryId: entry.entry_id })}
        >
          <strong>{visitTileLabel(entry)}</strong>
          <span className="muted tiny">{visitTileMeta(entry)}</span>
        </button>
      ))}

      <button
        type="button"
        className={`consultation-visit-tile consultation-visit-tile--add${selection.kind === "new-visit" ? " active" : ""}`}
        onClick={() => onSelect({ kind: "new-visit" })}
      >
        <strong>+ {t("Приём", "Visit")}</strong>
      </button>
    </div>
  );
}
