import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import AiModesPanel from "./AiModesPanel.tsx";
import { lazy, Suspense } from "react";
const ObservationJournalWorkspace = lazy(() => import("./ObservationJournalWorkspace.tsx"));
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { defaultPaywallUrl } from "../lib/terminal_subscription.ts";

/** Free educator preset: Observation screening + group session planner / situation review. */
export default function EducatorLiteWorkspace() {
  const [installId, setInstallId] = useState<string | undefined>();
  const [terminalUserId, setTerminalUserId] = useState<string | undefined>();
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const getInitialTab = (): "observations" | "tools" => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "tools" || tab === "observations") {
        return tab;
      }
    }
    return "observations";
  };

  const [activeTab, setActiveTab] = useState<"observations" | "tools">(getInitialTab());

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
        "Достигнут суточный лимит бесплатных запросов. Попробуйте завтра или обратитесь к школьному психологу за полным доступом.",
      );
      return;
    }
    if (code === "subscription_required") {
      setRateLimitMsg(`Для этого режима нужна подписка ИИ: ${defaultPaywallUrl()}`);
    }
  };

  const isEmbed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "true";

  return (
    <section className="card educator-lite" style={{ padding: isEmbed ? "0" : "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>Рабочее место педагога / классного руководителя</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            Журнал первичных наблюдений за классом и конструктор профилактических занятий.
          </p>
        </div>

        <div className="ai-mode-tabs" style={{ display: "inline-flex", background: "var(--card-alt, rgba(0,0,0,0.05))", padding: "4px", borderRadius: "10px", gap: "4px" }}>
          <button
            type="button"
            className={activeTab === "observations" ? "active ob-btn primary" : "ob-btn secondary"}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
            onClick={() => setActiveTab("observations")}
          >
            📝 Наблюдения
          </button>
          <button
            type="button"
            className={activeTab === "tools" ? "active ob-btn primary" : "ob-btn secondary"}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
            onClick={() => setActiveTab("tools")}
          >
            🛠 Конструктор и разбор
          </button>
        </div>
      </div>

      {rateLimitMsg && <p className="error" style={{ marginBottom: "1rem" }}>{rateLimitMsg}</p>}

      {activeTab === "observations" && (
        <div style={{ marginTop: "0.5rem" }}>
           <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>Загрузка журнала...</div>}>
             <ObservationJournalWorkspace cfg={{ org_id: "", org_type: "school", terminal_user_id: terminalUserId || "", language: "ru" }} />
           </Suspense>
        </div>
      )}

      {activeTab === "tools" && (
        <>
          <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
            ИИ-консультант для профилактики и разбора ситуаций, плюс конструктор <strong>профилактических</strong> групповых занятий (не план урока по предмету) с экспортом в Word (.docx). До 20 запросов в сутки на установку.
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
    </section>
  );
}
