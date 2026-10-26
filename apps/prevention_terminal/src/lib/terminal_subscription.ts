import { getEditionConfig, getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";
import { isIdaProduct, isSchoolProduct } from "./terminal_product.ts";

export interface TerminalSubscriptionStatus {
  edition: string;
  active: boolean;
  paywall_url: string;
  message: string;
  is_trial?: boolean;
  trial_remaining?: number;
  trial_total?: number;
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
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("ida-psy.ru") || host.includes("ida-psy.pro")) {
      return `${window.location.origin}/`;
    }
  }
  const cfg = getEditionConfig();
  return cfg.paywall_url || cfg.distribution_url || "https://ida-psy.pro/";
}

/**
 * Determines whether the terminal requires an active paid AI subscription.
 * Subscription and paywalls are strictly for the commercial branch (ida-psy.pro, ida-psy.ru, IDA Kit).
 * On educational/school platforms (prevention.school, prevention-ai.ru) AI access is included without paywalls.
 */
export function isSubscriptionRequired(orgType?: string | null): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    // Non-commercial / school platform domains: never require subscription
    if (
      host.includes("prevention.school") ||
      host.includes("prevention-ai.ru") ||
      host.includes("academy") ||
      host.includes("teenology")
    ) {
      return false;
    }
    // Commercial IDA domains: always require subscription
    if (
      host.includes("ida-psy.pro") ||
      host.includes("ida-psy.ru") ||
      host.includes("ida-ai.chat") ||
      host.includes("ida.chat")
    ) {
      return true;
    }
  }

  // If built or targeted for IDA product
  if (isIdaProduct()) return true;
  if (isSchoolProduct()) return false;

  // Otherwise check explicit orgType or stored config
  const effOrgType =
    orgType ||
    (() => {
      if (typeof window === "undefined") return "";
      try {
        const stored = localStorage.getItem("terminal_config");
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.org_type || "";
        }
      } catch {
        // ignore
      }
      return "";
    })();

  return effOrgType === "commercial";
}

export async function fetchTerminalSubscription(
  terminalUserId: string,
  orgType?: string | null,
): Promise<TerminalSubscriptionStatus> {
  const edition = getTerminalEdition();
  if (!isSubscriptionRequired(orgType)) {
    return {
      edition,
      active: true,
      paywall_url: defaultPaywallUrl(),
      message: "Школьная служба: полный доступ к функциям ИИ активен.",
      features: { expert: true, architect: true, supervisor_bot: true, document_review: true },
    };
  }
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

export async function resetTerminalSubscription(terminalUserId?: string): Promise<boolean> {
  const tid = terminalUserId || (typeof localStorage !== "undefined" ? localStorage.getItem("platform_user_id") : "");
  if (!tid) return false;

  try {
    const res = await fetch(`${apiBase()}/api/terminal/subscription/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        terminal_user_id: tid,
        user_id: tid,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("resetTerminalSubscription error:", e);
    return false;
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
