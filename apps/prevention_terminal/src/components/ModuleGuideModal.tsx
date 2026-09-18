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
          <span className="guide-mockup-title">{t("Ввод данных: микрофон 🎙️", "Data Input: Microphone 🎙️")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-mockup-input-box">
            <p className="guide-mockup-text-preview">
              {isSimulating
                ? t(
                    "«...подросток жалуется на давление в классе, пропуски по вторникам, мама на собрания не приходит...»",
                    "'...teenager complains about peer pressure, missing Tuesdays, mother doesn't attend meetings...'"
                  )
                : t("Нажмите микрофон и надиктуйте голосом...", "Click the mic and speak...")}
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
              <span className="guide-mic-timer">{isSimulating ? "00:18 ⏺" : "00:00"}</span>
            </div>
          </div>
          <div className="guide-arrow-callout">
            <span className="guide-arrow-icon">➡️</span>
            <span>{t("Свободная речь: не нужно думать о канцелярите!", "Natural speech: no need for formal jargon!")}</span>
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
          <span className="guide-mockup-title">{t("ИИ-структурирование за 3 секунды", "AI Structuring in 3 Seconds")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-ai-result-grid">
            <div className="guide-tag-row">
              <span className="guide-badge-pill green">✓ {t("Уровень: Селективная", "Tier: Selective")}</span>
              <span className="guide-badge-pill violet">✓ {t("Метод: Беседа + ОРКТ", "Method: Interview + SFBT")}</span>
              <span className="guide-badge-pill blue">✓ {t("ФГОС / Протокол", "Standard / Protocol")}</span>
            </div>
            <div className="guide-card-snippet">
              <strong>{t("Сформированная гипотеза:", "Formulated Hypothesis:")}</strong>
              <p className="tiny muted">
                {t(
                  "Реакция социальной дезадаптации средней тяжести. Рекомендован контакт со школьной службой медиации.",
                  "Moderate social maladaptation reaction. Mediation service contact recommended."
                )}
              </p>
            </div>
          </div>
          <div className="guide-arrow-callout ok">
            <span className="guide-arrow-icon">🪄</span>
            <span>{t("ИИ автоматически заполнил все поля и подобрал рекомендации!", "AI auto-filled all fields and matched advice!")}</span>
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
          <span className="guide-mockup-title">{t("Готовый документ и отчет", "Ready Document and Report")}</span>
        </div>
        <div className="guide-mockup-body">
          <div className="guide-docx-box">
            <div className="guide-docx-doc-icon">📄</div>
            <div>
              <div className="guide-docx-name">{t("Протокол_сопровождения.docx", "Support_Protocol.docx")}</div>
              <div className="tiny muted">{t("Зашифровано локально (SQLCipher) · Готово к печати", "Locally encrypted · Ready to print")}</div>
            </div>
            <span className="guide-badge-pill green">{t("100% ГОСТ / ФГОС", "100% Standard")}</span>
          </div>
          <div className="guide-arrow-callout">
            <span className="guide-arrow-icon">⬇️</span>
            <span>{t("Печать или экспорт без ручного набора текста!", "Print or export without manual typing!")}</span>
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
                <span className="tiny">📊 <strong>{t("ИИ-выжимка недели", "AI Weekly Brief")}</strong></span>
                <p className="tiny" style={{ margin: "4px 0" }}>{t("Тревога -30%, триггер найден", "Anxiety -30%, trigger found")}</p>
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
        <span className="guide-mockup-title">{t("Привычные поля ввода", "Standard Input Fields")}</span>
      </div>
      <div className="guide-mockup-body">
        <div className="guide-fields-stack">
          <div className="guide-field-placeholder">
            <span className="tiny muted">{isCommercial ? t("Имя клиента / псевдоним", "Client Name / Pseudonym") : t("Имя обучающегося / класс", "Student Name / Grade")}</span>
            <div className="guide-input-fake">{isCommercial ? t("Алексей И. (первичный прием)", "Alexey I. (initial session)") : t("Алексей И. (8 класс)", "Alexey I. (Grade 8)")}</div>
          </div>
          <div className="guide-field-placeholder">
            <span className="tiny muted">{t("Тема обращения / ситуация", "Request Topic / Situation")}</span>
            <div className="guide-input-fake">{t("Сложности адаптации, конфликт", "Adaptation issues, conflict")}</div>
          </div>
        </div>
        <div className="guide-arrow-callout">
          <span className="guide-arrow-icon">💡</span>
          <span>{t("Можно заполнять руками или мгновенно голосом!", "Type manually or fill instantly by voice!")}</span>
        </div>
      </div>
    </div>
  );
}

