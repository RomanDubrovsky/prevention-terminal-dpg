/**
 * Корневой компонент Prevention Terminal (Unified).
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import MasterPasswordGate from "./components/MasterPasswordGate";
import EducatorLiteWorkspace from "./components/EducatorLiteWorkspace";
import SpecialistWorkspace from "./components/SpecialistWorkspace";
import ManagerWorkspace from "./components/ManagerWorkspace.tsx";
import UnifiedOnboardingWizard from "./components/UnifiedOnboardingWizard";
import AiSubscriptionIndicator from "./components/AiSubscriptionIndicator.tsx";
import type { InstallationMeta } from "./lib/installation_meta.ts";
import {
  isEducatorLite,
  isTerritorialManager,
  isTerminalConfigComplete,
  type TerminalConfig,
} from "./lib/terminal_config.ts";
import { t } from "./lib/i18n.ts";
import {
  isOrgProfileComplete,
  isSpecialistProfileComplete,
  type OrgProfile,
  type SpecialistProfile,
} from "./lib/terminal_profiles.ts";
import { preloadEnabledModuleBundles } from "./lib/module_bundles.ts";
import { bootstrapEducatorLiteInstallation } from "./lib/bootstrap_educator_lite.ts";
import { resolveOnboardingEntry } from "./lib/onboarding_entry.ts";
import { terminalAppTitle, terminalWorkspaceSubtitle } from "./lib/terminal_branding.ts";
import { trySharedCaseDeepLink } from "./lib/shared_case_deeplink.ts";
import { maybeUploadResearchContribution } from "./lib/research_contribution.ts";
import { isWebStaging, readStagingAiPreview, resetStagingSetup, writeStagingAiPreview } from "./lib/web_staging.ts";
import {
  ensureDemoSeed,
  isDemoModeActive,
  readDemoWorkspace,
  reseedDemo,
  terminalDemoUrl,
} from "./lib/staging_demo_seed.ts";

type InstallationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "missing" }
  | {
      kind: "ready";
      meta: InstallationMeta;
      orgProfile: OrgProfile;
      specialistProfile: SpecialistProfile;
      terminalConfig: TerminalConfig;
    }
  | { kind: "error"; message: string };

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return cfg.enabled_modules[id] !== false;
}

const webStaging = isWebStaging();
if (webStaging) {
  try {
    ensureDemoSeed();
  } catch {
    /* ignore seed errors on boot */
  }
}

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState(webStaging);
  const [deepLinkMsg, setDeepLinkMsg] = useState<string | null>(null);
  const [installation, setInstallation] = useState<InstallationState>({
    kind: webStaging ? "loading" : "idle",
  });
  const [stagingAiPreview, setStagingAiPreview] = useState(() => readStagingAiPreview());

  useEffect(() => {
    document.title = terminalAppTitle();
  }, []);

  const handleAuthorized = useCallback(() => {
    setIsAuthorized(true);
    setInstallation({ kind: "loading" });
  }, []);

  useEffect(() => {
    if (!isAuthorized || installation.kind !== "loading") return;
    let alive = true;
    Promise.all([
      invoke<InstallationMeta | null>("installation_get_meta"),
      invoke<TerminalConfig | null>("terminal_get_config"),
      invoke<OrgProfile | null>("db_get_org_profile"),
      invoke<SpecialistProfile | null>("db_get_specialist_profile"),
    ])
      .then(async ([meta, terminalConfig, orgProfile, specialistProfile]) => {
        if (!alive) return;
        if (
          meta &&
          terminalConfig &&
          isTerminalConfigComplete(terminalConfig) &&
          orgProfile &&
          isOrgProfileComplete(orgProfile) &&
          specialistProfile &&
          isSpecialistProfileComplete(specialistProfile)
        ) {
          setInstallation({
            kind: "ready",
            meta,
            orgProfile,
            specialistProfile,
            terminalConfig,
          });
          return;
        }
        if (resolveOnboardingEntry().kind === "educator") {
          try {
            const payload = await bootstrapEducatorLiteInstallation();
            if (!alive) return;
            setInstallation({ kind: "ready", ...payload });
          } catch (err) {
            if (!alive) return;
            setInstallation({
              kind: "error",
              message: `Не удалось открыть кабинет педагога: ${String(err)}`,
            });
          }
          return;
        }
        setInstallation({ kind: "missing" });
      })
      .catch((err) => {
        if (!alive) return;
        setInstallation({
          kind: "error",
          message: `Не удалось загрузить данные установки: ${String(err)}`,
        });
      });
    return () => {
      alive = false;
    };
  }, [installation.kind, isAuthorized]);

  const cfg = installation.kind === "ready" ? installation.terminalConfig : null;

  useEffect(() => {
    if (installation.kind !== "ready" || !cfg) return;
    void preloadEnabledModuleBundles(cfg);
  }, [installation.kind, cfg?.terminal_user_id]);

  useEffect(() => {
    if (installation.kind !== "ready" || !cfg) return;
    if (!modEnabled(cfg, "consumer_app_link")) return;
    let alive = true;
    trySharedCaseDeepLink(cfg)
      .then((requestId) => {
        if (!alive || !requestId) return;
        setDeepLinkMsg(`Импорт из Teenology: заявка ${requestId}`);
      })
      .catch((err) => {
        if (!alive) return;
        setDeepLinkMsg(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [installation.kind, cfg?.terminal_user_id, cfg?.child_invite_code]);

  useEffect(() => {
    if (installation.kind !== "ready") return;
    const { terminalConfig, meta } = installation;
    if (!terminalConfig.research_contribution_enabled) return;
    let alive = true;
    void maybeUploadResearchContribution({ cfg: terminalConfig, meta }).then((result) => {
      if (!alive || !result.uploaded || !result.terminalConfig) return;
      setInstallation((prev) =>
        prev.kind === "ready" ? { ...prev, terminalConfig: result.terminalConfig! } : prev,
      );
    });
    return () => {
      alive = false;
    };
  }, [
    installation.kind,
    installation.kind === "ready"
      ? installation.terminalConfig.research_contribution_enabled
      : false,
    installation.kind === "ready"
      ? installation.terminalConfig.research_contribution_last_period_key
      : null,
    installation.kind === "ready" ? installation.terminalConfig.terminal_user_id : null,
  ]);

  const isManager = installation.kind === "ready" && installation.terminalConfig.mode === "manager";
  const educatorLite =
    installation.kind === "ready" && isEducatorLite(installation.terminalConfig);
  const territorialManager =
    installation.kind === "ready" && isTerritorialManager(installation.terminalConfig);
  const workspaceReady = installation.kind === "ready" && !isManager && !educatorLite;
  const onboarding = installation.kind === "missing";

  const demoMode = webStaging && isDemoModeActive();

  return (
    <main
      className={`terminal-shell${workspaceReady || isManager ? " terminal-shell--workspace" : onboarding ? " terminal-shell--onboarding" : ""}`}
    >
      {webStaging && (
        <div className={`staging-banner${demoMode ? " staging-banner--demo" : ""}`} role="note">
          <span className="staging-badge">{demoMode ? t("Демо", "Demo") : "Staging"}</span>
          {demoMode ? null : null}
          <label className="staging-ai-preview-toggle">
            <input
              type="checkbox"
              checked={stagingAiPreview}
              onChange={(e) => {
                const next = e.target.checked;
                writeStagingAiPreview(next);
                setStagingAiPreview(next);
              }}
            />
            <span>{t("Превью подписки ИИ", "AI Subscription Preview")}</span>
          </label>
          {demoMode ? (
            <button
              type="button"
              className="staging-reset-btn"
              onClick={() => {
                reseedDemo(readDemoWorkspace());
                window.location.href = terminalDemoUrl(readDemoWorkspace());
              }}
            >
              {t("Сбросить демо", "Reset Demo")}
            </button>
          ) : (
            <button
              type="button"
              className="staging-reset-btn"
              onClick={() => {
                if (window.confirm(t("Сбросить все данные staging и снова пройти визард настройки?", "Reset all staging data and run the onboarding wizard again?"))) {
                  resetStagingSetup();
                }
              }}
            >
              {t("Сбросить настройку", "Reset Setup")}
            </button>
          )}
        </div>
      )}
      <header className="terminal-header">
        <div>
          <h1>{terminalAppTitle()}</h1>
          <p className="subtitle">
            {terminalWorkspaceSubtitle(
              isManager ? "manager" : educatorLite ? "educator_lite" : onboarding ? "onboarding" : "specialist",
            )}
          </p>
        </div>
        {isAuthorized && (
          <div className="terminal-header-actions">
            {installation.kind === "ready" && workspaceReady && (
              <AiSubscriptionIndicator terminalUserId={installation.terminalConfig.terminal_user_id} />
            )}
          </div>
        )}
      </header>

      {isAuthorized ? (
        installation.kind === "loading" || installation.kind === "idle" ? (
          <section className="card">
            <p className="muted">Проверяем данные установки…</p>
          </section>
        ) : installation.kind === "missing" ? (
          <UnifiedOnboardingWizard onCompleted={(payload) => setInstallation({ kind: "ready", ...payload })} />
        ) : installation.kind === "error" ? (
          <section className="card">
            <h2>Не удалось открыть Терминал</h2>
            <p className="error">{installation.message}</p>
          </section>
        ) : (
          <>
            {isManager && installation.kind === "ready" && cfg ? (
              <ManagerWorkspace
                meta={installation.meta}
                orgProfile={installation.orgProfile}
                specialistProfile={installation.specialistProfile}
                terminalConfig={installation.terminalConfig}
                territorial={territorialManager}
                onConfigSaved={(payload) => setInstallation({ kind: "ready", ...payload })}
              />
            ) : educatorLite && cfg ? (
              <EducatorLiteWorkspace />
            ) : (
              installation.kind === "ready" && (
                <SpecialistWorkspace
                  meta={installation.meta}
                  orgProfile={installation.orgProfile}
                  specialistProfile={installation.specialistProfile}
                  terminalConfig={installation.terminalConfig}
                  deepLinkMsg={deepLinkMsg}
                  onConfigSaved={(payload) => setInstallation({ kind: "ready", ...payload })}
                />
              )
            )}
          </>
        )
      ) : webStaging ? (
        <section className="card">
          <p className="muted">Загрузка staging…</p>
        </section>
      ) : (
        <MasterPasswordGate onAuthorized={handleAuthorized} />
      )}
    </main>
  );
}
