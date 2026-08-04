import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchInboxStatus,
  listLeads,
  updateLeadStatus,
  type InboxServerStatus,
  type LeadRow,
} from "../lib/inbox_client.ts";
import { createCaseFromIdaLead } from "../lib/ida_case_from_lead.ts";
import { rememberLeadCase, resolveLeadCaseIds } from "../lib/lead_case_index.ts";
import { requestOpenConsultationCase } from "../lib/workspace_navigation.ts";

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
  const { centerId, enabled = true, commercial = true } = props;
  const [status, setStatus] = useState<InboxServerStatus | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [caseByLead, setCaseByLead] = useState<Map<string, string>>(() => new Map());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingLeadId, setCreatingLeadId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setBusy(true);
    setError("");
    try {
      const [srv, rows] = await Promise.all([fetchInboxStatus(), listLeads(centerId)]);
      setStatus(srv);
      setLeads(rows);
      const map = await resolveLeadCaseIds(rows.map((r) => r.id));
      setCaseByLead(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [centerId, enabled]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const prepRows = useMemo(
    () =>
      leads.filter((lead) => {
        if (lead.status === "closed") return false;
        return Boolean(caseByLead.get(lead.id)) || lead.status === "converted";
      }),
    [caseByLead, leads],
  );

  const openRows = useMemo(
    () => leads.filter((lead) => lead.status !== "closed" && !caseByLead.get(lead.id)),
    [caseByLead, leads],
  );

  async function onStatusChange(leadId: string, next: string) {
    try {
      await updateLeadStatus(leadId, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

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
          <h2>Заявки на консультацию</h2>
          <p className="muted">
            Новые обращения клиентов из чата на вашем сайте автоматически приходят сюда. Создайте карточку клиента, чтобы запустить разбор и составить план первой встречи.
          </p>
        </div>
        <button type="button" className="ob-btn ob-btn--ghost" disabled={busy} onClick={() => void refresh()}>
          Обновить
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      {notice && <p className="ok tiny">{notice}</p>}
      {status && (
        <details className="inbox-meta-details" style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '8px 0 16px' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }}>
            🔧 Технические параметры подключения (для интеграции)
          </summary>
          <div className="inbox-meta" style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px' }}>
            <p style={{ margin: '4px 0' }}>
              Локальный адрес сервера приема: <code>{status.inbox_url}</code>
            </p>
            <p className="muted" style={{ margin: '4px 0' }}>
              Параметр для HTML-кода виджета: <code>data-lead-sink=&quot;{status.inbox_url}&quot;</code>. 
              Статус сервера: {status.running ? "активен" : "остановлен"} (порт {status.port}).
            </p>
          </div>
        </details>
      )}

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
        <h3>{prepRows.length > 0 ? "Новые и без карточки" : "Все заявки"}</h3>
        {openRows.length === 0 && prepRows.length === 0 ? (
          <p className="muted">Заявок пока нет.</p>
        ) : openRows.length === 0 ? (
          <p className="muted tiny">Новых заявок без карточки нет.</p>
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
    </section>
  );
}
