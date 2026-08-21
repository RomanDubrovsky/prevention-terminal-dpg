import { useCallback, useEffect, useMemo, useState } from "react";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import {
  addOrganizationProgram,
  listOrganizationPrograms,
  newOrganizationProgramId,
  updateOrganizationProgram,
  type OrganizationProgramEntry,
} from "../lib/organization_programs.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { PREVENTION_STANDARD_TAXONOMY } from "./SafeEnvironmentTaxonomy.ts";
import type { ArchitectStageId } from "../lib/architect_picker.ts";

type ProgramDraft = Omit<OrganizationProgramEntry, "created_at" | "updated_at"> & {
  actions?: {
    id: string;
    category: string;
    actionName: string;
    plannedDate?: string;
    actualDate?: string;
    executor?: string;
    notes?: string;
  }[];
};

function currentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 9) return `${year}–${year + 1}`;
  return `${year - 1}–${year}`;
}

function emptyDraft(): ProgramDraft {
  return {
    program_id: "",
    title: "",
    program_year: currentSchoolYear(),
    scope: "",
    notes: "",
    plan_text: "",
    report_text: "",
    artifacts_json: "{}",
    audience_json: "{}",
    prevention_link: "L1_universal",
    prevention_work_types_json: "{}",
    actions: [],
  };
}

interface SafeEnvironmentWorkspaceProps {
  terminalUserId?: string;
}

