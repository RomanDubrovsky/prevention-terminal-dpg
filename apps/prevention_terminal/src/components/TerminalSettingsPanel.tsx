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
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";

type SettingsTab =
  | SetupSection
  | "ai_subscription"
  | "feedback"
  | "research_contribution"
  | "inbox"
  | "updates"
  | "my_public_profile";

interface TerminalSettingsPanelProps {
  terminalUserId?: string;
  terminalConfig?: TerminalConfig;
  requestedSection?: "feedback" | "inbox" | null;
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
  const { sub, active } = useTerminalSubscription(terminalUserId);
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
    const base = [...sections] as SettingsTab[];
    if (setup.workspacePreset === "specialist") {
      base.push("my_public_profile");
    }
    base.push("research_contribution", "updates");
    return base;
  }, [sections, setup.workspacePreset, terminalUserId]);

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
            <h2>Настройки</h2>
            <p className="muted tiny">
              {terminalAppTitle()} ·{" "}
              {section === "ai_subscription"
                ? "Подписка ИИ"
                : section === "feedback"
                  ? "Обратная связь"
                  : section === "research_contribution"
                    ? "Вклад в науку"
                    : section === "updates"
                      ? "Обновления"
                      : section === "inbox"
                        ? "Заявки"
                        : setupSectionTitle(section)}
            </p>
          </div>
        </header>

        {!setup.loaded ? (
          <p className="muted">Загружаем настройки…</p>
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
                  {s === "ai_subscription"
                    ? "Подписка ИИ"
                    : s === "feedback"
                      ? "Обратная связь"
                      : s === "research_contribution"
                        ? "Вклад в науку"
                        : s === "updates"
                          ? "Обновления"
                          : s === "inbox"
                            ? "Заявки"
                            : s === "my_public_profile"
                              ? "Моя анкета"
                              : setupSectionTitle(s)}
                </button>
              ))}
            </nav>
            <div className="terminal-settings-content">
              {section === "my_public_profile" ? (
                <SpecialistPublicProfileSettings
                  centerId={setup.centerId ? (setup.centerId.startsWith("CTR-") ? setup.centerId.slice(4) : setup.centerId) : ""}
                  setupToken={setup.setupToken}
                  terminalUserId={terminalUserId || ""}
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
                  <p className="muted">Загружаем настройки…</p>
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
                section !== "ai_subscription" &&
                section !== "feedback" &&
                section !== "research_contribution" &&
                section !== "updates" &&
                section !== "inbox" && <p className="error">{setup.error}</p>}
              {section !== "ai_subscription" &&
                section !== "feedback" &&
                section !== "research_contribution" &&
                section !== "updates" &&
                section !== "inbox" && (
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
