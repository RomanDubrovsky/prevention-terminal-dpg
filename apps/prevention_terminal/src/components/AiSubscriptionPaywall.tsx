/** Shared AI subscription upsell — checkout block (RU: ИРПП / profilaktika-ai). */

import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import AiSubscriptionCheckout from "./AiSubscriptionCheckout.tsx";

interface AiSubscriptionPaywallProps {
  context?: string;
  compact?: boolean;
  paywallUrl?: string;
  terminalUserId?: string;
  soft?: boolean;
  onDismiss?: () => void;
}

export default function AiSubscriptionPaywall(props: AiSubscriptionPaywallProps) {
  const { context, compact, terminalUserId, soft, onDismiss } = props;
  return null;
}
