import { useState, useRef, useEffect, useMemo } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";
import { t } from "../lib/i18n.ts";
import AiProfessorAvatar from "./AiProfessorAvatar.tsx";
import type { ProfessorState } from "./AiProfessorAvatar.tsx";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import ModuleCheckpoint from "./ModuleCheckpoint.tsx";
import PracticumSimulator from "./PracticumSimulator.tsx";
import { useAiProfessorVoice } from "../lib/useAiProfessorVoice.ts";
import { hybridAI } from "../lib/HybridAIProvider.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import {
  markLectureRead,
  addPoints,
  loadProgress,
  getRank,
  unlockAchievementDirect,
  markCaseCompleted,
  markTestCompleted,
  type AcademyProgressState
} from "../lib/academy_progress.ts";
import AcademyGamificationWidget from "./AcademyGamificationWidget.tsx";
import ClusterQuiz from "./ClusterQuiz.tsx";
import "./AIAcademyWorkspace.css";

/* ─── Types ──────────────────────────────────────────────────── */

interface ChatMessage {
  role: "user" | "professor" | "system";
  text: string;
}

interface AcademyCard {
  title: string;
  title_en?: string;
  x_stage?: string;
  y_level?: string;
  m_modality?: string;
  executor_role?: string;
  org_scale?: string;
  topic_tags?: string[];
  content_type?: string;
  refined_text?: string;
  refined_text_en?: string;
  reflection_prompt?: string;
  reflection_prompt_en?: string;
}

interface AcademyLectureObj {
  title?: string;
  title_en?: string;
  html?: string;
  raw_text?: string;
  slides?: string[];
  cards?: AcademyCard[];
}

interface ModuleItem {
  id: string | number;
  title: string;
  tag?: string;
  isTest?: boolean;
}

interface ModuleSection {
  title: string;
  modules: ModuleItem[];
}

/* ─── Static Data ────────────────────────────────────────────── */

const MODULE_SECTIONS: ModuleSection[] = [
  {
    title: t("Модуль 1. ТЕОРИЯ И МЕТОДОЛОГИЯ", "Module 1. THEORY & METHODOLOGY"),
    modules: [
      { id: 0, title: t("0. Вводное занятие: Добро пожаловать в Академию", "0. Intro Lesson: Welcome to Academy"), tag: "Основы" },
      { id: 1, title: t("1. Здоровье и болезнь в психологии", "1. Health and Illness in Psychology"), tag: "Методология" },
      { id: 2, title: t("2. Стресс и резистентность", "2. Stress and Resistance"), tag: "Нейробиология" },
      { id: 3, title: t("3. Девиантность", "3. Deviance"), tag: "Поведение" },
      { id: 4, title: t("4. Модели профилактики", "4. Prevention Models"), tag: "Модели" },
      { id: 5, title: t("5. Тенденции развития системы профилактики", "5. Trends in Prevention"), tag: "Тренды" },
      { id: "test-1", title: t("Рубежный контроль 1", "Checkpoint 1"), isTest: true, tag: "Контроль" },
    ]
  },
  {
    title: t("Модуль 2. ИССЛЕДОВАНИЕ И ДИАГНОСТИКА", "Module 2. RESEARCH & DIAGNOSIS"),
    modules: [
      { id: 6, title: t("6. Исследования в системе профилактики", "6. Research in Prevention"), tag: "Исследования" },
      { id: 7, title: t("7. Неструктурированное интервью", "7. Unstructured Interview"), tag: "Интервью" },
      { id: 8, title: t("8. Полуструктурированное интервью", "8. Semi-Structured Interview"), tag: "Диагностика" },
      { id: 9, title: t("9. Наблюдение", "9. Observation"), tag: "Наблюдение" },
      { id: 10, title: t("10. Эксперимент", "10. Experiment"), tag: "Эксперимент" },
      { id: 11, title: t("11. Социально-статистическое исследование", "11. Socio-Statistics"), tag: "Статистика" },
      { id: 12, title: t("12. Социологические (популяционные) опросы", "12. Population Surveys"), tag: "Опросы" },
      { id: 13, title: t("13. Психологическое тестирование", "13. Psychological Testing"), tag: "Тестирование" },
      { id: 14, title: t("14. Диагностические и профилактические мероприятия", "14. Measures"), tag: "Мероприятия" },
      { id: 15, title: t("15. Дизайн исследования и доказательная профилактика", "15. Research Design"), tag: "Доказательность" },
      { id: "test-2", title: t("Рубежный контроль 2", "Checkpoint 2"), isTest: true, tag: "Контроль" },
    ]
  },
  {
    title: t("Модуль 3. ПРАКТИКА И ВНЕДРЕНИЕ", "Module 3. PRACTICE & IMPLEMENTATION"),
    modules: [
      { id: 16, title: t("16. Логика и структура профилактического проекта", "16. Project Structure"), tag: "Проектирование" },
      { id: 17, title: t("17. План мероприятий профилактической программы", "17. Action Plan"), tag: "Планирование" },
      { id: 18, title: t("18. Оценка эффективности профилактики", "18. Efficiency Evaluation"), tag: "Оценка" },
      { id: 19, title: t("19. Структура и автоматизация психологической службы", "19. Service Automation"), tag: "Автоматизация" },
      { id: "test-3", title: t("Рубежный контроль 3", "Checkpoint 3"), isTest: true, tag: "Контроль" },
    ]
  }
];

