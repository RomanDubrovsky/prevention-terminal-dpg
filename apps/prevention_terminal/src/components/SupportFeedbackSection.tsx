import { useState, type FormEvent } from "react";

import { terminalAppTitle } from "../lib/terminal_branding.ts";
import { PLATFORM_API_CANONICAL } from "../lib/platform_api.ts";
import { getTerminalProductConfig } from "../lib/terminal_product.ts";

const SUPPORT_CATEGORIES = [
  { id: "technical_error", label: "🐞 Техническая ошибка" },
  { id: "ai_question", label: "🧠 Вопрос по работе ИИ" },
  { id: "product_idea", label: "💡 Предложение по развитию" },
  { id: "safety_report", label: "🛡️ Сообщить о неприемлемом контенте" },
] as const;

type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"];

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
      setError("Напишите чуть подробнее — от 10 символов.");
      return;
    }
    if (!terminalUserId?.trim()) {
      setError("Не удалось определить идентификатор установки.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${PLATFORM_API_CANONICAL}/api/support/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: terminalUserId,
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
      setOk("Спасибо! Мы получили сообщение и ответим в ближайшее время.");
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
      <h3>Обратная связь</h3>
      <p className="muted tiny">
        Сообщения об ошибках и предложения по развитию. В заявке будет указано приложение:{" "}
        <strong>{appLabel}</strong>.
      </p>
      <form className="support-feedback-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          <span>Тема</span>
          <select value={category} disabled={busy} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
            {SUPPORT_CATEGORIES.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          <span>Сообщение</span>
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
      <p className="muted tiny">
        Или напишите напрямую:{" "}
        <a href="https://t.me/ida_support_psy_bot" target="_blank" rel="noopener noreferrer">
          Telegram @ida_support_psy_bot
        </a>
        {" · "}
        <a href="mailto:Roman.Dubrovsky@gmail.com">Roman.Dubrovsky@gmail.com</a>
      </p>
    </div>
  );
}
