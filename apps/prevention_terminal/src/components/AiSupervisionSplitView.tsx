import { useState } from "react";
import type { UnifiedProgressNote } from "../lib/progress_note.ts";
import { t } from "../lib/i18n.ts";

export interface SupervisionSplitViewProps {
  formalReport: UnifiedProgressNote | null;
  aiSupervision: any; // ai_supervision struct
  academyCards: any[]; // RAG results
  onApplyReport?: (report: UnifiedProgressNote) => void;
  onAskProfessor?: (card: any) => void;
  onClose?: () => void;
}

export default function SupervisionSplitView({
  formalReport,
  aiSupervision,
  academyCards,
  onApplyReport,
  onAskProfessor,
  onClose,
}: SupervisionSplitViewProps) {
  const [activeTab, setActiveTab] = useState<"report" | "supervision">("supervision");

  if (!formalReport && !aiSupervision) return null;

  return (
    <div className="supervision-split-view" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa", borderRadius: "8px", overflow: "hidden" }}>
      {/* Header Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", background: "#fff" }}>
        <button
          onClick={() => setActiveTab("supervision")}
          style={{
            flex: 1, padding: "12px", background: activeTab === "supervision" ? "#e3f2fd" : "transparent",
            border: "none", borderBottom: activeTab === "supervision" ? "3px solid #1976d2" : "3px solid transparent",
            fontWeight: activeTab === "supervision" ? "bold" : "normal", cursor: "pointer", color: "#1976d2"
          }}
        >
          {t("Супервизия и Обучение 🎓", "Supervision & Learning 🎓")}
        </button>
        <button
          onClick={() => setActiveTab("report")}
          style={{
            flex: 1, padding: "12px", background: activeTab === "report" ? "#e8f5e9" : "transparent",
            border: "none", borderBottom: activeTab === "report" ? "3px solid #2e7d32" : "3px solid transparent",
            fontWeight: activeTab === "report" ? "bold" : "normal", cursor: "pointer", color: "#2e7d32"
          }}
        >
          {t("Формальный Отчет 📄", "Formal Report 📄")}
        </button>
      </div>

      {/* Content Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* SUPERVISION TAB */}
        {activeTab === "supervision" && (
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", background: "#fff" }}>
            <h3 style={{ marginTop: 0, color: "#1565c0" }}>{t("Обратная связь ИИ-Супервизора", "AI Supervisor Feedback")}</h3>
            
            {aiSupervision?.clinical_red_flags && (
              <div style={{ padding: "12px", background: "#ffebee", color: "#c62828", borderRadius: "4px", marginBottom: "16px", border: "1px solid #ef9a9a" }}>
                <strong>⚠️ {t("Красный флаг:", "Red flag:")}</strong> {aiSupervision.clinical_red_flags}
              </div>
            )}
            
            {aiSupervision?.adherence_score !== undefined && (
              <div style={{ padding: "12px", background: "#e8f5e9", color: "#2e7d32", borderRadius: "4px", marginBottom: "16px", border: "1px solid #c8e6c9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>✅ {t("Соответствие протоколам:", "Protocol Adherence:")}</strong> 
                <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{aiSupervision.adherence_score} / 100</span>
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <strong>{t("Отмечаемые паттерны:", "Observed Patterns:")}</strong>
              <p>{aiSupervision?.noticed_patterns || t("Нет данных", "No data")}</p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <strong>{t("Вопросы для рефлексии (Сократический диалог):", "Reflection Questions (Socratic Dialogue):")}</strong>
              <p>{aiSupervision?.socratic_questions || t("Нет данных", "No data")}</p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <strong>{t("Зоны дефицита (рекомендации):", "Areas for Growth (Recommendations):")}</strong>
              <p>{aiSupervision?.learning_opportunities || t("Нет данных", "No data")}</p>
            </div>

            {academyCards && academyCards.length > 0 && (
              <div style={{ marginTop: "24px", borderTop: "1px solid #eee", paddingTop: "16px" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#455a64" }}>📚 {t("Рекомендуемые материалы Академии (workflow-learning)", "Recommended Academy Materials (workflow-learning)")}</h4>
                <div style={{ display: "grid", gap: "12px" }}>
                  {academyCards.map((card) => (
                    <div key={card.id} style={{ border: "1px solid #cfd8dc", padding: "12px", borderRadius: "6px", background: "#f5f7f8" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong>{card.title}</strong>
                          <span style={{ fontSize: "12px", color: "#78909c", marginLeft: "8px" }}>{card.axes}</span>
                        </div>
                        {onAskProfessor && (
                          <button 
                            onClick={() => onAskProfessor(card)}
                            style={{ background: "#1976d2", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                          >
                            💬 {t("Спросить Профессора", "Ask Professor")}
                          </button>
                        )}
                      </div>
                      <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#37474f" }}>{card.content_preview}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REPORT TAB */}
        {activeTab === "report" && (
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", background: "#fff" }}>
            <h3 style={{ marginTop: 0, color: "#2e7d32" }}>{t("Сгенерированный отчет (Формальная часть)", "Generated Report (Formal Part)")}</h3>
            <p style={{ fontSize: "13px", color: "#666" }}>
              {t("Этот текст пойдет в официальную карту клиента. Супервизия сюда не включена.", "This text goes into the client's official record. Supervision feedback is not included.")}
            </p>
            
            <div style={{ background: "#f1f8e9", padding: "16px", borderRadius: "4px", border: "1px solid #c5e1a5" }}>
              <div style={{ marginBottom: "12px" }}><strong>{t("Интервенции:", "Interventions:")}</strong><br/>{formalReport?.intervention_notes || (formalReport as any)?.interventions || (formalReport as any)?.intervention || "—"}</div>
              <div style={{ marginBottom: "12px" }}><strong>{t("Наблюдения:", "Observations:")}</strong><br/>{formalReport?.observations_notes || (formalReport as any)?.observations || "—"}</div>
              <div style={{ marginBottom: "12px" }}><strong>{t("Отклик / Оценка:", "Response / Assessment:")}</strong><br/>{formalReport?.assessmentResponse_notes || (formalReport as any)?.assessment || "—"}</div>
              <div style={{ marginBottom: "12px" }}><strong>{t("План:", "Plan:")}</strong><br/>{formalReport?.plan_notes || formalReport?.plan || "—"}</div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
              <button 
                onClick={() => onApplyReport && formalReport && onApplyReport(formalReport)}
                style={{ padding: "8px 16px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                ✓ {t("Применить к черновику", "Apply to draft")}
              </button>
              {onClose && (
                <button 
                  onClick={onClose}
                  style={{ padding: "8px 16px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                  {t("Отмена", "Cancel")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
