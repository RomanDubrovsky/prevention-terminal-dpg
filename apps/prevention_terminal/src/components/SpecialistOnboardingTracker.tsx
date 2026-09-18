import { useState } from "react";
import { t } from "../lib/i18n.ts";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";

interface SpecialistOnboardingTrackerProps {
  commercial: boolean;
  hasSubjects: boolean;
  hasConsultations: boolean;
  hasExport?: boolean;
  onNavigate?: (view: SpecialistWorkspaceView) => void;
  onOpenGuide: () => void;
}

export default function SpecialistOnboardingTracker(props: SpecialistOnboardingTrackerProps) {
  const {
    commercial,
    hasSubjects,
    hasConsultations,
    hasExport = false,
    onNavigate,
    onOpenGuide,
  } = props;

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("terminal_onboarding_tracker_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const step1Done = hasSubjects;
  const step2Done = hasConsultations;
  const step3Done = hasExport || hasConsultations;

  const completedCount = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);
  const progressPercent = Math.round((completedCount / 3) * 100);

  const toggleDismissed = (next: boolean) => {
    setDismissed(next);
    try {
      localStorage.setItem("terminal_onboarding_tracker_dismissed", String(next));
    } catch {}
  };

  if (dismissed) {
    return (
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569" }}>
          <span>🚀</span>
          <strong>{t("Первые шаги специалиста", "Specialist First Steps")}:</strong>
          <span>{completedCount}/3 {t("выполнено", "completed")}</span>
          <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600 }}>({progressPercent}%)</span>
        </div>
        <button
          type="button"
          className="ob-btn secondary tiny"
          onClick={() => toggleDismissed(false)}
        >
          {t("Развернуть трекер", "Show Tracker")}
        </button>
      </div>
    );
  }

  return (
    <section className="card specialist-onboarding-tracker" aria-label={t("Онбординг трекер", "Onboarding Tracker")}>
      <div className="onboarding-tracker-head">
        <div>
          <div className="onboarding-tracker-title-row">
            <h3 className="onboarding-tracker-title">
              🚀 {commercial ? t("Быстрый старт: кабинет частной практики", "Quick Start: Private Practice") : t("Быстрый старт: рабочее место специалиста", "Quick Start: Specialist Workspace")}
            </h3>
            <span className="onboarding-tracker-badge">
              {progressPercent === 100 ? t("✅ Завершено 100%", "✅ Completed 100%") : `${progressPercent}% ${t("готовности", "ready")}`}
            </span>
          </div>
          <p className="onboarding-tracker-sub">
            {progressPercent === 100
              ? t("🎉 Поздравляем! Вы освоили базовый цикл работы без рутины. Все дальнейшие записи автоматически пополняют аналитику и годовой отчет.", "🎉 Congratulations! You have mastered the core workflow without routine. All further notes auto-fill your analytics.")
              : t("Выполните 3 простых шага, чтобы запустить систему на полную мощность и навсегда забыть о ручной бумажной отчетности.", "Complete 3 simple steps to launch your workspace and forget manual paper reporting forever.")
            }
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="ob-btn secondary tiny"
            style={{ fontSize: "12px" }}
            onClick={() => toggleDismissed(true)}
            title={t("Свернуть подсказки", "Collapse tracker")}
          >
            {t("Свернуть", "Collapse")}
          </button>
        </div>
      </div>

      <div className="onboarding-progress-bar-wrap" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="onboarding-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="onboarding-steps-grid">
        {/* Step 1 */}
        <div className={`onboarding-step-card${step1Done ? " completed" : ""}`}>
          <div>
            <div className="onboarding-step-top">
              <span className="onboarding-step-status" aria-hidden="true">
                {step1Done ? "✓" : "1"}
              </span>
              <div className="onboarding-step-info">
                <h4>
                  {commercial
                    ? t("1. Завести первого клиента", "1. Add First Client")
                    : t("1. Завести обучающегося", "1. Add First Student")
                  }
                </h4>
                <p>
                  {commercial
                    ? t("Добавьте карточку вручную или загрузите файл клиентов из Excel за 10 секунд.", "Add client card manually or import Excel list in 10s.")
                    : t("Добавьте ученика в реестр школы или импортируйте списки классов из Excel.", "Add student to school registry or import class lists from Excel.")
                  }
                </p>
              </div>
            </div>
          </div>
          <div className="onboarding-step-action-row">
            <span className="muted tiny">
              {step1Done ? t("✅ Заведено", "✅ Done") : t("~1 минута", "~1 min")}
            </span>
            <button
              type="button"
              className={`ob-btn tiny${step1Done ? " secondary" : ""}`}
              onClick={() => onNavigate?.("registry")}
            >
              {step1Done
                ? (commercial ? t("В картотеку", "To Clients") : t("В реестр", "To Students"))
                : (commercial ? t("👥 Добавить клиента", "👥 Add Client") : t("👥 Добавить обучающегося", "👥 Add Student"))
              }
            </button>
          </div>
        </div>

        {/* Step 2 */}
        <div className={`onboarding-step-card${step2Done ? " completed" : ""}`}>
          <div>
            <div className="onboarding-step-top">
              <span className="onboarding-step-status" aria-hidden="true">
                {step2Done ? "✓" : "2"}
              </span>
              <div className="onboarding-step-info">
                <h4>{t("2. Надиктовать аудио-заметку 🎙️", "2. Dictate Voice Note 🎙️")}</h4>
                <p>
                  {t(
                    "Нажмите микрофон на консультации и говорите обычным языком: ИИ за 30 секунд создаст чистовой протокол.",
                    "Click mic during session and speak naturally: AI generates clean protocol in 30 seconds."
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="onboarding-step-action-row">
            <span className="muted tiny">
              {step2Done ? t("✅ Записано", "✅ Recorded") : t("Экономия 15 мин", "Saves 15 min")}
            </span>
            <button
              type="button"
              className={`ob-btn tiny${step2Done ? " secondary" : ""}`}
              onClick={() => onNavigate?.("consultations")}
            >
              {step2Done ? t("В консультации", "To Sessions") : t("💬 Начать прием с микрофоном", "💬 Start with Mic")}
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className={`onboarding-step-card${step3Done ? " completed" : ""}`}>
          <div>
            <div className="onboarding-step-top">
              <span className="onboarding-step-status" aria-hidden="true">
                {step3Done ? "✓" : "3"}
              </span>
              <div className="onboarding-step-info">
                <h4>{t("3. Скачать протокол DOCX", "3. Export DOCX Protocol")}</h4>
                <p>
                  {t(
                    "Готовый официальный документ для личного дела, руководства или родителей формируется в 1 клик.",
                    "Official ready-to-print document for case record, management or parents generated in 1 click."
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="onboarding-step-action-row">
            <span className="muted tiny">
              {step3Done ? t("✅ Готово", "✅ Ready") : t("1 клик", "1 click")}
            </span>
            <button
              type="button"
              className={`ob-btn tiny${step3Done ? " secondary" : ""}`}
              onClick={() => onNavigate?.("consultations")}
            >
              {t("📄 Протокол визита", "📄 Session Protocol")}
            </button>
          </div>
        </div>
      </div>

      <div className="onboarding-mode-contrast">
        <div>
          <span>🛡️ <strong>{t("Бесплатный режим:", "Free Mode:")}</strong> {t("безлимитный ручной ввод всех полей, локальное шифрование, печать бланков. Всегда бесплатно.", "unlimited manual input, local encryption, printing. Always free.")}</span>
          <span style={{ margin: "0 8px", color: "#cbd5e1" }}>|</span>
          <span>⚡ <strong>{t("Режим ИИ:", "AI Mode:")}</strong> {t("надиктуйте 30 секунд голосом — экономит до 90% времени на писанине.", "dictate 30s by voice — saves up to 90% writing time.")}</span>
        </div>
        <button
          type="button"
          className="header-guide-btn"
          style={{ fontSize: "12px", padding: "5px 10px" }}
          onClick={onOpenGuide}
        >
          💡 {t("Смотреть сравнение Вручную vs ИИ", "View Manual vs AI Comparison")}
        </button>
      </div>
    </section>
  );
}
