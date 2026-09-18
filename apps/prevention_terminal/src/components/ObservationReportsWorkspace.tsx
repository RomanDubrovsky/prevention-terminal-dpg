import React, { useState, useEffect } from "react";
import { TerminalConfig } from "../lib/terminal_config";
import { t } from "../lib/i18n";
import { listRegistrySubjects } from "../lib/registry_store";
import { downloadEducatorCodesSpreadsheet } from "../lib/educator_codes_export";
import { downloadRegistryTemplateSpreadsheet } from "../lib/registry_spreadsheet";
import ObservationMetricsConstructorModal from "./ObservationMetricsConstructorModal";

interface ObservationReportsProps {
  cfg: TerminalConfig;
}

// Mock structure for reports
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

export default function ObservationReportsWorkspace({ cfg }: ObservationReportsProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConstructor, setShowConstructor] = useState(false);

  const handleGenerateCodes = async () => {
    try {
      const subjects = await listRegistrySubjects();
      downloadEducatorCodesSpreadsheet(subjects);
    } catch (err) {
      alert("Ошибка генерации кодов: " + String(err));
    }
  };

  useEffect(() => {
    // Simulate fetching from Supabase / Backend
    setTimeout(() => {
      setReports([
        {
          id: "rep-1",
          studentName: "Иванов Иван",
          className: "7А",
          teacherName: "Смирнова А.И.",
          date: new Date().toISOString().split("T")[0],
          status: "open",
          metrics: [
            { title: "Агрессивность", score: 2 },
            { title: "Учебная дезадаптация", score: 1 },
          ],
          sos: true,
          comment: "Срывает уроки, агрессивно реагирует на замечания",
        },
        {
          id: "rep-2",
          studentName: "Петров Петр",
          className: "8Б",
          teacherName: "Васильев В.В.",
          date: new Date().toISOString().split("T")[0],
          status: "in_progress",
          metrics: [
            { title: "Социальная изоляция", score: 2 },
            { title: "Эмоциональная нестабильность", score: 1 },
          ],
          sos: false,
          comment: "Все время сидит один, выглядит подавленным",
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const updateStatus = (id: string, newStatus: Report["status"]) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>Срочно (Новый)</span>;
      case "in_progress": return <span style={{ background: "#fef08a", color: "#854d0e", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>В работе</span>;
      case "post_obs": return <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>Пост-наблюдение</span>;
      case "archived": return <span style={{ background: "#e2e8f0", color: "#475569", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>В архиве</span>;
      default: return null;
    }
  };

  return (
    <div className="workspace-panel-stack">
      <section className="card workspace-journal-card">
        <div className="workspace-journal-head" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2>{t("Отчеты наблюдений", "Observation Reports")}</h2>
            <p className="muted tiny" style={{ margin: "4px 0 0" }}>
              Сигналы и тревожные маркеры от педагогов и классных руководителей.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => setShowConstructor(true)}
              title="Настроить стандарты ФГОС и добавить уникальные показания вашей школы"
              style={{ border: "1px solid #818cf8", color: "#4338ca", background: "#eef2ff" }}
            >
              ⚙️ Конструктор показателей
            </button>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => downloadRegistryTemplateSpreadsheet(false)}
              title="Скачать готовый Excel/CSV образец таблицы с названиями колонок и примерами данных"
            >
              📄 Образец таблицы (Excel)
            </button>
            <button className="ob-btn secondary" onClick={handleGenerateCodes} title="Сформировать Excel-файл с индивидуальными кодами для классных руководителей">
              🔑 Сгенерировать коды доступа (Excel)
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
            1. Нажмите <strong>«Образец таблицы»</strong>, чтобы скачать файл с правильными столбцами.<br />
            2. Заполните колонку <strong>«ФИО»</strong> и <strong>«Класс или группа»</strong> (например: 8Б, 6А, 11А).<br />
            3. Загрузите файл в разделе <strong>«Реестр обучающихся»</strong> через кнопку <em>«Импорт из Excel»</em>.<br />
            4. Нажмите <strong>«Сгенерировать коды доступа»</strong> — система сформирует файл с готовыми кодами для учителей каждого класса.
          </p>
          <div style={{ overflowX: "auto", marginTop: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", background: "white" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>ФИО</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Класс или группа</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Пол</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Возраст</th>
                  <th style={{ padding: "4px 8px", border: "1px solid #cbd5e1", textAlign: "left" }}>Контактное лицо (родитель)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Иванов Иван Алексеевич</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>8Б</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Мужской</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>14</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Иванова Елена (мать)</td>
                </tr>
                <tr style={{ background: "#fafafa" }}>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Смирнова Анна Дмитриевна</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>8Б</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Женский</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>14</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Смирнов Дмитрий (отец)</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Козлов Михаил Сергеевич</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>6А</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Мужской</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>12</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>Козлова Ольга (мать)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {loading ? (
          <p className="muted">Загрузка данных...</p>
        ) : reports.length === 0 ? (
          <p className="muted">Нет активных отчетов от педагогов.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>Дата / Педагог</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>Обучающийся</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>Маркеры риска</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>Комментарий / SOS</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #e2e8f0" }}>Статус</th>
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
                            {m.title} <strong style={{ color: m.score === 2 ? "#991b1b" : "#b45309" }}>({m.score} б.)</strong>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      {r.sos && <span style={{ color: "#dc2626", fontWeight: "bold", marginRight: "4px" }}>[SOS]</span>}
                      {r.comment || <span className="muted">Нет комментария</span>}
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      <div style={{ marginBottom: "8px" }}>{getStatusBadge(r.status)}</div>
                      <select 
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value as Report["status"])}
                        style={{ fontSize: "11px", padding: "2px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                      >
                        <option value="open">Срочно (Новый)</option>
                        <option value="in_progress">В работе</option>
                        <option value="post_obs">Пост-наблюдение</option>
                        <option value="archived">В архив</option>
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
