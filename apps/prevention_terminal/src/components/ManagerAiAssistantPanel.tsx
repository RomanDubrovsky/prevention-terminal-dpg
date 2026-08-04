import { useEffect, useMemo, useState } from "react";

import AiModesPanel from "./AiModesPanel.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import { fetchManagerRollup } from "../lib/federation_client.ts";
import { MANAGER_AI_ANALYTICS_PROMPTS } from "../lib/manager_ai_prompts.ts";
import {
  fetchTerminalSubscription,
  type TerminalSubscriptionStatus,
} from "../lib/terminal_subscription.ts";

interface ManagerAiAssistantPanelProps {
  terminalUserId: string;
}

/**
 * Manager / territorial admin AI: visible bot + analytics actions.
 * Free rollup stats live in a separate card; AI attempts open a soft paywall.
 */
export default function ManagerAiAssistantPanel(props: ManagerAiAssistantPanelProps) {
  const { terminalUserId } = props;
  const [sub, setSub] = useState<TerminalSubscriptionStatus | null>(null);
  const [rollupJson, setRollupJson] = useState("");
  const [input, setInput] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallContext, setPaywallContext] = useState<string | null>(null);

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

  const tryAi = (context: string, draft?: string) => {
    if (active) return;
    openPaywall(context, draft);
  };

  if (active) {
    return (
      <AiModesPanel
        documentContext={documentContext}
        enabled
        supervisorOnly
        terminalUserId={terminalUserId}
      />
    );
  }

  return (
    <section className="card manager-ai-panel">
      <header className="manager-ai-header">
        <div>
          <h2>ИИ-аналитик для руководителя</h2>
          <p className="muted">
            Работает с агрегированными сводными данными (rollup) — без персональных данных (ПДн). Интерпретация метрик, консультации и рекомендации доступны по подписке ИИ.
          </p>
        </div>
        <span className="manager-ai-badge">ИИ · Подписка</span>
      </header>

      <div className="manager-ai-actions" role="group" aria-label="ИИ аналитика свода">
        <p className="manager-ai-actions-title">Сводная аналитика</p>
        <div className="manager-ai-actions-grid">
          {MANAGER_AI_ANALYTICS_PROMPTS.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              className="manager-ai-action-btn"
              title={prompt.hint}
              onClick={() =>
                tryAi(
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
        <span>Спросить ИИ-ассистента</span>
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Например: на что обратить внимание в сводке за этот месяц?"
        />
      </label>
      <button
        type="button"
        className="ob-btn manager-ai-send"
        onClick={() => {
          const text = input.trim();
          if (!text) {
            tryAi("Открыть диалог с ИИ-ассистентом супервизора для анализа сводных данных.");
            return;
          }
          tryAi("Диалог с ИИ-ассистентом супервизора по агрегированным сводным данным.", text);
        }}
      >
        Отправить ИИ-ассистенту
      </button>

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
