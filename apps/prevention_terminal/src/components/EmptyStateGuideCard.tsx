import { t } from "../lib/i18n.ts";

interface EmptyStateGuideCardProps {
  title: string;
  description: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onOpenGuide: () => void;
  isCommercial?: boolean;
  aiHint?: string;
  icon?: string;
}

export default function EmptyStateGuideCard(props: EmptyStateGuideCardProps) {
  const {
    title,
    description,
    primaryActionLabel,
    onPrimaryAction,
    onOpenGuide,
    isCommercial = false,
    aiHint,
    icon = "🌱",
  } = props;

  return (
    <div className="empty-state-guide-card">
      <div className="empty-state-guide-icon">{icon}</div>
      <div className="empty-state-guide-content">
        <h3 className="empty-state-guide-title">{title}</h3>
        <p className="empty-state-guide-desc">{description}</p>
        
        <div className="empty-state-guide-benefit">
          <span className="benefit-badge">⚡ {t("Суперсила ИИ", "AI Superpower")}</span>
          <span className="benefit-text">
            {aiHint ||
              (isCommercial
                ? t(
                    "Надиктуйте заметки после сессии голосом за 30 секунд — ИИ сам выделит динамику и составит протокол.",
                    "Dictate post-session notes in 30 seconds — AI structures dynamics and prepares protocol."
                  )
                : t(
                    "Надиктуйте инцидент или беседу своими словами — ИИ сам расставит уровни риска и сформирует протокол по ФГОС.",
                    "Dictate incident or interview in your words — AI marks risk tiers and formats standard protocol."
                  ))}
          </span>
        </div>

        <div className="empty-state-guide-actions">
          <button type="button" className="ob-btn" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </button>
          <button
            type="button"
            className="ob-btn secondary empty-state-guide-btn"
            onClick={onOpenGuide}
          >
            💡 {t("Как это работает: Вручную vs с ИИ", "How it works: Manual vs AI")}
          </button>
        </div>
      </div>
    </div>
  );
}
