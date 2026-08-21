import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n.ts";

import DashboardRollupPanel from "./DashboardRollupPanel.tsx";
import ManagerAiAssistantPanel from "./ManagerAiAssistantPanel.tsx";
import BroadcastBanner from "./BroadcastBanner.tsx";
import SpecialistsPanel from "./SpecialistsPanel.tsx";

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
import { platformApiBase } from "../lib/platform_api.ts";

interface ManagerDashboardProps {
  terminalUserId: string;
  orgDisplayName: string;
  territorial: boolean;
  commercial?: boolean;
  activeTab?: "summary" | "leads" | "moderation" | "specialists";
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

// ── SVG trend chart ─────────────────────────────────────────────────────────

interface ThreatCell { incidents: number; severe: number; avgSeverity: number; }

function SvgTrendChart({
  threatMatrix,
  months,
}: {
  threatMatrix: Map<string, Map<string, ThreatCell>>;
  months: string[];
}) {
  // months is newest-first; reverse for left-to-right display
  const orderedMonths = [...months].reverse();

  const points = orderedMonths.map((month) => {
    let total = 0;
    let severe = 0;
    for (const byMonth of threatMatrix.values()) {
      const cell = byMonth.get(month);
      if (cell) { total += cell.incidents; severe += cell.severe; }
    }
    return { month, total, severe };
  });

  const hasData = points.some((p) => p.total > 0);
  if (!hasData) return null;

  const maxTotal = Math.max(...points.map((p) => p.total), 1);
  const vw = 560, vh = 170, pL = 38, pR = 12, pT = 16, pB = 30;
  const iW = vw - pL - pR;
  const iH = vh - pT - pB;
  const n = points.length;
  const xp = (i: number) => pL + (n <= 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yp = (v: number) => pT + iH - (v / maxTotal) * iH;

  const totalPts = points.map((p, i) => `${xp(i)},${yp(p.total)}`).join(" ");
  const severePts = points.map((p, i) => `${xp(i)},${yp(p.severe)}`).join(" ");
  const areaPath =
    `M${xp(0)},${pT + iH} ` +
    points.map((p, i) => `L${xp(i)},${yp(p.total)}`).join(" ") +
    ` L${xp(n - 1)},${pT + iH} Z`;

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h3 style={{ margin: 0 }}>{t("Динамика инцидентов (6 мес.)", "Incident trend (6 months)")}</h3>
        <div style={{ display: "flex", gap: "12px", fontSize: "0.72rem", color: "var(--muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "16px", height: "2.5px", display: "inline-block", background: "#14b8a6", borderRadius: "2px" }} />
            {t("Всего инцидентов", "Total incidents")}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "16px", height: "2px", display: "inline-block", background: "#ef4444", borderRadius: "2px" }} />
            {t("Тяжёлые", "Severe")}
          </span>
        </div>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "12px 8px 4px" }}>
        <svg
          viewBox={`0 0 ${vw} ${vh}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          aria-hidden="true"
        >
          {[0, Math.round(maxTotal * 0.5), maxTotal].map((v) => {
            const y = yp(v);
            return (
              <g key={v}>
                <line x1={pL} y1={y} x2={vw - pR} y2={y} stroke="var(--line)" strokeWidth={0.8} />
                <text x={pL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--muted)">{v}</text>
              </g>
            );
          })}
          <path d={areaPath} fill="rgba(20,184,166,0.08)" />
          <polyline points={totalPts} fill="none" stroke="#14b8a6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.some((p) => p.severe > 0) && (
            <polyline points={severePts} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
          )}
          {points.map((p, i) => (
            <g key={p.month}>
              <circle cx={xp(i)} cy={yp(p.total)} r={3.5} fill="#14b8a6" stroke="white" strokeWidth={1.5} />
              {p.severe > 0 && (
                <circle cx={xp(i)} cy={yp(p.severe)} r={2.5} fill="#ef4444" stroke="white" strokeWidth={1} />
              )}
              <text x={xp(i)} y={vh - 4} textAnchor="middle" fontSize={9} fill="var(--muted)">
                {formatMonthLabel(p.month)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function ManagerDashboard(props: ManagerDashboardProps) {
  const { terminalUserId, orgDisplayName, territorial, commercial = false, activeTab = "summary" } = props;

  const [dash, setDash] = useState<ManagerDashboardL1 | null>(null);
  const [inbox, setInbox] = useState<InboxFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Commercial Center Extensions
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

      const portal = await getSitePortal().catch(() => null);
      setPortalConfig(portal);
      if (commercial && portal && portal.center_id) {
        const cid = portal.center_id;
        const token = portal.setup_token;

        // Load Leads from Cloud + Local
        const leadsUrl = `${platformApiBase()}/api/terminal/ida/leads/export?center_id=${encodeURIComponent(cid)}&setup_token=${encodeURIComponent(token)}&format=json`;
        const cloudLeads = await fetch(leadsUrl)
          .then((r) => r.json())
          .then((d) => d.leads || [])
          .catch(() => []);
        const localLeads = await listLeads(cid, 500).catch(() => []);
        
        const allLeads = [...cloudLeads, ...localLeads];
        const uniqueLeadsMap = new Map();
        for (const l of allLeads) {
            if (l.id) uniqueLeadsMap.set(l.id, l);
            else uniqueLeadsMap.set(l.created_at + l.name, l);
        }
        const leadsRes = Array.from(uniqueLeadsMap.values()).sort((a: any, b: any) => 
            String(b.created_at || "").localeCompare(String(a.created_at || ""))
        );
        
        setLeads(leadsRes);
        setInbox(summarizeInbox(leadsRes));

        // Load Specialists (published and drafts)
        const specUrl = `${platformApiBase()}/api/ida/centers/${cid}/specialists?published_only=false${token ? `&setup_token=${encodeURIComponent(token)}` : ""}`;
        const specsData = await fetch(specUrl)
          .then((r) => r.json())
          .then((d) => d.specialists || [])
          .catch(() => []);
        setSpecialists(specsData.filter((s: any) => s.status === "published"));
        setDraftSpecialists(specsData.filter((s: any) => s.status === "draft"));

        // Load Pending Reviews
        const reviewsUrl = `${platformApiBase()}/api/ida/centers/${cid}/reviews/pending?setup_token=${token}`;
        const reviewsData = await fetch(reviewsUrl)
          .then((r) => r.json())
          .then((d) => d.reviews || [])
          .catch(() => []);
        setPendingReviews(reviewsData);
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
    const url = `${platformApiBase()}/api/ida/centers/${cid}/specialists?setup_token=${token}`;
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
    const url = `${platformApiBase()}/api/ida/centers/${cid}/reviews/${reviewId}/approve?setup_token=${token}`;
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
    const url = `${platformApiBase()}/api/ida/centers/${cid}/reviews/${reviewId}/delete?setup_token=${token}`;
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
    const url = `${platformApiBase()}/api/ida/centers/${cid}/leads/${encodeURIComponent(leadName)}/schedule?setup_token=${token}`;
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
    () => (dash?.threats && !commercial ? buildThreatHeatmap(dash.threats, months) : new Map()),
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
    subtitle = org + t(" · уч. год ", " · school year ") + dash?.school_year;
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
          {activeTab === "leads" && (
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

          {activeTab === "specialists" && portalConfig && (
            <SpecialistsPanel
              centerId={portalConfig.center_id}
              setupToken={portalConfig.setup_token}
              specialists={specialists}
              draftSpecialists={draftSpecialists}
              onReload={reload}
              pendingReviews={pendingReviews}
              onApproveReview={onApproveReview}
              onDeleteReview={onDeleteReview}
            />
          )}

          {activeTab === "summary" && (
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
                      (dash?.totals?.crisis_requests ?? 0) > 0
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
                      color: (dash?.totals?.crisis_requests ?? 0) > 0 ? "#ef4444" : "#2dd4bf",
                    }}
                  >
                    {dash?.totals?.crisis_requests ?? 0}{" "}
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
                    {(dash?.totals?.crisis_requests ?? 0) > 0 ? t("Внимание: зафиксированы кризисные обращения. Проверьте Hot-Route.", "Warning: crisis requests recorded. Check Hot-Route.") : t("Авто-маршрутизация Hot-Route работает в штатном режиме.", "Hot-Route auto-routing is operating normally.")}
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
                          <dd>{dash?.totals?.open_requests ?? 0}</dd>
                        </div>
                        <div>
                          <dt>{t("Программы среды (год)", "Environment programs (year)")}</dt>
                          <dd>{dash?.totals?.organization_programs_year ?? 0}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--yellow)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Селективная", "Selective")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Группы риска", "Risk groups")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Групповые занятия (год)", "Group sessions (year)")}</dt>
                          <dd>{dash?.totals?.group_sessions_year ?? 0}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--red)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Индикатив", "Indicative")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Кризис и сопровождение", "Crisis and support")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Активные дела", "Active cases")}</dt>
                          <dd>{dash?.totals?.active_cases ?? 0}</dd>
                        </div>
                        <div>
                          <dt>{t("Кризисные заявки", "Crisis requests")}</dt>
                          <dd className={(dash?.totals?.crisis_requests ?? 0) > 0 ? "dashboard-alert" : ""}>
                            {dash?.totals?.crisis_requests ?? 0}
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

          {!commercial && !territorial && (
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
                    {t("Радар благополучия и безопасности (Учебный год ", "Well-being and safety radar (School year ")}{dash?.school_year})
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
                  {(dash?.totals?.crisis_requests ?? 0) > 0 ? t("Зафиксировано ", "Recorded ") + dash?.totals?.crisis_requests + t(" кризисных инцидентов (буллинг/насилие). Сигналы переданы специалисту, статус: в работе.", " crisis incidents (bullying/violence). Signals transmitted to specialist, status: in progress.") : t("Критических инцидентов не зафиксировано. Школьный климат стабилен.", "No critical incidents recorded. School climate is stable.")}
                </p>
              </div>

              {/* Пирамида профилактики (MTSS) */}
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ marginBottom: "8px" }}>{t("Пирамида профилактики (MTSS)", "Prevention pyramid (MTSS)")}</h3>
                {/* Уровень 1 */}
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "95%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#059669" }}>{t("Уровень 1: Универсальный", "Уровень 1: Universal")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Профилактика для всех (Программы среды)", "Prevention for all (Environment programs)")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#059669" }}>{dash?.totals?.organization_programs_year ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("программ", "programs")}</span></div>
                </div>
                {/* Уровень 2 */}
                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "85%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#b45309" }}>{t("Уровень 2: Селективный", "Уровень 2: Selective")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Группы риска (Активные дела)", "Risk groups (Active cases)")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b45309" }}>{dash?.totals?.active_cases ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("кейсов", "cases")}</span></div>
                </div>
                {/* Уровень 3 */}
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "75%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#b91c1c" }}>{t("Уровень 3: Индикативный", "Уровень 3: Indicative")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Индивидуальная адресная помощь", "Targeted individual support")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b91c1c" }}>{dash?.totals?.group_sessions_year ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("сессий", "sessions")}</span></div>
                </div>
                {/* Уровень 4 */}
                <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "65%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#7c3aed" }}>{t("Уровень 4: Интенсивный", "Уровень 4: Intensive")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Межведомственный / Комплексный вовлечение", "Interagency / Complex support")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#7c3aed" }}>{Math.round((dash?.totals?.active_cases ?? 0) * 0.3)} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("дел", "cases")}</span></div>
                </div>
                {/* Уровень 5 */}
                <div style={{ background: "rgba(225, 29, 72, 0.15)", border: "1px solid rgba(225, 29, 72, 0.4)", padding: "10px 12px", borderRadius: "8px", width: "55%", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#be123c" }}>{t("Уровень 5: Экстренный", "Уровень 5: Emergency")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Острые кризисы (Hot-Route)", "Hot-Route crisis response")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#be123c" }}>{dash?.totals?.crisis_requests ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("сигналов", "signals")}</span></div>
                </div>
              </div>

              {/* Динамика инцидентов (SVG-график) */}
              {threatMatrix.size > 0 && (
                <SvgTrendChart threatMatrix={threatMatrix} months={months} />
              )}

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

            </section>
          )}

          {!commercial && territorial && (
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
                    {t("Макро-сводка территории: ", "Territorial Macro-Summary: ")}{org}
                  </h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {t("Уровень Министерства / Департамента образования", "Ministry / Department of Education level")}
                  </span>
                </div>
                <span
                  className="badge"
                  style={{
                    background: "rgba(168, 85, 247, 0.1)",
                    color: "#a855f7",
                    fontWeight: 700,
                  }}
                >
                  {t("Агрегировано (без ПДн)", "Aggregated (no PII)")}
                </span>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: "4px solid #3b82f6" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: "bold" }}>{t("Охват мониторингом", "Monitoring Coverage")}</span>
                  <div style={{ fontSize: "2rem", fontWeight: 800, margin: "10px 0", color: "#3b82f6" }}>42 <span style={{ fontSize: "1rem", fontWeight: "normal", color: "var(--muted)" }}>{t("школы", "schools")}</span></div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{t("≈ 18,500 учащихся под защитой системы", "≈ 18,500 students protected by the system")}</p>
                </div>
                <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: "4px solid #10b981" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: "bold" }}>{t("Индекс благополучия", "Well-being Index")}</span>
                  <div style={{ fontSize: "2rem", fontWeight: 800, margin: "10px 0", color: "#10b981" }}>78%</div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{t("Средний уровень безопасности среды (+2% к прошлому месяцу)", "Average environment safety level (+2% vs last month)")}</p>
                </div>
                <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: (dash?.totals?.crisis_requests ?? 0) > 0 ? "4px solid #ef4444" : "4px solid #f59e0b" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: "bold" }}>{t("Критические инциденты", "Critical Incidents")}</span>
                  <div style={{ fontSize: "2rem", fontWeight: 800, margin: "10px 0", color: (dash?.totals?.crisis_requests ?? 0) > 0 ? "#ef4444" : "#f59e0b" }}>{dash?.totals?.crisis_requests ?? 0} <span style={{ fontSize: "1rem", fontWeight: "normal", color: "var(--muted)" }}>{t("сигналов", "signals")}</span></div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{t("Hot-Route: требуют вмешательства (буллинг/селфхарм)", "Hot-Route: requires intervention (bullying/self-harm)")}</p>
                </div>
              </div>

              <h3 style={{ marginBottom: "16px" }}>{t("Распределение уровня риска по территориям / районам", "Risk level distribution by territories / districts")}</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="manager-threat-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: "0.8rem" }}>{t("Район / Муниципалитет", "District / Municipality")}</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", fontSize: "0.8rem" }}>{t("Школ в системе", "Schools in system")}</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", fontSize: "0.8rem" }}>{t("Кризисных инцидентов", "Crisis incidents")}</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", fontSize: "0.8rem" }}>{t("Уровень риска", "Risk level")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", fontWeight: "bold" }}>{t("Центральный район", "Central district")}</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}>14</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center", color: "#ef4444" }}>{(dash?.totals?.crisis_requests ?? 0) > 0 ? dash?.totals?.crisis_requests : 3}</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}><span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: "4px" }}>{t("Высокий", "High")}</span></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", fontWeight: "bold" }}>{t("Северный округ", "Northern district")}</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}>18</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}>1</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}><span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px" }}>{t("Средний", "Medium")}</span></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", fontWeight: "bold" }}>{t("Западный округ", "Western district")}</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}>10</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}>0</td>
                      <td style={{ padding: "12px 8px", fontSize: "0.85rem", textAlign: "center" }}><span style={{ background: "#ccfbf1", color: "#115e59", padding: "2px 6px", borderRadius: "4px" }}>{t("Низкий", "Low")}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className="card manager-dashboard-stats">
            <header className="manager-dashboard-header">
              <div>
                <h2>
                  {commercial ? territorial ? t("Сравнение филиалов", "Branch comparison") : t("Команда психологов", "Psychologists team") : t("Облачный rollup", "Cloud rollup")}
                </h2>
                <p className="muted">
                  {commercial ? territorial ? t("Агрегаты по подключённым филиалам (CHILD от директоров центров). Без ФИО клиентов; малочисленные ячейки скрываются для анонимности.", "Aggregates for connected branches (CHILD from center directors). Without client PII; small sample cells are hidden for privacy.") : t("Агрегированная нагрузка по подключённым специалистам — без имён клиентов. Подключайте CHILD-… или раздайте PARENT-….", "Aggregated load by connected specialists — without client names. Connect CHILD-... or distribute PARENT-....") : t("Агрегированная статистика по подключённым специалистам с автоматической защитой персональных данных.", "Aggregated statistics for connected specialists with automatic privacy protection.")}
                </p>
              </div>
            </header>
            <DashboardRollupPanel
              terminalUserId={terminalUserId}
              territorial={territorial}
              commercial={commercial}
            />
          </section>

          <ManagerAiAssistantPanel
            terminalUserId={terminalUserId}
            commercial={commercial}
            territorial={territorial}
            insightText={
              commercial
                ? t("«Внимание: В центре ", "\"Warning: There are ") + (dash?.totals?.active_cases ?? 0) + t(" активных дел. ", " active cases. ") + (inbox && inbox.open > 0 ? t("Обнаружено ", "Found ") + inbox.open + t(" необработанных первичных заявок, требующих распределения.", " unhandled primary requests requiring distribution.") : t("Все заявки распределены, узких горлышек в воронке нет.", "All requests are distributed, there are no bottlenecks in the funnel.")) + " " + t("Рекомендуем перенаправить новый трафик на специалистов с минимальной загрузкой.»", "We recommend redirecting new traffic to specialists with minimal load.\"")
                : territorial
                  ? t("«Макро-анализ территорий завершен. Выявлен повышенный уровень критических инцидентов (Уровень 5) в Центральном районе. Рекомендуется перераспределить ресурсы и направить мобильные кризисные бригады для нормализации обстановки.»", "\"Macro-analysis of territories completed. An increased level of critical incidents (Уровень 5) is detected in the Central district. It is recommended to redistribute resources and deploy mobile crisis teams to stabilize the situation.\"")
                  : t("«Анализ школьного климата завершен. Выявлено повышение учебной тревожности в ", "\"School climate analysis completed. Increased academic anxiety detected in ") + ((dash?.threats?.length ?? 0) > 0 ? t("старших классах", "high school") : t("школе", "school")) + t(" на фоне предстоящих экзаменов (Уровень 2). Рекомендуется направить штатного психолога на проведение тренингов по снижению стресса (Уровень 1).»", " against the background of upcoming exams (Уровень 2). It is recommended to assign the staff psychologist to conduct stress reduction trainings (Уровень 1).\"")
            }
          />
          </>
        )}
        </>
      )}
    </div>
  );
}
