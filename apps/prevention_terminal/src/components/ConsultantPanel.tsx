import { useEffect, useMemo, useRef, useState } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";
import { t } from "../lib/i18n.ts";
import { FormattedMarkdown } from "./FormattedMarkdown.tsx";
import { importAnonymousCaseBrief } from "../lib/case_supervision.ts";

import {
  CONSULTANT_SUB_OPTIONS,
  resetTerminalAiSession,
  sendAiTurn,
  type ConsultantSub,
} from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

interface ConsultantPanelProps {
  documentContext?: string;
  terminalUserId?: string;
  caseId?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  sub?: ConsultantSub;
  error?: boolean;
}

const STORAGE_PREFIX = "terminal_consultant_chat_";

function loadSavedMessages(key: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(key: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(messages.slice(-50)));
  } catch {
    /* ignore localStorage errors */
  }
}

const MODE_INTROS: Record<ConsultantSub, string> = {
  case: t(
    "Разберём конкретную ситуацию: что происходит, какие шаги попробовать, на что обратить внимание. Это не запись визита — протокол консультации ведёте в журнале.",
    "Let's analyze a specific situation: what is happening, what steps to try, what to pay attention to. This is not a visit record — you keep the consultation protocol in the journal."
  ),
  supervision: t(
    "Поговорим о вашей работе со случаем: слепые зоны, этика, гипотезы. Не заменяет живую супервизию.",
    "Let's talk about your work with the case: blind spots, ethics, hypotheses. Does not replace live supervision."
  ),
  theory: t(
    "Справочник и методика: алгоритмы, опоры из базы знаний, без разбора персональных данных клиента.",
    "Reference and methodology: algorithms, knowledge base supports, without analyzing the client's personal data."
  ),
  mnemonics: t(
    "Модуль ИИ-Мнемоники: быстрое запоминание понятий, ассоциации, мнемотехники и карточки знаний по профилактике.",
    "AI Mnemonics Module: quick memorization of concepts, associations, mnemonics and prevention knowledge cards."
  ),
  educator: t("Режим педагога (lite).", "Educator mode (lite)."),
  academy: t(
    "Академия ИИ: интерактивные лекции, разбор слайдов и ответы на вопросы по курсу.",
    "AI Academy: interactive lectures, slide analysis, and Q&A on the course."
  ),
};

