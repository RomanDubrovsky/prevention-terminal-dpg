import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";

import CaseCreateCard from "./CaseCreateCard.tsx";
const CaseSituationView = lazy(() => import("./CaseSituationView.tsx"));
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";

import { caseWorkspaceIntro, isCommercialOrg } from "../lib/case_meta.ts";
import {
  type CaseSummary,
  type CaseStatus,
  CASE_STATUS_LABEL,
  CASE_STATUS_VALUES,
} from "../lib/case_store.ts";
import { listSituationCases } from "../lib/registry_store.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";
import {
  PERSON_CARD_SORT_OPTIONS,
  sortCaseSummaries,
  type PersonCardSort,
} from "../lib/workspace_list_sort.ts";
import EmptyStateGuideCard from "./EmptyStateGuideCard.tsx";

import { t } from "../lib/i18n.ts";
import { confirmLeaveIfUnsaved } from "../lib/unsaved_changes.ts";

interface CaseWorkspacePanelProps {
  cfg: TerminalConfig;
  activeCaseId: string | null;
  onCaseSelect: (caseId: string | null) => void;
  onCaseSaved: (caseId: string) => void;
  onNavigate: (view: SpecialistWorkspaceView) => void;
}

export default function CaseWorkspacePanel(props: CaseWorkspacePanelProps) {
  const { cfg, activeCaseId, onCaseSelect, onCaseSaved, onNavigate } = props;
  const commercial = isCommercialOrg(cfg);
  const intro = useMemo(() => caseWorkspaceIntro(commercial), [commercial]);

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [cardSort, setCardSort] = useState<PersonCardSort>("updated_desc");
  const [statusFilter, setStatusFilter] = useState<"all" | CaseStatus>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const currentAppId = commercial ? "commercial" : "school";

  const reloadCases = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      setCases(await listSituationCases(currentAppId));
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, [currentAppId]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: cases.length, draft: 0, active: 0, completed: 0, archived: 0 };
    for (const c of cases) {
      const s = c.status || "active";
      if (counts[s] !== undefined) counts[s] += 1;
      else counts.active += 1;
    }
    return counts;
  }, [cases]);

  const sortedCases = useMemo(() => {
    let filtered = cases;
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => (c.status || "active") === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.situation_title.toLowerCase().includes(q) ||
          c.situation_kind?.toLowerCase().includes(q),
      );
    }
    return sortCaseSummaries(filtered, cardSort);
  }, [cardSort, cases, searchTerm, statusFilter]);

  useEffect(() => {
    void reloadCases();
  }, [reloadCases, activeCaseId]);

  useEffect(() => {
    if (!activeCaseId || listBusy) return;
    if (cases.some((c) => c.case_id === activeCaseId)) return;
    onCaseSelect(null);
  }, [activeCaseId, cases, listBusy, onCaseSelect]);

  const handleCaseCreated = useCallback(
    (caseId: string) => {
      onCaseSaved(caseId);
      setShowCreate(false);
      void reloadCases();
    },
    [onCaseSaved, reloadCases],
  );

  const activeSummary = cases.find((c) => c.case_id === activeCaseId) ?? null;

  if (activeCaseId) {
    return (
      <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка карточки кейса...", "Loading case details...")}</div>}>
        <CaseSituationView
          cfg={cfg}
          caseId={activeCaseId}
          titleHint={activeSummary?.situation_title}
          kindHint={activeSummary?.situation_kind}
          onBack={() => {
            if (!confirmLeaveIfUnsaved()) return;
            onCaseSelect(null);
            void reloadCases();
          }}
          onNavigate={onNavigate}
        />
      </Suspense>
    );
  }

  const getStatusBadgeStyle = (status?: CaseStatus) => {
    const s = status || "active";
    switch (s) {
      case "draft":
        return { background: "rgba(100, 116, 139, 0.12)", color: "#475569", border: "1px solid rgba(100, 116, 139, 0.3)" };
      case "active":
        return { background: "rgba(14, 165, 233, 0.12)", color: "#0284c7", border: "1px solid rgba(14, 165, 233, 0.3)" };
      case "completed":
        return { background: "rgba(16, 185, 129, 0.12)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.3)" };
      case "archived":
        return { background: "rgba(148, 163, 184, 0.15)", color: "#64748b", border: "1px solid rgba(148, 163, 184, 0.3)" };
      default:
        return { background: "rgba(14, 165, 233, 0.12)", color: "#0284c7", border: "1px solid rgba(14, 165, 233, 0.3)" };
    }
  };

  return (
    <div className="workspace-panel-stack case-workspace">
      <section className="card case-workspace-list">
        <div className="case-workspace-list-head">
          <div>
            <h2>{intro.title}</h2>
            <p className="muted tiny">{intro.lead}</p>
          </div>
          <div className="group-session-editor-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ob-btn" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? t("Скрыть", "Hide") : t("+ Новый кейс", "+ New Case")}
            </button>
          </div>
        </div>
        {listBusy && <p className="muted tiny">{t("Загрузка…", "Loading…")}</p>}
        {listError && <p className="error tiny">{listError}</p>}
        {!listBusy && cases.length === 0 && !showCreate && (
          <EmptyStateGuideCard
            isCommercial={commercial}
            icon="🗂️"
            title={commercial
              ? t("Ведите дела клиентов без бумажной рутины", "Manage client cases without paperwork")
              : t("Личные дела и сопровождение учащихся", "Student Support and Personal Cases")
            }
            description={commercial
              ? t(
                  "Кейс объединяет историю запросов, динамику сессий и домашние задания. Вы можете вести его привычным способом или ускорить работу через голосовую диктовку с ИИ.",
                  "Case unites request history, session dynamics, and homework. Manage it the familiar way or accelerate via AI voice dictation."
                )
              : t(
                  "Здесь фиксируются инциденты, трудные жизненные ситуации и психолого-педагогическая профилактика по стандартам ФГОС.",
                  "Here incidents, difficult situations, and educational prevention are recorded under standards."
                )
            }
            primaryActionLabel={t("+ Создать первый кейс", "+ Create First Case")}
            onPrimaryAction={() => setShowCreate(true)}
            onOpenGuide={() => setShowGuide(true)}
          />
        )}
        {cases.length > 0 && (
          <>
            {/* Статус-фильтр табы */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                overflowX: "auto",
                background: "rgba(0,0,0,0.01)",
              }}
            >
              <button
                type="button"
                className={`ob-btn tiny ${statusFilter === "all" ? "primary" : "secondary"}`}
                onClick={() => setStatusFilter("all")}
                style={{ borderRadius: "20px", padding: "4px 12px", fontSize: "0.82rem" }}
              >
                {t("Все дела", "All cases")} ({statusCounts.all})
              </button>
              {CASE_STATUS_VALUES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`ob-btn tiny ${statusFilter === st ? "primary" : "secondary"}`}
                  onClick={() => setStatusFilter(st)}
                  style={{ borderRadius: "20px", padding: "4px 12px", fontSize: "0.82rem" }}
                >
                  {CASE_STATUS_LABEL[st]} ({statusCounts[st] || 0})
                </button>
              ))}
            </div>

            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
              <input
                type="search"
                placeholder={t("Поиск по названию или типу...", "Search by title or type...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <WorkspaceListSortBar
              options={PERSON_CARD_SORT_OPTIONS}
              value={cardSort}
              onChange={setCardSort}
            />
            <ul className="case-pick-list">
              {sortedCases.map((row) => {
                const st = row.status || "active";
                const badgeStyle = getStatusBadgeStyle(st);
                return (
                  <li key={row.case_id}>
                    <button
                      type="button"
                      className="case-pick-row"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}
                      onClick={() => {
                        if (row.case_id !== activeCaseId) {
                          if (!confirmLeaveIfUnsaved()) return;
                        }
                        setShowCreate(false);
                        onCaseSelect(row.case_id);
                      }}
                    >
                      <span className="case-pick-title">{row.situation_title}</span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          marginLeft: "8px",
                          whiteSpace: "nowrap",
                          ...badgeStyle,
                        }}
                      >
                        {CASE_STATUS_LABEL[st] || st}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {showCreate && (
        <CaseCreateCard
          commercial={commercial}
          onSaved={handleCaseCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

    </div>
  );
}
