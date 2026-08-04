import { getEditionConfig, getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";
import { isIdaProduct } from "./terminal_product.ts";

export interface TerminalSubscriptionStatus {
  edition: string;
  active: boolean;
  paywall_url: string;
  message: string;
  features?: {
    expert?: boolean;
    architect?: boolean;
    supervisor_bot?: boolean;
    document_review?: boolean;
  };
}

function apiBase(): string {
  return platformApiBase();
}

export function defaultPaywallUrl(): string {
  const cfg = getEditionConfig();
  return cfg.paywall_url || cfg.distribution_url;
}

export async function fetchTerminalSubscription(
  terminalUserId: string,
): Promise<TerminalSubscriptionStatus> {
  const edition = getTerminalEdition();

  if (isIdaProduct()) {
    return {
      edition,
      active: true,
      paywall_url: defaultPaywallUrl(),
      message: "IDA Commercial active (Bypass during test).",
      features: {
        expert: true,
        architect: true,
        supervisor_bot: true,
        document_review: true,
      },
    };
  }

  const q = new URLSearchParams({
    terminal_user_id: terminalUserId,
    edition,
  });
  const res = await fetch(`${apiBase()}/api/terminal/subscription/status?${q.toString()}`);
  const data = (await res.json()) as {
    ok: boolean;
    subscription?: TerminalSubscriptionStatus;
    error?: string;
  };
  if (!data.ok || !data.subscription) {
    return {
      edition,
      active: false,
      paywall_url: defaultPaywallUrl(),
      message: "Подписка ИИ не подключена.",
    };
  }
  return data.subscription;
}
