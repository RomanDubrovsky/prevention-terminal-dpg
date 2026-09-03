import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import RegistrySetupWizard, {
  dismissRegistryWizard,
  isRegistryWizardDismissed,
  resetRegistryWizardDismiss,
} from "./RegistrySetupWizard.tsx";
import WorkspaceListSortBar from "./WorkspaceListSortBar.tsx";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { enableSpecialistRegistry } from "../lib/enable_registry.ts";
import {
  emptyRegistryProfile,
  normalizeRegistryGenderForLocale,
  registryGenderChoices,
  registryGenderLabel,
  type RegistryGender,
  type RegistryProfile,
} from "../lib/registry_profile.ts";
import { getEditionConfig } from "../lib/terminal_edition.ts";
import {
  createRegistrySubject,
  filterRegistrySubjectsByFio,
  importRegistrySubjects,
  listRegistrySubjects,
  updateRegistrySubject,
  deleteRegistrySubject,
  type RegistrySubjectSummary,
} from "../lib/registry_store.ts";
import {
  downloadRegistrySpreadsheet,
  parseRegistrySpreadsheet,
  registryImportFilename,
} from "../lib/registry_spreadsheet.ts";
import {
  isTerminalModuleEnabled,
  type TerminalConfig,
} from "../lib/terminal_config.ts";
import {
  PERSON_CARD_SORT_OPTIONS,
  sortRegistrySubjects,
  type PersonCardSort,
} from "../lib/workspace_list_sort.ts";
import RegistryVaultPanel from "./RegistryVaultPanel.tsx";
import { t } from "../lib/i18n.ts";

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return isTerminalModuleEnabled(cfg, id);
}

interface RegistryWorkspaceProps {
  cfg: TerminalConfig;
  selectedSubjectId: string | null;
  onSubjectSelect: (caseId: string | null) => void;
  onRegistryEnabled: (cfg: TerminalConfig) => void;
}

