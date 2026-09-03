import { useEffect, useMemo, useState } from "react";

import AiModesPanel from "./AiModesPanel.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import { fetchManagerRollup } from "../lib/federation_client.ts";
import {
  fetchTerminalSubscription,
  type TerminalSubscriptionStatus,
} from "../lib/terminal_subscription.ts";

export interface SupervisorStats {
  case_count?: number;
  consultation_count?: number;
  work_minutes?: number;
}

interface SupervisorConsultantPanelProps {
  role: "manager" | "specialist";
  terminalUserId: string;
  stats?: SupervisorStats;
}

/** Supervisor bot with dashboard context; requires AI subscription. */
export default function SupervisorConsultantPanel(props: SupervisorConsultantPanelProps) {
  const { role, terminalUserId, stats } = props;
  const [sub, setSub] = useState<TerminalSubscriptionStatus | null>(null);
  const [rollupJson, setRollupJson] = useState<string>("");

  useEffect(() => {
    let alive = true;
    fetchTerminalSubscription(terminalUserId)
      .then((data) => {
        if (alive) setSub(data);
      })
      .catch(() => {
        if (alive) setSub(null);
      });
    return () => {
      alive = false;
    };
  }, [terminalUserId]);

  useEffect(() => {
    if (role !== "manager") return;
    let alive = true;
    fetchManagerRollup(terminalUserId)
      .then((rollup) => {
        if (!alive) return;
        setRollupJson(JSON.stringify({ role: "manager", rollup }, null, 2));
      })
      .catch(() => {
        if (alive) setRollupJson("");
      });
    return () => {
      alive = false;
    };
  }, [role, terminalUserId]);

  const documentContext = useMemo(() => {
    if (role === "manager" && rollupJson) return rollupJson;
    return JSON.stringify(
      {
        role: "specialist",
        workload: stats ?? { case_count: 0, consultation_count: 0, work_minutes: 0 },
      },
      null,
      2,
    );
  }, [role, rollupJson, stats]);

  const active = sub?.active === true;

  if (!active) {
    return (
      <AiSubscriptionPaywall
        paywallUrl={sub?.paywall_url}
        terminalUserId={terminalUserId}
        context={
          role === "manager"
            ? "Supervisor analyst: interpret dashboard rollups and recommend priorities for leadership."
            : "Supervisor assistant: review your workload and prevention practice recommendations."
        }
      />
    );
  }

  return (
    <AiModesPanel
      documentContext={documentContext}
      enabled
      supervisorOnly
      terminalUserId={terminalUserId}
    />
  );
}
