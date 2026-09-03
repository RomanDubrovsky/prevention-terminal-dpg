import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import { isCommercialOrg, situationKindLabel } from "../lib/case_meta.ts";
import { sanitizeNotes } from "../lib/case.ts";
import { buildCaseBrainContext } from "../lib/case_brain_context.ts";
import { exportAnonymousCaseBrief } from "../lib/case_supervision.ts";
import { appendDictatedChunk } from "../lib/ai_text_utils.ts";
import { listCaseAliasesLocal, participantMarker } from "../lib/case_participants.ts";
import { buildArchitectFileName, packArchitectDocx } from "../lib/architect_docx_export.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";

import { AI_NARRATIVE_HINT_CASE_REPORT } from "../lib/consultation_copy.ts";
import { getCaseArtifacts, saveCaseArtifacts, type CaseAiAnalysis } from "../lib/case_store.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { isTerminalModuleEnabled } from "../lib/terminal_config.ts";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import { CUSTOM_ACTIONS_PROMPTS } from "../lib/ai_prompts.ts";

import { t } from "../lib/i18n.ts";

interface CaseSituationViewProps {
  cfg: TerminalConfig;
  caseId: string;
  titleHint?: string;
  kindHint?: string;
  onBack: () => void;
  onNavigate: (view: SpecialistWorkspaceView) => void;
}

