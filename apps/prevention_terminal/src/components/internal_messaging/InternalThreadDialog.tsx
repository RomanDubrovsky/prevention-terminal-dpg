import { useState } from "react";
import { type InternalCaseRow, updateCloudCaseStatus } from "../../lib/inbox_client";
import { t } from "../../lib/i18n";
import { getTerminalEdition } from "../../lib/terminal_edition";

interface InternalThreadDialogProps {
  caseRow: InternalCaseRow;
  currentUserId: string;
  onClose: () => void;
  onUpdate: () => void;
}

function getInternalThreadStatusOptions() {
  return [
    { value: "new", label: t("Новый (в очереди)", "New (Queued)") },
    { value: "in_progress", label: t("В работе", "In Progress") },
    { value: "clarification_needed", label: t("Требует уточнений", "Clarification Needed") },
    { value: "consilium", label: t("Консилиум", "Case Conference") },
    { value: "resolved", label: t("Решен", "Resolved") },
    { value: "archived", label: t("В архиве", "Archived") },
  ];
}

export default function InternalThreadDialog({ caseRow, currentUserId, onClose, onUpdate }: InternalThreadDialogProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = getInternalThreadStatusOptions();
  const notes = caseRow.internal_notes || [];
  const dateLocale = getTerminalEdition() === "intl" ? "en-US" : "ru-RU";

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateCloudCaseStatus(caseRow.id, caseRow.status, newComment.trim(), currentUserId);
      setNewComment("");
      onUpdate();
    } catch (e: any) {
      setError(e.message || t("Ошибка при добавлении комментария", "Error adding comment"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (nextStatus: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateCloudCaseStatus(caseRow.id, nextStatus, undefined, currentUserId);
      onUpdate();
    } catch (e: any) {
      setError(e.message || t("Ошибка при смене статуса", "Error changing status"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div className="card" style={{ width: "600px", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>{t("Кейс:", "Case:")} {caseRow.topic}</h3>
          <button className="ob-btn ob-btn--ghost" onClick={onClose} aria-label={t("Закрыть", "Close")}>✕</button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px" }}>
          <div style={{ padding: "12px", background: "var(--surface-subtle)", borderRadius: "8px", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <strong>{t("Отправитель:", "Sender:")} {caseRow.sender_name || caseRow.sender_role || t("Анонимно", "Anonymous")}</strong>
              <span className="muted tiny">{new Date(caseRow.created_at).toLocaleString(dateLocale)}</span>
            </div>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{caseRow.content}</p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>{t("Статус:", "Status:")}</strong>
            <select
              value={caseRow.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isSubmitting}
              style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <h4 style={{ margin: "0 0 10px 0" }}>{t("Внутреннее обсуждение (Консилиум)", "Internal Discussion (Team Conference)")}</h4>
            {notes.length === 0 ? (
              <p className="muted tiny">{t("Заметок пока нет. Добавьте первую запись.", "No notes yet. Add the first entry.")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {notes.map((note, i) => (
                  <div key={i} style={{
                    padding: "10px",
                    background: note.author_id === currentUserId ? "rgba(102, 126, 234, 0.05)" : "#f8fafc",
                    borderLeft: note.author_id === currentUserId ? "3px solid var(--accent)" : "3px solid #cbd5e1",
                    borderRadius: "4px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)" }}>
                        {note.author_id === currentUserId ? t("Вы", "You") : (note.author_id || t("Специалист", "Specialist"))}
                      </span>
                      <span className="muted tiny">{new Date(note.created_at).toLocaleString(dateLocale)}</span>
                    </div>
                    {note.status_change && (
                      <div className="tiny" style={{ color: "var(--accent)", marginBottom: "4px" }}>
                        {"→ " + t("Смена статуса: ", "Status change: ") + (statusOptions.find(o => o.value === note.status_change)?.label || note.status_change)}
                      </div>
                    )}
                    {note.note && (
                      <p style={{ margin: 0, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{note.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          {error && <p className="error tiny" style={{ marginBottom: "8px" }}>{error}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t("Добавить заметку консилиума или комментарий...", "Add a conference note or comment...")}
              rows={3}
              style={{
                width: "100%", padding: "8px", borderRadius: "6px",
                border: "1px solid var(--border)", resize: "vertical", fontFamily: "inherit"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="ob-btn ob-btn--primary"
                onClick={handleAddComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                {isSubmitting ? t("Отправка...", "Sending...") : t("Отправить", "Send")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}