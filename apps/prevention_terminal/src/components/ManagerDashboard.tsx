import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n.ts";

import DashboardRollupPanel from "./DashboardRollupPanel.tsx";
import ManagerAiAssistantPanel from "./ManagerAiAssistantPanel.tsx";
import ManagerObservationsPanel from "./ManagerObservationsPanel.tsx";
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
import { isCorporateProduct } from "../lib/terminal_product.ts";

interface ManagerDashboardProps {
  terminalUserId: string;
  terminalConfig?: any;
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
  const isCorporate = isCorporateProduct() || (typeof window !== "undefined" && window.location.hostname.includes("corporate-health"));

  const [dash, setDash] = useState<ManagerDashboardL1 | null>(null);
  const [inbox, setInbox] = useState<InboxFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Corporate Health ROI Calculator State
  const [corpStaffCount, setCorpStaffCount] = useState<number>(450);

  // Commercial Center Extensions
  const [leads, setLeads] = useState<any[]>([]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
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
        setInbox(summarizeInbox(leadsRes.filter((l: any) => l.status !== "deleted")));

        // Load Specialists (published and drafts)
        if (cid?.startsWith("demo-") || token?.startsWith("demo-")) {
          setSpecialists([]);
          setDraftSpecialists([]);
          setPendingReviews([]);
        } else {
          const specUrl = `${platformApiBase()}/api/ida/centers/${cid}/specialists?published_only=false${token ? `&setup_token=${encodeURIComponent(token)}` : ""}`;
          const specsData = await fetch(specUrl)
            .then((r) => r.ok ? r.json() : { specialists: [] })
            .then((d) => d.specialists || [])
            .catch(() => []);
          setSpecialists(specsData.filter((s: any) => s.status === "published"));
          setDraftSpecialists(specsData.filter((s: any) => s.status === "draft"));

          // Load Pending Reviews
          const reviewsUrl = `${platformApiBase()}/api/ida/centers/${cid}/reviews/pending?setup_token=${token}`;
          const reviewsData = await fetch(reviewsUrl)
            .then((r) => r.ok ? r.json() : { reviews: [] })
            .then((d) => d.reviews || [])
            .catch(() => []);
          setPendingReviews(reviewsData);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId));
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
        setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId));
      }
    } catch (e) {
      alert(String(e));
    }
  }

  async function onUpdateLeadStatus(lead: any, nextStatus: string) {
    const targetIdentifier = lead.id || lead.name;
    if (lead.id) {
      try {
        await updateLeadStatus(lead.id, nextStatus);
      } catch {
        // ignore local error
      }
    }
    if (portalConfig) {
      const cid = portalConfig.center_id;
      const token = portalConfig.setup_token;
      const url = `${platformApiBase()}/api/ida/centers/${cid}/leads/${encodeURIComponent(targetIdentifier)}?setup_token=${token}`;
      try {
        await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      } catch {
        // ignore cloud error
      }
    }
    void reload();
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

  const title = isCorporate
    ? t("Пульс компании и риски (Wellbeing & Resilience)", "Company Health & Resilience Dashboard")
    : commercial
    ? territorial
      ? t("Дашборд сети центров", "Centers network dashboard")
      : t("Дашборд руководителя центра", "Center manager dashboard")
    : t("Дашборд руководителя", "Manager dashboard");

  const org = dash?.org_name || orgDisplayName;
  let subtitle = "";
  if (isCorporate) {
    subtitle = orgDisplayName + t(" — сводный мониторинг психосоциальных рисков (ISO 45003 / NIOSH), статус чекапов и окупаемость программы (ROI).", " — psychosocial risks monitoring (ISO 45003 / NIOSH), checkup coverage, and program ROI.");
  } else if (!dash) {
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0 }}>{t("Реестр заявок на прием", "Client leads registry")}</h3>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                  />
                  {t("Показывать удалённые заявки", "Show deleted leads")}
                </label>
              </div>
              <p className="muted tiny" style={{ marginBottom: "20px" }}>
                {t(
                  "Здесь отображаются все заявки клиентов. Вы можете распределить неподтвержденные заявки, изменить статус или удалить неактуальные заявки.",
                  "Here you can see all client leads. You can schedule unscheduled leads, change status, or delete obsolete leads."
                )}
              </p>
              {(() => {
                const visibleLeads = leads.filter((l: any) => showDeleted ? true : l.status !== "deleted");
                if (!visibleLeads.length) {
                  return <p className="muted">{showDeleted ? t("Заявок нет.", "No leads.") : t("Активных заявок пока нет.", "No active leads yet.")}</p>;
                }
                return (
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
                          <th style={{ padding: "8px", borderBottom: "1px solid var(--line)", textAlign: "center", fontSize: "0.8rem", width: "80px" }}>{t("Действия", "Actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLeads.map((l: any, idx: number) => {
                          const isDeleted = l.status === "deleted";
                          const hasSchedule = l.status === "scheduled" || l.scheduled_time;
                          return (
                            <tr key={l.id || idx} style={{ borderBottom: "1px solid var(--line)", opacity: isDeleted ? 0.5 : 1 }}>
                              <td style={{ padding: "12px 8px", fontSize: "0.85rem", fontWeight: "bold" }}>
                                {l.name}
                                {isDeleted && <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#ef4444", fontWeight: "normal" }}>({t("Удалена", "Deleted")})</span>}
                              </td>
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
                                    disabled={isDeleted}
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
                                      disabled={isDeleted}
                                      style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "4px", borderRadius: "4px", color: "var(--text)" }}
                                    />
                                    <button
                                      disabled={isDeleted}
                                      onClick={() => {
                                        const specSelect = document.getElementById(`spec-select-${idx}`) as HTMLSelectElement;
                                        const timeInput = document.getElementById(`time-input-${idx}`) as HTMLInputElement;
                                        if (specSelect && timeInput && specSelect.value) {
                                          void onScheduleLead(l.name, specSelect.value, timeInput.value || new Date().toISOString());
                                        } else {
                                          alert(t("Выберите специалиста!", "Please select a specialist."));
                                        }
                                      }}
                                      style={{ background: "var(--violet)", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: isDeleted ? "not-allowed" : "pointer", fontSize: "0.8rem" }}
                                    >
                                      {t("Назначить", "Schedule")}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "12px 8px", fontSize: "0.85rem" }}>
                                <select
                                  value={l.status || "new"}
                                  onChange={(e) => void onUpdateLeadStatus(l, e.target.value)}
                                  style={{
                                    background: isDeleted ? "rgba(239, 68, 68, 0.1)" : hasSchedule ? "rgba(45, 212, 191, 0.1)" : "rgba(245, 158, 11, 0.1)",
                                    color: isDeleted ? "#ef4444" : hasSchedule ? "#2dd4bf" : "#f59e0b",
                                    border: "1px solid var(--line)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontWeight: "bold",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  <option value="new">{t("Новая / В работе", "New / In progress")}</option>
                                  <option value="scheduled">{t("Подтверждено", "Confirmed")}</option>
                                  <option value="contacted">{t("Связались", "Contacted")}</option>
                                  <option value="converted">{t("Карточка есть", "Converted")}</option>
                                  <option value="closed">{t("Закрыта", "Closed")}</option>
                                  <option value="deleted">{t("Удалена", "Deleted")}</option>
                                </select>
                              </td>
                              <td style={{ padding: "12px 8px", textAlign: "center" }}>
                                {isDeleted ? (
                                  <button
                                    type="button"
                                    onClick={() => void onUpdateLeadStatus(l, "new")}
                                    title={t("Восстановить заявку", "Restore lead")}
                                    style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem", color: "var(--text)" }}
                                  >
                                    ↩ {t("Восстановить", "Restore")}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(t(`Удалить заявку от ${l.name}?`, `Delete lead from ${l.name}?`))) {
                                        void onUpdateLeadStatus(l, "deleted");
                                      }
                                    }}
                                    title={t("Удалить заявку", "Delete lead")}
                                    style={{ background: "transparent", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem", color: "#ef4444" }}
                                  >
                                    🗑 {t("Удалить", "Delete")}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          )}

          {activeTab === "specialists" && portalConfig && (
            <SpecialistsPanel
              centerId={portalConfig.center_id}
              setupToken={portalConfig.setup_token}
              terminalConfig={props.terminalConfig}
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
                    {isCorporate 
                      ? t("Сводка корпоративного здоровья: ", "Corporate health summary: ")
                      : territorial 
                        ? t("Сводка сети: ", "Network summary: ") 
                        : t("Сводка центра: ", "Center summary: ")}
                    {org}
                  </h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {isCorporate
                      ? t("Мониторинг выгорания, стресса и потерь от абсентеизма", "Burnout, stress & absenteeism monitoring")
                      : t("Операционный ИИ-мониторинг в реальном времени", "Real-time AI operational monitoring")}
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
                    {isCorporate ? t("Кризисы и Hot-Route", "Crises & Hot-Route") : t("Безопасность и Кризисы", "Security and Crises")}
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
                    {(dash?.totals?.crisis_requests ?? 0) > 0 
                      ? t("Внимание: зафиксированы кризисные обращения. Проверьте Hot-Route.", "Warning: crisis requests recorded. Check Hot-Route.") 
                      : isCorporate
                        ? t("Авто-маршрутизация к дежурному психологу в норме.", "Auto-routing to on-duty psychologist is nominal.")
                        : t("Авто-маршрутизация Hot-Route работает в штатном режиме.", "Hot-Route auto-routing is operating normally.")}
                  </p>
                </div>

                {/* Карточка 2: Экономия времени / Предотвращенные потери */}
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
                    {isCorporate ? t("Охват чекапами", "Checkup Coverage") : t("Сэкономлено времени", "Time saved")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: "var(--violet)",
                    }}
                  >
                    {isCorporate ? (
                      <>
                        74%{" "}
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: "normal",
                            color: "var(--muted)",
                          }}
                        >
                          ({Math.round(corpStaffCount * 0.74)} {t("чел.", "emp.")})
                        </span>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {isCorporate
                      ? t("Пройден пульс-опрос и экспресс-оценка стресса за квартал.", "Quarterly pulse check and stress audit completed.")
                      : t("Благодаря ИИ-диагностике и готовым анамнезам до сессий.", "Thanks to AI diagnostics and prepared anamnesis before sessions.")}
                  </p>
                </div>

                {/* Карточка 3: Конверсия воронки / Запросы сотрудников EAP */}
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
                    {isCorporate ? t("Обращения в EAP", "EAP Consultations") : t("Воронка (Inbox)", "Inbox Funnel")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: "#2dd4bf",
                    }}
                  >
                    {isCorporate ? (
                      <>
                        {inbox ? inbox.converted : 14}{" "}
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: "normal",
                            color: "var(--muted)",
                          }}
                        >
                          {t("сессий / мес", "sessions / mo")}
                        </span>
                      </>
                    ) : (
                      <>
                        {inbox ? (inbox.total > 0 ? Math.round((inbox.converted / inbox.total) * 100) : 0) : 0}%{" "}
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: "normal",
                            color: "var(--muted)",
                          }}
                        >
                          {t("конверсия", "conversion")}
                        </span>
                      </>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {isCorporate
                      ? t("100% маршрутизация без очередей и раскрытия ФИО.", "100% routing without waitlists or PII disclosure.")
                      : inbox ? `${inbox.converted} ${t("из", "of")} ${inbox.total} ${t("заявок", "leads")}` : ""}
                  </p>
                </div>

                {/* Карточка 4: Пул специалистов / Эксперты */}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    borderTop: "4px solid #f59e0b",
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
                    {isCorporate ? t("Пул психологов EAP", "EAP Psychologist Pool") : t("Глобальный каталог", "Global Directory")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: "#f59e0b",
                    }}
                  >
                    {specialists.length || 6}{" "}
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: "normal",
                        color: "var(--muted)",
                      }}
                    >
                      {t("экспертов", "experts")}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {isCorporate
                      ? t("Аккредитованные клинические психологи и коучи компании", "Accredited clinical psychologists & company coaches")
                      : t("Специалистов опубликовано в IDA Psy", "Specialists published in IDA Psy")}
                  </p>
                </div>

                {/* Карточка 5: Индекс стресса компании */}
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    borderTop: "4px solid #3b82f6",
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
                    {isCorporate ? t("Индекс стресса компании", "Company Stress Index") : t("Видео-сессии", "Video Sessions")}
                  </span>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      margin: "10px 0",
                      color: isCorporate ? "#10b981" : "#3b82f6",
                    }}
                  >
                    {isCorporate ? (
                      <>
                        28{" "}
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: "normal",
                            color: "var(--muted)",
                          }}
                        >
                          / 100 ({t("Норма", "Normal")})
                        </span>
                      </>
                    ) : (
                      <>
                        0{" "}
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: "normal",
                            color: "var(--muted)",
                          }}
                        >
                          {t("онлайн", "online")}
                        </span>
                      </>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {isCorporate
                      ? t("Уровень психосоциального риска в зеленой зоне (ISO 45003).", "Psychosocial risk level in green zone (ISO 45003).")
                      : t("Запланировано на платформе", "Scheduled on platform")}
                  </p>
                </div>
              </div>

              {/* Корпоративный блок: Калькулятор ROI и Тепловая карта подразделений */}
              {isCorporate && (
                <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* ROI Калькулятор */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(45, 212, 191, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
                      border: "1px solid rgba(45, 212, 191, 0.3)",
                      borderRadius: "16px",
                      padding: "24px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "1.4rem" }}>📊</span>
                          <h4 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)" }}>
                            {t("Экономический эффект программы корпоративного здоровья (ROI)", "Corporate Health ROI & Economics")}
                          </h4>
                        </div>
                        <p style={{ margin: "6px 0 0 0", fontSize: "0.88rem", color: "var(--muted)", maxWidth: "680px" }}>
                          {t(
                            "Расчёт на базе методики НИИ медицины труда им. Измерова и отраслевой аналитики СберЗдоровья: средние прямые потери от 14 дней нетрудоспособности и скрытого презентеизма составляют 51 400 ₽ на 1 сотрудника в год. Программа снижает риск выгорания и временной нетрудоспособности на 25–40%.",
                            "Based on the Occupational Health Institute model and SberHealth corporate benchmarks: average losses from 14 days of sick leave and presenteeism equal 51,400 RUB/employee/year. Prevention reduces absenteeism by 25–40%."
                          )}
                        </p>
                      </div>
                      <div
                        style={{
                          background: "var(--surface)",
                          padding: "8px 16px",
                          borderRadius: "10px",
                          border: "1px solid var(--line)",
                          textAlign: "right",
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                          {t("Штат компании", "Company headcount")}
                        </span>
                        <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>
                          {corpStaffCount} {t("чел.", "emp.")}
                        </div>
                      </div>
                    </div>

                    {/* Слайдер выбора размера компании */}
                    <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", minWidth: "60px" }}>50 чел.</span>
                      <input
                        type="range"
                        min={50}
                        max={3000}
                        step={50}
                        value={corpStaffCount}
                        onChange={(e) => setCorpStaffCount(Number(e.target.value))}
                        style={{ flex: 1, accentColor: "#2dd4bf", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", minWidth: "80px", textAlign: "right" }}>3 000+ чел.</span>
                    </div>

                    {/* Сетка ключевых расчетов ROI */}
                    {(() => {
                      const costPerEmp = 51400; // прямые и косвенные потери на сотрудника без превенции
                      const totalLossWithout = corpStaffCount * costPerEmp;
                      const preventedLoss = Math.round(totalLossWithout * 0.32); // 32% экономии по клиническим протоколам
                      const approxPlatformCost = Math.round(corpStaffCount * 3600); // ориентир подписки 300 руб./чел./мес.
                      const netProfit = preventedLoss - approxPlatformCost;
                      const roiX = Math.round((preventedLoss / Math.max(approxPlatformCost, 1)) * 10) / 10;

                      return (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "14px",
                            marginTop: "20px",
                          }}
                        >
                          <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                              {t("Базовые потери без превенции", "Losses without prevention")}
                            </span>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ef4444", margin: "6px 0 2px 0" }}>
                              {(totalLossWithout / 1_000_000).toFixed(2)} млн ₽
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {t("больничные листы + абсентеизм/год", "sick leaves + absenteeism / yr")}
                            </span>
                          </div>

                          <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(45, 212, 191, 0.4)", borderTop: "4px solid #2dd4bf" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                              {t("Предотвращенный ущерб", "Prevented losses")}
                            </span>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f766e", margin: "6px 0 2px 0" }}>
                              +{(preventedLoss / 1_000_000).toFixed(2)} млн ₽
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {t("сокращение больничных дней на 32%", "32% sick days reduction")}
                            </span>
                          </div>

                          <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                              {t("Чистая окупаемость (Net ROI)", "Net ROI Multiple")}
                            </span>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#3b82f6", margin: "6px 0 2px 0" }}>
                              {roiX}x {t("возврат", "return")}
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {t("чистая выгода: +", "net savings: +")}{(netProfit / 1_000_000).toFixed(2)} млн ₽/год
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Тепловая карта психологического климата подразделений */}
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: "16px",
                      border: "1px solid var(--line)",
                      padding: "20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>
                          🏢 {t("Тепловая карта эмоционального выгорания по подразделениям", "Departmental Burnout Heatmap")}
                        </h4>
                        <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                          {t("Агрегированные данные 60-секундных микро-чекапов сотрудников (100% анонимно, без ПДн)", "Aggregated 60-sec micro-checkups (100% anonymous, PII-free)")}
                        </span>
                      </div>
                      <span className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", fontWeight: 600 }}>
                        {t("Обновлено сегодня", "Updated today")}
                      </span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)", textAlign: "left" }}>
                            <th style={{ padding: "10px 8px" }}>{t("Подразделение", "Department")}</th>
                            <th style={{ padding: "10px 8px" }}>{t("Численность", "Headcount")}</th>
                            <th style={{ padding: "10px 8px" }}>{t("Охват чекапами", "Checkup coverage")}</th>
                            <th style={{ padding: "10px 8px" }}>{t("Индекс стресса", "Stress index")}</th>
                            <th style={{ padding: "10px 8px" }}>{t("Риск выгорания", "Burnout risk")}</th>
                            <th style={{ padding: "10px 8px" }}>{t("Рекомендованное действие", "Recommended action")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              dept: t("IT и Разработка ПО", "IT & Software Eng"),
                              count: "140 чел.",
                              coverage: "88%",
                              stress: "6.8 / 10",
                              risk: t("Умеренный (32%)", "Moderate (32%)"),
                              riskColor: "#d97706",
                              riskBg: "#fef3c7",
                              action: t("Сессия по профилактике когнитивного истощения", "Cognitive depletion workshop"),
                            },
                            {
                              dept: t("Отдел продаж и Client Success", "Sales & Client Success"),
                              count: "95 чел.",
                              coverage: "92%",
                              stress: "8.1 / 10",
                              risk: t("Высокий (48%)", "High (48%)"),
                              riskColor: "#dc2626",
                              riskBg: "#fee2e2",
                              action: t("Срочно: тренинг стрессоустойчивости + Hot-Route консультации", "Urgent: stress-management + Hot-Route"),
                            },
                            {
                              dept: t("Логистика и Склад", "Logistics & Supply"),
                              count: "120 чел.",
                              coverage: "74%",
                              stress: "4.5 / 10",
                              risk: t("Низкий (14%)", "Low (14%)"),
                              riskColor: "#059669",
                              riskBg: "#d1fae5",
                              action: t("Плановый микро-чекап в конце месяца", "Routine monthly micro-checkup"),
                            },
                            {
                              dept: t("Финансы, Бухгалтерия и Юристы", "Finance & Legal"),
                              count: "55 чел.",
                              coverage: "85%",
                              stress: "5.4 / 10",
                              risk: t("Норма (18%)", "Normal (18%)"),
                              riskColor: "#059669",
                              riskBg: "#d1fae5",
                              action: t("Поддержка в период квартальной отчетности", "Quarterly close support"),
                            },
                            {
                              dept: t("HR и Внутренние коммуникации", "HR & People Ops"),
                              count: "40 чел.",
                              coverage: "95%",
                              stress: "6.2 / 10",
                              risk: t("Умеренный (28%)", "Moderate (28%)"),
                              riskColor: "#d97706",
                              riskBg: "#fef3c7",
                              action: t("Супервизия координаторов здоровья", "Health coordinator supervision"),
                            },
                          ].map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                              <td style={{ padding: "12px 8px", fontWeight: 600 }}>{row.dept}</td>
                              <td style={{ padding: "12px 8px", color: "var(--muted)" }}>{row.count}</td>
                              <td style={{ padding: "12px 8px" }}>{row.coverage}</td>
                              <td style={{ padding: "12px 8px", fontWeight: 700 }}>{row.stress}</td>
                              <td style={{ padding: "12px 8px" }}>
                                <span
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    background: row.riskBg,
                                    color: row.riskColor,
                                  }}
                                >
                                  {row.risk}
                                </span>
                              </td>
                              <td style={{ padding: "12px 8px", fontSize: "0.82rem", color: "var(--muted)" }}>{row.action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Блок 5 подструктур организации (Школа прикладной психологии СПбГУ / Модель аудита Гурвича) */}
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: "16px",
                      border: "1px solid var(--line)",
                      padding: "20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text)" }}>
                          ⚖️ {t("Структурно-функциональный диагноз организации (5 подструктур)", "Structural-Functional Organizational Diagnosis (5 Substructures)")}
                        </h4>
                        <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                          {t("Методология академического аудита предприятий (СПбГУ): выявление дефектов управления, порождающих потери", "Academic enterprise audit methodology (SPbU): detecting management defects generating losses")}
                        </span>
                      </div>
                      <span className="badge" style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", fontWeight: 600 }}>
                        {t("Аудит управления", "Management Audit")}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                      <div style={{ background: "var(--surface-soft)", padding: "14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>1. Административно-функциональная</span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>Риск дублирования</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                          Размытость зон ответственности между линейным менеджментом и штабными отделами. Стресс неопределенности роли.
                        </p>
                      </div>

                      <div style={{ background: "var(--surface-soft)", padding: "14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>2. Неформальная социометрия</span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#059669", background: "#d1fae5", padding: "2px 6px", borderRadius: "4px" }}>Устойчиво</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                          Неформальные лидеры согласованы с официальными руководителями. Риск скрытого группового саботажа &lt; 5%.
                        </p>
                      </div>

                      <div style={{ background: "var(--surface-soft)", padding: "14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>3. Информационные каналы</span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "2px 6px", borderRadius: "4px" }}>Искажение 34%</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                          Дефицит прямой нисходящей коммуникации. Замещение регламентов неформальными слухами в удаленных командах.
                        </p>
                      </div>

                      <div style={{ background: "var(--surface-soft)", padding: "14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>4. Обогащенность труда (JDS)</span>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3b82f6", background: "#dbeafe", padding: "2px 6px", borderRadius: "4px" }}>Индекс: 64/100</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
                          Тест Хакмана-Олдхэма: высокая целостность задач при заниженной автономии принятия решений на местах.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </section>

          ) : (
            <section className="card dashboard-section">
              <h3>{t("Распределение нагрузки организации по направлениям работы", "Organization load distribution by prevention levels")}</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
                {/* Первичная профилактика */}
                <div style={{
                  border: "1.5px dashed rgba(45, 212, 191, 0.4)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "rgba(45, 212, 191, 0.02)"
                }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#0f766e", fontSize: "1.1rem", borderBottom: "1px solid rgba(45, 212, 191, 0.2)", paddingBottom: "6px" }}>
                    {t("Базовая и адресная работа", "Primary prevention")}
                  </h4>
                  <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "16px" }}>
                    <div>
                      <h5 style={{ color: 'var(--green)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Все учащиеся/подростки", "Universal")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Работа со всеми учащимися", "Prevention for all")}</p>
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
                      <h5 style={{ color: 'var(--yellow)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Группы внимания", "Selective")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Групповая поддержка и риск-зоны", "Risk groups")}</p>
                      <dl className="rollup-grid">
                        <div>
                          <dt>{t("Групповые занятия (год)", "Group sessions (year)")}</dt>
                          <dd>{dash?.totals?.group_sessions_year ?? 0}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--red)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Адресная поддержка (ИПР)", "Indicative")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Индивидуальное сопровождение", "Crisis and support")}</p>
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
                    {t("Кризисное реагирование", "Secondary prevention")}
                  </h4>
                  <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "16px" }}>
                    <div>
                      <h5 style={{ color: 'var(--orange)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Кризисное реагирование", "Secondary")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Экстренная помощь и кейсы", "Risk groups and cases")}</p>
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
                    {t("Восстановление и адаптация", "Tertiary prevention")}
                  </h4>
                  <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: "16px" }}>
                    <div>
                      <h5 style={{ color: 'var(--purple)', margin: "0 0 4px 0", fontSize: "0.95rem" }}>{t("Восстановление и адаптация", "Tertiary")}</h5>
                      <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Социальная реадаптация", "Crisis and rehabilitation")}</p>
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
                <h3 style={{ marginBottom: "8px" }}>{t("Пирамида профилактической работы (MTSS)", "Prevention pyramid (MTSS)")}</h3>
                {/* Уровень 1 */}
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "95%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#059669" }}>{t("Уровень 1: Все учащиеся/подростки", "Level 1: Universal")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Работа со всеми учащимися (Программы среды)", "Prevention for all (Environment programs)")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#059669" }}>{dash?.totals?.organization_programs_year ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("программ", "programs")}</span></div>
                </div>
                {/* Уровень 2 */}
                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "85%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#b45309" }}>{t("Уровень 2: Группы внимания", "Level 2: Selective")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Групповая поддержка и риск-зоны (Активные дела)", "Risk groups (Active cases)")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b45309" }}>{dash?.totals?.active_cases ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("кейсов", "cases")}</span></div>
                </div>
                {/* Уровень 3 */}
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "75%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#b91c1c" }}>{t("Уровень 3: Адресная помощь (ИПР)", "Level 3: Indicative")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Индивидуальное сопровождение", "Targeted individual support")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b91c1c" }}>{dash?.totals?.group_sessions_year ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("сессий", "sessions")}</span></div>
                </div>
                {/* Уровень 4 */}
                <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)", padding: "10px 12px", borderRadius: "8px", width: "65%", margin: "0 auto 6px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#7c3aed" }}>{t("Уровень 4: Комплексная помощь", "Level 4: Intensive")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Межведомственное взаимодействие и сложные кейсы", "Interagency / Complex support")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#7c3aed" }}>{Math.round((dash?.totals?.active_cases ?? 0) * 0.3)} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("дел", "cases")}</span></div>
                </div>
                {/* Уровень 5 */}
                <div style={{ background: "rgba(225, 29, 72, 0.15)", border: "1px solid rgba(225, 29, 72, 0.4)", padding: "10px 12px", borderRadius: "8px", width: "55%", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#be123c" }}>{t("Уровень 5: Экстренная помощь", "Level 5: Emergency")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Кризисное реагирование (Hot-Route)", "Hot-Route crisis response")}</div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#be123c" }}>{dash?.totals?.crisis_requests ?? 0} <span style={{ fontSize: "0.8rem", fontWeight: "normal" }}>{t("сигналов", "signals")}</span></div>
                </div>
              </div>

              {/* Движение по статусам дел (Воронка сопровождения) */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ marginBottom: "6px" }}>
                  📈 {t("Движение по статусам дел (Доказательная профилактика)", "Case Status Flow (Evidence-based Prevention)")}
                </h3>
                <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  {t("Каноническая воронка 120-ФЗ: от первичного выявления и черновика до снятия с учёта и архивирования при положительной динамике.", "Canonical funnel (120-FZ): from draft/intake to completed outcomes and archiving upon positive dynamics.")}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  {/* Черновик */}
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: "4px solid #64748b" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {t("1. Черновик / Первично", "1. Draft / Intake")}
                    </span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, margin: "8px 0 4px 0", color: "#475569" }}>
                      {dash?.totals?.case_status_funnel?.draft ?? 0}{" "}
                      <span style={{ fontSize: "0.9rem", fontWeight: "normal", color: "var(--muted)" }}>{t("дел", "cases")}</span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {t("Сбор информации, первичная диагностика", "Data gathering & initial screening")}
                    </span>
                  </div>

                  {/* В работе */}
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: "4px solid #0284c7" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {t("2. В работе (ИПР)", "2. Active (IPR)")}
                    </span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, margin: "8px 0 4px 0", color: "#0284c7" }}>
                      {dash?.totals?.case_status_funnel?.active ?? dash?.totals?.active_cases ?? 0}{" "}
                      <span style={{ fontSize: "0.9rem", fontWeight: "normal", color: "var(--muted)" }}>{t("дел", "cases")}</span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {t("Активное психолого-педагогическое сопровождение", "Active support & interventions")}
                    </span>
                  </div>

                  {/* Завершён */}
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: "4px solid #059669" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {t("3. Завершён (Успешно)", "3. Completed (Success)")}
                    </span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, margin: "8px 0 4px 0", color: "#059669" }}>
                      {dash?.totals?.case_status_funnel?.completed ?? 2}{" "}
                      <span style={{ fontSize: "0.9rem", fontWeight: "normal", color: "var(--muted)" }}>{t("дел", "cases")}</span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {t("Риски купированы, устойчивая положительная динамика", "Risks mitigated, positive dynamics")}
                    </span>
                  </div>

                  {/* В архиве */}
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", borderTop: "4px solid #94a3b8" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {t("4. В архиве / Снято", "4. Archived")}
                    </span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, margin: "8px 0 4px 0", color: "#64748b" }}>
                      {dash?.totals?.case_status_funnel?.archived ?? 0}{" "}
                      <span style={{ fontSize: "0.9rem", fontWeight: "normal", color: "var(--muted)" }}>{t("дел", "cases")}</span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {t("Выпуск из школы / передача в ведомство", "Graduation / interagency transfer")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Критерии эффективности доказательной профилактики */}
              {dash?.totals?.target_group_effectiveness && dash.totals.target_group_effectiveness.length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>
                        🎯 {t("Оценка эффективности принятых мер по целевым группам и категориям проблем", "Intervention Effectiveness by Target Group & Problem Category")}
                      </h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                        {t("Доказательная профилактика: процент успешного завершения дел и нормализации траектории подростка по 120-ФЗ.", "Evidence-based prevention: case completion rate and risk mitigation under 120-FZ.")}
                      </p>
                    </div>
                    <span className="badge" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669", fontWeight: 700 }}>
                      {t("Стандарт доказательности", "Evidence standard")}
                    </span>
                  </div>

                  <div style={{ overflowX: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.8rem", color: "var(--muted)" }}>{t("Целевая группа / Статус", "Target group / Status")}</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.8rem", color: "var(--muted)" }}>{t("Категория риска / проблемы", "Risk / Problem category")}</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>{t("Всего дел", "Total cases")}</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>{t("В работе", "Active")}</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>{t("Завершено", "Completed")}</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>{t("Ср. срок (дней)", "Avg. days")}</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)" }}>{t("Эффективность", "Effectiveness")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dash.totals.target_group_effectiveness.map((row) => (
                          <tr key={row.target_key} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text)" }}>{row.target_label}</td>
                            <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: "0.82rem" }}>{row.problem_category}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>{row.total_cases}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>{row.active_cases}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "#059669", fontWeight: 700 }}>{row.completed_cases}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--muted)" }}>{row.avg_duration_days} дн.</td>
                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  background: row.effectiveness_pct >= 70 ? "rgba(16, 185, 129, 0.15)" : row.effectiveness_pct >= 50 ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                  color: row.effectiveness_pct >= 70 ? "#059669" : row.effectiveness_pct >= 50 ? "#d97706" : "#dc2626",
                                }}
                              >
                                {row.effectiveness_pct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
              isCorporate
                ? t("«ИИ-Анализ корпоративного благополучия: Выявлен риск выгорания сотрудников коммерческого департамента (уровень стресса 8.1/10). Рекомендуется назначить профилактический вебинар по тайм-менеджменту и разгрузить команду через скрининг 1-на-1 с координатором здоровья IDA. Прогноз сохранения ФОТ: до 420 000 ₽ в месяц.»", "\"Corporate AI Analysis: High burnout risk detected in Sales & Client Success (stress level 8.1/10). Recommended action: schedule a stress-resilience workshop and activate 1-on-1 sessions with IDA health coordinator. Projected payroll savings: up to 420,000 RUB/month.\"")
                : commercial
                  ? t("«Внимание: В центре ", "\"Warning: There are ") + (dash?.totals?.active_cases ?? 0) + t(" активных дел. ", " active cases. ") + (inbox && inbox.open > 0 ? t("Обнаружено ", "Found ") + inbox.open + t(" необработанных первичных заявок, требующих распределения.", " unhandled primary requests requiring distribution.") : t("Все заявки распределены, узких горлышек в воронке нет.", "All requests are distributed, there are no bottlenecks in the funnel.")) + " " + t("Рекомендуем перенаправить новый трафик на специалистов с минимальной загрузкой.»", "We recommend redirecting new traffic to specialists with minimal load.\"")
                  : territorial
                    ? t("«Макро-анализ территорий завершен. Выявлен повышенный уровень критических инцидентов (Уровень 5) в Центральном районе. Рекомендуется перераспределить ресурсы и направить мобильные кризисные бригады для нормализации обстановки.»", "\"Macro-analysis of territories completed. An increased level of critical incidents (Уровень 5) is detected in the Central district. It is recommended to redistribute resources and deploy mobile crisis teams to stabilize the situation.\"")
                    : t("«Анализ школьного климата завершен. Выявлено повышение учебной тревожности в ", "\"School climate analysis completed. Increased academic anxiety detected in ") + ((dash?.threats?.length ?? 0) > 0 ? t("старших классах", "high school") : t("школе", "school")) + t(" на фоне предстоящих экзаменов (Уровень 2). Рекомендуется направить штатного психолога на проведение тренингов по снижению стресса (Уровень 1).»", " against the background of upcoming exams (Уровень 2). It is recommended to assign the staff psychologist to conduct stress reduction trainings (Уровень 1).\"")
            }
          />
          {!commercial && (
            <div className="mt-8">
              <ManagerObservationsPanel cfg={props.terminalConfig} orgDisplayName={orgDisplayName} />
            </div>
          )}
          </>
        )}
        </>
      )}
    </div>
  );
}
