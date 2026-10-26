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
import { fetchUnreadCount } from "../lib/admin_messages_client.ts";
import { createCaseFromIdaLead } from "../lib/ida_case_from_lead.ts";
import { rememberLeadCase, resolveLeadCaseIds } from "../lib/lead_case_index.ts";
import { requestOpenConsultationCase } from "../lib/workspace_navigation.ts";
import InternalThreadDialog from "./internal_messaging/InternalThreadDialog.tsx";
import AdminMessagesSection from "./AdminMessagesSection.tsx";

import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

interface InboxPanelProps {
  centerId?: string;
  enabled?: boolean;
  /** Коммерческий центр — consultation_lite + первичный приём из заявки. */
  commercial?: boolean;
  /** User ID for admin messages (terminal_user_id). */
  userId?: string;
  /** Audience segment: 'ru' | 'intl' | 'commercial'. */
  audience?: string;
  /** Display name for reply attribution. */
  userName?: string;
  /** Org name for reply attribution. */
  userOrg?: string;
  /** Callback when admin messages unread count changes. */
  onUnreadChange?: (count: number) => void;
}

function getStatusOptions() {
  return [
    { value: "new", label: t("Новая", "New") },
    { value: "contacted", label: t("Связались", "Contacted") },
    { value: "converted", label: t("Карточка есть", "Card created") },
    { value: "closed", label: t("Закрыта", "Closed") },
    { value: "deleted", label: t("Удалена", "Deleted") },
  ];
}

function getInternalStatusOptions() {
  return [
    { value: "new", label: t("Новое (Не прочитано)", "New (Unread)") },
    { value: "in_progress", label: t("В работе", "In progress") },
    { value: "clarification_needed", label: t("Требуется уточнение", "Clarification needed") },
    { value: "consilium", label: t("Консилиум", "Case conference") },
    { value: "resolved", label: t("Решено", "Resolved") },
    { value: "archived", label: t("В архиве", "Archived") },
  ];
}

