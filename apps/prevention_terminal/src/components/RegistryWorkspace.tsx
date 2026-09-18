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
  downloadRegistryTemplateSpreadsheet,
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
import ModuleGuideModal from "./ModuleGuideModal.tsx";
import EmptyStateGuideCard from "./EmptyStateGuideCard.tsx";
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
  const [showGuide, setShowGuide] = useState(false);


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
              <h2>{commercial ? t("Защищенный реестр клиентов", "Secure Client Registry") : t("Защищенный реестр обучающихся", "Secure Student Registry")}</h2>
              <div className="registry-toolbar-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="header-guide-btn"
                  title={t("Интерактивный гид: как устроен реестр, ручной ввод и ИИ", "Interactive guide: registry structure, manual entry & AI")}
                  onClick={() => setShowGuide(true)}
                >
                  ❓ {commercial ? t("Гид по реестру: Вручную vs ИИ", "Registry Guide: Manual vs AI") : t("Гид по реестру: Вручную vs ИИ", "Registry Guide: Manual vs AI")}
                </button>
                <button
                  type="button"
                  className="ob-btn secondary"
                  onClick={() => downloadRegistryTemplateSpreadsheet(commercial)}
                  title={t("Скачать образец таблицы с правильными столбцами и 5 строками примеров", "Download spreadsheet template with columns and 5 sample rows")}
                >
                  📄 {t("Образец таблицы (Excel)", "Excel Template")}
                </button>
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
                  {commercial ? t("+ Добавить клиента", "+ Add Client") : t("+ Добавить обучающегося", "+ Add Student")}
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
                <span>💡</span> {commercial ? t("Помощник по быстрой миграции (CRM, Excel)", "Quick Migration Assistant (CRM, Excel)") : t("Шаблон для загрузки контингента и генерации кодов", "Template for uploading students and generating codes")}
              </h4>
              <p className="muted tiny" style={{ margin: "0 0 0.5rem 0", lineHeight: "1.4" }}>
                {commercial
                  ? t("Чтобы перенести клиентскую базу, выгрузите список из CRM как CSV/Excel файл либо скачайте наш образец. Нажмите «Импорт из Excel» для мгновенной загрузки.", "To import clients, export list from your CRM as CSV/Excel or download our template. Click 'Import from Excel' to load.")
                  : t("Чтобы загрузить учеников и затем автоматически сформировать индивидуальные коды для педагогов, скачайте «Образец таблицы», заполните ФИО и Класс, после чего нажмите «Импорт из Excel».", "To load students and generate educator codes, download 'Excel Template', fill Full Name and Grade, then click 'Import from Excel'.")
                }
              </p>
              {!commercial && (
                <div style={{
                  margin: "8px 0 4px 0",
                  padding: "8px 12px",
                  background: "rgba(14, 165, 233, 0.08)",
                  borderLeft: "3px solid #0284c7",
                  borderRadius: "4px"
                }}>
                  <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.45", color: "#0369a1" }}>
                    <strong>🔗 Сквозная привязка данных (в отличие от разовых анонимных консультаций):</strong> единая запись ученика в реестре автоматически объединяет в единую историю протоколы консультаций, сигналы из Журнала наблюдений педагогов, паспорт сопровождения, программы ИПР и годовую нагрузку специалиста.
                  </p>
                </div>
              )}
              <div style={{ overflowX: "auto", margin: "6px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", background: "white" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("ФИО", "Full Name")}</th>
                      <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{commercial ? t("Возраст", "Age") : t("Класс или группа", "Grade / Class")}</th>
                      <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Пол", "Gender")}</th>
                      <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Телефон", "Phone")}</th>
                      <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Контактное лицо / Заметки", "Contact person / Notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Иванов Иван Алексеевич</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{commercial ? "34" : "8Б"}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Мужской</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>+7 900 123-45-67</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{commercial ? "Иванова Ольга (супруга)" : "Иванова Елена (мать)"}</td>
                    </tr>
                    <tr style={{ background: "#fafafa" }}>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Смирнова Анна Дмитриевна</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{commercial ? "28" : "8Б"}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Женский</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>+7 900 234-56-78</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{commercial ? "Запрос на коучинг" : "Смирнов Дмитрий (отец)"}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Козлов Михаил Сергеевич</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{commercial ? "42" : "6А"}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Мужской</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>+7 900 345-67-89</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{commercial ? "Семейная консультация" : "Козлова Ольга (мать)"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {importMessage && <p className="ok tiny">{importMessage}</p>}
            {listBusy && subjects.length === 0 ? <p className="muted">{t("Загрузка…", "Loading…")}</p> : null}
            {!listBusy && subjects.length === 0 ? (
              <EmptyStateGuideCard
                isCommercial={commercial}
                icon="👥"
                title={commercial ? t("Картотека ваших клиентов", "Your Client Card Index") : t("Список обучающихся", "School Student Registry")}
                description={commercial
                  ? t("Безопасный реестр с локальным шифрованием. Вы можете быстро импортировать базу из Excel за 1 клик или добавлять клиентов по мере обращений.", "Secure registry with local encryption. Quickly import base from Excel in 1 click or add clients on demand.")
                  : t("Централизованный учет контингента школы. В отличие от анонимных разовых записей, реестр позволяет бесшовно сшивать между собой консультации, сигналы наблюдений педагогов, паспорт сопровождения и программы ИПР в единую траекторию ученика.", "Centralized school student tracking. Unlike anonymous one-off entries, the registry connects consultations, teacher observation signals, accompaniment passports, and IPR/IEP plans into a unified student trajectory.")
                }
                primaryActionLabel={commercial ? t("+ Добавить первого клиента", "+ Add First Client") : t("+ Добавить первого обучающегося", "+ Add First Student")}
                onPrimaryAction={openNewSubject}
                onOpenGuide={() => setShowGuide(true)}
              />
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
                      {row.profile.full_name || t("Без имени", "Unnamed")}
                      {!row.profile.consent_date && (
                        <span style={{ color: "#ef4444", marginLeft: "6px", fontSize: "12px" }} title="Нет согласия">⚠️</span>
                      )}
                    </span>
                    <span className="case-pick-meta">
                      {row.profile.age_years != null ? `${row.profile.age_years} ${t("лет", "y.o.")}` : null}
                      {row.profile.grade_class ? ` · ${row.profile.grade_class}` : null}
                      {row.profile.gender ? ` · ${registryGenderLabel(row.profile.gender, locale)}` : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {listError && <p className="error">{listError}</p>}

            <details className="card registry-info-vault-accordion" style={{ marginTop: "24px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 16px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "14px", color: "#0f766e", display: "flex", alignItems: "center", gap: "8px", userSelect: "none" }}>
                <span>🔒</span>
                <span>{t("Инструкция: Безопасность данных, как вносить и как переносить на другие устройства (.vault.enc)", "Instructions: Data security, how to enter & transfer to other devices (.vault.enc)")}</span>
              </summary>
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px 16px" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "#1e293b" }}>
                    🛡️ {t("100% Локальное хранение данных (Zero-Knowledge)", "100% Local Data Storage (Zero-Knowledge)")}
                  </h4>
                  <p style={{ margin: "0 0 10px", fontSize: "13px", lineHeight: "1.5", color: "#475569" }}>
                    {t(
                      "Все персональные данные (ФИО, телефоны, адреса, заметки) хранятся исключительно в зашифрованной локальной базе на вашем устройстве. Они никогда не отправляются на серверы Prevention или в облако без вашего явного экспорта.",
                      "All personal data (names, phones, addresses, notes) is stored strictly in the local encrypted database on your device. It is never sent to Prevention servers or cloud without explicit export.",
                    )}
                  </p>
                  <h5 style={{ margin: "10px 0 6px", fontSize: "13px", color: "#0f766e" }}>
                    {t("Как вносить записи:", "How to enter records:")}
                  </h5>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", lineHeight: "1.6", color: "#334155" }}>
                    <li><strong>{t("Вручную:", "Manually:")}</strong> {t("нажмите «+ Добавить», заполните основные поля (ФИО, возраст, класс/телефон) и сохраните.", "click '+ Add', fill in basic fields (full name, age, class/phone) and save.")}</li>
                    <li><strong>{t("Импорт из Excel/CSV:", "Import from Excel/CSV:")}</strong> {t("если у вас есть готовый список классов или клиентов в таблице, нажмите «Импорт из Excel» — система автоматически заполнит реестр.", "if you have an existing list in spreadsheet, click 'Import from Excel' to auto-populate.")}</li>
                    <li><strong>{t("Из консультаций и кейсов:", "From consultations and cases:")}</strong> {t("в протоколах консультаций можно сразу привязать запись из реестра или создать новую.", "in consultation protocols you can immediately link a registry record or create a new one.")}</li>
                  </ul>
                  {!commercial && (
                    <div style={{
                      marginTop: "12px",
                      padding: "10px 14px",
                      background: "rgba(14, 165, 233, 0.08)",
                      border: "1px solid rgba(14, 165, 233, 0.2)",
                      borderRadius: "6px"
                    }}>
                      <h5 style={{ margin: "0 0 4px", fontSize: "13px", color: "#0369a1" }}>
                        🧩 Сквозная сшивка модулей через картотеку ученика
                      </h5>
                      <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.5", color: "#0c4a6e" }}>
                        В отличие от разовых анонимных записей, единая карточка в Реестре служит якорем: она связывает воедино историю всех <strong>консультаций</strong>, отметки из <strong>Журнала наблюдений</strong> педагогов, накопленный <strong>паспорт сопровождения</strong>, индивидуальные программы <strong>ИПР</strong> и автоматический подсчет нагрузки в <strong>годовом отчете</strong>.
                      </p>
                    </div>
                  )}
                  <h5 style={{ margin: "12px 0 6px", fontSize: "13px", color: "#0f766e" }}>
                    {t("Как перенести реестр на другой компьютер:", "How to transfer registry to another computer:")}
                  </h5>
                  <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", lineHeight: "1.6", color: "#334155" }}>
                    <li>{t("Ниже настройте ключ восстановления (сохраните его себе в надежное место).", "Configure recovery key below (save it in a safe place).")}</li>
                    <li>{t("Нажмите «Создать .vault.enc» — скачается зашифрованный файл с базой.", "Click 'Create .vault.enc' — an encrypted file with your data will download.")}</li>
                    <li>{t("На новом компьютере откройте Реестр, введите ваш ключ восстановления и нажмите «Восстановить из копии».", "On the new computer, open Registry, enter your recovery key and click 'Restore backup'.")}</li>
                  </ol>
                </div>

                <RegistryVaultPanel
                  cfg={cfg}
                  onConfigChange={onRegistryEnabled}
                  onReloadSubjects={() => void reload()}
                />
              </div>
            </details>
          </section>
          )}

          {editorOpen && (
            <section className="card registry-subject-editor">
              <div className="registry-editor-header">
                <div className="registry-editor-profile-summary">
                  <div className="registry-editor-avatar">
                    {draft.full_name ? (
                      draft.full_name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("") || "👤"
                    ) : (
                      "👤"
                    )}
                  </div>
                  <div className="registry-editor-title-wrap">
                    <div className="registry-editor-title-row">
                      <h3>
                        {editingId
                          ? draft.full_name || (commercial ? t("Карточка клиента", "Client Card") : t("Карточка обучающегося", "Student Card"))
                          : (commercial ? t("Новый клиент", "New Client") : t("Новый обучающийся", "New Student"))}
                      </h3>
                    </div>
                    <div className="registry-editor-badges">
                      <span className="registry-badge registry-badge--type">
                        {commercial ? t("Клиент практики", "Client") : t("Обучающийся", "Student")}
                      </span>
                      {draft.age_years != null && (
                        <span className="registry-badge registry-badge--info">
                          🎂 {draft.age_years} {t("лет", "y.o.")}
                        </span>
                      )}
                      {!commercial && draft.grade_class && (
                        <span className="registry-badge registry-badge--info">
                          🏫 {draft.grade_class}
                        </span>
                      )}
                      {draft.consent_date ? (
                        <span className="registry-badge registry-badge--success" title={t("Информированное согласие оформлено", "Informed consent on file")}>
                          ✓ {t(`Согласие Ф.16 от ${draft.consent_date}`, `Consent from ${draft.consent_date}`)}
                        </span>
                      ) : (
                        <span className="registry-badge registry-badge--warning" title={t("Требуется подписать согласие (Ф.16)", "Consent required")}>
                          ⚠️ {t("Согласие не оформлено", "No consent recorded")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="registry-editor-head-actions">
                  <button
                    type="button"
                    className="ob-btn secondary registry-back-btn"
                    onClick={() => {
                      setEditorOpen(false);
                      setSaveOk(null);
                    }}
                  >
                    <span>←</span> {t("К списку", "Back to list")}
                  </button>
                </div>
              </div>

              {saveOk && (
                <div className="registry-alert-success">
                  <span className="registry-alert-icon">✓</span>
                  <span>{saveOk}</span>
                </div>
              )}

              {showDeleteConfirm && (
                <div className="registry-delete-confirm-card">
                  <div className="registry-delete-confirm-head">
                    <span className="registry-delete-icon">⚠️</span>
                    <h4>{t("Полное удаление карточки из локального реестра", "Full card deletion")}</h4>
                  </div>
                  <p className="registry-delete-warn-text">
                    {t(`Вы собираетесь безвозвратно удалить карточку «${draft.full_name || "этого человека"}». При этом будут автоматически удалены:`, `You are about to permanently delete the card "${draft.full_name || "this person"}". The following will be deleted:`)}
                  </p>
                  <ul className="registry-delete-list">
                    <li>{t("Все протоколы сессий и консультаций, привязанные к этому человеку.", "All session and consultation protocols linked to this person.")}</li>
                    <li>{t("Все индивидуальные планы сопровождения (ИПР) и их этапы.", "All individualized service plans (ISP) and their stages.")}</li>
                    <li>{t("Все записи в журнале нагрузки специалиста по данной карточке.", "All specialist workload journal entries for this card.")}</li>
                    <li>{t("Персональные данные, контакты и юридические согласия.", "Personal data, contacts, and legal consents.")}</li>
                  </ul>
                  <p className="registry-delete-note">
                    {t("Это действие необратимо. Подтверждаете удаление?", "This action is irreversible. Confirm deletion?")}
                  </p>
                  <div className="registry-delete-actions">
                    <button
                      type="button"
                      className="ob-btn danger"
                      style={{ background: "#dc2626", color: "white" }}
                      disabled={registryBusy}
                      onClick={() => void handleDeleteSubject()}
                    >
                      {registryBusy ? t("Удаление…", "Deleting…") : t("Да, удалить всё", "Yes, delete everything")}
                    </button>
                    <button
                      type="button"
                      className="ob-btn secondary"
                      disabled={registryBusy}
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t("Отмена", "Cancel")}
                    </button>
                  </div>
                </div>
              )}

              <form className="registry-subject-form" onSubmit={(e) => void handleSaveSubject(e)}>
                <div className="registry-form-section">
                  <div className="registry-section-header">
                    <span className="registry-section-icon">👤</span>
                    <div>
                      <h4 className="registry-section-title">{t("Основные сведения", "Personal Details")}</h4>
                      <p className="registry-section-desc">{t("ФИО, пол, возрастные параметры и привязка к группе", "Full name, gender, age parameters and group binding")}</p>
                    </div>
                  </div>
                  
                  <div className="registry-form-grid">
                    <label className="registry-field registry-field--full">
                      <span className="registry-field-label">
                        <span>{t("ФИО клиента / обучающегося", "Full Name")}</span>
                        <span className="registry-field-required">*</span>
                      </span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">👤</span>
                        <input
                          type="text"
                          required
                          value={draft.full_name}
                          onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                          placeholder={t("Иванов Иван Иванович", "Ivanov Ivan Ivanovich")}
                          autoComplete="off"
                          aria-autocomplete="list"
                          aria-controls={fioMatches.length ? "registry-fio-suggest" : undefined}
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
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
                                <div className="registry-suggest-name">
                                  <strong>{row.profile.full_name}</strong>
                                </div>
                                {(row.profile.age_years != null ||
                                  (!commercial && row.profile.grade_class)) && (
                                  <span className="registry-suggest-meta">
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
                        <span className="registry-fio-hint">{t("Совпадений нет — будет создана новая уникальная запись.", "No matches – a new unique record will be created.")}</span>
                      )}
                    </label>

                    <label className="registry-field">
                      <span className="registry-field-label">{t("Пол", "Gender")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">⚧</span>
                        <select
                          value={draft.gender}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, gender: e.target.value as RegistryGender }))
                          }
                          className="registry-select registry-input--with-icon"
                        >
                          {(genderChoices as RegistryGender[]).map((g) => (
                            <option key={g} value={g}>
                              {registryGenderLabel(g, locale)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="registry-field">
                      <span className="registry-field-label">{t("Возраст (полных лет)", "Age (years)")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">🎂</span>
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
                          placeholder={t("Например, 14", "e.g. 14")}
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                    </label>

                    <label className="registry-field">
                      <span className="registry-field-label">{t("Дата рождения", "Date of Birth")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">📅</span>
                        <input
                          type="date"
                          value={draft.birth_date}
                          onChange={(e) => setDraft((d) => ({ ...d, birth_date: e.target.value }))}
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                    </label>

                    {!commercial && (
                      <label className="registry-field">
                        <span className="registry-field-label">{t("Класс / группа", "Class / Group")}</span>
                        <div className="registry-input-wrap has-icon">
                          <span className="registry-input-icon">🏫</span>
                          <input
                            type="text"
                            value={draft.grade_class}
                            onChange={(e) => setDraft((d) => ({ ...d, grade_class: e.target.value }))}
                            placeholder="8Б"
                            className="registry-input registry-input--with-icon"
                          />
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <div className="registry-form-section">
                  <div className="registry-section-header">
                    <span className="registry-section-icon">📞</span>
                    <div>
                      <h4 className="registry-section-title">{t("Контакты и адрес", "Contacts & Location")}</h4>
                      <p className="registry-section-desc">{t("Связь с клиентом для отправки материалов и очных встреч", "Communication channels and address")}</p>
                    </div>
                  </div>

                  <div className="registry-form-grid">
                    <label className="registry-field">
                      <span className="registry-field-label">{t("Телефон", "Phone")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">📱</span>
                        <input
                          type="tel"
                          value={draft.phone}
                          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                          placeholder="+7 900 000-00-00"
                          autoComplete="tel"
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                    </label>

                    <label className="registry-field">
                      <span className="registry-field-label">{t("Email", "Email")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">✉️</span>
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                          placeholder="client@example.com"
                          autoComplete="email"
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                    </label>

                    <label className="registry-field registry-field--full">
                      <span className="registry-field-label">{t("Адрес проживания", "Residential Address")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">📍</span>
                        <input
                          type="text"
                          value={draft.address}
                          onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                          placeholder={t("Город, улица, дом, квартира", "City, street, house, apt")}
                          autoComplete="street-address"
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="registry-form-section">
                  <div className="registry-section-header">
                    <span className="registry-section-icon">🛡️</span>
                    <div>
                      <h4 className="registry-section-title">{t("Представитель и согласие (Ф.16)", "Representative & Legal Consent")}</h4>
                      <p className="registry-section-desc">{t("Юридические основания сопровождения по 152-ФЗ и протоколам этики", "Legal grounds for psychological accompaniment")}</p>
                    </div>
                  </div>

                  <div className="registry-form-grid">
                    <label className="registry-field registry-field--wide">
                      <span className="registry-field-label">
                        {commercial ? t("Контактное лицо / Представитель", "Contact Person / Representative") : t("Законный представитель (родитель / опекун)", "Legal Representative (Parent / Guardian)")}
                      </span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">👨‍👩‍👧</span>
                        <input
                          type="text"
                          value={draft.contact_person}
                          onChange={(e) => setDraft((d) => ({ ...d, contact_person: e.target.value }))}
                          placeholder={commercial ? t("ФИО или степень родства / роль", "Full name or relationship role") : t("ФИО родителя / опекуна (например, Иванова Ольга Сергеевна)", "Parent full name")}
                          autoComplete="name"
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                    </label>

                    <label className="registry-field">
                      <span className="registry-field-label">{t("Дата согласия (Ф.16)", "Consent Date (Form 16)")}</span>
                      <div className="registry-input-wrap has-icon">
                        <span className="registry-input-icon">📜</span>
                        <input
                          type="date"
                          value={draft.consent_date}
                          onChange={(e) => setDraft((d) => ({ ...d, consent_date: e.target.value }))}
                          className="registry-input registry-input--with-icon"
                        />
                      </div>
                      <span className="registry-field-hint">
                        {draft.consent_date ? (
                          <span style={{ color: "#059669", fontWeight: 600 }}>✓ {t("Согласие действительно", "Consent active")}</span>
                        ) : (
                          <span style={{ color: "#d97706" }}>⚠️ {t("Рекомендуется заполнить", "Recommended")}</span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="registry-form-actions-bar">
                  <div className="registry-form-actions-left">
                    <button
                      type="submit"
                      className="ob-btn primary registry-submit-btn"
                      disabled={registryBusy}
                    >
                      {registryBusy
                        ? t("Сохранение…", "Saving…")
                        : editingId
                        ? t("💾 Сохранить изменения", "💾 Save Changes")
                        : t("✨ Добавить в реестр", "✨ Add to Registry")}
                    </button>
                    <button
                      type="button"
                      className="ob-btn secondary"
                      disabled={registryBusy}
                      onClick={() => {
                        setEditorOpen(false);
                        setSaveOk(null);
                      }}
                    >
                      {t("Отмена", "Cancel")}
                    </button>
                  </div>

                  {editingId && (
                    <button
                      type="button"
                      className="ob-btn danger registry-delete-btn"
                      disabled={registryBusy}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      {t("🗑️ Удалить карточку", "🗑️ Delete Card")}
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
        </>
      )}

      <ModuleGuideModal
        moduleId="registry"
        isCommercial={commercial}
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onCtaClick={openNewSubject}
      />
    </div>
  );
}
