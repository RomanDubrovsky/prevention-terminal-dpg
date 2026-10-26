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
import { t } from "../../lib/i18n.ts";
import { TextField } from "./terminal_setup_widgets.tsx";
import {
  getPrivacyPolicyTemplate,
  getConsentAgreementTemplate,
  getCookiePolicyTemplate,
  getCookieBannerCode,
} from "../../lib/legal_templates.ts";
import { AcademyAfishaGenerator } from "../academy/AcademyAfishaWidget.tsx";

interface SiteWidgetsSectionProps {
  organizationName: string;
  centerId?: string;
  setupToken?: string;
  isSchoolLike?: boolean;
  busy?: boolean;
  isSettings?: boolean;
  allowTokenRotation?: boolean;
}

function RosterCopyButton(props: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(props.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <button
      type="button"
      className="linkish"
      onClick={handleCopy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        transition: "all 0.2s ease",
        marginTop: "8px",
        ...(copied
          ? { color: "#059669", background: "#ecfdf5", padding: "6px 14px", borderRadius: "6px", border: "1px solid #a7f3d0", fontWeight: 700 }
          : {})
      }}
    >
      {copied ? t("✓ Скопировано в буфер!", "✓ Copied to clipboard!") : t("📋 Копировать код", "📋 Copy snippet")}
    </button>
  );
}

