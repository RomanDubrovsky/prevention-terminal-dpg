/**
 * Phase 3.8 — Журнал действий специалиста и учёт часов.
 *
 * Записи сохраняются локально в SQLCipher (`work_log_entries`) и позволяют
 * быстро собрать отчёт по сопровождению кейса.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  formatWorkDuration,
  newWorkLogEntryId,
  totalWorkMinutes,
  WORK_LOG_ACTION_LABEL,
  WORK_LOG_ACTIONS,
  type WorkLogAction,
  type WorkLogEntry,
} from "../lib/worklog.ts";

interface WorkLogPanelProps {
  caseId: string;
}

type WorkLogState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

export default function WorkLogPanel(props: WorkLogPanelProps) {
  const { caseId } = props;
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [actionKind, setActionKind] = useState<WorkLogAction>("consultation");
  const [minutes, setMinutes] = useState("45");
  const [note, setNote] = useState("");
  const [state, setState] = useState<WorkLogState>({ kind: "loading" });

  const loadEntries = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const rows = await invoke<WorkLogEntry[]>("db_list_work_log_entries", {
        caseId,
      });
      setEntries(rows);
      setState({ kind: "idle" });
    } catch (err) {
      setState({
        kind: "error",
        message: `Не удалось загрузить журнал: ${String(err)}`,
      });
    }
  }, [caseId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const total = useMemo(() => totalWorkMinutes(entries), [entries]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const parsedMinutes = Number.parseInt(minutes, 10);
      if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
        setState({
          kind: "error",
          message: "Укажите длительность в минутах, больше нуля.",
        });
        return;
      }

      setState({ kind: "saving" });
      try {
        await invoke("db_add_work_log_entry", {
          entryId: newWorkLogEntryId(),
          caseId,
          actionKind,
          minutes: parsedMinutes,
          note,
        });
        setNote("");
        setMinutes("45");
        await loadEntries();
      } catch (err) {
        setState({
          kind: "error",
          message: `Не удалось добавить запись: ${String(err)}`,
        });
      }
    },
    [actionKind, caseId, loadEntries, minutes, note],
  );

  return (
    <section className="card workspace-card">
      <header className="workspace-card-header">
        <div>
          <h2>Журнал действий</h2>
          <p className="muted">
            Фиксируйте консультации, звонки, документы и наблюдения.
          </p>
        </div>
        <div className="work-total">
          <span className="muted tiny">Всего по кейсу</span>
          <strong>{formatWorkDuration(total)}</strong>
        </div>
      </header>

      <form className="work-log-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Тип действия</span>
          <select
            value={actionKind}
            onChange={(e) => setActionKind(e.target.value as WorkLogAction)}
          >
            {WORK_LOG_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {WORK_LOG_ACTION_LABEL[action]}
              </option>
            ))}
          </select>
        </label>

        <label className="field minutes-field">
          <span>Минут</span>
          <input
            type="number"
            min={1}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>

        <label className="field work-note-field">
          <span>Краткая заметка</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например: созвон с классным руководителем"
          />
        </label>

        <button type="submit" disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Добавляем…" : "Добавить"}
        </button>
      </form>

      {state.kind === "error" && <p className="error">{state.message}</p>}
      {state.kind === "loading" && <p className="muted tiny">Загрузка журнала…</p>}

      <div className="work-log-list">
        {entries.length === 0 && state.kind !== "loading" ? (
          <p className="muted tiny">
            Записей пока нет. Добавьте первое действие, чтобы начать учёт часов.
          </p>
        ) : (
          entries.map((entry) => (
            <article key={entry.entry_id} className="work-log-entry">
              <div>
                <strong>{WORK_LOG_ACTION_LABEL[entry.action_kind]}</strong>
                {entry.note && <p>{entry.note}</p>}
              </div>
              <div className="work-log-meta">
                <span>{formatWorkDuration(entry.minutes)}</span>
                <span>{formatTimestamp(entry.created_at)}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatTimestamp(raw: string): string {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds)) return raw;
  return new Date(seconds * 1000).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
