import { getTerminalEdition } from "../lib/terminal_edition.ts";
import React, { useState, useEffect } from "react";
import { TerminalConfig } from "../lib/terminal_config.ts";
import { t } from "../lib/i18n.ts";
import { listRegistrySubjects } from "../lib/registry_store.ts";
import { downloadEducatorCodesSpreadsheet } from "../lib/educator_codes_export.ts";
import { downloadRegistryTemplateSpreadsheet } from "../lib/registry_spreadsheet.ts";
import ObservationMetricsConstructorModal from "./ObservationMetricsConstructorModal.tsx";

interface ObservationReportsProps {
  cfg: TerminalConfig;
  onNavigateToAcademy?: () => void;
}

// Structure for reports
interface Report {
  id: string;
  studentName: string;
  className: string;
  teacherName: string;
  date: string;
  status: "open" | "in_progress" | "post_obs" | "archived";
  metrics: { title: string; score: number }[];
  sos: boolean;
  comment: string;
}

const STORAGE_KEY = "terminal_observation_reports";
const BANNER_DISMISSED_KEY = "terminal_observation_banner_dismissed";

function loadSavedReports(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReports(reports: Report[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (_) {}
}

function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search;
  return search.includes("demo=") || search.includes("demo=1") || search.includes("demo=school");
}

export default function ObservationReportsWorkspace({ cfg, onNavigateToAcademy }: ObservationReportsProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConstructor, setShowConstructor] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(BANNER_DISMISSED_KEY) !== "true";
  });

  const handleDismissBanner = () => {
    setShowInfoBanner(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    }
  };

  const handleGenerateCodes = async () => {
    try {
      const subjects = await listRegistrySubjects();
      downloadEducatorCodesSpreadsheet(subjects);
    } catch (err) {
      alert("Ошибка генерации кодов: " + String(err));
    }
  };

  useEffect(() => {
    const saved = loadSavedReports();
    if (saved.length > 0) {
      setReports(saved);
      setLoading(false);
    } else if (isDemoMode()) {
      // In demo mode only, seed demonstration data
      const isIntl = getTerminalEdition() === "intl";
      const demoData: Report[] = [
        {
          id: "rep-1",
          studentName: isIntl ? "John Doe" : "Иванов Иван",
          className: isIntl ? "Grade 7A" : "7А",
          teacherName: isIntl ? "A. Smith" : "Смирнова А.И.",
          date: new Date().toISOString().split("T")[0],
          status: "open",
          metrics: [
            { title: isIntl ? "Aggressiveness" : "Агрессивность", score: 2 },
            { title: isIntl ? "Academic Disadaptation" : "Учебная дезадаптация", score: 1 },
          ],
          sos: true,
          comment: isIntl ? "Disrupts classes, reacts aggressively to feedback" : "Срывает уроки, агрессивно реагирует на замечания",
        },
        {
          id: "rep-2",
          studentName: isIntl ? "Peter Parker" : "Петров Петр",
          className: isIntl ? "Grade 8B" : "8Б",
          teacherName: isIntl ? "V. Williams" : "Васильев В.В.",
          date: new Date().toISOString().split("T")[0],
          status: "in_progress",
          metrics: [
            { title: isIntl ? "Social Isolation" : "Социальная изоляция", score: 2 },
            { title: isIntl ? "Emotional Instability" : "Эмоциональная нестабильность", score: 1 },
          ],
          sos: false,
          comment: isIntl ? "Always sits alone, appears depressed" : "Все время сидит один, выглядит подавленным",
        }
      ];
      setReports(demoData);
      saveReports(demoData);
      setLoading(false);
    } else {
      // Clean account — start with empty list
      setReports([]);
      setLoading(false);
    }
  }, []);

  const updateStatus = (id: string, newStatus: Report["status"]) => {
    setReports(prev => {
      const next = prev.map(r => r.id === id ? { ...r, status: newStatus } : r);
      saveReports(next);
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>{t("Срочно (Новый)", "Urgent (New)")}</span>;
      case "in_progress": return <span style={{ background: "#fef08a", color: "#854d0e", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>{t("В работе", "In Progress")}</span>;
      case "post_obs": return <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>{t("Пост-наблюдение", "Post-Observation")}</span>;
      case "archived": return <span style={{ background: "#e2e8f0", color: "#475569", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>{t("В архиве", "Archived")}</span>;
      default: return null;
    }
  };

  return (
    <div className="workspace-panel-stack">
      <section className="card workspace-journal-card">
        {/* Informational Banner */}
        {showInfoBanner && (
          <div
            style={{
              marginBottom: "20px",
              padding: "16px 20px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.12) 100%)",
              border: "1.5px solid var(--accent, #818cf8)",
              borderRadius: "12px",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.5rem", lineHeight: "1" }}>💡</span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "var(--text, #1e293b)" }}>
                    {t("Журнал наблюдений: как это устроено", "Observation Journal: How It Works")}
                  </h3>
                  <div style={{ fontSize: "0.88rem", lineHeight: "1.5", color: "var(--text-secondary, #475569)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <p style={{ margin: 0 }}>
                      • <strong>{t("1. Настройка маркеров:", "1. Configure markers:")}</strong> {t("в «Конструкторе показателей» настройте маркеры дезадаптации и риска (агрессивность, пропуски, эмоциональная нестабильность) под задачи вашей школы.", "in 'Indicators Builder', customize risk and maladaptation indicators for your school.")}
                    </p>
                    <p style={{ margin: 0 }}>
                      • <strong>{t("2. Выдача кодов педагогам:", "2. Teacher access codes:")}</strong> {t("загрузите список классов в «Реестр» и нажмите «Сгенерировать коды доступа», чтобы выдать классным руководителям защищённый PIN-доступ.", "import classes into 'Registry' and click 'Generate Access Codes' to provide PINs to educators.")}
                    </p>
                    <p style={{ margin: 0 }}>
                      • <strong>{t("3. Фиксация сигналов:", "3. Signal tracking:")}</strong> {t("наблюдения учителей мгновенно поступают в эту таблицу и во «Входящие обращения» с автоподсчётом баллов риска и SOS-отметками.", "observations from teachers instantly appear in this journal and your Inbox with risk scores and SOS alerts.")}
                    </p>
                  </div>

                  <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <a
                      href="https://prevention-ai.ru/academy/course/player.html#9"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ob-btn"
                      style={{
                        fontSize: "0.82rem",
                        padding: "6px 14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#6366f1",
                        color: "#fff",
                        textDecoration: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                      }}
                    >
                      <span>🎓 {t("Смотреть лекцию «9. Наблюдение»", "Watch Lecture '9. Observation'")}</span>
                    </a>

                    <button
                      type="button"
                      className="ob-btn ob-btn--ghost"
                      onClick={handleDismissBanner}
                      style={{ fontSize: "0.8rem", padding: "6px 12px", color: "var(--muted, #64748b)" }}
                    >
                      {t("Больше не показывать", "Don't show again")}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismissBanner}
                title={t("Закрыть", "Close")}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  color: "var(--muted, #94a3b8)",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="workspace-journal-head" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2>{t("Журнал наблюдений", "Observation Journal")}</h2>
            <p className="muted tiny" style={{ margin: "4px 0 0" }}>
              {t("Фиксация поведенческих маркеров, сигналы от педагогов и скрининг группы риска.", "Risk marker tracking, teacher alerts, and at-risk student screening.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => setShowConstructor(true)}
              title={t("Настроить стандарты и добавить уникальные показания вашей школы", "Configure standards and custom school indicators")}
              style={{ border: "1px solid #818cf8", color: "#4338ca", background: "#eef2ff" }}
            >
              {t("⚙️ Конструктор показателей", "⚙️ Indicators Builder")}
            </button>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => downloadRegistryTemplateSpreadsheet(false)}
              title={t("Скачать готовый Excel/CSV образец таблицы с названиями колонок и примерами данных", "Download Excel/CSV sample spreadsheet template")}
            >
              {t("📄 Образец таблицы (Excel)", "📄 Sample Spreadsheet (Excel)")}
            </button>
            <button className="ob-btn secondary" onClick={handleGenerateCodes} title={t("Сформировать Excel-файл с индивидуальными кодами для классных руководителей", "Generate Excel file with teacher access PIN codes")}>
              {t("🔑 Сгенерировать коды доступа (Excel)", "🔑 Generate Access Codes (Excel)")}
            </button>
          </div>
        </div>

        <div style={{
          margin: "0 0 16px 0",
          padding: "12px 16px",
          background: "var(--accent-bg, rgba(59, 130, 246, 0.05))",
          border: "1px solid var(--border-color, #cbd5e1)",
          borderRadius: "8px",
          fontSize: "13px"
        }}>
          <div style={{ fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>📋</span> {t("Как подготовить список учеников для выдачи кодов педагогам:", "How to prepare student list for educator codes:")}
          </div>
          <p className="muted tiny" style={{ margin: "0 0 8px 0", lineHeight: 1.4 }}>
            {t(
              "1. Нажмите «Образец таблицы», чтобы скачать файл с правильными столбцами.",
              "1. Click 'Sample Spreadsheet' to download the template file with proper columns."
            )}<br />
            {t(
              "2. Заполните колонку «ФИО» и «Класс или группа» (например: 8Б, 6А, 11А).",
              "2. Fill in 'Full Name' and 'Class or Group' (e.g., 8B, 6A, 11A)."
            )}<br />
            {t(
              "3. Загрузите файл в разделе «Реестр обучающихся» через кнопку «Импорт из Excel».",
              "3. Upload the file in 'Student Registry' via 'Import from Excel'."
            )}<br />
            {t(
              "4. Нажмите «Сгенерировать коды доступа» — система сформирует файл с готовыми кодами для учителей каждого класса.",
              "4. Click 'Generate Access Codes' — system will create a file with PIN codes for teachers of each class."
            )}
          </p>
          <div style={{ overflowX: "auto", marginTop: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", background: "white" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("ФИО", "Full Name")}</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Класс или группа", "Class or Group")}</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Пол", "Gender")}</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Возраст", "Age")}</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>{t("Контактное лицо (родитель)", "Contact Person (Parent)")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Иванов Иван Алексеевич", "John Smith")}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>8B</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Мужской", "Male")}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>14</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Иванова Елена (мать)", "Helen Smith (Mother)")}</td>
                </tr>
                <tr style={{ background: "#fafafa" }}>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Смирнова Анна Дмитриевна", "Anna Taylor")}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>8B</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Женский", "Female")}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>14</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Смирнов Дмитрий (отец)", "David Taylor (Father)")}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Козлов Михаил Сергеевич", "Michael Miller")}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>6A</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Мужской", "Male")}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>12</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>{t("Козлова Ольга (мать)", "Olga Miller (Mother)")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {loading ? (
          <p className="muted">{t("Загрузка данных...", "Loading data...")}</p>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted, #64748b)" }}>
            <p style={{ fontSize: "1rem", margin: "0 0 8px 0" }}>
              {t("В журнале пока нет записей наблюдений от педагогов.", "No observation entries from educators yet.")}
            </p>
            <p className="tiny muted" style={{ margin: 0 }}>
              {t(
                "Когда классные руководители внесут наблюдения по кодам доступа или передадут сигналы из формы педагога, они появятся в этой таблице.",
                "When class teachers submit observations using PIN codes, they will automatically appear in this table."
              )}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>{t("Дата / Педагог", "Date / Educator")}</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>{t("Обучающийся", "Student")}</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>{t("Маркеры риска", "Risk Markers")}</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>{t("Комментарий / SOS", "Comment / SOS")}</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>{t("Статус", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 500 }}>{r.date}</div>
                      <div className="muted tiny">{r.teacherName}</div>
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 500 }}>{r.studentName}</div>
                      <div className="muted tiny">{r.className}</div>
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      <ul style={{ margin: 0, paddingLeft: "16px", color: "#b91c1c" }}>
                        {r.metrics.map((m, idx) => (
                          <li key={idx}>
                            {m.title} <strong style={{ color: m.score === 2 ? "#991b1b" : "#b45309" }}>({m.score} {t("б.", "pts")})</strong>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      {r.sos && <span style={{ color: "#dc2626", fontWeight: "bold", marginRight: "4px" }}>[SOS]</span>}
                      {r.comment || <span className="muted">{t("Нет комментария", "No comment")}</span>}
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      <div style={{ marginBottom: "8px" }}>{getStatusBadge(r.status)}</div>
                      <select 
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value as Report["status"])}
                        style={{ fontSize: "11px", padding: "2px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                      >
                        <option value="open">{t("Срочно (Новый)", "Urgent (New)")}</option>
                        <option value="in_progress">{t("В работе", "In Progress")}</option>
                        <option value="post_obs">{t("Пост-наблюдение", "Post-Observation")}</option>
                        <option value="archived">{t("В архив", "To Archive")}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ObservationMetricsConstructorModal
        isOpen={showConstructor}
        onClose={() => setShowConstructor(false)}
      />
    </div>
  );
}