function SnippetBlock(props: { title: string; description: string; snippet: string; deployUrl?: string }) {
  const [copied, setCopied] = useState(false);
  const desc = props.deployUrl ? `${props.description} ${props.deployUrl}` : props.description;

  const handleCopy = () => {
    void navigator.clipboard.writeText(props.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="site-widget-block">
      <h3 className="site-widget-title">{props.title}</h3>
      <p className="muted tiny">{desc}</p>
      <label className="field">
        <span>{t("HTML-код для вставки", "HTML embed snippet")}</span>
        <textarea readOnly rows={7} value={props.snippet} />
      </label>
      <button
        type="button"
        className="linkish"
        onClick={handleCopy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          transition: "all 0.2s ease",
          marginTop: "8px",
          ...(copied
            ? { color: "#059669", background: "#ecfdf5", padding: "6px 14px", borderRadius: "6px", border: "1px solid #a7f3d0", fontWeight: 700 }
            : {})
        }}
      >
        {copied ? t("✓ Скопировано в буфер!", "✓ Copied to clipboard!") : t("📋 Копировать код", "📋 Copy snippet")}
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
  const [crossPromoSpecialists, setCrossPromoSpecialists] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("ida_cross_promo_specialists_v1");
      return saved !== null ? saved === "1" : true;
    } catch {
      return true;
    }
  });
  const [privacyPolicyUrlDraft, setPrivacyPolicyUrlDraft] = useState("");
  const [personalDataAgreementUrlDraft, setPersonalDataAgreementUrlDraft] = useState("");
  const [savingSitePlan, setSavingSitePlan] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [exportingCloud, setExportingCloud] = useState(false);




  const isRuEdition = getTerminalEdition() === "ru";

  const orgLabel = organizationName.trim() || "Моя организация";
  const planApplied = Boolean(portal?.public_site_origin && portal?.site_page_paths_json);
  const isCrmIntegration = bookingMode === "external";
  const isFullSolution = bookingMode === "prevention";

  const [activeLegalTemplate, setActiveLegalTemplate] = useState<"privacy" | "consent" | "cookies" | "banner" | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyTextToClipboard = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 3000);
    } catch (_) {}
  }, []);

  const onAutoFillLegalPaths = useCallback(() => {
    const origin = (siteOriginDraft || "").trim().replace(/\/+$/, "");
    if (!origin) return;
    setPrivacyPolicyUrlDraft(`${origin}/privacy`);
    setPersonalDataAgreementUrlDraft(`${origin}/consent`);
    setPathsDraft((prev) => ({
      ...prev,
      privacy: "/privacy",
      consent: "/consent",
      cookies: "/cookies",
    }));
  }, [siteOriginDraft]);

  const isLegalComplete = Boolean(privacyPolicyUrlDraft.trim() && personalDataAgreementUrlDraft.trim());

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
          privacyPolicyUrl: portalCfg.privacy_policy_url || undefined,
          personalDataAgreementUrl: portalCfg.personal_data_agreement_url || undefined,
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
          privacyPolicyUrl: portalCfg.privacy_policy_url || undefined,
          personalDataAgreementUrl: portalCfg.personal_data_agreement_url || undefined,
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
        ensureSitePortal(orgLabel, props.centerId, props.setupToken),
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
    setSavedSuccess(false);
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
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
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
    const scriptWithInline = widgets.embed_snippet.replace(
      'data-locale="ru"',
      'data-inline="true"\n  data-locale="ru"'
    );
    return `<div id="ida-chat-container" style="width: 100%; height: 600px;"></div>\n${scriptWithInline}`;
  }, [widgets?.embed_snippet]);



  return (
    <div className="site-widgets-section">
      
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
              <h3 className="site-widget-title" style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>{t("Режим приватности ИИ-помощника", "AI Assistant Privacy Mode")}</h3>
              <p className="muted tiny" style={{ margin: "0 0 12px" }}>{t("Укажите, как ИИ-приёмная должна идентифицировать учащихся в чате.", "Specify how the AI front desk identifies students in chat.")}</p>
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
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{t("Полная анонимность", "Full Anonymity")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Подростки общаются инкогнито. ФИО запрашивается только при очной записи. Снижает барьер доверия.", "Teens communicate anonymously. Full name is requested only for in-person appointments. Lowers the barrier to trust.")}</div>
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
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{t("Гибридный контроль угроз (Рекомендуется)", "Hybrid Threat Monitoring (Recommended)")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Начало диалога анонимно, но при фиксации критических угроз (буллинг/насилие) ИИ затребует ФИО для помощи.", "Chat starts anonymously, but when critical safety threats (bullying/abuse) are detected, AI asks for identity to provide help.")}</div>
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
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{t("Строгая авторизация", "Strict Authorization")}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{t("Ввод ФИО и класса до начала диалога. Подходит для контроля обращений, снижает вовлеченность.", "Requires full name and class before starting chat. High accountability, but may reduce engagement.")}</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Блок 2: Базовые настройки (Домен и персональные данные 152-ФЗ) */}
          <div className="site-widget-block site-widget-block--plan">
            <h3 className="site-widget-title">
              {t("Базовые настройки интеграции и согласия на обработку персональных данных (152-ФЗ)", "Basic Integration & Legal Privacy Settings")}
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
              label={t("Домен сайта центра", "Center website domain")}
              value={siteOriginDraft}
              onChange={setSiteOriginDraft}
              placeholder="https://center.ru"
              disabled={savingSitePlan}
              hint={t(
                "Указание домена необходимо для безопасности (CORS-ограничение, чтобы локальный сервер Терминала на этом компьютере принимал заявки клиентов только с вашего сайта). Сведения никуда не передаются и хранятся локально.",
                "Domain is required for security (CORS origin policy). Data remains local and is not shared."
              )}
            />

            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--line-light)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
                <h4 className="site-widget-subtitle" style={{ margin: 0, fontSize: "1.05rem" }}>
                  {isRuEdition ? "Согласия на обработку персональных данных (152-ФЗ РФ)" : "Personal Data Protection (GDPR / 152-ФЗ)"}
                </h4>
                {isLegalComplete ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#065f46", background: "#ecfdf5", padding: "4px 10px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
                    ✓ 152-ФЗ соблюдён
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#92400e", background: "#fffbeb", padding: "4px 10px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                    ⚠️ Требуется настройка
                  </span>
                )}
              </div>

              {/* Статусный баннер соблюдения 152-ФЗ */}
              {isLegalComplete ? (
                <div style={{ padding: "12px 16px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px", margin: "12px 0 16px", color: "#065f46", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  🛡️ <strong>Соответствие законодательству РФ активно:</strong> во всех формах сбора контактов и заявок (Чат, Каталог специалистов, Регистрация) включены прямые ссылки на ваши документы и неотмеченные чекбоксы согласия. Заранее проставленные галочки исключены по предписаниям Роскомнадзора.
                </div>
              ) : (
                <div style={{ padding: "12px 16px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px", margin: "12px 0 16px", color: "#92400e", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  ⚠️ <strong>Ссылки на документы не указаны:</strong> формы виджетов на вашем сайте будут собирать заявки без согласия на обработку ПДн, что нарушает ст. 9 и 18.1 Федерального закона № 152-ФЗ РФ (риск штрафа Роскомнадзора по ст. 13.11 КоАП РФ до 150 000 – 300 000 ₽). Нажмите кнопку быстрой подстановки ниже или введите ссылки вручную.
                </div>
              )}

              {/* Кнопка быстрой автоподстановки */}
              {siteOriginDraft.trim() && (
                <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ob-btn ob-btn--ghost"
                    onClick={onAutoFillLegalPaths}
                    disabled={savingSitePlan}
                    style={{ fontSize: "0.84rem", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    ⚡ {t("Заполнить стандартными адресами (/privacy и /consent)", "Autofill standard URLs (/privacy & /consent)")}
                  </button>
                  <span className="muted tiny">
                    {t(`Установит: ${siteOriginDraft.trim().replace(/\/+$/, "")}/privacy и /consent`, "Sets standard URLs on your domain")}
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: "16px", flexDirection: "column" }}>
                <div>
                  <TextField
                    label={isRuEdition ? "Ссылка на Политику в отношении обработки персональных данных" : "Privacy Policy URL"}
                    value={privacyPolicyUrlDraft}
                    onChange={setPrivacyPolicyUrlDraft}
                    placeholder="https://your-site.ru/privacy"
                    disabled={savingSitePlan}
                    hint={t("Страница с текстом Политики обработки ПДн (ст. 18.1 152-ФЗ РФ, штраф до 60 000 ₽ за отсутствие)", "Privacy Policy URL")}
                  />
                  {privacyPolicyUrlDraft.trim() && (
                    <div style={{ marginTop: "4px", fontSize: "0.8rem" }}>
                      <a href={privacyPolicyUrlDraft} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "underline" }}>
                        ↗ {t("Проверить ссылку на Политику (открыть в новом окне)", "Test Privacy Policy Link")}
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <TextField
                    label={isRuEdition ? "Ссылка на Согласие на обработку персональных данных" : "Personal Data Agreement URL"}
                    value={personalDataAgreementUrlDraft}
                    onChange={setPersonalDataAgreementUrlDraft}
                    placeholder="https://your-site.ru/consent"
                    disabled={savingSitePlan}
                    hint={t("Страница с текстом Согласия на обработку ПДн при отправке заявок (ст. 9 152-ФЗ РФ, штраф до 150 000–300 000 ₽)", "Consent Agreement URL")}
                  />
                  {personalDataAgreementUrlDraft.trim() && (
                    <div style={{ marginTop: "4px", fontSize: "0.8rem" }}>
                      <a href={personalDataAgreementUrlDraft} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "underline" }}>
                        ↗ {t("Проверить ссылку на Согласие (открыть в новом окне)", "Test Consent Link")}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Блок обязательных страниц на сайте центра */}
              <div style={{ marginTop: "20px", padding: "16px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--line-light)" }}>
                <h5 style={{ margin: "0 0 6px 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                  📌 {t("Обязательные страницы на вашем сайте (152-ФЗ РФ)", "Mandatory Legal Pages on Your Website")}
                </h5>
                <p className="muted tiny" style={{ marginBottom: "12px", lineHeight: 1.5 }}>
                  {t(
                    "Чтобы ваш сайт полностью соответствовал закону, создайте на нём следующие 3 страницы. Тексты документов можно скопировать из готовых шаблонов ниже:",
                    "Publish these 3 pages on your website to ensure complete legal compliance:"
                  )}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                  <div style={{ padding: "10px 14px", background: "var(--surface-soft)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.86rem", marginBottom: "3px" }}>1. Политика конфиденциальности</div>
                    <div className="muted tiny" style={{ marginBottom: "4px" }}>Основание: ст. 18.1 152-ФЗ</div>
                    <div style={{ fontSize: "0.8rem" }}>Адрес: <code style={{ userSelect: "all" }}>{pageUrls.privacy || (siteOriginDraft ? siteOriginDraft.replace(/\/+$/, "") + "/privacy" : "/privacy")}</code></div>
                  </div>
                  <div style={{ padding: "10px 14px", background: "var(--surface-soft)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.86rem", marginBottom: "3px" }}>2. Согласие на обработку ПДн</div>
                    <div className="muted tiny" style={{ marginBottom: "4px" }}>Основание: ст. 9 152-ФЗ</div>
                    <div style={{ fontSize: "0.8rem" }}>Адрес: <code style={{ userSelect: "all" }}>{pageUrls.consent || (siteOriginDraft ? siteOriginDraft.replace(/\/+$/, "") + "/consent" : "/consent")}</code></div>
                  </div>
                  <div style={{ padding: "10px 14px", background: "var(--surface-soft)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.86rem", marginBottom: "3px" }}>3. Политика файлов Cookie</div>
                    <div className="muted tiny" style={{ marginBottom: "4px" }}>Информирование о куках и сессиях</div>
                    <div style={{ fontSize: "0.8rem" }}>Адрес: <code style={{ userSelect: "all" }}>{pageUrls.cookies || (siteOriginDraft ? siteOriginDraft.replace(/\/+$/, "") + "/cookies" : "/cookies")}</code></div>
                  </div>
                </div>
              </div>

              {/* Аккордеон готовых шаблонов документов */}
              <div style={{ marginTop: "20px", padding: "16px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--line-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                  <h5 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                    📋 {t("Готовые типовые шаблоны документов (скопируйте и опубликуйте на сайте)", "Turnkey Document Templates for Your Site")}
                  </h5>
                  <span className="muted tiny">
                    {t("С учётом специфики психологических консультаций", "Tailored for psychological centers")}
                  </span>
                </div>
                <p className="muted tiny" style={{ marginBottom: "12px", lineHeight: 1.5 }}>
                  {t(
                    "Нажмите на нужный документ, скопируйте подготовленный текст и вставьте его на соответствующую страницу вашего сайта (Tilda, WordPress, Битрикс и др.):",
                    "Click a document below, copy the prepared text with your organization details, and publish it on your site:"
                  )}
                </p>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: activeLegalTemplate ? "14px" : "0" }}>
                  <button
                    type="button"
                    className={`ob-btn ${activeLegalTemplate === "privacy" ? "ob-btn--primary" : "ob-btn--ghost"}`}
                    onClick={() => setActiveLegalTemplate(prev => prev === "privacy" ? null : "privacy")}
                    style={{ fontSize: "0.83rem", padding: "6px 12px" }}
                  >
                    📄 {t("Политика обработки ПДн", "Privacy Policy")}
                  </button>
                  <button
                    type="button"
                    className={`ob-btn ${activeLegalTemplate === "consent" ? "ob-btn--primary" : "ob-btn--ghost"}`}
                    onClick={() => setActiveLegalTemplate(prev => prev === "consent" ? null : "consent")}
                    style={{ fontSize: "0.83rem", padding: "6px 12px" }}
                  >
                    📝 {t("Согласие на обработку ПДн", "Consent Agreement")}
                  </button>
                  <button
                    type="button"
                    className={`ob-btn ${activeLegalTemplate === "cookies" ? "ob-btn--primary" : "ob-btn--ghost"}`}
                    onClick={() => setActiveLegalTemplate(prev => prev === "cookies" ? null : "cookies")}
                    style={{ fontSize: "0.83rem", padding: "6px 12px" }}
                  >
                    🍪 {t("Политика файлов Cookie", "Cookie Policy")}
                  </button>
                  <button
                    type="button"
                    className={`ob-btn ${activeLegalTemplate === "banner" ? "ob-btn--primary" : "ob-btn--ghost"}`}
                    onClick={() => setActiveLegalTemplate(prev => prev === "banner" ? null : "banner")}
                    style={{ fontSize: "0.83rem", padding: "6px 12px" }}
                  >
                    🔔 {t("Код Cookie-баннера для сайта", "Cookie Banner Snippet")}
                  </button>
                </div>

                {activeLegalTemplate && (
                  <div style={{ background: "var(--surface-soft)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    {activeLegalTemplate === "privacy" && (() => {
                      const text = getPrivacyPolicyTemplate({ orgName: orgLabel, domain: siteOriginDraft });
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                            <strong style={{ fontSize: "0.88rem" }}>Политика в отношении обработки персональных данных (для страницы /privacy)</strong>
                            <button
                              type="button"
                              className="ob-btn ob-btn--primary"
                              onClick={() => void copyTextToClipboard("privacy", text)}
                              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                            >
                              {copiedKey === "privacy" ? "✓ Скопировано!" : "📋 Скопировать текст"}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={10}
                            value={text}
                            style={{ width: "100%", fontSize: "0.8rem", fontFamily: "monospace", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}
                          />
                        </div>
                      );
                    })()}

                    {activeLegalTemplate === "consent" && (() => {
                      const text = getConsentAgreementTemplate({ orgName: orgLabel, domain: siteOriginDraft });
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                            <strong style={{ fontSize: "0.88rem" }}>Согласие на обработку персональных данных при записи (для страницы /consent)</strong>
                            <button
                              type="button"
                              className="ob-btn ob-btn--primary"
                              onClick={() => void copyTextToClipboard("consent", text)}
                              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                            >
                              {copiedKey === "consent" ? "✓ Скопировано!" : "📋 Скопировать текст"}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={10}
                            value={text}
                            style={{ width: "100%", fontSize: "0.8rem", fontFamily: "monospace", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}
                          />
                        </div>
                      );
                    })()}

                    {activeLegalTemplate === "cookies" && (() => {
                      const text = getCookiePolicyTemplate({ orgName: orgLabel, domain: siteOriginDraft });
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                            <strong style={{ fontSize: "0.88rem" }}>Политика использования файлов Cookie (для страницы /cookies)</strong>
                            <button
                              type="button"
                              className="ob-btn ob-btn--primary"
                              onClick={() => void copyTextToClipboard("cookies", text)}
                              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                            >
                              {copiedKey === "cookies" ? "✓ Скопировано!" : "📋 Скопировать текст"}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={10}
                            value={text}
                            style={{ width: "100%", fontSize: "0.8rem", fontFamily: "monospace", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}
                          />
                        </div>
                      );
                    })()}

                    {activeLegalTemplate === "banner" && (() => {
                      const text = getCookieBannerCode(siteOriginDraft);
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                            <strong style={{ fontSize: "0.88rem" }}>Готовый HTML+JS код уведомления о Cookies (вставьте перед закрывающим тегом &lt;/body&gt;)</strong>
                            <button
                              type="button"
                              className="ob-btn ob-btn--primary"
                              onClick={() => void copyTextToClipboard("banner", text)}
                              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
                            >
                              {copiedKey === "banner" ? "✓ Скопировано!" : "📋 Скопировать код баннера"}
                            </button>
                          </div>
                          <textarea
                            readOnly
                            rows={10}
                            value={text}
                            style={{ width: "100%", fontSize: "0.8rem", fontFamily: "monospace", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", margin: "16px 0", color: "#ef4444", fontSize: "0.9rem" }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                disabled={savingSitePlan}
                onClick={() => void onSaveSitePlan()}
                style={{ padding: "12px 24px" }}
              >
                {savingSitePlan ? t("Сохраняем…", "Saving…") : t("⚡ Применить настройки и обновить виджеты", "⚡ Apply Settings & Refresh Widgets")}
              </button>
              {savedSuccess && (
                <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.9rem", background: "#ecfdf5", padding: "8px 16px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                  {t("✓ Настройки сайта и 152-ФЗ сохранены!", "✓ Site & 152-FZ privacy settings saved!")}
                </span>
              )}
            </div>
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
                <div style={{ marginBottom: "20px", padding: "12px 16px", background: "var(--surface)", borderRadius: "8px", border: "1px dashed var(--line-light)" }}>
                  <p className="muted tiny" style={{ margin: 0 }}>
                    💡 Вы можете разместить этот код на любой странице сайта (например, на главной или <code>/chat</code>). Система будет собирать заявки автоматически независимо от адреса.
                  </p>
                </div>
                <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(15, 118, 110, 0.08)", borderRadius: "8px", border: "1px solid rgba(15, 118, 110, 0.2)", fontSize: "0.85rem", color: "var(--text)" }}>
                  🛡️ <strong>152-ФЗ в коде Чата:</strong> {isLegalComplete
                    ? "Форма заявки клиентом автоматически включает неотмеченный чекбокс со ссылками на вашу Политику и Согласие. Заявки сохраняются локально в зашифрованном виде."
                    : "Для включения чекбокса согласия 152-ФЗ укажите ссылки на Политику и Согласие в блоке настроек выше."}
                </div>
                <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-light)" }}>
                  <SnippetBlock
                    title="Код для вставки (Кнопка в углу / Floating FAB)"
                    description="Виджет появится на вашем сайте в правом нижнем углу в виде плавающей иконки чата."
                    snippet={widgets.embed_snippet}
                  />
                  <div style={{ height: "24px", borderBottom: "1px dashed var(--line-light)", marginBottom: "24px" }}></div>
                  <SnippetBlock
                    title={t("Код для вставки (Встроенный в страницу / Inline iframe)", "Embed snippet (Inline embed / In-page chat)")}
                    description={t("Чат будет встроен прямо внутрь страницы в место вставки этого HTML-блока (содержит <div id='ida-chat-container'>).", "Chat will be embedded directly into your page where you paste this HTML block (includes <div id='ida-chat-container'>).")}
                    snippet={inlineSnippet}
                  />
                </div>
              </div>

              {/* Widget 2: Specialist Directory / Roster or External CRM */}
              {isFullSolution ? (
                <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                  <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>👥 {t("2. Каталог специалистов и Запись", "2. Specialist Directory & Booking")}</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    <strong>{t("Назначение:", "Purpose:")}</strong> {t("Публичная витрина команды и календарь для записи клиентов. Кнопка «Записаться» из чата автоматически ведёт на эту страницу.", "Public team directory & booking calendar. The 'Book consultation' button in chat automatically links here.")}
                  </p>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem", fontWeight: 600 }}>{t("Путь к этой странице на вашем сайте:", "Website path:")}</label>
                    <p className="muted tiny" style={{ marginBottom: "10px", lineHeight: 1.4 }}>
                      Отредактируйте этот путь, если планируете разместить каталог на другой странице. <strong>Терминал встроит этот адрес в код Чата</strong>, чтобы кнопка «Записаться» перенаправляла клиента сюда.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input 
                        type="text" 
                        value={pathsDraft.iconostasis} 
                        onChange={(e) => { onPathChange("iconostasis", e.target.value); onPathChange("consult", e.target.value); }} 
                        placeholder="Например: /nashi-vrachi"
                        disabled={savingSitePlan} 
                        style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", width: "220px" }}
                      />
                      <span className="muted tiny">{t("Полный адрес:", "Full URL:")} <code style={{ userSelect: "all" }}>{pageUrls.iconostasis}</code></span>
                    </div>
                  </div>
                  <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(15, 118, 110, 0.08)", borderRadius: "8px", border: "1px solid rgba(15, 118, 110, 0.2)", fontSize: "0.85rem", color: "var(--text)" }}>
                    🛡️ <strong>152-ФЗ в Витрине специалистов:</strong> {isLegalComplete
                      ? "Модальное окно записи к психологу и общая форма подбора включают неотмеченный чекбокс со ссылками на вашу Политику и Согласие."
                      : "Для отображения чекбокса согласия 152-ФЗ укажите ссылки на Политику и Согласие в блоке настроек выше."}
                  </div>
                  <div style={{ marginBottom: "16px", padding: "12px 14px", background: crossPromoSpecialists ? "rgba(79, 70, 229, 0.08)" : "var(--surface)", borderRadius: "8px", border: `1px solid ${crossPromoSpecialists ? "rgba(79, 70, 229, 0.35)" : "var(--line)"}`, fontSize: "0.85rem", color: "var(--text)" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={crossPromoSpecialists}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setCrossPromoSpecialists(next);
                          try {
                            localStorage.setItem("ida_cross_promo_specialists_v1", next ? "1" : "0");
                          } catch {}
                        }}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "#4f46e5" }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: crossPromoSpecialists ? "#4f46e5" : "var(--text)" }}>
                          🤝 Показывать наших психологов в общей витрине (дополнительный поток клиентов)
                        </div>
                        <div className="muted tiny" style={{ marginTop: "3px", lineHeight: 1.4 }}>
                          Карточки ваших психологов и выпускников появятся не только на вашем сайте, но и в общей витрине практикующих психологов, чтобы новые клиенты могли сразу записаться к ним на консультацию через ваш центр.
                        </div>
                      </div>
                    </label>
                  </div>
                  <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-light)" }}>
                    <h4 className="site-widget-subtitle" style={{ fontSize: "1rem", margin: "0 0 4px 0" }}>{t("Код для вставки (Витрина специалистов)", "Embed snippet (Specialist Directory)")}</h4>
                    <p className="muted tiny" style={{ marginBottom: "16px" }}>{t("Сетка с фото; по клику — карточка специалиста со встроенной формой записи.", "Photo grid; clicking opens specialist profile with booking form.")}</p>
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
                    <RosterCopyButton snippet={widgets.iconostasis_embed_snippet} />
                  </div>
                </div>
              ) : (
                <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                  <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>📅 2. Ссылка на вашу систему записи (CRM)</h3>
                  <p className="muted tiny" style={{ marginBottom: "16px" }}>
                    <strong>Назначение:</strong> Внешняя ссылка (Yclients, Яндекс.Формы и т.д.), куда чат будет перенаправлять клиента при клике на «Записаться».
                  </p>
                  <p className="muted tiny" style={{ marginBottom: "10px", lineHeight: 1.4 }}>
                    <strong>Терминал встроит эту ссылку в код Чата</strong>.
                  </p>
                  <TextField
                    label="Внешний адрес CRM"
                    value={externalBookingUrlDraft}
                    onChange={setExternalBookingUrlDraft}
                    placeholder="Например: https://n12345.yclients.com/..."
                    disabled={savingSitePlan}
                  />
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
                  <div style={{ marginBottom: "20px", padding: "12px 16px", background: "var(--surface)", borderRadius: "8px", border: "1px dashed var(--line-light)" }}>
                    <p className="muted tiny" style={{ margin: 0 }}>
                      💡 Разместите этот код на любой служебной, закрытой или скрытой странице сайта (например, <code>/register-staff</code>).
                    </p>
                  </div>
                  <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(15, 118, 110, 0.08)", borderRadius: "8px", border: "1px solid rgba(15, 118, 110, 0.2)", fontSize: "0.85rem", color: "var(--text)" }}>
                    🛡️ <strong>152-ФЗ в форме Регистрации:</strong> {isLegalComplete
                      ? "Анкета специалиста содержит обязательные раздельные чекбоксы ознакомления с Политикой обработки ПДн и Согласием на обработку данных со ссылками."
                      : "Для активации ссылок 152-ФЗ в анкете психолога укажите ссылки на документы в блоке настроек выше."}
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

              {/* Widget 4: Academy Afisha & Student Login */}
              <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  🎓 4. Витрина курсов, вебинаров и Вход для студентов (Автономная онлайн-школа)
                </h3>
                <p className="muted tiny" style={{ marginBottom: "16px", lineHeight: 1.5 }}>
                  <strong>Назначение:</strong> Если у вашего центра есть обучающие курсы, супервизии или вебинары — встройте на свой сайт (Tilda, WordPress и др.) готовую витрину с кнопкой <strong>«🔑 Вход в кабинет студента»</strong>. Вы можете показывать только свои программы, подборку по нужному направлению или общую афишу дружественных школ.
                </p>
                                <AcademyAfishaGenerator defaultSchoolName={orgLabel} />
              </div>

              {/* Widget 5: Personal Smart Business Card & Practice Widget */}
              <div className="site-widget-block" style={{ padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
                  📇 5. Персональная Умная Визитка и виджет частной практики
                </h3>
                <p className="muted tiny" style={{ marginBottom: "16px", lineHeight: 1.5 }}>
                  <strong>Назначение:</strong> Готовая публичная страница психолога со встроенным персональным ИИ-ассистентом. Клиент может описать свой запрос или записаться напрямую. Все заявки мгновенно поступают во вкладку <strong>«📥 Входящие»</strong> вашего терминала.
                </p>
                <div style={{ marginBottom: "16px", padding: "12px 16px", background: "var(--surface)", borderRadius: "8px", border: "1px dashed var(--line-light)" }}>
                  <p className="muted tiny" style={{ margin: 0, lineHeight: 1.5 }}>
                    💡 <strong>Сквозная интеграция:</strong> Вы можете отправлять прямую ссылку на визитку клиентам в Telegram/WhatsApp или скопировать код кнопки для вставки на личный сайт / блог.
                  </p>
                </div>
                <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-light)" }}>
                  <SnippetBlock
                    title="Код персонального виджета для личного сайта"
                    description="Вставьте этот код на страницу личного сайта — появится кнопка онлайн-записи с персональным ИИ-ассистентом:"
                    snippet={`<script src="https://ida-psy.ru/ida/embed/loader.js" data-center-id="${portal.center_id || 'default'}" data-locale="ru"></script>`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Webhook and Lead Export section */}
          <div className="site-widget-block" style={{ marginTop: "32px", padding: "24px", background: "var(--surface-soft)", borderRadius: "14px", border: "1px solid var(--line)" }}>
            <h3 className="site-widget-title" style={{ marginTop: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "8px" }}>
              📡 {t("Выгрузка и автоматическая пересылка заявок (CRM / Webhook)", "Lead Export & Automatic CRM Forwarding")}
            </h3>
            <p className="muted tiny" style={{ marginBottom: "16px", lineHeight: "1.5" }}>
              {t(
                "Каждая заявка из чата сохраняется в зашифрованном виде. Вы можете вручную выгрузить их в Excel или настроить моментальную автопересылку в вашу внешнюю систему.",
                "Each lead from chat is saved with encryption. Export to Excel or configure instant CRM forwarding."
              )}
            </p>
            <div style={{ marginBottom: "20px", padding: "16px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--line-light)" }}>
              <h4 className="site-widget-subtitle" style={{ margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                {t("1. Ручной экспорт заявок", "1. Manual Lead Export")}
              </h4>
              <p className="muted tiny" style={{ marginBottom: "12px" }}>
                {t("Скачать полный реестр поступивших с сайта заявок в формате Excel (.xlsx).", "Download full site lead registry in Excel (.xlsx) format.")}
              </p>
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={exportingCloud || !planApplied}
                onClick={() => void onExportCloudLeads()}
              >
                {exportingCloud ? t("Готовим файл…", "Preparing file…") : t("📥 Скачать заявки (облако → Excel)", "📥 Download Leads (Cloud → Excel)")}
              </button>
            </div>

            <div style={{ padding: "16px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--line-light)" }}>
              <h4 className="site-widget-subtitle" style={{ margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                {isRuEdition ? "2. Заявки в CRM / Webhook (необязательно)" : "2. Leads to Sheet / CRM / Webhook (optional)"}
              </h4>
              <p className="muted tiny" style={{ lineHeight: "1.5", marginBottom: "14px" }}>
                {isRuEdition
                  ? "Этот блок отвечает за автоматическую пересылку заявок клиентов с вашего сайта. Когда посетитель сайта общается с виджетом чата и оставляет свои контактные данные (имя, телефон, email, вопрос), заявка попадает в локальный терминал. Если вы укажете URL вебхука (приемник вашей CRM-системы), терминал будет автоматически отправлять каждую новую заявку прямо туда строкой."
                  : "This section configures automatic lead forwarding. When a website visitor leaves contact info in the chat widget, the lead is stored in your terminal and forwarded to your custom CRM webhook endpoint."}
              </p>
              <TextField
                label="URL вебхука"
                value={leadsExportWebhookDraft}
                onChange={setLeadsExportWebhookDraft}
                placeholder={isRuEdition ? "https://your-crm.ru/api/webhook" : "https://script.google.com/macros/s/…/exec"}
                disabled={savingSitePlan}
              />
              <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ob-btn ob-btn--primary"
                  disabled={savingSitePlan}
                  onClick={() => void onSaveSitePlan()}
                  style={{ padding: "10px 20px", fontSize: "0.9rem" }}
                >
                  {savingSitePlan ? t("Сохраняем…", "Saving…") : t("💾 Сохранить URL вебхука", "💾 Save Webhook URL")}
                </button>
                {savedSuccess && (
                  <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.88rem", background: "#ecfdf5", padding: "6px 14px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                    {t("✓ Webhook успешно сохранен!", "✓ Webhook URL saved successfully!")}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
