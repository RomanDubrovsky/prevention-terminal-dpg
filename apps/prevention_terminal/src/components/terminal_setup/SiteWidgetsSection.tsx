import { useCallback, useEffect, useMemo, useState } from "react";

import { buildLocalIdaWidgets, fetchIdaWidgets, type IdaSiteWidgets } from "../../lib/ai_workspace.ts";
import { downloadCenterLeadsExport } from "../../lib/center_leads_export.ts";
import { fetchInboxStatus } from "../../lib/inbox_client.ts";
import { isLocalLeadSink } from "../../lib/site_embed_public.ts";
import {
  buildSitePageUrls,
  consultBookingUrlFromPlan,
  CRM_INTEGRATION_HOW_TO,
  normalizeExternalBookingUrl,
  normalizeSiteOrigin,
  parseSitePagePaths,
  serializeSitePagePaths,
  SITE_INTEGRATION_SCENARIOS,
  type SitePagePaths,
} from "../../lib/site_pages.ts";
import {
  ensureSitePortal,
  effectiveConsultBookingUrl,
  updateSitePortal,
  type SiteBookingMode,
  type SitePortalConfig,
} from "../../lib/site_portal.ts";
import { getTerminalEdition } from "../../lib/terminal_edition.ts";
import { productSiteDefaults } from "../../lib/terminal_product.ts";
import { TextField } from "./terminal_setup_widgets.tsx";

interface SiteWidgetsSectionProps {
  organizationName: string;
  isSchoolLike?: boolean;
  busy?: boolean;
  isSettings?: boolean;
}

function SnippetBlock(props: { title: string; description: string; snippet: string; deployUrl?: string }) {
  const desc = props.deployUrl ? `${props.description} ${props.deployUrl}` : props.description;
  return (
    <div className="site-widget-block">
      <h3 className="site-widget-title">{props.title}</h3>
      <p className="muted tiny">{desc}</p>
      <label className="field">
        <span>HTML-код для вставки</span>
        <textarea readOnly rows={7} value={props.snippet} />
      </label>
      <button type="button" className="linkish" onClick={() => navigator.clipboard.writeText(props.snippet)}>
        Копировать код
      </button>
    </div>
  );
}

