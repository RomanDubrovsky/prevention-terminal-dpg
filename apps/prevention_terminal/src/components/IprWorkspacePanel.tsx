import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import IprContactSedSection, { type ContactSedData } from "./IprContactSedSection.tsx";
import RegistrySubjectFioField from "./RegistrySubjectFioField.tsx";
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import { PLAN_JOURNAL_INTRO } from "../content/plan_workspace_copy.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { getCaseArtifacts, type CaseArtifactsPayload } from "../lib/case_store.ts";
import {
  getRegistrySubjectProfile,
  listRegistrySubjects,
  registryRequiredForIpr,
  type RegistrySubjectSummary,
} from "../lib/registry_store.ts";
import type { RegistryProfile } from "../lib/registry_profile.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import {
  IPR_STATUS_LABEL,
  createIpr,
  listIprs,
  parseIprArtifacts,
  updateIpr,
  type IprRecord,
} from "../lib/ipr_store.ts";
import { IPR_STATUS_VALUES } from "../lib/taxonomy.ts";
import {
  emptyTargetAudience,
  parseTargetAudienceJson,
  serializeTargetAudience,
  type TargetAudienceData,
} from "../lib/target_audience.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import {
  type SessionArtifacts,
} from "../lib/section_artifacts.ts";
import {
  emptyProgramPlanTable,
  extractProgramPlanTable,
  IPR_PLAN_HEADERS,
  mergeSegmentsWithPlanTable,
  type ProgramPlanTable,
} from "../lib/program_plan_rows.ts";
import {
  emptyConsultationSessionTags,
  parseSessionTagsJson,
  serializeSessionTags,
  type ConsultationSessionTags,
} from "../lib/session_tagging.ts";
import type { WorkLogEntry } from "../lib/worklog.ts";
import {
  PERSON_CARD_SORT_OPTIONS,
  sortIprRecords,
  sortRegistrySubjects,
  type PersonCardSort,
} from "../lib/workspace_list_sort.ts";

interface IprWorkspacePanelProps {
  cfg: TerminalConfig;
  registrySubjectId: string | null;
  onRegistrySubjectSelect: (caseId: string | null) => void;
  onOpenRegistry: () => void;
  terminalUserId?: string;
}

