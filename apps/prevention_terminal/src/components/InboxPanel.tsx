import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchInboxStatus,
  listLeads,
  updateLeadStatus,
  fetchCloudInbox,
  updateCloudCaseStatus,
  type InboxServerStatus,
  type LeadRow,
  type InternalCaseRow,
} from "../lib/inbox_client.ts";
import { createCaseFromIdaLead } from "../lib/ida_case_from_lead.ts";
import { rememberLeadCase, resolveLeadCaseIds } from "../lib/lead_case_index.ts";
import { requestOpenConsultationCase } from "../lib/workspace_navigation.ts";
import InternalThreadDialog from "./internal_messaging/InternalThreadDialog.tsx";

interface InboxPanelProps {
  centerId?: string;
  enabled?: boolean;
  /** Коммерческий центр — consultation_lite + первичный приём из заявки. */
  commercial?: boolean;
}

const STATUS_OPTIONS = [
  { value: "new", label: "Новая" },
  { value: "contacted", label: "Связались" },
  { value: "converted", label: "Карточка есть" },
  { value: "closed", label: "Закрыта" },
  { value: "deleted", label: "Удалена" },
];

const INTERNAL_STATUS_OPTIONS = [
  { value: "new", label: "Новое (Не прочитано)" },
  { value: "in_progress", label: "В работе" },
  { value: "clarification_needed", label: "Требуется уточнение" },
  { value: "consilium", label: "Консилиум" },
  { value: "resolved", label: "Решено" },
  { value: "archived", label: "В архиве" },
];

