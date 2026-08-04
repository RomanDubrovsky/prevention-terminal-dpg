import { defaultPaywallUrl } from "../lib/terminal_subscription.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { defaultCheckoutUrl } from "../lib/terminal_billing_client.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { t } from "../lib/i18n.ts";

interface AiSubscriptionIndicatorProps {
  terminalUserId?: string;
}

/** Header badge — parity with Teenology premium indicator. */
export default function AiSubscriptionIndicator(props: AiSubscriptionIndicatorProps) {
  const { terminalUserId } = props;
  const { sub, active, paywallUrl } = useTerminalSubscription(terminalUserId);
  const href = active
    ? paywallUrl || defaultPaywallUrl()
    : getTerminalEdition() === "ru"
      ? defaultCheckoutUrl()
      : paywallUrl || defaultPaywallUrl();
  const narrow = typeof window !== "undefined" && window.innerWidth <= 480;

  const label = active
    ? narrow
      ? t("Подписка", "Premium")
      : t("Подписка ИИ", "AI Subscription")
    : narrow
      ? t("Бесплатно", "Free")
      : t("ИИ без подписки", "Free Mode");

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`terminal-ai-status${active ? " is-active" : " is-free"}`}
      title={active ? sub.message || t("Подписка ИИ активна", "AI subscription active") : t("Подключить подписку ИИ", "Get AI Subscription")}
    >
      <span className="terminal-ai-status-dot" aria-hidden />
      {label}
    </a>
  );
}
