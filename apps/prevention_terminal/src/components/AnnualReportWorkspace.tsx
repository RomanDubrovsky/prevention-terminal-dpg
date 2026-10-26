import { useCallback, useState, useEffect } from "react";

import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import { t } from "../lib/i18n.ts";
import { listWorkEntries } from "../lib/work_entries.ts";

interface AnnualReportWorkspaceProps {
  terminalUserId: string;
  isManager?: boolean;
  territorial?: boolean;
}

export default function AnnualReportWorkspace(props: AnnualReportWorkspaceProps) {
  const { terminalUserId, isManager = false, territorial = false } = props;
  const { active: subscriptionActive } = useTerminalSubscription(terminalUserId);

  const [studentsText, setStudentsText] = useState("");
  const [parentsText, setParentsText] = useState("");
  const [adminText, setAdminText] = useState("");
  const [conclusionsText, setConclusionsText] = useState("");

  const [stats, setStats] = useState({
    studentsConsulted: "0",
    parentsConsulted: "0",
    teachersConsulted: "0",
    diagnosticsCount: "0",
    groupSessions: "0",
    criticalIncidents: "0"
  });

  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showStatsEdit, setShowStatsEdit] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`annual_report_${terminalUserId}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.studentsText) setStudentsText(data.studentsText);
        if (data.parentsText) setParentsText(data.parentsText);
        if (data.adminText) setAdminText(data.adminText);
        if (data.conclusionsText) setConclusionsText(data.conclusionsText);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error("Failed to load report data", e);
    }
  }, [terminalUserId]);

  // Save to localStorage
  useEffect(() => {
    const data = { studentsText, parentsText, adminText, conclusionsText, stats };
    localStorage.setItem(`annual_report_${terminalUserId}`, JSON.stringify(data));
  }, [studentsText, parentsText, adminText, conclusionsText, stats, terminalUserId]);


  const callAi = async (prompt: string, contextString: string): Promise<string> => {
    const res = await fetch(`${platformApiBase()}/api/terminal/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "consultant",
        message: prompt,
        context: contextString,
        session_id: crypto.randomUUID(),
        lang: getTerminalEdition() === "intl" ? "en" : "ru",
        terminal_user_id: terminalUserId,
        edition: getTerminalEdition(),
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === "subscription_required") throw new Error("subscription_required");
      throw new Error(data.error || "AI error");
    }
    return String(data.reply || data.text || "").trim();
  };

  const section1Title = isManager ? (territorial ? t("1. Анализ работы психологических служб сети", "1. Analysis of network psychological services") : t("1. Анализ работы психологической службы школы", "1. Analysis of school psychological service")) : t("1. Анализ работы с учащимися", "1. Analysis of work with students");
  const section2Title = isManager ? (territorial ? t("2. Охват профилактическими программами", "2. Coverage by prevention programs") : t("2. Кадровая и методическая обеспеченность", "2. Staffing and methodological support")) : t("2. Анализ работы с педагогами и родителями", "2. Analysis of work with teachers and parents");
  const section3Title = isManager ? (territorial ? t("3. Кадровый состав и межведомственное взаимодействие", "3. Staffing and interagency cooperation") : t("3. Статистика критических инцидентов и профилактика", "3. Statistics of critical incidents and prevention")) : t("3. Организационно-методическая и экспертная работа", "3. Organizational, methodological and expert work");
  const section4Title = isManager ? t("4. Общие выводы и рекомендации", "4. General conclusions and recommendations") : t("4. Общие выводы (или результат Финальной сборки)", "4. General conclusions (or Final Assembly result)");

  const reportTitle = isManager 
    ? territorial 
      ? t("Отчет органа управления (Форма 11)", "Authority Report (Form 11)") 
      : t("Отчет руководителя (Форма 10)", "Director Report (Form 10)")
    : t("Аналитический отчет за год (Форма 5)", "Annual Analytical Report (Form 5)");


  const handleDownload = useCallback(() => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${reportTitle}</title></head>
      <body>
        <h1>${reportTitle}</h1>
        <h2>Статистическая справка (Форма 5А)</h2>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr><td>Учащихся проконсультировано</td><td>${stats.studentsConsulted}</td></tr>
          <tr><td>Родителей проконсультировано</td><td>${stats.parentsConsulted}</td></tr>
          <tr><td>Педагогов проконсультировано</td><td>${stats.teachersConsulted}</td></tr>
          <tr><td>Диагностических обследований</td><td>${stats.diagnosticsCount}</td></tr>
          <tr><td>Групповых занятий</td><td>${stats.groupSessions}</td></tr>
          <tr><td>Просветительских мероприятий</td><td>${stats.criticalIncidents}</td></tr>
        </table>
        <h2>${section1Title}</h2>
        <p>${studentsText.replace(/\n/g, '<br>')}</p>
        <h2>${section2Title}</h2>
        <p>${parentsText.replace(/\n/g, '<br>')}</p>
        <h2>${section3Title}</h2>
        <p>${adminText.replace(/\n/g, '<br>')}</p>
        <h2>${section4Title}</h2>
        <p>${conclusionsText.replace(/\n/g, '<br>')}</p>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Отчет_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [reportTitle, section1Title, section2Title, section3Title, section4Title, studentsText, parentsText, adminText, conclusionsText, stats]);

  const handleAutofillStats = useCallback(async () => {
    try {
      const entries = await listWorkEntries();
      let studentsConsulted = 0;
      let parentsConsulted = 0;
      let teachersConsulted = 0;
      let diagnosticsCount = 0;
      let groupSessions = 0;
      let programEvents = 0;

      for (const e of entries) {
        if (e.activity_kind === "consultation" || e.activity_kind === "intake" || e.activity_kind === "individual_session") {
          if (e.audience_contingent === "students") studentsConsulted++;
          else if (e.audience_contingent === "parents") parentsConsulted++;
          else if (e.audience_contingent === "teachers") teachersConsulted++;
          else studentsConsulted++; // Default to students if unspecified
        }
        if (e.activity_kind === "assessment") diagnosticsCount++;
        if (e.activity_kind === "group_session") groupSessions++;
        if (e.activity_kind === "program_event") programEvents++;
      }

      setStats({
        studentsConsulted: String(studentsConsulted),
        parentsConsulted: String(parentsConsulted),
        teachersConsulted: String(teachersConsulted),
        diagnosticsCount: String(diagnosticsCount),
        groupSessions: String(groupSessions),
        criticalIncidents: String(programEvents)
      });
      setAiNotice(t("Статистика успешно загружена из ваших журналов.", "Stats loaded successfully from your journals."));

      // Push to federation aggregator in the background
      const currentYear = new Date().getFullYear();
      try {
        await fetch(`${platformApiBase()}/api/terminal/aggregate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terminal_user_id: terminalUserId,
            period_start: `${currentYear}-01-01`,
            period_end: `${currentYear}-12-31`,
            metrics: {
              consultation_count: studentsConsulted + parentsConsulted + teachersConsulted,
              case_count: studentsConsulted, 
              ipr_count: 0,
              group_session_count: groupSessions,
              work_minutes: 0,
              reception_entries: diagnosticsCount,
              new_cases_in_period: 0,
              active_cases: 0
            }
          })
        });
      } catch (err) {
        console.warn("Failed to push federation aggregate", err);
      }
    } catch (e) {
      console.error(e);
      setAiNotice(t("Ошибка загрузки статистики.", "Error loading stats."));
    }
  }, [terminalUserId]);

  useEffect(() => {
    void handleAutofillStats();
  }, [handleAutofillStats]);

  const handleAutopilot = useCallback(async () => {
    if (!subscriptionActive) {
      setShowPaywall(true);
      return;
    }
    setAiBusy(true);
    setAiNotice(t("ИИ анализирует статистику и пишет разделы...", "AI is analyzing stats and writing sections..."));
    try {
      const contextString = `Статистика за год:\nКонсультаций учеников: ${stats.studentsConsulted}\nКонсультаций родителей: ${stats.parentsConsulted}\nКонсультаций педагогов: ${stats.teachersConsulted}\nДиагностик: ${stats.diagnosticsCount}\nГрупповых занятий: ${stats.groupSessions}\nИнцидентов: ${stats.criticalIncidents}\nОпирайся на эти цифры при составлении отчета.`;

      const p1 = t(`Напиши раздел '${section1Title}' для отчета.`, `Write section '${section1Title}' for the report.`);
      const p2 = t(`Напиши раздел '${section2Title}' для отчета.`, `Write section '${section2Title}' for the report.`);
      const p3 = t(`Напиши раздел '${section3Title}' для отчета.`, `Write section '${section3Title}' for the report.`);
      const p4 = t(`Напиши раздел '${section4Title}' для отчета.`, `Write section '${section4Title}' for the report.`);

      const [r1, r2, r3, r4] = await Promise.all([
        callAi(p1, contextString), 
        callAi(p2, contextString), 
        callAi(p3, contextString), 
        callAi(p4, contextString)
      ]);
      setStudentsText(r1);
      setParentsText(r2);
      setAdminText(r3);
      setConclusionsText(r4);
      setAiNotice(t("Разделы заполнены. Вы можете отредактировать их и запустить 'Финальную сборку'.", "Sections populated. You can edit them and run 'Final assembly'."));
    } catch (err) {
      if (String(err).includes("subscription_required")) {
        setShowPaywall(true);
      } else {
        setAiNotice(`Ошибка: ${String(err)}`);
      }
    } finally {
      setAiBusy(false);
    }
  }, [subscriptionActive, terminalUserId, stats, section1Title, section2Title, section3Title, section4Title]);

  const handleFinalAssembly = useCallback(async () => {
    if (!subscriptionActive) {
      setShowPaywall(true);
      return;
    }
    setAiBusy(true);
    setAiNotice(t("Выравниваем стилистику...", "Refining..."));
    try {
      const combined = `${section1Title}:\n${studentsText}\n\n${section2Title}:\n${parentsText}\n\n${section3Title}:\n${adminText}\n\n${section4Title}:\n${conclusionsText}`;
      const res = await callAi(t(`Стилистически выровняй текст этого отчета, сделай его профессиональным и связным. Верни только готовый текст выводов:\n\n${combined}`, `Stylistically polish this report:\n\n${combined}`), combined);
      setConclusionsText(res); 
      setAiNotice(t("Сборка завершена. Результат помещен в поле выводов.", "Polish complete. Placed in conclusions."));
    } catch (err) {
      setAiNotice(`Ошибка: ${String(err)}`);
    } finally {
      setAiBusy(false);
    }
  }, [subscriptionActive, studentsText, parentsText, adminText, conclusionsText, terminalUserId, section1Title, section2Title, section3Title, section4Title]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px', height: '100%', boxSizing: 'border-box' }}>
      
      <section className="card workspace-panel" style={{ padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid var(--line)' }}>
        <header className="manager-dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{reportTitle}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {t("Сформируйте профессиональный годовой отчёт. Данные подтягиваются автоматически и сохраняются на вашем устройстве.", "Generate a professional annual report. Data is automatically aggregated and saved locally.")}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="ob-btn"
              style={{ background: 'var(--violet)', borderColor: 'var(--violet-dark)', color: '#fff' }}
              onClick={() => {
                if (!subscriptionActive) {
                  setShowPaywall(true);
                  return;
                }
                setShowAiModal(true);
              }}
            >
              ✨ {t("ИИ-Помощник", "AI Assistant")}
            </button>
            <button type="button" className="ob-btn secondary" disabled={aiBusy} onClick={() => void handleAutopilot()} style={{ fontWeight: '600' }}>
              ⚡ {aiBusy ? t("Генерация...", "Generating...") : t("ИИ-Черновик", "AI Draft")}
            </button>
            <button className="ob-btn secondary" onClick={() => void handleDownload()} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
               <i className="icon-download"></i> {t("Скачать DOCX", "Download DOCX")}
            </button>
          </div>
        </header>

        {showPaywall && (
          <div style={{ marginBottom: '20px' }}>
            <AiSubscriptionPaywall
              soft
              terminalUserId={terminalUserId}
              context={t("Автопилот для отчета доступен по подписке.", "Report autopilot is available via subscription.")}
              onDismiss={() => setShowPaywall(false)}
            />
          </div>
        )}

        {aiNotice && (
          <div style={{ marginBottom: '20px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', color: '#047857', fontSize: '0.9rem' }}>
            ✅ {aiNotice}
          </div>
        )}

        <div className="intake-grid wide" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           
           {/* STATS SECTION */}
           <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--violet)' }}>
                   {t("Статистическая справка (Форма 5А)", "Statistics (Form 5A)")}
                 </h3>
                 <span style={{ fontSize: '0.78rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                   ⚡ {t("Авто-сбор из журналов", "Auto-collected from logs")}
                 </span>
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button type="button" className="ob-btn secondary tiny" onClick={handleAutofillStats}>
                   🔄 {t("Пересчитать из базы", "Recalculate from database")}
                 </button>
                 <button
                   type="button"
                   className="ob-btn secondary tiny"
                   onClick={() => setShowStatsEdit(!showStatsEdit)}
                 >
                   ✏️ {showStatsEdit ? t("Скрыть редактирование", "Hide edit") : t("Добавить сторонние мероприятия", "Add external events")}
                 </button>
               </div>
             </div>
             <p className="muted tiny" style={{ marginTop: 0, marginBottom: '16px', color: '#475569' }}>
               {t("Все показатели рассчитываются автоматически из ваших приёмов, диагностик и групповых занятий. Ручной ввод нужен только для внесения сторонних очных мероприятий.", "All metrics are calculated automatically from receptions, diagnostics, and group sessions. Manual input is only needed for adding external offline events.")}
             </p>
             
             {/* Automatic Stat Cards */}
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: showStatsEdit ? '16px' : '0' }}>
               <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{t("Консультации учеников", "Students Consulted")}</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{stats.studentsConsulted}</div>
               </div>
               <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{t("Консультации родителей", "Parents Consulted")}</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{stats.parentsConsulted}</div>
               </div>
               <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{t("Консультации педагогов", "Teachers Consulted")}</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{stats.teachersConsulted}</div>
               </div>
               <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{t("Диагностики", "Diagnostics")}</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{stats.diagnosticsCount}</div>
               </div>
               <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{t("Групповые занятия", "Group Sessions")}</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{stats.groupSessions}</div>
               </div>
               <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 14px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{t("Просвещение / Инциденты", "Events / Incidents")}</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{stats.criticalIncidents}</div>
               </div>
             </div>

             {/* Optional Manual Adjustment Panel */}
             {showStatsEdit && (
               <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                 <p className="muted tiny" style={{ marginBottom: '12px', fontWeight: 600, color: '#334155' }}>
                   ✏️ {t("Корректировка и сторонние мероприятия (при необходимости):", "Adjustments and external events (if needed):")}
                 </p>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                   <label className="field">
                     <span style={{ fontSize: '0.8rem' }}>{t("Консультации учеников", "Students Consulted")}</span>
                     <input type="number" value={stats.studentsConsulted} onChange={e => setStats({...stats, studentsConsulted: e.target.value})} />
                   </label>
                   <label className="field">
                     <span style={{ fontSize: '0.8rem' }}>{t("Консультации родителей", "Parents Consulted")}</span>
                     <input type="number" value={stats.parentsConsulted} onChange={e => setStats({...stats, parentsConsulted: e.target.value})} />
                   </label>
                   <label className="field">
                     <span style={{ fontSize: '0.8rem' }}>{t("Консультации педагогов", "Teachers Consulted")}</span>
                     <input type="number" value={stats.teachersConsulted} onChange={e => setStats({...stats, teachersConsulted: e.target.value})} />
                   </label>
                   <label className="field">
                     <span style={{ fontSize: '0.8rem' }}>{t("Диагностики", "Diagnostics")}</span>
                     <input type="number" value={stats.diagnosticsCount} onChange={e => setStats({...stats, diagnosticsCount: e.target.value})} />
                   </label>
                   <label className="field">
                     <span style={{ fontSize: '0.8rem' }}>{t("Групповые занятия", "Group Sessions")}</span>
                     <input type="number" value={stats.groupSessions} onChange={e => setStats({...stats, groupSessions: e.target.value})} />
                   </label>
                   <label className="field">
                     <span style={{ fontSize: '0.8rem' }}>{t("Просвещение / Инциденты", "Events / Incidents")}</span>
                     <input type="number" value={stats.criticalIncidents} onChange={e => setStats({...stats, criticalIncidents: e.target.value})} />
                   </label>
                 </div>
               </div>
             )}
           </div>

           {/* REPORT TEXT SECTIONS */}
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
               <div>
                 <h3 style={{ margin: '0', fontSize: '1.18rem', color: 'var(--violet)' }}>
                   {t("Аналитические разделы отчёта (Форма 5)", "Analytical Report Sections (Form 5)")}
                 </h3>
                 <p className="muted tiny" style={{ margin: '4px 0 0 0' }}>
                   {t("Тексты формируются ИИ по вашей работе за год. Вы можете отредактировать любой раздел вручную.", "Texts generated by AI based on your work over the year. You can edit any section manually.")}
                 </p>
               </div>
               <button
                 type="button"
                 className="ob-btn secondary tiny"
                 disabled={aiBusy}
                 onClick={() => void handleFinalAssembly()}
                 style={{ fontWeight: '600' }}
               >
                 ✨ {aiBusy ? t("Причёсываем…", "Polishing...") : t("Причесать стиль ИИ", "Polish style with AI")}
               </button>
             </div>

             <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section1Title}</span>
                <textarea value={studentsText} onChange={e => setStudentsText(e.target.value)} rows={5} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} placeholder="Здесь появится анализ работы с учащимися..." />
             </label>
             <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section2Title}</span>
                <textarea value={parentsText} onChange={e => setParentsText(e.target.value)} rows={5} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} placeholder="Здесь появится анализ работы с педагогами и родителями..." />
             </label>
             <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section3Title}</span>
                <textarea value={adminText} onChange={e => setAdminText(e.target.value)} rows={5} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} placeholder="Здесь появится методическая и экспертная работа..." />
             </label>
             <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section4Title}</span>
                <textarea value={conclusionsText} onChange={e => setConclusionsText(e.target.value)} rows={6} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} placeholder="Здесь появятся итоговые выводы и задачи на следующий год..." />
             </label>
           </div>
        </div>
      </section>

      {/* AI Assistant Modal */}
      {showAiModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "85vh",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "12px 18px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                ✨ {t("ИИ-Помощник Годового Отчёта", "AI Annual Report Assistant")}
              </h3>
              <button
                type="button"
                className="ob-btn secondary tiny"
                onClick={() => setShowAiModal(false)}
                style={{ fontSize: "0.9rem", padding: "4px 10px", cursor: "pointer" }}
              >
                ✕ {t("Закрыть", "Close")}
              </button>
            </div>
            <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
              <DocumentSmartChat
                terminalUserId={terminalUserId}
                subscriptionActive={subscriptionActive}
                paywallUrl=""
                category="report"
                documentContext={
                  `Статистика за год:\nУченики: ${stats.studentsConsulted}\nРодители: ${stats.parentsConsulted}\nПедагоги: ${stats.teachersConsulted}\nДиагностика: ${stats.diagnosticsCount}\nГруппы: ${stats.groupSessions}\nИнциденты: ${stats.criticalIncidents}\n\n` +
                  `${section1Title}:\n${studentsText}\n\n` +
                  `${section2Title}:\n${parentsText}\n\n` +
                  `${section3Title}:\n${adminText}\n\n` +
                  `${section4Title}:\n${conclusionsText}`
                }
                cardSaved={true}
                aiLockedReason={t("Необходима подписка ИИ.", "AI subscription required.")}
                onApplyResult={async (_stage, text) => {
                  setConclusionsText(text);
                }}
                showPlanButton={false}
                showReportButton={true}
                reportButtonLabel={t("Обновить выводы отчёта", "Update report conclusions")}
                showExpertiseButton={false}
                defaultExpanded={true}
                initialMode="report"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

