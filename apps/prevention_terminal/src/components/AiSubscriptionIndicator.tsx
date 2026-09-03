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
  return null;
}
