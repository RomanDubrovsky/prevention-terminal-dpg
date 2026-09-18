import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../lib/i18n.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";

interface CaseAccompanimentPanelProps {
  caseId: string;
  appId?: string; // parent_navigator or ida
}

interface PassportBlock {
  [key: string]: any;
  risk_score?: number;
}

export default function CaseAccompanimentPanel({ caseId, appId = "parent_navigator" }: CaseAccompanimentPanelProps) {
  const [passport, setPassport] = useState<Record<string, PassportBlock> | null>(null);
  const [touchCount, setTouchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iprs, setIprs] = useState<any[]>([]);

  // Local URL for the API
  const apiUrl = "https://api.prevention.school/api"; // Default fallback
  const getApiBase = () => {
    // In Tauri we use a config, for simplicity fallback to the standard
    return localStorage.getItem("API_ENDPOINT") || apiUrl;
  };

  const getTerminalUserId = () => {
    // In terminal, the local specialist user ID is stored in terminal config
    try {
      const cfg = JSON.parse(localStorage.getItem("terminal_config") || "{}");
      return cfg.terminal_user_id || "terminal-unknown";
    } catch {
      return "terminal-unknown";
    }
  };

  const loadPassport = useCallback(async () => {
    setLoading(true);
    try {
      if (import.meta.env.VITE_TERMINAL_STAGING === "true") {
        const { readStagingStore } = await import("../lib/web_staging.ts");
        const store = readStagingStore();
        const visits = store.workLog.filter(w => w.case_id === caseId && w.action_kind === "consultation");
        const touchCount = visits.length;
        const mockPassport = touchCount > 0 ? {
          context: { note: "Демо-паспорт сгенерирован локально", risk_score: 1 },
          school: { note: "Адаптация в норме", risk_score: 0 }
        } : {};
        setPassport(mockPassport);
        setTouchCount(touchCount);
        setLoading(false);
        return;
      }
      
      const userId = getTerminalUserId();
      const res = await fetch(`${getApiBase()}/case/${caseId}/passport?userId=${userId}&app_id=${appId}&terminal_request=1`);
      const data = await res.json();
      if (data.ok) {
        setPassport(data.passport || {});
        setTouchCount(data.touch_count || 0);
      } else {
        setError(data.error || "Failed to load passport");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, appId]);

  const loadIprs = useCallback(async () => {
    try {
      if (import.meta.env.VITE_TERMINAL_STAGING === "true") {
        const { readStagingStore } = await import("../lib/web_staging.ts");
        const store = readStagingStore();
        setIprs(store.iprs.filter(i => (i as any).case_id === caseId));
        return;
      }

      const userId = getTerminalUserId();
      const res = await fetch(`${getApiBase()}/case/${caseId}/iprs?userId=${userId}&app_id=${appId}&terminal_request=1`);
      const data = await res.json();
      if (data.ok) {
        setIprs(data.iprs || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [caseId, appId]);

  useEffect(() => {
    void loadPassport();
    void loadIprs();
  }, [loadPassport, loadIprs]);

  if (loading) return <div className="card"><p>{t("Загрузка...", "Loading...")}</p></div>;
  if (error) return <div className="card"><p className="error">{error}</p></div>;

  const blocks = [
    { key: "context", label: "Контекст (Context)" },
    { key: "environment", label: "Среда (Environment)" },
    { key: "family", label: "Семья (Family)" },
    { key: "health", label: "Здоровье (Health)" },
    { key: "cognition", label: "Когнитивная сфера (Cognition)" },
    { key: "personality", label: "Личность (Personality)" },
    { key: "school", label: "Обучение (School)" },
    { key: "social", label: "Социум (Social)" },
    { key: "virtual", label: "Виртуальная среда (Virtual)" },
    { key: "delinquent", label: "Делинквентность (Delinquent)" },
    { key: "intervention_plan", label: "План (Intervention)" },
    { key: "implementation_eval", label: "Оценка (Evaluation)" },
  ];

  return (
    <div className="case-accompaniment-panel">
      <section className="card">
        <div className="case-workspace-active-head" style={{ marginBottom: "1rem" }}>
          <div>
            <h3>{t("Паспорт сопровождения", "Accompaniment Passport")}</h3>
            <p className="muted tiny">
              {t("Накоплено наблюдений: ", "Observations ingested: ")} <strong>{touchCount}</strong>
            </p>
          </div>
        </div>

        {touchCount === 0 && (
          <div className="empty-state">
            <p>{t("Паспорт пуст. Запишите наблюдения в журнале приёма, чтобы ИИ сформировал паспорт.", "Passport is empty. Record observations in the journal to ingest data.")}</p>
          </div>
        )}

        {touchCount > 0 && (
          <div className="case-passport-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {blocks.map(b => {
              const data = passport?.[b.key];
              if (!data) return null;
              return (
                <div key={b.key} className="passport-block" style={{ border: "1px solid var(--border-color)", padding: "1rem", borderRadius: "6px" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", display: "flex", justifyContent: "space-between" }}>
                    {b.label}
                    {data.risk_score !== undefined && (
                      <span style={{ color: data.risk_score > 2 ? "var(--color-danger)" : "var(--color-warning)" }}>
                        Risk: {data.risk_score}
                      </span>
                    )}
                  </h4>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.85em", background: "var(--bg-muted)", padding: "0.5rem" }}>
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {iprs.length > 0 && (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h3>{t("Сгенерированные программы", "Generated Programmes")}</h3>
          <ul className="case-workspace-examples-list">
            {iprs.map(ipr => (
              <li key={ipr.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border-color)" }}>
                <span><strong>{ipr.title}</strong> (v{ipr.version})</span>
                <span className="muted tiny">{new Date(ipr.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
