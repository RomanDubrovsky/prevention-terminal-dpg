import { useState, useRef, useEffect, useMemo } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";
import { t } from "../lib/i18n.ts";
import AiProfessorAvatar from "./AiProfessorAvatar.tsx";
import type { ProfessorState } from "./AiProfessorAvatar.tsx";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import ModuleCheckpoint from "./ModuleCheckpoint.tsx";
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
      { id: "test-1", title: t("Рубежный контроль 1 (Тест модуля 1)", "Checkpoint 1"), isTest: true, tag: "Контроль" },
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
      { id: "test-2", title: t("Рубежный контроль 2 (Тест модуля 2)", "Checkpoint 2"), isTest: true, tag: "Контроль" },
    ]
  },
  {
    title: t("Модуль 3. ПРАКТИКА И ВНЕДРЕНИЕ", "Module 3. PRACTICE & IMPLEMENTATION"),
    modules: [
      { id: 16, title: t("16. Логика и структура профилактического проекта", "16. Project Structure"), tag: "Проектирование" },
      { id: 17, title: t("17. План мероприятий профилактической программы", "17. Action Plan"), tag: "Планирование" },
      { id: 18, title: t("18. Оценка эффективности профилактики", "18. Efficiency Evaluation"), tag: "Оценка" },
      { id: 19, title: t("19. Структура и автоматизация психологической службы", "19. Service Automation"), tag: "Автоматизация" },
      { id: "test-3", title: t("Рубежный контроль 3 (Тест модуля 3)", "Checkpoint 3"), isTest: true, tag: "Контроль" },
    ]
  }
];

const PRACTICE_SECTIONS: ModuleSection[] = [
  {
    title: t("Клинические кейсы и симуляции", "Clinical Simulations"),
    modules: [
      { id: "case_suicide_01", title: t("Кейс 1.1: Скрининг витальных рисков (mhGAP)", "Case 1.1: Vital risk screening"), tag: "Триаж" },
      { id: "case_ed_01", title: t("Кейс 1.2: Первичная оценка РПП (Анорексия)", "Case 1.2: Eating disorder assessment"), tag: "Триаж" },
      { id: "case_deviance_01", title: t("Кейс 2.1: Мотивационное интервью с подростком", "Case 2.1: Motivational interview"), tag: "Контакт" },
      { id: "case_panic_01", title: t("Кейс 3.1: Паническая атака перед экзаменом (DBT)", "Case 3.1: Panic attack (DBT)"), tag: "Аффект" },
      { id: "case_bullying_01", title: t("Кейс 4.1: Социофобия после буллинга (КПТ)", "Case 4.1: Social anxiety (CBT)"), tag: "Когниции" },
      { id: "case_parents_01", title: t("Кейс 5.1: Конфликт Учитель-Родитель (ОРКТ)", "Case 5.1: Parent-Teacher mediation"), tag: "Медиация" },
    ]
  }
];

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

