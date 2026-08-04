import { useCallback, useState } from "react";

import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import { t } from "../lib/i18n.ts";

interface AnnualReportWorkspaceProps {
  terminalUserId: string;
}

export default function AnnualReportWorkspace(props: AnnualReportWorkspaceProps) {
  const { terminalUserId } = props;
  const { active: subscriptionActive } = useTerminalSubscription(terminalUserId);

  const [studentsText, setStudentsText] = useState("");
  const [parentsText, setParentsText] = useState("");
  const [adminText, setAdminText] = useState("");
  const [conclusionsText, setConclusionsText] = useState("");

  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const callAi = async (prompt: string): Promise<string> => {
    const res = await fetch(`${platformApiBase()}/api/terminal/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "consultant",
        message: prompt,
        context: t("Контекст годового отчета: статистика из дашборда (будет передана сюда)", "Annual report context: dashboard statistics (to be populated here)"),
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

  const handleAutopilot = useCallback(async () => {
    if (!subscriptionActive) {
      setShowPaywall(true);
      return;
    }
    setAiBusy(true);
    setAiNotice("ИИ генерирует разделы...");
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        callAi(t("Напиши раздел 'Анализ работы с учащимися' для годового отчета педагога-психолога.", "Write section 'Analysis of work with students' for the educational psychologist annual report.")),
        callAi(t("Напиши раздел 'Анализ работы с педагогами и родителями' для годового отчета.", "Write section 'Analysis of work with teachers and parents' for the annual report.")),
        callAi(t("Напиши раздел 'Организационно-методическая и экспертная работа' для годового отчета.", "Write section 'Organizational, methodological and expert work' for the annual report.")),
        callAi(t("Напиши раздел 'Общие выводы и задачи на следующий год' для годового отчета.", "Write section 'General conclusions and goals for next year' for the annual report.")),
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
  }, [subscriptionActive, terminalUserId]);

  const handleFinalAssembly = useCallback(async () => {
    if (!subscriptionActive) {
      setShowPaywall(true);
      return;
    }
    setAiBusy(true);
    setAiNotice(t("Причесывание и финальная сборка...", "Refining and final assembly..."));
    try {
      const combined = `${t("Учащиеся", "Students")}:\n${studentsText}\n\n${t("Родители и педагоги", "Parents and teachers")}:\n${parentsText}\n\n${t("Орг.-методическая", "Organizational-methodological")}:\n${adminText}\n\n${t("Выводы", "Conclusions")}:\n${conclusionsText}`;
      const res = await callAi(t(`Проведи стилистическое выравнивание и 'причеши' этот текст годового отчета, сделав его связным и профессиональным, сохранив структуру по разделам:\n\n${combined}`, `Stylistically align and polish this annual report text, making it cohesive and professional while preserving the section structure:\n\n${combined}`));
      setConclusionsText(res); 
      setAiNotice(t("Финальная сборка завершена. Результат помещен в поле 'Общие выводы' (для копирования).", "Final assembly complete. Result placed in 'General conclusions' field (for copying)."));
    } catch (err) {
      setAiNotice(`Ошибка: ${String(err)}`);
    } finally {
      setAiBusy(false);
    }
  }, [subscriptionActive, studentsText, parentsText, adminText, conclusionsText, terminalUserId]);

  return (
    <div className="workspace-panel-stack">
      <section className="card workspace-panel">
        <header className="manager-dashboard-header">
          <div>
            <h2>{t("Аналитический отчет за год (Форма 5)", "Annual Analytical Report (Form 5)")}</h2>
            <p className="muted">
              {t(
                "Смешанный автопилот ИИ: позволяет собрать черновик отчета по отдельным разделам на основе вашей статистики из дашборда, доработать текст вручную и затем выполнить финальную сборку для стилистического выравнивания.",
                "Hybrid AI autopilot: allows compiling a draft report for separate sections based on your statistics from the dashboard, refining the text manually, and then running the final assembly for stylistic alignment.",
              )}
            </p>
          </div>
        </header>

        {showPaywall && (
          <AiSubscriptionPaywall
            soft
            terminalUserId={terminalUserId}
            context={t("Автопилот для аналитического отчета доступен по подписке.", "Autopilot for annual report is available via subscription.")}
            onDismiss={() => setShowPaywall(false)}
          />
        )}
      </section>

      <section className="card" style={{ borderLeft: "4px solid var(--violet)", background: "rgba(139, 92, 246, 0.02)", padding: "20px" }}>
        <div className="group-session-editor-head" style={{ marginBottom: "1rem" }}>
            <div>
              <h3 style={{ margin: 0 }}>🤖 {t("Шаг 1: Автопилот (ИИ-Генерация)", "Step 1: Autopilot (AI Generation)")}</h3>
              <p className="muted tiny" style={{ margin: "4px 0 0 0" }}>
                {t("ИИ автоматически сформирует первый черновик по всем разделам, используя статистику вашей работы.", "AI will automatically generate a draft for all sections using your work statistics.")}
              </p>
            </div>
            <div className="group-session-editor-actions">
               <button type="button" className="ob-btn success" style={{ background: "var(--violet)", borderColor: "var(--violet-dark)", boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)" }} disabled={aiBusy} onClick={() => void handleAutopilot()}>
                  {aiBusy ? t("Генерация...", "Generating...") : t("Сгенерировать черновики разделов", "Generate section drafts")}
               </button>
            </div>
        </div>

        {aiNotice && <p className="ok tiny" style={{ padding: "8px 12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "6px", color: "#047857" }}>{aiNotice}</p>}
      </section>

      <section className="card" style={{ borderLeft: "4px solid var(--green)", background: "rgba(16, 185, 129, 0.01)", padding: "20px" }}>
        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>✍️ {t("Шаг 2: Ручная правка разделов отчета", "Step 2: Manual editing of report sections")}</h3>
          <p className="muted tiny" style={{ margin: "4px 0 0 0" }}>
            {t("Вы можете свободно корректировать, удалять или добавлять текст в любом из разделов ниже.", "You can freely edit, delete, or add text in any of the sections below.")}
          </p>
        </div>

        <div className="intake-grid wide" style={{ marginTop: "1rem", gap: "20px" }}>
           <label className="field intake-field wide" style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontWeight: "bold" }}>1. {t("Анализ работы с учащимися", "Analysis of work with students")}</span>
              <textarea value={studentsText} onChange={e => setStudentsText(e.target.value)} rows={5} style={{ background: "#fff", marginTop: "6px" }} />
           </label>
           <label className="field intake-field wide" style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontWeight: "bold" }}>2. {t("Анализ работы с педагогами и родителями", "Analysis of work with teachers and parents")}</span>
              <textarea value={parentsText} onChange={e => setParentsText(e.target.value)} rows={5} style={{ background: "#fff", marginTop: "6px" }} />
           </label>
           <label className="field intake-field wide" style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontWeight: "bold" }}>3. {t("Организационно-методическая и экспертная работа", "Organizational, methodological and expert work")}</span>
              <textarea value={adminText} onChange={e => setAdminText(e.target.value)} rows={5} style={{ background: "#fff", marginTop: "6px" }} />
           </label>
           <label className="field intake-field wide" style={{ background: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <span style={{ fontWeight: "bold" }}>4. {t("Общие выводы (или результат Финальной сборки)", "General conclusions (or final assembly result)")}</span>
              <textarea value={conclusionsText} onChange={e => setConclusionsText(e.target.value)} rows={8} style={{ background: "#fff", marginTop: "6px" }} />
           </label>
         </div>
      </section>

      <section className="card" style={{ borderLeft: "4px solid #0f766e", background: "rgba(15, 118, 110, 0.01)", padding: "20px" }}>
        <div className="group-session-editor-head" style={{ marginBottom: "1rem" }}>
            <div>
              <h3 style={{ margin: 0 }}>✨ {t("Шаг 3: Сборка и Полировка", "Step 3: Assembly & Polishing")}</h3>
              <p className="muted tiny" style={{ margin: "4px 0 0 0" }}>
                {t("ИИ объединит все 4 раздела выше, выполнит стилистическое выравнивание и сделает текст профессиональным.", "AI will combine all 4 sections above, run stylistic alignment, and make the text professional.")}
              </p>
            </div>
            <div className="group-session-editor-actions">
               <button type="button" className="ob-btn" style={{ background: "#0f766e", borderColor: "#0b5f59", boxShadow: "0 2px 8px rgba(15, 118, 110, 0.25)" }} disabled={aiBusy} onClick={() => void handleFinalAssembly()}>
                  {aiBusy ? t("Сборка...", "Assembling...") : t("Запустить финальную сборку", "Run Final Assembly")}
               </button>
            </div>
        </div>
      </section>

      <section className="card" style={{ border: "2px solid var(--violet)", padding: "20px", borderRadius: "16px", background: "rgba(139, 92, 246, 0.02)" }}>
         <div className="ai-report-copilot">
            <h3 style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "8px" }}>🤖 {t("ИИ-Помощник отчета (Свободный чат)", "AI Report Copilot (Free Chat)")}</h3>
            <p className="muted tiny" style={{ marginBottom: "1.5rem" }}>
              {t("Используйте чат ниже для свободного обсуждения отчета, точечного рерайта или создания плана работы.", "Use the chat below for free discussion of the report, specific rewrites, or creating a work plan.")}
            </p>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl=""
              category="consultation"
              documentContext={
                `${t("Анализ работы с учащимися", "Analysis of work with students")}:\n${studentsText}\n\n` +
                `${t("Анализ работы с педагогами и родителями", "Analysis of work with teachers and parents")}:\n${parentsText}\n\n` +
                `${t("Организационно-методическая и экспертная работа", "Organizational, methodological and expert work")}:\n${adminText}\n\n` +
                `${t("Общие выводы", "General conclusions")}:\n${conclusionsText}`
              }
              cardSaved={true}
              aiLockedReason={t("Необходима подписка.", "Subscription required.")}
              onApplyResult={async (_stage, text) => {
                setConclusionsText(text);
              }}
              showPlanButton={true}
              showReportButton={true}
              showExpertiseButton={true}
              planButtonLabel={t("Создать план (ИИ)", "Create plan (AI)")}
              reportButtonLabel={t("Сгенерировать отчёт", "Generate report")}
              expertiseButtonLabel={t("Провести аудит", "Conduct audit")}
              customExpertisePrompt={t("Проведи методический аудит выводов годового отчета. Оцени полноту выводов, их соответствие профессиональным стандартам, и предложи рекомендации по задачам на следующий год.", "Conduct a methodological audit of the annual report conclusions. Assess the completeness of the conclusions, alignment with professional standards, and suggest recommendations for goals for next year.")}
            />
         </div>
      </section>
    </div>
  );
}