export default function CaseSituationView(props: CaseSituationViewProps) {
  const { cfg, caseId, titleHint, kindHint, onBack, onNavigate } = props;
  const commercial = isCommercialOrg(cfg);
  const { active: subscriptionActive } = useTerminalSubscription(cfg.terminal_user_id);

  const [title, setTitle] = useState(titleHint || "");
  const [kind, setKind] = useState(kindHint || "");
  const [caseNotes, setCaseNotes] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [sharingToken, setSharingToken] = useState<string | null>(null);
  const [hasConsultations, setHasConsultations] = useState(false);
  const [hasIpp, setHasIpp] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any>({});
  const [previewModalData, setPreviewModalData] = useState<{ title: string; text: string } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [aiAnalyses, setAiAnalyses] = useState<CaseAiAnalysis[]>([]);
  const [analysisExportBusy, setAnalysisExportBusy] = useState<string | null>(null);

  useEffect(() => {
    buildCaseBrainContext(caseId, { commercial }).then((ctx) => {
      setAiContext(ctx);
    }).catch((err) => {
      console.error("Failed to build case brain context", err);
    });
  }, [caseId, commercial]);

  async function handleExportSupervision() {
    setReportBusy(true);
    setReportError(null);
    setReportNotice(null);
    try {
      const token = await exportAnonymousCaseBrief(caseId, title);
      try {
        await navigator.clipboard.writeText(token);
        setReportNotice(t("Обезличенный токен супервизии скопирован в буфер обмена!", "Anonymous supervision token copied to clipboard!"));
      } catch {
        setSharingToken(token);
      }
    } catch (e: any) {
      setReportError(t("Не удалось экспортировать кейс: ", "Failed to export case: ") + (e.message || String(e)));
    } finally {
      setReportBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void getCaseArtifacts(caseId).then((payload) => {
      if (cancelled) return;
      setArtifacts(payload);
      setTitle(payload.situation_title || titleHint || "");
      setKind(String(payload.situation_kind || kindHint || ""));
      setCaseNotes(payload.situation_notes_append || "");
      setReportText(payload.situation_report?.text || "");
      setAiAnalyses(payload.ai_analyses || []);
    });

    void Promise.all([
      invoke<any[]>("db_list_session_records", { caseId }).then((rows) => rows.length > 0).catch(() => false),
      invoke<any[]>("db_list_iprs", { caseId }).then((rows) => rows.length > 0).catch(() => false),
      listCaseAliasesLocal(caseId).catch(() => []),
    ]).then(([hasCons, hasIprRec, plist]) => {
      if (cancelled) return;
      setHasConsultations(hasCons);
      setHasIpp(hasIprRec);
      setParticipants(plist);
    });

    return () => {
      cancelled = true;
    };
  }, [caseId, kindHint, titleHint]);

  const handleSaveNotes = useCallback(async () => {
    try {
      const cleaned = sanitizeNotes(caseNotes).sanitizedText.trim();
      await saveCaseArtifacts(caseId, {
        situation_notes_append: cleaned || undefined,
      });
      setCaseNotes(cleaned);
      setReportNotice(t("Контекст дела сохранён (ПДн в заметках очищены).", "Case context saved (PII in notes cleared)."));
    } catch (e) {
      setReportError(e instanceof Error ? e.message : String(e));
    }
  }, [caseId, caseNotes]);

  const handleSaveAnalysis = useCallback(async (label: string, text: string) => {
    const entry: CaseAiAnalysis = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label,
      text,
      saved_at: new Date().toISOString(),
    };
    setAiAnalyses((prev) => [...prev, entry]);
    try {
      await saveCaseArtifacts(caseId, { ai_analyses: [entry] });
    } catch (e) {
      console.error("Failed to save analysis entry", e);
    }
  }, [caseId]);

  async function handleDownloadAnalysis(entry: CaseAiAnalysis) {
    if (analysisExportBusy) return;
    setAnalysisExportBusy(entry.id);
    try {
      const buffer = await packArchitectDocx({
        title: entry.label,
        segments: {},
        rawFallback: entry.text,
      });
      const targetPath = await save({
        defaultPath: buildArchitectFileName("case_analysis"),
        filters: [{ name: "Word document", extensions: ["docx"] }],
      });
      if (targetPath) {
        await invoke("save_docx", {
          targetPath,
          base64Data: arrayBufferToBase64(buffer),
        });
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalysisExportBusy(null);
    }
  }


  async function handleExportWord() {
    if (!reportText || exportBusy) return;
    setExportBusy(true);
    setReportError(null);
    try {
      const buffer = await packArchitectDocx({
        title: t("Итоговое заключение по делу", "Final case conclusion"),
        segments: {},
        rawFallback: reportText,
      });
      const targetPath = await save({
        defaultPath: buildArchitectFileName("case_report"),
        filters: [{ name: "Word document", extensions: ["docx"] }],
      });
      if (targetPath) {
        await invoke("save_docx", {
          targetPath,
          base64Data: arrayBufferToBase64(buffer),
        });
        setReportNotice(t("Файл Word успешно сохранен!", "Word file saved successfully!"));
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="case-situation-view">
      <section className="card case-situation-card">
        <div className="case-workspace-active-head" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>{title || t("Кейс", "Case")}</h2>
            {kind ? <p className="muted tiny">{situationKindLabel(kind, commercial)}</p> : null}
          </div>
          <div className="group-session-editor-actions" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button type="button" className="ob-btn secondary" onClick={onBack}>
              {t("← К списку", "← Back to list")}
            </button>
            <button
              type="button"
              className="ob-btn secondary"
              disabled={reportBusy}
              onClick={() => void handleExportSupervision()}
              title={t("Скопировать анонимный токен кейса для супервизии", "Copy anonymous case token for supervision")}
            >
              🔗 {reportBusy ? t("Экспорт...", "Exporting...") : t("Поделиться (Супервизия)", "Share (Supervision)")}
            </button>
          </div>
        </div>

        {/* Participants and Traces Section */}
        {participants.length > 0 && (
          <div className="case-participants-traces" style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
            <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem" }}>👥 {t("Участники и следы по системе", "Participants and Traces")}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {/* Общее по делу */}
              {artifacts.expert && Object.keys(artifacts.expert).some(k => artifacts.expert[k]?.text?.trim()) && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.5rem", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <div>
                    <strong>{t("Общее по делу", "General Case Info")}</strong>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {[
                      { id: "child_profile", label: t("Характеристика", "Profile") },
                      { id: "conclusion", label: "025/у" },
                      { id: "fba", label: t("ФАП", "FBA") },
                      { id: "bip", label: "BIP" },
                      { id: "mdr", label: t("ППк", "MDR") },
                      { id: "audit", label: t("Аудит", "Audit") },
                    ].map((proto) => {
                      const text = artifacts.expert?.[proto.id]?.text;
                      if (!text?.trim()) return null;
                      return (
                        <button
                          key={proto.id}
                          type="button"
                          className="ob-btn secondary tiny"
                          style={{ border: "1px solid #10b981", color: "#065f46" }}
                          onClick={() => setPreviewModalData({ title: `${proto.label} — ${t("Общее по делу", "General Case Info")}`, text })}
                        >
                          {proto.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Участники */}
              {participants.map((p) => {
                const pExpert = artifacts.expert_by_participant?.[p.alias_id];
                
                return (
                  <div key={p.alias_id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.5rem", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong>{participantMarker(p.role, p.role_no)}</strong>
                      {p.real_name && <span className="muted">({p.real_name})</span>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {hasConsultations && (
                        <button
                          type="button"
                          className="ob-btn secondary tiny"
                          onClick={() => onNavigate("consultations")}
                        >
                          {t("Консультации", "Consultations")}
                        </button>
                      )}
                      {isTerminalModuleEnabled(cfg, "ipp") && hasIpp && (
                        <button
                          type="button"
                          className="ob-btn secondary tiny"
                          onClick={() => onNavigate("ipr")}
                        >
                          {t("IPP", "IPP")}
                        </button>
                      )}
                      {[
                        { id: "child_profile", label: t("Характеристика", "Profile") },
                        { id: "conclusion", label: "025/у" },
                        { id: "fba", label: t("ФАП", "FBA") },
                        { id: "bip", label: "BIP" },
                        { id: "mdr", label: t("ППк", "MDR") },
                        { id: "audit", label: t("Аудит", "Audit") },
                      ].map((proto) => {
                        const text = pExpert?.[proto.id]?.text;
                        if (!text?.trim()) return null;
                        return (
                          <button
                            key={proto.id}
                            type="button"
                            className="ob-btn secondary tiny"
                            style={{ border: "1px solid #10b981", color: "#065f46" }}
                            onClick={() => setPreviewModalData({ title: `${proto.label} — ${participantMarker(p.role, p.role_no)}`, text })}
                          >
                            {proto.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!(hasConsultations || hasIpp || (artifacts.expert && Object.keys(artifacts.expert).some(k => artifacts.expert[k]?.text?.trim())) || (artifacts.expert_by_participant && Object.keys(artifacts.expert_by_participant).some(aliasId => {
          const pExpert = artifacts.expert_by_participant[aliasId];
          return pExpert && Object.keys(pExpert).some(k => pExpert[k]?.text?.trim());
        }))) && (
          <div style={{ marginBottom: "2rem", padding: "1rem", border: "1px dashed var(--border-color)", borderRadius: "6px", backgroundColor: "rgba(0,0,0,0.01)", textAlign: "center" }}>
            <p className="muted tiny" style={{ margin: 0 }}>🌱 <strong>{t("Начало работы по делу:", "Starting case:")}</strong> {t("у участников пока нет сессий, планов сопровождения или экспертиз.", "participants don't have sessions, support plans, or assessments yet.")}</p>
          </div>
        )}

        <div className="case-situation-card-body">
          <label className="field intake-field wide">
            <span className="muted tiny">{AI_NARRATIVE_HINT_CASE_REPORT}</span>
            <textarea
              rows={5}
              value={caseNotes}
              onChange={(e) => setCaseNotes(e.target.value)}
              placeholder={t("Контекст кейса, наблюдения по участникам, что уже сделано…", "Case context, participant observations, actions taken so far...")}
            />
            <div className="workspace-actions">
              <SpeechDictationButton
                onText={(chunk) => setCaseNotes((prev) => appendDictatedChunk(prev, chunk))}
              />
              <button type="button" className="ob-btn secondary" onClick={() => void handleSaveNotes()}>
                {t("Сохранить заметки", "Save notes")}
              </button>
            </div>
          </label>

          {/* AI Case Copilot (Chat) */}
          <div className="ai-case-copilot" style={{ marginTop: "2rem", borderTop: "2px solid var(--border-color)", paddingTop: "2rem", gridColumn: "span 2" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>🤖 {t("ИИ-Копилот дела", "AI Case Copilot")}</h3>
            {reportNotice && <p className="ok tiny" style={{ padding: "0.5rem", backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: "4px" }}>{reportNotice}</p>}
            {reportError && <p className="error tiny" style={{ padding: "0.5rem", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "4px" }}>{reportError}</p>}

            <div className="case-ai-panel" style={{ flex: 1, minWidth: "300px" }}>
              <DocumentSmartChat
                terminalUserId={cfg.terminal_user_id}
                subscriptionActive={subscriptionActive}
                paywallUrl={""}
                category="consultation"
                documentContext={aiContext + (caseNotes ? `\n\nДоп. заметки: ${caseNotes}` : "")}
                cardSaved={true}
                aiLockedReason={t("Необходима подписка.", "Subscription required.")}
                onApplyResult={async (stage, text) => {
                  if (stage === "report") {
                    setReportText(text);
                    void saveCaseArtifacts(caseId, {
                      situation_report: { text, saved_at: new Date().toISOString() }
                    });
                  }
                }}
                showPlanButton={false}
                showFillCardButton={false}
                showReportButton={true}
                reportButtonLabel={t("📄 Сформировать итоговое заключение", "📄 Generate final conclusion")}
                customActions={[
                  {
                    id: "quick_synth",
                    label: t("🔍 Быстрый синтез ИИ", "🔍 Quick AI Synthesis"),
                    hint: t("Профессиональный психологический синтез ситуации", "Professional psychological synthesis of the situation"),
                    prompt: CUSTOM_ACTIONS_PROMPTS.case_synthesis,
                  },
                  {
                    id: "role_analysis",
                    label: t("⚠️ Анализ ролей и рисков", "⚠️ Analysis of Roles & Risks"),
                    hint: t("Глубокий клинический анализ ролей и скрытых рисков", "Deep clinical analysis of roles and hidden risks"),
                    prompt: CUSTOM_ACTIONS_PROMPTS.case_roles,
                  }
                ]}
                onAnalysisSaved={handleSaveAnalysis}
              />

              {/* Generated Report Preview & Word Export */}
              {reportText && (
                <div className="report-preview-section" style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "rgba(13, 148, 136, 0.05)", marginBottom: "2rem" }}>
                  <h4 style={{ margin: "0 0 1rem 0", color: "#0d9488" }}>📝 {t("Итоговое заключение по делу (предпросмотр)", "Final case conclusion (preview)")}</h4>
                  <textarea
                    className="wide"
                    rows={15}
                    value={reportText}
                    onChange={(e) => {
                      setReportText(e.target.value);
                      void saveCaseArtifacts(caseId, {
                        situation_report: { text: e.target.value, saved_at: new Date().toISOString() }
                      });
                    }}
                    style={{ width: "100%", padding: "1rem", borderRadius: "6px", border: "1px solid var(--border-color)", fontFamily: "monospace", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "1rem" }}
                  />
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button
                      type="button"
                      className="ob-btn success"
                      style={{ background: "#0d9488", color: "white" }}
                      disabled={exportBusy}
                      onClick={() => void handleExportWord()}
                    >
                      {exportBusy ? t("Экспорт...", "Exporting...") : t("💾 Скачать Word (.docx)", "💾 Download Word (.docx)")}
                    </button>
                    <p className="muted tiny" style={{ alignSelf: "center" }}>
                      {t("Вы можете отредактировать текст перед экспортом или попросить ИИ в чате изменить формулировки.", "You can edit the text before exporting or ask the AI in the chat to rephrase it.")}
                    </p>
                  </div>
                </div>
              )}

              {/* History of AI analyses & conclusions */}
              {aiAnalyses.length > 0 && (
                <div className="case-ai-analyses-history" style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                  <h4 style={{ margin: "0 0 0.8rem 0", fontSize: "0.95rem" }}>📋 {t("История анализов и заключений", "History of Analyses & Conclusions")}</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {[...aiAnalyses].reverse().map((entry) => {
                      const dt = new Date(entry.saved_at);
                      const dateStr = dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
                      const timeStr = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div
                          key={entry.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            padding: "0.6rem 0.8rem",
                            background: "rgba(0,0,0,0.02)",
                            borderRadius: "6px",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{entry.label}</span>
                            <span className="muted tiny">{dateStr} {timeStr}</span>
                          </div>
                          <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                            <button
                              type="button"
                              className="ob-btn secondary tiny"
                              onClick={() => setPreviewModalData({ title: entry.label, text: entry.text })}
                            >
                              {t("👁 Просмотр", "👁 View")}
                            </button>
                            <button
                              type="button"
                              className="ob-btn secondary tiny"
                              disabled={analysisExportBusy === entry.id}
                              onClick={() => void handleDownloadAnalysis(entry)}
                            >
                              {analysisExportBusy === entry.id ? "..." : "💾 .docx"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {showPaywall && (
              <AiSubscriptionPaywall
                soft
                terminalUserId={cfg.terminal_user_id}
                context={t("Отчёт по кейсу — по подписке ИИ.", "Case report — via AI subscription.")}
                onDismiss={() => setShowPaywall(false)}
              />
            )}
          </div>
        </div>

        {sharingToken && (
          <div className="modal-backdrop" style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}>
            <div className="modal-window" style={{
              maxWidth: "500px",
              width: "90%",
              backgroundColor: "var(--background-color, #fff)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "1.5rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}>
              <div className="modal-header" style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
              }}>
                <h3 style={{ margin: 0 }}>{t("Токен для супервизии", "Supervision Token")}</h3>
                <button type="button" className="close-btn" onClick={() => setSharingToken(null)} style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--text-color)",
                }}>&times;</button>
              </div>
              <div className="modal-body">
                <p className="tiny muted" style={{ marginBottom: "0.8rem" }}>{t("Скопируйте этот зашифрованный обезличенный токен и передайте его коллеге или супервизору:", "Copy this encrypted anonymized token and share it with a colleague or supervisor:")}</p>
                <textarea
                  readOnly
                  rows={6}
                  value={sharingToken}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  style={{
                    width: "100%",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "rgba(0,0,0,0.02)",
                    resize: "none",
                  }}
                />
              </div>
              <div className="modal-header" style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "1rem",
              }}>
                <button type="button" className="ob-btn" onClick={() => setSharingToken(null)}>{t("Закрыть", "Close")}</button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal for Traces */}
        {previewModalData && (
          <div className="modal-backdrop" style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}>
            <div className="modal-window" style={{
              maxWidth: "800px",
              width: "90%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--background-color, #fff)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "1.5rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}>
              <div className="modal-header" style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
              }}>
                <h3 style={{ margin: 0 }}>{previewModalData.title}</h3>
                <button type="button" className="close-btn" onClick={() => setPreviewModalData(null)} style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--text-color)",
                }}>&times;</button>
              </div>
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                {previewModalData.text}
              </div>
              <div className="modal-footer" style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "1rem",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "1rem"
              }}>
                <button type="button" className="ob-btn" onClick={() => setPreviewModalData(null)}>{t("Закрыть", "Close")}</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
