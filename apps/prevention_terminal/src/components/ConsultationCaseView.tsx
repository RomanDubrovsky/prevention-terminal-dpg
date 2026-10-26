import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";

import ConsultationExpertisePanel from "./ConsultationExpertisePanel.tsx";
import ConsultationCaseSummaryPanel from "./ConsultationCaseSummaryPanel.tsx";
import ConsultationJournalPanel from "./ConsultationJournalPanel.tsx";
import ConsultationModeNav, { type ConsultationMainMode } from "./ConsultationModeNav.tsx";

import ConsultationVisitStrip, { type VisitSelection } from "./ConsultationVisitStrip.tsx";
import IntakeForm from "./IntakeForm.tsx";
const VideoConsultationRoom = lazy(() => import("./video/LiveKitRoom.tsx"));
import { isCommercialOrg } from "../lib/case_meta.ts";

import { loadConsultationCaseSummary } from "../lib/consultation_case_summary.ts";
import { isTerminalModuleEnabled, type TerminalConfig } from "../lib/terminal_config.ts";
import { exportAnonymousCaseBriefData, type ExportSupervisionResult } from "../lib/case_supervision.ts";
import { SupervisionShareModal } from "./SupervisionShareModal.tsx";
import type { SessionRecord } from "../lib/session_records.ts";
import type { WorkLogEntry } from "../lib/worklog.ts";
import { t } from "../lib/i18n.ts";
import { confirmLeaveIfUnsaved } from "../lib/unsaved_changes.ts";
import { getCaseArtifacts, type CaseArtifactsPayload } from "../lib/case_store.ts";
import { listCaseAliasesLocal, participantMarker } from "../lib/case_participants.ts";

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return isTerminalModuleEnabled(cfg, id);
}

const PROTOCOLS_LIST = [
  { id: "child_profile", label: "Характеристика" },
  { id: "conclusion", label: "025/у" },
  { id: "fba", label: "ФАП" },
  { id: "bip", label: "BIP" },
  { id: "mdr", label: "ППк" },
  { id: "audit", label: "Аудит" },
];

interface ConsultationCaseViewProps {
  cfg: TerminalConfig;
  caseId: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  specialistName?: string;
}

