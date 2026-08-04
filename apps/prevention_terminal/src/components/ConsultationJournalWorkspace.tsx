import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import ConsultationCaseView from "./ConsultationCaseView.tsx";
import RegistrySubjectFioField from "./RegistrySubjectFioField.tsx";
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import { isCommercialOrg, situationKindLabel } from "../lib/case_meta.ts";
import {
  PSEUDONYM_ACK_LABEL,
  PSEUDONYM_MODE_HINT,
  PSEUDONYM_NEW_CARD_LABEL,
} from "../lib/consultation_copy.ts";
import { getCaseArtifacts } from "../lib/case_store.ts";
import {
  PERSON_CARD_SORT_OPTIONS,
  sortConsultationClients,
  type PersonCardSort,
} from "../lib/workspace_list_sort.ts";
import { createConsultationClientCard } from "../lib/quick_consultation_client.ts";
import {
  listConsultationClients,
  type ConsultationClientRow,
  type RegistrySubjectSummary,
} from "../lib/registry_store.ts";
import { emptyRegistryProfile } from "../lib/registry_profile.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { t } from "../lib/i18n.ts";

const PAGE_SIZE = 20;

function ListPager(props: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { page, pageCount, total, onPageChange } = props;
  if (pageCount <= 1) return null;
  return (
    <div className="consultation-list-pager">
      <button
        type="button"
        className="ob-btn secondary"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        {t("Назад", "Back")}
      </button>
      <span className="muted tiny">
        {page + 1} / {pageCount} · {t(`всего ${total}`, `total ${total}`)}
      </span>
      <button
        type="button"
        className="ob-btn secondary"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        {t("Вперёд", "Next")}
      </button>
    </div>
  );
}

interface ConsultationJournalWorkspaceProps {
  cfg: TerminalConfig;
  activeCaseId: string | null;
  onCaseSelect: (caseId: string | null) => void;
  onOpenCaseWorkspace: () => void;
  onOpenRegistry: () => void;
  onRegistrySubjectSelect?: (caseId: string | null) => void;
}

