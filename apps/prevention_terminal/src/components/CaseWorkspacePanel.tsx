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
          <div className="group-session-editor-actions">
            <button type="button" className="ob-btn" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "\u0421\u043a\u0440\u044b\u0442\u044c" : "+ \u041d\u043e\u0432\u044b\u0439 \u043a\u0435\u0439\u0441"}
            </button>
          </div>
        </div>
        {listBusy && <p className="muted tiny">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026"}</p>}
        {listError && <p className="error tiny">{listError}</p>}
        {!listBusy && cases.length === 0 && !showCreate && (
          <p className="muted">
            {"\u041a\u0435\u0439\u0441\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u2014 \u043a\u043d\u043e\u043f\u043a\u0430 \u00ab\u041d\u043e\u0432\u044b\u0439 \u043a\u0435\u0439\u0441\u00bb."}
          </p>
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
    </div>
  );
}
