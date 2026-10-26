import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/i18n.ts";

import AiSubscriptionIndicator from "./AiSubscriptionIndicator.tsx";
import SpecialistPracticeFunnel from "./SpecialistPracticeFunnel.tsx";
import { isCommercialOrg } from "../lib/case_meta.ts";
import {
  DASHBOARD_PERIOD_OPTIONS,
  type DashboardPeriod,
} from "../lib/dashboard_period.ts";
import {
  loadSpecialistDashboardBundle,
  type SpecialistDashboardBundle,
} from "../lib/specialist_dashboard_bundle.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";

interface SpecialistDashboardProps {
  cfg: TerminalConfig;
  deepLinkMsg: string | null;
  onNavigate?: (view: SpecialistWorkspaceView) => void;
}

export default function SpecialistDashboard(props: SpecialistDashboardProps) {
  const { cfg, deepLinkMsg, onNavigate } = props;
  const commercial = isCommercialOrg(cfg);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [bundle, setBundle] = useState<SpecialistDashboardBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return loadSpecialistDashboardBundle({ period, commercial })
      .then((data) => {
        setBundle(data);
        setError(null);
      })
      .catch((err) => {
        setError(String(err));
        setBundle(null);
      })
      .finally(() => setLoading(false));
  }, [commercial, period]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="workspace-panel-stack specialist-dashboard">
      <section className="card workspace-panel">
        <header className="manager-dashboard-header">
          <div>
            <h2>{t("Дашборд специалиста", "Specialist Dashboard")}</h2>
            <p className="muted">
              {bundle
                ? `${bundle.header.specialistName} \u00b7 ${bundle.header.orgName}`
                : t("Операционная сводка по показателям терминала.", "Operational summary of terminal metrics.")}
            </p>
          </div>
          <div className="specialist-dashboard-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <AiSubscriptionIndicator terminalUserId={cfg.terminal_user_id} orgType={cfg.org_type} />
          </div>
        </header>
        <div className="dashboard-period-toggle" role="group" aria-label={t("Период", "Period")}>
          {DASHBOARD_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`dashboard-period-btn${period === opt.id ? " active" : ""}`}
              onClick={() => setPeriod(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {deepLinkMsg && <p className="muted">{deepLinkMsg}</p>}
      </section>

      {loading && (
        <section className="card">
          <p className="muted">{t("Загружаем сводку…", "Loading summary...")}</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="error">{t("Не удалось загрузить дашборд: ", "Failed to load dashboard: ")}{error}</p>
        </section>
      )}

      {bundle && !loading && (
        <>
          {bundle.funnel && bundle.commercial && (
            <SpecialistPracticeFunnel
              funnel={bundle.funnel}
              periodLabel={bundle.periodLabel}
              onNavigate={onNavigate}
            />
          )}

          <section className="card dashboard-section">
            <h3>{t("Сводка", "Dashboard")}</h3>
            <p className="muted tiny">
              {t("Локальные счётчики ", "Local counters ")}
              {bundle.periodLabel}
              {t(". Нажмите плитку, чтобы перейти в раздел.", ". Click a tile to navigate to the section.")}
            </p>
            <div className="dashboard-metric-grid">
              {bundle.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="dashboard-metric-tile"
                  disabled={!tile.nav || !onNavigate}
                  onClick={() => tile.nav && onNavigate?.(tile.nav)}
                >
                  <span className="dashboard-metric-label">{tile.label}</span>
                  <strong className="dashboard-metric-value">{tile.value}</strong>
                  {tile.hint ? <span className="muted tiny">{tile.hint}</span> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="card dashboard-section">
            <h3>{t("Требует внимания", "Requires attention")}</h3>
            {bundle.attention.length === 0 ? (
              <p className="muted tiny">{t("Нет сигналов за выбранный период. Все в зеленой зоне.", "No signals for the selected period. All in the green zone.")}</p>
            ) : (
              <ul className="dashboard-attention-list">
                {bundle.attention.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="dashboard-attention-item"
                      disabled={!item.nav || !onNavigate}
                      onClick={() => item.nav && onNavigate?.(item.nav)}
                      style={{ borderLeft: "4px solid var(--red)", paddingLeft: "12px", background: "rgba(239, 68, 68, 0.05)" }}
                    >
                      <strong style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: "6px" }}>
                        🔴 {item.title}
                      </strong>
                      <span className="muted tiny">{item.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {bundle.commercial ? (
            <details className="card dashboard-section dashboard-secondary">
              <summary>
                {t("Направления работы", "Work directions")}
              </summary>
              <p className="muted tiny">
                {t("Распределение активности по ключевым направлениям ", "Distribution of activity by key directions ")}
                {bundle.periodLabel}.
              </p>
              <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: "12px" }}>
                <div>
                  <h4 style={{ color: 'var(--green)' }}>{t("Базовая работа", "General Work")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Приемы и скрининги", "Consultations and screenings")}</p>
                  {bundle.preventionTiers.universal.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.universal.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--yellow)' }}>{t("Групповая работа", "Group Work")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Группы и риск-зоны", "Groups and risk zones")}</p>
                  {bundle.preventionTiers.selective.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.selective.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--red)' }}>{t("Интенсив и Кризис", "Intensive and Crisis")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Сложные кейсы", "Complex cases")}</p>
                  {bundle.preventionTiers.indicated.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.indicated.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--orange)' }}>{t("Кризисное реагирование", "Secondary")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Мониторинг", "Monitoring")}</p>
                  {bundle.preventionTiers.secondary.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.secondary.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--purple)' }}>{t("Восстановление и адаптация", "Tertiary")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Реабилитация", "Rehabilitation")}</p>
                  {bundle.preventionTiers.tertiary.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.tertiary.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </details>
          ) : (
            <section className="card dashboard-section">
              <h3>{t("Направления профилактической работы", "Prevention Tiers")}</h3>
              <p className="muted tiny">
                {t("Распределение охвата по направлениям профилактической работы ", "Distribution of coverage by prevention tiers ")}
                {bundle.periodLabel}.
              </p>
              <div className="dashboard-dist-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <h4 style={{ color: 'var(--green)' }}>{t("Все учащиеся/подростки", "Universal")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Работа со всеми учащимися", "Prevention for all")}</p>
                  {bundle.preventionTiers.universal.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.universal.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--yellow)' }}>{t("Группы внимания", "Selective")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Групповая поддержка и риск-зоны", "Risk groups")}</p>
                  {bundle.preventionTiers.selective.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.selective.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--red)' }}>{t("Адресная поддержка (ИПР)", "Indicated")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Индивидуальное сопровождение", "Crisis and support")}</p>
                  {bundle.preventionTiers.indicated.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.indicated.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--orange)' }}>{t("Кризисное реагирование", "Secondary")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Экстренная помощь и кейсы", "Risk groups and cases")}</p>
                  {bundle.preventionTiers.secondary.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.secondary.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <h4 style={{ color: 'var(--purple)' }}>{t("Восстановление и адаптация", "Tertiary")}</h4>
                  <p className="muted tiny" style={{ marginBottom: "8px" }}>{t("Социальная реадаптация", "Crisis and rehabilitation")}</p>
                  {bundle.preventionTiers.tertiary.length === 0 ? (
                    <p className="muted tiny">{t("Пока нет данных.", "No data yet.")}</p>
                  ) : (
                    <dl className="rollup-grid">
                      {bundle.preventionTiers.tertiary.map((row) => (
                        <div key={row.key}><dt>{row.label}</dt><dd>{row.count}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </section>
          )}

          <details className="card dashboard-section dashboard-secondary">
            <summary>
              {t("Темы и проблемы", "Themes and problems")}
              {bundle.problems.length > 0 ? ` (${bundle.problems.length})` : ""}
            </summary>
            <p className="muted tiny">
              {t("Локальный подсчёт тегов консультаций и групп ", "Local count of consultation and group tags ")}
              {bundle.periodLabel}
              {t(". Без ФИО.", ". Without names.")}
            </p>
            {bundle.problems.length === 0 ? (
              <p className="muted tiny">
                {t("Пока нет тем за период — отмечайте их в карточках приёма.", "No themes for the period yet — mark them in appointment cards.")}
              </p>
            ) : (
              <dl className="rollup-grid">
                {bundle.problems.map((row) => (
                  <div key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>{row.count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
        </>
      )}

    </div>
  );
}

