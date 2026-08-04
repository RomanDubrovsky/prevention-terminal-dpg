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
import { ROLLUP_METRIC_GROUPS, rollupMetricLabel } from "../lib/dashboard_labels.ts";

interface DashboardRollupPanelProps {
  terminalUserId: string;
  territorial?: boolean;
  commercial?: boolean;
}

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
    return rollup.territories.find((t) => t.key === territoryKey) ?? rollup;
  }, [rollup, territoryKey]);

  const metricGroups = useMemo(() => {
    if (!commercial) return ROLLUP_METRIC_GROUPS;
    return ROLLUP_METRIC_GROUPS.map((group) => {
      if (group.title.includes("Универсальная")) {
        return { ...group, title: t("Операционная нагрузка (Приемы)", "Operational load (Consultations)") };
      }
      if (group.title.includes("Селективная")) {
        return { ...group, title: t("Воронка и новые клиенты", "Funnel and new clients") };
      }
      if (group.title.includes("Индикативная")) {
        return { ...group, title: t("Активное сопровождение (Кейсы)", "Active support (Cases)") };
      }
      return group;
    });
  }, [commercial]);

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
  if (error) {
    const isNodeNotFound = error.includes("node_not_found");
    if (commercial && isNodeNotFound) {
      return (
        <div className="rollup-panel">
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "var(--text)" }}>
                {t("Ожидание подключения команды", "Waiting for team connection")}
              </h4>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                {t("Раздайте invite-код PARENT вашим специалистам. Как только они подключатся, здесь появится агрегированная картина загрузки.", "Distribute the PARENT invite code to your specialists. Once they connect, an aggregated load picture will appear here.")}
              </p>
            </div>
            
            {/* Демо-сетка загрузки */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: 0.7 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.85rem" }}>
                  <strong>{t("Психолог Ольга С.", "Psychologist Olga S.")}</strong>
                  <span style={{ color: "#ef4444", fontWeight: "bold" }}>80%</span>
                </div>
                <div style={{ background: "var(--line)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: "80%", background: "#ef4444", height: "100%" }}></div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>
                  {t("Перегрузка, пора повышать чек", "Overload, time to raise the rate")}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.85rem" }}>
                  <strong>{t("Психолог Иван П.", "Psychologist Ivan P.")}</strong>
                  <span style={{ color: "#2dd4bf", fontWeight: "bold" }}>30%</span>
                </div>
                <div style={{ background: "var(--line)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: "30%", background: "#2dd4bf", height: "100%" }}></div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>
                  {t("Есть свободные слоты для ИИ-маршрутизации (КПТ, Семейная)", "There are free slots for AI routing (CBT, Family)")}
                </div>
              </div>
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
              ? t("Сводка недоступна (", "Rollup unavailable (") +
                error +
                t("). Подключите филиалы по CHILD-… от директоров центров — здесь появятся агрегаты без ФИО клиентов.", "). Connect branches via CHILD-... from center directors — aggregates without client names will appear here.")
              : t("Сводка недоступна (", "Rollup unavailable (") +
                error +
                t("). Подключите рабочих мест психологов по invite-коду PARENT — тогда здесь появятся агрегаты без ФИО.", "). Connect psychologist workplaces via PARENT invite code — aggregates without names will appear here.")
            : t("Сводка недоступна (", "Rollup unavailable (") +
              error +
              t("). Подключите рабочие места специалистов по invite-коду PARENT — тогда здесь появятся агрегаты без ФИО.", "). Connect specialist workplaces via PARENT invite code — aggregates without names will appear here.")}
        </p>
      </div>
    );
  }
  if (!activeSlice) return null;

  const metricEntries = Object.entries(activeSlice.metrics);
  const unitLabel = commercial && territorial ? t("филиалов", "branches") : t("узлов", "nodes");

  return (
    <div className="rollup-panel">
      <p className="muted tiny manager-rollup-intro">
        {commercial
          ? territorial
            ? t("Сетевая панель HQ: сравнение филиалов по обезличенным счётчикам. Drill-down — только до агрегатов филиала, не до карточек клиентов.", "HQ network panel: comparison of branches by anonymized counters. Drill-down only to branch aggregates, not to client cards.")
            : t("Панель директора центра: нагрузка подключённых психологов без персональных данных клиентов (k-anonymity).", "Center director panel: load of connected psychologists without client personal data (k-anonymity).")
          : t("Дашборд руководителя: агрегированная картина по подключённым психологам и организациям. Это не формат DAP/SOAP — это управленческая сводка (нагрузка, кейсы, ИПР) с k-anonymity.", "Manager dashboard: aggregated picture of connected psychologists and organizations. This is not DAP/SOAP format — it's a management rollup (load, cases, IDP) with k-anonymity.")}
      </p>

      {territorial && pending.length > 0 && (
        <section className="rollup-pending">
          <h3>{commercial ? t("Филиалы ожидают подтверждения", "Branches awaiting confirmation") : t("Ожидают подтверждения", "Awaiting confirmation")}</h3>
          <ul className="rollup-pending-list">
            {pending.map((row) => (
              <li key={row.child_terminal_user_id}>
                <div>
                  <strong>
                    {row.organization_name || (commercial ? t("Филиал", "Branch") : t("Организация", "Organization"))}
                  </strong>
                  <span className="muted tiny">
                    {[row.settlement, row.region].filter(Boolean).join(", ")}
                  </span>
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

      {rollup?.territories && rollup.territories.length > 1 && (
        <label className="field rollup-territory-filter">
          <span>{commercial ? t("Филиал", "Branch") : t("Территория", "Territory")}</span>
          <select value={territoryKey} onChange={(e) => setTerritoryKey(e.target.value)}>
            <option value="all">
              {commercial
                ? t("Все филиалы (", "All branches (") + rollup.territories.length + ")"
                : t("Все подключённые (", "All connected (") + rollup.territories.length + ")"}
            </option>
            {rollup.territories.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} ({t.nodes})
              </option>
            ))}
          </select>
        </label>
      )}

      {commercial && territorial && rollup?.territories && rollup.territories.length > 0 && (
        <section className="dashboard-section">
          <h3>{t("Филиалы", "Branches")}</h3>
          <p className="muted tiny">{t("Краткое сравнение узлов сети. Выберите филиал выше, чтобы увидеть детальные метрики.", "Brief comparison of network nodes. Select a branch above to see detailed metrics.")}</p>
          <div className="manager-prevention-table-wrap">
            <table className="manager-prevention-table">
              <thead>
                <tr>
                  <th>{t("Филиал", "Branch")}</th>
                  <th>{t("Узлы", "Nodes")}</th>
                  <th>{t("Консультации", "Consultations")}</th>
                  <th>{t("Активные кейсы", "Active cases")}</th>
                  <th>{t("Минуты", "Minutes")}</th>
                </tr>
              </thead>
              <tbody>
                {rollup.territories.map((t) => (
                  <tr key={t.key}>
                    <td>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => setTerritoryKey(t.key)}
                      >
                        {t.label}
                      </button>
                    </td>
                    <td>{t.nodes}</td>
                    <td>{t.metrics.consultation_count ?? "—"}</td>
                    <td>{t.metrics.active_cases ?? "—"}</td>
                    <td>{t.metrics.work_minutes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="dashboard-section rollup-network">
        <h3>{commercial && territorial ? t("Сеть филиалов", "Network of branches") : t("Сеть и конфиденциальность", "Network and confidentiality")}</h3>
        <dl className="rollup-grid">
          <div>
            <dt>{commercial && territorial ? t("Подключено филиалов", "Connected branches") : t("Подключено узлов", "Connected nodes")}</dt>
            <dd>{activeSlice.contributing_nodes}</dd>
          </div>
          <div>
            <dt>k-anonymity</dt>
              <dd>{activeSlice.suppressed ? "< " + activeSlice.k_floor : "OK"}</dd>
          </div>
        </dl>
        {activeSlice.suppressed && (
          <p className="muted tiny">
            {t("Часть метрик скрыта: мало подключённых ", "Some metrics are hidden: few connected ")}{unitLabel}{t(" для безопасной публикации агрегатов.", " for safe publication of aggregates.")}
          </p>
        )}
      </section>

      {metricGroups.map((group) => {
        const rows = group.keys
          .map((key) => [key, activeSlice.metrics[key]] as const)
          .filter(([, val]) => val !== undefined && val !== null);
        if (rows.length === 0) return null;
        return (
          <section key={group.title} className="dashboard-section">
            <h3>{group.title}</h3>
            <dl className="rollup-grid">
              {rows.map(([key, val]) => (
                <div key={key}>
                  <dt>{rollupMetricLabel(key)}</dt>
                  <dd>{String(val)}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      {metricEntries.filter(([key]) => !metricGroups.some((g) => g.keys.includes(key))).length > 0 && (
        <section className="dashboard-section">
          <h3>{t("Прочие показатели", "Other metrics")}</h3>
          <dl className="rollup-grid">
            {metricEntries
              .filter(([key]) => !metricGroups.some((g) => g.keys.includes(key)))
              .map(([key, val]) => (
                <div key={key}>
                  <dt>{rollupMetricLabel(key)}</dt>
                  <dd>{String(val)}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
    </div>
  );
}
