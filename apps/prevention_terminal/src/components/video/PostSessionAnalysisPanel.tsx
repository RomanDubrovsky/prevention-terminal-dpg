import { trackVideoEvent } from "../../lib/analytics.ts";
import React, { useState } from 'react';
import { t } from '../../lib/i18n.ts';

interface PostSessionData {
  formal_report?: {
    complaints?: string;
    hypothesis?: string;
    interventions?: string;
    client_reaction?: string;
    next_steps?: string;
  };
  ai_supervision?: string;
  client_handout?: string;
  adherence_score?: number;
  learning_opportunities?: string[];
  academy_cards?: any[];
}

interface PostSessionAnalysisPanelProps {
  data: PostSessionData;
  onPublishHandout?: (handoutText: string) => void;
  onApplyReport?: (report: any) => void;
  onClose?: () => void;
}

export default function PostSessionAnalysisPanel({
  data,
  onPublishHandout,
  onApplyReport,
  onClose,
}: PostSessionAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"request" | "supervision" | "academy" | "next">("request");
  const [handoutSent, setHandoutSent] = useState(false);
  const [exportingSimulation, setExportingSimulation] = useState(false);
  const [simulationExported, setSimulationExported] = useState(false);

  const report = data.formal_report || {};
  const academyCards = data.academy_cards || [];

  const tabStyle = (tab: string, color: string) => ({
    flex: 1,
    padding: "12px",
    background: activeTab === tab ? `${color}18` : "transparent",
    border: "none",
    borderBottom: activeTab === tab ? `3px solid ${color}` : "3px solid transparent",
    fontWeight: (activeTab === tab ? "bold" : "normal") as any,
    cursor: "pointer",
    color: color,
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px"
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#f8f9fa", borderRadius: "8px", overflow: "hidden", border: "1px solid #e0e0e0" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
          🎯 {t("Анализ видеосессии", "Video Session Analysis")}
        </h3>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#666" }}>&times;</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", background: "#fff", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("request")} style={tabStyle("request", "#1976d2")}>
          {t("📋 Анализ запроса", "📋 Request Analysis")}
        </button>
        <button onClick={() => setActiveTab("supervision")} style={tabStyle("supervision", "#7b1fa2")}>
          {t("🎓 Супервизия", "🎓 Supervision")}
        </button>
        <button onClick={() => setActiveTab("academy")} style={tabStyle("academy", "#e65100")}>
          {t("📚 Материалы Академии", "📚 Academy Materials")}
          {academyCards.length > 0 && (
            <span style={{ background: "#e65100", color: "#fff", borderRadius: "10px", padding: "2px 7px", fontSize: "0.75rem" }}>
              {academyCards.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("next")} style={tabStyle("next", "#2e7d32")}>
          {t("📝 К следующей встрече", "📝 Next Session")}
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "20px", background: "#fff", minHeight: "200px" }}>
        
        {/* TAB 1: Request Analysis */}
        {activeTab === "request" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <strong style={{ color: "#1565c0" }}>{t("Запрос / жалобы клиента:", "Client complaint / request:")}</strong>
              <p style={{ margin: "6px 0 0 0", lineHeight: "1.5" }}>{report.complaints || t("Нет данных", "No data")}</p>
            </div>
            <div>
              <strong style={{ color: "#1565c0" }}>{t("Гипотеза:", "Hypothesis:")}</strong>
              <p style={{ margin: "6px 0 0 0", lineHeight: "1.5" }}>{report.hypothesis || t("Нет данных", "No data")}</p>
            </div>
            <div>
              <strong style={{ color: "#1565c0" }}>{t("Применённые техники:", "Interventions used:")}</strong>
              <p style={{ margin: "6px 0 0 0", lineHeight: "1.5" }}>{report.interventions || t("Нет данных", "No data")}</p>
            </div>
            <div>
              <strong style={{ color: "#1565c0" }}>{t("Реакция клиента:", "Client reaction:")}</strong>
              <p style={{ margin: "6px 0 0 0", lineHeight: "1.5" }}>{report.client_reaction || t("Нет данных", "No data")}</p>
            </div>

            {onApplyReport && (
              <button
                onClick={() => onApplyReport(report)}
                style={{ alignSelf: "flex-start", padding: "8px 16px", background: "#1976d2", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                ✓ {t("Перенести в DAP-черновик", "Apply to DAP draft")}
              </button>
            )}
          </div>
        )}

        {/* TAB 2: Supervision */}
        {activeTab === "supervision" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {data.adherence_score !== undefined && (
              <div style={{ padding: "12px", background: "#e8f5e9", color: "#2e7d32", borderRadius: "4px", border: "1px solid #c8e6c9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>✅ {t("Соответствие протоколам:", "Protocol Adherence:")}</strong>
                <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{data.adherence_score} / 100</span>
              </div>
            )}

            <div>
              <strong style={{ color: "#6a1b9a" }}>{t("Обратная связь AI-супервизора:", "AI Supervisor Feedback:")}</strong>
              <div 
                style={{ margin: "8px 0 0 0", lineHeight: "1.6", whiteSpace: "pre-wrap" }}
                dangerouslySetInnerHTML={{ __html: (data.ai_supervision || t("Нет данных", "No data")).replace(/\n/g, "<br/>") }}
              />
            </div>

            {data.learning_opportunities && data.learning_opportunities.length > 0 && (
              <div>
                <strong style={{ color: "#6a1b9a" }}>{t("Рекомендации для обучения:", "Learning opportunities:")}</strong>
                <ul style={{ margin: "6px 0 0 16px", lineHeight: "1.5" }}>
                  {data.learning_opportunities.map((lo, i) => <li key={i}>{lo}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Academy Materials */}
        {activeTab === "academy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
              {t(
                "База Знаний Академии подобрала теоретические атомы, протоколы и упражнения под специфику данной сессии:",
                "Academy Knowledge Base suggested theoretical atoms, protocols, and exercises tailored to this session:"
              )}
            </p>

            {academyCards.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#888", background: "#fafafa", borderRadius: "6px" }}>
                {t("Материалы Академии для данного разбора пока не привязаны.", "No Academy materials mapped for this session yet.")}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {academyCards.map((card, idx) => (
                  <div 
                    key={card.id || idx}
                    style={{ 
                      border: "1px solid #ffe0b2", 
                      borderRadius: "8px", 
                      padding: "14px", 
                      background: "#fffaf0",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px", marginBottom: "6px" }}>
                        <strong style={{ color: "#e65100", fontSize: "0.95rem" }}>
                          📖 {card.title}
                        </strong>
                        {card.is_atom && (
                          <span style={{ fontSize: "0.7rem", background: "#ffcc80", color: "#e65100", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                            ATOM
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "#444", lineHeight: "1.4" }}>
                        {card.content_preview}
                      </p>
                    </div>
                    {card.axes && (
                      <div style={{ fontSize: "0.75rem", color: "#f57c00", marginTop: "6px", borderTop: "1px dashed #ffe0b2", paddingTop: "6px" }}>
                        🏷️ {card.axes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Export case to Academy Simulation Tool */}
            <div style={{ marginTop: "16px", padding: "16px", background: "#fff8e1", border: "1px dashed #ffb300", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <strong style={{ color: "#b78103", fontSize: "0.95rem" }}>
                    🎓 {t("Банк тренажеров Академии", "Academy Simulation Bank")}
                  </strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "#666" }}>
                    {t(
                      "Превратить обезличенный клинический опыт этой сессии в интерактивный тренажер для студентов Академии.",
                      "Convert the anonymized clinical experience of this session into an interactive simulator for Academy students."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={exportingSimulation || simulationExported}
                  onClick={async () => {
                    setExportingSimulation(true);
                    try {
                      const res = await fetch("https://api.prevention.school/api/terminal/video/export-simulation", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          transcript: report.complaints || "",
                          notes: (report.hypothesis || "") + " " + (report.interventions || ""),
                          formal_report: report
                        })
                      });
                      const json = await res.json();
                      if (json.ok) {
                        setSimulationExported(true);
                        alert(t("Кейс успешно преобразован в обезличенный симулятор для студентов Академии!", "Case successfully converted to Academy simulator!"));
                      } else {
                        alert(t("Ошибка экспорта симулятора: ", "Export error: ") + (json.error || ""));
                      }
                    } catch (e: any) {
                      alert(t("Ошибка сети: ", "Network error: ") + e.message);
                    } finally {
                      setExportingSimulation(false);
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    background: simulationExported ? "#2e7d32" : "#f57c00",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: simulationExported ? "default" : "pointer",
                    fontWeight: "bold",
                    fontSize: "0.85rem",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                  }}
                >
                  {simulationExported 
                    ? `✓ ${t("Добавлено в банк симуляций", "Added to simulation bank")}` 
                    : exportingSimulation 
                      ? `⏳ ${t("Генерация симулятора...", "Generating simulator...")}` 
                      : `⚡ ${t("Экспорт в тренажер Академии", "Export to Academy Simulator")}`}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* TAB 4: Next session + client handout */}
        {activeTab === "next" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <strong style={{ color: "#2e7d32" }}>{t("План на следующую сессию:", "Next session plan:")}</strong>
              <p style={{ margin: "6px 0 0 0", lineHeight: "1.5" }}>{report.next_steps || t("Нет данных", "No data")}</p>
            </div>

            {data.client_handout && (
              <div style={{ border: "1px solid #c8e6c9", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", background: "#e8f5e9", borderBottom: "1px solid #c8e6c9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#2e7d32" }}>📨 {t("Документ для клиента", "Client Handout")}</strong>
                  {onPublishHandout && !handoutSent && (
                    <button
                      onClick={() => {
                        onPublishHandout(data.client_handout!);
                        setHandoutSent(true);
                      }}
                      style={{ padding: "6px 14px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" }}
                    >
                      📤 {t("Отправить клиенту", "Send to client")}
                    </button>
                  )}
                  {handoutSent && (
                    <span style={{ color: "#2e7d32", fontSize: "0.85rem", fontWeight: "bold" }}>
                      ✓ {t("Отправлено", "Sent")}
                    </span>
                  )}
                </div>
                <div style={{ padding: "16px", background: "#fff", lineHeight: "1.6", fontSize: "0.92rem", whiteSpace: "pre-wrap" }}>
                  {data.client_handout}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

