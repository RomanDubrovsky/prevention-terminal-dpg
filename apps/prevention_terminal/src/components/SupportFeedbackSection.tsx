import { t } from "../lib/i18n.ts";
import { useState, type FormEvent } from "react";

import { terminalAppTitle } from "../lib/terminal_branding.ts";
import { PLATFORM_API_CANONICAL } from "../lib/platform_api.ts";
import { getTerminalProductConfig } from "../lib/terminal_product.ts";

function getSupportCategories() {
  return [
    { id: "technical_error", label: t("🐞 Техническая ошибка", "🐞 Technical Bug") },
    { id: "ai_question", label: t("🧠 Вопрос по работе ИИ", "🧠 AI Model Question") },
    { id: "product_idea", label: t("💡 Предложение по развитию", "💡 Feature Suggestion") },
    { id: "safety_report", label: t("🛡️ Сообщить о неприемлемом контенте", "🛡️ Safety / Inappropriate Content") },
  ] as const;
}

type SupportCategory = "technical_error" | "ai_question" | "product_idea" | "safety_report";

interface SupportFeedbackSectionProps {
  terminalUserId?: string;
}

export default function SupportFeedbackSection(props: SupportFeedbackSectionProps) {
  const { terminalUserId } = props;
  const [category, setCategory] = useState<SupportCategory>("technical_error");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appId = `terminal_${getTerminalProductConfig().consumer_app || "platform"}`;
  const appLabel = terminalAppTitle();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 10) {
      setError(t("Напишите чуть подробнее — от 10 символов.", "Please provide a bit more detail (at least 10 characters)."));
      return;
    }
    const effectiveUserId =
      terminalUserId?.trim() ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("terminal_user_id") || "academy_creator"
        : "academy_creator");

    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${PLATFORM_API_CANONICAL}/api/support/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: effectiveUserId,
          app_id: appId,
          category,
          message: `[${appLabel}] ${text}`,
          client_meta: {
            terminal_product: getTerminalProductConfig().title_ru,
            userAgent: navigator.userAgent || "",
            language: navigator.language || "",
            viewport: { w: window.innerWidth, h: window.innerHeight },
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setMessage("");
      setOk(t("Спасибо! Мы получили сообщение и ответим в ближайшее время.", "Thank you! We received your feedback and will respond shortly."));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось отправить. Проверьте сеть или напишите на support@prevention.school.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="support-feedback-section">
      <h3>{t("Обратная связь", "Feedback & Support")}</h3>
      <p className="muted tiny">
        Сообщения об ошибках и предложения по развитию. В заявке будет указано приложение:{" "}
        <strong>{appLabel}</strong>.
      </p>
      <form className="support-feedback-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          <span>{t("Тема", "Topic")}</span>
          <select value={category} disabled={busy} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
            {getSupportCategories().map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>{t("Сообщение", "Message")}</span>
          <textarea
            rows={5}
            value={message}
            disabled={busy}
            placeholder="Опишите, что произошло или что хотели бы предложить."
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {ok && <p className="ok">{ok}</p>}
        <button type="submit" className="ob-btn" disabled={busy}>
          {busy ? "Отправляем…" : "Отправить"}
        </button>
      </form>
      <div className="muted tiny" style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--line, #e2e8f0)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <span>Платформа:</span>
        <a href="https://prevention.school/ru/science" target="_blank" rel="noopener noreferrer">
          Научная база
        </a>
        <span>·</span>
        <a href="https://ida-psy.pro/ru/founder/" target="_blank" rel="noopener noreferrer">
          Автор проекта
        </a>
        <span>·</span>
        <a href="https://t.me/ida_support_psy_bot" target="_blank" rel="noopener noreferrer">
          Telegram @ida_support_psy_bot
        </a>
        <span>·</span>
        <a href="mailto:admin@ida-psy.pro">admin@ida-psy.pro</a>
      </div>
    </div>
  );
}
