import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

import {
  WORKLOAD_CONSULTATION_4B_NOTE,
  WORKLOAD_EXPORT_HINT,
  WORKLOAD_INTRO,
  WORKLOAD_JOURNAL_HINT,
} from "../content/workload_workspace_copy.ts";
import {
  ACTIVITY_KIND_LABEL_RU,
  AUDIENCE_CONTINGENT_LABEL_RU,
  VISIT_KIND_LABEL_RU,
  activityKindOptionsForTab,
  activityKindsForJournalTab,
  addWorkEntry,
  currentMonthRange,
  deleteWorkEntry,
  emptyWorkEntryDraft,
  listWorkEntries,
  newWorkEntryId,
  totalWorkEntryMinutes,
  updateWorkEntry,
  WORKLOAD_JOURNAL_TABS,
  type WorkEntry,
  type WorkEntryDraft,
  type WorkloadJournalTab,
} from "../lib/work_entries.ts";
import { exportWorkloadJournalDocx } from "../lib/workload_export.ts";
import { getSchoolForm } from "../lib/school_psychologist_forms.ts";
import { ACTIVITY_KIND_DEFAULT_MINUTES } from "../lib/taxonomy.ts";

interface WorkloadWorkspaceProps {
  orgName?: string;
  specialistName?: string;
  cfg?: TerminalConfig;
}

const VISIT_STATUS_LABELS = {
  scheduled: t("Запланировано", "Scheduled"),
  attended: t("Состоялась", "Attended"),
  no_show_billed: t("Неявка (оплачивается)", "No-show (billed)"),
  cancelled_on_time: t("Отмена вовремя", "Cancelled on time"),
};

function draftFromEntry(row: WorkEntry): WorkEntryDraft {
  const { created_at: _c, updated_at: _u, ...draft } = row;
  return draft;
}

