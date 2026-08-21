import { useCallback, useEffect, useState } from "react";

import { getTerminalEdition } from "./terminal_edition.ts";
import {
  defaultPaywallUrl,
  fetchTerminalSubscription,
  type TerminalSubscriptionStatus,
} from "./terminal_subscription.ts";
import { isWebStaging, readStagingAiPreview, STAGING_AI_PREVIEW_EVENT } from "./web_staging.ts";

const EMPTY: TerminalSubscriptionStatus = {
  edition: "ru",
  active: false,
  paywall_url: defaultPaywallUrl(),
  message: "Подписка ИИ не подключена.",
};

export function useTerminalSubscription(terminalUserId?: string) {
  const [sub, setSub] = useState<TerminalSubscriptionStatus>(EMPTY);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (import.meta.env.VITE_FORCE_PREMIUM === "true" || (isWebStaging() && readStagingAiPreview())) {
      setSub({
        edition: getTerminalEdition(),
        active: true,
        paywall_url: defaultPaywallUrl(),
        message: import.meta.env.VITE_FORCE_PREMIUM === "true" ? "Демо-режим с активной подпиской ИИ." : "Staging: превью экрана с активной подпиской ИИ.",
        features: {
          expert: true,
          architect: true,
          supervisor_bot: true,
          document_review: true,
        },
      });
      return;
    }
    if (!terminalUserId) {
      setSub(EMPTY);
      return;
    }
    setLoading(true);
    try {
      setSub(await fetchTerminalSubscription(terminalUserId));
    } catch {
      setSub({ ...EMPTY, paywall_url: defaultPaywallUrl() });
    } finally {
      setLoading(false);
    }
  }, [terminalUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!isWebStaging()) return;
    const handler = () => void reload();
    window.addEventListener(STAGING_AI_PREVIEW_EVENT, handler);
    return () => window.removeEventListener(STAGING_AI_PREVIEW_EVENT, handler);
  }, [reload]);

  return {
    sub,
    loading,
    reload,
    active: sub.active,
    paywallUrl: sub.paywall_url || defaultPaywallUrl(),
  };
}
