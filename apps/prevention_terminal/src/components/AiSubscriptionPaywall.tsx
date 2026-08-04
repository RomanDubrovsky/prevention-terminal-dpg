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
  const { active, reload } = useTerminalSubscription(terminalUserId);

  if (terminalUserId && active) return null;

  return (
    <div className={`card ai-paywall${compact ? " ai-paywall-compact" : ""}${soft ? " ai-paywall-soft" : ""}`}>
      <AiSubscriptionCheckout
      terminalUserId={terminalUserId}
      compact={compact}
      soft={soft}
      context={context}
      onDismiss={onDismiss}
      onActivated={() => void reload()}
    />
    </div>
  );
}