const PRACTICE_SECTIONS: ModuleSection[] = [
  {
    title: t("Клинические кейсы и симуляции", "Clinical Simulations"),
    modules: [
      { id: "case_suicide_01", title: t("Кейс 1.1: Скрининг витальных рисков (mhGAP)", "Case 1.1: Vital risk screening"), tag: "Скрининг" },
      { id: "case_ed_01", title: t("Кейс 1.2: Первичная оценка РПП (Анорексия)", "Case 1.2: Eating disorder assessment"), tag: "Скрининг" },
      { id: "case_deviance_01", title: t("Кейс 2.1: Мотивационное интервью с подростком", "Case 2.1: Motivational interview"), tag: "Контакт" },
      { id: "case_panic_01", title: t("Кейс 3.1: Паническая атака перед экзаменом (DBT)", "Case 3.1: Panic attack (DBT)"), tag: "Аффект" },
      { id: "case_bullying_01", title: t("Кейс 4.1: Социофобия после буллинга (КПТ)", "Case 4.1: Social anxiety (CBT)"), tag: "Когниции" },
      { id: "case_parents_01", title: t("Кейс 5.1: Конфликт Учитель-Родитель (ОРКТ)", "Case 5.1: Parent-Teacher mediation"), tag: "Медиация" },
    ]
  }
];

/* ─── Helpers ────────────────────────────────────────────────── */

let _lecturesCache: Record<string, AcademyLectureObj> | null = null;
async function loadLecturesData(): Promise<Record<string, AcademyLectureObj>> {
  if (_lecturesCache) return _lecturesCache;
  const mod = await import("../lib/academy_lectures.json");
  _lecturesCache = (mod.default || mod) as Record<string, AcademyLectureObj>;
  return _lecturesCache;
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(<br\s*\/?>|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/gi);
  return parts.map((part, idx) => {
    if (part.toLowerCase().startsWith("<br")) return <br key={idx} />;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={idx}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const closeBracketIdx = part.indexOf("](");
      const label = part.slice(1, closeBracketIdx);
      const url = part.slice(closeBracketIdx + 2, -1);
      return (
        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
          {label}
        </a>
      );
    }
    return part;
  });
}

