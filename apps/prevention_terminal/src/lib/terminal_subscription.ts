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
  if (terminalUserId?.startsWith("tu-demo-")) {
    return {
      edition,
      active: true,
      paywall_url: defaultPaywallUrl(),
      message: "Демо-режим с активной подпиской ИИ.",
      features: { expert: true, architect: true, supervisor_bot: true, document_review: true },
    };
  }

  try {
    const tid = encodeURIComponent(terminalUserId || "");
    const res = await fetch(`${apiBase()}/api/terminal/subscription/status?terminal_user_id=${tid}&user_id=${tid}&edition=${encodeURIComponent(edition)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.warn("fetchTerminalSubscription failed:", res.status);
      return _mockInactive(edition);
    }
    const data = await res.json();
    if (data.ok && data.subscription) {
      return data.subscription as TerminalSubscriptionStatus;
    }
    return _mockInactive(edition);
  } catch (e) {
    console.error("fetchTerminalSubscription error:", e);
    return _mockInactive(edition);
  }
}

function _mockInactive(edition: string): TerminalSubscriptionStatus {
  return {
    edition,
    active: false,
    paywall_url: defaultPaywallUrl(),
    message: "Подписка не найдена или истекла.",
    features: {
      expert: false,
      architect: false,
      supervisor_bot: false,
      document_review: false,
    },
  };
}
