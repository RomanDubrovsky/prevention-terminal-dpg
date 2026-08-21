import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import ProgramPlanRowsEditor from "./ProgramPlanRowsEditor.tsx";
import PreventionWorkTypesPicker from "./PreventionWorkTypesPicker.tsx";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import { PLAN_JOURNAL_EMPTY, PLAN_JOURNAL_INTRO } from "../content/plan_workspace_copy.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
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

  const cardSaved = Boolean(savedSessionId && savedSessionId === draft.session_id);

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
  }, [reload]);

  const aiContext = useMemo(
    () =>
      buildGroupSessionAiContext({
        ...draft,
        audience_json: serializeTargetAudience(draft.audience),
        prevention_link: draft.preventionLink,
        prevention_work_types_json: serializePreventionWorkTypes(draft.workTypes),
        session_tags_json: serializeSessionTags(draft.sessionTags),
      }),
    [draft],
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
      const nextArtifacts =
        planTable.rows.length > 0
          ? mergeArtifacts(artifacts, { plan_segments: planSegments })
          : artifacts;
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
          <h2>{t("Групповая работа", "Group work")}</h2>
          <p className="muted">{PLAN_JOURNAL_INTRO}</p>

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
                    placeholder={commercial ? t("Например: Группа поддержки, весна", "e.g. Support group, Spring") : t("Например: Профилактика тревожности, 7А", "e.g. Anxiety prevention, 7A")}
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
                {!commercial && (
                  <PreventionWorkTypesPicker
                    value={draft.workTypes}
                    preventionLink={draft.preventionLink}
                    compact
                    allowCustom={false}
                    onChange={(workTypes) =>
                      setDraft((d) => ({
                        ...d,
                        workTypes,
                        prevention_work_types_json: serializePreventionWorkTypes(workTypes),
                      }))
                    }
                    disabled={busy}
                  />
                )}
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
