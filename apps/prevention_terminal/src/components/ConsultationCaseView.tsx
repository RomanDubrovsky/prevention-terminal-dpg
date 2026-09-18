import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import ConsultationExpertisePanel from "./ConsultationExpertisePanel.tsx";
import ConsultationCaseSummaryPanel from "./ConsultationCaseSummaryPanel.tsx";
import ConsultationJournalPanel from "./ConsultationJournalPanel.tsx";
import ConsultationModeNav, { type ConsultationMainMode } from "./ConsultationModeNav.tsx";

import ConsultationVisitStrip, { type VisitSelection } from "./ConsultationVisitStrip.tsx";
import IntakeForm from "./IntakeForm.tsx";
import { VideoConsultationRoom } from "./video/LiveKitRoom.tsx";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { loadConsultationCaseSummary } from "../lib/consultation_case_summary.ts";
import { isTerminalModuleEnabled, type TerminalConfig } from "../lib/terminal_config.ts";
import { exportAnonymousCaseBriefData, type ExportSupervisionResult } from "../lib/case_supervision.ts";
import { SupervisionShareModal } from "./SupervisionShareModal.tsx";
import type { SessionRecord } from "../lib/session_records.ts";
import type { WorkLogEntry } from "../lib/worklog.ts";
import { t } from "../lib/i18n.ts";

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return isTerminalModuleEnabled(cfg, id);
}

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

  // Video session states
  const [isVideoActive, setIsVideoActive] = useState<boolean>(false);
  const [initialVisitData, setInitialVisitData] = useState<{ durationMinutes?: number; notes?: string } | null>(null);

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

  const handleEndVideo = (sessionResult?: { durationMinutes: number; notes: string }) => {
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

  if (isVideoActive) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
        <VideoConsultationRoom
          roomName={`room-${caseId}`}
          serverUrl={cfg.org_type === "commercial" ? "wss://live.ida-psy.ru" : "wss://live.prevention.school"}
          caseId={caseId}
          clientName={title || "Клиент"}
          specialistName={specialistName || "Специалист"}
          onLeave={handleEndVideo}
        />
      </div>
    );
  }

  const commercial = isCommercialOrg(cfg);

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
                title="Начать онлайн-прием: откроется защищенная видеокомната с таймером и блокнотом заметок. При завершении все данные автоматически перенесутся в протокол визита."
              >
                <span>📹 Начать видео-сессию</span>
              </button>
              <button
                type="button"
                className="ob-btn secondary"
                disabled={shareBusy}
                onClick={handleExportSupervision}
                title={t("Сформировать обезличенный токен дела для супервизии или разбора с коллегой", "Generate anonymous case token for supervision or peer review")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>🔗</span>
                <span>{shareBusy ? t("Экспорт...", "Exporting...") : t("Поделиться (Супервизия)", "Share (Supervision)")}</span>
              </button>
              {onBack ? (
                <button type="button" className="ob-btn secondary" onClick={onBack}>
                  {t("← К списку", "← Back to list")}
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "rgba(5, 150, 105, 0.08)", borderRadius: "6px", border: "1px dashed rgba(5, 150, 105, 0.3)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.1rem" }}>💡</span>
            <span className="muted tiny" style={{ color: "#065f46" }}>
              {t(
                "Онлайн-сессия: нажмите «Начать видео-сессию», чтобы войти в комнату и скопировать защищенную ссылку для клиента. Заметки во время звонка перенесутся прямо в протокол визита.",
                "Online session: click 'Start video session' to open room and copy secure link for your client. Live notes will auto-transfer to visit protocol."
              )}
            </span>
          </div>
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
    </div>
  );
}
