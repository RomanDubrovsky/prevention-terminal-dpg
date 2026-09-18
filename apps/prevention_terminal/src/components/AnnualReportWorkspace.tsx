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
    <div style={{ display: 'flex', gap: '24px', flexDirection: 'row', alignItems: 'flex-start', paddingBottom: '32px', height: '100%', boxSizing: 'border-box' }}>
      
      {/* Main Left Column: Free Manual Tool */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section className="card workspace-panel" style={{ padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <header className="manager-dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 8px 0' }}>{reportTitle}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {t("Пройдите 4 простых шага для формирования профессионального годового отчета. Все данные сохраняются автоматически.", "Follow 4 simple steps to create a professional annual report. All data is saved automatically.")}
              </p>
            </div>
            <div>
              <button className="ob-btn secondary" onClick={() => void handleDownload()} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                 <i className="icon-download"></i> {t("Шаг 4. Скачать DOCX", "Step 4. Download DOCX")}
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

          <div className="intake-grid wide" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
             
             {/* STATS SECTION */}
             <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
               <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <span style={{ color: 'var(--violet)' }}>{t("Шаг 1. Соберите статистику (Форма 5А)", "Step 1. Collect statistics (Form 5A)")}</span>
                 <button className="ob-btn secondary tiny" onClick={handleAutofillStats}>
                   {t("Заполнить из базы", "Autofill from database")}
                 </button>
               </h3>
               <p className="muted tiny" style={{ marginTop: '-8px', marginBottom: '16px' }}>
                 {t("Проверьте и скорректируйте цифры. Именно на них будет опираться ИИ при написании аналитического текста на следующем шаге.", "Review and adjust the numbers. The AI will rely on them when writing the analytical text in the next step.")}
               </p>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                 <label className="field">
                   <span>{t("Консультации учеников", "Students Consulted")}</span>
                   <input type="number" value={stats.studentsConsulted} onChange={e => setStats({...stats, studentsConsulted: e.target.value})} />
                 </label>
                 <label className="field">
                   <span>{t("Консультации родителей", "Parents Consulted")}</span>
                   <input type="number" value={stats.parentsConsulted} onChange={e => setStats({...stats, parentsConsulted: e.target.value})} />
                 </label>
                 <label className="field">
                   <span>{t("Консультации педагогов", "Teachers Consulted")}</span>
                   <input type="number" value={stats.teachersConsulted} onChange={e => setStats({...stats, teachersConsulted: e.target.value})} />
                 </label>
                 <label className="field">
                   <span>{t("Диагностики", "Diagnostics")}</span>
                   <input type="number" value={stats.diagnosticsCount} onChange={e => setStats({...stats, diagnosticsCount: e.target.value})} />
                 </label>
                 <label className="field">
                   <span>{t("Групповые занятия", "Group Sessions")}</span>
                   <input type="number" value={stats.groupSessions} onChange={e => setStats({...stats, groupSessions: e.target.value})} />
                 </label>
                 <label className="field">
                   <span>{t("Критические инциденты", "Critical Incidents")}</span>
                   <input type="number" value={stats.criticalIncidents} onChange={e => setStats({...stats, criticalIncidents: e.target.value})} />
                 </label>
               </div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <h3 style={{ margin: '0', fontSize: '1.1rem', color: 'var(--violet)' }}>
                 {t("Шаг 3. Ручная проверка текста (Форма 5)", "Step 3. Manual text review (Form 5)")}
               </h3>
               <p className="muted tiny" style={{ marginTop: '-20px', marginBottom: '0' }}>
                 {t("После работы Автопилота (справа), прочитайте сгенерированные тексты. При необходимости допишите детали из вашей практики.", "After the Autopilot runs (on the right), read the generated texts. Add specific details from your practice if needed.")}
               </p>
               <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section1Title}</span>
                  <textarea value={studentsText} onChange={e => setStudentsText(e.target.value)} rows={5} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
               </label>
               <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section2Title}</span>
                  <textarea value={parentsText} onChange={e => setParentsText(e.target.value)} rows={5} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
               </label>
               <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section3Title}</span>
                  <textarea value={adminText} onChange={e => setAdminText(e.target.value)} rows={5} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
               </label>
               <label className="field intake-field wide" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#333', fontSize: '1.05rem' }}>{section4Title}</span>
                  <textarea value={conclusionsText} onChange={e => setConclusionsText(e.target.value)} rows={6} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
               </label>
             </div>
          </div>
        </section>
      </div>

      {/* Right Sidebar: AI Upsell & Magic */}
      <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Step 1: Autopilot */}
        <section className="card" style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(139, 92, 246, 0.01))', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--violet-dark)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            ⚡ {t("Шаг 2. Автопилот (ИИ)", "Step 2. AI Autopilot")}
          </h3>
          <p className="muted tiny" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
            {t("ИИ изучит вашу статистику из Шага 1 и сам напишет профессиональный черновик для каждого из разделов.", "The AI will analyze your stats from Step 1 and write a professional draft for each section.")}
          </p>
          <button type="button" className="ob-btn success w-full" style={{ background: 'var(--violet)', borderColor: 'var(--violet-dark)', color: '#fff', width: '100%', justifyContent: 'center', padding: '10px', fontWeight: 'bold' }} disabled={aiBusy} onClick={() => void handleAutopilot()}>
             {aiBusy ? t("Генерация...", "Generating...") : t("Сгенерировать черновик", "Generate Draft")}
          </button>
          {aiNotice && <p className="ok tiny" style={{ marginTop: '12px', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', color: '#047857' }}>{aiNotice}</p>}
        </section>

        {/* Step 3: Polish (now Step 2 of AI) */}
        <section className="card" style={{ background: 'rgba(15, 118, 110, 0.02)', border: '1px solid rgba(15, 118, 110, 0.2)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            ✨ {t("Финальная сборка", "Final Polish")}
          </h3>
          <p className="muted tiny" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
            {t("После вашей ручной проверки (Шаг 3), нажмите сюда. ИИ уберет стилистические шероховатости и подготовит отчет к сдаче.", "After your manual review (Step 3), click here. The AI will smooth out stylistic edges and prepare the report for submission.")}
          </p>
          <button type="button" className="ob-btn" style={{ background: '#fff', borderColor: '#0f766e', color: '#0f766e', width: '100%', justifyContent: 'center', padding: '10px', fontWeight: 'bold' }} disabled={aiBusy} onClick={() => void handleFinalAssembly()}>
             {aiBusy ? t("Сборка...", "Polishing...") : t("Причесать текст", "Polish text")}
          </button>
        </section>
        
        {/* Free Chat - Psychologists Only */}
        {!isManager && (
        <section className="card" style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', background: '#fff' }}>
           <div className="ai-report-copilot">
              <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>🤖 {t("ИИ-Помощник", "AI Copilot")}</h3>
              <p className="muted tiny" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
                {t("Задайте вопрос по отчету или попросите переписать конкретный абзац.", "Ask a question about the report or request a rewrite for a specific paragraph.")}
              </p>
              <DocumentSmartChat
                terminalUserId={terminalUserId}
                subscriptionActive={subscriptionActive}
                paywallUrl=""
                category="report"
                documentContext={
                  `${section1Title}:\n${studentsText}\n\n` +
                  `${section2Title}:\n${parentsText}\n\n` +
                  `${section3Title}:\n${adminText}\n\n` +
                  `${section4Title}:\n${conclusionsText}`
                }
                cardSaved={true}
                aiLockedReason={t("Необходима подписка.", "Subscription required.")}
                onApplyResult={async (_stage, text) => {
                  setConclusionsText(text);
                }}
                showPlanButton={false}
                showReportButton={false}
                showExpertiseButton={false}
              />
           </div>
        </section>
        )}

      </div>
    </div>
  );
}

