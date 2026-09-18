import { useMemo, useState } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";
import { t } from "../lib/i18n.ts";
import { importAnonymousCaseBrief } from "../lib/case_supervision.ts";

import {
  CONSULTANT_SUB_OPTIONS,
  sendAiTurn,
  type ConsultantSub,
} from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

interface ConsultantPanelProps {
  documentContext?: string;
  terminalUserId?: string;
  caseId?: string;
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

/** Sidebar «Консультант» — только поговорить, три подрежима с явным UI. */
export default function ConsultantPanel(props: ConsultantPanelProps) {
  const { documentContext = "", terminalUserId, caseId } = props;
  const [sub, setSub] = useState<ConsultantSub>("case");
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSend() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await sendAiTurn({
        mode: "consultant",
        message,
        context: effectiveContext,
        consultantSub: sub,
        terminalUserId,
        lang,
      });
      setReply(result.reply);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReply("");
    } finally {
      setBusy(false);
    }
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

      <label className="field">
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{t("Сообщение", "Message")}</span>
          <SendOnEnterToggle />
        </span>
        <textarea
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => onEnterKeyDown(e, () => void handleSend())}
          placeholder={t("Опишите вопрос или ситуацию без ФИО…", "Describe the question or situation without full name…")}
        />
      </label>

      <div className="ai-action-row">
        <button type="button" className="ob-btn" disabled={busy || !input.trim()} onClick={() => void handleSend()}>
          {busy ? "…" : t("Отправить", "Send")}
        </button>
      </div>

      {error && <p className="ai-error">{error}</p>}
      {reply && <pre className="ai-reply">{reply}</pre>}
    </section>
  );
}
