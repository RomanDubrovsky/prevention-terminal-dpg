/**
 * Журнал консультаций — запись визита (краткий рассказ + структура + таксономия).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import DocumentSmartChat from "./DocumentSmartChat.tsx";
import ConsultationSessionTagsEditor from "./ConsultationSessionTagsEditor.tsx";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import AiSupervisionSplitView from "./AiSupervisionSplitView.tsx";
import { UnifiedNoteField } from "./UnifiedNoteField.tsx";
import AiFloatingToolbar from "./AiFloatingToolbar.tsx";
import { appendDictatedChunk } from "../lib/ai_text_utils.ts";
import { t } from "../lib/i18n.ts";
import {
  hasProgressNoteContent,
  VISIT_STRUCTURE_HINTS,
  VISIT_STRUCTURE_TITLES,
} from "../lib/progress_note.ts";
import { loadCaseAiContext } from "../lib/case_ai_context.ts";
import {
  buildConsultationAiContext,
  parseConsultationSession,
  serializeConsultationSession,
} from "../lib/consultation_session.ts";
import {
  caseExpertFromArtifacts,
  formatPriorVisitsBlock,
} from "../lib/expert_bridge.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { listLeads } from "../lib/inbox_client.ts";
import type { ArchitectStageId } from "../lib/architect_picker.ts";
import {
  mergeArtifacts,
} from "../lib/section_artifacts.ts";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import {
  formatWorkDuration,
  newWorkLogEntryId,
  totalWorkMinutes,
  updateWorkLogEntry,
  type WorkLogEntry,
} from "../lib/worklog.ts";
import { addWorkEntry, emptyWorkEntryDraft, newWorkEntryId } from "../lib/work_entries.ts";
import {
  hasConsultationSessionTags,
  emptyConsultationSessionTags,
} from "../lib/session_tagging.ts";
import { reportIntakeCustomThemes } from "../lib/taxonomy_intake_report.ts";
import { useWorklog } from "../lib/hooks/useWorklog.ts";
import { useCaseArtifacts } from "../lib/hooks/useCaseArtifacts.ts";
import { useConsultationForm } from "../lib/hooks/useConsultationForm.ts";
import { ConsultationHistoryList } from "./ConsultationHistoryList.tsx";
import { ConsultationMetadataPanel } from "./ConsultationMetadataPanel.tsx";
import { sendSupervisionWorkflow, sendAiTurn } from "../lib/ai_workspace.ts";
import { uploadSupervisionMetrics } from "../lib/federation_client.ts";

interface ConsultationJournalPanelProps {
  caseId: string;
  terminalUserId?: string;
  expertRefreshKey?: number;
  embedded?: boolean;
  hideEntryList?: boolean;
  externalEntryId?: string | null;
  forceNewSessionToken?: number;
  onEntriesChange?: (entries: WorkLogEntry[]) => void;
  onSavedEntryIdChange?: (entryId: string | null) => void;
  commercial?: boolean;
  initialVisitData?: { durationMinutes?: number; notes?: string } | null;
  hideArchitect?: boolean;
}

export default function ConsultationJournalPanel(props: ConsultationJournalPanelProps) {
  const {
    caseId,
    terminalUserId,
    expertRefreshKey,
    embedded = false,
    hideEntryList = false,
    externalEntryId,
    forceNewSessionToken = 0,
    onEntriesChange,
    onSavedEntryIdChange,
    commercial = false,
    initialVisitData,
    hideArchitect = false,
  } = props;
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(terminalUserId);
  const structureRef = useRef<HTMLDivElement>(null);
  
  const [caseAiContext, setCaseAiContext] = useState("");
  const [hintPreset] = useState<"dap">("dap");
  const [aiNotice] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [matchedLead, setMatchedLead] = useState<any>(null);
  const [showAiChat, setShowAiChat] = useState(false);

  const [supervisionData, setSupervisionData] = useState<any>(null);
  const [supervisionBusy, setSupervisionBusy] = useState(false);
  const [professorCard, setProfessorCard] = useState<any>(null);

  const [prepBriefing, setPrepBriefing] = useState<string | null>(null);
  const [prepBriefingBusy, setPrepBriefingBusy] = useState(false);

  const { caseVisits: entries, loading: entriesLoading, reloadWorklog } = useWorklog(caseId);
  const artifactsDep = useMemo(() => `${entries.length}:${expertRefreshKey ?? 0}`, [entries.length, expertRefreshKey]);
  const { caseArtifacts } = useCaseArtifacts(caseId, artifactsDep);

  const {
    draft, setDraft,
    minutes, setMinutes,
    visitDate, setVisitDate,
    pairMeta, setPairMeta,
    sessionTags, setSessionTags,
    savedEntryId, setSavedEntryId,
    artifacts, setArtifacts,
    state, setState,
    saveOk, setSaveOk,
    aiFilledKeys, setAiFilledKeys,
    startNewSession, resetDraft,
    setMetaField, setSectionField, setSectionNotesField,
    draftDirty
  } = useConsultationForm(hintPreset);

  const [videoImportNotice, setVideoImportNotice] = useState<string | null>(null);

  // Auto-fill from completed video session
  useEffect(() => {
    if (initialVisitData) {
      if (initialVisitData.durationMinutes) {
        setMinutes(String(initialVisitData.durationMinutes));
      }
      if (initialVisitData.notes) {
        setSectionNotesField("observations_notes", (prev) => {
          if (prev && prev.trim()) {
            return `${prev}\n\n[Заметки онлайн-сессии]:\n${initialVisitData.notes}`;
          }
          return `[Заметки онлайн-сессии]:\n${initialVisitData.notes}`;
        });
      }
      setVideoImportNotice(`Данные онлайн-сессии перенесены: длительность ${initialVisitData.durationMinutes || 0} мин и заметки добавлены в блок «Что делали на сессии».`);
    }
  }, [initialVisitData, setMinutes, setSectionNotesField]);

  // Sync loaded entries with props
  useEffect(() => {
    onEntriesChange?.(entries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  useEffect(() => {
    let cancelled = false;
    void loadCaseAiContext(caseId).then((ctx) => {
      if (!cancelled) setCaseAiContext(ctx);
    });
    return () => { cancelled = true; };
  }, [caseId]);

  const contactPerson = caseArtifacts?.registry_profile?.contact_person ?? "";
  useEffect(() => {
    async function findLead() {
      try {
        const leads = await listLeads();
        const matched = leads.find(l => {
          if (l.name && contactPerson.toLowerCase().includes(l.name.toLowerCase())) return true;
          if (l.id === "lead-demo-school-01" && caseId === "case-demo-sch-01") return true;
          return false;
        });
        setMatchedLead(matched || null);
      } catch (err) {
        console.error("Failed to find matched lead:", err);
      }
    }
    void findLead();
  }, [caseId, contactPerson]);

  const total = useMemo(() => totalWorkMinutes(entries), [entries]);
  const cardSaved = Boolean(savedEntryId);
  const step3Filled = Boolean(draft.observations.trim()) || Boolean(draft.intervention.trim()) || Boolean(artifacts.report_text?.trim());
  const step4Filled = Boolean(draft.assessmentResponse.trim()) || Boolean(draft.plan.trim()) || Boolean(artifacts.report_text?.trim());

  async function handleRunSupervision() {
    if (!subscriptionActive) {
      setShowPaywall(true);
      return;
    }
    const notesText = [
      draft.observations_notes,
      draft.intervention_notes,
      draft.assessmentResponse,
      draft.plan
    ].filter(Boolean).join("\n\n").trim();

    if (!notesText || notesText.length < 20) {
      alert(t("Недостаточно текста в черновике для проведения супервизии. Заполните поля 'черновик / надиктовка'.", "Not enough text in the draft for supervision. Please fill in the draft/dictation fields."));
      return;
    }

    setSupervisionBusy(true);
    setSupervisionData(null);
    try {
      const data = await sendSupervisionWorkflow({
        reflection: notesText,
        terminalUserId,
      });
      setSupervisionData(data);
      if (terminalUserId) {
        uploadSupervisionMetrics({
          terminalUserId,
          adherenceScore: data.adherence_score ?? null,
          learningOpportunities: data.learning_opportunities || []
        }).catch(err => console.error("Failed to upload supervision metrics", err));
      }
    } catch (err: any) {
      alert(t("Ошибка при вызове супервизора: ", "Error calling supervisor: ") + String(err));
    } finally {
      setSupervisionBusy(false);
    }
  }

  async function handleGenerateBriefing() {
    setPrepBriefingBusy(true);
    setPrepBriefing(null);
    try {
      const response = await sendAiTurn({
        mode: "consultant",
        message: "Вы - ассистент психолога. Составьте брифинг к предстоящей сессии (5 коротких буллитов: на чем остановились, что спросить) на основе контекста:\n\n" + priorVisitsNote,
        context: aiContext,
        terminalUserId: terminalUserId
      });
      
      setPrepBriefing(response.reply);
    } catch (err: any) {
      alert(t("Ошибка генерации брифинга: ", "Error generating briefing: ") + String(err));
    } finally {
      setPrepBriefingBusy(false);
    }
  }
  
  const priorVisitsNote = useMemo(() => formatPriorVisitsBlock(entries, savedEntryId || undefined), [entries, savedEntryId]);

  const aiContext = useMemo(() => {
    const base = buildConsultationAiContext(draft, artifacts, caseAiContext, {
      visitDate,
      pair: pairMeta,
      caseExpert: caseExpertFromArtifacts(caseArtifacts),
      priorVisitsNote,
      clinicalNarrative: undefined,
      sessionTags,
    });
    if (matchedLead) {
      const leadIntake = JSON.parse(matchedLead.intake_json || "{}");
      const leadInfo = `\n\n[Информация из заявки на сайте]\nФИО: ${matchedLead.name}\nКонтакты: ${matchedLead.contact}\nИсточник: ${matchedLead.source || "Сайт"}\nЗапрос: ${leadIntake.summary || "Без описания"}\nВыбранные темы: ${Array.isArray(leadIntake.themes) ? leadIntake.themes.join(", ") : ""}`;
      return base + leadInfo;
    }
    return base;
  }, [draft, artifacts, caseAiContext, visitDate, pairMeta, caseArtifacts, priorVisitsNote, sessionTags, matchedLead]);

  const aiLockedReason = t("Сохраните черновик посещения — затем откроются ИИ-раскладка и Архитектор.", "Save the visit draft — then AI layout and Architect will become available.");

  const loadEntry = useCallback((entry: WorkLogEntry) => {
    const session = parseConsultationSession(entry.note);
    setSavedEntryId(entry.entry_id);
    setDraft({ ...session.progress, templatePreset: "dap" });
    setArtifacts(session.artifacts);
    setVisitDate(session.visitDate || new Date().toISOString().slice(0, 10));
    setPairMeta(session.pair);
    setSessionTags(session.sessionTags ?? emptyConsultationSessionTags());
    setMinutes(String(entry.minutes));
    setAiFilledKeys([]);
    setSaveOk(null);
    setState({ kind: "idle" });
  }, [setSavedEntryId, setDraft, setArtifacts, setVisitDate, setPairMeta, setSessionTags, setMinutes, setAiFilledKeys, setSaveOk, setState]);

  useEffect(() => {
    onSavedEntryIdChange?.(savedEntryId);
  }, [onSavedEntryIdChange, savedEntryId]);

  useEffect(() => {
    if (externalEntryId === undefined || externalEntryId === null) return;
    const entry = entries.find((row) => row.entry_id === externalEntryId);
    if (entry) loadEntry(entry);
  }, [externalEntryId, entries, loadEntry]);

  useEffect(() => {
    if (externalEntryId === null || forceNewSessionToken > 0) {
      startNewSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceNewSessionToken, externalEntryId]);

  async function persistSession(entryId: string, notePayload: string, sessionMinutes: number, isNew: boolean) {
    if (isNew) {
      await invoke("db_add_work_log_entry", {
        entryId,
        caseId,
        actionKind: "consultation",
        minutes: sessionMinutes,
        note: notePayload,
      });

      // Sync notes to Accompaniment Pipeline API asynchronously
      try {
        const notesToSync = [
          draft.observations_notes,
          draft.intervention_notes,
          draft.assessmentResponse_notes,
          draft.plan_notes
        ].filter(Boolean).join("\n\n").trim();

        
        if (notesToSync.length > 0) {
          // In terminal, the local specialist user ID is stored in terminal config
          let userId = "terminal-unknown";
          try {
            const cfg = JSON.parse(localStorage.getItem("terminal_config") || "{}");
            if (cfg.terminal_user_id) userId = cfg.terminal_user_id;
          } catch {}

          const apiBase = localStorage.getItem("API_ENDPOINT") || "https://api.prevention.school/api";
          const appId = commercial ? "ida" : "parent_navigator";
          
          fetch(`${apiBase}/case/${caseId}/note`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ userId, app_id: appId, raw_text: notesToSync, terminal_request: 1 })
          }).catch(err => console.error("Accompaniment API sync failed:", err));
        }

      } catch (syncErr) {
        console.error("Accompaniment API token fetch failed:", syncErr);
      }

      if (!commercial) {

        try {
          const we = emptyWorkEntryDraft("journal_4b_consultation");
          we.entry_id = newWorkEntryId();
          we.case_id = caseId;
          we.work_date = visitDate;
          we.minutes_actual = sessionMinutes;
          we.activity_kind = "consultation";
          we.title = "Консультация (Авто)";
          await addWorkEntry(we);
        } catch (err) {
          console.error("Failed to auto-sync workload entry:", err);
        }
      }
    } else {
      await updateWorkLogEntry(entryId, { minutes: sessionMinutes, note: notePayload });
    }
  }

  function buildSessionNote(progress: any) {
    const tags = hasConsultationSessionTags(sessionTags) ? sessionTags : undefined;
    return serializeConsultationSession({
      format: "consultation_session_v1",
      progress,
      artifacts,
      visitDate,
      pair: progress.modality === "pair" ? pairMeta : undefined,
      sessionTags: tags,
    });
  }

  async function handleSaveDraft() {
    const parsedMinutes = Number.parseInt(minutes, 10);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setState({ kind: "error", message: "Укажите длительность посещения в минутах." });
      return;
    }
    if (!hasProgressNoteContent({ ...draft, templatePreset: hintPreset }) && ![
      draft.goal_notes, draft.observations_notes, draft.intervention_notes, draft.assessmentResponse_notes, draft.plan_notes
    ].some(s => (s ?? "").trim().length > 0)) {
      setState({
        kind: "error",
        message: "Для черновика заполните хотя бы одну заметку или поле протокола.",
      });
      return;
    }
    setState({ kind: "saving" });
    setSaveOk(null);
    try {
      const isNew = !savedEntryId;
      const entryId = savedEntryId || newWorkLogEntryId();
      const note = buildSessionNote({ ...draft, templatePreset: hintPreset });
      await persistSession(entryId, note, parsedMinutes, isNew);
      setSavedEntryId(entryId);
      
      const okMsg = isNew ? "Черновик посещения сохранён — доступны ИИ-инструменты." : "Черновик обновлён.";
      const workloadMsg = (isNew && !commercial) ? ` (Автоматически зафиксировано ${parsedMinutes} мин нагрузки)` : "";
      setSaveOk(okMsg + workloadMsg);
      void reportIntakeCustomThemes({
        customThemes: sessionTags.themes.custom,
        catalogKeys: sessionTags.themes.catalog,
        commercial,
        source: "visit_tags",
      });
      reloadWorklog();
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: `Не удалось сохранить черновик: ${String(err)}` });
    }
  }

  // expert session save block is omitted for this component as it uses different panels

  async function handleSaveAiDoc(stage: ArchitectStageId, text: string, segments?: Record<string, string>) {
    if (stage === "report" && segments) {
      let nextDraft = { ...draft };
      if (segments.observations) nextDraft.observations_notes = segments.observations;
      if (segments.interventions) nextDraft.intervention_notes = segments.interventions;
      if (segments.response) nextDraft.assessmentResponse_notes = segments.response;
      if (segments.plan) nextDraft.plan_notes = segments.plan;
      if (segments.goal) nextDraft.goal_notes = segments.goal;
      
      setDraft(nextDraft);

      let nextTags = { ...sessionTags };
      if (segments.themes) {
        const parsedThemes = segments.themes.split(",").map(t => t.trim()).filter(Boolean);
        nextTags = {
          ...nextTags,
          themes: {
            ...nextTags.themes,
            catalog: Array.from(new Set([...nextTags.themes.catalog, ...parsedThemes])),
          }
        };
        setSessionTags(nextTags);
      }
      
      if (savedEntryId) {
        const note = serializeConsultationSession({
          format: "consultation_session_v1",
          progress: { ...nextDraft, templatePreset: hintPreset },
          artifacts,
          visitDate,
          pair: nextDraft.modality === "pair" ? pairMeta : undefined,
          sessionTags: hasConsultationSessionTags(nextTags) ? nextTags : undefined,
        });
        await updateWorkLogEntry(savedEntryId, { note });
        setSaveOk("Поля приема (DAP) и темы автоматически заполнены.");
        reloadWorklog();
      } else {
        setSaveOk("Поля приема (DAP) и темы автоматически заполнены. Не забудьте сохранить карточку сессии!");
      }
      return;
    }

    const next = mergeArtifacts(artifacts, stage === "plan" ? { plan_text: text } : { report_text: text });
    setArtifacts(next);
    
    if (savedEntryId) {
      const note = serializeConsultationSession({
        format: "consultation_session_v1",
        progress: { ...draft, templatePreset: hintPreset },
        artifacts: next,
        visitDate,
        pair: draft.modality === "pair" ? pairMeta : undefined,
        sessionTags: hasConsultationSessionTags(sessionTags) ? sessionTags : undefined,
      });
      await updateWorkLogEntry(savedEntryId, { note });
      setSaveOk(stage === "plan" ? "План сохранён в карточке." : "Отчёт сохранён в карточке.");
      reloadWorklog();
    } else {
      setSaveOk(stage === "plan" ? "План прикреплен к черновику. Не забудьте сохранить сессию!" : "Отчёт прикреплен к черновику. Не забудьте сохранить сессию!");
    }
  }

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const toSave = { ...draft, templatePreset: hintPreset };
      const hasContent = hasProgressNoteContent(toSave) || [
        draft.goal_notes, draft.observations_notes, draft.intervention_notes, draft.assessmentResponse_notes, draft.plan_notes
      ].some(s => (s ?? "").trim().length > 0);
      if (!hasContent) {
        setState({ kind: "error", message: "Заполните заметки или хотя бы одно поле протокола." });
        return;
      }
      const parsedMinutes = Number.parseInt(minutes, 10);
      if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
        setState({ kind: "error", message: "Укажите длительность сессии в минутах, больше нуля." });
        return;
      }

      setState({ kind: "saving" });
      setSaveOk(null);
      try {
        const isNew = !savedEntryId;
        const entryId = savedEntryId || newWorkLogEntryId();
        const note = serializeConsultationSession({
          format: "consultation_session_v1",
          progress: toSave,
          artifacts,
          visitDate,
          pair: toSave.modality === "pair" ? pairMeta : undefined,
          sessionTags: hasConsultationSessionTags(sessionTags) ? sessionTags : undefined,
        });
        await persistSession(entryId, note, parsedMinutes, isNew);
        setSavedEntryId(entryId);

        const okMsg = isNew ? "Карточка сессии сохранена." : "Карточка обновлена.";
        const workloadMsg = (isNew && !commercial) ? ` (Автоматически зафиксировано ${parsedMinutes} мин нагрузки)` : "";
        const aiHint = !subscriptionActive && isNew ? " · ИИ может создать план следующей встречи → попробуйте подписку" : "";
        setSaveOk(okMsg + workloadMsg + aiHint);
        reloadWorklog();
        setState({ kind: "idle" });
      } catch (err) {
        setState({ kind: "error", message: `Не удалось сохранить запись: ${String(err)}` });
      }
    },
    [artifacts, caseId, draft, hintPreset, reloadWorklog, minutes, pairMeta, savedEntryId, sessionTags, visitDate, commercial, setState, setSaveOk, setSavedEntryId],
  );

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded ? "consultation-journal-embedded" : "card workspace-card";

  return (
    <Wrapper className={wrapperClass}>
      {!embedded && (
      <header className="workspace-card-header">
        <div>
          <h2>{t("Журнал консультаций", "Consultation Journal")}</h2>
          <p className="muted">
            {t("Каждое посещение — отдельная запись в журнале. Рассказ или заметки → ИИ раскладывает в протокол. Экспертизы накапливаются по личному делу и передаются в Архитектор при формировании плана.", "Each visit is a separate entry in the journal. A narrative or notes → AI structures them into a protocol. Expertise is accumulated in the personal file and transferred to the Architect when forming a plan.")}
          </p>
        </div>
        <div className="work-total">
          <span className="muted tiny">{t("Всего по кейсу", "Total for the case")}</span>
          <strong>{formatWorkDuration(total)}</strong>
        </div>
      </header>
      )}

      {embedded && (
        <header className="consultation-panel-head consultation-panel-head--visit">
          <div>
            <h3>{cardSaved ? t("Карточка визита", "Visit Card") : t("Новый визит", "New Visit")}</h3>
          </div>
        </header>
      )}

      {!hideEntryList && (
        <ConsultationHistoryList
          entries={entries}
          totalMinutes={formatWorkDuration(total)}
          savedEntryId={savedEntryId}
          onSelectEntry={loadEntry}
          onNewSession={startNewSession}
          isBusy={state.kind === "saving"}
        />
      )}

      <form className="dap-note-form intake-grid" onSubmit={handleSubmit}>
        <div className="session-form-heading wide group-session-editor-head">
          <div>
            {!embedded && (
            <>
            <strong>{cardSaved ? t("Карточка сессии", "Session Card") : t("Новая сессия", "New Session")}</strong>
            <span className="muted tiny">{t("посещение · краткий рассказ или структура по блокам", "visit · brief narrative or block structure")}</span>
            </>
            )}
          </div>
          <div className="group-session-editor-actions">
            {!hideEntryList && (
            <button type="button" className="ob-btn secondary" onClick={startNewSession}>
              {t("Новое посещение", "New Visit")}
            </button>
            )}
            <button type="button" className="ob-btn secondary" disabled={state.kind === "saving"} onClick={() => void handleSaveDraft()}>
              {state.kind === "saving" ? "…" : t("Сохранить черновик", "Save Draft")}
            </button>
            <button type="submit" className="ob-btn" disabled={state.kind === "saving"}>
              {state.kind === "saving" ? "…" : cardSaved ? t("Сохранить изменения", "Save Changes") : t("Сохранить", "Save")}
            </button>
          </div>
        </div>



        
        {videoImportNotice && (
          <div className="wide" style={{ padding: "10px 14px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#065f46" }}>
              ✅ <strong>{videoImportNotice}</strong>
            </span>
            <button type="button" className="ob-btn secondary tiny" onClick={() => setVideoImportNotice(null)}>
              ✕
            </button>
          </div>
        )}

        {caseArtifacts?.registry_profile && !caseArtifacts.registry_profile.has_parental_consent && (
          <div className="wide" style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "6px", display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", marginBottom: "10px" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div style={{ fontSize: "0.85rem", color: "#991b1b" }}>
              <strong>Юридическое ограничение: Отсутствует согласие родителей.</strong>
              <p style={{ margin: "4px 0 0 0" }}>Согласно ст. 42 ФЗ-273, оказание психолого-педагогической помощи несовершеннолетним (глубокая диагностика, коррекция) допускается только с письменного согласия. До получения согласия вы можете фиксировать только первичное наблюдение.</p>
            </div>
          </div>
        )}

        {saveOk && <p className="ok tiny wide">{saveOk}</p>}

        <ConsultationMetadataPanel
          draft={draft}
          pairMeta={pairMeta}
          visitDate={visitDate}
          minutes={minutes}
          isBusy={state.kind === "saving"}
          onMetaChange={setMetaField}
          onPairChange={(field, value) => {
            setPairMeta((prev) => ({
              mode: prev?.mode ?? "joint",
              coParticipant: prev?.coParticipant ?? "",
              linkedCaseId: prev?.linkedCaseId,
              [field]: value
            }));
          }}
          onDateChange={setVisitDate}
          onMinutesChange={setMinutes}
        />

        {matchedLead && (() => {
          const leadIntake = JSON.parse(matchedLead.intake_json || "{}");
          return (
            <div className="wide matched-lead-info-bar" style={{ marginBottom: "20px", padding: "1rem", backgroundColor: "rgba(13, 148, 136, 0.08)", border: "1px solid #0d9488", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ color: "#0d9488" }}>🌐 {t("Найдена заявка с сайта от этого клиента/родителя:", "Found website request from this client/parent:")}</strong>
                <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem" }}>
                  <strong>{matchedLead.name}</strong> ({matchedLead.contact}) — {leadIntake.summary || t("Без описания", "No description")}
                </p>
              </div>
              <button type="button" className="ob-btn secondary tiny" onClick={() => {
                navigator.clipboard.writeText(`${t("Заявка от", "Request from")} ${matchedLead.name} (${matchedLead.contact}): ${leadIntake.summary}`);
                alert(t("Информация скопирована в буфер обмена!", "Information copied to clipboard!"));
              }}>
                📋 {t("Копировать", "Copy")}
              </button>
            </div>
          );
        })()}

        {!cardSaved && entries.length > 0 && (
          <div className="wide" style={{ marginBottom: "12px", padding: "8px 14px", background: "rgba(139, 92, 246, 0.03)", borderRadius: "6px", border: "1px solid rgba(139, 92, 246, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted tiny" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              💬 {t("Повторный визит — ИИ может подготовить краткий брифинг по прошлым встречам", "Repeat visit — AI can prepare a brief summary of past meetings")}
            </span>
            <button type="button" className="ob-btn secondary tiny" disabled={prepBriefingBusy} onClick={handleGenerateBriefing} style={{ fontSize: "0.78rem", padding: "4px 10px" }}>
              {prepBriefingBusy ? "…" : t("Брифинг →", "Briefing →")}
            </button>
          </div>
        )}
        {prepBriefing && (
          <div className="wide" style={{ marginBottom: "16px", padding: "12px", background: "#fff", borderRadius: "6px", border: "1px solid var(--line)", whiteSpace: "pre-wrap", fontSize: "0.88rem" }}>
            {prepBriefing}
          </div>
        )}

        {showPaywall && (
          <AiSubscriptionPaywall
            terminalUserId={terminalUserId}
            context={t("ИИ-инструменты консультаций (отчеты, супервизия, брифинг, чат) доступны по подписке.", "AI consultation tools (reports, supervision, briefing, chat) are available via subscription.")}
            onDismiss={() => setShowPaywall(false)}
          />
        )}

        {supervisionData && (
          <div className="wide" style={{ marginBottom: 20 }}>
            <AiSupervisionSplitView
              formalReport={supervisionData.formal_report}
              aiSupervision={supervisionData.ai_supervision}
              academyCards={supervisionData.academy_cards}
              onApplyReport={(report) => {
                 if (report.observations) setSectionField("observations", report.observations);
                 if (report.intervention) setSectionField("intervention", report.intervention);
                 if (report.assessmentResponse) setSectionField("assessmentResponse", report.assessmentResponse);
                 if (report.plan) setSectionField("plan", report.plan);
                 if (report.observations_notes) setSectionNotesField("observations_notes", report.observations_notes);
                 if (report.intervention_notes) setSectionNotesField("intervention_notes", report.intervention_notes);
                 setSupervisionData(null);
              }}
              onClose={() => setSupervisionData(null)}
              onAskProfessor={(card) => setProfessorCard(card)}
            />
          </div>
        )}
        
        {professorCard && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#fff", width: "90%", maxWidth: "800px", height: "80vh", borderRadius: "8px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f5f5" }}>
                <h3 style={{ margin: 0 }}>{t("Разбор кейса с ИИ-Профессором: ", "Case discussion with AI Professor: ")}{professorCard.title}</h3>
                <button type="button" onClick={() => setProfessorCard(null)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>×</button>
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                {/* @ts-ignore */}
                <DocumentSmartChat 
                  activeMode="chat" 
                  consultantSub="case"
                  documentContext={`КАРТОЧКА АКАДЕМИИ:\n${professorCard.title}\n${professorCard.content_preview}\n\nТЕКУЩИЙ КЕЙС ПСИХОЛОГА:\n${draft.observations_notes}\n${draft.intervention_notes}\n${draft.assessmentResponse}\n${draft.plan}`} 
                />
              </div>
            </div>
          </div>
        )}

        {aiNotice && <p className="ok tiny" style={{ marginBottom: 20 }}>{aiNotice}</p>}
        {showPaywall && (
          <AiSubscriptionPaywall
            soft
            terminalUserId={terminalUserId}
            context={t("Заполнение визита с помощью ИИ — по подписке.", "AI-assisted visit completion is subscription-based.")}
            onDismiss={() => setShowPaywall(false)}
          />
        )}

        <div className="consultation-form-section wide" style={{ marginTop: "8px" }}>
          <div ref={structureRef} className="consultation-form-section-body consultation-form-section-body--stack">
            <UnifiedNoteField
              label={VISIT_STRUCTURE_TITLES.observations}
              hint={VISIT_STRUCTURE_HINTS.observations}
              value={draft.observations_notes ?? draft.observations ?? ""}
              onChange={(v) => {
                setSectionNotesField("observations_notes", v);
                if (!draft.observations) setSectionField("observations", v);
              }}
              onDictate={(chunk) => setSectionNotesField("observations_notes", appendDictatedChunk(draft.observations_notes ?? "", chunk))}
              onAiProcess={() => {
                if (!subscriptionActive) { setShowPaywall(true); return; }
                handleRunSupervision();
              }}
              disabled={state.kind === "saving"}
              highlighted={aiFilledKeys.includes("observations")}
              showAiButton={subscriptionActive}
              onAiButtonBlocked={() => setShowPaywall(true)}
              className="wide"
            />
            <UnifiedNoteField
              label={VISIT_STRUCTURE_TITLES.intervention}
              hint={VISIT_STRUCTURE_HINTS.intervention}
              value={draft.intervention_notes ?? draft.intervention ?? ""}
              onChange={(v) => {
                setSectionNotesField("intervention_notes", v);
                if (!draft.intervention) setSectionField("intervention", v);
              }}
              onDictate={(chunk) => setSectionNotesField("intervention_notes", appendDictatedChunk(draft.intervention_notes ?? "", chunk))}
              onAiProcess={() => {
                if (!subscriptionActive) { setShowPaywall(true); return; }
                handleRunSupervision();
              }}
              disabled={state.kind === "saving"}
              highlighted={aiFilledKeys.includes("intervention")}
              showAiButton={subscriptionActive}
              onAiButtonBlocked={() => setShowPaywall(true)}
              className="wide"
            />
            <UnifiedNoteField
              label={t("Текущие выводы", "Current Conclusions")}
              hint={t("Клиническая или профилактическая картина по итогам встречи.", "Clinical or preventive picture following the meeting.")}
              value={draft.assessmentResponse}
              onChange={(v) => setSectionField("assessmentResponse", v)}
              onDictate={(chunk) => setSectionField("assessmentResponse", appendDictatedChunk(draft.assessmentResponse ?? "", chunk))}
              disabled={state.kind === "saving"}
              highlighted={aiFilledKeys.includes("assessmentResponse")}
              showAiButton={subscriptionActive}
              onAiButtonBlocked={() => setShowPaywall(true)}
              className="wide"
            />
            <UnifiedNoteField
              label={t("Рекомендации и задания", "Recommendations and Tasks")}
              hint={t("Клиенту до следующего визита, домашнее задание, договорённости.", "To the client until the next visit, homework, agreements.")}
              value={draft.plan}
              onChange={(v) => setSectionField("plan", v)}
              onDictate={(chunk) => setSectionField("plan", appendDictatedChunk(draft.plan ?? "", chunk))}
              disabled={state.kind === "saving"}
              highlighted={aiFilledKeys.includes("plan")}
              showAiButton={subscriptionActive}
              onAiButtonBlocked={() => setShowPaywall(true)}
              className="wide"
            />
            <div className="consultation-session-formats wide">
              <ConsultationSessionTagsEditor commercial={commercial} value={sessionTags} onChange={setSessionTags} disabled={state.kind === "saving"} hideThemes />
            </div>
          </div>
        </div>

        <div className="workspace-actions wide">
          {draftDirty && (
            <button type="button" className="ob-btn-secondary" onClick={resetDraft}>
              {t("Очистить черновик", "Clear Draft")}
            </button>
          )}
          {state.kind === "error" && <span className="error-inline">{state.message}</span>}
        </div>
      </form>

      <AiFloatingToolbar
        subscriptionActive={subscriptionActive}
        onFillCard={() => {
          if (!subscriptionActive) { setShowPaywall(true); return; }
          setShowAiChat(true);
        }}
        onGenerateReport={() => {
          if (!subscriptionActive) { setShowPaywall(true); return; }
          setShowAiChat(true);
        }}
        onBriefing={() => {
          if (!subscriptionActive) { setShowPaywall(true); return; }
          void handleGenerateBriefing();
        }}
        onSupervision={() => {
          if (!subscriptionActive) { setShowPaywall(true); return; }
          void handleRunSupervision();
        }}
        onChat={() => {
          if (!subscriptionActive) { setShowPaywall(true); return; }
          setShowAiChat(true);
        }}
        onPaywall={() => setShowPaywall(true)}
        isBusy={supervisionBusy || prepBriefingBusy || state.kind === "saving"}
        hasVisitHistory={entries.length > 0}
      />

      {showAiChat && (
        <div
          className="consultation-ai-chat-drawer"
          style={{
            position: "fixed",
            bottom: "64px",
            right: "24px",
            width: "min(620px, 92vw)",
            maxHeight: "75vh",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 36px rgba(0,0,0,0.22)",
            border: "1px solid var(--line, #cbd5e1)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.1rem" }}>💬</span>
              <strong style={{ fontSize: "0.95rem", color: "#1e293b" }}>{t("ИИ-помощник консультаций", "AI Consultation Assistant")}</strong>
            </div>
            <button
              type="button"
              className="ob-btn secondary tiny"
              onClick={() => setShowAiChat(false)}
              style={{ fontSize: "0.8rem", padding: "4px 10px", cursor: "pointer" }}
            >
              ✕ {t("Закрыть", "Close")}
            </button>
          </div>
          <div style={{ padding: "16px", overflowY: "auto", flex: 1, maxHeight: "calc(75vh - 55px)" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="consultation"
              documentContext={aiContext}
              cardSaved={true}
              aiLockedReason={aiLockedReason}
              onApplyResult={handleSaveAiDoc}
              showPlanButton={true}
              showReportButton={true}
              planButtonLabel={t("Сделать план консультации", "Create consultation plan")}
              reportButtonLabel={t("Сформировать отчет по приему", "Generate session report")}
              showFillCardButton={true}
              fillCardButtonLabel={t("Внести в карточку (ИИ)", "Fill in card (AI)")}
            />
          </div>
        </div>
      )}

      {entriesLoading && <p className="muted tiny">{t("Загрузка журнала…", "Loading journal...")}</p>}
    </Wrapper>
  );
}