function renderFormattedBody(bodyText: string) {
  if (!bodyText) return null;
  const lines = bodyText.split("\n");
  const elements: React.ReactNode[] = [];
  let currentTableRows: string[][] = [];
  let inTable = false;

  const flushTable = (key: string | number) => {
    if (currentTableRows.length === 0) return;
    const headers = currentTableRows[0].map(h => h.trim());
    const dataRows = currentTableRows.slice(2);
    elements.push(
      <div key={`table-${key}`} style={{ overflowX: "auto", margin: "14px 0", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--bg-card-alt)", borderBottom: "2px solid var(--border-color)" }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: "8px 10px", fontWeight: 700 }}>{parseInlineMarkdown(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: rIdx < dataRows.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={{ padding: "8px 10px", verticalAlign: "top" }}>{parseInlineMarkdown(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    currentTableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|")) {
      inTable = true;
      currentTableRows.push(line.split("|").slice(1, -1));
    } else {
      if (inTable) flushTable(i);
      if (line) {
        elements.push(
          <p key={i} style={{ margin: "0 0 10px 0", whiteSpace: "pre-line" }}>
            {parseInlineMarkdown(line)}
          </p>
        );
      }
    }
  }
  if (inTable) flushTable("final");
  return elements;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AIAcademyWorkspace({ aiSubscriptionActive = true }: { aiSubscriptionActive?: boolean }) {
  /* ─── State ──────────────────────────────────────────────── */
  const [viewTrack, setViewTrack] = useState<'theory' | 'practice'>('theory');
  const [activeModule, setActiveModule] = useState<string | number>(0);
  const [collapsedModules, setCollapsedModules] = useState<Record<number, boolean>>({});
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showRelatedCards, setShowRelatedCards] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState<string | number | null>(null);
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);
  const [videoMap, setVideoMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/academy/course/course-manifest.json').then(r => r.json()).then(data => {
      const map: Record<string, string> = {};
      data.forEach((item: any) => {
        let id = String(item.id);
        if (id === '00') id = '0';
        map[id] = item.video_url;
      });
      setVideoMap(map);
    }).catch(e => console.error('Failed to load videoMap', e));
  }, []);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [showFullNotes, setShowFullNotes] = useState(false);

  /* ─── Lectures Data ──────────────────────────────────────── */
  const [lecturesData, setLecturesData] = useState<Record<string, AcademyLectureObj>>(_lecturesCache || {});
  const [isLecturesLoading, setIsLecturesLoading] = useState(!_lecturesCache);

  useEffect(() => {
    if (!_lecturesCache) {
      loadLecturesData().then(data => {
        setLecturesData(data);
        setIsLecturesLoading(false);
      });
    }
  }, []);

  /* ─── Progress (visual only, no blocking) ────────────────── */
  const [progress, setProgress] = useState<AcademyProgressState>(() => loadProgress());
  const refreshProgress = () => setProgress(loadProgress());

  const readLecturesSet = useMemo(() => new Set((progress.readLectures || []).map(String)), [progress.readLectures]);
  const completedTestsSet = useMemo(() => new Set((progress.completedTests || []).map(String)), [progress.completedTests]);
  const completedCasesSet = useMemo(() => new Set((progress.completedCases || []).map(String)), [progress.completedCases]);

  const isNodeCompleted = (id: string | number) => {
    if (typeof id === 'string' && id.startsWith('test-')) return completedTestsSet.has(id);
    if (typeof id === 'string' && id.startsWith('case_')) return completedCasesSet.has(id);
    return readLecturesSet.has(String(id));
  };

  const allTheoryModules = useMemo(() => {
    const list: ModuleItem[] = [];
    MODULE_SECTIONS.forEach(sec => list.push(...sec.modules));
    return list;
  }, []);

  const totalLessonsCount = allTheoryModules.length;
  const completedLessonsCount = allTheoryModules.filter(m => isNodeCompleted(m.id)).length;
  const overallProgressPercent = Math.round((completedLessonsCount / totalLessonsCount) * 100);

  /* ─── AI Professor & Voice ───────────────────────────────── */
  const [profState, setProfState] = useState<ProfessorState>("idle");
  const { speak, stop, isPlaying, isPaused, togglePause, isMuted, toggleMute } = useAiProfessorVoice((speaking) => {
    setProfState(speaking ? "speaking" : "idle");
  });

  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const activeModuleRef = useRef(activeModule);
  activeModuleRef.current = activeModule;

  const setChat = (updater: any) => {
    setThreads(prev => {
      const activeId = String(activeModuleRef.current);
      const current = prev[activeId] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeId]: next };
    });
  };

  const currentChat = threads[String(activeModule)] || [];
  const [inputText, setInputText] = useState("");
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown: onEnterKeyDown } = useSendOnEnter();

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [currentChat]);

  /* ─── Current Lecture Data ───────────────────────────────── */
  const localLecture = (lecturesData as Record<string, AcademyLectureObj>)[String(activeModule)];
  const lectureTitle = localLecture?.title
    ? t(localLecture.title, localLecture.title_en || localLecture.title)
    : `${t("Лекция", "Lecture")} ${activeModule}`;

  const cards: AcademyCard[] = localLecture?.cards || [];
  const isPracticeCase = typeof activeModule === "string" && activeModule.startsWith("case_");
  const isTest = typeof activeModule === "string" && activeModule.startsWith("test-");

  /* ─── Initialize chat when topic changes ─────────────────── */
  useEffect(() => {
    stop();
    setShowFullNotes(false);
    const activeId = String(activeModule);

    if (threads[activeId] && threads[activeId].length > 0) return; // keep existing thread

    if (isTest) {
      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: t(
          `Рубежный контроль по модулю: «${lectureTitle}». Ответьте на контрольные вопросы слева.`,
          `Checkpoint for module: "${lectureTitle}". Answer the questions on the left.`
        )}]
      }));
      return;
    }

    if (isPracticeCase) {
      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: t(
          `Запуск клинической симуляции «${lectureTitle}». Изучите протокол слева и нажмите «Начать симуляцию».`,
          `Starting simulation: "${lectureTitle}". Review protocol and click Start.`
        )}]
      }));
      return;
    }

    if (localLecture) {
      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: t(
          `📚 Открыта тема: «${lectureTitle}». Прочитайте тезисы и задайте любой вопрос — я помогу разобраться!`,
          `📚 Topic opened: "${lectureTitle}". Read the theses and ask me anything!`
        )}]
      }));
    }
  }, [activeModule, isLecturesLoading]);

  /* ─── AI Send ────────────────────────────────────────────── */
  const handleSend = async (overrideMsg?: string) => {
    const msg = (overrideMsg || inputText).trim();
    if (!msg) return;
    stop();
    setChat((prev: ChatMessage[]) => [...prev, { role: "user", text: msg }]);
    if (!overrideMsg) setInputText("");
    setProfState("thinking");

    const cardContext = cards.map((c, i) => `Тезис ${i + 1}: ${c.title}`).join("\n");

    const promptContext = isPracticeCase
      ? `Simulation Case: ${activeModule}\nStudent input: ${msg}`
      : `Студент изучает тему: "${lectureTitle}".\nТЕЗИСЫ ТЕМЫ:\n${cardContext}\n\nВОПРОС СТУДЕНТА:\n"${msg}"\n\nИНСТРУКЦИЯ: Ответь как AI-Профессор. Объясни понятно, приведи примеры. Если студент демонстрирует понимание — похвали.`;

    try {
      const res = await hybridAI.sendAiTurnHybrid({
        mode: "consultant",
        consultantSub: isPracticeCase ? "supervisor" : "academy",
        appId: "school_academy",
        message: msg,
        context: promptContext,
        lang: getTerminalEdition() === "intl" ? "en" : "ru",
      });

      const reply = res.reply || t("Ответ получен.", "Response received.");
      setChat((prev: ChatMessage[]) => [...prev, { role: "professor", text: reply }]);
      speak(reply);

      if (isPracticeCase && (reply.includes("[СИМУЛЯЦИЯ УСПЕШНО ЗАВЕРШЕНА]") || reply.includes("[СУПЕРВИЗИЯ ПРОЙДЕНА]"))) {
        markCaseCompleted(String(activeModule));
        addPoints(50);
        refreshProgress();
      }
    } catch (e) {
      setChat((prev: ChatMessage[]) => [...prev, { role: "professor", text: t("Ошибка соединения.", "Connection error.") }]);
      setProfState("idle");
    }
  };

  /* ─── Mark topic as read when user views it ──────────────── */
  const handleSelectTopic = (id: string | number) => {
    setActiveModule(id);
    // Mark as read after brief viewing (non-blocking)
    if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('test-') && !id.startsWith('case_'))) {
      setTimeout(() => {
        markLectureRead(id);
        addPoints(5);
        refreshProgress();
      }, 3000);
    }
  };

  const toggleModuleCollapse = (idx: number) => {
    setCollapsedModules(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="ai-academy-workspace">
      {/* GAMIFICATION HEADER */}
      <AcademyGamificationWidget />

      <div className="academy-main-layout">
        {/* ─── LEFT SIDEBAR: Topic Tree ──────────────────────── */}
        <div className="academy-sidebar">
          {/* Track Switcher */}
          <div className="sidebar-track-switcher">
            <button
              type="button"
              className={`track-btn ${viewTrack === 'theory' ? 'active' : ''}`}
              onClick={() => setViewTrack('theory')}
            >
              📚 {t("Теория", "Theory")}
            </button>
            <button
              type="button"
              className={`track-btn ${viewTrack === 'practice' ? 'active' : ''}`}
              onClick={() => setViewTrack('practice')}
            >
              🩺 {t("Практика", "Practice")}
            </button>
          </div>

          {/* Progress Summary */}
          <div className="sidebar-progress">
            <div className="sidebar-progress-text">
              {t(`${completedLessonsCount} из ${totalLessonsCount} тем`, `${completedLessonsCount} of ${totalLessonsCount} topics`)} ({overallProgressPercent}%)
            </div>
            <div className="sidebar-progress-bar">
              <div className="sidebar-progress-fill" style={{ width: `${overallProgressPercent}%` }} />
            </div>
          </div>

          {/* Topic Tree */}
          <div className="sidebar-topics-scroll">
            {viewTrack === 'theory' && MODULE_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className="sidebar-module-group">
                <div
                  className="sidebar-module-header"
                  onClick={() => toggleModuleCollapse(sIdx)}
                >
                  <span className="module-collapse-arrow" style={{ transform: collapsedModules[sIdx] ? 'rotate(-90deg)' : 'rotate(0)' }}>▾</span>
                  <span className="module-header-text">{section.title}</span>
                </div>

                {!collapsedModules[sIdx] && section.modules.map((mod) => {
                  const completed = isNodeCompleted(mod.id);
                  const isActive = String(mod.id) === String(activeModule);

                  return (
                    <div
                      key={mod.id}
                      className={`sidebar-topic-item ${isActive ? 'active' : ''} ${completed ? 'completed' : ''}`}
                    >
                      <div
                        className="sidebar-topic-label"
                        onClick={() => handleSelectTopic(mod.id)}
                      >
                        <span className="topic-status-dot">
                          {completed ? "✓" : mod.isTest ? "📝" : "○"}
                        </span>
                        <span className="topic-title-text">{mod.title}</span>
                      </div>

                      {!mod.isTest && (
                        <div className="sidebar-topic-actions">
                          <button
                            type="button"
                            className="sidebar-action-btn"
                            title={t("Видеолекция", "Video Lecture")}
                            onClick={(e) => { e.stopPropagation(); setShowVideoModal(mod.id); }}
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            className="sidebar-action-btn"
                            title={t("Связанные карточки (Граф)", "Related Cards (Graph)")}
                            onClick={(e) => { e.stopPropagation(); setShowRelatedCards(prev => !prev); }}
                          >
                            🔗
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {viewTrack === 'practice' && PRACTICE_SECTIONS.map((section, sIdx) => (
              <div key={`p-${sIdx}`} className="sidebar-module-group">
                <div className="sidebar-module-header practice">
                  <span className="module-header-text">{section.title}</span>
                </div>
                {section.modules.map((mod) => {
                  const completed = isNodeCompleted(mod.id);
                  const isActive = String(mod.id) === String(activeModule);
                  return (
                    <div
                      key={mod.id}
                      className={`sidebar-topic-item ${isActive ? 'active' : ''} ${completed ? 'completed' : ''}`}
                    >
                      <div
                        className="sidebar-topic-label"
                        onClick={() => handleSelectTopic(mod.id)}
                      >
                        <span className="topic-status-dot" style={{ color: completed ? "#10b981" : "#8b5cf6" }}>
                          {completed ? "✓" : "⚡"}
                        </span>
                        <span className="topic-title-text">{mod.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ─── RIGHT CONTENT: Cards + Chat ────────────────────── */}
        <div className="academy-content">
          {/* Content Header */}
          <div className="content-header">
            <div className="content-header-info">
              <h2 className="content-topic-title">{lectureTitle}</h2>
              <span className="content-topic-meta">
                {cards.length > 0
                  ? `${cards.length} ${t("тезисов", "theses")}`
                  : isTest
                    ? t("Рубежный контроль", "Checkpoint")
                    : isPracticeCase
                      ? t("Клинический кейс", "Clinical Case")
                      : t("Материал", "Material")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={togglePause}
                className="content-voice-btn"
                style={{
                  border: isPlaying ? "1px solid #10b981" : "1px solid var(--border-color)",
                  background: isPlaying ? "rgba(16, 185, 129, 0.1)" : "var(--bg-card-alt)",
                  color: isPlaying ? "#10b981" : "var(--foreground)"
                }}
              >
                <span>{isPlaying ? "⏸" : isPaused ? "▶" : "▶"}</span>
                <span>{isPlaying ? t("Пауза", "Pause") : isPaused ? t("Продолжить", "Resume") : t("Голос", "Voice")}</span>
              </button>
            </div>
          </div>

          {/* Cards Scroll Area */}
          <div className="content-cards-scroll">
            {isLecturesLoading && (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)" }}>
                {t("Загрузка материалов...", "Loading materials...")}
              </div>
            )}

            {/* Test Checkpoint */}
            {isTest && (
              <div className="content-card" style={{ borderTop: "4px solid var(--primary)" }}>
                <ModuleCheckpoint
                  moduleId={parseInt(String(activeModule).split("-")[1], 10) || 1}
                  onComplete={(score, total, failed) => {
                    markTestCompleted(String(activeModule));
                    addPoints(score * 5);
                    refreshProgress();
                    const failedText = failed.map(q => q.question).join(" | ");
                    handleSend(t(
                      `[СИСТЕМНОЕ СООБЩЕНИЕ: Студент прошел чекпойнт. Оценка: ${score}/${total}. Ошибки: ${failedText || "нет"}.] Дайте обратную связь.`,
                      `[SYSTEM: Checkpoint passed: ${score}/${total}. Feedback.]`
                    ));
                  }}
                />
              </div>
            )}

            {/* Practice Case Briefing */}
            {isPracticeCase && (
              <div className="content-card" style={{ borderTop: "4px solid #8b5cf6" }}>
                <div className="content-card-header">
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase" }}>
                      {t("Клинический кейс", "Clinical Case")}
                    </span>
                    <h3 className="content-card-title">{lectureTitle}</h3>
                  </div>
                </div>
                <div className="content-card-body">
                  <p>{t("В этой симуляции вы отрабатываете навыки клинической коммуникации согласно протоколу.", "In this simulation, you practice clinical communication according to protocol.")}</p>
                </div>
                <button
                  type="button"
                  className="cta-dominant-btn passed"
                  onClick={() => {
                    setChatExpanded(true);
                    handleSend(t(`[СИСТЕМНОЕ СООБЩЕНИЕ: Запуск симуляции ${activeModule}.]`, `[SYSTEM: Start simulation ${activeModule}]`));
                  }}
                >
                  <span>▶</span>
                  <span>{t("Начать симуляцию с супервизором", "Start simulation")}</span>
                </button>
              </div>
            )}

            {/* All Thesis Cards (shown as a list) */}
            {!isTest && !isPracticeCase && cards.map((card, idx) => (
              <div key={idx} className="content-card">
                <div className="content-card-header">
                  <div>
                    <span className="content-card-step-tag">
                      {t("Тезис", "Thesis")} #{idx + 1}
                    </span>
                    <h3 className="content-card-title">
                      {t(card.title || `Тезис #${idx + 1}`, card.title_en || card.title || `Thesis #${idx + 1}`)}
                    </h3>
                  </div>
                  
                </div>

                {/* Tags */}
                {card.topic_tags && card.topic_tags.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {card.topic_tags.map((tag, tIdx) => (
                      <span key={tIdx} style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", background: "var(--bg-card-alt)", padding: "2px 8px", borderRadius: "6px" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Text */}
                <div className="content-card-body">
                  {renderFormattedBody(t(card.refined_text || "", card.refined_text_en || card.refined_text || ""))}
                </div>
              </div>
            ))}

              {showRelatedCards && (
                <div className="related-cards-section" style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px dashed var(--border)" }}>
                  <h3 style={{ marginBottom: "16px", color: "var(--foreground)", fontSize: "1.1rem" }}>{t("Связанные карточки из графа", "Related Graph Cards")}</h3>
                  {[
                    { title: "Cognitive Behavioral Therapy (CBT)", tag: "intervention", desc: "The gold-standard evidence-based psychotherapy integrating cognitive restructuring with behavioral techniques. Core techniques include cognitive restructuring, behavioral experiments, and exposure." },
                    { title: "Stress-Vulnerability Model", tag: "theory", desc: "Proposes that psychopathology results from the interaction between pre-existing vulnerability (genetic, psychological, or social) and environmental stressors." },
                    { title: "Universal Prevention Programs", tag: "prevention", desc: "Interventions targeting entire populations regardless of individual risk level. Cost-effectiveness is highest among prevention tiers." }
                  ].map((node, i) => (
                    <div key={'rel'+i} className="content-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
                      <div className="content-card-header">
                        <div>
                          <span className="content-card-step-tag" style={{ background: "#8b5cf6", color: "#fff" }}>
                            {node.tag.toUpperCase()}
                          </span>
                          <h3 className="content-card-title">{node.title}</h3>
                        </div>
                      </div>
                      <div className="content-card-body">
                        <p>{node.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}


            {/* Full Lecture Notes Accordion */}
            {localLecture?.html && (
              <div className="content-notes-accordion">
                <div
                  className="content-notes-toggle"
                  onClick={() => setShowFullNotes(!showFullNotes)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>📖</span>
                    <span>{t("Развернуть полный конспект лекции", "Expand full lecture notes")}</span>
                  </span>
                  <span>{showFullNotes ? "▲" : "▼"}</span>
                </div>
                {showFullNotes && (
                  <div
                    className="content-notes-body"
                    dangerouslySetInnerHTML={{ __html: localLecture.html }}
                  />
                )}
              </div>
            )}
          </div>

          {/* ─── Collapsible Chat ─────────────────────────────── */}
          <div className={`content-chat-section ${chatExpanded ? 'expanded' : ''}`}>
            {/* Chat Toggle Bar */}
            <div
              className="chat-toggle-bar"
              onClick={() => setChatExpanded(!chatExpanded)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AiProfessorAvatar state={profState} className="compact" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>
                    {t("ИИ-Профессор", "AI Professor")}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
                    {profState === "thinking"
                      ? t("Думает...", "Thinking...")
                      : profState === "speaking"
                        ? t("Говорит...", "Speaking...")
                        : t("Задайте вопрос", "Ask a question")}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "1rem", color: "var(--muted-foreground)" }}>
                {chatExpanded ? "▼" : "▲"}
              </span>
            </div>

            {/* Chat Body (shown when expanded) */}
            {chatExpanded && (
              <>
                <div ref={chatMessagesRef} className="chat-messages-area">
                  {currentChat.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                      {msg.role === "professor" ? (
                        <div>{renderFormattedBody(msg.text)}</div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                <div className="chat-suggestions-bar">
                  <button type="button" className="chat-chip-btn"
                    onClick={() => handleSend(t("Объясните этот материал проще и приведите пример.", "Explain this simply with an example."))}>
                    💡 {t("Объяснить проще", "Explain simply")}
                  </button>
                  <button type="button" className="chat-chip-btn"
                    onClick={() => handleSend(t("Дайте наводящую подсказку.", "Give a hint."))}>
                    🔬 {t("Подсказка", "Hint")}
                  </button>
                  <button type="button" className="chat-chip-btn"
                    onClick={() => handleSend(t("Задайте мне тестовый вопрос по этой теме.", "Give me a quiz question."))}>
                    📝 {t("Тестовый вопрос", "Quiz")}
                  </button>
                </div>

                {/* Input */}
                <div className="chat-input-bar">
                  <input
                    type="text"
                    placeholder={t("Задайте вопрос профессору...", "Ask the professor...")}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => onEnterKeyDown(e, () => handleSend())}
                  />
                  <SpeechDictationButton
                    onText={(dictated: string) => setInputText(prev => prev + " " + dictated)}
                  />
                  <button
                    type="button"
                    className="ob-btn primary"
                    style={{ borderRadius: "8px", padding: "8px 16px", fontWeight: 700 }}
                    onClick={() => handleSend()}
                  >
                    ➤
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MODALS ═══════════════════════════════════════════ */}

      {/* Graph Modal */}
      {showGraphModal && (
        <div className="graph-modal-overlay" onClick={() => setShowGraphModal(false)}>
          <div className="graph-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="graph-modal-header">
              <h2>{t("Связанные карточки — 3D Граф Знаний", "Related Cards — 3D Knowledge Graph")}</h2>
              <button type="button" className="graph-modal-close" onClick={() => setShowGraphModal(false)}>
                ✕ {t("Закрыть", "Close")}
              </button>
            </div>
            <div className="graph-modal-body">
              <iframe
                src={`/academy/graph/?embed=true&lang=${getTerminalEdition() === "intl" ? "en" : "ru"}`}
                title="3D Knowledge Graph"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Lecture Modal */}
      {showVideoModal !== null && (
        <div className="graph-modal-overlay" onClick={() => setShowVideoModal(null)}>
          <div className="graph-modal-content" style={{ maxWidth: "800px", height: "auto", aspectRatio: "16/9", padding: "0" }} onClick={(e) => e.stopPropagation()}>
            <div className="graph-modal-header">
              <h2>▶ {t("Видеолекция", "Video Lecture")}: {(lecturesData as any)[String(showVideoModal)]?.title || `${t("Тема", "Topic")} ${showVideoModal}`}</h2>
              <button type="button" className="graph-modal-close" onClick={() => setShowVideoModal(null)}>
                ✕ {t("Закрыть", "Close")}
              </button>
            </div>
            <div className="graph-modal-body" style={{ padding: "0", background: "#000", aspectRatio: "16/9" }}>
              {videoMap[String(showVideoModal)] ? (
                <iframe
                  src={videoMap[String(showVideoModal)]}
                  width="100%"
                  height="100%"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture;"
                  allowFullScreen
                  style={{ border: "none" }}
                />
              ) : (
                <div style={{ color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px" }}>
                  {t("Видеолекция пока не загружена.", "Video lecture is not uploaded yet.")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