function formatLeadDate(raw: string): string {
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return raw.slice(0, 16);
  const locale = getTerminalEdition() === "intl" ? "en-US" : "ru-RU";
  return new Date(t).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InboxPanel(props: InboxPanelProps) {
  const { centerId, enabled = true, commercial = false, userId, audience, userName, userOrg, onUnreadChange } = props;
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
  const [activeTab, setActiveTab] = useState<"referrals" | "admin">("referrals");
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  const orgCode = centerId || (typeof window !== "undefined" ? localStorage.getItem("terminal_org_code") || "default_school" : "default_school");
  const effectiveUserId = userId || (typeof window !== "undefined" ? localStorage.getItem("terminal_user_id") || "psychologist" : "psychologist");
  const effectiveAudience = audience || (commercial ? "commercial" : "ru");

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

      if (effectiveUserId && effectiveAudience) {
        const count = await fetchUnreadCount(effectiveUserId, effectiveAudience);
        setAdminUnreadCount(count);
        onUnreadChange?.(count);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [centerId, commercial, enabled, orgCode, effectiveUserId, effectiveAudience, onUnreadChange]);

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

  const internalUnreadCount = useMemo(() => {
    return internalCases.filter((c) => c.status === "new").length;
  }, [internalCases]);

  const leadsUnreadCount = useMemo(() => {
    return leads.filter((l) => l.status === "new").length;
  }, [leads]);

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
          ? t(
              `Карточка «${result.title}» создана из заявки — можно открыть и сгенерировать план консультации.`,
              `Case card "${result.title}" created from lead — open it to generate consultation plan.`,
            )
          : t(
              `Карточка «${result.title}» создана — откройте и дополните поля.`,
              `Case card "${result.title}" created — open it to complete required fields.`,
            ),
      );
      requestOpenConsultationCase(result.caseId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingLeadId(null);
    }
  }

  const statusOptions = useMemo(() => getStatusOptions(), []);
  const internalStatusOptions = useMemo(() => getInternalStatusOptions(), []);

  if (!enabled) return null;

  return (
    <section className="card inbox-panel">
      <header className="inbox-header">
        <div>
          <h2>
            {commercial
              ? t("Входящие заявки организации", "Organization Incoming Leads")
              : t("Входящие обращения", "Incoming Referrals")}
          </h2>
          <p className="muted">
            {commercial
              ? t(
                  "Единый центр приема: заявки клиентов со всех онлайн-виджетов и сайта организации ко всем специалистам центра.",
                  "Intake hub: all client inquiries from website and booking widgets across all organization specialists.",
                )
              : t(
                  "Единый центр приема: обращения педагогов, классных руководителей и школьные консилиумы.",
                  "Intake hub: referrals from educators, class teachers, and multidisciplinary case conferences.",
                )}
          </p>
        </div>
        <button type="button" className="ob-btn ob-btn--ghost" disabled={busy} onClick={() => void refresh()}>
          {t("Обновить", "Refresh")}
        </button>
      </header>

      {/* Stream Tabs: Обращения / Служебные уведомления */}
      <div
        className="inbox-stream-tabs"
        style={{
          display: "flex",
          gap: "8px",
          margin: "14px 0 18px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("referrals")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid " + (activeTab === "referrals" ? "var(--accent)" : "transparent"),
            background: activeTab === "referrals" ? "var(--accent-subtle, rgba(99, 102, 241, 0.12))" : "transparent",
            color: activeTab === "referrals" ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: activeTab === "referrals" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.92rem",
            transition: "all 0.15s ease",
          }}
        >
          <span>{commercial ? t("📥 Заявки клиентов", "📥 Client Leads") : t("📥 Обращения педагогов", "📥 Educator Referrals")}</span>
          {(commercial ? leadsUnreadCount : internalUnreadCount) > 0 && (
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                fontSize: "0.75rem",
                padding: "2px 7px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              {commercial ? leadsUnreadCount : internalUnreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("admin")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid " + (activeTab === "admin" ? "var(--accent)" : "transparent"),
            background: activeTab === "admin" ? "var(--accent-subtle, rgba(99, 102, 241, 0.12))" : "transparent",
            color: activeTab === "admin" ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: activeTab === "admin" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.92rem",
            transition: "all 0.15s ease",
          }}
        >
          <span>📢 {t("Сообщения и новости", "System Messages & Updates")}</span>
          {adminUnreadCount > 0 && (
            <span
              style={{
                background: "#ef4444",
                color: "#fff",
                fontSize: "0.75rem",
                padding: "2px 7px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              {adminUnreadCount}
            </span>
          )}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="ok tiny">{notice}</p>}

      {/* Tab 2: Broadcast and system messages */}
      {activeTab === "admin" && (
        <AdminMessagesSection
          userId={effectiveUserId}
          audience={effectiveAudience}
          userName={userName}
          userOrg={userOrg}
          onUnreadChange={(cnt) => {
            setAdminUnreadCount(cnt);
            onUnreadChange?.(cnt);
          }}
        />
      )}

      {/* Tab 1: Educator Referrals / Client Leads */}
      {activeTab === "referrals" && !commercial && (
        <>
          <details className="inbox-meta-details" style={{ fontSize: '0.9rem', margin: '0 0 16px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', background: 'var(--surface-subtle, rgba(255,255,255,0.03))' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: '600', outline: 'none' }}>
              {t("💡 Как педагоги и классные руководители передают обращения", "💡 How educators and teachers submit referrals")}
            </summary>
            <div style={{ marginTop: '10px', fontSize: '0.86rem', lineHeight: '1.45', color: 'var(--text-secondary)' }}>
              <p style={{ margin: '4px 0' }}>
                • <strong>{t("Рабочее место педагога:", "Educator Workspace:")}</strong> {t("учитель или классный руководитель вносит наблюдение в Журнал наблюдений или форму «Конструктор ситуаций» и нажимает «Передать психологу».", "the teacher enters an observation into the Journal or Situation Builder and clicks 'Refer to specialist'.")}
              </p>
              <p style={{ margin: '4px 0' }}>
                • <strong>{t("Мгновенное поступление:", "Instant Delivery:")}</strong> {t("ситуация немедленно отображается в этой таблице со статусом «Новое» с указанием автора, класса и приоритета (срочно / кризис).", "the situation appears immediately in this table with status 'New', author, class and priority (urgent / crisis).")}
              </p>
              <p style={{ margin: '4px 0' }}>
                • <strong>{t("Отработка случая:", "Case Management:")}</strong> {t("вы можете сразу изменить статус («В работе», «Уточнение», «Консилиум», «Решено») или открыть обращение для подробного ознакомления.", "you can update the status ('In progress', 'Clarification', 'Case conference', 'Resolved') or open the case for details.")}
              </p>
            </div>
          </details>

          <div className="inbox-internal-block">
            {internalCases.length === 0 ? (
              <p className="muted">{t("Входящих обращений от педагогов пока нет.", "No incoming educator referrals yet.")}</p>
            ) : (
              <div className="inbox-table-wrap">
                <table className="inbox-table">
                  <thead>
                    <tr>
                      <th>{t("Дата", "Date")}</th>
                      <th>{t("Тема / Ситуация", "Topic / Situation")}</th>
                      <th>{t("Отправитель", "Sender")}</th>
                      <th>{t("Приоритет", "Priority")}</th>
                      <th>{t("Статус", "Status")}</th>
                      <th>{t("Действие", "Action")}</th>
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
                          {c.sender_name || c.sender_role || t("Педагог", "Educator")}
                        </td>
                        <td>
                          <span className={`badge ${c.priority === "urgent" || c.priority === "crisis" ? "badge--danger" : ""}`}>
                            {c.priority === "urgent" ? t("Срочно", "Urgent") : c.priority === "crisis" ? t("Кризис", "Crisis") : t("Обычный", "Standard")}
                          </span>
                        </td>
                        <td>
                          <select
                            value={c.status}
                            onChange={(e) => void onInternalStatusChange(c.id, e.target.value)}
                          >
                            {internalStatusOptions.map((o) => (
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
                            {t("Просмотр", "View")}
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

      {/* Tab 1 (Commercial): Leads from website / widgets */}
      {activeTab === "referrals" && commercial && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "10px 14px",
              marginBottom: "14px",
              borderRadius: "8px",
              background: "var(--accent-subtle, rgba(99, 102, 241, 0.08))",
              border: "1px solid var(--accent, rgba(99, 102, 241, 0.25))",
              fontSize: "0.88rem",
              lineHeight: 1.45,
            }}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>ℹ️</span>
            <div>
              <strong>{t("Общий входящий поток центра:", "Center-wide Intake Stream:")}</strong>{" "}
              {t(
                "Сюда поступают заявки со всех подключённых виджетов вашей организации. Директор и администратор видят весь поток обращений (как общих, так и к конкретным психологам), могут отслеживать их статус и сразу создавать рабочие карточки консультаций.",
                "Inquiries from all connected widgets across your organization arrive here. Directors and admins see all client bookings (both general and psychologist-specific), track statuses, and create consultation cases directly.",
              )}
            </div>
          </div>

          <details className="inbox-meta-details" style={{ fontSize: '0.9rem', margin: '0 0 18px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', background: 'var(--surface-subtle, rgba(255,255,255,0.03))' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: '600', outline: 'none' }}>
              {t(
                "💡 Как настроить приём заявок для организации или конкретных специалистов",
                "💡 How to set up booking leads for the organization or specific specialists",
              )}
            </summary>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem', lineHeight: '1.45' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
                <strong>
                  {t(
                    "1. Общая ссылка для записи в центр (для Taplink, Telegram, VK, WhatsApp):",
                    "1. Center-wide booking link (for Linktree, Telegram, WhatsApp, social profiles):",
                  )}
                </strong>
                <div style={{ marginTop: '4px' }}>
                  {t(
                    "Разместите ссылку в шапке профиля центра или отправьте клиенту (клиент попадает в общий поток центра):",
                    "Place link in center profile bio or send directly to client (client enters the general center pool):",
                  )}
                  <div style={{ marginTop: '4px' }}>
                    <code>https://ida-psy.pro/book/?center={orgCode}</code>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    💡 <em>{t("Для персональной записи к конкретному психологу добавьте параметр специалиста:", "For direct booking with a specific specialist, add specialist param:")} <code>https://ida-psy.pro/book/?center={orgCode}&amp;spec=ID_СПЕЦИАЛИСТА</code></em>
                  </div>
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
                <strong>
                  {t(
                    "2. Виджет онлайн-записи на ваш сайт (вставка в 1 строчку):",
                    "2. Online booking widget for your website (1-line embed):",
                  )}
                </strong>
                <p style={{ margin: '4px 0' }}>
                  {t(
                    "Вставьте этот код на страницу вашего сайта (или передайте вашему администратору сайта):",
                    "Embed this code into your website page (or pass to your webmaster):",
                  )}
                </p>
                <div style={{ marginTop: '4px' }}>
                  <code>&lt;script src=&quot;https://ida-psy.pro/embed/embed.js&quot; data-center=&quot;{orgCode}&quot;&gt;&lt;/script&gt;</code>
                </div>
              </div>

              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
                <strong>
                  {t(
                    "3. Как распределяются заявки внутри организации:",
                    "3. How leads are distributed across the organization:",
                  )}
                </strong>
                <p style={{ margin: '4px 0' }}>
                  {t(
                    "• В кабинете директора отображаются ВСЕ заявки по организации с указанием выбранного специалиста (если был выбран).",
                    "• In the Director workspace, ALL organization leads are shown with chosen specialist indicated.",
                  )}
                </p>
                <p style={{ margin: '4px 0' }}>
                  {t(
                    "• Психологи центра в своих личных кабинетах видят назначенные им заявки и могут переводить их в рабочие консультации.",
                    "• Center psychologists see assigned leads in their personal workspaces and convert them to consultation cases.",
                  )}
                </p>
              </div>

              <details style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                <summary style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  {t("Параметры для IT-специалиста / API-интеграций", "Parameters for IT specialist / API integrations")}
                </summary>
                <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                  <p style={{ margin: '2px 0' }}>{t("Идентификатор организации:", "Organization ID:")} <code>{orgCode}</code></p>
                  <p style={{ margin: '2px 0' }}>{t("Эндпоинт приёма заявок (Cloud Webhook):", "Leads intake endpoint (Cloud Webhook):")} <code>https://api.prevention.school/api/leads/submit</code></p>
                  {status && (
                    <p style={{ margin: '2px 0' }}>{t("Локальный шлюз (Desktop):", "Local Gateway (Desktop):")} <code>{status.inbox_url}</code> ({status.running ? t("активен", "active") : t("остановлен", "stopped")})</p>
                  )}
                </div>
              </details>
            </div>
          </details>

          {prepRows.length > 0 && (
            <div className="inbox-prep-block">
              <h3>{t("Подготовка к консультации", "Consultation Preparation")}</h3>
              <p className="muted tiny">
                {t(
                  "Заявки с уже созданной карточкой — откройте дело, просмотрите поля и сгенерируйте план (не раньше, чем карточка сохранена).",
                  "Leads with created case card — open case, review fields, and generate session plan.",
                )}
              </p>
              <div className="inbox-table-wrap">
                <table className="inbox-table">
                  <thead>
                    <tr>
                      <th>{t("Дата", "Date")}</th>
                      <th>{t("Имя", "Name")}</th>
                      <th>{t("Контакт", "Contact")}</th>
                      <th>{t("Статус", "Status")}</th>
                      <th>{t("Карточка", "Case Card")}</th>
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
                            {statusOptions.find((o) => o.value === lead.status)?.label || lead.status}
                          </td>
                          <td>{caseId ? t("есть", "yes") : t("нет", "no")}</td>
                          <td className="inbox-table-actions">
                            {caseId ? (
                              <button
                                type="button"
                                className="ob-btn"
                                onClick={() => requestOpenConsultationCase(caseId)}
                              >
                                {t("Открыть карточку", "Open Card")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ob-btn"
                                disabled={creatingLeadId === lead.id}
                                onClick={() => void onCreateCase(lead)}
                              >
                                {creatingLeadId === lead.id ? "…" : t("Создать карточку", "Create Card")}
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
              <h3 style={{ margin: 0 }}>
                {prepRows.length > 0
                  ? t("Новые и без карточки", "New and without card")
                  : t("Все заявки", "All Leads")}
              </h3>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--muted)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                {t("Показать удалённые", "Show deleted")}
              </label>
            </div>
            {openRows.length === 0 && prepRows.length === 0 ? (
              <p className="muted">
                {showDeleted
                  ? t("Заявок нет.", "No leads.")
                  : t("Заявок пока нет.", "No leads yet.")}
              </p>
            ) : openRows.length === 0 ? (
              <p className="muted tiny">
                {showDeleted
                  ? t("Удалённых заявок нет.", "No deleted leads.")
                  : t("Новых заявок без карточки нет.", "No new leads without card.")}
              </p>
            ) : (
              <div className="inbox-table-wrap">
                <table className="inbox-table">
                  <thead>
                    <tr>
                      <th>{t("Дата", "Date")}</th>
                      <th>{t("Имя", "Name")}</th>
                      <th>{t("Контакт", "Contact")}</th>
                      <th>{t("Статус", "Status")}</th>
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
                            <div className="muted tiny">
                              {t("специалист:", "specialist:")} {lead.specialist_id}
                            </div>
                          ) : null}
                        </td>
                        <td>{lead.contact || "—"}</td>
                        <td>
                          <select
                            value={lead.status}
                            onChange={(e) => void onStatusChange(lead.id, e.target.value)}
                          >
                            {statusOptions.map((o) => (
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
                            {creatingLeadId === lead.id
                              ? t("Создаём…", "Creating…")
                              : t("Создать карточку", "Create Card")}
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