export default function WorkloadWorkspace(props: WorkloadWorkspaceProps) {
  const { orgName, specialistName, cfg } = props;
  const commercial = cfg ? isCommercialOrg(cfg) : false;

  const [profile, setProfile] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [monthlyFilterDate, setMonthlyFilterDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!commercial) return;
    let alive = true;
    invoke("db_get_specialist_profile")
      .then((data: any) => {
        if (alive) setProfile(data);
      })
      .catch((e) => console.error("Load specialist profile failed:", e));

    const startOfMonth = new Date(monthlyFilterDate.getFullYear(), monthlyFilterDate.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(monthlyFilterDate.getFullYear(), monthlyFilterDate.getMonth() + 1, 0, 23, 59, 59, 999);

    invoke("db_list_calendar_slots", {
      startEpoch: Math.floor(startOfMonth.getTime() / 1000),
      endEpoch: Math.floor(endOfMonth.getTime() / 1000),
    })
      .then((data: any) => {
        if (alive) setSlots(data || []);
      })
      .catch((e) => console.error("Load calendar slots failed:", e));

    return () => {
      alive = false;
    };
  }, [commercial, monthlyFilterDate]);

  const stats = useMemo(() => {
    let scheduled = 0;
    let attended = 0;
    let noShowBilled = 0;
    let cancelled = 0;
    let totalRevenue = 0;
    let totalPayout = 0;

    const list: any[] = [];

    const rateType = profile?.rate_type || "fixed";
    const rateValue = profile?.rate_value || 0;

    for (const slot of slots) {
      scheduled += 1;
      const status = slot.visit_status;
      if (status === "attended") attended += 1;
      else if (status === "no_show_billed") noShowBilled += 1;
      else if (status === "cancelled_on_time") cancelled += 1;

      // Parse price from slot.notes e.g. "Price: 3000\n..."
      let price = 3000;
      const priceMatch = String(slot.notes || "").match(/Price:\s*(\d+)/i);
      if (priceMatch) {
        price = Number(priceMatch[1]);
      }

      const isBilled = status === "attended" || status === "no_show_billed";
      let payout = 0;
      if (isBilled) {
        payout = rateType === "percent" ? (price * rateValue) / 100 : rateValue;
        totalRevenue += price;
        totalPayout += payout;
      }

      list.push({
        ...slot,
        price,
        payout,
      });
    }

    return {
      scheduled,
      attended,
      noShowBilled,
      cancelled,
      totalRevenue,
      totalPayout,
      list,
    };
  }, [slots, profile]);

  const month = useMemo(() => currentMonthRange(), []);

  const [activeTab, setActiveTab] = useState<WorkloadJournalTab>("all");
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<WorkEntryDraft>(() => emptyWorkEntryDraft());
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportOk, setExportOk] = useState<string | null>(null);

  const activityFilter = useMemo(() => activityKindsForJournalTab(activeTab), [activeTab]);
  const exportFormId = activeTab !== "all" ? activeTab : null;

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const rows = await listWorkEntries({
        activityKinds: activityFilter ?? undefined,
        fromDate: month.from,
        toDate: month.to,
      });
      setEntries(rows);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [activityFilter, month.from, month.to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalMinutes = useMemo(() => totalWorkEntryMinutes(entries), [entries]);

  function openNew() {
    const d = emptyWorkEntryDraft(activeTab);
    d.entry_id = newWorkEntryId();
    setDraft(d);
    setSavedEntryId(null);
    setEditorOpen(true);
    setSaveOk(null);
    setSaveErr(null);
  }

  function loadEntry(row: WorkEntry) {
    setDraft(draftFromEntry(row));
    setSavedEntryId(row.entry_id);
    setEditorOpen(true);
    setSaveOk(null);
    setSaveErr(null);
  }

  function closeEditor() {
    setEditorOpen(false);
    setSavedEntryId(null);
  }

  function onTabChange(tab: WorkloadJournalTab) {
    setActiveTab(tab);
    setEditorOpen(false);
    setSaveOk(null);
    setSaveErr(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveErr(null);
    setSaveOk(null);
    if (!draft.work_date.trim()) {
      setSaveErr("Укажите дату.");
      return;
    }
    if (draft.minutes_actual <= 0) {
      setSaveErr("Минуты должны быть больше нуля.");
      return;
    }
    try {
      if (savedEntryId) {
        await updateWorkEntry(savedEntryId, draft);
      } else {
        await addWorkEntry(draft);
        setSavedEntryId(draft.entry_id);
      }
      setSaveOk("Запись сохранена.");
      await reload();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  }

  async function onDelete() {
    if (!savedEntryId) return;
    if (!globalThis.confirm?.("Удалить запись из журнала нагрузки?")) return;
    try {
      await deleteWorkEntry(savedEntryId);
      closeEditor();
      await reload();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  }

  async function onExport() {
    if (!exportFormId) {
      setSaveErr("Выберите вкладку журнала 4А–Ж для экспорта бланка.");
      return;
    }
    setExportBusy(true);
    setExportOk(null);
    setSaveErr(null);
    try {
      const result = await exportWorkloadJournalDocx({
        formId: exportFormId,
        entries,
        periodLabel: month.label,
        orgName,
        specialistName,
      });
      if ("path" in result) {
        setExportOk(`Файл сохранён: ${result.path}`);
      } else {
        setExportOk("Файл скачан.");
      }
    } catch (err) {
      if (err instanceof Error && err.message === "cancelled") return;
      setSaveErr(err instanceof Error ? err.message : String(err));
    } finally {
      setExportBusy(false);
    }
  }

  if (commercial) {
    const monthYearLabel = monthlyFilterDate.toLocaleDateString(getTerminalEdition() === "intl" ? "en-US" : "ru-RU", { month: "long", year: "numeric" });

    return (
      <div className="workspace-panel-stack workload-journal commercial-payroll">
        <section className="card">
          <h2>{t("Учет сессий и выплаты", "Sessions Accounting & Payouts")}</h2>
          <p className="muted">{t("Расчет заработанных средств на основе визитов и ставок за прием", "Calculation of earned funds based on visits and session rates")}</p>
        </section>

        <section className="card payroll-summary-cards">
          <div className="payroll-filter-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => setMonthlyFilterDate(new Date(monthlyFilterDate.getFullYear(), monthlyFilterDate.getMonth() - 1, 1))}
            >
              &larr; {t("Предыдущий месяц", "Previous Month")}
            </button>
            <span className="current-month-label" style={{ fontWeight: "bold", fontSize: "1.2rem", textTransform: "capitalize" }}>{monthYearLabel}</span>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => setMonthlyFilterDate(new Date(monthlyFilterDate.getFullYear(), monthlyFilterDate.getMonth() + 1, 1))}
            >
              {t("Следующий месяц", "Next Month")} &rarr;
            </button>
          </div>

          <div className="stats-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div className="stat-box-card" style={{ padding: "1.2rem", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
              <span className="stat-label" style={{ display: "block", fontSize: "0.85rem", opacity: 0.7 }}>{t("Проведено сессий", "Sessions Conducted")}</span>
              <span className="stat-value" style={{ display: "block", fontSize: "1.8rem", fontWeight: "bold", margin: "0.4rem 0" }}>{stats.attended}</span>
              <span className="stat-desc" style={{ display: "block", fontSize: "0.8rem", opacity: 0.6 }}>{t("Запланировано: ", "Scheduled: ")}{stats.scheduled}</span>
            </div>
            <div className="stat-box-card" style={{ padding: "1.2rem", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
              <span className="stat-label" style={{ display: "block", fontSize: "0.85rem", opacity: 0.7 }}>{t("Неявки (оплачиваемые)", "No-shows (billed)")}</span>
              <span className="stat-value text-warn" style={{ display: "block", fontSize: "1.8rem", fontWeight: "bold", margin: "0.4rem 0", color: "#e67e22" }}>{stats.noShowBilled}</span>
              <span className="stat-desc" style={{ display: "block", fontSize: "0.8rem", opacity: 0.6 }}>{t("Отмены вовремя: ", "Cancelled on time: ")}{stats.cancelled}</span>
            </div>
            <div className="stat-box-card" style={{ padding: "1.2rem", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
              <span className="stat-label" style={{ display: "block", fontSize: "0.85rem", opacity: 0.7 }}>{t("Выручка за месяц", "Revenue for the Month")}</span>
              <span className="stat-value" style={{ display: "block", fontSize: "1.8rem", fontWeight: "bold", margin: "0.4rem 0" }}>{stats.totalRevenue.toLocaleString()} {t("руб", "RSD")}</span>
              <span className="stat-desc" style={{ display: "block", fontSize: "0.8rem", opacity: 0.6 }}>{t("Общая сумма услуг", "Total amount of services")}</span>
            </div>
            <div className="stat-box-card highlight-card" style={{ padding: "1.2rem", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "rgba(52, 152, 219, 0.05)" }}>
              <span className="stat-label" style={{ display: "block", fontSize: "0.85rem", opacity: 0.7 }}>{t("К выплате специалисту", "Payout to Specialist")}</span>
              <span className="stat-value text-primary" style={{ display: "block", fontSize: "1.8rem", fontWeight: "bold", margin: "0.4rem 0", color: "#3498db" }}>{stats.totalPayout.toLocaleString()} {t("руб", "RSD")}</span>
              <span className="stat-desc" style={{ display: "block", fontSize: "0.8rem", opacity: 0.6 }}>
                {profile?.rate_type === "percent" ? t(`${profile.rate_value}% от сессии`, `${profile.rate_value}% of session cost`) : t(`${profile?.rate_value || 0} руб/сессия`, `${profile?.rate_value || 0} RSD/session`)}
              </span>
            </div>
          </div>
        </section>

        <section className="card payroll-table-section">
          <h3>{t("Детализация сессий", "Sessions Details")}</h3>
          {stats.list.length === 0 ? (
            <p className="muted text-center" style={{ padding: "2rem", textAlign: "center" }}>{t("Нет записей за выбранный период", "No records for the selected period")}</p>
          ) : (
            <div className="payroll-table-wrap" style={{ overflowX: "auto" }}>
              <table className="payroll-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ccc" }}>
                    <th style={{ textAlign: "left", padding: "0.8rem" }}>{t("Дата и время", "Date & Time")}</th>
                    <th style={{ textAlign: "left", padding: "0.8rem" }}>{t("Клиент", "Client")}</th>
                    <th style={{ textAlign: "left", padding: "0.8rem" }}>{t("Статус", "Status")}</th>
                    <th style={{ textAlign: "left", padding: "0.8rem" }}>{t("Стоимость", "Price")}</th>
                    <th style={{ textAlign: "left", padding: "0.8rem" }}>{t("Выплата", "Payout")}</th>
                    <th style={{ textAlign: "left", padding: "0.8rem" }}>{t("Заметки", "Notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.list.map((row) => (
                    <tr key={row.slot_id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "0.8rem" }}>{new Date(row.start_time * 1000).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "0.8rem" }}>{row.client_name}</td>
                      <td style={{ padding: "0.8rem" }}>
                        <span className={`status-badge status-${row.visit_status}`} style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                          backgroundColor: row.visit_status === "attended" ? "rgba(46, 204, 113, 0.15)" : row.visit_status === "no_show_billed" ? "rgba(230, 126, 34, 0.15)" : "rgba(149, 165, 166, 0.15)",
                          color: row.visit_status === "attended" ? "#2ecc71" : row.visit_status === "no_show_billed" ? "#e67e22" : "#95a5a6"
                        }}>
                          {VISIT_STATUS_LABELS[row.visit_status as keyof typeof VISIT_STATUS_LABELS] || row.visit_status}
                        </span>
                      </td>
                      <td style={{ padding: "0.8rem" }}>{row.price} {t("руб", "RSD")}</td>
                      <td style={{ padding: "0.8rem" }}><strong>{row.payout} {t("руб", "RSD")}</strong></td>
                      <td className="muted tiny" style={{ padding: "0.8rem", opacity: 0.6 }}>{row.notes?.replace(/Price:\s*\d+\s*\n?/i, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  const kindOptions = activityKindOptionsForTab(activeTab);
  const activeForm = exportFormId ? getSchoolForm(exportFormId) : null;

  return (
    <div className="workspace-panel-stack workload-journal">
      <section className="card">
        <h2>Нагрузка и журналы</h2>
        <p className="muted">{WORKLOAD_INTRO}</p>
        <p className="muted tiny">{WORKLOAD_JOURNAL_HINT}</p>
      </section>

      <section className="card workload-toolbar">
        <div className="workload-tab-row" role="tablist" aria-label="Журналы учёта">
          {WORKLOAD_JOURNAL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`workload-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="workload-toolbar-actions">
          <span className="muted tiny">
            {month.label} · {entries.length} записей · {totalMinutes} мин
          </span>
          <div className="workload-toolbar-buttons">
            <button type="button" className="ob-btn secondary" onClick={openNew}>
              + Запись
            </button>
            <button
              type="button"
              className="ob-btn"
              disabled={exportBusy || !exportFormId || entries.length === 0}
              onClick={() => void onExport()}
              title={WORKLOAD_EXPORT_HINT}
            >
              {exportBusy ? "Экспорт…" : "Экспорт DOCX"}
            </button>
          </div>
        </div>

        {activeTab === "journal_4b_consultation" && (
          <p className="muted tiny workload-note">{WORKLOAD_CONSULTATION_4B_NOTE}</p>
        )}
        {exportOk && <p className="ok tiny">{exportOk}</p>}
        {saveErr && <p className="error tiny">{saveErr}</p>}
      </section>

      <section className="card workspace-journal-card">
        <div className="workspace-journal-head">
          <h3>
            {activeForm ? `Журнал: форма ${activeForm.number}` : "Все виды работ за месяц"}
          </h3>
        </div>

        {busy && entries.length === 0 ? <p className="muted">Загрузка…</p> : null}
        {!busy && entries.length === 0 ? (
          <p className="muted">За выбранный период записей нет — нажмите «+ Запись».</p>
        ) : null}

        <ul className="workload-entry-list">
          {entries.map((row) => (
            <li key={row.entry_id}>
              <button
                type="button"
                className={`workload-entry-item${savedEntryId === row.entry_id && editorOpen ? " active" : ""}`}
                onClick={() => loadEntry(row)}
              >
                <div className="workload-entry-head">
                  <strong>{row.title || row.subject_label || "Без названия"}</strong>
                  <span className="muted tiny">
                    {row.work_date} · {row.minutes_actual} мин
                  </span>
                </div>
                <p className="muted tiny">{ACTIVITY_KIND_LABEL_RU[row.activity_kind]}</p>
                {row.subject_label && row.title && (
                  <p className="muted tiny">{row.subject_label}</p>
                )}
                {row.notes && <p className="muted tiny">{row.notes}</p>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {editorOpen && (
        <section className="card workload-editor">
          <div className="workload-editor-head">
            <h3>{savedEntryId ? "Редактирование записи" : "Новая запись"}</h3>
            <div className="workload-editor-actions">
              {savedEntryId && (
                <button type="button" className="ob-btn secondary" onClick={() => void onDelete()}>
                  Удалить
                </button>
              )}
              <button type="button" className="ob-btn secondary" onClick={closeEditor}>
                Закрыть
              </button>
            </div>
          </div>

          <form className="workload-form" onSubmit={(e) => void onSubmit(e)}>
            <div className="workload-form-grid">
              <label>
                Дата
                <input
                  type="date"
                  value={draft.work_date}
                  onChange={(e) => setDraft((d) => ({ ...d, work_date: e.target.value }))}
                  required
                />
              </label>
              <label>
                Минуты
                <input
                  type="number"
                  min={1}
                  value={draft.minutes_actual}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, minutes_actual: Number(e.target.value) || 0 }))
                  }
                  required
                />
              </label>
              <label>
                Вид работы
                <select
                  value={draft.activity_kind}
                  onChange={(e) => {
                    const kind = e.target.value as WorkEntryDraft["activity_kind"];
                    setDraft((d) => ({
                      ...d,
                      activity_kind: kind,
                      minutes_actual:
                        d.minutes_actual > 0
                          ? d.minutes_actual
                          : ACTIVITY_KIND_DEFAULT_MINUTES[kind],
                    }));
                  }}
                >
                  {kindOptions.map((k) => (
                    <option key={k} value={k}>
                      {ACTIVITY_KIND_LABEL_RU[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Название / тема
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Кратко: повод, тема занятия…"
                />
              </label>
              <label>
                С кем / ФИО / участники
                <input
                  type="text"
                  value={draft.subject_label}
                  onChange={(e) => setDraft((d) => ({ ...d, subject_label: e.target.value }))}
                />
              </label>
              <label>
                Примечание / динамика
                <input
                  type="text"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </label>
            </div>

            <details className="workload-extra-fields">
              <summary>Дополнительно для бланка журнала</summary>
              <div className="workload-form-grid">
                <label>
                  Время начала
                  <input
                    type="time"
                    value={draft.time_start}
                    onChange={(e) => setDraft((d) => ({ ...d, time_start: e.target.value }))}
                  />
                </label>
                <label>
                  Время окончания
                  <input
                    type="time"
                    value={draft.time_end}
                    onChange={(e) => setDraft((d) => ({ ...d, time_end: e.target.value }))}
                  />
                </label>
                <label>
                  От кого запрос
                  <input
                    type="text"
                    value={draft.referrer}
                    onChange={(e) => setDraft((d) => ({ ...d, referrer: e.target.value }))}
                  />
                </label>
                <label>
                  Код / аноним
                  <input
                    type="text"
                    value={draft.anonymous_code}
                    onChange={(e) => setDraft((d) => ({ ...d, anonymous_code: e.target.value }))}
                  />
                </label>
                <label>
                  Первичная / повторная
                  <select
                    value={draft.visit_kind}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        visit_kind: e.target.value as WorkEntryDraft["visit_kind"],
                      }))
                    }
                  >
                    {Object.entries(VISIT_KIND_LABEL_RU).map(([value, label]) => (
                      <option key={value || "none"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Контингент
                  <select
                    value={draft.audience_contingent}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        audience_contingent: e.target.value as WorkEntryDraft["audience_contingent"],
                      }))
                    }
                  >
                    {Object.entries(AUDIENCE_CONTINGENT_LABEL_RU).map(([value, label]) => (
                      <option key={value || "none"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Аудитория / возраст
                  <input
                    type="text"
                    value={draft.audience_note}
                    onChange={(e) => setDraft((d) => ({ ...d, audience_note: e.target.value }))}
                    placeholder="9 класс, педагоги…"
                  />
                </label>
                <label>
                  Форма мероприятия
                  <input
                    type="text"
                    value={draft.event_form}
                    onChange={(e) => setDraft((d) => ({ ...d, event_form: e.target.value }))}
                  />
                </label>
                <label>
                  Характер диагностики
                  <input
                    type="text"
                    value={draft.diagnostic_kind}
                    onChange={(e) => setDraft((d) => ({ ...d, diagnostic_kind: e.target.value }))}
                  />
                </label>
              </div>
            </details>

            {saveOk && <p className="ok tiny">{saveOk}</p>}

            <div className="workload-form-actions">
              <button type="submit" className="ob-btn">
                Сохранить
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
