import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import ProgramPlanRowsEditor from "./ProgramPlanRowsEditor.tsx";
import SessionTagsEditor from "./SessionTagsEditor.tsx";
import TargetAudienceFields from "./TargetAudienceFields.tsx";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import { PLAN_JOURNAL_EMPTY, PLAN_JOURNAL_INTRO } from "../content/plan_workspace_copy.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { isCorporateProduct } from "../lib/terminal_product.ts";
import { type AudienceContext } from "../lib/target_audience.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { listRegistrySubjects, type RegistrySubjectSummary } from "../lib/registry_store.ts";
import { listIprs } from "../lib/ipr_store.ts";
import { addWorkEntry, emptyWorkEntryDraft } from "../lib/work_entries.ts";
import {
  addGroupSession,
  buildGroupSessionAiContext,
  listGroupSessions,
  newGroupSessionId,
  parseGroupSessionArtifacts,
  updateGroupSession,
  type GroupSessionEntry,
} from "../lib/group_sessions.ts";
import {
  emptyTargetAudience,
  parseTargetAudienceJson,
  serializeTargetAudience,
  type TargetAudienceData,
  type TargetCategory,
} from "../lib/target_audience.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import type { ArchitectStageId } from "../lib/architect_picker.ts";
import { type PreventionLink } from "../lib/prevention_link.ts";
import {
  emptyPreventionWorkTypes,
  parsePreventionWorkTypesJson,
  serializePreventionWorkTypes,
  type PreventionWorkTypesSelection,
} from "../lib/prevention_work_types.ts";
import {
  emptyConsultationSessionTags,
  parseSessionTagsJson,
  serializeSessionTags,
  type ConsultationSessionTags,
} from "../lib/session_tagging.ts";
import {
  mergeArtifacts,
  type SessionArtifacts,
} from "../lib/section_artifacts.ts";
import {
  emptyProgramPlanTable,
  extractProgramPlanTable,
  mergeSegmentsWithPlanTable,
  type ProgramPlanTable,
} from "../lib/program_plan_rows.ts";
import {
  PERSON_CARD_SORT_OPTIONS,
  sortGroupSessions,
  type PersonCardSort,
} from "../lib/workspace_list_sort.ts";
import { t } from "../lib/i18n.ts";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type GroupSessionDraft = Omit<GroupSessionEntry, "created_at" | "updated_at"> & {
  audience: TargetAudienceData;
  preventionLink: PreventionLink;
  workTypes: PreventionWorkTypesSelection;
  sessionTags: ConsultationSessionTags;
};

function emptyDraft(): GroupSessionDraft {
  return {
    session_id: "",
    title: "",
    session_date: todayIsoDate(),
    duration_minutes: 60,
    theme: "",
    notes: "",
    plan_text: "",
    report_text: "",
    artifacts_json: "{}",
    audience_json: "{}",
    prevention_link: "L1_universal",
    prevention_work_types_json: "{}",
    session_tags_json: "{}",
    audience: emptyTargetAudience(),
    preventionLink: "L1_universal",
    workTypes: emptyPreventionWorkTypes(),
    sessionTags: emptyConsultationSessionTags(),
  };
}

function draftFromEntry(row: GroupSessionEntry): GroupSessionDraft {
  return {
    ...row,
    audience: parseTargetAudienceJson(row.audience_json),
    preventionLink: (row.prevention_link || "L1_universal") as PreventionLink,
    workTypes: parsePreventionWorkTypesJson(row.prevention_work_types_json),
    sessionTags: parseSessionTagsJson(row.session_tags_json),
  };
}

interface GroupSessionsJournalProps {
  terminalUserId?: string;
  cfg: TerminalConfig;
}

