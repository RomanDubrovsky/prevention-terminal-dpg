import {
  formatWorkDuration,
  type WorkLogEntry,
} from "../lib/worklog.ts";
import {
  parseWorkLogNote,
  MODALITY_LABELS,
  RISK_LEVEL_LABELS,
  UNIFIED_SECTION_KEYS,
  UNIFIED_SECTION_TITLES,
} from "../lib/progress_note.ts";
import { parseConsultationSession } from "../lib/consultation_session.ts";
import { formatConsultationSessionTagsSummary } from "../lib/session_tagging.ts";
import { t } from "../lib/i18n.ts";

function formatTimestamp(raw: string): string {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds)) return raw;
  return new Date(seconds * 1000).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ProgressNoteEntryCardProps {
  entry: WorkLogEntry;
  sessionLabel: string;
  active?: boolean;
  onOpen?: () => void;
}

export function ProgressNoteEntryCard(props: ProgressNoteEntryCardProps) {
  const { entry, sessionLabel, active, onOpen } = props;
  const session = parseConsultationSession(entry.note);
  const parsed = parseWorkLogNote(entry.note);
  const tagsSummary = session.sessionTags
    ? formatConsultationSessionTagsSummary(session.sessionTags)
    : "";
  const hasArtifacts =
    Boolean(session.artifacts.plan_text) ||
    Boolean(session.artifacts.report_text) ||
    Boolean(session.artifacts.expert && Object.keys(session.artifacts.expert).length);

  return (
    <article
      className={`dap-note-entry${active ? " active" : ""}${onOpen ? " dap-note-entry--clickable" : ""}`}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => e.key === "Enter" && onOpen() : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <header>
        <div>
          <strong>{sessionLabel}</strong>
          <span className="muted tiny">
            {session.visitDate || formatTimestamp(entry.created_at)}
          </span>
        </div>
        <div className="dap-note-entry-meta">
          <span>{formatWorkDuration(entry.minutes)}</span>
          {parsed.kind === "structured" && (
            <>
              {parsed.migratedFrom && (
                <span className="muted tiny">{t("из", "from")} {parsed.migratedFrom}</span>
              )}
              <span>{MODALITY_LABELS[parsed.content.modality]}</span>
              {parsed.content.riskLevel !== "none" && (
                <span className="dap-risk-tag">{RISK_LEVEL_LABELS[parsed.content.riskLevel]}</span>
              )}
              {session.progress.modality === "pair" && (
                <span className="muted tiny">{t("парная", "pair")}</span>
              )}
              {hasArtifacts && <span className="muted tiny">{t("документы ✓", "documents ✓")}</span>}
              {tagsSummary && <span className="muted tiny">{tagsSummary}</span>}
            </>
          )}
          {parsed.kind === "legacy" && hasArtifacts && (
            <span className="muted tiny">{t("документы ✓", "documents ✓")}</span>
          )}
        </div>
      </header>

      {parsed.kind === "legacy" ? (
        <p className="muted">{parsed.text}</p>
      ) : (
        <dl className="dap-note-sections">
          {UNIFIED_SECTION_KEYS.map((key) => {
            const value = session.progress[key];
            if (!value.trim()) return null;
            return (
              <div key={key} className="dap-note-section-row">
                <dt>{UNIFIED_SECTION_TITLES[key]}</dt>
                <dd>{value}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </article>
  );
}

interface ConsultationHistoryListProps {
  entries: WorkLogEntry[];
  totalMinutes: string;
  savedEntryId: string | null;
  onSelectEntry: (entry: WorkLogEntry) => void;
  onNewSession: () => void;
  isBusy: boolean;
}

export function ConsultationHistoryList(props: ConsultationHistoryListProps) {
  const { entries, totalMinutes, savedEntryId, onSelectEntry, onNewSession, isBusy } = props;

  return (
    <section className="card workspace-journal-card">
      <div className="workspace-journal-head">
        <h3>{t("Журнал работы", "Work Journal")}</h3>
        <button type="button" className="ob-btn secondary" onClick={onNewSession} disabled={isBusy}>
          {t("Новая сессия", "New session")}
        </button>
      </div>
      <p className="muted tiny" style={{ marginBottom: "12px" }}>
        {t("Общее время:", "Total time:")} {totalMinutes}
      </p>

      {entries.length === 0 ? (
        <p className="muted">{t("Нет записей о консультациях.", "No consultation records.")}</p>
      ) : (
        <div className="dap-note-entries">
          {entries.map((entry, index) => {
            const sessionLabel = `${t("Сессия", "Session")} ${entries.length - index}`;
            return (
              <ProgressNoteEntryCard
                key={entry.entry_id}
                entry={entry}
                sessionLabel={sessionLabel}
                active={savedEntryId === entry.entry_id}
                onOpen={() => onSelectEntry(entry)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