export default function ConsultationJournalWorkspace(props: ConsultationJournalWorkspaceProps) {
  const { cfg, activeCaseId, onCaseSelect, onOpenCaseWorkspace, onOpenRegistry, onRegistrySubjectSelect } =
    props;
  const commercial = isCommercialOrg(cfg);
  const registryActive = cfg.registry_enabled === true;

  const [activeCaseTitle, setActiveCaseTitle] = useState("");
  const [activeCaseKind, setActiveCaseKind] = useState("");
  const [activeCaseLite, setActiveCaseLite] = useState(false);
  const [clients, setClients] = useState<ConsultationClientRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [liteAck, setLiteAck] = useState(false);
  const [cardSort, setCardSort] = useState<PersonCardSort>("name_asc");
  const [onlyPseudonyms, setOnlyPseudonyms] = useState(false);
  const [listPage, setListPage] = useState(0);

  const reloadClients = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      setClients(await listConsultationClients());
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCaseId) void reloadClients();
  }, [activeCaseId, reloadClients]);

  const registrySubjects = useMemo(
    () =>
      clients
        .filter((row) => row.kind === "registry")
        .map(
          (row): RegistrySubjectSummary => ({
            case_id: row.case_id,
            situation_title: row.title,
            situation_kind: row.situation_kind,
            participant_count: 0,
            y_level: "",
            x_stage: "",
            created_at: row.created_at,
            updated_at: row.created_at,
            profile: row.profile || { ...emptyRegistryProfile(), full_name: row.title },
          }),
        ),
    [clients],
  );

  const filteredClients = useMemo(() => {
    const base = onlyPseudonyms ? clients.filter((row) => row.kind === "lite") : clients;
    return sortConsultationClients(base, cardSort);
  }, [cardSort, clients, onlyPseudonyms]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const safePage = Math.min(listPage, pageCount - 1);
  const pageRows = filteredClients.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setListPage(0);
  }, [onlyPseudonyms, cardSort, clients.length]);

  function clearActiveClient() {
    onRegistrySubjectSelect?.(null);
    onCaseSelect(null);
  }

  function handleRegistryPick(row: RegistrySubjectSummary | null) {
    if (!row) {
      clearActiveClient();
      return;
    }
    onRegistrySubjectSelect?.(row.case_id);
    onCaseSelect(row.case_id);
  }

  function handlePickClient(row: ConsultationClientRow) {
    if (row.kind === "registry") {
      onRegistrySubjectSelect?.(row.case_id);
    } else {
      onRegistrySubjectSelect?.(null);
    }
    onCaseSelect(row.case_id);
  }

  useEffect(() => {
    if (!activeCaseId) {
      setActiveCaseTitle("");
      setActiveCaseKind("");
      setActiveCaseLite(false);
      return;
    }
    let cancelled = false;
    void getCaseArtifacts(activeCaseId).then((payload) => {
      if (cancelled) return;
      setActiveCaseTitle(payload.situation_title || "");
      setActiveCaseKind(String(payload.situation_kind || ""));
      setActiveCaseLite(payload.record_kind === "consultation_lite");
    });
    return () => {
      cancelled = true;
    };
  }, [activeCaseId]);

  const handleQuickStart = async (e: FormEvent) => {
    e.preventDefault();
    if (!registryActive && !liteAck) {
      setQuickError(t("Подтвердите, что понимаете ограничения упрощённого режима.", "Confirm that you understand the limitations of the simplified mode."));
      return;
    }
    setQuickBusy(true);
    setQuickError(null);
    try {
      const caseId = await createConsultationClientCard({ title: quickTitle, commercial });
      setQuickTitle("");
      await reloadClients();
      onCaseSelect(caseId);
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuickBusy(false);
    }
  };

  const canStartPseudonym = quickTitle.trim().length > 0 && (registryActive || liteAck);

  return (
    <div className="workspace-panel-stack consultation-journal">
      {!activeCaseId && (
        <section className="card">
          <h2>{t("Консультации", "Consultations")}</h2>
          {registryActive ? (
            <p className="muted">
              {t(
                "Клиенты из реестра и с псевдонимами — в одном списке. Отдельный архив пока не нужен: достаточно сортировки и постраничного просмотра.",
                "Registry clients and pseudonyms in one list. A separate archive is not needed yet: sorting and paging are sufficient.",
              )}
            </p>
          ) : (
            <p className="muted">
              {t(
                "Псевдонимы вместо полных персональных данных — короткая метка на каждого сопровождаемого.",
                "Pseudonyms instead of full personal data — a short label for each person.",
              )}
            </p>
          )}
        </section>
      )}

      {!activeCaseId && (
        <section className="card consultation-session-form">
          <h3>{t("Кому ведёте консультацию", "Who is the consultation for")}</h3>

          {registryActive && (
            <>
              <RegistrySubjectFioField
                subjects={registrySubjects}
                selectedCaseId={activeCaseId}
                onSelect={handleRegistryPick}
                label={t("ФИО из реестра", "Full Name from registry")}
                hint={t("Начните вводить фамилию — подставится человек из реестра.", "Start typing a name — a person from the registry will be suggested.")}
                showGradeClass={!commercial}
              />
              {registrySubjects.length === 0 && (
                <p className="muted tiny">
                  {t("Реестр пуст.", "Registry is empty.")}{" "}
                  <button type="button" className="linkish" onClick={onOpenRegistry}>
                    {t("Добавить человека", "Add person")}
                  </button>
                </p>
              )}
            </>
          )}

          {!registryActive && (
            <label className="field inline consultation-lite-ack">
              <input
                type="checkbox"
                checked={liteAck}
                onChange={(e) => setLiteAck(e.target.checked)}
              />
              <span>{PSEUDONYM_ACK_LABEL}</span>
            </label>
          )}

          <form className="consultation-quick-start" onSubmit={(e) => void handleQuickStart(e)}>
            <label className="field wide">
              <span>{registryActive ? PSEUDONYM_NEW_CARD_LABEL : t("Новый псевдоним", "New Pseudonym")}</span>
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder={commercial ? t("Первичная консультация, март", "Initial consultation, March") : t("7А, тревожность", "7A, anxiety")}
                disabled={quickBusy}
              />
            </label>
            <button type="submit" className="ob-btn" disabled={quickBusy || !canStartPseudonym}>
              {quickBusy ? "…" : t("Начать визит", "Start visit")}
            </button>
          </form>
          {registryActive && <p className="muted tiny">{PSEUDONYM_MODE_HINT}</p>}
          {quickError && <p className="error">{quickError}</p>}

          {listBusy && <p className="muted">{t("Загружаем список…", "Loading list…")}</p>}
          {listError && <p className="error">{listError}</p>}

          {!listBusy && clients.length > 0 && (
            <>
              {registryActive && (
                <label className="field inline consultation-list-filter">
                  <input
                    type="checkbox"
                    checked={onlyPseudonyms}
                    onChange={(e) => setOnlyPseudonyms(e.target.checked)}
                  />
                  <span>{t("Только псевдонимы (условные обозначения)", "Only pseudonyms (symbols)")}</span>
                </label>
              )}
              <WorkspaceListSortBar
                options={PERSON_CARD_SORT_OPTIONS}
                value={cardSort}
                onChange={setCardSort}
              />
              <ul className="case-pick-list">
                {pageRows.map((row) => (
                  <li key={row.case_id}>
                    <button
                      type="button"
                      className="case-pick-row"
                      onClick={() => handlePickClient(row)}
                    >
                      <span className="case-pick-title">{row.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <ListPager
                page={safePage}
                pageCount={pageCount}
                total={filteredClients.length}
                onPageChange={setListPage}
              />
            </>
          )}

          {!listBusy && clients.length === 0 && !listError && (
            <p className="muted tiny">{t("Пока нет клиентов в списке консультаций.", "No clients in the consultation list yet.")}</p>
          )}

          <p className="muted tiny consultation-structural-hint">
            {t("Несколько участников — ", "Multiple participants — ")}
            <button type="button" className="linkish" onClick={onOpenCaseWorkspace}>
              {t("«Кейсы»", "\"Cases\"")}
            </button>
            .
          </p>
        </section>
      )}

      {activeCaseId && (
        <ConsultationCaseView
          cfg={cfg}
          caseId={activeCaseId}
          title={activeCaseTitle || (activeCaseLite ? t("Псевдоним", "Pseudonym") : t("Запись реестра", "Registry entry"))}
          subtitle={[
            activeCaseKind ? situationKindLabel(activeCaseKind, commercial) : "",
            activeCaseLite && registryActive ? t("псевдоним", "pseudonym") : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          onBack={clearActiveClient}
        />
      )}
    </div>
  );
}