export default function IprWorkspacePanel(props: IprWorkspacePanelProps) {
  const { cfg, registrySubjectId, onRegistrySubjectSelect, onOpenRegistry, terminalUserId } = props;
  const commercial = isCommercialOrg(cfg);
  const registryEnabled = registryRequiredForIpr(cfg);
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(terminalUserId);

  const [registrySubjects, setRegistrySubjects] = useState<RegistrySubjectSummary[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<RegistryProfile | null>(null);
  const [subjectSort, setSubjectSort] = useState<PersonCardSort>("name_asc");
  const [iprSort, setIprSort] = useState<PersonCardSort>("created_desc");

  const sortedRegistrySubjects = useMemo(
    () => sortRegistrySubjects(registrySubjects, subjectSort),
    [registrySubjects, subjectSort],
  );

  const [iprs, setIprs] = useState<IprRecord[]>([]);
  const [selectedIprId, setSelectedIprId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPlanTitle, setNewPlanTitle] = useState("ИПР");
  const [artifacts, setArtifacts] = useState<SessionArtifacts>({});
  const [planText, setPlanText] = useState("");
  const [reportText, setReportText] = useState("");
  const [caseVisits, setCaseVisits] = useState<WorkLogEntry[]>([]);
  const [caseArtifacts, setCaseArtifacts] = useState<CaseArtifactsPayload>({});
  const [audience, setAudience] = useState<TargetAudienceData>(emptyTargetAudience);
  const [sessionTags, setSessionTags] = useState<ConsultationSessionTags>(emptyConsultationSessionTags);
  const [planTable, setPlanTable] = useState<ProgramPlanTable>(() =>
    emptyProgramPlanTable(IPR_PLAN_HEADERS),
  );
  const [contactSed, setContactSed] = useState<ContactSedData>({});

  const selectedIpr = selectedIprId ? iprs.find((row) => row.id === selectedIprId) ?? null : null;
  const sortedIprs = useMemo(() => sortIprRecords(iprs, iprSort), [iprs, iprSort]);
  const subjectLabel = selectedProfile?.full_name || "";

  useEffect(() => {
    if (!registryEnabled) return;
    let cancelled = false;
    void listRegistrySubjects().then((rows) => {
      if (!cancelled) setRegistrySubjects(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [registryEnabled, registrySubjectId]);

  useEffect(() => {
    if (!registryEnabled || !registrySubjectId) {
      setSelectedProfile(null);
      return;
    }
    let cancelled = false;
    void getRegistrySubjectProfile(registrySubjectId).then((profile) => {
      if (!cancelled) setSelectedProfile(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [registryEnabled, registrySubjectId]);

  useEffect(() => {
    if (!registrySubjectId) {
      setCaseArtifacts({});
      return;
    }
    let cancelled = false;
    void getCaseArtifacts(registrySubjectId).then((payload) => {
      if (!cancelled) setCaseArtifacts(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [registrySubjectId, caseVisits.length]);

  useEffect(() => {
    if (!selectedIpr) {
      setArtifacts({});
      setPlanText("");
      setReportText("");
      setAudience(emptyTargetAudience());
      setSessionTags(emptyConsultationSessionTags());
      setPlanTable(emptyProgramPlanTable(IPR_PLAN_HEADERS));
      return;
    }
    const nextArtifacts = parseIprArtifacts(selectedIpr.artifacts_json);
    setArtifacts(nextArtifacts);
    setPlanText(selectedIpr.plan_text || "");
    setReportText(selectedIpr.report_text || "");
    setAudience(parseTargetAudienceJson(selectedIpr.audience_json));
    setSessionTags(parseSessionTagsJson(selectedIpr.session_tags_json));
    setContactSed(nextArtifacts.contact_sed || {});
    setPlanTable(
      extractProgramPlanTable({
        segments: nextArtifacts.plan_segments,
        planText: selectedIpr.plan_text || "",
        fallbackHeaders: IPR_PLAN_HEADERS,
      }),
    );
  }, [selectedIpr?.id, selectedIpr?.artifacts_json, selectedIpr?.plan_text, selectedIpr?.report_text, selectedIpr?.audience_json, selectedIpr?.session_tags_json]);

  useEffect(() => {
    if (!registrySubjectId) {
      setCaseVisits([]);
      return;
    }
    let cancelled = false;
    void invoke<WorkLogEntry[]>("db_list_work_log_entries", { caseId: registrySubjectId }).then(
      (rows) => {
        if (!cancelled) {
          setCaseVisits(rows.filter((r) => r.action_kind === "consultation"));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [registrySubjectId]);

  // AI Context placeholder if needed later

  const reloadPlans = useCallback(async () => {
    if (!registrySubjectId) {
      setIprs([]);
      setSelectedIprId(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await listIprs(registrySubjectId);
      setIprs(rows);
      setSelectedIprId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [registrySubjectId]);

  useEffect(() => {
    void reloadPlans();
  }, [reloadPlans]);

  async function handleCreatePlan(e: FormEvent) {
    e.preventDefault();
    if (!registrySubjectId) {
      setError("Выберите человека из реестра.");
      return;
    }
    const title = newPlanTitle.trim();
    if (!title) {
      setError("Укажите название плана.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createIpr(registrySubjectId, title);
      setNewPlanTitle("ИПР");
      setSelectedIprId(id);
      setCreatingPlan(false);
      setEditorOpen(true);
      await reloadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function openIprCard(row: IprRecord) {
    setSelectedIprId(row.id);
    setCreatingPlan(false);
    setEditorOpen(true);
    setError(null);
  }

  async function startNewIprCard() {
    if (!registrySubjectId) {
      setError("Сначала выберите человека из реестра.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const todayStr = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      const defaultTitle = `IEP from ${todayStr}`;
      const id = await createIpr(registrySubjectId, defaultTitle);
      setSelectedIprId(id);
      setCreatingPlan(false);
      setEditorOpen(true);
      await reloadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function closeIprEditor() {
    setEditorOpen(false);
    setCreatingPlan(false);
    setError(null);
  }

  async function persistIprCard(patch: {
    plan_text?: string;
    report_text?: string;
    artifacts?: SessionArtifacts;
    audience_json?: string;
    session_tags_json?: string;
  }) {
    if (!selectedIpr) throw new Error("Нет выбранного ИПР.");
    await updateIpr(selectedIpr.id, patch);
    await reloadPlans();
  }

  async function handleSaveIprCard() {
    if (!selectedIpr) return;
    setBusy(true);
    setError(null);
    try {
      const audienceJson = serializeTargetAudience(audience);
      const sessionTagsJson = serializeSessionTags(sessionTags);
      const planSegments = mergeSegmentsWithPlanTable(artifacts.plan_segments, planTable);
      const nextArtifacts = {
        ...artifacts,
        plan_segments: planTable.rows.length > 0 ? planSegments : artifacts.plan_segments,
        contact_sed: contactSed,
      };
      await persistIprCard({
        plan_text: planText,
        report_text: reportText,
        artifacts: nextArtifacts,
        audience_json: audienceJson,
        session_tags_json: sessionTagsJson,
      });
      setArtifacts(nextArtifacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Plan table change handler placeholder if needed

  async function handlePlanStatusChange(status: IprRecord["status"]) {
    if (!selectedIpr) return;
    setBusy(true);
    setError(null);
    try {
      await updateIpr(selectedIpr.id, { status });
      await reloadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-panel-stack ipr-workspace">
      {!registrySubjectId && (
        <section className="card">
          <h2>ИПР — Индивидуальная программа реабилитации (сопровождения)</h2>
          <p className="muted">
            ИПР ведется только для записей в <strong>Реестре</strong> (персональные данные и личное дело). {PLAN_JOURNAL_INTRO}
          </p>
        </section>
      )}

      {!registryEnabled ? (
        <section className="card workspace-panel-hint">
          <p className="muted">
            ИПР с персональными данными возможен только после создания реестра. Перейдите в раздел{" "}
            <button type="button" className="linkish" onClick={onOpenRegistry}>
              Реестр
            </button>{" "}
            и пройдите мастер настройки.
          </p>
        </section>
      ) : (
        <>
          {!registrySubjectId && (
          <section className="card ipr-child-form">
            <h3>ИПР сопровождаемого</h3>
            <RegistrySubjectFioField
              subjects={registrySubjects}
              selectedCaseId={registrySubjectId}
              onSelect={(row) => onRegistrySubjectSelect(row?.case_id ?? null)}
              label="ФИО"
              hint="Введите фамилию и выберите подопечного из реестра — его ИПР откроется ниже."
              showGradeClass={!commercial}
            />
            {registrySubjects.length === 0 && (
              <p className="muted tiny">
                Реестр пуст.{" "}
                <button type="button" className="linkish" onClick={onOpenRegistry}>
                  Добавить в реестр
                </button>
              </p>
            )}
            {registrySubjects.length > 0 && (
              <>
                <p className="muted tiny consultation-registry-list-hint">Or choose from the list</p>
                <WorkspaceListSortBar
                  options={PERSON_CARD_SORT_OPTIONS}
                  value={subjectSort}
                  onChange={setSubjectSort}
                />
                <ul className="case-pick-list consultation-registry-pick-list">
                  {sortedRegistrySubjects.map((row) => (
                    <li key={row.case_id}>
                      <button
                        type="button"
                        className="case-pick-row"
                        onClick={() => onRegistrySubjectSelect(row.case_id)}
                      >
                        <span className="case-pick-title">
                          {row.profile.full_name || row.situation_title || "Без имени"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          )}

          {registrySubjectId && !editorOpen ? (
          <section className="card workspace-journal-card">
            <div className="workspace-journal-head">
              <div>
                <h3>Журнал планов</h3>
                <p className="muted tiny">{subjectLabel || "Запись реестра"}</p>
              </div>
              <div className="group-session-editor-actions">
                <button
                  type="button"
                  className="ob-btn secondary"
                  onClick={() => onRegistrySubjectSelect(null)}
                >
                  ← Назад к списку
                </button>
                <button type="button" className="ob-btn secondary" onClick={startNewIprCard}>
                  Новый план
                </button>
              </div>
            </div>
            {busy && iprs.length === 0 ? <p className="muted">Загрузка…</p> : null}
            {!busy && iprs.length === 0 ? (
              <p className="muted">Планов ИПР еще нет — нажмите "Новый план".</p>
            ) : null}
            {iprs.length > 0 && (
              <WorkspaceListSortBar
                options={PERSON_CARD_SORT_OPTIONS}
                value={iprSort}
                onChange={setIprSort}
              />
            )}
            <ul className="case-pick-list">
              {sortedIprs.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="case-pick-row"
                    onClick={() => openIprCard(row)}
                  >
                    <span className="case-pick-title">{row.title || "Без названия"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          ) : null}

          {editorOpen && creatingPlan && !selectedIpr && (
            <section className="card">
              <div className="group-session-editor-head">
                <h3>Новый план ИПР</h3>
                <button type="button" className="ob-btn secondary" onClick={closeIprEditor}>
                  ← К списку
                </button>
              </div>
              <form className="ipr-create-form" onSubmit={(e) => void handleCreatePlan(e)}>
                <label className="field">
                  <span>Название плана</span>
                  <input
                    type="text"
                    value={newPlanTitle}
                    onChange={(e) => setNewPlanTitle(e.target.value)}
                    placeholder="ИПР, 2025–2026"
                  />
                </label>
                <button type="submit" className="ob-btn" disabled={busy}>
                  {busy ? "…" : "Создать план ИПР"}
                </button>
              </form>
            </section>
          )}

          {editorOpen && selectedIpr && (
            <>
              <div className="card text-block" style={{ borderLeft: "4px solid var(--violet)", background: "rgba(139, 92, 246, 0.05)", padding: "16px", marginBottom: "16px" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "var(--violet)" }}>📌 Индивидуальный профилактический маршрут (ИПР / IEP)</h4>
                <p className="tiny" style={{ lineHeight: "1.4", margin: 0 }}>
                  <strong>Индивидуальный профилактический маршрут (ИПР)</strong> — это ключевой инструмент психолого-педагогического сопровождения группы риска. В международной практике образования он концептуально опирается на принципы <strong>IEP (Individualized Education Program)</strong> и методологию <em>Evidence-Based Prevention</em> (Доказательная профилактика). 
                </p>
                <p className="tiny muted" style={{ lineHeight: "1.4", marginTop: "6px", marginBottom: 0 }}>
                  Маршрутизация строится по принципу адресности: на основе выявленных рисков и факторов уязвимости в 7 сферах жизнедеятельности формируется гибкий план скоординированных действий (образовательных, социальных, психологических и досуговых), позволяющий нивелировать девиантные траектории без карательных мер.
                </p>
              </div>

              <section className="card">
                <div className="group-session-editor-head">
                  <h3>{selectedIpr.title}</h3>
                  <div className="group-session-editor-actions">
                    <button type="button" className="ob-btn secondary" onClick={closeIprEditor}>
                      ← Назад к списку
                    </button>
                    {iprs.length > 1 && (
                      <label className="field ipr-plan-picker">
                        <span className="muted">Статус:</span>
                        <select
                          className="ob-select auto"
                          value={selectedIpr.status}
                          onChange={(e) => handlePlanStatusChange(e.target.value as any)}
                        >
                          <option value="draft">Черновик</option>
                          <option value="active">Активен</option>
                          <option value="completed">Завершен</option>
                          <option value="archived">Архив</option>
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                <div className="ipr-plan-meta">
                  <p className="muted tiny">Статус: {IPR_STATUS_LABEL[selectedIpr.status]}</p>
                  {selectedIpr.description && <p className="muted">{selectedIpr.description}</p>}
                  <div className="ipr-status-chips">
                    {IPR_STATUS_VALUES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={selectedIpr.status === status ? "active" : ""}
                        disabled={busy || selectedIpr.status === status}
                        onClick={() => void handlePlanStatusChange(status)}
                      >
                        {IPR_STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </div>

                <IprContactSedSection
                  data={contactSed}
                  onChange={setContactSed}
                  disabled={busy}
                  terminalUserId={terminalUserId}
                  subscriptionActive={subscriptionActive}
                  paywallUrl={paywallUrl}
                  caseVisits={caseVisits}
                  caseArtifacts={caseArtifacts}
                />

                <button type="button" className="ob-btn" disabled={busy} onClick={() => void handleSaveIprCard()}>
                  {busy ? "…" : "Сохранить план ИПР"}
                </button>
              </section>
            </>
          )}
        </>
      )}

      {error && <p className="ai-error">{error}</p>}
    </div>
  );
}
