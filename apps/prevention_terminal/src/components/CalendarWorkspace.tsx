import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listCaseSummaries, type CaseSummary } from "../lib/case_store.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";

import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

export interface CalendarSlot {
  slot_id: string;
  case_id: string;
  specialist_id: string;
  start_time: number; // unix epoch seconds
  end_time: number;   // unix epoch seconds
  buffer_minutes: number;
  recurrence_weeks: number;
  visit_status: "scheduled" | "attended" | "no_show_billed" | "cancelled_on_time" | "group" | "safety" | "other";
  client_name: string;
  notes: string;
}

interface CalendarWorkspaceProps {
  cfg: TerminalConfig;
  activeCaseId: string | null;
  onCaseSelect: (caseId: string | null) => void;
  onNavigate: (view: any) => void;
}

const VISIT_STATUS_LABELS: Record<CalendarSlot["visit_status"], string> = {
  scheduled: t("Консультация (Запланирована)", "Consultation (Scheduled)"),
  attended: t("Консультация (Состоялась)", "Consultation (Attended)"),
  no_show_billed: t("Неявка (оплачивается)", "No-show (Billed)"),
  cancelled_on_time: t("Отмена вовремя", "Cancelled on time"),
  group: t("Групповая работа", "Group Work"),
  safety: t("Безопасная среда", "Safe Environment"),
  other: t("Другое дело / Событие", "Other / Event"),
};

