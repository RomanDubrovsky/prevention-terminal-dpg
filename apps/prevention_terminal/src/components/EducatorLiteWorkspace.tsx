import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import AiModesPanel from "./AiModesPanel.tsx";
import GlobalGuideButton from "./GlobalGuideButton.tsx";
import { lazy, Suspense } from "react";
const ObservationJournalWorkspace = lazy(() => import("./ObservationJournalWorkspace.tsx"));
const WebinarsWorkspace = lazy(() => import("./WebinarsWorkspace.tsx"));
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { defaultPaywallUrl } from "../lib/terminal_subscription.ts";
import { t } from "../lib/i18n.ts";

export interface EducatorLiteWorkspaceProps {
  onSwitchToPsychologist?: () => void;
}

/** Free educator preset: Observation screening + group session planner / situation review + parent meetings. */
export default function EducatorLiteWorkspace(_props: EducatorLiteWorkspaceProps = {}) {
  const [installId, setInstallId] = useState<string | undefined>();
  const [terminalUserId, setTerminalUserId] = useState<string | undefined>();
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const getInitialTab = (): "tools" | "webinars" | "observations" => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const mode = params.get("mode");
      if (tab === "tools" || tab === "observations" || tab === "webinars") {
        return tab;
      }
      if (mode === "webinar" || mode === "webinars" || mode === "events") {
        return "webinars";
      }
    }
    return "tools";
  };

  const [activeTab, setActiveTab] = useState<"tools" | "webinars" | "observations">(getInitialTab());

  useEffect(() => {
    let alive = true;
    Promise.all([
      invoke<InstallationMeta | null>("installation_get_meta"),
      invoke<TerminalConfig | null>("terminal_get_config"),
    ])
      .then(([meta, cfg]) => {
        if (!alive) return;
        setInstallId(meta?.install_id);
        setTerminalUserId(cfg?.terminal_user_id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleAiError = (code: string) => {
    if (code === "educator_rate_limited") {
      setRateLimitMsg(
        t(
          "Достигнут суточный лимит бесплатных запросов. Попробуйте завтра или обратитесь к школьному психологу за полным доступом.",
          "Daily free request quota reached. Try again tomorrow or contact your school psychologist for full access."
        ),
      );
      return;
    }
    if (code === "subscription_required") {
      setRateLimitMsg(t(`Для этого режима нужна подписка ИИ: ${defaultPaywallUrl()}`, `AI subscription required for this mode: ${defaultPaywallUrl()}`));
    }
  };

  const isEmbed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "true";

  return (
    <section className="card educator-lite" style={{ padding: isEmbed ? "0" : "1rem", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>{t("Рабочее место педагога / классного руководителя", "Educator / Homeroom Teacher Workspace")}</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            {t("Журнал первичных наблюдений за классом и конструктор профилактических занятий.", "Classroom behavioral observation screening and prevention session planner.")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", maxWidth: "100%" }}>
          <div className="ai-mode-tabs" style={{ display: "inline-flex", background: "var(--card-alt, rgba(0,0,0,0.05))", padding: "4px", borderRadius: "10px", gap: "4px", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
            <button
              type="button"
              className={activeTab === "tools" ? "active ob-btn primary" : "ob-btn secondary"}
              style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
              onClick={() => setActiveTab("tools")}
            >
              {t("🛠 Конструктор и разбор", "🛠 AI Planner & Review")}
            </button>
            <button
              type="button"
              className={activeTab === "webinars" ? "active ob-btn primary" : "ob-btn secondary"}
              style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
              onClick={() => setActiveTab("webinars")}
            >
              {t("🎙️ Родительские собрания", "🎙️ Parent Meetings")}
            </button>
            <button
              type="button"
              className={activeTab === "observations" ? "active ob-btn primary" : "ob-btn secondary"}
              style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
              onClick={() => setActiveTab("observations")}
            >
              {t("📝 Наблюдения", "📝 Observations")}
            </button>
          </div>
        </div>
      </div>

      {rateLimitMsg && <p className="error" style={{ marginBottom: "1rem" }}>{rateLimitMsg}</p>}

      {activeTab === "tools" && (
        <>
          <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
            {t(
              "ИИ-консультант для профилактики и разбора ситуаций, плюс конструктор профилактических групповых занятий (не план урока по предмету) с экспортом в Word (.docx). До 20 запросов в сутки на установку.",
              "AI assistant for prevention planning and situation analysis, plus prevention group session builder (not general subject lesson plans) with Word (.docx) export. Up to 20 queries/day per install."
            )}
          </p>
          <AiModesPanel
            documentContext=""
            enabled
            educatorLite
            installId={installId}
            terminalUserId={terminalUserId}
            onAiError={handleAiError}
          />
        </>
      )}

      {activeTab === "webinars" && (
        <div style={{ marginTop: "0.5rem" }}>
          <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>{t("Загрузка кабинета собраний...", "Loading meetings studio...")}</div>}>
            <WebinarsWorkspace
              cfg={{
                org_id: "",
                org_type: "school",
                terminal_user_id: terminalUserId || "tu-educator",
                language: "ru",
                node: "school-local",
                mode: "specialist",
                workspace_preset: "educator_lite",
                job_title: "Педагог",
                modules_enabled: ["webinars"],
              } as any}
              specialistName={t("Классный руководитель / Педагог", "Homeroom Teacher / Educator")}
              onLaunchStudio={(roomName) => {
                window.location.href = `?room=${encodeURIComponent(roomName)}&role=speaker&speaker=${encodeURIComponent(t("Классный руководитель", "Homeroom Teacher"))}`;
              }}
            />
          </Suspense>
        </div>
      )}

      {activeTab === "observations" && (
        <div style={{ marginTop: "0.5rem" }}>
           <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>{t("Загрузка журнала...", "Loading journal...")}</div>}>
             <ObservationJournalWorkspace cfg={{ org_id: "", org_type: "school", terminal_user_id: terminalUserId || "", language: "ru" }} />
           </Suspense>
        </div>
      )}

      <GlobalGuideButton
        activeView={activeTab === "tools" ? "educator_tools" : activeTab}
        cfg={{ org_id: "", org_type: "school", terminal_user_id: terminalUserId || "", language: "ru" } as any}
      />
    </section>
  );
}