export default function AIAcademyWorkspace({ aiSubscriptionActive = true }: { aiSubscriptionActive?: boolean }) {
  // --- 1. Mode State Machine ---
  const [workspaceMode, setWorkspaceMode] = useState<'map' | 'focus'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("lecture") || params.has("case") || params.has("step")) return "focus";
    } catch (e) {}
    return "map";
  });

  const [mapTab, setMapTab] = useState<'roadmap' | '3d'>('roadmap');
  const [viewTrack, setViewTrack] = useState<'theory' | 'practice'>('theory');

  // --- 2. Active Lecture / Step State ---
  const [activeModule, setActiveModule] = useState<string | number>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get("lecture");
      if (p !== null && p !== "") {
        const n = Number(p);
        return isNaN(n) ? p : n;
      }
    } catch (e) {}
    return 0;
  });

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isStepValidated, setIsStepValidated] = useState(false);
  const [showRewardAnimation, setShowRewardAnimation] = useState(false);
  const [showFullNotes, setShowFullNotes] = useState(false);

  // --- 3. Asynchronous Lectures Loading ---
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

  // --- 4. User Progress & Gamification ---
  const [progress, setProgress] = useState<AcademyProgressState>(() => loadProgress());

  const refreshProgress = () => {
    setProgress(loadProgress());
  };

  const readLecturesSet = useMemo(() => new Set((progress.readLectures || []).map(String)), [progress.readLectures]);
  const completedTestsSet = useMemo(() => new Set((progress.completedTests || []).map(String)), [progress.completedTests]);
  const completedCasesSet = useMemo(() => new Set((progress.completedCases || []).map(String)), [progress.completedCases]);

  const isNodeCompleted = (id: string | number) => {
    if (typeof id === 'string' && id.startsWith('test-')) return completedTestsSet.has(id);
    if (typeof id === 'string' && id.startsWith('case_')) return completedCasesSet.has(id);
    return readLecturesSet.has(String(id));
  };

  // Find all linear items to determine unlock sequencing
  const allTheoryModules = useMemo(() => {
    const list: ModuleItem[] = [];
    MODULE_SECTIONS.forEach(sec => list.push(...sec.modules));
    return list;
  }, []);

  const isNodeUnlocked = (id: string | number) => {
    if (id === 0 || id === "0") return true;
    if (isNodeCompleted(id)) return true;

    // Check theory progression
    const idx = allTheoryModules.findIndex(m => String(m.id) === String(id));
    if (idx > 0) {
      const prev = allTheoryModules[idx - 1];
      return isNodeCompleted(prev.id);
    }

    // For practice, allow open practice
    if (typeof id === 'string' && id.startsWith('case_')) return true;

    return false;
  };

  const currentTheoryStep = useMemo(() => {
    for (const m of allTheoryModules) {
      if (!isNodeCompleted(m.id)) return m.id;
    }
    return 0;
  }, [allTheoryModules, progress]);

  // --- 5. Guided Onboarding Spotlight ---
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    try {
      return localStorage.getItem("teenology_academy_onboarded") !== "true";
    } catch (e) {
      return false;
    }
  });

  const completeOnboarding = (startLectureId?: string | number) => {
    try {
      localStorage.setItem("teenology_academy_onboarded", "true");
    } catch (e) {}
    setOnboardingOpen(false);
    if (startLectureId !== undefined) {
      setActiveModule(startLectureId);
      setCurrentCardIndex(0);
      setIsStepValidated(false);
      setWorkspaceMode('focus');
    }
  };

  // --- 6. AI Professor & Audio Voice ---
  const [profState, setProfState] = useState<ProfessorState>("idle");
  const { speak, stop, isPlaying, isPaused, togglePause, isMuted, toggleMute } = useAiProfessorVoice((speaking) => {
    setProfState(speaking ? "speaking" : "idle");
  });

  // Chat threads per module
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

  // Scroll chat on new message
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [currentChat]);

  // --- 7. Current Lecture & Cards Setup in Focus Mode ---
  const localLecture = (lecturesData as Record<string, AcademyLectureObj>)[String(activeModule)];
  const lectureTitle = localLecture?.title 
    ? t(localLecture.title, localLecture.title_en || localLecture.title) 
    : `${t("Лекция", "Lecture")} ${activeModule}`;

  const cards: AcademyCard[] = localLecture?.cards || [];
  const currentCard = cards[currentCardIndex];
  const isPracticeCase = typeof activeModule === "string" && activeModule.startsWith("case_");
  const isTest = typeof activeModule === "string" && activeModule.startsWith("test-");

  // Progress percentage in current topic
  const totalCardsCount = cards.length > 0 ? cards.length : 1;
  const progressPercent = Math.min(100, Math.round(((currentCardIndex + (isStepValidated ? 1 : 0)) / totalCardsCount) * 100));

  // Initialize or reset card step on change
  useEffect(() => {
    if (workspaceMode !== 'focus') return;
    stop();
    setIsStepValidated(false);
    setShowRewardAnimation(false);
    setShowFullNotes(false);

    const activeId = String(activeModule);

    // If checkpoint test
    if (isTest) {
      const checkpointMsg = t(
        `Рубежный контроль по модулю: «${lectureTitle}». Ответьте на контрольные вопросы слева. Я проанализирую ваши результаты и помогу разобрать сложные моменты!`,
        `Checkpoint for module: "${lectureTitle}". Answer the questions on the left.`
      );
      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: checkpointMsg }]
      }));
      return;
    }

    // If clinical simulation case
    if (isPracticeCase) {
      const caseMsg = t(
        `Запуск клинической симуляции «${lectureTitle}». Изучите протокол и анамнез слева, затем нажмите «Начать симуляцию», чтобы приступить к диалогу под супервизией.`,
        `Starting clinical simulation: "${lectureTitle}". Review protocol and click Start.`
      );
      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: caseMsg }]
      }));
      return;
    }

    // Standard lecture card
    if (currentCard) {
      const cardTitle = t(currentCard.title || `${t("Тезис", "Thesis")} #${currentCardIndex + 1}`, currentCard.title_en || currentCard.title || `${t("Тезис", "Thesis")} #${currentCardIndex + 1}`);
      const promptQ = t(currentCard.reflection_prompt || "", currentCard.reflection_prompt_en || currentCard.reflection_prompt || "") ||
        t(`Объясните своими словами суть тезиса «${cardTitle}» и приведите практический пример.`, `Explain "${cardTitle}" in your own words with an example.`);

      const welcomeMsg = t(
        `🎓 **Тезис #${currentCardIndex + 1} из ${cards.length}: «${cardTitle}»**\n\nИзучите материал тезиса в карточке слева. Чтобы разблокировать следующий шаг, ответьте на контрольный вопрос профессора:\n\n❓ **${promptQ}**`,
        `🎓 **Thesis #${currentCardIndex + 1} of ${cards.length}: "${cardTitle}"**\n\nStudy the card on the left. To unlock next step, answer:\n\n❓ **${promptQ}**`
      );

      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: welcomeMsg }]
      }));
    } else if (localLecture) {
      const plainMsg = t(
        `Открыта тема: «${lectureTitle}». Ознакомьтесь с материалами конспекта слева. Задайте любой вопрос или подтвердите усвоение материала!`,
        `Topic "${lectureTitle}" opened. Read the notes on the left.`
      );
      setThreads(prev => ({
        ...prev,
        [activeId]: [{ role: 'professor', text: plainMsg }]
      }));
    }
  }, [activeModule, currentCardIndex, workspaceMode, isLecturesLoading]);

  // --- 8. AI Validation & Gatekeeper Turn ---
  const handleSend = async (overrideMsg?: string) => {
    const msg = (overrideMsg || inputText).trim();
    if (!msg) return;
    stop();
    setChat((prev: ChatMessage[]) => [...prev, { role: "user", text: msg }]);
    if (!overrideMsg) setInputText("");
    setProfState("thinking");

    const activeId = String(activeModule);
    const cardTitle = currentCard ? t(currentCard.title, currentCard.title_en || currentCard.title) : "";
    const cardText = currentCard ? t(currentCard.refined_text || "", currentCard.refined_text_en || currentCard.refined_text || "") : (localLecture?.raw_text || "");
    const questionText = currentCard ? t(currentCard.reflection_prompt || "", currentCard.reflection_prompt_en || currentCard.reflection_prompt || "") : "";

    const promptContext = isPracticeCase
      ? `Simulation Case: ${activeModule}\nStudent input: ${msg}`
      : `Студент изучает лекцию: "${lectureTitle}", конкретно Тезис #${currentCardIndex + 1}: "${cardTitle}".
ТЕКСТ ТЕЗИСА:
${cardText.slice(0, 1500)}

КОНТРОЛЬНЫЙ ВОПРОС ПРОФЕССОРА:
${questionText}

ОТВЕТ СТУДЕНТА:
"${msg}"

ИНСТРУКЦИЯ ДЛЯ ПРОФЕССОРА-ВАЛИДАТОРА:
1. Оцените, понимает ли студент суть этого тезиса.
2. ЕСЛИ ОТВЕТ ПРАВИЛЬНЫЙ ИЛИ ДЕМОНСТРИРУЕТ ВЕРНОЕ ПОНИМАНИЕ СУТИ:
ОБЯЗАТЕЛЬНО начни свой ответ со слова [УСПЕШНО] или [МАТЕРИАЛ УСВОЕН]. Похвали студента, подчеркни ключевую мысль и подтверди прохождение шага.
3. ЕСЛИ ОТВЕТ НЕПОЛНЫЙ, ОШИБОЧНЫЙ ИЛИ СТУДЕНТ ПРОСИТ ПОМОЩИ:
НЕ используй слово [УСПЕШНО]. Мягко объясни, укажи на неточность или приведи живой пример в стиле Сапольского, затем задай направляющий вопрос.`;

    try {
      const res = await hybridAI.sendAiTurnHybrid({
        mode: "consultant",
        consultantSub: isPracticeCase ? "supervisor" : "academy",
        appId: "school_academy",
        message: msg,
        context: promptContext,
        lang: getTerminalEdition() === "intl" ? "en" : "ru",
      });

      const reply = res.reply || t("Ответ от профессора получен.", "Response received.");
      setChat((prev: ChatMessage[]) => [...prev, { role: "professor", text: reply }]);
      speak(reply);

      // Gatekeeper Validation Check
      const isPassed = reply.includes("[УСПЕШНО]") || 
                       reply.includes("[МАТЕРИАЛ УСВОЕН]") || 
                       reply.includes("УСПЕШНО") || 
                       reply.includes("Материал усвоен") || 
                       reply.includes("Правильно") || 
                       reply.includes("Всё верно") || 
                       reply.includes("Отлично") || 
                       reply.includes("UNDERSTOOD") || 
                       reply.includes("PASSED");

      if (isPassed && !isStepValidated) {
        setIsStepValidated(true);
        setShowRewardAnimation(true);
        addPoints(10);
        refreshProgress();
        setTimeout(() => setShowRewardAnimation(false), 2600);
      }

      if (isPracticeCase && (reply.includes("[СИМУЛЯЦИЯ УСПЕШНО ЗАВЕРШЕНА]") || reply.includes("[СУПЕРВИЗИЯ ПРОЙДЕНА]"))) {
        markCaseCompleted(String(activeModule));
        setIsStepValidated(true);
        addPoints(50);
        refreshProgress();
      }
    } catch (e) {
      setChat((prev: ChatMessage[]) => [...prev, { role: "professor", text: t("Ошибка соединения с профессором.", "Connection error.") }]);
      setProfState("idle");
    }
  };

  // --- 9. Step Navigation & Topic Completion ---
  const handleNextStep = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsStepValidated(false);
      setShowRewardAnimation(false);
    } else {
      // Completed all cards in the lecture!
      markLectureRead(activeModule);
      addPoints(25);
      refreshProgress();
      // Transition to map with celebratory status
      setWorkspaceMode('map');
    }
  };

  // Enter Focus mode for a given module
  const enterFocusMode = (id: string | number) => {
    setActiveModule(id);
    setCurrentCardIndex(0);
    setIsStepValidated(false);
    setWorkspaceMode('focus');
  };

  const totalLessonsCount = allTheoryModules.length;
  const completedLessonsCount = allTheoryModules.filter(m => isNodeCompleted(m.id)).length;
  const overallProgressPercent = Math.round((completedLessonsCount / totalLessonsCount) * 100);

  return (
    <div className="ai-academy-workspace">
      {/* TOP HEADER: GAMIFICATION STATUS & LEVEL */}
      <AcademyGamificationWidget />

      {/* ===================================================================
          MODE 1: MAP / DASHBOARD (The Lobby & Global Route)
          =================================================================== */}
      {workspaceMode === 'map' && (
        <div className="academy-map-view">
          {/* Map View Header */}
          <div className="map-view-header">
            <div className="map-view-hero">
              <h1>
                <span>🎓</span>
                <span>{t("Образовательный маршрут Академии", "Academy Learning Roadmap")}</span>
              </h1>
              <p>
                {t(
                  `Пройдено: ${completedLessonsCount} из ${totalLessonsCount} тем (${overallProgressPercent}%). Двигайтесь по коридору знаний шаг за шагом.`,
                  `Completed: ${completedLessonsCount} of ${totalLessonsCount} topics (${overallProgressPercent}%). Step-by-step guided journey.`
                )}
              </p>
            </div>

            <div className="map-controls-group">
              {/* Tab Switcher: Roadmap vs 3D Graph */}
              <div className="map-tab-switcher">
                <button 
                  type="button"
                  className={`map-tab-btn ${mapTab === 'roadmap' ? 'active' : ''}`}
                  onClick={() => setMapTab('roadmap')}
                >
                  <span>🗺️</span>
                  <span>{t("Маршрут курса", "Roadmap")}</span>
                </button>
                <button 
                  type="button"
                  className={`map-tab-btn ${mapTab === '3d' ? 'active' : ''}`}
                  onClick={() => setMapTab('3d')}
                >
                  <span>🌐</span>
                  <span>{t("3D Граф Знаний", "3D Graph")}</span>
                </button>
              </div>

              {/* Quick Resume Button */}
              <button 
                type="button"
                className="map-continue-hero-btn"
                onClick={() => enterFocusMode(currentTheoryStep)}
              >
                <span>🚀</span>
                <span>{t(`Продолжить (Тема ${currentTheoryStep})`, `Resume (Topic ${currentTheoryStep})`)} ➔</span>
              </button>
            </div>
          </div>

          {/* ROADMAP VIEW */}
          {mapTab === 'roadmap' && (
            <div className="roadmap-content-scroll">
              {/* Theory Sections */}
              {MODULE_SECTIONS.map((section, sIdx) => (
                <div key={sIdx} className="roadmap-module-container">
                  <div className="roadmap-module-title">
                    <span>📚</span>
                    <span>{section.title}</span>
                  </div>

                  <div className="roadmap-nodes-grid">
                    {section.modules.map((mod) => {
                      const completed = isNodeCompleted(mod.id);
                      const current = String(mod.id) === String(currentTheoryStep);
                      const unlocked = isNodeUnlocked(mod.id);

                      const lec = (lecturesData as Record<string, AcademyLectureObj>)[String(mod.id)];
                      const cardsCount = lec?.cards?.length || (mod.isTest ? 1 : 0);

                      return (
                        <div 
                          key={mod.id}
                          className={`roadmap-card ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${!unlocked ? 'locked' : ''}`}
                          onClick={() => {
                            if (unlocked) {
                              enterFocusMode(mod.id);
                            }
                          }}
                          title={!unlocked ? t("Пройдите предыдущие темы для разблокировки", "Complete previous topics to unlock") : ""}
                        >
                          <div className="roadmap-card-top">
                            <div className="roadmap-card-badge-icon">
                              {completed ? "✓" : current ? "▶" : unlocked ? "○" : "🔒"}
                            </div>
                            <div className="roadmap-card-info">
                              <h4 className="roadmap-card-title">{mod.title}</h4>
                              <div className="roadmap-card-desc">
                                <span>{cardsCount > 0 ? `${cardsCount} ${t("тезисов", "theses")}` : mod.isTest ? t("Тест", "Quiz") : t("Материал", "Material")}</span>
                                {mod.tag && <span>• #{mod.tag}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="roadmap-card-footer">
                            <span className={`roadmap-status-tag ${completed ? 'status-completed' : current ? 'status-current' : 'status-locked'}`}>
                              {completed 
                                ? t("✅ Усвоено", "✅ Passed") 
                                : current 
                                  ? t("▶ Изучить сейчас", "▶ Active") 
                                  : unlocked 
                                    ? t("Доступно", "Available") 
                                    : t("🔒 Заблокировано", "🔒 Locked")}
                            </span>
                            {unlocked && (
                              <span style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: 700 }}>
                                {t("Открыть", "Open")} ➔
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Practice Simulations Section */}
              {PRACTICE_SECTIONS.map((section, sIdx) => (
                <div key={`p-${sIdx}`} className="roadmap-module-container" style={{ marginTop: "40px" }}>
                  <div className="roadmap-module-title" style={{ color: "#8b5cf6", borderBottomColor: "rgba(139, 92, 246, 0.2)" }}>
                    <span>🩺</span>
                    <span>{section.title}</span>
                  </div>

                  <div className="roadmap-nodes-grid">
                    {section.modules.map((mod) => {
                      const completed = isNodeCompleted(mod.id);

                      return (
                        <div 
                          key={mod.id}
                          className={`roadmap-card ${completed ? 'completed' : ''}`}
                          onClick={() => enterFocusMode(mod.id)}
                          style={{ borderColor: completed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(139, 92, 246, 0.2)' }}
                        >
                          <div className="roadmap-card-top">
                            <div className="roadmap-card-badge-icon" style={{ background: completed ? "var(--success)" : "rgba(139, 92, 246, 0.1)", color: completed ? "#ffffff" : "#8b5cf6" }}>
                              {completed ? "✓" : "⚡"}
                            </div>
                            <div className="roadmap-card-info">
                              <h4 className="roadmap-card-title">{mod.title}</h4>
                              <div className="roadmap-card-desc">
                                <span>{t("Клинический протокол", "Clinical Protocol")}</span>
                                {mod.tag && <span>• #{mod.tag}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="roadmap-card-footer">
                            <span className={`roadmap-status-tag ${completed ? 'status-completed' : 'status-current'}`} style={{ color: completed ? "#059669" : "#8b5cf6", background: completed ? "rgba(16, 185, 129, 0.1)" : "rgba(139, 92, 246, 0.1)" }}>
                              {completed ? t("✅ Кейс сдан (+50 XP)", "✅ Case passed (+50 XP)") : t("▶ Пройти симуляцию", "▶ Practice Case")}
                            </span>
                            <span style={{ fontSize: "0.85rem", color: "#8b5cf6", fontWeight: 700 }}>
                              {t("Начать", "Start")} ➔
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3D GRAPH VIEW (Rendered ONLY when user explicitly switches to 3D tab) */}
          {mapTab === '3d' && (
            <div className="roadmap-3d-wrapper">
              <iframe 
                src={`/academy/graph/?embed=true&lang=${getTerminalEdition() === "intl" ? "en" : "ru"}`}
                title="3D Knowledge Graph"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          )}

          {/* GUIDED ONBOARDING SPOTLIGHT OVERLAY */}
          {onboardingOpen && (
            <div className="guided-onboarding-overlay">
              <div className="onboarding-modal-card">
                <span className="onboarding-badge">🚀 Guided Experience</span>
                <h2>{t("Добро пожаловать в Академию Превенции!", "Welcome to Prevention Academy!")}</h2>
                <p>
                  {t(
                    "Мы трансформировали обучение в управляемую образовательную воронку. Здесь нет перегруженных дашбордов: двигайтесь шаг за шагом по ключевым тезисам и валидируйте каждый аспект в диалоге с ИИ-профессором.",
                    "We transformed learning into a guided educational funnel. No overwhelming dashboards: progress step-by-step through key theses and validate each with your AI Professor."
                  )}
                </p>

                <div className="onboarding-step-highlight">
                  <div className="onboarding-step-num">0</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      {t("0. Вводное занятие: Добро пожаловать в Академию", "0. Intro Lesson: Welcome to Academy")}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                      {t("Ваш персональный образовательный маршрут начинается здесь", "Your personal learning path begins right here")}
                    </div>
                  </div>
                </div>

                <div className="onboarding-actions">
                  <button 
                    type="button"
                    className="onboarding-start-btn"
                    onClick={() => completeOnboarding(0)}
                  >
                    {t("🚀 Начать вводное занятие", "🚀 Start Intro Lesson")} ➔
                  </button>
                  <button 
                    type="button"
                    className="onboarding-skip-btn"
                    onClick={() => completeOnboarding()}
                  >
                    {t("Исследовать карту курса", "Explore Course Map")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          MODE 2: FOCUS MODE (The Two-Zone Learning Tunnel)
          =================================================================== */}
      {workspaceMode === 'focus' && (
        <div className="academy-focus-view">
          {/* Micro-reward Floating Animation */}
          {showRewardAnimation && (
            <div className="micro-reward-floating">
              <span>✨</span>
              <span>+10 XP</span>
              <span>{t("Материал усвоен!", "Thesis Understood!")}</span>
            </div>
          )}

          {/* Focus Top Bar */}
          <div className="focus-top-bar">
            <div className="focus-nav-left">
              <button 
                type="button"
                className="focus-back-btn"
                onClick={() => setWorkspaceMode('map')}
                title={t("Вернуться к глобальной карте курса", "Return to course map")}
              >
                <span>← 🗺️</span>
                <span>{t("Карта курса", "Course Map")}</span>
              </button>

              <div className="focus-lecture-meta">
                <h2 className="focus-lecture-title">{lectureTitle}</h2>
                <span className="focus-lecture-subtitle">
                  {cards.length > 0 
                    ? `${t("Тезис", "Thesis")} ${currentCardIndex + 1} ${t("из", "of")} ${cards.length}` 
                    : isTest 
                      ? t("Рубежный контроль", "Checkpoint") 
                      : t("Практический сценарий", "Simulation Case")}
                </span>
              </div>
            </div>

            {/* Linear Progress Meter */}
            <div className="focus-progress-container">
              <div className="focus-progress-label">
                <span>{isStepValidated ? "✅" : "⏳"}</span>
                <span>
                  {cards.length > 0 
                    ? `${t("Шаг", "Step")} ${currentCardIndex + 1} / ${cards.length} (${progressPercent}%)` 
                    : t("Интерактивный этап", "Interactive stage")}
                </span>
              </div>
              <div className="focus-progress-bar-track">
                <div 
                  className="focus-progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Audio Voice Quick Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={togglePause}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: isPlaying ? "1px solid #10b981" : "1px solid var(--border-color)",
                  background: isPlaying ? "rgba(16, 185, 129, 0.1)" : "var(--bg-card-alt)",
                  color: isPlaying ? "#10b981" : "var(--foreground)"
                }}
              >
                <span>{isPlaying ? "⏸" : isPaused ? "▶" : "🎧"}</span>
                <span>{isPlaying ? t("Пауза", "Pause") : isPaused ? t("Продолжить", "Resume") : t("Голос", "Voice")}</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: isMuted ? "#ef4444" : "var(--muted-foreground)"
                }}
                title={isMuted ? t("Включить звук", "Unmute") : t("Выключить звук", "Mute")}
              >
                {isMuted ? "🔇" : "🔔"}
              </button>
            </div>
          </div>

          {/* TWO BALANCED COLUMNS */}
          <div className="focus-two-columns">
            {/* LEFT COLUMN: Source of Truth (Thesis Card / Test / Case) */}
            <div className="focus-source-col">
              {/* Case Simulation Briefing */}
              {isPracticeCase && (
                <div className="focus-thesis-card" style={{ borderTop: "4px solid #8b5cf6" }}>
                  <div className="thesis-card-header">
                    <div className="thesis-card-title-group">
                      <span className="thesis-step-tag" style={{ color: "#8b5cf6" }}>{t("Клинический кейс", "Clinical Case")}</span>
                      <h3 className="thesis-card-title">{lectureTitle}</h3>
                    </div>
                  </div>
                  <div className="thesis-content-body">
                    <p>{t("В этой симуляции вы отрабатываете навыки клинической коммуникации и маршрутизации согласно протоколу. ИИ-Супервизор следит за точностью формулировок и соблюдением протокола.", "In this simulation, you practice clinical communication according to protocol.")}</p>
                  </div>
                  <button
                    type="button"
                    className="cta-dominant-btn passed"
                    onClick={() => {
                      const msg = t(`[СИСТЕМНОЕ СООБЩЕНИЕ: Запуск симуляции ${activeModule}. Действуй согласно роли супервизора.]`, `[SYSTEM: Start simulation ${activeModule}]`);
                      handleSend(msg);
                    }}
                  >
                    <span>▶</span>
                    <span>{t("Начать симуляцию с супервизором", "Start simulation")}</span>
                  </button>
                </div>
              )}

              {/* Module Checkpoint Test */}
              {isTest && (
                <div className="focus-thesis-card" style={{ borderTop: "4px solid #0f766e" }}>
                  <ModuleCheckpoint 
                    moduleId={parseInt(String(activeModule).split("-")[1], 10) || 1}
                    onComplete={(score, total, failed) => {
                      markTestCompleted(String(activeModule));
                      addPoints( score * 5 );
                      refreshProgress();
                      setIsStepValidated(true);

                      const failedText = failed.map(q => q.question).join(" | ");
                      const msg = t(
                        `[СИСТЕМНОЕ СООБЩЕНИЕ: Студент прошел чекпойнт. Оценка: ${score}/${total}. Ошибки: ${failedText || "нет"}. Дайте обратную связь.]`,
                        `[SYSTEM: Checkpoint passed: ${score}/${total}. Feedback.]`
                      );
                      handleSend(msg);
                    }}
                  />
                </div>
              )}

              {/* Standard Thesis Card (One thesis at a time) */}
              {!isTest && !isPracticeCase && currentCard && (
                <div className={`focus-thesis-card ${isStepValidated ? 'validated-card' : ''}`}>
                  <div className="thesis-card-header">
                    <div className="thesis-card-title-group">
                      <span className="thesis-step-tag">
                        {t("Тезис", "Thesis")} #{currentCardIndex + 1} {t("из", "of")} {cards.length}
                        {isStepValidated && <span style={{ color: "#10b981", marginLeft: "6px" }}>✓ {t("Усвоено", "Passed")}</span>}
                      </span>
                      <h3 className="thesis-card-title">
                        {t(currentCard.title || `Тезис #${currentCardIndex + 1}`, currentCard.title_en || currentCard.title || `Thesis #${currentCardIndex + 1}`)}
                      </h3>
                    </div>

                    <button
                      type="button"
                      className="thesis-audio-btn"
                      onClick={() => {
                        const cardTextClean = (currentCard.refined_text || "").replace(/##\s*[^\n]+/g, '').trim();
                        speak(`${currentCard.title}. ${cardTextClean}`);
                      }}
                      title={t("Озвучить тезис голосом профессора", "Listen to thesis")}
                    >
                      <span>🎧</span>
                      <span>{t("Озвучить", "Listen")}</span>
                    </button>
                  </div>

                  {/* Topic Tags */}
                  {currentCard.topic_tags && currentCard.topic_tags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                      {currentCard.topic_tags.map((tag, tIdx) => (
                        <span key={tIdx} style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", background: "var(--bg-card-alt)", padding: "2px 8px", borderRadius: "6px" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Thesis Content Body */}
                  <div className="thesis-content-body">
                    {renderFormattedBody(t(currentCard.refined_text || "", currentCard.refined_text_en || currentCard.refined_text || ""))}
                  </div>

                  {/* Reflection Question Box (The Gatekeeper challenge) */}
                  <div className="thesis-reflection-box">
                    <div className="reflection-box-title">
                      <span>❓</span>
                      <span>{t("Контрольный вопрос для размышления", "Verification Question")}</span>
                    </div>
                    <div className="reflection-box-text">
                      {t(currentCard.reflection_prompt || "", currentCard.reflection_prompt_en || currentCard.reflection_prompt || "") ||
                       t("Объясните своими словами, как этот тезис применяется на практике и в чем его главная ценность.", "Explain how this thesis applies in practice.")}
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsible Full Notes & Illustrated Transcript */}
              {localLecture?.html && (
                <div className="focus-full-notes-accordion">
                  <div 
                    className="focus-full-notes-summary"
                    onClick={() => setShowFullNotes(!showFullNotes)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>📖</span>
                      <span>{t("Развернуть полный конспект лекции с иллюстрациями", "Expand full illustrated lecture notes")}</span>
                    </span>
                    <span>{showFullNotes ? "▲" : "▼"}</span>
                  </div>

                  {showFullNotes && (
                    <div 
                      className="focus-full-notes-body"
                      dangerouslySetInnerHTML={{ __html: localLecture.html }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: AI Professor Chat & Gatekeeper Validator */}
            <div className="focus-chat-col">
              {/* Professor Header */}
              <div className="focus-chat-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <AiProfessorAvatar state={profState} className="compact" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--foreground)" }}>
                      {t("ИИ-Профессор (Экзаменатор)", "AI Professor (Examiner)")}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: isStepValidated ? "#10b981" : "var(--muted-foreground)", fontWeight: isStepValidated ? 700 : 400 }}>
                      {isStepValidated 
                        ? t("✨ Материал усвоен! Переходите к следующему шагу", "✨ Thesis understood! Proceed to next step")
                        : profState === "thinking" 
                          ? t("Анализирует ответ...", "Analyzing answer...")
                          : profState === "speaking" 
                            ? t("Объясняет тезис...", "Explaining thesis...")
                            : t("Ожидает ваш ответ на вопрос", "Waiting for your answer")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Message History */}
              <div ref={chatMessagesRef} className="focus-chat-messages">
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

              {/* Suggestions Chips */}
              <div className="focus-suggestions-bar">
                <button 
                  type="button"
                  className="focus-chip-btn"
                  onClick={() => handleSend(t("Пожалуйста, объясните этот тезис проще и приведите живой пример из практики.", "Explain this thesis simply with an example."))}
                >
                  💡 {t("Объяснить проще", "Explain simply")}
                </button>
                <button 
                  type="button"
                  className="focus-chip-btn"
                  onClick={() => handleSend(t("Дайте, пожалуйста, наводящую подсказку для ответа на контрольный вопрос.", "Give a hint for the question."))}
                >
                  🔬 {t("Дать подсказку", "Give hint")}
                </button>
                <button 
                  type="button"
                  className="focus-chip-btn"
                  onClick={() => handleSend(t("Сформулируйте тестовый вопрос с 3 вариантами ответов по этому тезису.", "Give multiple choice test."))}
                >
                  📝 {t("Тестовый формат", "Quiz format")}
                </button>
              </div>

              {/* Input Bar with Dictation */}
              <div className="focus-input-bar">
                <input 
                  type="text"
                  placeholder={
                    isStepValidated 
                      ? t("Материал усвоен! Нажмите кнопку «Следующий шаг» ниже...", "Thesis passed! Click Next Step below...") 
                      : t("Ответьте на вопрос профессора своими словами...", "Answer professor's question in your own words...")
                  }
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

              {/* DOMINATING PRIMARY CTA (Next Step / Topic Finish) */}
              <div className="focus-bottom-action-zone">
                {isStepValidated ? (
                  <button 
                    type="button"
                    className="cta-dominant-btn passed"
                    onClick={handleNextStep}
                  >
                    <span>{currentCardIndex < cards.length - 1 ? "✨" : "🎉"}</span>
                    <span>
                      {currentCardIndex < cards.length - 1 
                        ? t("Материал усвоен. Следующий шаг ➔", "Thesis Understood. Next Step ➔")
                        : t("Тема полностью усвоена! Завершить ➔", "All Theses Passed! Complete Topic ➔")}
                    </span>
                  </button>
                ) : (
                  <div className="cta-dominant-hint">
                    <span>🔒</span>
                    <span>{t("Ответьте на контрольный вопрос профессора, чтобы разблокировать следующий шаг", "Answer professor's question to unlock next step")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
