import React, { useState } from "react";
import { t } from "../lib/i18n.ts";
import type { ExportSupervisionResult } from "../lib/case_supervision.ts";

interface SupervisionShareModalProps {
  data: ExportSupervisionResult | null;
  onClose: () => void;
}

export const SupervisionShareModal: React.FC<SupervisionShareModalProps> = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-window"
        style={{
          maxWidth: "580px",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "0.75rem",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🔗</span> {t("Обезличенный токен для супервизии", "Anonymous Supervision Token")}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
              {t("Экспорт клинического контекста для коллегиального разбора", "Export clinical context for peer supervision")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              lineHeight: 1,
              cursor: "pointer",
              color: "#9ca3af",
              padding: "4px",
            }}
          >
            &times;
          </button>
        </div>

        {/* Info Block / Explanation */}
        <div
          style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "12px 14px",
            fontSize: "0.85rem",
            color: "#166534",
            lineHeight: "1.5",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            💡 {t("Как это работает и зачем нужен токен:", "How it works & purpose:")}
          </div>
          <ul style={{ margin: "4px 0 0 0", paddingLeft: "1.2rem" }}>
            <li>
              <strong>{t("Что внутри:", "Contents:")}</strong> {t("Хронология очных встреч, заметки видео-сессий, гипотезы и динамика случая.", "Timeline of in-person visits, video session notes, hypotheses & dynamics.")}
            </li>
            <li>
              <strong>{t("Конфиденциальность:", "Privacy:")}</strong> {t("ФИО, контакты и персональные данные полностью исключены (152-ФЗ / этический кодекс).", "PII, names & contacts are completely stripped (ethics & privacy).")}
            </li>
            <li>
              <strong>{t("Как использовать:", "How to use:")}</strong> {t("Скопируйте токен и передайте коллеге-супервизору. Супервизор открывает раздел «ИИ-Помощник» → режим «Супервизия» → «Вставить токен» для разбора случая.", "Copy token & share with peer supervisor. Supervisor opens 'AI Assistant' → 'Supervision' → 'Paste token' to analyze the case.")}
            </li>
          </ul>
        </div>

        {/* Content Status Warning / Success */}
        {data.hasContent ? (
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "0.8rem",
              color: "#1e40af",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>✓</span>
            <span>
              {t(
                `В токен успешно упакован клинический контекст дела (${data.contextLength} симв.)`,
                `Case clinical context successfully packed (${data.contextLength} chars)`
              )}
            </span>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: "6px",
              padding: "10px 12px",
              fontSize: "0.82rem",
              color: "#854d0e",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>⚠️</span>
            <div>
              <strong>{t("Внимание: в деле пока мало данных!", "Warning: case has minimal data!")}</strong>
              <div style={{ marginTop: "2px", fontSize: "0.78rem" }}>
                {t(
                  "В карточке ещё нет заполненных протоколов визитов или заметок. Токен сформирован, но супервизору будет передана пустая структура. Рекомендуется сначала внести хотя бы одну консультацию.",
                  "No completed visit protocols or notes yet. Token was generated, but contains empty structure. We recommend adding at least one consultation record first."
                )}
              </div>
            </div>
          </div>
        )}

        {/* Token Textarea */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", color: "#374151", marginBottom: "4px" }}>
            {t("Зашифрованный токен кейса:", "Encrypted case token:")}
          </label>
          <textarea
            readOnly
            rows={5}
            value={data.token}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            style={{
              width: "100%",
              fontSize: "0.78rem",
              fontFamily: "monospace",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "#f9fafb",
              color: "#111827",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "9px 18px",
              backgroundColor: copied ? "#059669" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "background-color 0.2s",
            }}
          >
            <span>{copied ? "✓" : "📋"}</span>
            <span>{copied ? t("Скопировано в буфер!", "Copied to clipboard!") : t("Скопировать токен", "Copy token")}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="ob-btn secondary"
            style={{
              padding: "8px 16px",
              backgroundColor: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {t("Закрыть", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
};
