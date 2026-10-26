import { useCallback, useEffect, useMemo, useState, lazy, Suspense, type FormEvent } from "react";

const ConsultationCaseView = lazy(() => import("./ConsultationCaseView.tsx"));
import RegistrySubjectFioField from "./RegistrySubjectFioField.tsx";

import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import ModuleGuideModal from "./LazyModuleGuideModal.tsx";
import EmptyStateGuideCard from "./EmptyStateGuideCard.tsx";

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
import { confirmLeaveIfUnsaved } from "../lib/unsaved_changes.ts";
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
  specialistName?: string;
}

export default function ConsultationJournalWorkspace(props: ConsultationJournalWorkspaceProps) {
  const { cfg, activeCaseId, onCaseSelect, onOpenCaseWorkspace, onOpenRegistry, onRegistrySubjectSelect, specialistName } =
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
  const [showGuide, setShowGuide] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const currentAppId = commercial ? "commercial" : "school";

  const reloadClients = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      setClients(await listConsultationClients(currentAppId));
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, [currentAppId]);

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
    let base = onlyPseudonyms ? clients.filter((row) => row.kind === "lite") : clients;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.profile?.full_name?.toLowerCase().includes(q) ||
        c.profile?.contact_phone?.toLowerCase().includes(q) ||
        c.profile?.org_class?.toLowerCase().includes(q)
      );
    }
    return sortConsultationClients(base, cardSort);
  }, [cardSort, clients, onlyPseudonyms, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const safePage = Math.min(listPage, pageCount - 1);
  const pageRows = filteredClients.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setListPage(0);
  }, [onlyPseudonyms, cardSort, clients.length]);

  function clearActiveClient() {
    if (!confirmLeaveIfUnsaved()) return;
    onRegistrySubjectSelect?.(null);
    onCaseSelect(null);
  }

  function handleRegistryPick(row: RegistrySubjectSummary | null) {
    if (!row) {
      clearActiveClient();
      return;
    }
    if (row.case_id !== activeCaseId) {
      if (!confirmLeaveIfUnsaved()) return;
    }
    onRegistrySubjectSelect?.(row.case_id);
    onCaseSelect(row.case_id);
  }

  function handlePickClient(row: ConsultationClientRow) {
    if (row.case_id !== activeCaseId) {
      if (!confirmLeaveIfUnsaved()) return;
    }
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
      const caseId = await createConsultationClientCard({ title: quickTitle, commercial, appId: currentAppId });
      setQuickTitle("");
      setIsCreating(false);
      await reloadClients();
      onCaseSelect(caseId);
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuickBusy(false);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setQuickTitle("");
    setQuickError(null);
  };

  const canStartPseudonym = quickTitle.trim().length > 0 && (registryActive || liteAck);

  return (
    <div className="workspace-panel-stack consultation-journal">
      {!activeCaseId && (
        <section className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", background: "#fff", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.5rem" }}>{t("Журнал консультаций", "Consultation Journal")}</h2>
              <p className="muted tiny" style={{ margin: 0 }}>
                {registryActive
                  ? t("Все проведенные консультации автоматически попадут в отчетность (ЦОС, Форма 5).", "All consultations will automatically appear in your reports.")
                  : t("Используйте псевдонимы для конфиденциальности.", "Use pseudonyms for privacy.")}
              </p>
            </div>
            {!isCreating && (
              <button
                type="button"
                className="ob-btn primary"
                onClick={() => setIsCreating(true)}
                style={{ fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <i className="icon-plus"></i> {t("+ Новая консультация", "+ New Consultation")}
              </button>
            )}
          </div>

          {isCreating && (
            <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem" }}>{t("Кого консультируем?", "Who is the consultation for?")}</h3>
              
              {registryActive && (
                <>
                  <RegistrySubjectFioField
                    subjects={registrySubjects}
                    selectedCaseId={activeCaseId}
                    onSelect={(id) => { setIsCreating(false); handleRegistryPick(id); }}
                    label={t("Выберите из реестра (ФИО)", "Select from registry")}
                    hint=""
                    showGradeClass={!commercial}
                  />
                  {registrySubjects.length === 0 ? (
                    <p className="muted tiny" style={{ marginTop: "-8px", marginBottom: "12px" }}>
                      {t("В реестре пока нет записей. Чтобы выбрать человека из защищённого реестра, сначала добавьте его:", "Registry is empty. To select a person from the protected registry, first add them:")}{" "}
                      <button type="button" className="linkish" onClick={onOpenRegistry} style={{ fontWeight: "600" }}>
                        {t("Добавить в Реестр →", "Add to Registry →")}
                      </button>
                    </p>
                  ) : (
                    <p className="muted tiny" style={{ marginTop: "-8px", marginBottom: "12px" }}>
                      {t("Не нашли в списке? Чтобы выбрать человека из защищённого реестра, сначала заведите его в раздел «Реестр»:", "Not in list? To select someone from the protected registry, first add them in Registry:")}{" "}
                      <button type="button" className="linkish" onClick={onOpenRegistry} style={{ fontWeight: "600" }}>
                        {t("+ Добавить в Реестр", "+ Add to Registry")}
                      </button>
                    </p>
                  )}
                  <div style={{ margin: "16px 0", borderBottom: "1px solid #cbd5e1" }}></div>
                </>
              )}

              {!registryActive && (
                <div style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  fontSize: "0.85rem",
                  color: "#1e3a8a",
                  lineHeight: "1.45"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                    💡 {t("Защищённый реестр клиентов", "Protected Client Registry")}
                  </div>
                  <div>
                    {t(
                      "Вы также можете выбрать человека из защищённого реестра (с историей, шифрованием и полным профилем), но его сначала нужно туда завести.",
                      "You can also select a person from the protected registry (with history, encryption, and full profile), but you must first add them there."
                    )}{" "}
                    <button
                      type="button"
                      className="linkish"
                      onClick={onOpenRegistry}
                      style={{ fontWeight: "600", color: "#2563eb", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit" }}
                    >
                      {t("Перейти в Реестр →", "Go to Registry →")}
                    </button>
                  </div>
                </div>
              )}

              {!registryActive && (
                <label className="field inline consultation-lite-ack" style={{ marginBottom: "12px" }}>
                  <input type="checkbox" checked={liteAck} onChange={(e) => setLiteAck(e.target.checked)} />
                  <span>{PSEUDONYM_ACK_LABEL}</span>
                </label>
              )}

              <form onSubmit={(e) => void handleQuickStart(e)} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <label className="field" style={{ flex: 1, margin: 0 }}>
                  <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    {registryActive ? t("Или создайте анонимный псевдоним", "Or create an anonymous pseudonym") : t("Новый псевдоним", "New Pseudonym")}
                  </span>
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder={commercial ? t("Первичная консультация", "Initial consultation") : t("8В, тревожность", "8V, anxiety")}
                    disabled={quickBusy}
                    style={{ background: "#fff" }}
                  />
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="ob-btn secondary" onClick={handleCancelCreate} disabled={quickBusy}>
                    {t("Отмена", "Cancel")}
                  </button>
                  <button type="submit" className="ob-btn primary" disabled={quickBusy || !canStartPseudonym}>
                    {quickBusy ? "…" : t("Начать", "Start")}
                  </button>
                </div>
              </form>
              {quickError && <p className="error tiny" style={{ marginTop: "8px" }}>{quickError}</p>}
            </div>
          )}

          {!isCreating && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {listBusy && <p className="muted">{t("Загрузка…", "Loading…")}</p>}
              {listError && <p className="error">{listError}</p>}

              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.08)",
                }}
              >
                <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>📹</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "800", color: "#166534", fontSize: "0.95rem", marginBottom: "4px" }}>
                    {t("Как запустить видеосессию с ИИ-супервизором:", "How to start a video session with AI supervisor:")}
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#15803d", lineHeight: 1.45 }}>
                    {t(
                      "Откройте карточку любого клиента ниже (например, «Алексей и Елена» или «Елена С.»). Внутри карточки в правом верхнем углу нажмите зеленую кнопку «📹 Начать видео-сессию» — откроется защищенная видеокомната с SOS-подсказками и автопротоколом SOAP.",
                      "Open any client card below (e.g. 'Alex & Helen' or 'Helen S.'). Inside the card, click the green '📹 Start video session' button in the top right corner — this opens the video room with real-time AI guidance and automated SOAP notes."
                    )}
                  </div>
                </div>
              </div>

              {!listBusy && clients.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <input
                      type="search"
                      placeholder={t("Поиск по ФИО или псевдониму...", "Search by name or pseudonym...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }}
                    />
                    <WorkspaceListSortBar options={PERSON_CARD_SORT_OPTIONS} value={cardSort} onChange={setCardSort} />
                    {registryActive && (
                      <label className="field inline" style={{ margin: 0 }}>
                        <input type="checkbox" checked={onlyPseudonyms} onChange={(e) => setOnlyPseudonyms(e.target.checked)} />
                        <span style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>{t("Только псевдонимы", "Only pseudonyms")}</span>
                      </label>
                    )}
                  </div>
                  
                  <ul className="case-pick-list">
                    {pageRows.map((row) => (
                      <li key={row.case_id}>
                        <button type="button" className="case-pick-row" onClick={() => handlePickClient(row)}>
                          <span className="case-pick-title" style={{ fontWeight: "600" }}>{row.title}</span>
                          <span style={{ display: "inline-flex", gap: "6px", alignItems: "center", marginLeft: "auto" }}>
                            {row.record_kind === "consultation_lite" && <span className="status-badge" style={{ fontSize: "0.7rem" }}>{t("Псевдоним", "Pseudonym")}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  
                  <ListPager page={safePage} pageCount={pageCount} total={filteredClients.length} onPageChange={setListPage} />
                </>
              )}

              {!listBusy && clients.length === 0 && !listError && (
                <EmptyStateGuideCard
                  isCommercial={commercial}
                  icon="📝"
                  title={t("Журнал пуст", "Journal is empty")}
                  description={t("Здесь будут отображаться все ваши консультации. Просто нажмите «+ Новая консультация», чтобы начать.", "Your consultations will appear here. Click '+ New Consultation' to start.")}
                  primaryActionLabel={t("Начать первую консультацию", "Start First Consultation")}
                  onPrimaryAction={() => setIsCreating(true)}
                  onOpenGuide={() => setShowGuide(true)}
                />
              )}
            </div>
          )}
        </section>
      )}

      {activeCaseId && (
        <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка карточки консультации...", "Loading consultation case...")}</div>}>
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
            specialistName={specialistName}
          />
        </Suspense>
      )}

      <ModuleGuideModal
        moduleId="consultations"
        isCommercial={commercial}
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onCtaClick={() => {
          const el = document.querySelector<HTMLInputElement>(".consultation-quick-start input");
          el?.focus();
        }}
      />
    </div>
  );
}
