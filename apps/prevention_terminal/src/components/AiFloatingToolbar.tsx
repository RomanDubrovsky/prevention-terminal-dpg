import React from 'react';
import { t } from '../lib/i18n.ts';

export interface AiFloatingToolbarProps {
  subscriptionActive: boolean;
  onFillCard: () => void;
  onGenerateReport: () => void;
  onBriefing: () => void;
  onSupervision: () => void;
  onChat: () => void;
  onPaywall: () => void;
  isBusy?: boolean;
  hasVisitHistory?: boolean;
  className?: string;
}

export default function AiFloatingToolbar({
  subscriptionActive,
  onFillCard,
  onGenerateReport,
  onBriefing,
  onSupervision,
  onChat,
  onPaywall,
  isBusy = false,
  hasVisitHistory = false,
  className = '',
}: AiFloatingToolbarProps) {
  
  const handleAction = (action: () => void) => {
    if (isBusy) return;
    if (subscriptionActive) {
      action();
    } else {
      onPaywall();
    }
  };

  const buttons = [
    {
      label: t("Заполнить карточку", "Fill card"),
      icon: "✨",
      action: onFillCard,
      visible: true,
    },
    {
      label: t("Отчёт", "Report"),
      icon: "📋",
      action: onGenerateReport,
      visible: true,
    },
    {
      label: t("Брифинг", "Briefing"),
      icon: "🧠",
      action: onBriefing,
      visible: hasVisitHistory,
    },
    {
      label: t("Супервизия", "Supervision"),
      icon: "📊",
      action: onSupervision,
      visible: true,
    },
    {
      label: t("Чат", "Chat"),
      icon: "💬",
      action: onChat,
      visible: true,
    },
  ];

  return (
    <div 
      className={className}
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 50,
        backdropFilter: 'blur(12px)',
        background: 'rgba(255, 255, 255, 0.85)',
        borderTop: '1px solid var(--line, #e2e8f0)',
        padding: '8px 16px',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
        {t("ИИ-инструменты", "AI Tools")}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', flex: 1 }}>
        {buttons.filter(b => b.visible).map((btn, idx) => (
          <button
            key={idx}
            onClick={() => handleAction(btn.action)}
            disabled={isBusy}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid var(--line, #e2e8f0)',
              background: '#fff',
              fontSize: '0.82rem',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              opacity: isBusy ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isBusy) e.currentTarget.style.background = '#f8fafc';
            }}
            onMouseOut={(e) => {
              if (!isBusy) e.currentTarget.style.background = '#fff';
            }}
          >
            <span>{btn.icon}</span>
            <span>{isBusy ? t("Загрузка...", "Loading...") : btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
