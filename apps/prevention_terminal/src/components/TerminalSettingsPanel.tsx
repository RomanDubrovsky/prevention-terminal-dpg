import { t } from "../lib/i18n.ts";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { InstallationMeta } from "../lib/installation_meta.ts";
import {
  buildVisibleSetupSections,
  setupSectionTitle,
  type SetupSection,
} from "../lib/terminal_setup_constants.ts";
import { useTerminalSetup } from "../lib/use_terminal_setup.ts";
import type { OrgProfile, SpecialistProfile } from "../lib/terminal_profiles.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { editionLabel, getEditionConfig } from "../lib/terminal_edition.ts";
import { defaultPaywallUrl } from "../lib/terminal_subscription.ts";
import { terminalAppTitle } from "../lib/terminal_branding.ts";
import ModuleBundle from "./ModuleBundle.tsx";
import TerminalSetupFormSections from "./terminal_setup/TerminalSetupFormSections.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import SupportFeedbackSection from "./SupportFeedbackSection.tsx";
import ResearchContributionSection from "./ResearchContributionSection.tsx";
import UpdateNotice from "./UpdateNotice.tsx";
import SpecialistPublicProfileSettings from "./SpecialistPublicProfileSettings.tsx";
import ApplicationsSettingsSection from "./terminal_setup/ApplicationsSettingsSection.tsx";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { defaultPaywallUrl, isSubscriptionRequired } from "../lib/terminal_subscription.ts";

type SettingsTab =
  | SetupSection
  | "applications"
  | "specialist_profile"
  | "ai_subscription"
  | "feedback"
  | "research_contribution"
  | "inbox"
  | "updates";

interface TerminalSettingsPanelProps {
  terminalUserId?: string;
  terminalConfig?: TerminalConfig;
  requestedSection?: "feedback" | "inbox" | "ai_subscription" | null;
  onRequestedSectionHandled?: () => void;
  onSaved: (payload: {
    meta: InstallationMeta;
    orgProfile: OrgProfile;
    specialistProfile: SpecialistProfile;
    terminalConfig: TerminalConfig;
  }) => void;
  onTerminalConfigChange?: (terminalConfig: TerminalConfig) => void;
}

