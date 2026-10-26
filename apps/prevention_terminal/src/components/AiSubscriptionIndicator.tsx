import { useState } from "react";
import { isSubscriptionRequired } from "../lib/terminal_subscription.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { t } from "../lib/i18n.ts";
import AiSubscriptionCheckout from "./AiSubscriptionCheckout.tsx";

interface AiSubscriptionIndicatorProps {
  terminalUserId?: string;
  orgType?: string;
}

/**
 * Header badge — displays only for the commercial branch (IDA Psy on ida-psy.pro / ida-psy.ru or commercial center).
 * Hidden on educational/school platforms (prevention.school, prevention-ai.ru).
 * Clicking opens an interactive in-app modal instead of navigating to an external site.
 */
export default function AiSubscriptionIndicator(props: AiSubscriptionIndicatorProps) {
  const { terminalUserId, orgType } = props;

  if (!isSubscriptionRequired(orgType)) {
    return null;
  }

  const { sub, active, reload } = useTerminalSubscription(terminalUserId, orgType);
  const [showModal, setShowModal] = useState(false);
  const [showExtendCheckout, setShowExtendCheckout] = useState(false);
  const narrow = typeof window !== "undefined" && window.innerWidth <= 480;

  const isTrial = active && !!sub.is_trial;
  const trialRem = sub.trial_remaining ?? 5;
  const trialTot = sub.trial_total ?? 5;

  const label = active
    ? isTrial
      ? narrow
        ? `🎁 ${trialRem}/${trialTot}`
        : `🎁 ${trialRem}/${trialTot} AI-пробы`
      : narrow
        ? t("Pro: Активна", "Pro: Active")
        : t("Подписка Pro активна", "Pro: Active")
    : narrow
      ? t("Базовый", "Basic")
      : t("Подключить Pro", "Get Pro");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowExtendCheckout(false);
          setShowModal(true);
        }}
        className={`terminal-ai-status${active ? " is-active" : " is-free"}`}
        title={active ? sub.message || t("Подписка ИИ активна", "AI subscription active") : t("Подключить подписку ИИ", "Get AI Subscription")}
        style={{ cursor: "pointer", border: "none", font: "inherit" }}
      >
        <span className="terminal-ai-status-dot" aria-hidden />
        {label}
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--card-bg, #ffffff)",
              color: "var(--text, #1e293b)",
              borderRadius: "16px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border, #e2e8f0)",
              padding: "1.5rem",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {active ? (
                    isTrial ? (
                      <>
                        <span>🎁</span> {t(`Пробный доступ: осталось ${trialRem} из ${trialTot} AI-сессий`, `Gift trial: ${trialRem} of ${trialTot} AI sessions left`)}
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#059669" }}>✓</span> {t("Подписка Pro активна", "Pro Subscription Active")}
                      </>
                    )
                  ) : (
                    <>
                      <span>✨</span> {t("Подключение ИИ-Супервизора Pro", "Get AI Supervisor Pro")}
                    </>
                  )}
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted, #64748b)" }}>
                  {active
                    ? isTrial
                      ? t(`Вам начислено ${trialTot} подарочные AI-сессии. После их использования вы сможете подключить Pro без потери данных.`, `You have ${trialTot} gift AI sessions. Once used, you can upgrade to Pro without losing data.`)
                      : t("Полный профессиональный доступ ко всем возможностям ИИ в терминале.", "Full professional access to all AI features in the terminal.")
                    : t("Выберите удобный тариф для доступа к расширенным функциям ИИ.", "Choose a plan to access advanced AI capabilities.")}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "var(--muted, #64748b)",
                  lineHeight: 1,
                  padding: "0.25rem 0.5rem",
                }}
                title={t("Закрыть", "Close")}
              >
                ✕
              </button>
            </div>

            {active && !showExtendCheckout ? (
              <div>
                <div
                  style={{
                    backgroundColor: "rgba(5, 150, 105, 0.08)",
                    border: "1px solid rgba(5, 150, 105, 0.2)",
                    borderRadius: "12px",
                    padding: "1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#065f46", marginBottom: "0.5rem" }}>
                    {isTrial
                      ? t(`В подарочный доступ включены все возможности тарифа Pro (осталось ${trialRem} сессий):`, `All Pro features included in your gift trial (${trialRem} sessions left):`)
                      : t("Вам подключены возможности тарифа Pro:", "Active Pro features:")}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem", color: "#065f46", lineHeight: 1.6 }}>
                    <li><strong>🚨 SOS-подсказки</strong> во время видеоконсультаций в реальном времени</li>
                    <li><strong>🧠 Клинический ИИ-супервизор</strong> и глубокий анализ истории случая</li>
                    <li><strong>📝 Автогенерация отчетов</strong> (SOAP, супервизия, памятка для клиента)</li>
                    <li><strong>📄 Конструктор нормативных документов</strong> и экспорт в DOCX / PDF</li>
                    <li><strong>🔍 OCR-распознавание</strong> рукописных и бумажных записей</li>
                  </ul>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowExtendCheckout(true)}
                  >
                    {isTrial
                      ? t("Подключить Pro без лимитов", "Get Unlimited Pro")
                      : t("Продлить подписку / сменить тариф", "Extend subscription / Change plan")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowModal(false)}
                  >
                    {t("Понятно", "Got it")}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <AiSubscriptionCheckout
                  terminalUserId={terminalUserId}
                  compact={false}
                  onDismiss={() => setShowModal(false)}
                  onActivated={() => {
                    void reload();
                    setShowModal(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
