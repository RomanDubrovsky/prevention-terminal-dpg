import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import AiModesPanel from "./AiModesPanel.tsx";
import { lazy, Suspense } from "react";
const AIAcademyWorkspace = lazy(() => import("./AIAcademyWorkspace.tsx"));
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { defaultPaywallUrl } from "../lib/terminal_subscription.ts";

/** Free educator preset: consultant bot + group session planner + Academy + Mnemonics. */
export default function EducatorLiteWorkspace() {
  const [installId, setInstallId] = useState<string | undefined>();
  const [terminalUserId, setTerminalUserId] = useState<string | undefined>();
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const getInitialTab = (): "tools" | "ai_assistant" | "academy" => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "tools" || tab === "ai_assistant" || tab === "academy") {
        return tab;
      }
    }
    return "tools";
  };

  const [activeTab, setActiveTab] = useState<"tools" | "ai_assistant" | "academy">(getInitialTab());

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

  if (isEmbed && activeTab === "academy") {
    return (
      <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>Загрузка Академии...</div>}>
        <AIAcademyWorkspace aiSubscriptionActive={true} />
      </Suspense>
    );
  }

  return (
    <section className="card educator-lite" style={{ padding: isEmbed ? "0" : "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>Школьная версия: Профилактика и Академия</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            Инструменты педагога, модуль ИИ-Мнемоники для освоения понятий и интерактивные лекции Академии.
          </p>
        </div>

        <div className="ai-mode-tabs" style={{ display: "inline-flex", background: "var(--card-alt, rgba(0,0,0,0.05))", padding: "4px", borderRadius: "10px", gap: "4px" }}>
          <button
            type="button"
            className={activeTab === "tools" ? "active ob-btn primary" : "ob-btn secondary"}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
            onClick={() => setActiveTab("tools")}
          >
            🛠 Конструктор и разбор
          </button>
          <button
            type="button"
            className={activeTab === "ai_assistant" ? "active ob-btn primary" : "ob-btn secondary"}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
            onClick={() => setActiveTab("ai_assistant")}
          >
            🤖 ИИ-Помощник и Мнемоника
          </button>
          <button
            type="button"
            className={activeTab === "academy" ? "active ob-btn primary" : "ob-btn secondary"}
            style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem" }}
            onClick={() => setActiveTab("academy")}
          >
            🎓 Академия ИИ
          </button>
        </div>
      </div>

      {rateLimitMsg && <p className="error" style={{ marginBottom: "1rem" }}>{rateLimitMsg}</p>}

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

      {activeTab === "ai_assistant" && (
        <div style={{ marginTop: "0.5rem" }}>
          <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
            Полный доступ к ИИ-консультанту и специализированному подрежиму <strong>«🧠 Мнемоника и термины»</strong> для легкого усвоения терминологии и методик профилактики.
          </p>
          <AiModesPanel
            documentContext=""
            enabled
            educatorLite={false}
            installId={installId}
            terminalUserId={terminalUserId}
            onAiError={handleAiError}
          />
        </div>
      )}

        {activeTab === "academy" && (
          <div style={{ height: "calc(100vh - 200px)", overflow: "hidden", marginTop: "0.5rem" }}>
            <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>Загрузка Академии...</div>}>
              <AIAcademyWorkspace aiSubscriptionActive={true} />
            </Suspense>
          </div>
        )}
    </section>
  );
}