export default function GroupSessionsJournal(props: GroupSessionsJournalProps) {
  const { terminalUserId, cfg } = props;
  const commercial = isCommercialOrg(cfg);
  const isCorporate =
    isCorporateProduct() ||
    (typeof window !== "undefined" &&
      window.location.hostname.includes("corporate-health"));
  const audienceContext: AudienceContext = isCorporate
    ? "corporate"
    : commercial
      ? "commercial"
      : "education";
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(terminalUserId);

  const [entries, setEntries] = useState<GroupSessionEntry[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"plan" | "report">("plan");
  const [draft, setDraft] = useState(emptyDraft);
  const [artifacts, setArtifacts] = useState<SessionArtifacts>({});
  const groupSessionHeaders = useMemo(() => [
    t("№ занятия", "Session No."),
    t("Тема", "Theme"),
    t("Цель", "Goal"),
    t("Формат", "Format"),
    t("Длительность", "Duration"),
  ], []);

  const [planTable, setPlanTable] = useState<ProgramPlanTable>(() =>
    emptyProgramPlanTable(groupSessionHeaders),
  );
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [listSort, setListSort] = useState<PersonCardSort>("created_desc");

  const sortedEntries = useMemo(
    () => sortGroupSessions(entries, listSort),
    [entries, listSort],
  );

  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("terminal_group_work_intro_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const handleDismissIntro = useCallback(() => {
    setIntroDismissed(true);
    try {
      localStorage.setItem("terminal_group_work_intro_dismissed", "1");
    } catch {
      // ignore
    }
  }, []);

  const cardSaved = Boolean(savedSessionId && savedSessionId === draft.session_id);
  const [registrySubjects, setRegistrySubjects] = useState<RegistrySubjectSummary[]>([]);
  const [iprCaseIds, setIprCaseIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setEntries(await listGroupSessions());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    void listRegistrySubjects()
      .then((subs) => {
        setRegistrySubjects(subs);
        void Promise.all(
          subs.map(async (s) => {
            try {
              const rows = await listIprs(s.case_id);
              return rows.length > 0 ? s.case_id : null;
            } catch {
              return null;
            }
          }),
        ).then((ids) => {
          setIprCaseIds(new Set(ids.filter(Boolean) as string[]));
        });
      })
      .catch(() => {});
  }, [reload]);

  const selectedParticipantIds = useMemo(
    () => artifacts.participant_case_ids || [],
    [artifacts.participant_case_ids],
  );

  const availableRegistrySubjects = useMemo(
    () => registrySubjects.filter((s) => !selectedParticipantIds.includes(s.case_id)),
    [registrySubjects, selectedParticipantIds],
  );

  const participantNames = useMemo(() => {
    return selectedParticipantIds.map((id) => {
      const found = registrySubjects.find((s) => s.case_id === id);
      return found
        ? (found.profile?.full_name || (found.profile as any)?.student_name || found.situation_title || id)
        : id;
    });
  }, [selectedParticipantIds, registrySubjects]);

  function handleAddParticipant(caseId: string) {
    if (!caseId) return;
    const current = artifacts.participant_case_ids || [];
    if (current.includes(caseId)) return;
    const next = [...current, caseId];
    const nextArtifacts = mergeArtifacts(artifacts, { participant_case_ids: next });
    setArtifacts(nextArtifacts);
    setDraft((d) => ({ ...d, artifacts_json: JSON.stringify(nextArtifacts) }));
  }

  function handleRemoveParticipant(caseId: string) {
    const current = artifacts.participant_case_ids || [];
    const next = current.filter((id) => id !== caseId);
    const nextArtifacts = mergeArtifacts(artifacts, { participant_case_ids: next });
    setArtifacts(nextArtifacts);
    setDraft((d) => ({ ...d, artifacts_json: JSON.stringify(nextArtifacts) }));
  }

  const aiContext = useMemo(
    () =>
      buildGroupSessionAiContext(
        {
          ...draft,
          audience_json: serializeTargetAudience(draft.audience),
          prevention_link: draft.preventionLink,
          prevention_work_types_json: serializePreventionWorkTypes(draft.workTypes),
          session_tags_json: serializeSessionTags(draft.sessionTags),
          participant_names: participantNames,
        },
        audienceContext,
      ),
    [draft, participantNames, audienceContext],
  );

  function openNewCard() {
    const id = newGroupSessionId();
    setDraft({ ...emptyDraft(), session_id: id });
    setArtifacts({});
    setPlanTable(emptyProgramPlanTable(groupSessionHeaders));
    setSavedSessionId(null);
    setSaveOk(null);
    setError(null);
    setEditorOpen(true);
  }

  function loadEntry(row: GroupSessionEntry) {
    const nextArtifacts = parseGroupSessionArtifacts(row.artifacts_json);
    setDraft(draftFromEntry(row));
    setArtifacts(nextArtifacts);
    setPlanTable(
      extractProgramPlanTable({
        segments: nextArtifacts.plan_segments,
        planText: row.plan_text,
        fallbackHeaders: groupSessionHeaders,
      }),
    );
    setSavedSessionId(row.session_id);
    setSaveOk(null);
    setError(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setSaveOk(null);
    setError(null);
  }

  async function handleSave(e?: FormEvent) {
    e?.preventDefault();
    const minutes = Number(draft.duration_minutes);
    if (!draft.title.trim()) {
      setError(t("Укажите название плана.", "Specify plan title."));
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError(t("Длительность должна быть больше нуля.", "Duration must be greater than zero."));
      return;
    }
    setBusy(true);
    setError(null);
    setSaveOk(null);
    try {
      const audienceJson = serializeTargetAudience(draft.audience);
      const workTypesJson = serializePreventionWorkTypes(draft.workTypes);
      const sessionTagsJson = serializeSessionTags(draft.sessionTags);
      const planSegments = mergeSegmentsWithPlanTable(artifacts.plan_segments, planTable);
      const nextArtifacts = mergeArtifacts(artifacts, {
        plan_segments: planTable.rows.length > 0 ? planSegments : artifacts.plan_segments,
        participant_case_ids: artifacts.participant_case_ids || [],
      });
      const payload = {
        session_id: draft.session_id || newGroupSessionId(),
        title: draft.title.trim(),
        session_date: draft.session_date,
        duration_minutes: minutes,
        theme: draft.theme.trim(),
        notes: draft.notes.trim(),
        plan_text: draft.plan_text,
        report_text: draft.report_text,
        audience_json: audienceJson,
        prevention_link: draft.preventionLink,
        prevention_work_types_json: workTypesJson,
        session_tags_json: sessionTagsJson,
        artifacts: nextArtifacts,
      };
      if (!cardSaved) {
        await addGroupSession(payload);
        setDraft((d) => ({
          ...d,
          session_id: payload.session_id,
          audience_json: audienceJson,
          prevention_link: payload.prevention_link,
          prevention_work_types_json: workTypesJson,
          session_tags_json: sessionTagsJson,
          artifacts_json: JSON.stringify(nextArtifacts),
        }));
      } else {
        await updateGroupSession(payload.session_id, {
          title: payload.title,
          session_date: payload.session_date,
          duration_minutes: payload.duration_minutes,
          theme: payload.theme,
          notes: payload.notes,
          plan_text: payload.plan_text,
          report_text: payload.report_text,
          audience_json: audienceJson,
          prevention_link: payload.prevention_link,
          prevention_work_types_json: workTypesJson,
          session_tags_json: sessionTagsJson,
          artifacts: nextArtifacts,
        });
        setDraft((d) => ({
          ...d,
          audience_json: audienceJson,
          prevention_link: payload.prevention_link,
          prevention_work_types_json: workTypesJson,
          session_tags_json: sessionTagsJson,
          artifacts_json: JSON.stringify(nextArtifacts),
        }));
      }

      // Sync participation into workLog and workEntries for each registry participant
      const participantIds = nextArtifacts.participant_case_ids || [];
      for (const cid of participantIds) {
        try {
          const entryId = `wl-${payload.session_id}-${cid}`;
          const logNote = `Групповое занятие: «${payload.title}»${payload.theme ? ` (${payload.theme})` : ""}`;
          await invoke("db_add_work_log_entry", {
            entryId,
            caseId: cid,
            actionKind: "group_session",
            minutes,
            note: logNote,
          });
          if (!commercial) {
            try {
              const we = emptyWorkEntryDraft("journal_4b_consultation");
              we.entry_id = `we-${payload.session_id}-${cid}`;
              we.case_id = cid;
              we.work_date = draft.session_date;
              we.minutes_actual = minutes;
              we.activity_kind = "group_session";
              we.title = `Групповая работа: ${payload.title}`;
              await addWorkEntry(we);
            } catch (err) {
              console.error("Failed to auto-sync group session work entry:", err);
            }
          }
        } catch (logErr) {
          console.error("Failed to sync participant work log:", logErr);
        }
      }

      setArtifacts(nextArtifacts);
      setSavedSessionId(payload.session_id);
      setSaveOk(t("План сохранён.", "Plan saved."));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handlePlanTableChange(next: ProgramPlanTable) {
    setPlanTable(next);
    const plan_segments = mergeSegmentsWithPlanTable(artifacts.plan_segments, next);
    const nextArtifacts = mergeArtifacts(artifacts, { plan_segments });
    setArtifacts(nextArtifacts);
    setDraft((d) => ({ ...d, artifacts_json: JSON.stringify(nextArtifacts) }));
  }

  function importPlanRowsFromAi(_data?: any) {
    const table = extractProgramPlanTable({
      segments: artifacts.plan_segments,
      planText: draft.plan_text,
      fallbackHeaders: groupSessionHeaders,
    });
    if (!table.rows.length) return;
    handlePlanTableChange(table);
  }

  async function handleSaveAiDoc(stage: ArchitectStageId, text: string, segments?: Record<string, string>) {
    if (!savedSessionId) throw new Error(t("Сначала сохраните план.", "Save the plan first."));
    const rowNote = (stage === "plan") ? t(" Данные перенесены в таблицу и поля формы.", " Data copied to table and form fields.") : t(" Данные перенесены в отчет.", " Data copied to report.");
    
    setDraft((d) => {
      const nextDraft = {
        ...d,
        plan_text: stage === "plan" ? text : d.plan_text,
        report_text: stage === "report" ? text : (d.report_text || ""),
      };

      if (segments) {
        if (stage === "plan") {
          if (segments.passport) {
            nextDraft.theme = segments.passport.slice(0, 100);
          }
        } else if (stage === "report") {
          if (segments.justification) {
            nextDraft.notes = segments.justification;
          }
          if (segments.conclusion) {
            nextDraft.report_text = segments.conclusion;
          }
        }
      }
      return nextDraft;
    });

    if (stage === "plan" && segments?.data_stream) {
      importPlanRowsFromAi();
    }

    await updateGroupSession(savedSessionId, {
      plan_text: stage === "plan" ? text : undefined,
      report_text: stage === "report" ? text : undefined,
    });
    setSaveOk((stage === "plan" ? t("План сохранён.", "Plan saved.") : t("Отчёт сохранён.", "Report saved.")) + rowNote);
    await reload();
  }

  return (
    <div className="workspace-panel-stack group-sessions-journal">
      {!editorOpen && (
        <section className="card group-work-hub">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: introDismissed ? "12px" : "8px" }}>
            <h2 style={{ margin: 0 }}>{t("Групповая работа", "Group work")}</h2>
            {!introDismissed && (
              <button
                type="button"
                className="linkish"
                onClick={handleDismissIntro}
                style={{
                  fontSize: "12.5px",
                  whiteSpace: "nowrap",
                  color: "var(--muted)",
                  padding: "2px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "transparent",
                  cursor: "pointer",
                }}
                title={t("Больше не показывать описание", "Do not show again")}
              >
                ✕ {t("Больше не показывать", "Don't show again")}
              </button>
            )}
          </div>
          {!introDismissed && <p className="muted" style={{ marginTop: "4px" }}>{PLAN_JOURNAL_INTRO}</p>}

          {busy && entries.length === 0 ? <p className="muted">{t("Загрузка…", "Loading…")}</p> : null}

          {!busy && entries.length === 0 && (
            <div className="group-work-empty">
              <p className="muted">{PLAN_JOURNAL_EMPTY}</p>
              <button type="button" className="ob-btn group-work-create-btn" onClick={openNewCard}>
                {t("Создать план", "Create plan")}
              </button>
            </div>
          )}

          {entries.length > 0 && (
            <>
              <div className="group-work-hub-toolbar">
                <h3 className="group-work-hub-list-title">{t("В журнале планов", "In plan journal")}</h3>
                <button type="button" className="ob-btn group-work-create-btn" onClick={openNewCard}>
                  {t("Создать план", "Create plan")}
                </button>
              </div>
              <WorkspaceListSortBar
                options={PERSON_CARD_SORT_OPTIONS}
                value={listSort}
                onChange={setListSort}
              />
              <ul className="group-session-list case-pick-list">
                {sortedEntries.map((row) => (
                  <li key={row.session_id}>
                    <button
                      type="button"
                      className="case-pick-row"
                      onClick={() => loadEntry(row)}
                    >
                      <span className="case-pick-title">{row.title || t("Без названия", "Untitled")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && !editorOpen && <p className="error">{error}</p>}
        </section>
      )}

      {editorOpen && (
        <section className="card group-session-editor">
          <div className="group-session-editor-head">
            <h3>{cardSaved ? t("План групповой работы", "Group Work Plan") : t("Новый план", "New Plan")}</h3>
            <div className="group-session-editor-actions">
              <button type="button" className="ob-btn secondary" onClick={closeEditor}>
                {t("← К списку", "← Back to list")}
              </button>
              <button type="button" className="ob-btn" disabled={busy} onClick={() => void handleSave()}>
                {busy ? "…" : cardSaved ? t("Сохранить изменения", "Save changes") : t("Сохранить", "Save")}
              </button>
            </div>
          </div>
          {saveOk && <p className="ok tiny">{saveOk}</p>}

          <div className="group-session-editor-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <button
              type="button"
              className={`ob-btn ${activeTab === "plan" ? "" : "secondary"}`}
              onClick={() => setActiveTab("plan")}
            >
              {t("Вкладка 1: План занятия", "Tab 1: Session Plan")}
            </button>
            <button
              type="button"
              className={`ob-btn ${activeTab === "report" ? "" : "secondary"}`}
              onClick={() => setActiveTab("report")}
              disabled={!cardSaved}
            >
              {t("Вкладка 2: Отчёт по занятию", "Tab 2: Session Report")}
            </button>
          </div>

          {activeTab === "plan" && (
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="group"
              documentContext={aiContext}
              cardSaved={cardSaved}
              onApplyResult={handleSaveAiDoc}
              showReportButton={false}
              planButtonLabel={t("Сгенерировать план занятия", "Generate session plan")}
              showExpertiseButton={true}
              expertiseButtonLabel={t("Экспертиза плана занятия", "Session plan assessment")}
              expertProtocolId="audit"
              customExpertisePrompt={t("Проведи методический аудит плана группового занятия: цели, соответствие целевой аудитории, используемые техники, риски и рекомендации по улучшению.", "Conduct a methodological audit of the group session plan: goals, alignment with target audience, techniques used, risks, and recommendations for improvement.")}
            />
          )}

          {activeTab === "report" && (
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="group"
              documentContext={aiContext}
              cardSaved={cardSaved}
              onApplyResult={handleSaveAiDoc}
              showPlanButton={false}
              reportButtonLabel={t("Сгенерировать отчёт", "Generate report")}
            />
          )}

          <form className="group-session-form" onSubmit={(e) => void handleSave(e)}>
            {activeTab === "plan" && (
              <section className="group-session-block">
                <h4 className="group-session-block-title">{t("Паспорт", "Passport")}</h4>
                <label className="field">
                  <span>{t("Название плана", "Plan title")}</span>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder={
                      isCorporate
                        ? t("Например: Воркшоп по выгоранию для тимлидов", "e.g. Burnout workshop for team leads")
                        : commercial
                          ? t("Например: Группа поддержки, весна", "e.g. Support group, Spring")
                          : t("Например: Профилактика тревожности, 7А", "e.g. Anxiety prevention, 7A")
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("Дата начала (ориентир)", "Start date (estimate)")}</span>
                  <input
                    type="date"
                    value={draft.session_date}
                    onChange={(e) => setDraft((d) => ({ ...d, session_date: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>{t("Длительность (мин)", "Duration (min)")}</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.duration_minutes}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        duration_minutes: Number.parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </label>
                <TargetAudienceFields
                  context={audienceContext}
                  value={draft.audience}
                  onChange={(audience) => {
                    const linkFromCat: Partial<Record<TargetCategory, PreventionLink>> = {
                      universal: "L1_universal",
                      selective: "L2_selective",
                      indicated: "L3_indicated",
                      secondary: "L4_secondary",
                      tertiary: "L5_tertiary",
                    };
                    const autoLink = linkFromCat[audience.category];
                    setDraft((d) => ({
                      ...d,
                      audience,
                      audience_json: serializeTargetAudience(audience),
                      ...(autoLink ? { preventionLink: autoLink, prevention_link: autoLink } : {}),
                    }));
                  }}
                  disabled={busy}
                  aiEnabled={subscriptionActive}
                />
                <SessionTagsEditor
                  profile="group"
                  commercial={commercial}
                  value={draft.sessionTags}
                  onChange={(sessionTags) =>
                    setDraft((d) => ({
                      ...d,
                      sessionTags,
                      session_tags_json: serializeSessionTags(sessionTags),
                    }))
                  }
                  disabled={busy}
                />
                <label className="field">
                  <span>{t("Тема / фокус", "Theme / Focus")}</span>
                  <input
                    type="text"
                    value={draft.theme}
                    onChange={(e) => setDraft((d) => ({ ...d, theme: e.target.value }))}
                    placeholder={t("Кратко: цель занятия", "Briefly: session goal")}
                  />
                </label>
              </section>
            )}

            {activeTab === "plan" && (
              <section className="group-session-block">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h4 className="group-session-block-title" style={{ margin: 0 }}>
                    {t(
                      `👥 Участники занятия из реестра (${selectedParticipantIds.length})`,
                      `👥 Session Participants from Registry (${selectedParticipantIds.length})`,
                    )}
                  </h4>
                </div>
                <p className="muted tiny" style={{ marginBottom: "12px" }}>
                  {isCorporate
                    ? t(
                        "При добавлении сотрудников из реестра отметка об участии в занятии и затраченные часы автоматически фиксируются в их профилях и журнале учёта специалиста.",
                        "When adding employees from the registry, session participation and hours are automatically recorded in their profiles and specialist workload journal.",
                      )
                    : commercial
                      ? t(
                          "При добавлении клиентов из реестра отметка об участии в занятии и затраченные часы автоматически фиксируются в их карточках и журнале учёта специалиста.",
                          "When adding clients from the registry, session participation and hours are automatically recorded in their records and specialist workload journal.",
                        )
                      : t(
                          "При добавлении обучающихся из реестра отметка об участии в занятии и затраченные часы автоматически фиксируются в их личных делах (ИПР) и журнале учёта специалиста.",
                          "When adding students from the registry, session participation and hours are automatically recorded in their case files (IPR) and specialist workload journal.",
                        )}
                </p>

                {selectedParticipantIds.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                    {selectedParticipantIds.map((cid) => {
                      const s = registrySubjects.find((sub) => sub.case_id === cid);
                      const name = s?.profile?.full_name || (s?.profile as any)?.student_name || s?.situation_title || cid;
                      const grade = s?.profile?.grade_class || (s?.profile as any)?.grade ? `(${s?.profile?.grade_class || (s?.profile as any)?.grade})` : "";
                      const hasIpr = iprCaseIds.has(cid);
                      return (
                        <span
                          key={cid}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "16px",
                            background: hasIpr ? "rgba(79, 70, 229, 0.12)" : "rgba(16, 185, 129, 0.12)",
                            color: hasIpr ? "var(--accent-indigo, #4f46e5)" : "var(--accent-emerald, #059669)",
                            border: `1px solid ${hasIpr ? "rgba(79, 70, 229, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                            fontSize: "0.85rem",
                            fontWeight: 500,
                          }}
                        >
                          <span>👤 {name} {grade}</span>
                          {hasIpr && (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                padding: "1px 5px",
                                borderRadius: "8px",
                                background: "rgba(79, 70, 229, 0.18)",
                                fontWeight: 600,
                              }}
                              title={t("Обучающийся состоит на ИПР", "Student is enrolled in IPR")}
                            >
                              📋 ИПР
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRemoveParticipant(cid)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "inherit",
                              cursor: "pointer",
                              padding: "0 2px",
                              fontWeight: "bold",
                              lineHeight: 1,
                            }}
                            title={t("Удалить из участников", "Remove participant")}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {availableRegistrySubjects.length > 0 ? (
                  <div style={{ maxWidth: "420px" }}>
                    <select
                      value=""
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddParticipant(e.target.value);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-input, inherit)",
                        color: "inherit",
                        fontSize: "0.9rem",
                      }}
                    >
                      <option value="">
                        {t("+ Добавить обучающегося из реестра…", "+ Add student from registry…")}
                      </option>
                      {availableRegistrySubjects.map((s) => {
                        const name = s.profile?.full_name || (s.profile as any)?.student_name || s.situation_title;
                        const grade = s.profile?.grade_class || (s.profile as any)?.grade ? `(${s.profile?.grade_class || (s.profile as any)?.grade})` : "";
                        const hasIpr = iprCaseIds.has(s.case_id);
                        return (
                          <option key={s.case_id} value={s.case_id}>
                            {name} {grade} {hasIpr ? "📋 [на ИПР]" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : registrySubjects.length === 0 ? (
                  <p className="muted tiny">
                    {t("В реестре пока нет карточек обучающихся.", "No student cards in registry yet.")}
                  </p>
                ) : (
                  <p className="muted tiny">
                    {t("Все обучающиеся из реестра уже добавлены в группу.", "All registry students already added to group.")}
                  </p>
                )}
              </section>
            )}

            {activeTab === "plan" && (
              <section className="group-session-block">
                <h4 className="group-session-block-title">{t("План", "Plan")}</h4>
                <ProgramPlanRowsEditor
                  table={planTable}
                  onChange={handlePlanTableChange}
                  disabled={busy}
                />
              </section>
            )}
            {activeTab === "report" && (
              <section className="group-session-block">
                <h4 className="group-session-block-title">{t("Отчёт", "Report")}</h4>
                {selectedParticipantIds.length > 0 && (
                  <div
                    style={{
                      marginBottom: "14px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "8px", color: "var(--text-muted)" }}>
                      {t(`👥 Состав группы (${selectedParticipantIds.length}):`, `👥 Group Members (${selectedParticipantIds.length}):`)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {selectedParticipantIds.map((cid) => {
                        const s = registrySubjects.find((sub) => sub.case_id === cid);
                        const name = s?.profile?.full_name || (s?.profile as any)?.student_name || s?.situation_title || cid;
                        const grade = s?.profile?.grade_class || (s?.profile as any)?.grade ? `(${s?.profile?.grade_class || (s?.profile as any)?.grade})` : "";
                        const hasIpr = iprCaseIds.has(cid);
                        return (
                          <span
                            key={cid}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              background: hasIpr ? "rgba(79, 70, 229, 0.1)" : "rgba(16, 185, 129, 0.1)",
                              color: hasIpr ? "var(--accent-indigo, #4f46e5)" : "var(--accent-emerald, #059669)",
                              border: `1px solid ${hasIpr ? "rgba(79, 70, 229, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
                              fontSize: "0.8rem",
                              fontWeight: 500,
                            }}
                          >
                            <span>👤 {name} {grade}</span>
                            {hasIpr && <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>📋 ИПР</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="muted tiny">
                  {t("Характеристика группы, заметки и результаты. Поля заполняются автоматически при генерации отчета.", "Group description, notes, and results. Fields are populated automatically during report generation.")}
                </p>
                <div className="summary-split-block wide" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="field">
                      <span>{t("Характеристика группы и заметки", "Group description and notes")}</span>
                      <textarea
                        rows={8}
                        value={draft.notes}
                        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                        placeholder={t("Например: Группа была активна, но двое участников...", "e.g. The group was active, but two participants...")}
                      />
                    </label>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="field">
                      <span>{t("Итоги и решения (результат)", "Outcomes and resolutions (results)")}</span>
                      <textarea
                        rows={8}
                        value={draft.report_text}
                        onChange={(e) => setDraft((d) => ({ ...d, report_text: e.target.value }))}
                        placeholder={t("Например: Цель достигнута, рекомендована повторная встреча...", "e.g. Goal achieved, follow-up session recommended...")}
                      />
                    </label>
                  </div>
                </div>
              </section>
            )}
          </form>

          {error && <p className="ai-error">{error}</p>}
        </section>
      )}
    </div>
  );
}
