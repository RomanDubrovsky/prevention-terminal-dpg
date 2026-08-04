import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n.ts";

import DashboardRollupPanel from "./DashboardRollupPanel.tsx";
import ManagerAiAssistantPanel from "./ManagerAiAssistantPanel.tsx";
import BroadcastBanner from "./BroadcastBanner.tsx";

import { listLeads, type LeadRow } from "../lib/inbox_client.ts";
import {
  buildThreatHeatmap,
  fetchManagerDashboardL1,
  formatMonthLabel,
  lastMonths,
  threatCategoryLabel,
  type ManagerDashboardL1,
} from "../lib/manager_dashboard.ts";
import { getSitePortal } from "../lib/site_portal.ts";

interface ManagerDashboardProps {
  terminalUserId: string;
  orgDisplayName: string;
  territorial: boolean;
  commercial?: boolean;
}

interface InboxFunnel {
  total: number;
  open: number;
  converted: number;
  closed: number;
}

function summarizeInbox(leads: LeadRow[]): InboxFunnel {
  let open = 0;
  let converted = 0;
  let closed = 0;
  for (const lead of leads) {
    const s = String(lead.status || "new").toLowerCase();
    if (s === "converted") converted += 1;
    else if (s === "closed") closed += 1;
    else open += 1;
  }
  return { total: leads.length, open, converted, closed };
}

