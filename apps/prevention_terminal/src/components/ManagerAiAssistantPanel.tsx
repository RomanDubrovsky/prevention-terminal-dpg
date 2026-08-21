import { useEffect, useMemo, useState } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";

import AiModesPanel from "./AiModesPanel.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import { fetchManagerRollup } from "../lib/federation_client.ts";
import { MANAGER_AI_ANALYTICS_PROMPTS } from "../lib/manager_ai_prompts.ts";
import {
  fetchTerminalSubscription,
  type TerminalSubscriptionStatus,
} from "../lib/terminal_subscription.ts";
import { t } from "../lib/i18n.ts";

interface ManagerAiAssistantPanelProps {
  terminalUserId: string;
  insightText?: string;
  commercial?: boolean;
  territorial?: boolean;
}

/**
 * Manager / territorial admin AI: unified block combining AI Analyst insights,
 * action buttons, scenario prompts, and AI Supervisor assistant/chat.
 */
export default function ManagerAiAssistantPanel(props: ManagerAiAssistantPanelProps) {
  const { terminalUserId, insightText, commercial, territorial } = props;
  const [sub, setSub] = useState<TerminalSubscriptionStatus | null>(null);
  const [rollupJson, setRollupJson] = useState("");
  const [input, setInput] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallContext, setPaywallContext] = useState<string | null>(null);
  const { handleKeyDown: onEnterKeyDown } = useSendOnEnter();

  useEffect(() => {
    let alive = true;
    fetchTerminalSubscription(terminalUserId)
      .then((data) => {
        if (alive) setSub(data);
      })
      .catch(() => {
        if (alive) setSub(null);
      });
    return () => {
      alive = false;
    };
  }, [terminalUserId]);

  useEffect(() => {
    let alive = true;
    fetchManagerRollup(terminalUserId)
      .then((rollup) => {
        if (!alive) return;
        setRollupJson(JSON.stringify({ role: "manager", rollup }, null, 2));
      })
      .catch(() => {
        if (alive) setRollupJson("");
      });
    return () => {
      alive = false;
    };
  }, [terminalUserId]);

  const documentContext = useMemo(
    () => rollupJson || JSON.stringify({ role: "manager", rollup: null }, null, 2),
    [rollupJson],
  );

  const active = sub?.active === true;

  const openPaywall = (context: string, draft?: string) => {
    if (draft) setInput(draft);
    setPaywallContext(context);
    setPaywallOpen(true);
  };

  const handleAction = (promptText: string, draftMsg?: string) => {
    if (active) {
      setInput(draftMsg || promptText);
    } else {
      openPaywall(promptText, draftMsg);
    }
  };

  const defaultInsight = insightText || t(
    "«Внимание: В центре 0 активных дел. Все заявки распределены, узких горлышек в воронке нет. Рекомендуем перенаправить новый трафик на специалистов с минимальной загрузкой.»",
    "\"Warning: There are 0 active cases. All requests are distributed, there are no bottlenecks in the funnel. We recommend redirecting new traffic to specialists with minimal load.\""
  );

  return (
    <section className="card manager-ai-panel" style={{ marginTop: "24px", border: "1px solid rgba(124, 58, 237, 0.3)" }}>
      <header className="manager-ai-header" style={{ marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
                color: "#ffffff",
                padding: "3px 10px",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: "800",
                letterSpacing: "0.04em",
                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.3)",
              }}
            >
              ✨ {t("ИИ-АНАЛИТИК И СУПЕРВИЗОР", "AI ANALYST & SUPERVISOR")}
            </span>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
              {t("Единый ИИ-Ассистент руководителя", "Unified Manager AI Assistant")}
            </h2>
          </div>
          <p className="muted tiny" style={{ margin: 0 }}>
            {t(
              "Сводный анализ нагрузок, показателей и персональный ИИ-супервизор без персональных данных (ПДн).",
              "Aggregated workload analysis, metrics, and personal AI supervisor without PII."
            )}
          </p>
        </div>
        <span className="manager-ai-badge">ИИ · Подписка</span>
      </header>

      {/* 1. Сводный инсайт ИИ-Аналитика */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(99, 102, 241, 0.04) 100%)",
          border: "1px solid rgba(124, 58, 237, 0.2)",
          padding: "16px 18px",
          borderRadius: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontSize: "1.1rem" }}>💡</span>
          <strong style={{ fontSize: "0.98rem", color: "#1e1b4b", fontWeight: 700 }}>
            {t("Сводный инсайт по центру:", "Summary insight for the center:")}
          </strong>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "0.92rem", color: "var(--text, #1f2937)", lineHeight: 1.55 }}>
          {defaultInsight}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <button
            type="button"
            style={{
              background: "#7c3aed",
              border: "none",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "bold",
              cursor: "pointer",
              color: "#ffffff",
              boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
              transition: "all 0.2s ease"
            }}
            onClick={() => handleAction(
              territorial 
                ? "Подготовить подробную макро-аналитическую справку на основе агрегированных данных территории" 
                : "Подготовить подробные рекомендации руководителю на основе инсайта дашборда", 
              territorial 
                ? "Аналитическая справка" 
                : "Подготовить рекомендации руководителю"
            )}
          >
            {territorial ? t("Аналитическая справка", "Analytical brief") : t("Подготовить рекомендации", "Prepare recommendations")}
          </button>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1.5px solid #7c3aed",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "bold",
              cursor: "pointer",
              color: "#7c3aed",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              transition: "all 0.2s ease"
            }}
            onClick={() => handleAction(
              territorial
                ? "Сформировать отчет или доклад для Министерства / высшего руководства"
                : "Сформировать итоговый отчет директору по сводным данным", 
              territorial
                ? "Доклад руководству"
                : "Сформировать отчет директору"
            )}
          >
            {territorial ? t("Доклад руководству", "Report for management") : t("Сформировать отчет директору", "Generate director report")}
          </button>
          {!commercial && (
            <button
              type="button"
              style={{
                background: "#ffffff",
                border: "1.5px solid #059669",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: "bold",
                cursor: "pointer",
                color: "#059669",
                transition: "all 0.2s ease"
              }}
              onClick={() => handleAction(
                territorial
                  ? "Разработать методические рекомендации и директивы для подведомственных образовательных учреждений"
                  : "Подготовить рекомендации для педагогического совета", 
                territorial
                  ? "Директива подведам"
                  : "Рекомендации педсовету"
              )}
            >
              {territorial ? t("Директивы подведам", "Directives for schools") : t("Рекомендации педсовету", "Recommendations for teachers' council")}
            </button>
          )}
        </div>
      </div>

      {/* 2. Интерактивный диалог ИИ-Супервизора */}
      {active ? (
        <AiModesPanel
          documentContext={documentContext}
          enabled
          supervisorOnly
          terminalUserId={terminalUserId}
          onAiError={(code) => {
            if (code === "subscription_required") {
              setPaywallContext(t("Интерпретация сводки дашборда и ИИ-аналитик доступны по подписке ИИ.", "Dashboard summary interpretation and AI analyst are available with AI subscription."));
              setPaywallOpen(true);
            }
          }}
        />
      ) : (
        <div style={{ paddingTop: "12px", borderTop: "1px dashed var(--border, #e2e8f0)" }}>
          <div className="manager-ai-actions" role="group" aria-label="ИИ аналитика свода">
            <p className="manager-ai-actions-title" style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-muted, #64748b)" }}>
              {t("Быстрые сценарии ИИ-анализа:", "Quick AI analysis scenarios:")}
            </p>
            <div className="manager-ai-actions-grid" style={{ marginBottom: "14px" }}>
              {MANAGER_AI_ANALYTICS_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className="manager-ai-action-btn"
                  title={prompt.hint}
                  onClick={() =>
                    handleAction(
                      `Запрос "${prompt.label}": супервизор анализирует агрегированные сводные данные дашборда и дает рекомендации руководителю.`,
                      prompt.message,
                    )
                  }
                >
                  <span className="manager-ai-action-label">{prompt.label}</span>
                  <span className="manager-ai-action-tag">ИИ</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field manager-ai-chat-field">
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, fontSize: "0.9rem" }}>
              <span>{t("Спросить ИИ-супервизора / аналитика:", "Ask AI Supervisor / Analyst:")}</span>
              <SendOnEnterToggle />
            </span>
            <span className="muted tiny" style={{ marginBottom: "6px", display: "block" }}>
              {t("Контекст дашборда (без персональных данных). Спросите о нагрузке, приоритетах или интерпретации сводки.", "Dashboard context (without personal data). Ask about workload, priorities, or summary interpretation.")}
            </span>
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => onEnterKeyDown(e, () => {
                const text = input.trim();
                if (!text) {
                  handleAction("Открыть диалог с ИИ-ассистентом супервизора для анализа сводных данных.");
                  return;
                }
                handleAction("Диалог с ИИ-ассистентом супервизора по агрегированным сводным данным.", text);
              })}
              placeholder={t("Вопрос или задача…", "Question or task…")}
            />
          </label>
          <button
            type="button"
            className="ob-btn manager-ai-send"
            style={{ marginTop: "10px" }}
            onClick={() => {
              const text = input.trim();
              if (!text) {
                handleAction("Открыть диалог с ИИ-ассистентом супервизора для анализа сводных данных.");
                return;
              }
              handleAction("Диалог с ИИ-ассистентом супервизора по агрегированным сводным данным.", text);
            }}
          >
            {t("Отправить ИИ-ассистенту", "Send to AI Assistant")}
          </button>
        </div>
      )}

      {paywallOpen && (
        <div className="manager-ai-paywall-wrap">
          <AiSubscriptionPaywall
            compact
            soft
            paywallUrl={sub?.paywall_url}
            terminalUserId={undefined}
            context={
              paywallContext ||
              "Супервизор: интерпретация сводки дашборда, приоритеты и рекомендации для руководителя."
            }
            onDismiss={() => setPaywallOpen(false)}
          />
        </div>
      )}
    </section>
  );
}