function formatLeadDate(raw: string): string {
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return raw.slice(0, 16);
  return new Date(t).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InboxPanel(props: InboxPanelProps) {
  const { centerId, enabled = true, commercial = false } = props;
  const [status, setStatus] = useState<InboxServerStatus | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [internalCases, setInternalCases] = useState<InternalCaseRow[]>([]);
  const [caseByLead, setCaseByLead] = useState<Map<string, string>>(() => new Map());
  const [showDeleted, setShowDeleted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingLeadId, setCreatingLeadId] = useState<string | null>(null);
  const [selectedInternalCase, setSelectedInternalCase] = useState<InternalCaseRow | null>(null);

  const orgCode = centerId || (typeof window !== "undefined" ? localStorage.getItem("terminal_org_code") || "default_school" : "default_school");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setBusy(true);
    setError("");
    try {
      if (commercial) {
        const [srv, rows] = await Promise.all([
          fetchInboxStatus(),
          listLeads(centerId),
        ]);
        setStatus(srv);
        setLeads(rows);
        if (rows.length > 0) {
          const map = await resolveLeadCaseIds(rows.map((r) => r.id));
          setCaseByLead(map);
        }
      } else {
        const cloudCases = await fetchCloudInbox(orgCode);
        setInternalCases(cloudCases);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [centerId, commercial, enabled, orgCode]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function onInternalStatusChange(caseId: string, nextStatus: string) {
    try {
      await updateCloudCaseStatus(caseId, nextStatus);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onStatusChange(leadId: string, nextStatus: string) {
    try {
      await updateLeadStatus(leadId, nextStatus);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const prepRows = useMemo(
    () =>
      leads.filter((lead) => {
        if (lead.status === "deleted" || lead.status === "closed") return false;
        return Boolean(caseByLead.get(lead.id)) || lead.status === "converted";
      }),
    [caseByLead, leads],
  );

  const openRows = useMemo(
    () => leads.filter((lead) => (showDeleted ? true : lead.status !== "deleted") && lead.status !== "closed" && !caseByLead.get(lead.id)),
    [caseByLead, leads, showDeleted],
  );

  async function onCreateCase(lead: LeadRow) {
    setCreatingLeadId(lead.id);
    setError("");
    setNotice("");
    try {
      const result = await createCaseFromIdaLead({ lead, commercial, prefillPrimary: true });
      rememberLeadCase(lead.id, result.caseId);
      setCaseByLead((prev) => new Map(prev).set(lead.id, result.caseId));
      setNotice(
        result.primaryPrefilled
          ? `Карточка «${result.title}» создана из заявки — можно открыть и сгенерировать план консультации.`
          : `Карточка «${result.title}» создана — откройте и дополните поля.`,
      );
      requestOpenConsultationCase(result.caseId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingLeadId(null);
    }
  }

  if (!enabled) return null;

  return (
    <section className="card inbox-panel">
      <header className="inbox-header">
        <div>
          <h2>{commercial ? "Входящие заявки" : "Входящие обращения педагогов"}</h2>
          <p className="muted">
            {commercial
              ? "Единый центр приема: заявки клиентов с сайта и онлайн-виджетов записи."
              : "Единый центр приема: обращения классных руководителей, учителей и администрации школы."}
          </p>
        </div>
        <button type="button" className="ob-btn ob-btn--ghost" disabled={busy} onClick={() => void refresh()}>
          Обновить
        </button>
      </header>

      {!commercial && (
        <>
          <details className="inbox-meta-details" style={{ fontSize: '0.9rem', margin: '10px 0 16px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', background: 'var(--surface-subtle, rgba(255,255,255,0.03))' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: '600', outline: 'none' }}>
              💡 Как педагоги и классные руководители передают обращения
            </summary>
            <div style={{ marginTop: '10px', fontSize: '0.86rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
              <p style={{ margin: '4px 0' }}>
                • <strong>Рабочее место педагога:</strong> учитель или классный руководитель вносит наблюдение в Журнал наблюдений или форму «Конструктор ситуаций» и нажимает <em>«Передать психологу»</em>.
              </p>
              <p style={{ margin: '4px 0' }}>
                • <strong>Мгновенное поступление:</strong> ситуация немедленно отображается в этой таблице со статусом <em>«Новое»</em> с указанием автора, класса и приоритета (срочно / кризис).
              </p>
              <p style={{ margin: '4px 0' }}>
                • <strong>Отработка случая:</strong> вы можете сразу изменить статус (<em>«В работе»</em>, <em>«Уточнение»</em>, <em>«Консилиум»</em>, <em>«Решено»</em>) или открыть обращение для подробного ознакомления.
              </p>
            </div>
          </details>

          <div className="inbox-internal-block">
            {internalCases.length === 0 ? (
              <p className="muted">Входящих обращений от педагогов пока нет.</p>
            ) : (
              <div className="inbox-table-wrap">
                <table className="inbox-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Тема / Ситуация</th>
                      <th>Отправитель</th>
                      <th>Приоритет</th>
                      <th>Статус</th>
                      <th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internalCases.map((c) => (
                      <tr key={c.id}>
                        <td>{formatLeadDate(c.created_at)}</td>
                        <td>
                          <strong>{c.topic}</strong>
                          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                            {c.content.slice(0, 140)}...
                          </p>
                        </td>
                        <td>
                          {c.sender_name || c.sender_role || "Педагог"}
                        </td>
                        <td>
                          <span className={`badge ${c.priority === "urgent" || c.priority === "crisis" ? "badge--danger" : ""}`}>
                            {c.priority === "urgent" ? "Срочно" : c.priority === "crisis" ? "Кризис" : "Обычный"}
                          </span>
                        </td>
                        <td>
                          <select
                            value={c.status}
                            onChange={(e) => void onInternalStatusChange(c.id, e.target.value)}
                          >
                            {INTERNAL_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="inbox-table-actions">
                          <button
                            type="button"
                            className="ob-btn ob-btn--secondary"
                            onClick={() => setSelectedInternalCase(c)}
                          >
                            Просмотр
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedInternalCase && (
              <InternalThreadDialog
                caseRow={selectedInternalCase}
                currentUserId={centerId || "psychologist"}
                onClose={() => setSelectedInternalCase(null)}
                onUpdate={() => {
                  void refresh();
                  setSelectedInternalCase(null);
                }}
              />
            )}
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {notice && <p className="ok tiny">{notice}</p>}

      {commercial && (
        <>
          <details className="inbox-meta-details" style={{ fontSize: '0.9rem', margin: '10px 0 18px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', background: 'var(--surface-subtle, rgba(255,255,255,0.03))' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: '600', outline: 'none' }}>
              💡 Как настроить приём заявок с вашего сайта, соцсетей или мессенджеров
            </summary>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem', lineHeight: '1.45' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
                <strong>1. Готовая ссылка для записи (для Taplink, Telegram, VK, WhatsApp):</strong>
                <div style={{ marginTop: '4px' }}>
                  Разместите ссылку в шапке профиля или отправьте клиенту:
                  <div style={{ marginTop: '4px' }}>
                    <code>https://ida-psy.pro/book/?center={orgCode}</code>
                  </div>
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
                <strong>2. Виджет онлайн-записи на ваш сайт (вставка в 1 строчку):</strong>
                <p style={{ margin: '4px 0' }}>
                  Вставьте этот код на страницу вашего сайта (или передайте вашему администратору сайта):
                </p>
                <div style={{ marginTop: '4px' }}>
                  <code>&lt;script src=&quot;https://ida-psy.pro/embed/embed.js&quot; data-center=&quot;{orgCode}&quot;&gt;&lt;/script&gt;</code>
                </div>
              </div>

              <details style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                <summary style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  Параметры для IT-специалиста / API-интеграций
                </summary>
                <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <p style={{ margin: '2px 0' }}>Идентификатор организации: <code>{orgCode}</code></p>
                  <p style={{ margin: '2px 0' }}>Эндпоинт приёма заявок (Cloud Webhook): <code>https://api.prevention.school/api/leads/submit</code></p>
                  {status && (
                    <p style={{ margin: '2px 0' }}>Локальный шлюз (Desktop): <code>{status.inbox_url}</code> ({status.running ? "активен" : "остановлен"})</p>
                  )}
                </div>
              </details>
            </div>
          </details>

      {prepRows.length > 0 && (
        <div className="inbox-prep-block">
          <h3>Подготовка к консультации</h3>
          <p className="muted tiny">
            Заявки с уже созданной карточкой — откройте дело, просмотрите поля и сгенерируйте план
            (не раньше, чем карточка сохранена).
          </p>
          <div className="inbox-table-wrap">
            <table className="inbox-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Имя</th>
                  <th>Контакт</th>
                  <th>Статус</th>
                  <th>Карточка</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prepRows.map((lead) => {
                  const caseId = caseByLead.get(lead.id);
                  return (
                    <tr key={lead.id}>
                      <td>{formatLeadDate(lead.created_at)}</td>
                      <td>
                        <strong>{lead.name || "—"}</strong>
                      </td>
                      <td>{lead.contact || "—"}</td>
                      <td>
                        {STATUS_OPTIONS.find((o) => o.value === lead.status)?.label || lead.status}
                      </td>
                      <td>{caseId ? "есть" : "нет"}</td>
                      <td className="inbox-table-actions">
                        {caseId ? (
                          <button
                            type="button"
                            className="ob-btn"
                            onClick={() => requestOpenConsultationCase(caseId)}
                          >
                            Открыть карточку
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ob-btn"
                            disabled={creatingLeadId === lead.id}
                            onClick={() => void onCreateCase(lead)}
                          >
                            {creatingLeadId === lead.id ? "…" : "Создать карточку"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="inbox-all-block">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>{prepRows.length > 0 ? "Новые и без карточки" : "Все заявки"}</h3>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Показать удалённые
          </label>
        </div>
        {openRows.length === 0 && prepRows.length === 0 ? (
          <p className="muted">{showDeleted ? "Заявок нет." : "Заявок пока нет."}</p>
        ) : openRows.length === 0 ? (
          <p className="muted tiny">{showDeleted ? "Удалённых заявок нет." : "Новых заявок без карточки нет."}</p>
        ) : (
          <div className="inbox-table-wrap">
            <table className="inbox-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Имя</th>
                  <th>Контакт</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {openRows.map((lead) => (
                  <tr key={lead.id}>
                    <td>{formatLeadDate(lead.created_at)}</td>
                    <td>
                      <strong>{lead.name || "—"}</strong>
                      {lead.specialist_id ? (
                        <div className="muted tiny">специалист: {lead.specialist_id}</div>
                      ) : null}
                    </td>
                    <td>{lead.contact || "—"}</td>
                    <td>
                      <select
                        value={lead.status}
                        onChange={(e) => void onStatusChange(lead.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="inbox-table-actions">
                      <button
                        type="button"
                        className="ob-btn"
                        disabled={creatingLeadId === lead.id}
                        onClick={() => void onCreateCase(lead)}
                      >
                        {creatingLeadId === lead.id ? "Создаём…" : "Создать карточку"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </section>
  );
}

