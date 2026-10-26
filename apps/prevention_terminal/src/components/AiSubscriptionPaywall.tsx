import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { isSubscriptionRequired } from "../lib/terminal_subscription.ts";
import AiSubscriptionCheckout from "./AiSubscriptionCheckout.tsx";

interface AiSubscriptionPaywallProps {
  context?: string;
  compact?: boolean;
  paywallUrl?: string;
  terminalUserId?: string;
  orgType?: string;
  soft?: boolean;
  onDismiss?: () => void;
}

export default function AiSubscriptionPaywall(props: AiSubscriptionPaywallProps) {
  const { context, compact, terminalUserId, orgType, soft, onDismiss } = props;
  const { sub, reload } = useTerminalSubscription(terminalUserId, orgType);

  if (sub?.active || !isSubscriptionRequired(orgType)) {
    return null;
  }

  return (
    <div className={`card ai-paywall${compact ? " ai-paywall-compact" : ""}`}>
      <AiSubscriptionCheckout
        context={context}
        compact={compact}
        partnerCheckoutUrl={props.paywallUrl || sub?.paywall_url}
        terminalUserId={terminalUserId}
        soft={soft}
        onDismiss={onDismiss}
        onActivated={reload}
      />
    </div>
  );
}