export default function SiteWidgetsSection(props: SiteWidgetsSectionProps) {
  const { organizationName, isSchoolLike, busy } = props;
  const [widgets, setWidgets] = useState<IdaSiteWidgets | null>(null);
  const [portal, setPortal] = useState<SitePortalConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [columns, setColumns] = useState(3);
  const [siteOriginDraft, setSiteOriginDraft] = useState("");
  const [pathsDraft, setPathsDraft] = useState<SitePagePaths>(parseSitePagePaths(""));
  const [bookingMode, setBookingMode] = useState<SiteBookingMode>("prevention");
  const [externalBookingUrlDraft, setExternalBookingUrlDraft] = useState("");
  const [leadsExportWebhookDraft, setLeadsExportWebhookDraft] = useState("");
  const [privacyPolicyUrlDraft, setPrivacyPolicyUrlDraft] = useState("");
  const [personalDataAgreementUrlDraft, setPersonalDataAgreementUrlDraft] = useState("");
  const [savingSitePlan, setSavingSitePlan] = useState(false);
  const [exportingCloud, setExportingCloud] = useState(false);

  const isRuEdition = getTerminalEdition() === "ru";

  const orgLabel = organizationName.trim() || "Моя организация";
  const planApplied = Boolean(portal?.public_site_origin && portal?.site_page_paths_json);
  const isCrmIntegration = bookingMode === "external";
  const isFullSolution = bookingMode === "prevention";

  const pageUrls = useMemo(
    () => buildSitePageUrls(siteOriginDraft, pathsDraft),
    [siteOriginDraft, pathsDraft],
  );

  const [networkError, setNetworkError] = useState<string | null>(null);

  const reloadWidgets = useCallback(
    async (portalCfg: SitePortalConfig, viewer?: string | null) => {
      setNetworkError(null);
      const exportHook = String(portalCfg.leads_export_webhook_url || "").trim();
      const leadSink =
        exportHook && !isLocalLeadSink(exportHook) ? exportHook : undefined;
      const paths = parseSitePagePaths(portalCfg.site_page_paths_json);
      try {
        const data = await fetchIdaWidgets({
          organizationName: orgLabel,
          leadSinkUrl: leadSink,
          centerId: portalCfg.center_id,
          setupToken: portalCfg.setup_token,
          iconostasisColumns: portalCfg.iconostasis_columns || 3,
          inboxViewerUrl: viewer || undefined,
          isSchool: Boolean(isSchoolLike),
          consultBookingUrl: effectiveConsultBookingUrl(portalCfg),
          schoolPrivacyMode: paths.school_privacy_mode,
        });
        setWidgets(data);
      } catch (err) {
        console.warn("Failed to fetch widgets:", err);
        const fallbackData = buildLocalIdaWidgets({
          organizationName: orgLabel,
          leadSinkUrl: leadSink,
          centerId: portalCfg.center_id,
          setupToken: portalCfg.setup_token,
          iconostasisColumns: portalCfg.iconostasis_columns || 3,
          inboxViewerUrl: viewer || undefined,
          consultBookingUrl: effectiveConsultBookingUrl(portalCfg),
          isSchool: Boolean(isSchoolLike),
        });
        setWidgets(fallbackData);
      }
    },
    [orgLabel, isSchoolLike, isRuEdition],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxStatus, portalCfg] = await Promise.all([
        fetchInboxStatus().catch(() => null),
        ensureSitePortal(orgLabel),
      ]);
      const viewer = inboxStatus?.inbox_viewer_url || null;
      setViewerUrl(viewer);
      setPortal(portalCfg);
      setColumns(portalCfg.iconostasis_columns || 3);
      const siteDefaults = productSiteDefaults();
      const hasSavedOrigin = Boolean(normalizeSiteOrigin(portalCfg.public_site_origin || ""));
      setSiteOriginDraft(hasSavedOrigin ? portalCfg.public_site_origin || "" : siteDefaults?.origin || "");
      setPathsDraft(
        hasSavedOrigin
          ? parseSitePagePaths(portalCfg.site_page_paths_json)
          : siteDefaults?.paths ?? parseSitePagePaths(portalCfg.site_page_paths_json),
      );
      setBookingMode(portalCfg.booking_mode || "prevention");
      setExternalBookingUrlDraft(
        portalCfg.booking_mode === "external" ? portalCfg.consult_booking_url || "" : "",
      );
      setLeadsExportWebhookDraft(portalCfg.leads_export_webhook_url || "");
      setPrivacyPolicyUrlDraft(portalCfg.privacy_policy_url || "");
      setPersonalDataAgreementUrlDraft(portalCfg.personal_data_agreement_url || "");
      await reloadWidgets(portalCfg, viewer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWidgets(null);
    } finally {
      setLoading(false);
    }
  }, [orgLabel, reloadWidgets]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function onPathChange(key: keyof SitePagePaths, value: string) {
    setPathsDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function onColumnsChange(next: number) {
    const cols = Math.max(1, Math.min(6, next));
    setColumns(cols);
    if (!portal) return;
    try {
      const updated = await updateSitePortal({ iconostasis_columns: cols });
      setPortal(updated);
      await reloadWidgets(updated, viewerUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSaveSitePlan() {
    setSavingSitePlan(true);
    setError(null);
    try {
      const origin = normalizeSiteOrigin(siteOriginDraft);
      if (!origin) {
        throw new Error("Укажите домен сайта центра");
      }
      const pathsJson = serializeSitePagePaths(pathsDraft);
      const consultUrl = consultBookingUrlFromPlan(
        origin,
        pathsDraft,
        bookingMode,
        externalBookingUrlDraft,
      );
      if (bookingMode === "external" && !normalizeExternalBookingUrl(consultUrl)) {
        throw new Error("Вставьте полную ссылку на вашу систему записи (MedFlex, Yclients и т.п.)");
      }
      const updated = await updateSitePortal({
        public_site_origin: origin,
        site_page_paths_json: pathsJson,
        booking_mode: bookingMode,
        consult_booking_url: consultUrl,
        leads_export_webhook_url: leadsExportWebhookDraft.trim(),
        privacy_policy_url: privacyPolicyUrlDraft.trim(),
        personal_data_agreement_url: personalDataAgreementUrlDraft.trim(),
      });
      setPortal(updated);
      setSiteOriginDraft(updated.public_site_origin || "");
      setPathsDraft(parseSitePagePaths(updated.site_page_paths_json));
      setBookingMode(updated.booking_mode);
      setExternalBookingUrlDraft(
        updated.booking_mode === "external" ? updated.consult_booking_url || "" : "",
      );
      setLeadsExportWebhookDraft(updated.leads_export_webhook_url || "");
      setPrivacyPolicyUrlDraft(updated.privacy_policy_url || "");
      setPersonalDataAgreementUrlDraft(updated.personal_data_agreement_url || "");
      await reloadWidgets(updated, viewerUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingSitePlan(false);
    }
  }

  async function onExportCloudLeads() {
    if (!portal?.center_id || !portal.setup_token) {
      setError("Сначала сохраните настройки сайта — нужен идентификатор центра.");
      return;
    }
    setExportingCloud(true);
    setError(null);
    try {
      await downloadCenterLeadsExport(
        portal.center_id,
        portal.setup_token,
        `leads-${portal.center_id}.csv`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg === "no_leads_yet"
          ? "Пока нет заявок в облаке — они появятся после первых обращений через чат на сайте."
          : msg,
      );
    } finally {
      setExportingCloud(false);
    }
  }



  const inlineSnippet = useMemo(() => {
    if (!widgets?.embed_snippet) return "";
    // Return the original embed snippet without forcing inline mode.
    return widgets.embed_snippet;
  }, [widgets?.embed_snippet]);



  return (
    <div className="site-widgets-section">
      <p className="muted tiny">
        Организация: <strong>{orgLabel}</strong>
        {portal?.center_id && (
          <>
            {" "}
            · ID центра: <code>{portal.center_id}</code>
          </>
        )}
        {portal?.setup_token && (
          <>
            {" "}
            · Ключ подключения (Setup Token): <code>{portal.setup_token}</code>
          </>
        )}
      </p>
      {portal?.setup_token && (
        <div style={{ padding: "12px", background: "rgba(124, 58, 237, 0.08)", border: "1px solid rgba(124, 58, 237, 0.15)", borderRadius: "10px", margin: "10px 0 20px 0", fontSize: "0.85rem", lineHeight: "1.4" }}>
          💡 <strong>Подключение других устройств (смартфон, домашний ПК):</strong> Вы можете управлять заявками и анкетами с любого телефона. Для этого откройте терминал на телефоне, введите <strong>ID центра</strong> (<code>{portal.center_id}</code>) и <strong>Ключ подключения</strong> (<code>{portal.setup_token}</code>). Все действия синхронизируются в реальном времени.
        </div>
      )}
      {loading && <p className="muted">Загружаем настройки…</p>}
      {error && <p className="error">{error}</p>}
      {portal && !busy && (
        <div className="site-widgets-stack">
          {/* Блок 1: сценарий */}
          <div className="site-widget-block site-widget-block--scenario">
            <h3 className="site-widget-title">Как вы планируете организовать запись к психологу?</h3>
            <p className="muted tiny">От выбора зависят поля ниже и набор кодов для сайта.</p>
            <div className="ob-choices ob-choices--scenario">
              {(Object.keys(SITE_INTEGRATION_SCENARIOS) as SiteBookingMode[]).map((mode) => {
                const scenario = SITE_INTEGRATION_SCENARIOS[mode];
                return (
                  <label key={mode} className="ob-card ob-card--scenario">
                    <input
                      type="radio"
                      name="siteIntegrationScenario"
                      checked={bookingMode === mode}
                      onChange={() => setBookingMode(mode)}
                      disabled={savingSitePlan}
                    />
                    <strong>{scenario.title}</strong>
                    <span>{scenario.hint}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {isSchoolLike && (
            <div className="site-widget-block site-widget-block--privacy-mode" style={{ marginTop: "16px", padding: "16px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
              <h3 className="site-widget-title" style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>Режим приватности ИИ-помощника</h3>
              <p className="muted tiny" style={{ margin: "0 0 12px" }}>Укажите, как ИИ-приёмная должна идентифицировать учащихся в чате.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="schoolPrivacyMode"
                    value="anonymous"
                    checked={pathsDraft.school_privacy_mode === "anonymous"}
                    onChange={() => setPathsDraft(prev => ({ ...prev, school_privacy_mode: "anonymous" }))}
                    disabled={savingSitePlan}
                  />
                  <div>
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>Полная анонимность</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Подростки общаются инкогнито. ФИО запрашивается только при очной записи. Снижает барьер доверия.</div>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="schoolPrivacyMode"
                    value="hybrid"
                    checked={pathsDraft.school_privacy_mode === "hybrid" || !pathsDraft.school_privacy_mode}
                    onChange={() => setPathsDraft(prev => ({ ...prev, school_privacy_mode: "hybrid" }))}
                    disabled={savingSitePlan}
                  />
                  <div>
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>Гибридный контроль угроз (Рекомендуется)</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Начало диалога анонимно, но при фиксации критических угроз (буллинг/насилие) ИИ затребует ФИО для помощи.</div>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="schoolPrivacyMode"
                    value="authorized"
                    checked={pathsDraft.school_privacy_mode === "authorized"}
                    onChange={() => setPathsDraft(prev => ({ ...prev, school_privacy_mode: "authorized" }))}
                    disabled={savingSitePlan}
                  />
                  <div>
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>Строгая авторизация</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Ввод ФИО и класса до начала диалога. Подходит для контроля обращений, снижает вовлеченность.</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Блок 2: Базовые настройки (Домен) */}
          <div className="site-widget-block site-widget-block--plan">
            <h3 className="site-widget-title">
              Базовые настройки интеграции
            </h3>

            {isCrmIntegration && (
              <div className="site-crm-howto" role="note" style={{ marginBottom: '16px' }}>
                <h4 className="site-widget-subtitle">{CRM_INTEGRATION_HOW_TO.title}</h4>
                <ol className="site-crm-howto__steps">
                  {CRM_INTEGRATION_HOW_TO.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="muted tiny">{CRM_INTEGRATION_HOW_TO.afterApply}</p>
              </div>
            )}

            <TextField
              label="Домен сайта центра"
              value={siteOriginDraft}
              onChange={setSiteOriginDraft}
              placeholder="https://center.ru"
              disabled={savingSitePlan}
              hint="Указание домена необходимо для безопасности (CORS-ограничение, чтобы локальный сервер Терминала на этом компьютере принимал заявки клиентов только с вашего сайта). Сведения никуда не передаются и хранятся локально."
            />

            {error && (
              <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", margin: "16px 0", color: "#ef4444", fontSize: "0.9rem" }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              disabled={savingSitePlan}
              onClick={() => void onSaveSitePlan()}
              style={{ marginTop: "16px", width: "100%", display: "block" }}
            >
              {savingSitePlan ? "Сохраняем…" : "Применить настройки"}
            </button>
          </div>

          {/* Блок 3: Коды и страницы */}
          {!planApplied && (
            <p className="site-plan-notice" role="status">
              Заполните домен выше и нажмите «Применить настройки» — появятся блоки настройки страниц и HTML-коды для вставки.
            </p>
          )}

          {planApplied && !widgets && networkError && (
            <div style={{ padding: "16px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", margin: "16px 0", color: "#ef4444", fontSize: "0.9rem" }}>
              ⚠️ {networkError}
            </div>
          )}

          {planApplied && widgets && (
            <div className="site-widgets-unified" style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "24px" }}>
              
              {/* Widget 1: Chat */}
              <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>💬 1. Чат с клиентом</h3>
                <p className="muted tiny" style={{ marginBottom: "16px" }}>
                  <strong>Назначение:</strong> {isCrmIntegration 
                    ? "ИИ-помощник подогревает клиента и передаёт его на форму записи вашей CRM." 
                    : "Первичный контакт с посетителем сайта. ИИ-помощник собирает запрос и подводит к записи."}
                </p>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "0.9rem", fontWeight: 600 }}>Путь на сайте:</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input 
                      type="text" 
                      value={pathsDraft.chat} 
                      onChange={(e) => onPathChange("chat", e.target.value)} 
                      disabled={savingSitePlan} 
                      style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", width: "200px" }}
                    />
                    <span className="muted tiny">Полный адрес: <code style={{ userSelect: "all" }}>{pageUrls.chat}</code></span>
                  </div>
                  <button type="button" className="linkish tiny" onClick={() => void onSaveSitePlan()} style={{ marginTop: "8px" }}>Сохранить путь</button>
                </div>
                <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-light)" }}>
                  <SnippetBlock
                    title="Код для вставки (Кнопка в углу / Floating FAB)"
                    description="Виджет появится на вашем сайте в правом нижнем углу в виде плавающей иконки чата."
                    snippet={widgets.embed_snippet}
                  />
                  <div style={{ height: "24px", borderBottom: "1px dashed var(--line-light)", marginBottom: "24px" }}></div>
                  <SnippetBlock
                    title="Код для вставки (Встроенный в страницу / Inline iframe)"
                    description="Чат будет встроен прямо внутрь страницы. Создайте пустой контейнер: <div id='ida-chat-container' style='width: 100%; height: 600px;'></div>"
                    snippet={inlineSnippet}
                  />
                </div>
              </div>

              {/* Widget 2: Iconostasis or External CRM */}
              {isFullSolution ? (
                <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                  <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>👥 2. Каталог специалистов и Запись</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    <strong>Назначение:</strong> Публичная витрина команды и календарь для записи клиентов. Кнопка «Записаться» из чата автоматически ведёт на эту страницу.
                  </p>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "0.9rem", fontWeight: 600 }}>Путь на сайте:</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input 
                        type="text" 
                        value={pathsDraft.iconostasis} 
                        onChange={(e) => { onPathChange("iconostasis", e.target.value); onPathChange("consult", e.target.value); }} 
                        disabled={savingSitePlan} 
                        style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", width: "200px" }}
                      />
                      <span className="muted tiny">Полный адрес: <code style={{ userSelect: "all" }}>{pageUrls.iconostasis}</code></span>
                    </div>
                    <button type="button" className="linkish tiny" onClick={() => void onSaveSitePlan()} style={{ marginTop: "8px" }}>Сохранить путь</button>
                  </div>
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-light)" }}>
                    <h4 className="site-widget-subtitle" style={{ fontSize: "1rem", margin: "0 0 4px 0" }}>Код для вставки (Иконостас)</h4>
                    <p className="muted tiny" style={{ marginBottom: "16px" }}>Сетка с фото; по клику — карточка специалиста со встроенной формой записи.</p>
                    <label className="field" style={{ marginBottom: "16px", display: "block" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Колонок в сетке ({columns})</span>
                      <input
                        type="range" min={1} max={6} value={columns}
                        onChange={(e) => void onColumnsChange(Number(e.target.value))}
                        style={{ width: "200px" }}
                      />
                    </label>
                    <label className="field">
                      <textarea readOnly rows={6} value={widgets.iconostasis_embed_snippet} />
                    </label>
                    <button type="button" className="linkish" onClick={() => navigator.clipboard.writeText(widgets.iconostasis_embed_snippet)} style={{ marginTop: "8px" }}>Копировать код</button>
                  </div>
                </div>
              ) : (
                <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                  <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>📅 2. Ссылка на вашу систему записи (CRM)</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    <strong>Назначение:</strong> Внешняя ссылка (Yclients, Яндекс.Формы и т.д.), куда чат будет перенаправлять клиента при клике на «Записаться».
                  </p>
                  <TextField
                    label="Внешний адрес CRM"
                    value={externalBookingUrlDraft}
                    onChange={setExternalBookingUrlDraft}
                    placeholder="https://n12345.yclients.com/..."
                    disabled={savingSitePlan}
                  />
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button type="button" className="linkish tiny" onClick={() => void onSaveSitePlan()}>Сохранить ссылку</button>
                  </div>
                  <p className="muted tiny" style={{ marginTop: "12px", fontStyle: "italic", background: "var(--surface)", padding: "12px", borderRadius: "8px", border: "1px dashed var(--line)" }}>
                    💡 HTML-код здесь не нужен, так как форма записи находится на стороннем сервисе.
                  </p>
                </div>
              )}

              {/* Widget 3: Registration */}
              {isFullSolution && (
                <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                  <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>📝 3. Регистрация психологов (Служебная)</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    <strong>Назначение:</strong> Закрытая форма для ваших сотрудников, чтобы они могли добавить свои карточки в ваш каталог.
                  </p>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "0.9rem", fontWeight: 600 }}>Путь на сайте:</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input 
                        type="text" 
                        value={pathsDraft.register} 
                        onChange={(e) => onPathChange("register", e.target.value)} 
                        disabled={savingSitePlan} 
                        style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", width: "200px" }}
                      />
                      <span className="muted tiny">Полный адрес: <code style={{ userSelect: "all" }}>{pageUrls.register}</code></span>
                    </div>
                    <button type="button" className="linkish tiny" onClick={() => void onSaveSitePlan()} style={{ marginTop: "8px" }}>Сохранить путь</button>
                  </div>
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-light)" }}>
                    <SnippetBlock
                      title="Код для вставки (Форма регистрации)"
                      description="Служебная форма — специалист заполняет карточку, директор публикует её в каталоге."
                      snippet={widgets.registration_embed_snippet}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Webhook and Policy section */}
          <div className="site-widget-subsection" style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
            <h4 className="site-widget-subtitle">Выгрузка и автоматическая пересылка заявок</h4>
            <p className="muted tiny" style={{ marginBottom: "12px" }}>
              Каждая заявка из чата сохраняется в зашифрованном виде. Вы можете скачать их в Excel или настроить автопересылку.
            </p>
            <button
              type="button"
              className="ob-btn ob-btn--ghost"
              disabled={exportingCloud || !planApplied}
              onClick={() => void onExportCloudLeads()}
              style={{ marginBottom: "24px" }}
            >
              {exportingCloud ? "Готовим файл…" : "Скачать заявки (облако → Excel)"}
            </button>

            <h4 className="site-widget-subtitle" style={{ marginTop: "12px" }}>
              {isRuEdition ? "Заявки в CRM / Webhook (необязательно)" : "Заявки в Таблицу / CRM / Webhook (необязательно)"}
            </h4>
            <p className="muted tiny" style={{ lineHeight: "1.5", marginBottom: "12px" }}>
              {isRuEdition
                ? "Этот блок отвечает за автоматическую пересылку заявок клиентов с вашего сайта. Когда посетитель сайта общается с виджетом чата и оставляет свои контактные данные (имя, телефон, email, вопрос), заявка попадает в локальный терминал. Если вы укажете URL вебхука (приемник вашей CRM-системы), терминал будет автоматически отправлять каждую новую заявку прямо туда строкой."
                : "Этот блок отвечает за автоматическую пересылку заявок клиентов с вашего сайта. Когда посетитель сайта общается с виджетом чата и оставляет свои контактные данные (имя, телефон, email, вопрос), заявка попадает в локальный терминал. Если вы укажете URL вебхука (ссылку на Google Apps Script /exec или приемник вашей CRM-системы), терминал будет автоматически отправлять каждую новую заявку прямо туда строкой."}
            </p>
            <TextField
              label="URL вебхука"
              value={leadsExportWebhookDraft}
              onChange={setLeadsExportWebhookDraft}
              placeholder={isRuEdition ? "https://your-crm.ru/api/webhook" : "https://script.google.com/macros/s/…/exec"}
              disabled={savingSitePlan}
            />

            <h4 className="site-widget-subtitle" style={{ marginTop: "24px" }}>
              {isRuEdition ? "Согласия ПДн (152-ФЗ)" : "Personal Data Protection (GDPR / 152-ФЗ)"}
            </h4>
            <p className="muted tiny" style={{ lineHeight: "1.5", marginBottom: "12px" }}>
              {isRuEdition
                ? "Укажите ссылки на ваши документы. Если они заполнены, во всех формах сбора контактов на вашем сайте (для клиентов и при регистрации психологов) появятся обязательные галочки согласия. Если оставить поля пустыми, галочки выводиться не будут."
                : "Specify links to your legal documents. If specified, mandatory consent checkboxes will be shown on all client booking and specialist registration forms. Leave empty to hide checkboxes."}
            </p>
            <div style={{ display: "flex", gap: "16px", flexDirection: "column" }}>
              <TextField
                label={isRuEdition ? "Ссылка на Политику в отношении обработки персональных данных" : "Privacy Policy URL"}
                value={privacyPolicyUrlDraft}
                onChange={setPrivacyPolicyUrlDraft}
                placeholder="https://your-site.ru/privacy"
                disabled={savingSitePlan}
              />
              <TextField
                label={isRuEdition ? "Ссылка на Согласие на обработку персональных данных" : "Personal Data Agreement URL"}
                value={personalDataAgreementUrlDraft}
                onChange={setPersonalDataAgreementUrlDraft}
                placeholder="https://your-site.ru/agreement"
                disabled={savingSitePlan}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
