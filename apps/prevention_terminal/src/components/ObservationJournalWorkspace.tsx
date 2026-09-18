import React, { useState, useEffect } from "react";
import { TerminalConfig } from "../lib/terminal_config";
import { t } from "../lib/i18n";
import ModuleGuideModal from "./ModuleGuideModal";
import EmptyStateGuideCard from "./EmptyStateGuideCard";
import { listRegistrySubjects, RegistrySubjectSummary } from "../lib/registry_store";
import { getActiveObservationMetrics, ObservationMetric } from "../lib/observation_metrics_store";

interface ObservationJournalProps {
  cfg: TerminalConfig;
}

export default function ObservationJournalWorkspace({ cfg }: ObservationJournalProps) {
  const [subjects, setSubjects] = useState<RegistrySubjectSummary[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [requests, setRequests] = useState<Record<string, { requested: boolean; comment: string }>>({});
  const [showGuide, setShowGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [metrics, setMetrics] = useState<ObservationMetric[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const loaded = await listRegistrySubjects();
        setSubjects(loaded);
        setMetrics(getActiveObservationMetrics());
      } catch (err) {
        console.error("Failed to load subjects", err);
      }
    }
    void load();
  }, []);

  const toggleScore = (subjectId: string, metricId: string) => {
    setScores(prev => {
      const currentScore = prev[subjectId]?.[metricId] || 0;
      const nextScore = currentScore === 0 ? 1 : currentScore === 1 ? 2 : 0;
      return {
        ...prev,
        [subjectId]: {
          ...(prev[subjectId] || {}),
          [metricId]: nextScore
        }
      };
    });
  };

  const getScoreColor = (score: number) => {
    if (score === 1) return "#fef08a"; // yellow-200
    if (score === 2) return "#fecaca"; // red-200
    return "transparent";
  };

  const saveObservation = async () => {
    setSaving(true);
    setSaveMessage("");
    // Here we would normally sync with the backend / local DB
    // Simulate API call
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setSaveMessage(t("Данные наблюдения успешно сохранены и отправлены психологу.", "Observation data saved and sent to psychologist."));
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const [pinCode, setPinCode] = useState("");

  if (subjects.length === 0) {
    return (
      <div className="workspace-panel-stack">
        <section className="card workspace-journal-card" style={{ maxWidth: "500px", margin: "40px auto", textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ marginBottom: "12px" }}>{t("Доступ к журналу", "Journal Access")}</h2>
          <p className="muted" style={{ marginBottom: "24px", lineHeight: "1.5" }}>
            {t("Для соблюдения ФЗ-152 нам необходимо безопасно связать ваш терминал с базой психолога. Введите код вашего класса, полученный от школьного психолога.", "Enter the class code provided by the psychologist.")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <input 
              type="text" 
              placeholder="Код доступа (напр., 7А-1234)" 
              value={pinCode}
              onChange={e => setPinCode(e.target.value)}
              style={{ fontSize: "16px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", maxWidth: "300px", textAlign: "center", letterSpacing: "1px" }}
            />
            <button 
              className="ob-btn primary" 
              disabled={!pinCode.trim() || saving}
              onClick={async () => {
                setSaving(true);
                // Mock fetching roster by PIN
                setTimeout(async () => {
                   const { createRegistrySubject } = await import("../lib/registry_store");
                   const isComm = cfg.org_type === "commercial";

                   const cName = pinCode.includes("-") ? pinCode.split('-')[0] : "Класс";
                   await createRegistrySubject({ full_name: "Иванов Иван", grade_class: cName, date_of_birth: "", gender: "unknown", registry_group: "none", primary_problem: "Не указано", family_status: "not_specified" }, isComm);
                   await createRegistrySubject({ full_name: "Петрова Анна", grade_class: cName, date_of_birth: "", gender: "unknown", registry_group: "none", primary_problem: "Не указано", family_status: "not_specified" }, isComm);
                   const loaded = await listRegistrySubjects();
                   setSubjects(loaded);
                   setMetrics(getActiveObservationMetrics());
                   setSaving(false);
                }, 1000);
              }}
            >
              {saving ? t("Проверка...", "Checking...") : t("Загрузить список класса", "Load Class List")}
            </button>
          </div>
          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
            <p className="muted tiny">
              Нет кода? Обратитесь к школьному психологу.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="workspace-panel-stack">
      <section className="card workspace-journal-card">
        <div className="workspace-journal-head">
          <h2>{t("Журнал наблюдений (Скрининг группы риска)", "Observation Journal (Risk Screening)")}</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="header-guide-btn" onClick={() => setShowGuide(true)}>
              💡 {t("Как заполнять", "How to use")}
            </button>
            <button className="ob-btn success" style={{ background: "#166534", color: "white" }} onClick={saveObservation} disabled={saving}>
              {saving ? t("Сохранение...", "Saving...") : t("Отправить психологу", "Submit to Psychologist")}
            </button>
          </div>
        </div>

        {saveMessage && <p className="ok tiny">{saveMessage}</p>}

        <p className="muted tiny" style={{ marginBottom: "16px" }}>
          {t("Кликните по ячейке, чтобы оценить выраженность признака: Пусто (нет) → Желтый (слабо) → Красный (отчетливо).", "Click a cell to rate the indicator: Empty (no) → Yellow (weak) → Red (clear).")}
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>{t("Обучающийся", "Student")}</th>
                {metrics.map(m => (
                  <th key={m.id} style={{ padding: "8px", borderBottom: "2px solid #e2e8f0", maxWidth: "120px", fontSize: "11px", fontWeight: "normal" }} title={m.description}>
                    {m.title} {!m.isStandard && <span style={{ color: "#6d5bd0", fontWeight: "bold" }}>*</span>}
                  </th>
                ))}
                <th style={{ padding: "8px", borderBottom: "2px solid #e2e8f0", textAlign: "center", width: "95px" }}>{t("Сумма баллов", "Total Score")}</th>
                <th style={{ padding: "8px", borderBottom: "2px solid #e2e8f0", width: "220px", minWidth: "180px" }}>{t("Нужна помощь / Комментарий", "Needs Help / Comment")}</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => {
                const rowSum = metrics.reduce((acc, m) => acc + (scores[subject.case_id]?.[m.id] || 0), 0);
                return (
                  <tr key={subject.case_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px", fontWeight: 500 }}>
                      {subject.profile.full_name}
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{subject.profile.grade_class}</div>
                    </td>
                    {metrics.map(metric => {
                      const score = scores[subject.case_id]?.[metric.id] || 0;
                      return (
                        <td
                          key={metric.id}
                          onClick={() => toggleScore(subject.case_id, metric.id)}
                          style={{
                            padding: "8px",
                            textAlign: "center",
                            cursor: "pointer",
                            background: getScoreColor(score),
                            transition: "background 0.2s",
                            userSelect: "none"
                          }}
                          title={metric.description}
                        >
                          {score === 1 ? "1" : score === 2 ? "2" : ""}
                        </td>
                      );
                    })}
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: "28px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: rowSum === 0 ? "#f1f5f9" : rowSum <= 2 ? "#e2e8f0" : rowSum <= 4 ? "#fef3c7" : "#fee2e2",
                          color: rowSum === 0 ? "#64748b" : rowSum <= 2 ? "#334155" : rowSum <= 4 ? "#b45309" : "#dc2626",
                          border: rowSum >= 5 ? "1px solid #f87171" : "1px solid transparent"
                        }}
                        title={t(`Сумма баллов риска: ${rowSum}`, `Risk score sum: ${rowSum}`)}
                      >
                        {rowSum}
                      </span>
                    </td>
                    <td style={{ padding: "8px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: requests[subject.case_id]?.requested ? "#b91c1c" : "inherit", fontWeight: requests[subject.case_id]?.requested ? 600 : "normal", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={requests[subject.case_id]?.requested || false}
                            onChange={(e) => setRequests(prev => ({ ...prev, [subject.case_id]: { ...prev[subject.case_id], requested: e.target.checked } }))}
                          />
                          {t("Нужна помощь", "Needs Help")}
                        </label>
                        <textarea
                          placeholder={t("Пояснение к ситуации...", "Situation details...")}
                          value={requests[subject.case_id]?.comment || ""}
                          rows={requests[subject.case_id]?.comment ? Math.min(5, Math.max(2, (requests[subject.case_id]?.comment || "").split("\n").length)) : 1}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRequests(prev => ({ ...prev, [subject.case_id]: { ...prev[subject.case_id], comment: val } }));
                            e.target.style.height = "auto";
                            e.target.style.height = Math.max(34, Math.min(200, e.target.scrollHeight)) + "px";
                          }}
                          style={{
                            fontSize: "12px",
                            padding: "6px 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            width: "100%",
                            minHeight: "34px",
                            maxHeight: "200px",
                            resize: "vertical",
                            fontFamily: "inherit",
                            lineHeight: "1.4",
                            boxSizing: "border-box"
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      </section>

      <ModuleGuideModal
        moduleId="observation"
        isCommercial={false}
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onCtaClick={() => {}}
      />
    </div>
  );
}