/** Sidebar «Консультант» — диалог с ИИ, сохранение истории и поддержка всех подрежимов. */
export default function ConsultantPanel(props: ConsultantPanelProps) {
  const { documentContext = "", terminalUserId, caseId } = props;
  const [sub, setSub] = useState<ConsultantSub>("case");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const storageKey = useMemo(() => {
    return caseId ? `case_${caseId}` : "general";
  }, [caseId]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSavedMessages(storageKey));
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Sync with storage on storageKey change
  useEffect(() => {
    setMessages(loadSavedMessages(storageKey));
    setError("");
  }, [storageKey]);

  // Persist messages when updated
  useEffect(() => {
    saveMessages(storageKey, messages);
  }, [storageKey, messages]);

  // Auto-scroll on new message
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, busy]);

  const [importedBrief, setImportedBrief] = useState<{ title: string; context_text: string } | null>(null);
  const [showImportInput, setShowImportInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const lang = getTerminalEdition() === "ru" ? "ru" : "en";
  const { handleKeyDown: onEnterKeyDown } = useSendOnEnter();

  const effectiveContext = useMemo(() => {
    const parts = [
      documentContext,
      caseId ? t(`Контекст дела: ${caseId}`, `Case context: ${caseId}`) : "",
      importedBrief ? t(`Обезличенный контекст для супервизии: ${importedBrief.context_text}`, `Anonymized context for supervision: ${importedBrief.context_text}`) : "",
    ].filter(Boolean);
    return parts.join("\n");
  }, [caseId, documentContext, importedBrief]);

  async function handleSend(customText?: string) {
    const textToSend = (customText || input).trim();
    if (!textToSend || busy) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      text: textToSend,
      timestamp: Date.now(),
      sub,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) {
      setInput("");
    }
    setBusy(true);
    setError("");

    try {
      const result = await sendAiTurn({
        mode: "consultant",
        message: textToSend,
        context: effectiveContext,
        consultantSub: sub,
        terminalUserId,
        lang,
      });

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        text: result.reply,
        timestamp: Date.now(),
        sub,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errText = e instanceof Error ? e.message : String(e);
      setError(errText);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        text: t(
          `Ошибка при получении ответа (${errText}). Попробуйте повторить запрос.`,
          `Error retrieving reply (${errText}). Please try again.`
        ),
        timestamp: Date.now(),
        sub,
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setBusy(false);
    }
  }

  function handleClearHistory() {
    if (
      window.confirm(
        t(
          "Начать новую тему и очистить контекст диалога? Предыдущие реплики будут удалены из памяти помощника.",
          "Start a new topic and clear dialogue context? Previous messages will be cleared from assistant memory."
        )
      )
    ) {
      setMessages([]);
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
      resetTerminalAiSession();
      setError("");
    }
  }

  function handleRetry(lastUserMsg: string) {
    void handleSend(lastUserMsg);
  }

  return (
    <section className="card consultant-panel">
      <h2>{t("ИИ-Помощник", "AI Assistant")}</h2>
      <p className="muted tiny">{t("Свободный диалог с ИИ в одном из режимов ниже.", "Free dialogue with AI in one of the modes below.")}</p>

      <div className="consultant-mode-switch" role="tablist" aria-label="Режим консультанта">
        {CONSULTANT_SUB_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={sub === opt.id}
            className={`consultant-mode-btn${sub === opt.id ? " active" : " dimmed"}`}
            onClick={() => setSub(opt.id)}
          >
            <span className="consultant-mode-btn-label">{opt.label}</span>
            <span className="consultant-mode-btn-hint">{opt.hint}</span>
          </button>
        ))}
      </div>

      <p className="consultant-mode-active-desc muted">{MODE_INTROS[sub]}</p>

      {sub === "supervision" && (
        <div className="supervision-import-area" style={{ margin: "0.5rem 0 1rem 0" }}>
          {importedBrief ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem", border: "1px solid #2ecc71", borderRadius: "4px", backgroundColor: "rgba(46, 204, 113, 0.05)" }}>
              <span className="tiny" style={{ color: "#27ae60", fontWeight: "bold" }}>
                {t("📁 Активный случай: ", "📁 Active case: ")}{importedBrief.title}
              </span>
              <button
                type="button"
                className="ob-btn secondary tiny"
                onClick={() => setImportedBrief(null)}
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
              >
                {t("Сбросить", "Reset")}
              </button>
            </div>
          ) : showImportInput ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.8rem", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
              <textarea
                rows={3}
                placeholder={t("Вставьте токен супервизии...", "Insert supervision token...")}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{ fontSize: "0.8rem" }}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="ob-btn tiny"
                  onClick={() => {
                    try {
                      const res = importAnonymousCaseBrief(tokenInput);
                      setImportedBrief(res);
                      setTokenInput("");
                      setShowImportInput(false);
                      setError("");
                    } catch (err: any) {
                      setError(err.message || String(err));
                    }
                  }}
                >
                  {t("Загрузить", "Load")}
                </button>
                <button type="button" className="ob-btn secondary tiny" onClick={() => setShowImportInput(false)}>
                  {t("Отмена", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ob-btn secondary tiny"
              onClick={() => setShowImportInput(true)}
            >
              {t("📥 Загрузить случай для супервизии", "📥 Load case for supervision")}
            </button>
          )}
        </div>
      )}

      {/* Chat messages feed */}
      {messages.length > 0 && (
        <div className="consultant-history-controls">
          <span className="tiny muted">
            {t(`Сообщений в истории: ${messages.length}`, `Messages in history: ${messages.length}`)}
          </span>
          <button
            type="button"
            className="ob-btn secondary tiny"
            onClick={handleClearHistory}
            title={t(
              "Очищает историю сообщений и сбрасывает контекст диалога для ИИ, чтобы начать новую тему с чистого листа",
              "Clears message history and resets AI dialogue context to start a new topic from scratch"
            )}
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
          >
            {t("✨ Новая тема (очистить контекст)", "✨ New topic (clear context)")}
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div className="consultant-chat-history">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const prevUserMsg = !isUser && idx > 0 && messages[idx - 1].role === "user" ? messages[idx - 1].text : "";

            return (
              <div
                key={m.id}
                className={`consultant-msg consultant-msg--${m.role}${m.error ? " consultant-msg--error" : ""}`}
              >
                <div className="consultant-msg-header">
                  <span>{isUser ? t("Вы", "You") : t("ИИ-Помощник", "AI Assistant")}</span>
                  <span>{timeStr}</span>
                </div>
                <div className="consultant-msg-bubble">
                  {isUser ? (
                    <div>{m.text}</div>
                  ) : (
                    <>
                      <FormattedMarkdown content={m.text} />
                      {m.error && prevUserMsg && (
                        <div style={{ marginTop: "8px" }}>
                          <button
                            type="button"
                            className="ob-btn tiny"
                            disabled={busy}
                            onClick={() => handleRetry(prevUserMsg)}
                          >
                            {t("🔄 Повторить запрос", "🔄 Retry request")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="consultant-msg consultant-msg--assistant">
              <div className="consultant-msg-header">
                <span>{t("ИИ-Помощник", "AI Assistant")}</span>
              </div>
              <div className="consultant-msg-bubble consultant-typing-indicator">
                <span>⏳</span>
                <span>{t("Формирую ответ...", "Formulating reply...")}</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
      )}

      <label className="field">
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t("Сообщение", "Message")}</span>
          <SendOnEnterToggle />
        </span>
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => onEnterKeyDown(e, () => void handleSend())}
          placeholder={t("Опишите вопрос или ситуацию без ФИО…", "Describe the question or situation without full name…")}
        />
      </label>

      <div className="ai-action-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" className="ob-btn" disabled={busy || !input.trim()} onClick={() => void handleSend()}>
          {busy ? t("Печатает…", "Thinking…") : t("Отправить", "Send")}
        </button>
        {busy && <span className="tiny muted">{t("Генерация ответа…", "Generating response…")}</span>}
      </div>

      {error && !messages.some((m) => m.error) && <p className="ai-error">{error}</p>}
    </section>
  );
}
