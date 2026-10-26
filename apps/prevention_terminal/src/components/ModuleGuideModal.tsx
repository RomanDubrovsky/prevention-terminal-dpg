import { useState, useEffect } from "react";
import "./ModuleGuideModal.css";
import { t } from "../lib/i18n.ts";
import {
  getModuleGuide,
  type ModuleGuideContent,
  type VisualStepKind,
} from "../lib/module_guides_data.ts";

interface ModuleGuideModalProps {
  moduleId: string;
  isCommercial: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCtaClick?: () => void;
}

const STORAGE_PREFIX = "terminal_guide_seen_";

export function isGuideDismissed(moduleId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${moduleId}`) === "1";
  } catch {
    return false;
  }
}

export function setGuideDismissed(moduleId: string, dismissed = true): void {
  if (typeof window === "undefined") return;
  try {
    if (dismissed) {
      localStorage.setItem(`${STORAGE_PREFIX}${moduleId}`, "1");
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${moduleId}`);
    }
  } catch {
    /* ignore */
  }
}

function MockupIllustration(props: {
  kind: VisualStepKind;
  isSimulating: boolean;
  onSimulate: () => void;
  isCommercial?: boolean;
}) {
  const { kind, isSimulating, onSimulate, isCommercial } = props;

  if (kind === "voice_mic") {
    return (
      <div className="guide-mockup-frame">
        <div className="guide-mockup-header">
          <span className="guide-mockup-dot red" />
          <span className="guide-mockup-dot yellow" />
          <span className="guide-mockup-dot green" />
          <span className="guide-mockup-title">{t("Ввод данных и заметок: микрофон 🎙️", "Data Input: Microphone 🎙️")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-mockup-input-box">
            <p className="guide-mockup-text-preview">
              {isSimulating
                ? (isCommercial
                    ? t("«...клиент отмечает снижение тревоги на 30%, выполнен поведенческий эксперимент, запрос на тему границ с близкими...»", "'...client reports 30% anxiety reduction, completed experiment, requested focus on family boundaries...'")
                    : t("«...подросток жалуется на давление в классе, пропуски по вторникам, мама на собрания не приходит...»", "'...teenager complains about peer pressure, missing Tuesdays, mother doesn't attend meetings...'"))
                : t("Нажмите микрофон и надиктуйте заметки в свободной форме...", "Click the mic and dictate notes naturally...")}
            </p>
            <div className="guide-mic-interactive-bar">
              <button
                type="button"
                className={`guide-mic-button${isSimulating ? " active" : ""}`}
                onClick={onSimulate}
                title={t("Нажмите для симуляции", "Click to simulate")}
              >
                🎙️
              </button>
              <div className="guide-mic-waves">
                <span className={`wave-bar wave-1${isSimulating ? " animate" : ""}`} />
                <span className={`wave-bar wave-2${isSimulating ? " animate" : ""}`} />
                <span className={`wave-bar wave-3${isSimulating ? " animate" : ""}`} />
                <span className={`wave-bar wave-4${isSimulating ? " animate" : ""}`} />
                <span className={`wave-bar wave-5${isSimulating ? " animate" : ""}`} />
              </div>
              <span className="guide-mic-timer">{isSimulating ? "00:24 ⏺" : "00:00"}</span>
            </div>
          </div>
          <div className="guide-arrow-callout ok">
            <span className="guide-arrow-icon">✨</span>
            <span>{t("Свободная речь: говорите своими словами, система сама структурирует записи!", "Natural speech: speak freely, the system structures your notes!")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "ai_magic") {
    return (
      <div className="guide-mockup-frame">
        <div className="guide-mockup-header">
          <span className="guide-mockup-dot red" />
          <span className="guide-mockup-dot yellow" />
          <span className="guide-mockup-dot green" />
          <span className="guide-mockup-title">{t("Автоматическая структура и протокол", "Automatic Structure & Protocol")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-ai-result-grid">
            <div className="guide-tag-row">
              <span className="guide-badge-pill green">✓ {isCommercial ? t("Тема: Самооценка и границы", "Topic: Self-esteem & Boundaries") : t("Категория: Группа внимания", "Tier: Selective")}</span>
              <span className="guide-badge-pill violet">✓ {isCommercial ? t("Метод: ОРКТ + КПТ", "Method: SFBT + CBT") : t("Метод: Беседа + ОРКТ", "Method: Interview + SFBT")}</span>
              <span className="guide-badge-pill blue">✓ {isCommercial ? t("Статус: В работе", "Status: Active") : t("ФГОС / Протокол", "Standard / Protocol")}</span>
            </div>
            <div className="guide-card-snippet">
              <strong>{isCommercial ? t("Сформулированная гипотеза и план:", "Formulated Hypothesis & Plan:") : t("Сформированная гипотеза:", "Formulated Hypothesis:")}</strong>
              <p className="tiny muted">
                {isCommercial
                  ? t("Трудности сепарации и высокий уровень самокритики. Домашнее задание: дневник автоматических мыслей и шкала настроения.", "Separation difficulties and high self-criticism. Home assignment: thought record and mood scale.")
                  : t("Реакция социальной дезадаптации средней тяжести. Рекомендован контакт со школьной службой медиации.", "Moderate social maladaptation reaction. Mediation service contact recommended.")}
              </p>
            </div>
          </div>
          <div className="guide-arrow-callout ok">
            <span className="guide-arrow-icon">🪄</span>
            <span>{t("Все ключевые поля и рекомендации заполнены и готовы к сохранению!", "All key fields and recommendations are structured and ready to save!")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "docx_export") {
    return (
      <div className="guide-mockup-frame">
        <div className="guide-mockup-header">
          <span className="guide-mockup-dot red" />
          <span className="guide-mockup-dot yellow" />
          <span className="guide-mockup-dot green" />
          <span className="guide-mockup-title">{t("Официальный документ и экспорт", "Official Document & Export")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-docx-box">
            <div className="guide-docx-doc-icon">📄</div>
            <div>
              <div className="guide-docx-name">{isCommercial ? t("Протокол_сессии.docx", "Session_Protocol.docx") : t("Протокол_сопровождения.docx", "Support_Protocol.docx")}</div>
              <div className="tiny muted">{t("Зашифровано локально (SQLCipher) · Готово к печати", "Locally encrypted · Ready to print")}</div>
            </div>
            <span className="guide-badge-pill green">{isCommercial ? t("Готово к печати", "Ready to print") : t("100% ФГОС / ГОСТ", "100% Standard")}</span>
          </div>
          <div className="guide-arrow-callout">
            <span className="guide-arrow-icon">⬇️</span>
            <span>{t("Печать или экспорт официального документа в 1 клик!", "Print or export official document in 1 click!")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "companion_bridge") {
    return (
      <div className="guide-mockup-frame">
        <div className="guide-mockup-header">
          <span className="guide-mockup-dot red" />
          <span className="guide-mockup-dot yellow" />
          <span className="guide-mockup-dot green" />
          <span className="guide-mockup-title">{t("Мост Специалист ↔ Клиент", "Specialist ↔ Client Bridge")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-bridge-duo">
            <div className="guide-bridge-col">
              <span className="tiny muted">{t("Смартфон клиента", "Client Smartphone")}</span>
              <div className="guide-phone-mini">
                <span className="tiny">😊 😐 😔</span>
                <p className="tiny" style={{ margin: "4px 0" }}>{t("Дневник мыслей...", "Thought journal...")}</p>
              </div>
            </div>
            <div className="guide-bridge-arrow">⇄</div>
            <div className="guide-bridge-col">
              <span className="tiny muted">{t("Ваш терминал", "Your Terminal")}</span>
              <div className="guide-phone-mini">
                <span className="tiny">📊 <strong>{t("Сводка за неделю", "Weekly Summary")}</strong></span>
                <p className="tiny" style={{ margin: "4px 0" }}>{t("Тревога -30%, ДЗ выполнено", "Anxiety -30%, homework done")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // manual_form
  return (
    <div className="guide-mockup-frame">
      <div className="guide-mockup-header">
        <span className="guide-mockup-dot red" />
        <span className="guide-mockup-dot yellow" />
        <span className="guide-mockup-dot green" />
        <span className="guide-mockup-title">{t("Удобные поля ввода", "Intuitive Input Fields")}</span>
      </div>
      <div className="guide-mockup-body">
        <div className="guide-fields-stack">
          <div className="guide-field-placeholder">
            <span className="tiny muted">{isCommercial ? t("Имя клиента / псевдоним", "Client Name / Pseudonym") : t("Имя обучающегося / класс", "Student Name / Grade")}</span>
            <div className="guide-input-fake">{isCommercial ? t("Алексей И. (первичный прием)", "Alexey I. (initial session)") : t("Алексей И. (8 класс)", "Alexey I. (Grade 8)")}</div>
          </div>
          <div className="guide-field-placeholder">
            <span className="tiny muted">{t("Тема обращения / ситуация", "Request Topic / Situation")}</span>
            <div className="guide-input-fake">{isCommercial ? t("Сложности в отношениях, тревога", "Relationship difficulties, anxiety") : t("Сложности адаптации, конфликт", "Adaptation issues, conflict")}</div>
          </div>
        </div>
        <div className="guide-arrow-callout">
          <span className="guide-arrow-icon">💡</span>
          <span>{t("Заполняйте поля текстом или надиктовывайте голосом!", "Type manually or fill instantly by voice!")}</span>
        </div>
      </div>
    </div>
  );
}

export default function ModuleGuideModal(props: ModuleGuideModalProps) {
  const { moduleId, isCommercial, isOpen, onClose, onCtaClick } = props;

  const [guide, setGuide] = useState<ModuleGuideContent | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "steps">("overview");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && moduleId) {
      setGuide(getModuleGuide(moduleId, isCommercial));
      setActiveTab(moduleId === "ipr" ? "steps" : "overview");
      setActiveStepIndex(0);
      setDontShowAgain(isGuideDismissed(moduleId));
      setShowFeedback(false);
      setFeedbackText("");
      setFeedbackSubmitted(false);
      setIsRecording(false);
      setSpeechError(null);
    }
  }, [isOpen, moduleId, isCommercial]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && (window as any)._activeGuideRecognition) {
        try {
          (window as any)._activeGuideRecognition.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  if (!isOpen || !guide) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      setGuideDismissed(moduleId, true);
    }
    onClose();
  };

  const handleCta = () => {
    if (dontShowAgain) {
      setGuideDismissed(moduleId, true);
    }
    onClose();
    onCtaClick?.();
  };

  const handleToggleDontShow = (checked: boolean) => {
    setDontShowAgain(checked);
    setGuideDismissed(moduleId, checked);
  };

  const currentStep = guide.steps[activeStepIndex] ?? guide.steps[0];

  const handleToggleVoiceDictation = () => {
    if (isRecording) {
      if (typeof window !== "undefined" && (window as any)._activeGuideRecognition) {
        try {
          (window as any)._activeGuideRecognition.stop();
        } catch {
          /* ignore */
        }
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(t("Голосовой ввод не поддерживается в этом браузере. Вы можете ввести текст с клавиатуры.", "Speech input is not supported in this browser. Please type your message."));
      return;
    }

    setSpeechError(null);
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "ru-RU";

      let finalResult = feedbackText;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (e: any) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalResult += (finalResult ? " " : "") + transcript;
          } else {
            interimText += transcript;
          }
        }
        setFeedbackText(finalResult + (interimText ? " " + interimText : ""));
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error);
        if (e.error !== "no-speech") {
          setSpeechError(t("Ошибка распознавания речи. Введите текст с клавиатуры.", "Speech error. Please type text manually."));
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      (window as any)._activeGuideRecognition = recognition;
      recognition.start();
    } catch (err) {
      setSpeechError(t("Не удалось запустить микрофон.", "Failed to start microphone."));
      setIsRecording(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setIsSending(true);

    const payload = {
      moduleId,
      moduleTitle: guide.title,
      badge: guide.badge,
      activeTab,
      currentStep: activeTab === "steps" ? currentStep.title : undefined,
      url: typeof window !== "undefined" ? window.location.href : "",
      message: feedbackText.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Store in localStorage queue as resilient fallback
      try {
        const stored = JSON.parse(localStorage.getItem("terminal_guide_unclear_feedback") || "[]");
        stored.push(payload);
        localStorage.setItem("terminal_guide_unclear_feedback", JSON.stringify(stored));
      } catch {
        /* ignore localStorage quota/errors */
      }

      // 2. Try posting to Platform Support Ticket API
      const apiEndpoint = "https://api.prevention.school/api/support/ticket";
      await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "anonymous_guide_feedback",
          app_id: "terminal_help_unclear",
          category: "guide_unclear",
          message: `[Справка Непонятна: ${guide.title}] (${moduleId} / Tab: ${activeTab}) - ${feedbackText.trim()}`,
          client_meta: payload,
        }),
      }).catch(() => {
        /* fail gracefully if offline */
      });

      setFeedbackSubmitted(true);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="guide-modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="guide-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guide-modal-head">
          <div className="guide-head-meta">
            <span className="guide-badge">{guide.badge}</span>
            <h2 className="guide-modal-title">{guide.title}</h2>
          </div>
          <button
            type="button"
            className="guide-close-btn"
            onClick={handleClose}
            aria-label={t("Закрыть", "Close")}
          >
            ✕
          </button>
        </div>

        <p className="guide-lead-text">{guide.lead}</p>

        {/* Tab Navigation */}
        <div className="guide-tab-nav" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`guide-tab-btn${activeTab === "overview" ? " active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📖 {t("Как устроен раздел", "How Section Works")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "steps"}
            className={`guide-tab-btn${activeTab === "steps" ? " active" : ""}`}
            onClick={() => setActiveTab("steps")}
          >
            🗺️ {t("Пошаговая инструкция", "Step-by-Step Guide")}
          </button>
        </div>

        {/* Body Content */}
        <div className="guide-modal-body">
          {activeTab === "overview" ? (
            <div className="guide-overview-view">
              {/* Feature Cards Grid */}
              <div className="guide-overview-grid">
                {guide.overviewCards.map((card, idx) => (
                  <div key={idx} className="guide-overview-card">
                    <div className="guide-overview-card-header">
                      <span className="guide-overview-card-icon">{card.icon}</span>
                      <h4 className="guide-overview-card-title">{card.title}</h4>
                    </div>
                    <p className="guide-overview-card-desc">{card.description}</p>
                    {card.tip && <div className="guide-overview-card-tip">💡 {card.tip}</div>}
                  </div>
                ))}
              </div>

              {/* Practical Tips */}
              {guide.tips && guide.tips.length > 0 && (
                <div className="guide-tips-box">
                  <div className="guide-tips-head">
                    <span className="guide-tips-icon">💡</span>
                    <strong>{t("Полезные советы и рекомендации:", "Helpful Tips & Recommendations:")}</strong>
                  </div>
                  <ul className="guide-tips-list">
                    {guide.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="guide-steps-view">
              {/* Stepper Navigation */}
              <div className="guide-stepper-bar">
                {guide.steps.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`guide-step-pill${idx === activeStepIndex ? " active" : ""}${idx < activeStepIndex ? " done" : ""}`}
                    onClick={() => setActiveStepIndex(idx)}
                  >
                    <span className="guide-step-num">{idx + 1}</span>
                    <span className="guide-step-name">{s.title}</span>
                  </button>
                ))}
              </div>

              {/* Step Display */}
              <div className="guide-step-content-card">
                <div className="guide-step-header">
                  <h3>{currentStep.title}</h3>
                  <p className="muted">{currentStep.subtitle}</p>
                </div>

                <MockupIllustration
                  kind={currentStep.visualKind}
                  isSimulating={simulating}
                  isCommercial={isCommercial}
                  onSimulate={() => {
                    setSimulating(true);
                    setTimeout(() => setSimulating(false), 3500);
                  }}
                />

                <div className="guide-step-callout">
                  <strong>📌 {currentStep.calloutText}</strong>
                  {currentStep.checklist && currentStep.checklist.length > 0 && (
                    <ul style={{ marginTop: "10px", paddingLeft: "18px", textAlign: "left", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {currentStep.checklist.map((item, cIdx) => (
                        <li key={cIdx} style={{ fontSize: "13px", lineHeight: "1.45" }}>
                          ✓ {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="guide-step-controls">
                  <button
                    type="button"
                    className="ob-btn secondary"
                    disabled={activeStepIndex === 0}
                    onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  >
                    ← {t("Назад", "Back")}
                  </button>
                  <div className="guide-step-dots">
                    {guide.steps.map((_, idx) => (
                      <span
                        key={idx}
                        className={`guide-dot${idx === activeStepIndex ? " active" : ""}`}
                        onClick={() => setActiveStepIndex(idx)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="ob-btn"
                    onClick={() => {
                      if (activeStepIndex < guide.steps.length - 1) {
                        setActiveStepIndex((prev) => prev + 1);
                      } else {
                        handleCta();
                      }
                    }}
                  >
                    {activeStepIndex < guide.steps.length - 1
                      ? t("Далее →", "Next →")
                      : guide.ctaText}
                  </button>
                </div>
              </div>
            </div>
          )}

          {guide.faqTip && (
            <div className="guide-faq-tip">
              <p>{guide.faqTip}</p>
            </div>
          )}
          {guide.learnMoreLink && (
            <div className="guide-learn-more" style={{ textAlign: "center", marginTop: "12px", marginBottom: "16px" }}>
              <a 
                href={guide.learnMoreLink.url} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--violet, #7c3aed)",
                  fontWeight: "bold",
                  textDecoration: "none",
                  padding: "8px 16px",
                  background: "var(--violet-bg, #f5f3ff)",
                  borderRadius: "20px",
                  border: "1px dashed var(--violet, #7c3aed)"
                }}
              >
                {guide.learnMoreLink.label}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="guide-modal-foot">
          <label className="guide-dont-show-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => handleToggleDontShow(e.target.checked)}
            />
            <span>{t("Больше не показывать автоматически", "Don't show automatically again")}</span>
          </label>
          <div className="guide-foot-actions">
            <button
              type="button"
              className="ob-btn guide-unclear-btn"
              onClick={() => setShowFeedback(true)}
              title={t("Сообщить, что вызвало вопросы или сделать понятнее", "Report what was unclear or ask for clarification")}
            >
              ❓ {t("Непонятно", "Unclear")}
            </button>
            <button type="button" className="ob-btn" onClick={handleCta}>
              ✓ {t("Понятно", "Got it")}
            </button>
          </div>
        </div>

        {/* Feedback Modal Overlay */}
        {showFeedback && (
          <div className="guide-feedback-backdrop" onClick={() => setShowFeedback(false)}>
            <div className="guide-feedback-card" onClick={(e) => e.stopPropagation()}>
              <div className="guide-feedback-head">
                <h3>💬 {t("Обратная связь по справке", "Help Feedback")}</h3>
                <button
                  type="button"
                  className="guide-close-btn"
                  onClick={() => setShowFeedback(false)}
                >
                  ✕
                </button>
              </div>

              {!feedbackSubmitted ? (
                <div className="guide-feedback-body">
                  {/* Context preview */}
                  <div className="guide-context-badge-box">
                    <span className="tiny muted">{t("Контекст вопроса:", "Question Context:")}</span>
                    <div className="guide-context-chips">
                      <span className="guide-badge-pill green">📍 {guide.title}</span>
                      {activeTab === "steps" && (
                        <span className="guide-badge-pill blue">📌 {currentStep.title}</span>
                      )}
                    </div>
                  </div>

                  {/* Main User Instruction */}
                  <div className="guide-feedback-instruction">
                    <p className="guide-instruction-primary">
                      {t(
                        "Опишите или надиктуйте, что вызывает вопросы.",
                        "Describe or dictate what causes questions."
                      )}
                    </p>
                    <p className="guide-instruction-secondary">
                      {t(
                        "Для нас важна эта информация, сделаем интерфейс понятным для всех, и ваш вклад — это очень важно!",
                        "This information is essential for us. We want to make the interface clear for everyone, and your contribution is very important!"
                      )}
                    </p>
                  </div>

                  {/* Voice Dictation Button */}
                  <div className="guide-dictation-bar">
                    <button
                      type="button"
                      className={`guide-voice-dict-btn${isRecording ? " recording" : ""}`}
                      onClick={handleToggleVoiceDictation}
                    >
                      <span className="guide-mic-icon">🎙️</span>
                      <span>
                        {isRecording
                          ? t("Идет запись... Нажмите, чтобы остановить", "Recording... Click to stop")
                          : t("Надиктовать голосом", "Dictate by voice")}
                      </span>
                    </button>
                    {isRecording && (
                      <div className="guide-recording-pulse-ring">
                        <span className="pulse-dot" />
                      </div>
                    )}
                  </div>

                  {speechError && <div className="guide-speech-error">{speechError}</div>}

                  {/* Textarea */}
                  <textarea
                    className="guide-feedback-textarea"
                    rows={4}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={t(
                      "Опишите подробнее, какой момент или фраза показались сложными...",
                      "Describe in detail which point or phrasing seemed confusing..."
                    )}
                  />

                  <div className="guide-feedback-foot-actions">
                    <button
                      type="button"
                      className="ob-btn secondary"
                      onClick={() => setShowFeedback(false)}
                      disabled={isSending}
                    >
                      {t("Отмена", "Cancel")}
                    </button>
                    <button
                      type="button"
                      className="ob-btn"
                      onClick={() => void handleSendFeedback()}
                      disabled={isSending || !feedbackText.trim()}
                    >
                      {isSending
                        ? t("Отправка...", "Sending...")
                        : t("Отправить отзыв 🚀", "Submit Feedback 🚀")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="guide-feedback-success">
                  <div className="success-icon">🎉</div>
                  <h4>{t("Спасибо за ваш вклад!", "Thank you for your contribution!")}</h4>
                  <p>
                    {t(
                      "Мы получили ваш отзыв и обязательно сделаем этот раздел более понятным для всех пользователей.",
                      "We received your feedback and will make this section clearer for all users."
                    )}
                  </p>
                  <button
                    type="button"
                    className="ob-btn"
                    onClick={() => {
                      setShowFeedback(false);
                      handleClose();
                    }}
                  >
                    {t("Отлично", "Great")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
