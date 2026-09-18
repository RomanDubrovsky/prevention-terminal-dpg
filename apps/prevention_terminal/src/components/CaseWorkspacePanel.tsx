import { useCallback, useEffect, useMemo, useState } from "react";

import CaseCreateCard from "./CaseCreateCard.tsx";
import CaseSituationView from "./CaseSituationView.tsx";
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import { caseWorkspaceIntro, isCommercialOrg } from "../lib/case_meta.ts";
import type { CaseSummary } from "../lib/case_store.ts";
import { listSituationCases } from "../lib/registry_store.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";
import {
  PERSON_CARD_SORT_OPTIONS,
  sortCaseSummaries,
  type PersonCardSort,
} from "../lib/workspace_list_sort.ts";
import ModuleGuideModal from "./ModuleGuideModal.tsx";
import EmptyStateGuideCard from "./EmptyStateGuideCard.tsx";
import { t } from "../lib/i18n.ts";

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
  const [showCreate, setShowCreate] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const reloadCases = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      setCases(await listSituationCases());
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, []);

  const sortedCases = useMemo(() => sortCaseSummaries(cases, cardSort), [cardSort, cases]);

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
      <CaseSituationView
        cfg={cfg}
        caseId={activeCaseId}
        titleHint={activeSummary?.situation_title}
        kindHint={activeSummary?.situation_kind}
        onBack={() => onCaseSelect(null)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="workspace-panel-stack case-workspace">
      <section className="card case-workspace-list">
        <div className="case-workspace-list-head">
          <div>
            <h2>{intro.title}</h2>
            <p className="muted tiny">{intro.lead}</p>
          </div>
          <div className="group-session-editor-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="header-guide-btn"
              onClick={() => setShowGuide(true)}
            >
              💡 {t("Как устроен кейс: Вручную vs ИИ", "Case guide: Manual vs AI")}
            </button>
            
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
            <WorkspaceListSortBar
              options={PERSON_CARD_SORT_OPTIONS}
              value={cardSort}
              onChange={setCardSort}
            />
            <ul className="case-pick-list">
              {sortedCases.map((row) => (
                <li key={row.case_id}>
                  <button
                    type="button"
                    className="case-pick-row"
                    onClick={() => {
                      setShowCreate(false);
                      onCaseSelect(row.case_id);
                    }}
                  >
                    <span className="case-pick-title">{row.situation_title}</span>
                  </button>
                </li>
              ))}
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

      <ModuleGuideModal
        moduleId="cases"
        isCommercial={commercial}
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onCtaClick={() => setShowCreate(true)}
      />
    </div>
  );
}
