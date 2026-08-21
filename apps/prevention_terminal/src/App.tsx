/**
 * Корневой компонент Prevention Terminal (Unified).
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import MasterPasswordGate from "./components/MasterPasswordGate";
import IdaAuthGate from "./components/IdaAuthGate";
import SchoolWebGate from "./components/SchoolWebGate";
import EducatorLiteWorkspace from "./components/EducatorLiteWorkspace";
import AIAcademyWorkspace from "./components/AIAcademyWorkspace";
import SpecialistWorkspace from "./components/SpecialistWorkspace";
import ManagerWorkspace from "./components/ManagerWorkspace.tsx";
import UnifiedOnboardingWizard from "./components/UnifiedOnboardingWizard";
import AiSubscriptionIndicator from "./components/AiSubscriptionIndicator.tsx";
import type { InstallationMeta } from "./lib/installation_meta.ts";
import {
  isEducatorLite,
  isTerritorialManager,
  isTerminalConfigComplete,
  isTerminalModuleEnabled,
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
import { getTerminalEdition } from "./lib/terminal_edition.ts";
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
  return isTerminalModuleEnabled(cfg, id);
}

const isIdaHost = typeof window !== "undefined" && (window.location.hostname.includes("ida-psy.pro") || window.location.hostname.includes("ida-ai.chat") || window.location.hostname.includes("ida.chat"));
const isDemoUrlParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
const isSchoolWebHost = typeof window !== "undefined" && window.location.hostname === "web.prevention.school";
const hasBypassParam = isDemoUrlParam;

const idaAuthMode = (import.meta.env.VITE_IDA_AUTH_MODE === "supabase" || isIdaHost) && !hasBypassParam;
const schoolWebGateMode = isSchoolWebHost && !hasBypassParam;
const webStaging = isWebStaging() && !idaAuthMode && !schoolWebGateMode;
if (webStaging || hasBypassParam) {
  try {
    ensureDemoSeed();
  } catch {
    /* ignore seed errors on boot */
  }
}

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (hasBypassParam) return true;
    if (idaAuthMode) {
      return !!localStorage.getItem("platform_access_token");
    }
    return webStaging;
  });
  const [deepLinkMsg, setDeepLinkMsg] = useState<string | null>(null);
  const [installation, setInstallation] = useState<InstallationState>({
    kind: (webStaging || hasBypassParam || (idaAuthMode && isAuthorized)) ? "loading" : "idle",
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

        // Try automatic cloud account recovery by email before showing onboarding wizard
        const authEmail = localStorage.getItem("platform_email") || new URLSearchParams(window.location.search).get("email") || "";
        if (authEmail && authEmail.includes("@")) {
          try {
            const { lookupTerminalByEmail } = await import("./lib/federation_client.ts");
            const lookupResult = await lookupTerminalByEmail(authEmail);
            if (!alive) return;
            if (lookupResult.found && lookupResult.node) {
              const edition = getTerminalEdition();
              const restoredCfg = await invoke<TerminalConfig>("terminal_restore_config", {
                node: lookupResult.node,
                edition,
                contactEmail: authEmail,
              });
              if (!alive) return;
              const [restoredMeta, restoredOrg, restoredSpecialist] = await Promise.all([
                invoke<InstallationMeta | null>("installation_get_meta"),
                invoke<OrgProfile | null>("db_get_org_profile"),
                invoke<SpecialistProfile | null>("db_get_specialist_profile"),
              ]);
              if (!alive) return;
              if (restoredMeta && restoredOrg) {
                const specProf: SpecialistProfile = restoredSpecialist || {
                  display_name: restoredCfg.job_title || "",
                  role_text: restoredCfg.job_title || "",
                  weekly_contract_minutes: 0,
                  rate_type: "fixed",
                  rate_value: 0,
                };
                setInstallation({
                  kind: "ready",
                  meta: restoredMeta,
                  orgProfile: restoredOrg,
                  specialistProfile: specProf,
                  terminalConfig: restoredCfg,
                });
                return;
              }
            }
          } catch {
            /* ignore cloud lookup errors, fallback to wizard */
          }
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
  const isEmbedWorkspace = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "true";
  const activeTabParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab");

  if (isEmbedWorkspace && activeTabParam === "academy") {
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "none", border: "none", maxWidth: "none", overflow: "hidden" }}>
        <AIAcademyWorkspace aiSubscriptionActive={true} />
      </main>
    );
  }

  return (
    <main
      className={`terminal-shell${workspaceReady || isManager ? " terminal-shell--workspace" : onboarding ? " terminal-shell--onboarding" : ""}`}
      style={isEmbedWorkspace ? { position: "fixed" as const, inset: 0, padding: 0, margin: 0, background: "none", border: "none", maxWidth: "none", overflow: "hidden" } : undefined}
    >
      {webStaging && !isEmbedWorkspace && (
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
      {!isEmbedWorkspace && (
        <header className="terminal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1>{terminalAppTitle()}</h1>
            <p className="subtitle">
              {terminalWorkspaceSubtitle(
                isManager ? "manager" : educatorLite ? "educator_lite" : onboarding ? "onboarding" : "specialist",
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {isAuthorized && (
              <>
                {installation.kind === "ready" && workspaceReady && (
                  <AiSubscriptionIndicator terminalUserId={installation.terminalConfig.terminal_user_id} />
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title={t("Очищает локальную память браузера", "Clears local browser memory")}
                  onClick={() => {
                    if (window.confirm(t("Сбросить все сохранённые локально данные и вернуться к авторизации/настройке?", "Reset all locally saved data and return to setup?"))) {
                      resetStagingSetup();
                    }
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  🔄 {t("Сбросить настройки", "Reset Settings")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (window.confirm(t("Выйти из системы?", "Log out of the system?"))) {
                      localStorage.removeItem("platform_access_token");
                      localStorage.removeItem("platform_user_id");
                      localStorage.removeItem("platform_email");
                      window.location.reload();
                    }
                  }}
                  style={{
                    background: "rgba(100, 116, 139, 0.1)",
                    color: "#64748b",
                    border: "1px solid rgba(100, 116, 139, 0.3)",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  🚪 {t("Выйти", "Logout")}
                </button>
              </>
            )}

          </div>
        </header>
      )}

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
      ) : schoolWebGateMode ? (
        <SchoolWebGate onEnter={handleAuthorized} />
      ) : webStaging ? (
        <section className="card">
          <p className="muted">Загрузка staging…</p>
        </section>
      ) : idaAuthMode ? (
        <IdaAuthGate onAuthorized={handleAuthorized} />
      ) : (
        <MasterPasswordGate onAuthorized={handleAuthorized} />
      )}
    </main>
  );
}