export default function RegistryWorkspace(props: RegistryWorkspaceProps) {
  const { cfg, onSubjectSelect, onRegistryEnabled } = props;
  const commercial = isCommercialOrg(cfg);
  const locale = getEditionConfig().locale_default;
  const genderChoices = registryGenderChoices(locale);

  const [registryBusy, setRegistryBusy] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryDismissed, setRegistryDismissed] = useState(() => isRegistryWizardDismissed());
  const [subjects, setSubjects] = useState<RegistrySubjectSummary[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<RegistryProfile>(emptyRegistryProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [listSort, setListSort] = useState<PersonCardSort>("name_asc");
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const sortedSubjects = useMemo(
    () => sortRegistrySubjects(subjects, listSort),
    [listSort, subjects],
  );

  const fioMatches = useMemo(
    () =>
      editorOpen
        ? filterRegistrySubjectsByFio(subjects, draft.full_name, editingId)
        : [],
    [draft.full_name, editorOpen, editingId, subjects],
  );

  const reload = useCallback(async () => {
    if (!cfg.registry_enabled) return;
    setListBusy(true);
    setListError(null);
    try {
      setSubjects(await listRegistrySubjects());
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setListBusy(false);
    }
  }, [cfg.registry_enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const showRegistryOffer = !cfg.registry_enabled && modEnabled(cfg, "reception_journal");

  async function handleEnableRegistry() {
    setRegistryBusy(true);
    setRegistryError(null);
    try {
      onRegistryEnabled(await enableSpecialistRegistry(cfg));
    } catch (err) {
      setRegistryError(String(err));
    } finally {
      setRegistryBusy(false);
    }
  }

  function openNewSubject() {
    setDraft(emptyRegistryProfile());
    setEditingId(null);
    setEditorOpen(true);
    setSaveOk(null);
    setShowDeleteConfirm(false);
  }

  function openSubject(row: RegistrySubjectSummary) {
    onSubjectSelect(row.case_id);
    setDraft({
      ...row.profile,
      gender: normalizeRegistryGenderForLocale(row.profile.gender, locale),
    });
    setEditingId(row.case_id);
    setEditorOpen(true);
    setSaveOk(null);
    setShowDeleteConfirm(false);
  }

  async function handleExportSpreadsheet() {
    setImportMessage(null);
    try {
      downloadRegistrySpreadsheet(subjects, registryImportFilename());
      setImportMessage(t(`Экспортировано записей: ${subjects.length}. Файл откроется в Excel.`, `Exported records: ${subjects.length}. File will open in Excel.`));
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleImportFile(file: File) {
    setImportBusy(true);
    setImportMessage(null);
    setListError(null);
    try {
      const text = await file.text();
      const preview = parseRegistrySpreadsheet(text);
      if (preview.errors.length > 0) {
        setListError(preview.errors.join(" "));
        return;
      }
      if (preview.profiles.length === 0) {
        setListError(t("В файле нет строк с ФИО для импорта.", "No rows with full name found in file for import."));
        return;
      }
      const result = await importRegistrySubjects({
        profiles: preview.profiles,
        commercial,
        existing: subjects,
        skipDuplicates: true,
      });
      await reload();
      const parts = [t(`Добавлено: ${result.created}`, `Added: ${result.created}`)];
      if (result.skipped > 0) parts.push(t(`пропущено дубликатов: ${result.skipped}`, `Skipped duplicates: ${result.skipped}`));
      if (preview.skippedEmpty > 0) parts.push(t(`пустых строк: ${preview.skippedEmpty}`, `Empty rows: ${preview.skippedEmpty}`));
      setImportMessage(parts.join(", ") + ".");
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleSaveSubject(e: FormEvent) {
    e.preventDefault();
    setRegistryBusy(true);
    setSaveOk(null);
    setListError(null);
    try {
      const profile: RegistryProfile = {
        ...draft,
        gender: normalizeRegistryGenderForLocale(draft.gender, locale),
      };
      if (editingId) {
        await updateRegistrySubject(editingId, profile);
        onSubjectSelect(editingId);
        setSaveOk(t("Запись реестра обновлена.", "Registry entry updated."));
      } else {
        const id = await createRegistrySubject(profile, commercial);
        onSubjectSelect(id);
        setEditingId(id);
        setSaveOk(t("Человек добавлен в реестр.", "Person added to registry."));
      }
      await reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegistryBusy(false);
    }
  }

  async function handleDeleteSubject() {
    if (!editingId) return;
    setRegistryBusy(true);
    setListError(null);
    try {
      await deleteRegistrySubject(editingId);
      onSubjectSelect(null);
      setEditorOpen(false);
      setShowDeleteConfirm(false);
      await reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegistryBusy(false);
    }
  }

  return (
    <div className="workspace-panel-stack registry-workspace">
      {showRegistryOffer && (
        <section className="card registry-setup-plaque">
          <RegistrySetupWizard
            commercial={commercial}
            busy={registryBusy}
            error={registryError}
            introOnly={registryDismissed}
            onCreate={() => void handleEnableRegistry()}
            onDismiss={() => {
              dismissRegistryWizard();
              setRegistryDismissed(true);
            }}
            onStartSetup={() => {
              resetRegistryWizardDismiss();
              setRegistryDismissed(false);
            }}
          />
        </section>
      )}

      {cfg.registry_enabled && (
        <>
          {!editorOpen && (
          <section className="card workspace-journal-card">
            <div className="workspace-journal-head">
              <h2>{t("Реестр", "Registry")}</h2>
              <div className="registry-toolbar-actions">
                <button
                  type="button"
                  className="ob-btn secondary"
                  disabled={subjects.length === 0}
                  onClick={() => void handleExportSpreadsheet()}
                >
                  {t("Экспорт в Excel", "Export to Excel")}
                </button>
                <button
                  type="button"
                  className="ob-btn secondary"
                  disabled={importBusy}
                  onClick={() => importInputRef.current?.click()}
                >
                  {importBusy ? t("Импорт…", "Importing…") : t("Импорт из Excel", "Import from Excel")}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                />
                <button type="button" className="ob-btn success" style={{ background: "#166534", color: "white" }} onClick={openNewSubject}>
                  {t("Добавить в реестр", "Add to Registry")}
                </button>
              </div>
            </div>
            <div className="migration-helper-box" style={{
              margin: "1rem 0",
              padding: "1rem",
              backgroundColor: "rgba(52, 152, 219, 0.05)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px"
            }}>
              <h4 style={{ margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
                <span>💡</span> {t("Помощник по быстрой миграции (Yclients, MedFlex, Excel)", "Quick Migration Assistant (Yclients, MedFlex, Excel)")}
              </h4>
              <p className="muted tiny" style={{ margin: 0, lineHeight: "1.4" }}>
                {t(
                  "Чтобы перенести клиентскую базу, выгрузите список клиентов из вашей CRM как CSV-файл. Убедитесь, что колонка с именами называется «ФИО», «Имя» или «Клиент». Колонки с телефонами, почтой и заметками распознаются автоматически. Нажмите «Импорт из Excel» для загрузки.",
                  "To import your client database, export the client list from your CRM as a CSV file. Ensure that the column header for names is named 'Name' or 'Client'. Phone, email, and note columns are recognized automatically. Click 'Import from Excel' to upload.",
                )}
              </p>
            </div>
            {importMessage && <p className="ok tiny">{importMessage}</p>}
            {listBusy && subjects.length === 0 ? <p className="muted">{t("Загрузка…", "Loading…")}</p> : null}
            {!listBusy && subjects.length === 0 ? (
              <p className="muted">
                {commercial
                  ? t("Пока никого нет в реестре. Добавьте клиента — затем откройте консультации.", "No clients in the registry yet. Add a client first — then open consultations.")
                  : t("Пока никого нет в реестре. Добавьте ученика — затем откройте консультации или ИПР.", "No students in the registry yet. Add a student first — then open consultations or ISP.")}
              </p>
            ) : null}
            {subjects.length > 0 && (
              <WorkspaceListSortBar
                options={PERSON_CARD_SORT_OPTIONS}
                value={listSort}
                onChange={setListSort}
              />
            )}
            <ul className="group-session-list registry-subject-list case-pick-list">
              {sortedSubjects.map((row) => (
                <li key={row.case_id} className="registry-subject-list-item">
                  <button
                     type="button"
                     className="case-pick-row"
                     onClick={() => openSubject(row)}
                  >
                    <span className="case-pick-title">
                      {row.profile.full_name || row.situation_title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {listError && <p className="error">{listError}</p>}

            <div style={{ marginTop: '30px' }}>
              <RegistryVaultPanel
                cfg={cfg}
                onConfigChange={onRegistryEnabled}
                onReloadSubjects={() => void reload()}
              />
            </div>
          </section>
          )}

          {editorOpen && (
            <section className="card registry-subject-editor">
              <div className="group-session-editor-head">
                <h3>{editingId ? t("Карточка реестра", "Registry Card") : t("Новая запись реестра", "New Registry Entry")}</h3>
                <div className="registry-editor-head-actions">
                  <button
                    type="button"
                    className="ob-btn secondary"
                    onClick={() => {
                      setEditorOpen(false);
                      setSaveOk(null);
                    }}
                  >
                    {t("← К списку", "← Back to list")}
                  </button>
                </div>
              </div>
              {saveOk && <p className="ok tiny">{saveOk}</p>}

              {showDeleteConfirm && (
                <div className="card" style={{ border: "2px solid #b91c1c", backgroundColor: "rgba(185, 28, 28, 0.05)", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
                  <h4 style={{ color: "#b91c1c", margin: "0 0 1rem 0", fontSize: "1.1rem" }}>{t("⚠️ Внимание! Полное удаление карточки", "⚠️ Warning! Full card deletion")}</h4>
                  <p style={{ margin: "0 0 1rem 0", lineHeight: "1.5", fontSize: "0.95rem" }}>
                    {t(`Вы собираетесь безвозвратно удалить карточку ${draft.full_name || "этого человека"}. При этом из базы данных будут автоматически удалены:`, `You are about to permanently delete the card ${draft.full_name || "this person"}. The following will be automatically removed from the database:`)}
                  </p>
                  <ul style={{ margin: "0 0 1.5rem 1.5rem", padding: 0, lineHeight: "1.6", fontSize: "0.9rem" }}>
                    <li>{t("Все протоколы сессий и консультаций, привязанные к этому человеку.", "All session and consultation protocols linked to this person.")}</li>
                    <li>{t("Все индивидуальные планы сопровождения (ИПР) и их этапы.", "All individualized service plans (ISP) and their stages.")}</li>
                    <li>{t("Все записи в журнале нагрузки специалиста по данной карточке.", "All specialist workload journal entries for this card.")}</li>
                    <li>{t("Записи ФИО, контактов, адресов и законных представителей.", "Records of full name, contacts, addresses, and legal representatives.")}</li>
                  </ul>
                  <p style={{ color: "#b91c1c", fontWeight: "bold", margin: "0 0 1.5rem 0", fontSize: "0.9rem" }}>
                    {t("Это действие необратимо. Вы уверены, что хотите продолжить?", "This action is irreversible. Are you sure you want to continue?")}
                  </p>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button
                      type="button"
                      className="ob-btn danger"
                      style={{ background: "#b91c1c", color: "white", padding: "0.5rem 1.5rem" }}
                      disabled={registryBusy}
                      onClick={() => void handleDeleteSubject()}
                    >
                      {registryBusy ? t("Удаление…", "Deleting…") : t("Да, удалить всё", "Yes, delete everything")}
                    </button>
                    <button
                      type="button"
                      className="ob-btn secondary"
                      style={{ padding: "0.5rem 1.5rem" }}
                      disabled={registryBusy}
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t("Отмена", "Cancel")}
                    </button>
                  </div>
                </div>
              )}

              <form className="registry-subject-form group-session-form" onSubmit={(e) => void handleSaveSubject(e)}>
                <label className="field wide registry-fio-field">
                  <span>ФИО</span>
                  <input
                    type="text"
                    required
                    value={draft.full_name}
                    onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                    placeholder="Иванов Иван Иванович"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls={fioMatches.length ? "registry-fio-suggest" : undefined}
                  />
                  {fioMatches.length > 0 && (
                    <ul id="registry-fio-suggest" className="registry-fio-suggest" role="listbox">
                      {fioMatches.map((row) => (
                        <li key={row.case_id}>
                          <button
                            type="button"
                            role="option"
                            className="registry-fio-suggest-item"
                            onClick={() => openSubject(row)}
                          >
                            <strong>{row.profile.full_name}</strong>
                            {(row.profile.age_years != null ||
                              (!commercial && row.profile.grade_class)) && (
                              <span className="muted tiny">
                                {[
                                  ...(commercial ? [] : [row.profile.grade_class]),
                                  row.profile.age_years != null ? `${row.profile.age_years} лет` : "",
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!editingId && draft.full_name.trim().length >= 2 && fioMatches.length === 0 && (
                    <span className="muted tiny registry-fio-hint">{t("Совпадений нет — будет новая запись.", "No matches – a new entry will be created.")}</span>
                  )}
                </label>
                <label className="field">
                  <span>{t("Пол", "Gender")}</span>
                  <select
                    value={draft.gender}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, gender: e.target.value as RegistryGender }))
                    }
                  >
                    {(genderChoices as RegistryGender[]).map((g) => (
                      <option key={g} value={g}>
                        {registryGenderLabel(g, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("Возраст (лет)", "Age (years)")}</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={draft.age_years ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setDraft((d) => ({
                        ...d,
                        age_years: raw === "" ? null : Math.max(0, Number.parseInt(raw, 10) || 0),
                      }));
                    }}
                  />
                </label>
                {!commercial && (
                <label className="field">
                  <span>{t("Класс / группа", "Class / Group")}</span>
                  <input
                    type="text"
                    value={draft.grade_class}
                    onChange={(e) => setDraft((d) => ({ ...d, grade_class: e.target.value }))}
                    placeholder="7А"
                  />
                </label>
                )}
                <label className="field">
                  <span>{t("Дата рождения", "Date of Birth")}</span>
                  <input
                    type="date"
                    value={draft.birth_date}
                    onChange={(e) => setDraft((d) => ({ ...d, birth_date: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>{t("Телефон", "Phone")}</span>
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    placeholder="+7 900 000-00-00"
                    autoComplete="tel"
                  />
                </label>
                <label className="field">
                  <span>{t("Email", "Email")}</span>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                    placeholder="client@example.com"
                    autoComplete="email"
                  />
                </label>
                <label className="field wide">
                  <span>{t("Адрес", "Address")}</span>
                  <input
                    type="text"
                    value={draft.address}
                    onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                    placeholder="Город, улица, дом"
                    autoComplete="street-address"
                  />
                </label>
                <label className="field wide">
                  <span>{commercial ? t("Контактное лицо", "Contact Person") : t("Законный представитель", "Legal Representative")}</span>
                  <input
                    type="text"
                    value={draft.contact_person}
                    onChange={(e) => setDraft((d) => ({ ...d, contact_person: e.target.value }))}
                    placeholder={commercial ? t("ФИО или роль", "Full name or role") : t("ФИО родителя / опекуна", "Parent/guardian full name")}
                    autoComplete="name"
                  />
                </label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", width: "100%", gridColumn: "span 2" }}>
                  <button type="submit" className="ob-btn success" style={{ background: "#166534", color: "white" }} disabled={registryBusy}>
                    {registryBusy ? "…" : editingId ? t("Сохранить", "Save") : t("Добавить в реестр", "Add to Registry")}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="ob-btn danger"
                      style={{ background: "#991b1b", color: "white" }}
                      disabled={registryBusy}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      {t("Удалить карточку", "Delete Card")}
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}