export default function TerminalSettingsPanel(props: TerminalSettingsPanelProps) {
  const { onSaved, terminalUserId, terminalConfig, requestedSection, onRequestedSectionHandled, onTerminalConfigChange } = props;
  const setup = useTerminalSetup();
  const { sub, active } = useTerminalSubscription(terminalUserId, terminalConfig?.org_type || setup.orgType);
  const editionConfig = getEditionConfig();
  const locale = editionConfig.locale_default;

  const sections = useMemo(
    () =>
      buildVisibleSetupSections(setup.workspacePreset, {
        territorialManager: setup.territorialManager,
        includeAdvancedOrganization: true,
        skipOrgStep: true,
      }),
    [setup.territorialManager, setup.workspacePreset],
  );
  const [section, setSection] = useState<SettingsTab>("federation");

  const navSections: SettingsTab[] = useMemo(() => {
    const base: SettingsTab[] = ["applications"];
    base.push(...sections);
    if (setup.workspacePreset === "specialist") {
      base.push("specialist_profile");
    }
    if (isSubscriptionRequired(terminalConfig?.org_type || setup.orgType)) {
      base.push("ai_subscription");
    }
    base.push("research_contribution", "updates");
    return base;
  }, [sections, setup.workspacePreset, setup.orgType, terminalConfig?.org_type, terminalUserId]);

  useEffect(() => {
    if (!navSections.includes(section)) {
      setSection(navSections[0] ?? "organization");
    }
  }, [section, navSections]);

  useEffect(() => {
    if (requestedSection && navSections.includes(requestedSection)) {
      setSection(requestedSection);
      onRequestedSectionHandled?.();
    }
  }, [requestedSection, navSections, onRequestedSectionHandled]);

  const handleSave = useCallback(async () => {
    try {
      const payload = await setup.save();
      onSaved(payload);
    } catch {
      /* error shown in setup.error */
    }
  }, [onSaved, setup]);

  return (
    <div className="workspace-panel-stack terminal-settings-embedded">
      <section className="card workspace-panel">
        <header className="terminal-settings-header">
          <div>
            <h2>{t("Настройки", "Settings")}</h2>
            <p className="muted tiny">
              {terminalAppTitle()} ·{" "}
              {section === "applications"
                ? t("Приложения и пространства", "Apps & Spaces")
                : section === "specialist_profile"
                ? t("Анкета специалиста", "Specialist Profile")
                : section === "ai_subscription"
                ? t("Подписка ИИ", "AI Subscription")
                : section === "feedback"
                  ? t("Обратная связь", "Feedback & Support")
                  : section === "research_contribution"
                    ? t("Вклад в науку", "Research Contribution")
                    : section === "updates"
                      ? t("Обновления", "Updates")
                      : section === "inbox"
                        ? t("Заявки", "Inbox Requests")
                        : setupSectionTitle(section)}
            </p>
          </div>
        </header>

        {!setup.loaded ? (
          <p className="muted">{t("Загружаем настройки…", "Loading settings...")}</p>
        ) : (
          <div className="terminal-settings-body">
            <nav className="terminal-settings-nav" aria-label="Разделы настроек">
              {navSections.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={section === s ? "active" : ""}
                  onClick={() => {
                    setup.setError(null);
                    setSection(s);
                  }}
                >
                  {s === "applications"
                    ? t("🧩 Приложения", "🧩 Applications")
                    : s === "specialist_profile"
                    ? t("Анкета специалиста", "Specialist Profile")
                    : s === "ai_subscription"
                    ? t("Подписка ИИ", "AI Subscription")
                    : s === "feedback"
                      ? t("Обратная связь", "Feedback & Support")
                      : s === "research_contribution"
                        ? t("Вклад в науку", "Research Contribution")
                        : s === "updates"
                          ? t("Обновления", "Updates")
                          : s === "inbox"
                            ? t("Заявки", "Inbox Requests")
                            : setupSectionTitle(s)}
                </button>
              ))}
            </nav>
            <div className="terminal-settings-content">
              {section === "applications" ? (
                <ApplicationsSettingsSection
                  enabledApplications={setup.enabledApplications}
                  onChangeEnabledApplications={(apps) => setup.setEnabledApplications(apps)}
                  onSave={handleSave}
                  isSaving={setup.busy}
                />
              ) : section === "specialist_profile" ? (
                <SpecialistPublicProfileSettings
                  centerId={terminalConfig?.organization_id || "default-center"}
                  setupToken={terminalConfig?.terminal_api_key || ""}
                  terminalUserId={terminalUserId || terminalConfig?.terminal_user_id || "local"}
                />
              ) : section === "feedback" ? (
                <SupportFeedbackSection terminalUserId={terminalUserId} />
              ) : section === "research_contribution" ? (
                terminalConfig ? (
                  <ResearchContributionSection
                    terminalConfig={terminalConfig}
                    onTerminalConfigChange={(cfg) => onTerminalConfigChange?.(cfg)}
                  />
                ) : (
                  <p className="muted">{t("Загружаем настройки…", "Loading settings...")}</p>
                )
              ) : section === "updates" ? (
                <UpdateNotice />
              ) : section === "inbox" ? (
                <ModuleBundle
                  id="inbox"
                  enabled
                  commercial={terminalConfig?.org_type === "commercial"}
                />
              ) : section === "ai_subscription" ? (
                active ? (
                  <section className="card ai-subscription-active">
                    <h3>Подписка ИИ подключена</h3>
                    <p className="muted">
                      {sub.message || "Эксперт, архитектор и встроенные помощники в разделах доступны."}
                    </p>
                    <a
                      className="ai-paywall-cta"
                      href={sub.paywall_url || defaultPaywallUrl()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Управление подпиской
                    </a>
                  </section>
                ) : (
                  <AiSubscriptionPaywall
                    terminalUserId={terminalUserId}
                    compact={false}
                  />
                )
              ) : (
                <TerminalSetupFormSections
                  setup={setup}
                  section={section}
                  visibleSteps={sections}
                  locale={locale}
                  busy={setup.busy}
                  onJumpToSection={setSection}
                  isSettings={true}
                />
              )}
              {setup.error &&
                section !== "applications" &&
                section !== "specialist_profile" &&
                section !== "ai_subscription" &&
                section !== "feedback" &&
                section !== "research_contribution" &&
                section !== "updates" &&
                section !== "inbox" &&
                section !== "profile" && <p className="error">{setup.error}</p>}
              {section !== "applications" &&
                section !== "specialist_profile" &&
                section !== "ai_subscription" &&
                section !== "feedback" &&
                section !== "research_contribution" &&
                section !== "updates" &&
                section !== "inbox" &&
                section !== "profile" && (
                <div className="workspace-actions terminal-settings-actions">
                  <button type="button" className="primary" disabled={setup.busy} onClick={() => void handleSave()}>
                    {setup.busy ? "Сохраняем…" : "Сохранить"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
