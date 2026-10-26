import { t } from "../lib/i18n.ts";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import IprContactSedSection, { type ContactSedData } from "./IprContactSedSection.tsx";
import IprCaseWalkthroughModal from "./IprCaseWalkthroughModal.tsx";
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
import { useUnsavedChanges, confirmLeaveIfUnsaved } from "../lib/unsaved_changes.ts";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("terminal_ipr_intro_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const handleDismissIntro = useCallback(() => {
    setIntroDismissed(true);
    try {
      localStorage.setItem("terminal_ipr_intro_dismissed", "1");
    } catch {
      // ignore
    }
  }, []);


  const selectedIpr = selectedIprId ? iprs.find((row) => row.id === selectedIprId) ?? null : null;
  const sortedIprs = useMemo(() => sortIprRecords(iprs, iprSort), [iprs, iprSort]);
  const subjectLabel = selectedProfile?.full_name || "";

  const handleOpenKirillDemo = useCallback(() => {
    const kirill = registrySubjects.find(
      (s) =>
        s.id === "reg-demo-sokolov-01" ||
        s.case_id === "reg-demo-sokolov-01" ||
        s.profile?.full_name?.includes("Соколов") ||
        s.situation_title?.includes("Соколов"),
    );
    if (kirill) {
      onRegistrySubjectSelect(kirill.id || kirill.case_id);
    }
  }, [registrySubjects, onRegistrySubjectSelect]);

  useEffect(() => {
    if (!registryEnabled) return;
    let cancelled = false;
    void listRegistrySubjects().then((rows) => {
      if (!cancelled) {
        setRegistrySubjects(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [registryEnabled]);

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

  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("");

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      contactSed,
      planText,
      reportText,
      audience,
      sessionTags,
      planTable,
    });
  }, [contactSed, planText, reportText, audience, sessionTags, planTable]);

  const isDirty = useMemo(() => {
    return Boolean(
      editorOpen &&
      selectedIpr &&
      lastSavedSnapshot &&
      currentSnapshot !== lastSavedSnapshot
    );
  }, [editorOpen, selectedIpr, lastSavedSnapshot, currentSnapshot]);

  useUnsavedChanges(
    "ipr-workspace-card",
    isDirty,
    "Внимание: у вас есть несохранённые изменения в формах ИПР!\n\nЕсли вы перейдёте в другой раздел прямо сейчас, введённые данные будут потеряны.\n\nНажмите «Отмена», чтобы остаться и сохранить данные.\nНажмите «ОК», чтобы уйти без сохранения."
  );

  useEffect(() => {
    if (!selectedIpr) {
      setArtifacts({});
      setPlanText("");
      setReportText("");
      setAudience(emptyTargetAudience());
      setSessionTags(emptyConsultationSessionTags());
      setPlanTable(emptyProgramPlanTable(IPR_PLAN_HEADERS));
      setLastSavedSnapshot("");
      return;
    }
    const nextArtifacts = parseIprArtifacts(selectedIpr.artifacts_json);
    setArtifacts(nextArtifacts);
    const nextPlan = selectedIpr.plan_text || "";
    const nextReport = selectedIpr.report_text || "";
    const nextAudience = parseTargetAudienceJson(selectedIpr.audience_json);
    const nextTags = parseSessionTagsJson(selectedIpr.session_tags_json);
    const nextSed = nextArtifacts.contact_sed || {};
    const nextTable = extractProgramPlanTable({
      segments: nextArtifacts.plan_segments,
      planText: selectedIpr.plan_text || "",
      fallbackHeaders: IPR_PLAN_HEADERS,
    });

    setPlanText(nextPlan);
    setReportText(nextReport);
    setAudience(nextAudience);
    setSessionTags(nextTags);
    setContactSed(nextSed);
    setPlanTable(nextTable);

    setLastSavedSnapshot(
      JSON.stringify({
        contactSed: nextSed,
        planText: nextPlan,
        reportText: nextReport,
        audience: nextAudience,
        sessionTags: nextTags,
        planTable: nextTable,
      })
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
          setCaseVisits(
            rows.filter((r) => r.action_kind === "consultation" || r.action_kind === "group_session"),
          );
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
      setEditorOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let rows = await listIprs(registrySubjectId);
      if (rows.length === 0) {
        // Автоматически создаем карточку ИПР для выбранного человека,
        // чтобы специалисту не нужно было проходить лишние промежуточные уровни
        const defaultTitle = subjectLabel ? `ИПР — ${subjectLabel}` : "Индивидуальная программа сопровождения";
        const newId = await createIpr(registrySubjectId, defaultTitle);
        rows = await listIprs(registrySubjectId);
        setSelectedIprId(newId);
        setEditorOpen(true);
      } else {
        setSelectedIprId((prev) => {
          if (prev && rows.some((r) => r.id === prev)) return prev;
          return rows[0].id;
        });
        setEditorOpen(true);
      }
      setIprs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [registrySubjectId, subjectLabel]);

  useEffect(() => {
    void reloadPlans();
  }, [reloadPlans]);

  function handleBackToSubjectList() {
    if (!confirmLeaveIfUnsaved()) return;
    setSelectedIprId(null);
    setEditorOpen(false);
    onRegistrySubjectSelect(null);
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
      setLastSavedSnapshot(currentSnapshot);
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

      {!registrySubjectId && !introDismissed && (
        <section
          className="card text-block"
          style={{
            borderLeft: "4px solid var(--violet)",
            background: "rgba(139, 92, 246, 0.05)",
            padding: "18px 20px",
            marginBottom: "16px",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ flex: "1 1 520px" }}>
              <h3 style={{ margin: "0 0 8px 0", color: "var(--violet)", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
                <span>📌</span>
                <span>{t("Индивидуальный профилактический маршрут (ИПР)", "Individual Prevention Plan (IPP)")}</span>
              </h3>
              <p style={{ lineHeight: "1.5", margin: 0, fontSize: "14px", color: "var(--text)" }}>
                <strong>Индивидуальный профилактический маршрут (ИПР)</strong> — ключевой инструмент психолого-педагогического сопровождения группы риска, основанный на доказательной профилактике и требованиях 120-ФЗ.
              </p>
              <p className="muted" style={{ lineHeight: "1.5", marginTop: "8px", marginBottom: 0, fontSize: "13px" }}>
                Маршрутизация строится по принципу адресности: на основе выявленных рисков и защитных ресурсов в 9 жизненных сферах формируется согласованный план действий (психологических, образовательных, правовых и досуговых), позволяющий нивелировать девиантные траектории без карательных мер.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", alignSelf: "center" }}>
              <a
                href="https://prevention-ai.ru/academy/course/player.html#14"
                target="_blank"
                rel="noopener noreferrer"
                className="ob-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--violet)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "13px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(139, 92, 246, 0.25)",
                }}
                title="Смотреть лекцию по ИПР в Академии профилактики"
              >
                <span>🎓</span>
                <span>{t("Видеолекция по ИПР", "IPP Video Lecture")}</span>
                <span style={{ opacity: 0.8, fontSize: "11px" }}>↗</span>
              </a>
              <button
                type="button"
                onClick={handleDismissIntro}
                style={{
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  color: "var(--muted)",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Больше не показывать этот блок"
              >
                {t("✕ Больше не показывать", "✕ Don't show again")}
              </button>
            </div>
          </div>
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
            <h3>{commercial ? t("ИПР клиента", "Client IPP") : t("ИПР обучающегося", "Student IPP")}</h3>
            <RegistrySubjectFioField
              subjects={registrySubjects}
              selectedCaseId={registrySubjectId}
              onSelect={(row) => onRegistrySubjectSelect(row?.case_id ?? null)}
              label={t("ФИО", "Full Name")}
              hint={commercial ? t("Введите фамилию и выберите клиента из списка — его ИПР откроется ниже.", "Enter name and select client from list — their IPP will open below.") : t("Введите фамилию и выберите обучающегося из реестра — его ИПР откроется ниже.", "Enter name and select student from registry — their IPP will open below.")}
              showGradeClass={!commercial}
            />
            {registrySubjects.length === 0 && (
              <p className="muted tiny">
                {commercial ? t("Список клиентов пуст. ", "Client list is empty. ") : t("Реестр пуст. ", "Registry is empty. ")}
                <button type="button" className="linkish" onClick={onOpenRegistry}>
                  {commercial ? t("Добавить клиента", "Add client") : t("Добавить обучающегося", "Add student")}
                </button>
              </p>
            )}
            {registrySubjects.length > 0 && (
              <>
                <p className="muted tiny consultation-registry-list-hint">{t("Или выберите из списка:", "Or select from list:")}</p>
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
                          {row.profile.full_name || row.situation_title || t("Без имени", "Unnamed")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          )}

          {registrySubjectId && busy && !selectedIpr && (
            <section className="card">
              <p className="muted">{t("Загрузка карточки ИПР…", "Loading IPP record...")}</p>
            </section>
          )}

          {registrySubjectId && selectedIpr && (
            <>
              <section className="card">
                <div className="group-session-editor-head">
                  <div>
                    <h3>{selectedIpr.title}</h3>
                    {subjectLabel && <p className="muted tiny" style={{ margin: 0 }}>{subjectLabel}</p>}
                  </div>
                  <div className="group-session-editor-actions">
                    <button type="button" className="ob-btn secondary" onClick={handleBackToSubjectList}>
                      {t("← К списку обучающихся", "← Back to student list")}
                    </button>
                    {iprs.length > 1 && (
                      <label className="field ipr-plan-picker">
                        <span className="muted">{t("План:", "Plan:")}</span>
                        <select
                          className="ob-select auto"
                          value={selectedIpr.id}
                          onChange={(e) => setSelectedIprId(e.target.value)}
                        >
                          {iprs.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title || t("План", "Plan")} ({IPR_STATUS_LABEL[item.status]})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                <div className="ipr-plan-meta">
                  <p className="muted tiny">{t("Статус:", "Status:")} {IPR_STATUS_LABEL[selectedIpr.status]}</p>
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
                  adolescentName={selectedIpr.title || subjectLabel || ""}
                  data={contactSed}
                  onChange={setContactSed}
                  disabled={busy}
                  terminalUserId={terminalUserId}
                  subscriptionActive={subscriptionActive}
                  paywallUrl={paywallUrl}
                  caseVisits={caseVisits}
                  caseArtifacts={caseArtifacts}
                  caseId={selectedIpr.case_id || registrySubjectId || undefined}
                />

                <button
                  type="button"
                  className={`ob-btn ${isDirty ? "primary" : ""}`}
                  style={isDirty ? { fontWeight: 600, backgroundColor: "#2563eb", color: "#fff" } : undefined}
                  disabled={busy}
                  onClick={() => void handleSaveIprCard()}
                >
                  {busy ? "…" : isDirty ? t("● Сохранить", "● Save") : t("Сохранить", "Save")}
                </button>
              </section>
            </>
          )}
        </>
      )}

      {error && <p className="ai-error">{error}</p>}

      <IprCaseWalkthroughModal
        isOpen={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        onSelectKirillDemo={handleOpenKirillDemo}
      />
    </div>
  );
}