export default function CalendarWorkspace(props: CalendarWorkspaceProps) {
  const { cfg, onCaseSelect, onNavigate } = props;
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  // Form states
  const [formCaseId, setFormCaseId] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("12:00");
  const [formDuration, setFormDuration] = useState(50);
  const [formBuffer, setFormBuffer] = useState(15);
  const [formRecurrence, setFormRecurrence] = useState(1);
  const [formStatus, setFormStatus] = useState<CalendarSlot["visit_status"]>("scheduled");
  const [formEventType, setFormEventType] = useState<"consultation" | "group" | "safety" | "other">("consultation");
  const [formNotes, setFormNotes] = useState("");
  const [formPrice, setFormPrice] = useState(""); // Cost stored inside notes or JSON if we want

  useEffect(() => {
    void loadData();
  }, [currentDate]);

  async function loadData() {
    setLoading(true);
    try {
      // Load cases for selection dropdown
      const caseList = await listCaseSummaries();
      setCases(caseList);

      // Load slots for the current week range
      const startOfWeek = getStartOfWeek(currentDate);
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

      const rows = await invoke<CalendarSlot[]>("db_list_calendar_slots", {
        startEpoch: Math.floor(startOfWeek.getTime() / 1000),
        endEpoch: Math.floor(endOfWeek.getTime() / 1000),
      });
      setSlots(rows || []);
    } catch (e) {
      console.error("Failed to load calendar data:", e);
    } finally {
      setLoading(false);
    }
  }

  function getStartOfWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function formatTime(epoch: number): string {
    const d = new Date(epoch * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateRus(date: Date): string {
    const isIntl = getTerminalEdition() === "intl";
    return date.toLocaleDateString(isIntl ? "en-US" : "ru-RU", { day: "numeric", month: "long" });
  }

  const startOfWeek = getStartOfWeek(currentDate);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
    return day;
  });

  const hoursRange = Array.from({ length: 13 }, (_, i) => 8 + i); // 8:00 to 20:00

  function openNewSlot(day: Date, hour: number) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const timeStr = `${pad(hour)}:00`;

    setSelectedSlot(null);
    setFormEventType("consultation");
    setFormCaseId("");
    setFormClientName("");
    setFormDate(dateStr);
    setFormTime(timeStr);
    setFormDuration(50);
    setFormBuffer(15);
    setFormRecurrence(1);
    setFormStatus("scheduled");
    setFormNotes("");
    setFormPrice("");
    setIsEditorOpen(true);
  }

  function openEditSlot(slot: CalendarSlot) {
    const d = new Date(slot.start_time * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setSelectedSlot(slot);
    if (slot.visit_status === "group" || slot.visit_status === "safety" || slot.visit_status === "other") {
      setFormEventType(slot.visit_status as any);
      setFormCaseId("");
      setFormClientName(slot.client_name || "");
    } else {
      setFormEventType("consultation");
      setFormCaseId(slot.case_id || "");
      setFormClientName("");
    }
    setFormDate(dateStr);
    setFormTime(timeStr);
    setFormDuration(Math.round((slot.end_time - slot.start_time) / 60));
    setFormBuffer(slot.buffer_minutes || 0);
    setFormRecurrence(1); // recurrence is only for new slots creation
    setFormStatus(slot.visit_status);
    
    // Parse price if stored in notes e.g., "Price: 3000\n..."
    let notesText = slot.notes;
    let priceVal = "";
    const priceMatch = notesText.match(/Price:\s*(\d+)/i);
    if (priceMatch) {
      priceVal = priceMatch[1];
      notesText = notesText.replace(/Price:\s*\d+\s*\n?/i, "").trim();
    }
    setFormPrice(priceVal);
    setFormNotes(notesText);
    setIsEditorOpen(true);
  }

  async function handleSaveSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || !formTime) return;
    if (formEventType === "consultation" && !formCaseId && !formClientName) return;
    if (formEventType !== "consultation" && !formClientName) return;

    try {
      const [hours, minutes] = formTime.split(":").map(Number);
      const baseDate = new Date(formDate);
      baseDate.setHours(hours, minutes, 0, 0);

      const startEpoch = Math.floor(baseDate.getTime() / 1000);
      const endEpoch = startEpoch + formDuration * 60;

      const notesPayload = formPrice 
        ? `Price: ${formPrice}\n${formNotes}`.trim()
        : formNotes;

      const finalStatus = formEventType === "consultation" ? formStatus : formEventType;
      const chosenCase = cases.find((c) => c.case_id === formCaseId);
      const finalClientName = formEventType === "consultation" 
        ? (formClientName || (chosenCase ? chosenCase.situation_title : "Без имени"))
        : formClientName;

      if (selectedSlot) {
        // Edit existing slot
        const updated: CalendarSlot = {
          ...selectedSlot,
          case_id: formEventType === "consultation" ? formCaseId : "",
          client_name: finalClientName,
          start_time: startEpoch,
          end_time: endEpoch,
          buffer_minutes: formBuffer,
          visit_status: finalStatus,
          notes: notesPayload,
        };
        await invoke("db_save_calendar_slot", { slot: updated });
      } else {
        // Create new slot (with possible recurrence loop)
        const recurrenceCount = Math.max(1, formRecurrence);
        for (let i = 0; i < recurrenceCount; i++) {
          const shiftSeconds = i * 7 * 24 * 60 * 60;
          const newSlot: CalendarSlot = {
            slot_id: `slot-${Math.random().toString(36).substring(2, 11)}`,
            case_id: formEventType === "consultation" ? formCaseId : "",
            specialist_id: cfg.terminal_user_id,
            start_time: startEpoch + shiftSeconds,
            end_time: endEpoch + shiftSeconds,
            buffer_minutes: formBuffer,
            recurrence_weeks: recurrenceCount,
            visit_status: finalStatus,
            client_name: finalClientName,
            notes: notesPayload,
          };
          await invoke("db_save_calendar_slot", { slot: newSlot });
        }
      }

      setIsEditorOpen(false);
      void loadData();
    } catch (e) {
      console.error("Save slot failed:", e);
    }
  }

  async function handleDeleteSlot() {
    if (!selectedSlot) return;
    if (!confirm("Вы действительно хотите удалить этот сеанс?")) return;

    try {
      await invoke("db_delete_calendar_slot", { slotId: selectedSlot.slot_id });
      setIsEditorOpen(false);
      void loadData();
    } catch (e) {
      console.error("Delete slot failed:", e);
    }
  }

  function handleNavigateToCase(caseId: string) {
    if (!caseId) return;
    onCaseSelect(caseId);
    onNavigate("case_workspace");
  }

  return (
    <div className="workspace-panel calendar-workspace">
      <div className="workspace-header">
        <div className="title-area">
          <h2 className="title-text">{t("Календарь", "Calendar")}</h2>
          <p className="subtitle-text">{t("Управление записями клиентов, буферным временем и расчетом визитов", "Manage appointments, break buffer, and visit billing calculation")}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setCurrentDate(new Date())}>{t("Сегодня", "Today")}</button>
          <button className="btn-secondary" onClick={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}>{t("&larr; Назад", "&larr; Back")}</button>
          <span className="date-range-label">{formatDateRus(daysOfWeek[0])} — {formatDateRus(daysOfWeek[6])}</span>
          <button className="btn-secondary" onClick={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}>{t("Вперед &rarr;", "Forward &rarr;")}</button>
          <button className="btn-primary" onClick={() => openNewSlot(new Date(), 12)}>{t("+ Запись", "+ Appointment")}</button>
        </div>
      </div>

      <div className="calendar-grid-container">
        {loading ? (
          <div className="loading-overlay">{t("Загрузка расписания...", "Loading schedule...")}</div>
        ) : (
          <table className="calendar-table">
            <thead>
              <tr>
                <th className="time-col-header">{t("Время", "Time")}</th>
                {daysOfWeek.map((day, idx) => (
                  <th key={idx} className={`day-col-header ${day.toDateString() === new Date().toDateString() ? "today-header" : ""}`}>
                    <div className="day-name">{day.toLocaleDateString(getTerminalEdition() === "intl" ? "en-US" : "ru-RU", { weekday: "short" })}</div>
                    <div className="day-date">{day.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hoursRange.map((hour) => (
                <tr key={hour} className="hour-row">
                  <td className="time-cell">{String(hour).padStart(2, "0")}:00</td>
                  {daysOfWeek.map((day, dayIdx) => {
                    const dayStart = new Date(day);
                    dayStart.setHours(hour, 0, 0, 0);
                    const epochStart = Math.floor(dayStart.getTime() / 1000);
                    const epochEnd = epochStart + 3600;

                    // Filter slots falling within this hour on this day
                    const matchingSlots = slots.filter((slot) => {
                      return slot.start_time >= epochStart && slot.start_time < epochEnd;
                    });

                    return (
                      <td key={dayIdx} className="calendar-cell" onClick={() => openNewSlot(day, hour)}>
                        {matchingSlots.map((slot) => (
                          <div
                            key={slot.slot_id}
                            className={`slot-card status-${slot.visit_status}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditSlot(slot);
                            }}
                          >
                            <div className="slot-time">
                              {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                              {slot.buffer_minutes > 0 && <span className="buffer-badge">+{slot.buffer_minutes}м</span>}
                            </div>
                            <div className="slot-client">{slot.client_name}</div>
                            {slot.visit_status !== "scheduled" && (
                              <div className="slot-status-tag">{VISIT_STATUS_LABELS[slot.visit_status]}</div>
                            )}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isEditorOpen && (
        <div className="modal-backdrop">
          <div className="modal-window calendar-editor-modal">
            <form onSubmit={handleSaveSlot}>
              <div className="modal-header">
                <h3>{selectedSlot ? "Редактировать сеанс" : "Запланировать новый сеанс"}</h3>
                <button type="button" className="close-btn" onClick={() => setIsEditorOpen(false)}>&times;</button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Тип события</label>
                  <select value={formEventType} onChange={(e) => setFormEventType(e.target.value as any)}>
                    <option value="consultation">Индивидуальная консультация</option>
                    <option value="group">Групповая работа</option>
                    <option value="safety">Безопасная среда</option>
                    <option value="other">Другое событие / Органайзер</option>
                  </select>
                </div>

                {formEventType === "consultation" && (
                  <div className="form-group">
                    <label>Связанный кейс (из Реестра)</label>
                    <select value={formCaseId} onChange={(e) => setFormCaseId(e.target.value)}>
                      <option value="">-- Выберите кейс (или введите имя ниже) --</option>
                      {cases.map((c) => (
                        <option key={c.case_id} value={c.case_id}>
                          {c.situation_title} (Кейс)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>
                    {formEventType === "consultation" 
                      ? "Имя клиента (если нет в Реестре или для уточнения)" 
                      : "Название события / Дело"}
                  </label>
                  <input
                    type="text"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder={formEventType === "consultation" ? "Например: Иван Иванов" : "Например: Групповое занятие по буллингу"}
                    required={formEventType !== "consultation"}
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Дата</label>
                    <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Время начала</label>
                    <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} required />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label>Длительность (мин)</label>
                    <input type="number" value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label>Баффер перерыва (мин)</label>
                    <input type="number" value={formBuffer} onChange={(e) => setFormBuffer(Number(e.target.value))} />
                  </div>
                  {!selectedSlot && (
                    <div className="form-group">
                      <label>Повторять (недель)</label>
                      <input type="number" min="1" max="12" value={formRecurrence} onChange={(e) => setFormRecurrence(Number(e.target.value))} />
                    </div>
                  )}
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Стоимость сеанса (руб)</label>
                    <input
                      type="number"
                      placeholder="3000"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                    />
                  </div>
                  {formEventType === "consultation" && (
                    <div className="form-group">
                      <label>Статус посещения</label>
                      <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as any)}>
                        <option value="scheduled">Запланировано</option>
                        <option value="attended">Состоялась</option>
                        <option value="no_show_billed">Неявка (оплачивается)</option>
                        <option value="cancelled_on_time">Отмена вовремя</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Заметки / примечания</label>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} placeholder="Дополнительная информация о встрече..." />
                </div>
              </div>

              <div className="modal-footer">
                {selectedSlot && selectedSlot.case_id && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleNavigateToCase(selectedSlot.case_id)}
                  >
                    Перейти к делу
                  </button>
                )}
                {selectedSlot && (
                  <button type="button" className="btn-danger" onClick={handleDeleteSlot}>
                    Удалить
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" className="btn-secondary" onClick={() => setIsEditorOpen(false)}>Отмена</button>
                <button type="submit" className="btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