export default function ConsultationCaseView(props: ConsultationCaseViewProps) {
  const { cfg, caseId, title, subtitle, onBack, specialistName } = props;
  const hasPrimary = modEnabled(cfg, "reception_journal");
  const hasVisits = modEnabled(cfg, "consultation_journal");

  const [mainMode, setMainMode] = useState<ConsultationMainMode>("visits");
  const [primaryRecord, setPrimaryRecord] = useState<SessionRecord | null>(null);
  const [visits, setVisits] = useState<WorkLogEntry[]>([]);
  const [summaryFilled, setSummaryFilled] = useState(false);
  const [visitSelection, setVisitSelection] = useState<VisitSelection>({ kind: "new-visit" });
  const [newVisitToken, setNewVisitToken] = useState(() => (hasPrimary ? 0 : 1));

  // Artifacts & participants state for fast document buttons
  const [artifacts, setArtifacts] = useState<CaseArtifactsPayload>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; text: string } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Video session states
  const [isVideoActive, setIsVideoActive] = useState<boolean>(false);
  const [initialVisitData, setInitialVisitData] = useState<{ durationMinutes?: number; notes?: string; transcript?: string } | null>(null);

  // Supervision share states
  const [shareSupervisionResult, setShareSupervisionResult] = useState<ExportSupervisionResult | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const handleExportSupervision = async () => {
    setShareBusy(true);
    try {
      const res = await exportAnonymousCaseBriefData(caseId, title || "");
      setShareSupervisionResult(res);
      try {
        await navigator.clipboard.writeText(res.token);
      } catch {
        // clipboard fallback inside modal
      }
    } catch (e: any) {
      alert(t("Ошибка экспорта токена: ", "Export error: ") + (e.message || String(e)));
    } finally {
      setShareBusy(false);
    }
  };

  const handleStartVideo = () => {
    setIsVideoActive(true);
  };

  const handleEndVideo = (sessionResult?: { durationMinutes: number; notes: string; transcript?: string }) => {
    setIsVideoActive(false);
    if (sessionResult) {
      setInitialVisitData(sessionResult);
      // Switch to new-visit mode to capture notes immediately
      setVisitSelection({ kind: "new-visit" });
      setNewVisitToken((prev) => prev + 1);
    }
  };

  const reloadPrimary = useCallback(async () => {
    if (!hasPrimary) {
      setPrimaryRecord(null);
      return;
    }
    try {
      const rows = await invoke<SessionRecord[]>("db_list_session_records", { caseId });
      setPrimaryRecord(rows.find((row) => row.session_no === 0) ?? null);
    } catch {
      setPrimaryRecord(null);
    }
  }, [caseId, hasPrimary]);

  const reloadSummaryFlag = useCallback(async () => {
    try {
      const summary = await loadConsultationCaseSummary(caseId);
      setSummaryFilled(
        Boolean(summary.conclusions.trim() || summary.recommendations.trim() || summary.dynamics.trim()),
      );
    } catch {
      setSummaryFilled(false);
    }
  }, [caseId]);

  useEffect(() => {
    void reloadPrimary();
    void reloadSummaryFlag();
  }, [reloadPrimary, reloadSummaryFlag]);

  useEffect(() => {
    let cancelled = false;
    void getCaseArtifacts(caseId).then((payload) => {
      if (!cancelled) setArtifacts(payload);
    }).catch(() => {});
    void listCaseAliasesLocal(caseId).then((plist) => {
      if (!cancelled) setParticipants(plist);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const hasParticipantDocs = useMemo(() => {
    return participants.some((p) => {
      const pExpert = artifacts.expert_by_participant?.[p.alias_id];
      return PROTOCOLS_LIST.some((proto) => pExpert?.[proto.id as any]?.text?.trim());
    });
  }, [participants, artifacts.expert_by_participant]);

  const hasGeneralDocs = useMemo(() => {
    return PROTOCOLS_LIST.some((proto) => artifacts.expert?.[proto.id as any]?.text?.trim());
  }, [artifacts.expert]);

  const hasAnyDocs = hasParticipantDocs || hasGeneralDocs;

  const handleVisitSelect = useCallback((next: VisitSelection) => {
    setVisitSelection(next);
    if (next.kind === "new-visit") {
      setNewVisitToken((t) => t + 1);
    }
  }, []);

  const handleVisitsChange = useCallback((entries: WorkLogEntry[]) => {
    setVisits(entries);
    setVisitSelection((currentSel) => {
      if (currentSel.kind === "new-visit" && entries.length > 0) {
        // Auto-select the newly created visit if we came from new-visit
        const newEntry = entries[0]; // Assuming sorted newest first
        return { kind: "visit", entryId: newEntry.entry_id };
      }
      return currentSel;
    });
  }, []);

  const handlePrimarySaved = useCallback(() => {
    void reloadPrimary();
  }, [reloadPrimary]);

  const handleSavedEntryIdChange = useCallback(
    (entryId: string | null) => {
      if (entryId && visitSelection.kind === "new-visit") {
        setVisitSelection({ kind: "visit", entryId });
      }
    },
    [visitSelection.kind],
  );

  const visitExternalId = useMemo(() => {
    if (visitSelection.kind === "visit") return visitSelection.entryId;
    if (visitSelection.kind === "new-visit") return null;
    return undefined;
  }, [visitSelection]);

  if (!hasPrimary && !hasVisits) {
    return (
      <section className="card">
        <p className="muted">{t("Включите «Журнал приёма» или «Журнал консультаций» в Настройках.", "Enable 'Reception Journal' or 'Consultation Journal' in Settings.")}</p>
      </section>
    );
  }

  const commercial = isCommercialOrg(cfg);

  if (isVideoActive) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
        <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#111", color: "#fff" }}>{t("Загрузка видеокомнаты...", "Loading video room...")}</div>}>
          <VideoConsultationRoom
            mode="consultation"
            roomName={`room-${caseId}`}
            serverUrl={commercial ? "wss://live.ida-psy.ru" : "wss://live.prevention.school"}
            caseId={caseId}
            clientName={title || "Клиент"}
            specialistName={specialistName || "Специалист"}
            terminalUserId={cfg.terminal_user_id}
            commercial={commercial}
            onLeave={handleEndVideo}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="consultation-case-view">
      {(onBack || title) && (
        <section className="card consultation-case-view-head">
          <div className="case-workspace-active-head">
            <div>
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <p className="muted tiny">{subtitle}</p> : null}
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="ob-btn"
                style={{
                  backgroundColor: "#059669",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: "bold",
                  boxShadow: "0 2px 4px rgba(5, 150, 105, 0.2)"
                }}
                onClick={handleStartVideo}
                title={t(
                  "Начать онлайн-прием: откроется защищенная видеокомната с таймером и блокнотом заметок. При завершении все данные автоматически перенесутся в протокол визита.",
                  "Start online session: opens a secure video room with timer, note taker, and AI sprint tracker. All data auto-transfers to clinical notes upon ending."
                )}
              >
                <span>{t("📹 Начать видео-сессию", "📹 Start Video Session")}</span>
              </button>
              {!commercial && (
                <button
                  type="button"
                  className="ob-btn secondary"
                  disabled={shareBusy}
                  onClick={handleExportSupervision}
                  title={t("Сформировать сетевую команду по случаю или запрос в ППМС-центр", "Network team & PPMS request")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#e0e7ff",
                    color: "#3730a3",
                    borderColor: "#c7d2fe",
                    fontWeight: "600"
                  }}
                >
                  <span>🤝</span>
                  <span>{shareBusy ? t("Экспорт...", "Exporting...") : t("Сетевая команда / ППМС", "Network Team / PPMS")}</span>
                </button>
              )}
              {onBack ? (
                <button
                  type="button"
                  className="ob-btn secondary"
                  onClick={() => {
                    if (!confirmLeaveIfUnsaved()) return;
                    onBack();
                  }}
                >
                  {t("← К списку", "← Back to list")}
                </button>
              ) : null}
            </div>
          </div>

          {/* Quick participant & case documents bar */}
          {hasAnyDocs && (
            <div
              className="consultation-quick-docs-bar"
              style={{
                marginTop: "0.8rem",
                paddingTop: "0.8rem",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-muted, #64748b)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📁</span>
                <span>{t("Готовые документы по делу и участникам:", "Ready case & participant documents:")}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
                {/* Участники */}
                {participants.map((p) => {
                  const pExpert = artifacts.expert_by_participant?.[p.alias_id];
                  const docs = PROTOCOLS_LIST.filter((proto) => pExpert?.[proto.id as any]?.text?.trim());
                  if (docs.length === 0) return null;
                  return (
                    <div
                      key={p.alias_id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 8px",
                        backgroundColor: "rgba(16, 185, 129, 0.08)",
                        borderRadius: "6px",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#065f46" }}>
                        {participantMarker(p.role, p.role_no)}
                        {p.real_name ? ` (${p.real_name})` : ""}:
                      </span>
                      {docs.map((proto) => {
                        const text = pExpert?.[proto.id as any]?.text || "";
                        return (
                          <button
                            key={proto.id}
                            type="button"
                            className="ob-btn secondary tiny"
                            style={{
                              border: "1px solid #10b981",
                              color: "#065f46",
                              backgroundColor: "#fff",
                              fontWeight: "600",
                              fontSize: "0.8rem",
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                            title={t("Открыть документ прямо здесь", "Open document right here")}
                            onClick={() =>
                              setPreviewDocModal({
                                title: `${proto.label} — ${participantMarker(p.role, p.role_no)}${p.real_name ? ` (${p.real_name})` : ""}`,
                                text,
                              })
                            }
                          >
                            📄 {proto.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Общее по делу */}
                {(() => {
                  const generalDocs = PROTOCOLS_LIST.filter((proto) => artifacts.expert?.[proto.id as any]?.text?.trim());
                  if (generalDocs.length === 0) return null;
                  return (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 8px",
                        backgroundColor: "rgba(16, 185, 129, 0.08)",
                        borderRadius: "6px",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#065f46" }}>
                        {participants.length > 0 ? t("По делу:", "Case general:") : t("Документы:", "Documents:")}
                      </span>
                      {generalDocs.map((proto) => {
                        const text = artifacts.expert?.[proto.id as any]?.text || "";
                        return (
                          <button
                            key={proto.id}
                            type="button"
                            className="ob-btn secondary tiny"
                            style={{
                              border: "1px solid #10b981",
                              color: "#065f46",
                              backgroundColor: "#fff",
                              fontWeight: "600",
                              fontSize: "0.8rem",
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                            title={t("Открыть документ прямо здесь", "Open document right here")}
                            onClick={() =>
                              setPreviewDocModal({
                                title: `${proto.label} — ${participants.length > 0 ? t("Общее по делу", "General Case Info") : (title || caseId)}`,
                                text,
                              })
                            }
                          >
                            📄 {proto.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </section>
      )}

      <ConsultationModeNav
        mode={mainMode}
        onChange={setMainMode}
        summaryFilled={summaryFilled}
      />

      {mainMode === "visits" && (
        <>
          {(hasPrimary || hasVisits) && (
            <ConsultationVisitStrip
              visits={hasVisits ? visits : []}
              selection={visitSelection}
              onSelect={handleVisitSelect}
            />
          )}

          <div style={{ marginTop: '20px' }}>
            {(visitSelection.kind === "visit" || visitSelection.kind === "new-visit") && hasVisits && (
              <ConsultationJournalPanel
                caseId={caseId}
                terminalUserId={cfg.terminal_user_id}
                commercial={commercial}
                embedded
                hideEntryList
                externalEntryId={visitExternalId}
                forceNewSessionToken={newVisitToken}
                initialVisitData={initialVisitData}
                onEntriesChange={handleVisitsChange}
                onSavedEntryIdChange={handleSavedEntryIdChange}
              />
            )}
          </div>
        </>
      )}

      {mainMode === "card" && hasPrimary && (
        <section className="card" style={{ marginTop: '12px' }}>
          <IntakeForm
            caseId={caseId}
            embedded
            primaryOnly
            commercial={commercial}
            terminalUserId={cfg.terminal_user_id}
            onPrimarySaved={() => void reloadPrimary()}
          />
        </section>
      )}

      {mainMode === "card" && !hasPrimary && (
        <section className="card" style={{ marginTop: '12px' }}>
          <p className="muted">{t("Модуль «Журнал приёма» не включён. Включите его в Настройках.", "The 'Reception Journal' module is not enabled. Enable it in Settings.")}</p>
        </section>
      )}

      {mainMode === "expertise" && (
        <ConsultationExpertisePanel
          cfg={cfg}
          caseId={caseId}
        />
      )}

      {mainMode === "summary" && (
        <ConsultationCaseSummaryPanel
          cfg={cfg}
          caseId={caseId}
          onSaved={() => void reloadSummaryFlag()}
        />
      )}

      {shareSupervisionResult && (
        <SupervisionShareModal
          data={shareSupervisionResult}
          onClose={() => setShareSupervisionResult(null)}
        />
      )}

      {/* Preview Modal for Fast Documents */}
      {previewDocModal && (
        <div
          className="modal-backdrop"
          style={{
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
          }}
        >
          <div
            className="modal-window"
            style={{
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
            }}
          >
            <div
              className="modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📄</span>
                <span>{previewDocModal.title}</span>
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setPreviewDocModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--text-color)",
                }}
              >
                &times;
              </button>
            </div>
            <div
              className="modal-body"
              style={{
                overflowY: "auto",
                flex: 1,
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                padding: "0.5rem 0",
              }}
            >
              {previewDocModal.text}
            </div>
            <div
              className="modal-footer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "1rem",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="ob-btn secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(previewDocModal.text);
                      setCopiedNotice(true);
                      setTimeout(() => setCopiedNotice(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {copiedNotice ? t("✓ Скопировано!", "✓ Copied!") : t("📋 Скопировать текст", "📋 Copy Text")}
                </button>
                <button
                  type="button"
                  className="ob-btn secondary"
                  onClick={() => {
                    setPreviewDocModal(null);
                    setMainMode("expertise");
                  }}
                  title={t("Перейти во вкладку «Экспертиза» для редактирования документа", "Go to Expertise tab to edit document")}
                >
                  {t("✏️ Редактировать в Экспертизе", "✏️ Edit in Expertise")}
                </button>
              </div>
              <button
                type="button"
                className="ob-btn"
                onClick={() => setPreviewDocModal(null)}
              >
                {t("Закрыть", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