export default function ManagerDashboard(props: ManagerDashboardProps) {
  const { terminalUserId, orgDisplayName, territorial, commercial = false } = props;

  const [dash, setDash] = useState<ManagerDashboardL1 | null>(null);
  const [inbox, setInbox] = useState<InboxFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Commercial Center Extensions
  const [activeTab, setActiveTab] = useState<"summary" | "leads" | "moderation">("summary");
  const [leads, setLeads] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [draftSpecialists, setDraftSpecialists] = useState<any[]>([]);
  const [portalConfig, setPortalConfig] = useState<any | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const dashData = await fetchManagerDashboardL1();
      setDash(dashData);

      if (commercial) {
        const portal = await getSitePortal().catch(() => null);
        setPortalConfig(portal);
        if (portal && portal.center_id) {
          const cid = portal.center_id;
          const token = portal.setup_token;

          // Load Leads
          const leadsRes = await listLeads(cid, 500).catch(() => []);
          setLeads(leadsRes);
          setInbox(summarizeInbox(leadsRes));

          // Load Specialists (published and drafts)
          const specUrl = `${portal.public_site_origin || ""}/api/ida/centers/${cid}/specialists?published_only=false`;
          const specsData = await fetch(specUrl)
            .then((r) => r.json())
            .then((d) => d.specialists || [])
            .catch(() => []);
          setSpecialists(specsData.filter((s: any) => s.status === "published"));
          setDraftSpecialists(specsData.filter((s: any) => s.status === "draft"));

          // Load Pending Reviews
          const reviewsUrl = `${portal.public_site_origin || ""}/api/ida/centers/${cid}/reviews/pending?setup_token=${token}`;
          const reviewsData = await fetch(reviewsUrl)
            .then((r) => r.json())
            .then((d) => d.reviews || [])
            .catch(() => []);
          setPendingReviews(reviewsData);
        }
      }
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [commercial]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onApproveSpecialist(spec: any) {
    if (!portalConfig) return;
    const cid = portalConfig.center_id;
    const token = portalConfig.setup_token;
    const url = `${portalConfig.public_site_origin || ""}/api/ida/centers/${cid}/specialists?setup_token=${token}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...spec, status: "published" }),
      });
      if (res.ok) {
        alert(t("Специалист успешно опубликован!", "Specialist successfully published!"));
        void reload();
      }
    } catch (e) {
      alert(String(e));
    }
  }

  async function onApproveReview(reviewId: string) {
    if (!portalConfig) return;
    const cid = portalConfig.center_id;
    const token = portalConfig.setup_token;
    const url = `${portalConfig.public_site_origin || ""}/api/ida/centers/${cid}/reviews/${reviewId}/approve?setup_token=${token}`;
    try {
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        void reload();
      }
    } catch (e) {
      alert(String(e));
    }
  }

  async function onDeleteReview(reviewId: string) {
    if (!portalConfig) return;
    const cid = portalConfig.center_id;
    const token = portalConfig.setup_token;
    const url = `${portalConfig.public_site_origin || ""}/api/ida/centers/${cid}/reviews/${reviewId}/delete?setup_token=${token}`;
    try {
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        void reload();
      }
    } catch (e) {
      alert(String(e));
    }
  }

  async function onScheduleLead(leadName: string, specId: string, time: string) {
    if (!portalConfig) return;
    const cid = portalConfig.center_id;
    const token = portalConfig.setup_token;
    const url = `${portalConfig.public_site_origin || ""}/api/ida/centers/${cid}/leads/${encodeURIComponent(leadName)}/schedule?setup_token=${token}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_specialist_id: specId,
          scheduled_time: time,
          status: "scheduled",
        }),
      });
      if (res.ok) {
        alert(t("Заявка успешно распределена!", "Lead successfully scheduled!"));
        void reload();
      }
    } catch (e) {
      alert(String(e));
    }
  }

  const months = useMemo(() => lastMonths(6), []);

  const threatMatrix = useMemo(
    () => (dash && !commercial ? buildThreatHeatmap(dash.threats, months) : new Map()),
    [commercial, dash, months],
  );
  const threatCategories = useMemo(() => [...threatMatrix.keys()].sort(), [threatMatrix]);

  const title = commercial
    ? territorial
      ? t("Дашборд сети центров", "Centers network dashboard")
      : t("Дашборд руководителя центра", "Center manager dashboard")
    : t("Дашборд руководителя", "Manager dashboard");

  const org = dash?.org_name || orgDisplayName;
  let subtitle = "";
  if (!dash) {
    if (commercial && territorial) {
      subtitle = orgDisplayName + t(" — сводка по филиалам без персональных данных клиентов.", " — branch summary without clients\' personal data.");
    } else if (commercial) {
      subtitle = orgDisplayName + t(" — объём работы команды, воронка заявок и облачный rollup.", " — team workload, request funnel, and cloud rollup.");
    } else {
      subtitle = orgDisplayName + t(" — угрозы, 5 звеньев профилактики и план/факт по локальным данным.", " — threats, 5 levels of prevention, and plan/actual on local data.");
    }
  } else if (commercial) {
    subtitle = territorial
      ? org + t(" · сравнение филиалов", " · branch comparison")
      : org + t(" · операционная сводка центра", " · center operations summary");
  } else {
    subtitle = org + t(" · уч. год ", " · school year ") + dash.school_year;
  }

  const conversionPct =
    inbox && inbox.total > 0
      ? Math.round((inbox.converted / Math.max(inbox.total, 1)) * 100)
      : null;

  return (
    <div className="workspace-panel-stack manager-dashboard">
      <section className="card workspace-panel">
        <header className="manager-dashboard-header">
          <div>
            <h2>{title}</h2>
            <p className="muted">{subtitle}</p>
          </div>
          <span className="manager-free-badge">{t("Бесплатно", "Free")}</span>
        </header>
        {commercial && (
          <div className="tab-switcher" style={{ display: "flex", gap: "12px", marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <button className={`tab-btn ${activeTab === "summary" ? "active" : ""}`} onClick={() => setActiveTab("summary")} style={{ background: activeTab === "summary" ? "var(--violet)" : "transparent", color: activeTab === "summary" ? "white" : "var(--text)", border: "1px solid var(--line)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              {t("Операционная сводка", "Operations summary")}
            </button>
            <button className={`tab-btn ${activeTab === "leads" ? "active" : ""}`} onClick={() => setActiveTab("leads")} style={{ background: activeTab === "leads" ? "var(--violet)" : "transparent", color: activeTab === "leads" ? "white" : "var(--text)", border: "1px solid var(--line)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              {t("Реестр заявок", "Leads registry")}
            </button>
            <button className={`tab-btn ${activeTab === "moderation" ? "active" : ""}`} onClick={() => setActiveTab("moderation")} style={{ background: activeTab === "moderation" ? "var(--violet)" : "transparent", color: activeTab === "moderation" ? "white" : "var(--text)", border: "1px solid var(--line)", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
              {t("Модерация", "Moderation")} {(pendingReviews.length > 0 || draftSpecialists.length > 0) && <span style={{ background: "#ef4444", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.7rem", marginLeft: "4px" }}>{pendingReviews.length + draftSpecialists.length}</span>}
            </button>
          </div>
        )}
      </section>

      <BroadcastBanner />

      {loading && (
        <section className="card">
          <p className="muted">{t("Загружаем сводку организации…", "Loading organization summary...")}</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="error">{t("Не удалось загрузить дашборд: ", "Failed to load dashboard: ")}{error}</p>
        </section>
      )}

      {dash && !loading && (
        <>
          {commercial && activeTab === "leads" && (
            <section className="card dashboard-section">
              <h3 style={{ marginBottom: "16px" }}>{t("Реестр заявок на прием", "Client leads registry")}</h3>
              <p className="muted tiny" style={{ marginBottom: "20px" }}>
                {t(
                  "Здесь отображаются все заявки клиентов. Вы можете распределить неподтвержденные заявки, выбрав свободного специалиста и назначив время.",
                  "Here you can see all client leads. You can schedule unscheduled leads by assigning a specialist and choosing a time."
                )}
              </p>
              {!leads.length ? (
                <p className="muted">{t("Заявок пока нет.", "No leads yet.")}</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="manager-threat-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Клиент", "Client")}</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Контакты", "Contacts")}</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Темы/Анамнез", "Intake / AI Brief")}</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Специалист", "Specialist")}</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Время приема", "Session Time")}</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Статус", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((l: any, idx: number) => {
                        const hasSchedule = l.status === "scheduled" || l.scheduled_time;
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem", fontWeight: "bold" }}>{l.name}</td>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem" }}>{l.contact}</td>
                            <td style={{ padding: "12px 8px", fontSize: "0.8rem", color: "var(--muted)" }}>
                              {l.history && <div style={{ marginBottom: "4px" }}>{l.history}</div>}
                              {l.intake_summary ? (
                                <span style={{ fontStyle: "italic" }}>
                                  {typeof l.intake_summary === "string" ? l.intake_summary : JSON.stringify(l.intake_summary)}
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem" }}>
                              {hasSchedule ? (
                                specialists.find((s) => s.specialist_id === l.assigned_specialist_id || s.specialist_id === l.matched_specialist_id)?.display_name || l.assigned_specialist_id || l.matched_specialist_id || t("Не назначен", "Unassigned")
                              ) : (
                                <select
                                  id={`spec-select-${idx}`}
                                  defaultValue={l.matched_specialist_id || ""}
                                  style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "4px", borderRadius: "4px", color: "var(--text)" }}
                                >
                                  <option value="">-- {t("Выберите специалиста", "Select specialist")} --</option>
                                  {specialists.map((s: any) => (
                                    <option key={s.specialist_id} value={s.specialist_id}>{s.display_name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem" }}>
                              {hasSchedule ? (
                                l.scheduled_time || t("Не назначено", "Not scheduled")
                              ) : (
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                  <input
                                    id={`time-input-${idx}`}
                                    type="datetime-local"
                                    style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "4px", borderRadius: "4px", color: "var(--text)" }}
                                  />
                                  <button
                                    onClick={() => {
                                      const specSelect = document.getElementById(`spec-select-${idx}`) as HTMLSelectElement;
                                      const timeInput = document.getElementById(`time-input-${idx}`) as HTMLInputElement;
                                      if (specSelect && timeInput && specSelect.value) {
                                        void onScheduleLead(l.name, specSelect.value, timeInput.value || new Date().toISOString());
                                      } else {
                                        alert(t("Выберите специалиста!", "Please select a specialist."));
                                      }
                                    }}
                                    style={{ background: "var(--violet)", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                                  >
                                    {t("Назначить", "Schedule")}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px 8px", fontSize: "0.85rem" }}>
                              <span style={{
                                background: hasSchedule ? "rgba(45, 212, 191, 0.1)" : "rgba(245, 158, 11, 0.1)",
                                color: hasSchedule ? "#2dd4bf" : "#f59e0b",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "bold"
                              }}>
                                {hasSchedule ? t("Подтверждено", "Confirmed") : t("В работе / Связаться", "In progress / Contact")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {commercial && activeTab === "moderation" && (
            <section className="card dashboard-section">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                {/* Левая колонка: Профили психологов */}
                <div>
                  <h3 style={{ marginBottom: "12px" }}>{t("Профили психологов на согласовании", "Psychologist profiles pending review")}</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    {t("Новые психологи регистрируются на сайте центра как черновики. Директор проверяет их квалификации и публикует.", "New psychologists register as drafts. The director reviews qualifications and publishes them.")}
                  </p>
                  {!draftSpecialists.length ? (
                    <p className="muted">{t("Нет профилей на согласовании.", "No profiles pending review.")}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {draftSpecialists.map((spec: any, idx: number) => (
                        <div key={idx} style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px", borderRadius: "8px" }}>
                          <strong>{spec.display_name}</strong>
                          <div style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "4px 0" }}>{spec.bio_short}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                            {t("Темы: ", "Themes: ")}{spec.problem_keys?.join(", ")}
                          </div>
                          <button
                            onClick={() => void onApproveSpecialist(spec)}
                            style={{ background: "#2dd4bf", color: "black", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginTop: "8px", fontSize: "0.8rem" }}
                          >
                            {t("Опубликовать в иконостас", "Publish to Roster")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Правая колонка: Отзывы на модерации */}
                <div>
                  <h3 style={{ marginBottom: "12px" }}>{t("Отзывы на модерации", "Reviews pending moderation")}</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    {t("Отзывы клиентов публикуются в иконостасе только после одобрения директором центра для защиты от спама.", "Client reviews are published in the roster only after approval by the center director to prevent spam.")}
                  </p>
                  {!pendingReviews.length ? (
                    <p className="muted">{t("Нет новых отзывов на модерации.", "No new reviews pending moderation.")}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {pendingReviews.map((rev: any, idx: number) => {
                        const targetSpec = specialists.find((s) => s.specialist_id === rev.specialist_id)?.display_name || rev.specialist_id;
                        return (
                          <div key={idx} style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px", borderRadius: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong>{rev.author_name}</strong>
                              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>для {targetSpec}</span>
                            </div>
                            <p style={{ margin: "6px 0", fontSize: "0.9rem" }}>{rev.text_content}</p>
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                              <button
                                onClick={() => void onApproveReview(rev.id)}
                                style={{ background: "#2dd4bf", color: "black", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem" }}
                              >
                                {t("Одобрить", "Approve")}
                              </button>
                              <button
                                onClick={() => void onDeleteReview(rev.id)}
                                style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                              >
                                {t("Отклонить", "Reject")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {((commercial && activeTab === "summary") || !commercial) && (
            <>
              {commercial ? (
            <section
              className="card dashboard-section"
              style={{
                background: "var(--surface-soft)",
                padding: "24px",
                borderRadius: "16px",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "12px",
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)" }}>
                    {territorial ? t("Сводка сети: ", "Network summary: ") : t("Сводка центра: ", "Center summary: ")}
                    {org}
                  </h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {t("Операционный ИИ-мониторинг в реальном времени", "Real-time AI operational monitoring")}
                  </span>
                </div>
                <span
                  className="badge"
                  style={{
                    background: "rgba(45, 212, 191, 0.1)",
                    color: "#2dd4bf",
                    fontWeight: 700,
                  }}
                >
                  {t("Режим: Безопасный (ПДн скрыты)", "Mode: Secure (PII hidden)")}
                </span>
              </div>

              {/* Сетка виджетов */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                {/* Карточка 1: Светофор безопасности */}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    borderTop:
                      dash.totals.crisis_requests > 0
                        ? "4px solid #ef4444"
                        : "4px solid #2dd4bf",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    {t("Безопасность и Кризисы", "Security and Crises")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: dash.totals.crisis_requests > 0 ? "#ef4444" : "#2dd4bf",
                    }}
                  >
                    {dash.totals.crisis_requests}{" "}
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: "normal",
                        color: "var(--muted)",
                      }}
                    >
                      {t("активных угроз", "active threats")}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {dash.totals.crisis_requests > 0 ? t("Внимание: зафиксированы кризисные обращения. Проверьте Hot-Route.", "Warning: crisis requests recorded. Check Hot-Route.") : t("Авто-маршрутизация Hot-Route работает в штатном режиме.", "Hot-Route auto-routing is operating normally.")}
                  </p>
                </div>

                {/* Карточка 2: Экономия времени */}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    borderTop: "4px solid var(--violet)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    {t("Сэкономлено времени", "Time saved")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: "var(--violet)",
                    }}
                  >
                    {inbox ? Math.round(inbox.converted * 0.5 * 10) / 10 : 0} {t("ч", "h")}{" "}
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: "normal",
                        color: "var(--muted)",
                      }}
                    >
                      {t("в этом цикле", "in this cycle")}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {t("Благодаря ИИ-диагностике и готовым анамнезам до сессий.", "Thanks to AI diagnostics and prepared anamnesis before sessions.")}
                  </p>
                </div>

                {/* Карточка 3: Конверсия воронки */}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    borderTop: "4px solid #2dd4bf",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    {t("Конверсия ИИ-приёмной", "AI reception conversion")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: "#2dd4bf",
                    }}
                  >
                    {conversionPct != null ? conversionPct + "%" : "—"}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {t("Посетителей сайта успешно проходят скрининг и записываются (", "Site visitors successfully pass screening and book (")}{inbox?.converted}{" "}{t("из", "of")} {inbox?.total}).
                  </p>
                </div>
              </div>

              {/* Секция ИИ-Аналитика */}
              <div
                style={{
                  marginTop: "20px",
                  background: "rgba(124, 58, 237, 0.05)",
                  border: "1px dashed rgba(124, 58, 237, 0.3)",
                  padding: "16px",
                  borderRadius: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      background: "var(--violet)",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                    }}
                  >
                    {t("ИИ-АНАЛИТИК", "AI-ANALYST")}
                  </span>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>
                    {t("Сводный инсайт по центру:", "Summary insight for the center:")}
                  </strong>
                </div>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "0.9rem",
                    color: "var(--muted)",
                    lineHeight: 1.45,
                  }}
                >
                  {t("«Внимание: В центре ", "\"Warning: There are ")}{dash.totals.active_cases}{t(" активных дел. ", " active cases. ")}{" "}
                  {inbox && inbox.open > 0 ? t("Обнаружено ", "Found ") + inbox.open + t(" необработанных первичных заявок, требующих распределения.", " unhandled primary requests requiring distribution.") : t("Все заявки распределены, узких горлышек в воронке нет.", "All requests are distributed, there are no bottlenecks in the funnel.")}{" "}{t("Рекомендуем перенаправить новый трафик на специалистов с минимальной загрузкой.»", "We recommend redirecting new traffic to specialists with minimal load.\"")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    {t("Подготовить рекомендации", "Prepare recommendations")}
                  </button>
                  <button
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    {t("Сформировать отчет директору", "Generate director report")}
                  </button>
                </div>
              </div>
            </section>

          ) : (
            <section className="card dashboard-section">
              <h3>{t("Распределение нагрузки организации по уровням профилактической работы", "Organization load distribution by prevention levels")}</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
                {/* Первичная профилактика */}
                <div style={{
                  border: "1.5px dashed rgba(45, 212, 191, 0.4)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "rgba(45, 212, 191, 0.02)"
                }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#0f766e", fontSize: "1.1rem", borderBottom: "1px solid rgba(45, 212, 191, 0.2)", paddingBottom: "6px" }}>
                    {t("Первичная профилактика", "Primary prevention")}
                  </h4>
                  <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "16px" }}>
                    <div>
                      <h5 style={{ color: 'var(--green)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Универсальная", "Universal")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Профилактика для всех", "Prevention for all")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Открытые заявки", "Open requests")}</dt>
                          <dd>{dash.totals.open_requests}</dd>
                        </div>
                        <div>
                          <dt>{t("Программы среды (год)", "Environment programs (year)")}</dt>
                          <dd>{dash.totals.organization_programs_year}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--yellow)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Селективная", "Selective")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Группы риска", "Risk groups")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Групповые занятия (год)", "Group sessions (year)")}</dt>
                          <dd>{dash.totals.group_sessions_year}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--red)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Индикатив", "Indicative")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Кризис и сопровождение", "Crisis and support")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Активные дела", "Active cases")}</dt>
                          <dd>{dash.totals.active_cases}</dd>
                        </div>
                        <div>
                          <dt>{t("Кризисные заявки", "Crisis requests")}</dt>
                          <dd className={dash.totals.crisis_requests > 0 ? "dashboard-alert" : ""}>
                            {dash.totals.crisis_requests}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>

                {/* Вторичная профилактика */}
                <div style={{
                  border: "1.5px solid rgba(249, 115, 22, 0.4)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "rgba(249, 115, 22, 0.02)"
                }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#c2410c", fontSize: "1.1rem", borderBottom: "1px solid rgba(249, 115, 22, 0.2)", paddingBottom: "6px" }}>
                    {t("Вторичная профилактика", "Secondary prevention")}
                  </h4>
                  <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "16px" }}>
                    <div>
                      <h5 style={{ color: 'var(--orange)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Вторичная", "Secondary")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Группы риска и кейсы", "Risk groups and cases")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("На сопровождении", "Under monitoring")}</dt>
                          <dd>—</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>

                {/* Третичная профилактика */}
                <div style={{
                  border: "1.5px solid rgba(168, 85, 247, 0.4)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "rgba(168, 85, 247, 0.02)"
                }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#7e22ce", fontSize: "1.1rem", borderBottom: "1px solid rgba(168, 85, 247, 0.2)", paddingBottom: "6px" }}>
                    {t("Третичная профилактика", "Tertiary prevention")}
                  </h4>
                  <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "16px" }}>
                    <div>
                      <h5 style={{ color: 'var(--purple)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Третичная", "Tertiary")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Кризис и реабилитация", "Crisis and rehabilitation")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Интенсивное вмешательство", "Intensive intervention")}</dt>
                          <dd>—</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {!commercial && (
            <section
              className="card dashboard-section"
              style={{
                background: "var(--surface-soft)",
                padding: "24px",
                borderRadius: "16px",
                border: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "12px",
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)" }}>
                    {t("Сводка школы: ", "School summary: ")}{org}
                  </h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {t("Радар благополучия и безопасности (Учебный год ", "Well-being and safety radar (School year ")}{dash.school_year})
                  </span>
                </div>
                <span
                  className="badge"
                  style={{
                    background: "rgba(45, 212, 191, 0.1)",
                    color: "#2dd4bf",
                    fontWeight: 700,
                  }}
                >
                  {t("Стандарт FERPA / ФЗ-152 (Без ФИО)", "FERPA / FZ-152 standard (Without PII)")}
                </span>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text)" }}>
                  {dash.totals.crisis_requests > 0 ? t("Зафиксировано ", "Recorded ") + dash.totals.crisis_requests + t(" кризисных инцидентов (буллинг/насилие). Сигналы переданы специалисту, статус: в работе.", " crisis incidents (bullying/violence). Signals transmitted to specialist, status: in progress.") : t("Критических инцидентов не зафиксировано. Школьный климат стабилен.", "No critical incidents recorded. School climate is stable.")}
                </p>
              </div>

              {/* Пирамида профилактики (MTSS) */}
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ marginBottom: "8px" }}>{t("Пирамида профилактики (MTSS)", "Prevention pyramid (MTSS)")}</h3>
                {/* Tier 1 */}
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "95%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#059669" }}>{t("Tier 1: Универсальный", "Tier 1: Universal")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Профилактика для всех (Программы среды)", "Prevention for all (Environment programs)")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#059669" }}>{dash.totals.organization_programs_year} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("программ", "programs")}</span></div>
                </div>
                {/* Tier 2 */}
                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "85%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#b45309" }}>{t("Tier 2: Селективный", "Tier 2: Selective")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Группы риска (Активные дела)", "Risk groups (Active cases)")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b45309" }}>{dash.totals.active_cases} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("кейсов", "cases")}</span></div>
                </div>
                {/* Tier 3 */}
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "75%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#b91c1c" }}>{t("Tier 3: Индикативный", "Tier 3: Indicative")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Индивидуальная адресная помощь", "Targeted individual support")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b91c1c" }}>{dash.totals.group_sessions_year} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("сессий", "sessions")}</span></div>
                </div>
                {/* Tier 4 */}
                <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "65%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#7c3aed" }}>{t("Tier 4: Интенсивный", "Tier 4: Intensive")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Межведомственный / Комплексный вовлечение", "Interagency / Complex support")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#7c3aed" }}>{Math.round(dash.totals.active_cases * 0.3)} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("дел", "cases")}</span></div>
                </div>
                {/* Tier 5 */}
                <div style={{ background: "rgba(225, 29, 72, 0.15)", border: "1px solid rgba(225, 29, 72, 0.4)", padding: "10px 12px", borderRadius: "8px", width: "55%", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#be123c" }}>{t("Tier 5: Экстренный", "Tier 5: Emergency")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Острые кризисы (Hot-Route)", "Hot-Route crisis response")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#be123c" }}>{dash.totals.crisis_requests} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("сигналов", "signals")}</span></div>
                </div>
              </div>

              {/* Тепловая карта школы (Топография стресса) */}
              {threatCategories.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ marginBottom: "8px" }}>{t("Топография стресса (Карта угроз)", "Stress topography (Threat map)")}</h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                    {t("Агрегированный срез проблемных зон по PIE-осям. Цвет ячейки — интенсивность проблемы по месяцам.", "Aggregated slice of problem areas by PIE axes. Cell color indicates problem intensity by month.")}
                  </p>
                  <div className="manager-threat-table-wrap" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "1px" }}>
                    <table className="manager-threat-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Категория (PIE)", "Category (PIE)")}</th>
                          {months.map((m) => (
                            <th key={m} style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", fontSize: "0.8rem" }}>{formatMonthLabel(m)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {threatCategories.map((category) => {
                          const byMonth = threatMatrix.get(category)!;
                          return (
                            <tr key={category}>
                              <th scope="row" style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem", fontWeight: "normal", color: "var(--text)" }}>{threatCategoryLabel(category)}</th>
                              {months.map((m) => {
                                const cell = byMonth.get(m);
                                if (!cell || cell.incidents === 0) {
                                  return (
                                    <td key={m} style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
                                      —
                                    </td>
                                  );
                                }
                                const severeRatio = cell.severe / Math.max(cell.incidents, 1);
                                let bg = "var(--surface-soft)";
                                let color = "var(--text)";
                                if (severeRatio >= 0.5) { bg = "#fee2e2"; color = "#991b1b"; }
                                else if (severeRatio >= 0.25) { bg = "#fef3c7"; color = "#92400e"; }
                                else { bg = "#ccfbf1"; color = "#115e59"; }
                                
                                return (
                                  <td
                                    key={m}
                                    style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", background: bg, color: color, fontSize: "0.85rem", fontWeight: "bold" }}
                                    title={t("Событий: ", "Events: ") + cell.incidents + t(", тяжёлых: ", ", severe: ") + cell.severe}
                                  >
                                    {cell.incidents}
                                    {cell.severe > 0 && <span style={{ opacity: 0.7, fontSize: "0.7rem", marginLeft: "2px" }}>+{cell.severe}</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Секция ИИ-Аналитика и Отчетность */}
              <div
                style={{
                  marginTop: "20px",
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.05) 100%)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "16px",
                  borderRadius: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      background: "#059669",
                      color: "white",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {t("ИИ-АНАЛИТИК", "AI-ANALYST")}
                  </span>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>
                    {t("Резюме и Отчетность:", "Summary and Reporting:")}
                  </strong>
                </div>
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: "0.9rem",
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  {t("«Анализ школьного климата завершен. Выявлено повышение учебной тревожности в ", "\"School climate analysis completed. Increased academic anxiety detected in ")}{dash.threats.length > 0 ? t("старших классах", "high school") : t("школе", "school")}{t(" на фоне предстоящих экзаменов (Tier 2). Рекомендуется направить штатного психолога на проведение тренингов по снижению стресса (Tier 1).»", " against the background of upcoming exams (Tier 2). It is recommended to assign the staff psychologist to conduct stress reduction trainings (Tier 1).\"")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    style={{
                      background: "#059669",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                      color: "white",
                      boxShadow: "0 2px 4px rgba(5, 150, 105, 0.2)",
                    }}
                  >
                    {t("Сгенерировать отчет (Word/PDF)", "Generate report (Word/PDF)")}
                  </button>
                  <button
                    style={{
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      color: "#047857",
                    }}
                  >
                    {t("Рекомендации педсовету", "Recommendations for the teachers\' council")}
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </>
  )}

      <section className="card manager-dashboard-stats">
        <header className="manager-dashboard-header">
          <div>
            <h2>
              {commercial ? territorial ? t("Сравнение филиалов", "Branch comparison") : t("Команда психологов", "Psychologists team") : t("Облачный rollup", "Cloud rollup")}
            </h2>
            <p className="muted">
              {commercial ? territorial ? t("Агрегаты по подключённым филиалам (CHILD от директоров центров). Без ФИО клиентов; мелкие ячейки скрываются (k-anonymity).", "Aggregates for connected branches (CHILD from center directors). Without client PII; small cells are hidden (k-anonymity).") : t("Агрегированная нагрузка по подключённым специалистам — без имён клиентов. Подключайте CHILD-… или раздайте PARENT-….", "Aggregated load by connected specialists — without client names. Connect CHILD-... or distribute PARENT-....") : t("Агрегированная статистика по подключённым специалистам — без ФИО (k-anonymity).", "Aggregated statistics for connected specialists — without PII (k-anonymity).")}
            </p>
          </div>
        </header>
        <DashboardRollupPanel
          terminalUserId={terminalUserId}
          territorial={territorial}
          commercial={commercial}
        />
      </section>

      <ManagerAiAssistantPanel terminalUserId={terminalUserId} />
    </div>
  );
}