export default function ModuleGuideModal(props: ModuleGuideModalProps) {
  const { moduleId, isCommercial, isOpen, onClose, onCtaClick } = props;

  const [guide, setGuide] = useState<ModuleGuideContent | null>(null);
  const [activeTab, setActiveTab] = useState<"compare" | "steps">("compare");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (isOpen && moduleId) {
      setGuide(getModuleGuide(moduleId, isCommercial));
      setActiveStepIndex(0);
      setDontShowAgain(isGuideDismissed(moduleId));
    }
  }, [isOpen, moduleId, isCommercial]);

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
            aria-selected={activeTab === "compare"}
            className={`guide-tab-btn${activeTab === "compare" ? " active" : ""}`}
            onClick={() => setActiveTab("compare")}
          >
            ⚡ {t("Сравнить: Вручную vs с ИИ", "Compare: Manual vs with AI")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "steps"}
            className={`guide-tab-btn${activeTab === "steps" ? " active" : ""}`}
            onClick={() => setActiveTab("steps")}
          >
            🗺️ {t("Маршрут по шагам 1-2-3", "Step-by-Step Route 1-2-3")}
          </button>
        </div>

        {/* Body Content */}
        <div className="guide-modal-body">
          {activeTab === "compare" ? (
            <div className="guide-compare-view">
              {/* Traditional Side */}
              <div className="guide-compare-card traditional">
                <div className="guide-compare-card-head">
                  <span className="guide-compare-icon">📝</span>
                  <div>
                    <h4>{guide.traditional.title}</h4>
                    <span className="guide-duration-tag danger">⏳ {guide.traditional.durationLabel}</span>
                  </div>
                </div>
                <p className="guide-compare-desc">{guide.traditional.description}</p>
                <ul className="guide-compare-list">
                  {guide.traditional.steps.map((s, idx) => (
                    <li key={idx}>
                      <span className="bullet">✕</span> {s}
                    </li>
                  ))}
                </ul>
                <div className="guide-compare-pros">
                  <small className="muted">{guide.traditional.pros}</small>
                </div>
              </div>

              {/* AI Boost Side */}
              <div className="guide-compare-card ai-boost">
                <div className="guide-compare-card-head">
                  <span className="guide-compare-icon">🪄</span>
                  <div>
                    <h4>{guide.aiBoost.title}</h4>
                    <div className="guide-boost-badges">
                      <span className="guide-duration-tag success">⚡ {guide.aiBoost.durationLabel}</span>
                      <span className="guide-savings-badge">
                        {t(`Экономия ${guide.aiBoost.savingsPercent}% времени`, `Saves ${guide.aiBoost.savingsPercent}% time`)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="guide-compare-desc">{guide.aiBoost.description}</p>
                <ul className="guide-compare-list">
                  {guide.aiBoost.steps.map((s, idx) => (
                    <li key={idx}>
                      <span className="bullet ok">✓</span> <strong>{s}</strong>
                    </li>
                  ))}
                </ul>
                <div className="guide-compare-wow">
                  <strong>💡 {guide.aiBoost.wowEffect}</strong>
                </div>
              </div>
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
            <button type="button" className="ob-btn secondary" onClick={handleClose}>
              {t("Закрыть", "Close")}
            </button>
            <button type="button" className="ob-btn" onClick={handleCta}>
              {guide.ctaText} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
