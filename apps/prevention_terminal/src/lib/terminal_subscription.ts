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

  // Testing stage: enable AI subscription for all users by default
  return {
    edition,
    active: true,
    paywall_url: defaultPaywallUrl(),
    message: "ИИ-Подписка активна (режим тестирования).",
    features: {
      expert: true,
      architect: true,
      supervisor_bot: true,
      document_review: true,
    },
  };
}
