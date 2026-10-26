import { useState, useEffect } from "react";
import {
  getCaseArtifacts,
  type CaseArtifactsPayload,
} from "../case_store.ts";

export function useCaseArtifacts(caseId: string | null, reloadDependency: any = null) {
  const [caseArtifacts, setCaseArtifacts] = useState<CaseArtifactsPayload>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) {
      setCaseArtifacts({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    getCaseArtifacts(caseId)
      .then((payload) => {
        if (!cancelled) {
          setCaseArtifacts(payload);
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
  }, [caseId, reloadDependency]);

  return { caseArtifacts, loading, error };
}
