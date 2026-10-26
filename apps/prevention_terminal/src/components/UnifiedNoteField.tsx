import React, { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n.ts";
import SpeechDictationButton from "./SpeechDictationButton.tsx";

export interface UnifiedNoteFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onDictate: (chunk: string) => void;
  onAiProcess?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  showAiButton?: boolean;
  onAiButtonBlocked?: () => void;
  className?: string;
}

export function UnifiedNoteField({
  label,
  hint,
  value,
  onChange,
  onDictate,
  onAiProcess,
  disabled = false,
  highlighted = false,
  showAiButton = false,
  onAiButtonBlocked,
  className = "",
}: UnifiedNoteFieldProps) {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const typingTimer = useRef<number | null>(null);

  const handleAiAction = () => {
    setShowSuggestion(false);
    if (showAiButton && onAiProcess) {
      onAiProcess();
    } else if (!showAiButton && onAiButtonBlocked) {
      onAiButtonBlocked();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (showSuggestion) {
      setShowSuggestion(false);
    }

    if (typingTimer.current !== null) {
      clearTimeout(typingTimer.current);
    }

    if (newValue.length >= 50) {
      typingTimer.current = window.setTimeout(() => {
        setShowSuggestion(true);
      }, 8000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimer.current !== null) {
        clearTimeout(typingTimer.current);
      }
    };
  }, []);

  return (
    <div 
      className={className} 
      style={{
        marginBottom: '20px',
        backgroundColor: highlighted ? 'rgba(45, 212, 191, 0.04)' : 'rgba(248,250,252,0.6)',
        padding: '16px',
        border: highlighted ? '1.5px solid #2dd4bf' : '1px solid var(--line)',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: '2px' }}>
          {hint}
        </div>
      )}
      
      <textarea
        value={value}
        onChange={handleChange}
        disabled={disabled}
        rows={5}
        style={{
          width: '100%',
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '12px',
          marginTop: '12px',
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box'
        }}
        placeholder={t("Введите текст...", "Enter text...")}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px', gap: '12px' }}>
        <SpeechDictationButton onText={onDictate} disabled={disabled} />
        
        {value.length >= 30 && (
          <button
            onClick={handleAiAction}
            disabled={disabled}
            style={{
              fontSize: '0.85em',
              backgroundColor: 'transparent',
              border: '1px solid #8b5cf6',
              color: '#8b5cf6',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
          >
            {t("✨ Обработать с ИИ", "✨ Process with AI")}
          </button>
        )}
      </div>

      <div 
        style={{
          opacity: showSuggestion ? 1 : 0,
          maxHeight: showSuggestion ? '40px' : '0px',
          overflow: 'hidden',
          transition: 'opacity 300ms ease, max-height 300ms ease',
          marginTop: showSuggestion ? '8px' : '0',
        }}
      >
        <button
          onClick={handleAiAction}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '0.9em',
            backgroundColor: '#f3e8ff',
            border: 'none',
            color: '#7e22ce',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          {t("✨ Структурировать заметки", "✨ Structure notes")}
        </button>
      </div>
    </div>
  );
}
