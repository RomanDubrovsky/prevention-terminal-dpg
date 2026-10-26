/**
 * CosExportPanel — панель экспорта данных для ЦОС «Цифровой психолог».
 *
 * Позволяет психологу:
 * 1. Выбрать период
 * 2. Увидеть предпросмотр журнала учёта индивидуальной работы в формате ЦОС
 * 3. Скопировать данные в буфер обмена (TSV → вставляется в Excel / ЦОС)
 * 4. Увидеть сводный отчёт по тематике обращений
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../lib/i18n.ts";
import type { WorkEntry } from "../lib/work_entries.ts";
import type { CosJournalEntry } from "../lib/cos_taxonomy.ts";
import {
  buildCosJournalEntry,
  buildCosReportByTopic,
  cosJournalToTsv,
  cosReportByTopicToTsv,
  type CosExportContext,
} from "../lib/cos_export.ts";
import { listRegistrySubjects } from "../lib/registry_store.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CosExportPanelProps {
  /** Все work_entries за выбранный период */
  entries: WorkEntry[];
  onGenerateDemo?: () => void;
}

type ExportTab = "journal" | "report_topic";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CosExportPanel(props: CosExportPanelProps) {
  const { entries, onGenerateDemo } = props;
  const [tab, setTab] = useState<ExportTab>("journal");
  const [copied, setCopied] = useState(false);
  
  // Храним загруженные данные реестра для правильного маппинга возрастов и категорий
  const [contextMap, setContextMap] = useState<Map<string, CosExportContext>>(new Map());

  useEffect(() => {
    let alive = true;
    
    async function loadContext() {
      try {
        const subjects = await listRegistrySubjects(false); // only active
        const newMap = new Map<string, CosExportContext>();
        
        for (const s of subjects) {
          // Ищем ID кейсов или привязываем напрямую по subject_id, 
          // но WorkEntry.case_id обычно ссылается на Case.id. 
          // Для простоты, мы можем сделать маппинг по subject_id и по ФИО.
          // В ЦОС важно извлечь orgClass и дату рождения.
          
          const ctx: CosExportContext = {
            fullName: s.full_name,
            birthDate: s.birth_date || "—",
            orgClass: s.org_class || "",
            situationKind: s.situation_kind || "",
          };
          
          newMap.set(s.subject_id, ctx);
          // Также сохраним по имени, так как в некоторых WorkEntry есть только subject_label
          newMap.set(s.full_name, ctx);
        }
        
        if (alive) {
          setContextMap(newMap);
        }
      } catch (err) {
        console.error("Failed to load registry context for COS export", err);
      }
    }
    
    void loadContext();
    return () => { alive = false; };
  }, [entries]);

  // Build journal entries
  const journalEntries: CosJournalEntry[] = useMemo(() => {
    const relevantEntries = entries.filter(
      (e) => e.activity_kind === "consultation" ||
             e.activity_kind === "intake" ||
             e.activity_kind === "individual_session" ||
             e.activity_kind === "family_session" ||
             e.activity_kind === "assessment",
    );

    return relevantEntries.map((entry, idx) => {
      // Пытаемся найти контекст по case_id или по имени (subject_label)
      const ctx = contextMap.get(entry.case_id || "") || 
                  contextMap.get(entry.subject_label || "") || 
                  {
                    fullName: entry.subject_label || "Псевдоним",
                    birthDate: "—",
                    orgClass: "",
                    situationKind: "",
                  };
                  
      return buildCosJournalEntry(entry, ctx, idx + 1);
    });
  }, [entries, contextMap]);

  const reportByTopic = useMemo(
    () => buildCosReportByTopic(journalEntries),
    [journalEntries],
  );

  const handleCopy = useCallback(async () => {
    const tsv = tab === "journal"
      ? cosJournalToTsv(journalEntries)
      : cosReportByTopicToTsv(reportByTopic);

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = tsv;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [tab, journalEntries, reportByTopic]);

  const handleDownloadExcel = useCallback(() => {
    const tsv = tab === "journal"
      ? cosJournalToTsv(journalEntries)
      : cosReportByTopicToTsv(reportByTopic);

    // Add UTF-8 BOM so Excel opens Cyrillic without garbled text
    const blob = new Blob(["\uFEFF" + tsv], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = tab === "journal" ? "cos_journal_export.xls" : "cos_report_topics.xls";
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tab, journalEntries, reportByTopic]);

  return (
    <section className="card cos-export-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3>
            📋 {t("Экспорт для ЦОС «Цифровой психолог»", "Export for COS Digital Psychologist")}
          </h3>
          <p className="muted tiny">
            {t(
              "Данные из вашего журнала автоматически преобразованы в формат ЦОС. Скопируйте в буфер или скачайте готовый Excel-файл.",
              "Your journal data auto-converted to COS format. Copy to clipboard or download Excel file.",
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="ob-btn secondary"
            onClick={handleDownloadExcel}
            disabled={journalEntries.length === 0}
            title={t("Скачать готовый файл для Excel", "Download ready file for Excel")}
          >
            📊 {t("Скачать Excel", "Download Excel")}
          </button>
          <button
            type="button"
            className="ob-btn"
            onClick={() => void handleCopy()}
            disabled={journalEntries.length === 0}
          >
            {copied
              ? t("✓ Скопировано!", "✓ Copied!")
              : t("📋 Копировать в буфер", "📋 Copy to clipboard")}
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="cos-export-tabs" style={{ display: "flex", gap: "8px", margin: "16px 0 12px" }}>
        <button
          type="button"
          className={`ob-btn-sm ${tab === "journal" ? "active" : ""}`}
          onClick={() => setTab("journal")}
          style={{
            background: tab === "journal" ? "var(--accent)" : "var(--surface-2)",
            color: tab === "journal" ? "#fff" : "var(--text-primary)",
            border: "none",
            borderRadius: "6px",
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          {t("Журнал учёта", "Activity Journal")}
        </button>
        <button
          type="button"
          className={`ob-btn-sm ${tab === "report_topic" ? "active" : ""}`}
          onClick={() => setTab("report_topic")}
          style={{
            background: tab === "report_topic" ? "var(--accent)" : "var(--surface-2)",
            color: tab === "report_topic" ? "#fff" : "var(--text-primary)",
            border: "none",
            borderRadius: "6px",
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          {t("Отчёт по тематике", "Report by Topic")}
        </button>
      </div>

      {journalEntries.length === 0 && (
        <div className="muted" style={{ padding: "20px 0" }}>
          <p style={{ margin: "0 0 16px 0" }}>
            {t(
              "Нет записей для экспорта. Зафиксируйте консультации в журнале — и данные для ЦОС сформируются автоматически.",
              "No entries to export. Log consultations in the journal and COS data will be generated automatically.",
            )}
          </p>
          {onGenerateDemo && (
            <button type="button" className="ob-btn secondary tiny" onClick={onGenerateDemo}>
              ✨ {t("Сгенерировать демо-данные (10 записей)", "Generate demo data (10 entries)")}
            </button>
          )}
        </div>
      )}

      {/* Journal Table */}
      {tab === "journal" && journalEntries.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="cos-journal-table" style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
            lineHeight: "1.4",
          }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={thStyle}>№</th>
                <th style={thStyle}>{t("Дата", "Date")}</th>
                <th style={thStyle}>{t("ФИО", "Name")}</th>
                <th style={thStyle}>{t("Тематика", "Topic")}</th>
                <th style={thStyle}>{t("Категория", "Category")}</th>
                <th style={thStyle}>{t("Вид деятельности", "Activity")}</th>
                <th style={thStyle}>{t("Статус", "Status")}</th>
                <th style={thStyle}>{t("Повтор", "Repeat")}</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.map((e) => (
                <tr key={e.index} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}>{e.index}</td>
                  <td style={tdStyle}>{e.date}</td>
                  <td style={tdStyle}>{e.fullName}</td>
                  <td style={tdStyle}>{e.topic}</td>
                  <td style={tdStyle}>{e.targetCategory}</td>
                  <td style={tdStyle}>{e.activityKind}</td>
                  <td style={tdStyle}>{e.status}</td>
                  <td style={tdStyle}>{e.isRepeat}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted tiny" style={{ marginTop: "8px" }}>
            {t(
              `Всего записей: ${journalEntries.length}. Нажмите «Копировать в буфер» → откройте ЦОС → Ctrl+V в таблицу.`,
              `Total entries: ${journalEntries.length}. Click "Copy" → open COS → Ctrl+V into the table.`,
            )}
          </p>
        </div>
      )}

      {/* Report by Topic */}
      {tab === "report_topic" && reportByTopic.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="cos-journal-table" style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
            lineHeight: "1.4",
          }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={thStyle}>№</th>
                <th style={thStyle}>{t("Тематика обращений", "Topic")}</th>
                <th style={thStyle}>{t("Всего", "Total")}</th>
                <th style={thStyle}>3-6</th>
                <th style={thStyle}>7-11</th>
                <th style={thStyle}>12-15</th>
                <th style={thStyle}>16-18</th>
                <th style={thStyle}>{t("Родители", "Parents")}</th>
                <th style={thStyle}>{t("Педагоги", "Teachers")}</th>
                <th style={thStyle}>{t("Специалисты", "Specialists")}</th>
              </tr>
            </thead>
            <tbody>
              {reportByTopic.map((r, i) => (
                <tr key={r.topic} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={tdStyle}>{r.topic}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.total}</td>
                  <td style={tdStyle}>{r.age3_6 || "—"}</td>
                  <td style={tdStyle}>{r.age7_11 || "—"}</td>
                  <td style={tdStyle}>{r.age12_15 || "—"}</td>
                  <td style={tdStyle}>{r.age16_18 || "—"}</td>
                  <td style={tdStyle}>{r.parents || "—"}</td>
                  <td style={tdStyle}>{r.teachers || "—"}</td>
                  <td style={tdStyle}>{r.specialists || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted tiny" style={{ marginTop: "8px" }}>
            {t(
              "Сводная таблица в формате «Отчёт по тематике обращения» ЦОС. Копируйте и вставляйте в Excel.",
              "Summary table in COS 'Report by Topic' format. Copy and paste into Excel.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 6px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: "11px",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
  borderBottom: "2px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 6px",
  verticalAlign: "top",
};
