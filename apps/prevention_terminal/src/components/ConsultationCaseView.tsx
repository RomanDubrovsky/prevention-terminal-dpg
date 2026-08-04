import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import ConsultationExpertisePanel from "./ConsultationExpertisePanel.tsx";
import ConsultationCaseSummaryPanel from "./ConsultationCaseSummaryPanel.tsx";
import ConsultationJournalPanel from "./ConsultationJournalPanel.tsx";
import ConsultationModeNav, { type ConsultationMainMode } from "./ConsultationModeNav.tsx";
import ConsultationVisitStrip, { type VisitSelection } from "./ConsultationVisitStrip.tsx";
import IntakeForm from "./IntakeForm.tsx";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { loadConsultationCaseSummary } from "../lib/consultation_case_summary.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { SessionRecord } from "../lib/session_records.ts";
import type { WorkLogEntry } from "../lib/worklog.ts";
import { t } from "../lib/i18n.ts";

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return cfg.enabled_modules[id] !== false;
}

interface ConsultationCaseViewProps {
  cfg: TerminalConfig;
  caseId: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function ConsultationCaseView(props: ConsultationCaseViewProps) {
  const { cfg, caseId, title, subtitle, onBack } = props;
  const hasPrimary = modEnabled(cfg, "reception_journal");
  const hasVisits = modEnabled(cfg, "consultation_journal");

  const [mainMode, setMainMode] = useState<ConsultationMainMode>("visits");
  const [primaryRecord, setPrimaryRecord] = useState<SessionRecord | null>(null);
  const [visits, setVisits] = useState<WorkLogEntry[]>([]);
  const [summaryFilled, setSummaryFilled] = useState(false);
  const [visitSelection, setVisitSelection] = useState<VisitSelection>({ kind: "new-visit" });
  const [newVisitToken, setNewVisitToken] = useState(() => (hasPrimary ? 0 : 1));

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

  return (
    <div className="consultation-case-view">
      {(onBack || title) && (
        <section className="card consultation-case-view-head">
          <div className="case-workspace-active-head">
            <div>
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <p className="muted tiny">{subtitle}</p> : null}
            </div>
            {onBack ? (
              <button type="button" className="ob-btn secondary" onClick={onBack}>
                {t("← К списку", "← Back to list")}
              </button>
            ) : null}
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
                commercial={isCommercialOrg(cfg)}
                embedded
                hideEntryList
                externalEntryId={visitExternalId}
                forceNewSessionToken={newVisitToken}
                onEntriesChange={handleVisitsChange}
                onSavedEntryIdChange={handleSavedEntryIdChange}
                renderIntakeBlock={
                  hasPrimary ? (
                    <details className="consultation-form-section wide consultation-visit-step" open={!primaryRecord}>
                      <summary>{t("Причины обращения (Карточка)", "Reasons for referral (Card)")}</summary>
                      <div className="consultation-form-section-body">
                        <IntakeForm
                          caseId={caseId}
                          embedded
                          primaryOnly
                          commercial={isCommercialOrg(cfg)}
                          terminalUserId={cfg.terminal_user_id}
                          onPrimarySaved={() => void handlePrimarySaved()}
                        />
                      </div>
                    </details>
                  ) : undefined
                }
              />
            )}
          </div>
        </>
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
    </div>
  );
}
