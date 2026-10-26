import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n.ts";

import {
  approveFederationLink,
  fetchManagerRollup,
  fetchPendingFederationLinks,
  type ManagerRollup,
  type PendingLinkRow,
  type RollupTerritorySlice,
} from "../lib/federation_client.ts";

interface DashboardRollupPanelProps {
  terminalUserId: string;
  territorial?: boolean;
  commercial?: boolean;
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function IconUsers() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  color: string;
  icon: JSX.Element;
  suppressed?: boolean;
}

function KpiCard({ label, value, sublabel, color, icon, suppressed }: KpiCardProps) {
  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: "14px",
      padding: "15px 18px",
      border: "1px solid var(--line)",
      borderTop: `3px solid ${color}`,
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", color }}>
        {icon}
        <span style={{
          fontSize: "0.67rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--muted)",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: suppressed ? "1rem" : "1.85rem",
        fontWeight: 800,
        color: suppressed ? "var(--muted)" : "var(--text)",
        lineHeight: 1.1,
      }}>
        {suppressed ? "—" : value}
      </div>
      {sublabel && (
        <div style={{ fontSize: "0.71rem", color: "var(--muted)", lineHeight: 1.4 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── Risk badge helper ─────────────────────────────────────────────────────────

function territoryRiskLevel(metrics: Record<string, number | string>): { label: string; bg: string; color: string } {
  const cases = Number(metrics.active_cases ?? 0);
  const cons = Number(metrics.consultation_count ?? 1);
  const ratio = cases / Math.max(cons, 1);
  if (ratio > 0.3 || cases > 20) return { label: t("Высокий", "High"),   bg: "#fee2e2", color: "#991b1b" };
  if (ratio > 0.12 || cases > 6)  return { label: t("Средний", "Medium"), bg: "#fef3c7", color: "#92400e" };
  return                                  { label: t("Низкий", "Low"),    bg: "#d1fae5", color: "#065f46" };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardRollupPanel(props: DashboardRollupPanelProps) {
  const { terminalUserId, territorial, commercial = false } = props;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollup, setRollup] = useState<ManagerRollup | null>(null);
  const [pending, setPending] = useState<PendingLinkRow[]>([]);
  const [territoryKey, setTerritoryKey] = useState<string>("all");
  const [approving, setApproving] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([
      fetchManagerRollup(terminalUserId),
      territorial ? fetchPendingFederationLinks(terminalUserId).catch(() => []) : Promise.resolve([]),
    ])
      .then(([rollupData, pendingRows]) => {
        setRollup(rollupData);
        setPending(pendingRows);
        setError(null);
      })
      .catch((err) => {
        setError(String(err));
        setRollup(null);
      })
      .finally(() => setLoading(false));
  }, [terminalUserId, territorial]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeSlice: RollupTerritorySlice | ManagerRollup | null = useMemo(() => {
    if (!rollup) return null;
    if (territoryKey === "all" || !rollup.territories?.length) return rollup;
    return rollup.territories.find((ter) => ter.key === territoryKey) ?? rollup;
  }, [rollup, territoryKey]);

  const handleApprove = async (childTerminalUserId: string) => {
    setApproving(childTerminalUserId);
    try {
      await approveFederationLink(terminalUserId, childTerminalUserId);
      await reload();
    } catch (err) {
      setError(String(err));
    } finally {
      setApproving(null);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <p className="muted">
        {commercial && territorial
          ? t("Загружаем сводку по филиалам…", "Loading branch rollup...")
          : commercial
            ? t("Загружаем сводку по команде…", "Loading team rollup...")
            : t("Загружаем сводку по сети…", "Loading network rollup...")}
      </p>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    const isNodeNotFound = error.includes("node_not_found");
    if (commercial && isNodeNotFound) {
      return (
        <div className="rollup-panel">
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "var(--text)" }}>
                {t("Ожидание подключения команды", "Waiting for team connection")}
              </h4>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                {t("Раздайте invite-код PARENT вашим специалистам. Как только они подключатся, здесь появится агрегированная картина загрузки.", "Distribute the PARENT invite code to your specialists. Once they connect, an aggregated load picture will appear here.")}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: 0.7 }}>
              {[
                { name: t("Психолог Ольга С.", "Psychologist Olga S."), pct: 80, color: "#ef4444", hint: t("Перегрузка, пора повышать чек", "Overload, time to raise the rate") },
                { name: t("Психолог Иван П.", "Psychologist Ivan P."), pct: 30, color: "#2dd4bf", hint: t("Есть свободные слоты для ИИ-маршрутизации (КПТ, Семейная)", "There are free slots for AI routing (CBT, Family)") },
              ].map((spec) => (
                <div key={spec.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.85rem" }}>
                    <strong>{spec.name}</strong>
                    <span style={{ color: spec.color, fontWeight: "bold" }}>{spec.pct}%</span>
                  </div>
                  <div style={{ background: "var(--line)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${spec.pct}%`, background: spec.color, height: "100%" }} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>{spec.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rollup-panel">
        <p className="muted">
          {commercial
            ? territorial
              ? t("Сводка недоступна (", "Rollup unavailable (") + error + t("). Подключите филиалы по CHILD-… от директоров центров.", "). Connect branches via CHILD-... from center directors.")
              : t("Сводка недоступна (", "Rollup unavailable (") + error + t("). Подключите рабочие места психологов по invite-коду PARENT.", "). Connect psychologist workplaces via PARENT invite code.")
            : t("Сводка недоступна (", "Rollup unavailable (") + error + t("). Подключите рабочие места специалистов по invite-коду PARENT — тогда здесь появятся агрегаты без ФИО.", "). Connect specialist workplaces via PARENT invite code.")}
        </p>
      </div>
    );
  }

  if (!activeSlice) return null;

  // ── Data derivation ───────────────────────────────────────────────────────

  const hours = Math.round(Number(activeSlice.metrics.work_minutes ?? 0) / 60);

  const kpis: KpiCardProps[] = [
    {
      label: commercial && territorial ? t("Филиалов", "Branches") : t("Специалистов", "Specialists"),
      value: activeSlice.contributing_nodes,
      color: "#3b82f6",
      icon: <IconUsers />,
    },
    {
      label: t("Консультации", "Consultations"),
      value: Number(activeSlice.metrics.consultation_count ?? 0).toLocaleString("ru-RU"),
      sublabel: t("за период", "in period"),
      color: "#10b981",
      icon: <IconChat />,
      suppressed: activeSlice.suppressed,
    },
    {
      label: t("Активных дел", "Active cases"),
      value: Number(activeSlice.metrics.active_cases ?? 0),
      color: "#f59e0b",
      icon: <IconFolder />,
      suppressed: activeSlice.suppressed,
    },
    {
      label: t("Часов работы", "Work hours"),
      value: hours > 0 ? hours : "—",
      sublabel: hours > 0 ? t("ч / период", "hrs / period") : undefined,
      color: "#8b5cf6",
      icon: <IconClock />,
      suppressed: activeSlice.suppressed,
    },
    {
      label: t("ИПР", "IEPs"),
      value: Number(activeSlice.metrics.ipr_count ?? 0),
      color: "#06b6d4",
      icon: <IconDoc />,
      suppressed: activeSlice.suppressed,
    },
    {
      label: t("Групп. занятия", "Group sessions"),
      value: Number(activeSlice.metrics.group_session_count ?? 0),
      color: "#ec4899",
      icon: <IconGrid />,
      suppressed: activeSlice.suppressed,
    },
  ];

  const adherencePct = Math.min(100, Number(activeSlice.metrics.adherence_score_avg ?? 0));
  const showAdherence = !activeSlice.suppressed && adherencePct > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rollup-panel">
      <p className="muted tiny manager-rollup-intro">
        {commercial
          ? territorial
            ? t("Сетевая панель HQ: сравнение филиалов по обезличенным счётчикам.", "HQ network panel: branch comparison by anonymized counters.")
            : t("Панель директора центра: нагрузка подключённых психологов без персональных данных клиентов.", "Center director panel: workload of connected psychologists without client data.")
          : t("Дашборд руководителя: агрегированная картина по подключённым специалистам с автоматической защитой данных.", "Manager dashboard: aggregated data from connected specialists with automatic privacy protection.")}
      </p>

      {/* Pending federation links */}
      {territorial && pending.length > 0 && (
        <section className="rollup-pending">
          <h3>{commercial ? t("Филиалы ожидают подтверждения", "Branches awaiting confirmation") : t("Ожидают подтверждения", "Awaiting confirmation")}</h3>
          <ul className="rollup-pending-list">
            {pending.map((row) => (
              <li key={row.child_terminal_user_id}>
                <div>
                  <strong>{row.organization_name || (commercial ? t("Филиал", "Branch") : t("Организация", "Organization"))}</strong>
                  <span className="muted tiny">{[row.settlement, row.region].filter(Boolean).join(", ")}</span>
                </div>
                <button
                  type="button"
                  disabled={approving === row.child_terminal_user_id}
                  onClick={() => void handleApprove(row.child_terminal_user_id)}
                >
                  {approving === row.child_terminal_user_id ? "…" : t("Подтвердить", "Confirm")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Territory / branch filter */}
      {rollup?.territories && rollup.territories.length > 1 && (
        <label className="field rollup-territory-filter">
          <span>{commercial ? t("Филиал", "Branch") : t("Территория", "Territory")}</span>
          <select value={territoryKey} onChange={(e) => setTerritoryKey(e.target.value)}>
            <option value="all">
              {commercial
                ? t("Все филиалы (", "All branches (") + rollup.territories.length + ")"
                : t("Все подключённые (", "All connected (") + rollup.territories.length + ")"}
            </option>
            {rollup.territories.map((ter) => (
              <option key={ter.key} value={ter.key}>{ter.label} ({ter.nodes})</option>
            ))}
          </select>
        </label>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(136px, 1fr))",
        gap: "10px",
        marginBottom: "4px",
      }}>
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {activeSlice.suppressed && (
        <p className="muted tiny" style={{ marginTop: "8px" }}>
          ⚠ {t("Часть метрик скрыта: мало подключённых специалистов для безопасной публикации агрегатов.", "Some metrics hidden: too few connected specialists for safe aggregate publication.")}
        </p>
      )}

      {/* ── Territory / branch table with risk badges ──────────────────── */}
      {rollup?.territories && rollup.territories.length > 0 && (
        <section className="dashboard-section" style={{ marginTop: "24px" }}>
          <h3 style={{ marginBottom: "12px" }}>
            {commercial ? t("Сеть филиалов", "Branch network") : t("Подключённые организации", "Connected organizations")}
          </h3>
          <div className="manager-prevention-table-wrap">
            <table className="manager-prevention-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>{commercial ? t("Филиал", "Branch") : t("Организация / Территория", "Organization / Territory")}</th>
                  <th style={{ textAlign: "center" }}>{t("Специал.", "Spec.")}</th>
                  <th style={{ textAlign: "center" }}>{t("Консульт.", "Consults")}</th>
                  <th style={{ textAlign: "center" }}>{t("Активных дел", "Active cases")}</th>
                  <th style={{ textAlign: "center" }}>{t("Уровень нагрузки", "Load level")}</th>
                </tr>
              </thead>
              <tbody>
                {rollup.territories.map((ter) => {
                  const risk = territoryRiskLevel(ter.metrics as Record<string, number | string>);
                  return (
                    <tr key={ter.key}>
                      <td>
                        <button type="button" className="linkish" onClick={() => setTerritoryKey(ter.key)}>
                          {ter.label}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>{ter.contributing_nodes}</td>
                      <td style={{ textAlign: "center" }}>{ter.suppressed ? "—" : (Number(ter.metrics.consultation_count ?? 0) || "—")}</td>
                      <td style={{ textAlign: "center" }}>{ter.suppressed ? "—" : (Number(ter.metrics.active_cases ?? 0) || "—")}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: "20px",
                          fontSize: "0.71rem",
                          fontWeight: 700,
                          background: ter.suppressed ? "var(--surface-soft)" : risk.bg,
                          color: ter.suppressed ? "var(--muted)" : risk.color,
                        }}>
                          {ter.suppressed ? "—" : risk.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Protocol adherence ────────────────────────────────────────────── */}
      {showAdherence && (
        <section className="dashboard-section" style={{ marginTop: "22px" }}>
          <h3 style={{ marginBottom: "10px" }}>{t("Качество и протоколы", "Quality & protocols")}</h3>
          <div style={{
            background: "var(--surface)",
            borderRadius: "12px",
            padding: "14px 16px",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t("Соответствие протоколам", "Protocol adherence")}
              </div>
              <div style={{ background: "var(--line)", height: "7px", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{
                  width: `${adherencePct}%`,
                  height: "100%",
                  background: adherencePct >= 75 ? "#10b981" : adherencePct >= 50 ? "#f59e0b" : "#ef4444",
                  borderRadius: "4px",
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", minWidth: "52px", textAlign: "right" }}>
              {Math.round(adherencePct)}%
            </div>
          </div>
        </section>
      )}

      {/* ── Skill gaps ────────────────────────────────────────────────────── */}
      {Array.isArray(activeSlice.metrics.top_learning_opportunities) && (activeSlice.metrics.top_learning_opportunities as string[]).length > 0 && (
        <section className="dashboard-section" style={{ marginTop: "22px" }}>
          <h3 style={{ marginBottom: "10px" }}>{t("Дефициты навыков (Top 5)", "Skill Gaps (Top 5)")}</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "5px" }}>
            {(activeSlice.metrics.top_learning_opportunities as string[]).map((gap: string) => (
              <li key={gap} style={{
                padding: "7px 12px",
                background: "var(--surface)",
                borderRadius: "8px",
                fontSize: "0.84rem",
                color: "var(--text)",
                border: "1px solid var(--line)",
                borderLeft: "3px solid #8b5cf6",
              }}>
                {gap}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
