import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorkLogEntry } from "../worklog.ts";

export function useWorklog(caseId: string | null) {
  const [caseVisits, setCaseVisits] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const reload = () => setReloadTrigger(prev => prev + 1);

  useEffect(() => {
    if (!caseId) {
      setCaseVisits([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    invoke<WorkLogEntry[]>("db_list_work_log_entries", { caseId })
      .then((rows) => {
        if (!cancelled) {
          setCaseVisits(rows.filter((r) => r.action_kind === "consultation"));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, reloadTrigger]);

  return { caseVisits, loading, error, reloadWorklog: reload };
}