export default function SafeEnvironmentWorkspace(props: SafeEnvironmentWorkspaceProps) {
  const { terminalUserId } = props;
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(terminalUserId);

  const [entries, setEntries] = useState<OrganizationProgramEntry[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProgramDraft>(emptyDraft);
  const [savedProgramId, setSavedProgramId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const cardSaved = Boolean(savedProgramId && savedProgramId === draft.program_id);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setEntries(await listOrganizationPrograms());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const aiContext = useMemo(() => {
    return `[Безопасная среда: Программа организации]
Название: ${draft.title}
Период: ${draft.program_year}
План (текст): ${draft.plan_text}
Отчет (текст): ${draft.report_text}
Рекомендации по экспертизе: ${draft.notes}
Запланированные действия: ${JSON.stringify(draft.actions || [])}`;
  }, [draft]);

  function openNewCard() {
    const id = newOrganizationProgramId();
    setDraft({ ...emptyDraft(), program_id: id });
    setSavedProgramId(null);
    setSaveOk(null);
    setError(null);
    setEditorOpen(true);
  }

  function loadEntry(row: OrganizationProgramEntry) {
    let parsedActions = [];
    try {
      const art = JSON.parse(row.artifacts_json || "{}");
      if (Array.isArray(art.actions)) {
        parsedActions = art.actions;
      }
    } catch {
      // ignore
    }
    setDraft({
      ...row,
      actions: parsedActions,
    });
    setSavedProgramId(row.program_id);
    setSaveOk(null);
    setError(null);
    setEditorOpen(true);
  }

  const closeEditor = () => {
    setEditorOpen(false);
    setSavedProgramId(null);
    void reload();
  };

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSaveOk(null);
    try {
      let currentArtifacts = {};
      try {
        currentArtifacts = JSON.parse(draft.artifacts_json || "{}");
      } catch {
        // ignore
      }
      const updatedArtifacts = {
        ...currentArtifacts,
        actions: draft.actions || [],
      };
      
      const payload = {
        program_id: draft.program_id,
        title: draft.title,
        program_year: draft.program_year,
        scope: draft.scope,
        notes: draft.notes,
        plan_text: draft.plan_text,
        report_text: draft.report_text,
        audience_json: draft.audience_json,
        prevention_link: draft.prevention_link,
        prevention_work_types_json: draft.prevention_work_types_json,
        artifacts_json: JSON.stringify(updatedArtifacts),
      };

      if (cardSaved) {
        await updateOrganizationProgram(payload.program_id, {
          title: payload.title,
          program_year: payload.program_year,
          scope: payload.scope,
          notes: payload.notes,
          plan_text: payload.plan_text,
          report_text: payload.report_text,
          audience_json: payload.audience_json,
          prevention_link: payload.prevention_link,
          prevention_work_types_json: payload.prevention_work_types_json,
          artifacts: updatedArtifacts,
        } as any);
      } else {
        await addOrganizationProgram(payload);
        setSavedProgramId(payload.program_id);
      }
      setSaveOk("Сохранено успешно.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const handleApplyAiDoc = async (stage: ArchitectStageId, text: string, segments?: Record<string, string>) => {
    setDraft((d) => {
      const nextDraft = {
        ...d,
        plan_text: stage === "plan" ? text : d.plan_text,
        report_text: stage === "report" ? text : d.report_text,
        notes: (stage as string) === "expertise" ? text : d.notes,
      };

      if (segments && segments.suggested_actions) {
        try {
          const parsed = JSON.parse(segments.suggested_actions);
          if (Array.isArray(parsed)) {
            const nextActions = [...(d.actions || [])];
            parsed.forEach((act: any) => {
              if (act.category && act.actionName) {
                nextActions.push({
                  id: crypto.randomUUID(),
                  category: act.category,
                  actionName: act.actionName,
                  notes: act.notes || "",
                  executor: act.executor || "",
                  plannedDate: act.plannedDate || "",
                });
              }
            });
            nextDraft.actions = nextActions;
          }
        } catch {
          // ignore
        }
      }

      setTimeout(() => {
        void handleSave();
      }, 50);

      return nextDraft;
    });
  };

  const addAction = (category: string, defaultName: string = "") => {
    const newAct = {
      id: crypto.randomUUID(),
      category,
      actionName: defaultName,
      plannedDate: "",
      executor: "",
      notes: "",
    };
    setDraft((d) => ({
      ...d,
      actions: [...(d.actions || []), newAct],
    }));
  };

  const updateAction = (id: string, field: string, value: any) => {
    setDraft((d) => ({
      ...d,
      actions: (d.actions || []).map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }));
  };

  const removeAction = (id: string) => {
    setDraft((d) => ({
      ...d,
      actions: (d.actions || []).filter((a) => a.id !== id),
    }));
  };

  return (
    <div className="workspace-panel-stack safe-environment-workspace">
      {!editorOpen && (
        <>
          <section className="card">
            <h2>Безопасная среда</h2>
            <p className="muted">
              Разработка, экспертиза и отчётность по комплексным профилактическим программам образовательных организаций.
            </p>
          </section>

          <section className="card workspace-journal-card">
            <div className="workspace-journal-head">
              <h3>Журнал программ</h3>
              <button type="button" className="ob-btn secondary" onClick={openNewCard}>
                Новая программа
              </button>
            </div>
            {busy && entries.length === 0 ? <p className="muted">Загрузка…</p> : null}
            {!busy && entries.length === 0 ? (
              <p className="muted">Пока нет сохранённых программ — нажмите «Новая программа».</p>
            ) : null}
            <ul className="group-session-list">
              {entries.map((row) => (
                <li key={row.program_id}>
                  <button
                    type="button"
                    className={`group-session-item${savedProgramId === row.program_id && editorOpen ? " active" : ""}`}
                    onClick={() => loadEntry(row)}
                  >
                    <div className="group-session-item-head">
                      <strong>{row.title || "(Без названия)"}</strong>
                      <span className="muted tiny">{row.program_year}</span>
                    </div>
                    {(row.plan_text || row.report_text) && (
                      <p className="muted tiny">
                        {row.plan_text ? "План ✓ " : ""}
                        {row.report_text ? "Отчёт ✓" : ""}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {editorOpen && (
        <section className="card group-session-editor">
          <div className="group-session-editor-head">
            <h3>{cardSaved ? "Программа безопасности" : "Новая программа"}</h3>
            <div className="group-session-editor-actions">
              <button type="button" className="ob-btn secondary" onClick={closeEditor}>
                ← К списку
              </button>
              <button type="button" className="ob-btn" disabled={busy} onClick={() => void handleSave()}>
                {busy ? "…" : "Сохранить карту"}
              </button>
            </div>
          </div>
          {saveOk && <p className="ok tiny">{saveOk}</p>}

          <div className="group-session-form" style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
            <label className="field" style={{ flex: 2 }}>
              <span>Название программы *</span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Профилактика буллинга и безопасная среда, 2025–2026"
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Период / Учебный год</span>
              <input
                type="text"
                value={draft.program_year}
                onChange={(e) => setDraft((d) => ({ ...d, program_year: e.target.value }))}
              />
            </label>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="safety"
              documentContext={aiContext}
              cardSaved={cardSaved}
              onApplyResult={handleApplyAiDoc}
              showPlanButton={true}
              planButtonLabel="Создать план (ИИ)"
              showReportButton={true}
              reportButtonLabel="Создать отчет (ИИ)"
              showExpertiseButton={true}
              expertiseButtonLabel="Провести экспертизу документа (ИИ)"
              expertProtocolId="program_audit"
              customExpertisePrompt="Ты — эксперт по безопасной образовательной среде. Проведи методический аудит предложенных материалов (планов, программ, концепций). Выдели риски нарушения безопасности в ОО, соответствие современным требованиям, дай конкретные тестовые рекомендации по переделкам и исправлению ошибок."
            />
          </div>

          <h3 style={{ margin: "24px 0 12px 0", fontSize: "1.1rem" }}>Мероприятия по уровням профилактики</h3>
          <p className="muted tiny" style={{ marginBottom: "16px" }}>
            Планирование конкретных профилактических мероприятий в рамках программы.
          </p>

          {PREVENTION_STANDARD_TAXONOMY.map((cat) => {
            const catActions = (draft.actions || []).filter((a) => a.category === cat.id);

            return (
              <div key={cat.id} className="card" style={{ marginBottom: "16px", padding: "18px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--violet)" }}>{cat.title}</h4>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      className="tiny-select"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addAction(cat.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      style={{ padding: "4px", fontSize: "0.85rem" }}
                      disabled={busy}
                    >
                      <option value="">-- Быстрый выбор действия --</option>
                      {cat.actions.map((actName) => (
                        <option key={actName} value={actName}>{actName}</option>
                      ))}
                    </select>
                    <button type="button" className="ob-btn secondary tiny" onClick={() => addAction(cat.id)} disabled={busy}>
                      ＋ Своё действие
                    </button>
                  </div>
                </div>

                {catActions.length === 0 ? (
                  <p className="muted tiny">Мероприятия не запланированы.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <th style={{ textAlign: "left", padding: "6px" }}>Профилактическое действие / Метод *</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "130px" }}>План (дата)</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "130px" }}>Факт (дата)</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "160px" }}>Исполнитель</th>
                        <th style={{ textAlign: "left", padding: "6px" }}>Пояснения ожидаемых/достигнутых результатов</th>
                        <th style={{ width: "40px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catActions.map((act) => (
                        <tr key={act.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.actionName}
                              onChange={(e) => updateAction(act.id, "actionName", e.target.value)}
                              placeholder="Метод или мера"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={busy}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="date"
                              value={act.plannedDate || ""}
                              onChange={(e) => updateAction(act.id, "plannedDate", e.target.value)}
                              style={{ width: "100%", padding: "4px" }}
                              disabled={busy}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="date"
                              value={act.actualDate || ""}
                              onChange={(e) => updateAction(act.id, "actualDate", e.target.value)}
                              style={{ width: "100%", padding: "4px" }}
                              disabled={busy}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.executor || ""}
                              onChange={(e) => updateAction(act.id, "executor", e.target.value)}
                              placeholder="Исполнитель"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={busy}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.notes || ""}
                              onChange={(e) => updateAction(act.id, "notes", e.target.value)}
                              placeholder="Текстовое пояснение"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={busy}
                            />
                          </td>
                          <td style={{ padding: "6px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeAction(act.id)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)" }}
                              disabled={busy}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          <div className="summary-split-block wide" style={{ display: "flex", gap: "20px", alignItems: "flex-start", marginTop: "24px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              <label className="field wide">
                <span>Результаты экспертизы и методические рекомендации</span>
                <textarea
                  rows={10}
                  value={draft.notes || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Здесь появятся рекомендации ИИ-экспертизы или внесите их вручную..."
                />
              </label>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              <label className="field wide">
                <span>Содержание плана программы (Текст)</span>
                <textarea
                  rows={10}
                  value={draft.plan_text || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, plan_text: e.target.value }))}
                  placeholder="Здесь появится сгенерированный план..."
                />
              </label>
            </div>
          </div>

          <div className="group-session-form" style={{ marginTop: "20px" }}>
            <label className="field wide">
              <span>Отчёт о реализации программы (Текст)</span>
              <textarea
                rows={10}
                value={draft.report_text || ""}
                onChange={(e) => setDraft((d) => ({ ...d, report_text: e.target.value }))}
                placeholder="Здесь появится итоговый отчет..."
              />
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
