import { useState, useEffect, useMemo } from "react";
import {
  listRegistrySubjects,
  type RegistrySubjectSummary,
} from "../registry_store.ts";
import {
  sortRegistrySubjects,
  type PersonCardSort,
} from "../workspace_list_sort.ts";

export function useRegistrySubjects(registryEnabled: boolean, sort: PersonCardSort = "name_asc") {
  const [registrySubjects, setRegistrySubjects] = useState<RegistrySubjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!registryEnabled) {
      setRegistrySubjects([]);
      return;
    }
    
    let cancelled = false;
    setLoading(true);
    
    listRegistrySubjects()
      .then((rows) => {
        if (!cancelled) {
          setRegistrySubjects(rows);
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
  }, [registryEnabled]);

  const sortedRegistrySubjects = useMemo(
    () => sortRegistrySubjects(registrySubjects, sort),
    [registrySubjects, sort]
  );

  return { registrySubjects, sortedRegistrySubjects, loading, error };
}
