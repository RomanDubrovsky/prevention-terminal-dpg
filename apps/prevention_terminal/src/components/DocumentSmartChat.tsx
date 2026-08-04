import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { resolveArchitectDocType, type ArchitectCategoryId, type ArchitectStageId } from "../lib/architect_picker.ts";
import { sendAiTurn, type AiTurnResult } from "../lib/ai_workspace.ts";
import { getFillCardPrompt } from "../lib/ai_prompts.ts";
import { buildArchitectFileName, packArchitectDocx, type ArchitectSegments } from "../lib/architect_docx_export.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";
import { parseUploadedDocument } from "../lib/document_api.ts";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";

export interface DocumentSmartChatProps {
  terminalUserId?: string;
  subscriptionActive: boolean;
  paywallUrl: string;
  category: ArchitectCategoryId;
  documentContext: string;
  cardSaved: boolean;
  aiLockedReason?: string;
  onApplyResult: (stage: ArchitectStageId, text: string, segments?: Record<string, string>) => Promise<void>;
  showPlanButton?: boolean;
  showReportButton?: boolean;
  planButtonLabel?: string;
  reportButtonLabel?: string;
  showExpertiseButton?: boolean;
  expertiseButtonLabel?: string;
  expertProtocolId?: string;
  customExpertisePrompt?: string;
  showFillCardButton?: boolean;
  fillCardButtonLabel?: string;
  customFillCardPrompt?: string;
  customActions?: Array<{ id: string; label: string; prompt: string; hint?: string }>;
  onAnalysisSaved?: (label: string, text: string) => void;
}

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

function documentText(result: AiTurnResult): string {
  if (result.requires_user_input) return result.reply.trim();
  if (result.raw_text?.trim()) return result.raw_text.trim();
  if (result.segments) {
    return Object.values(result.segments)
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return result.reply.trim();
}

export default function DocumentSmartChat(props: DocumentSmartChatProps) {
  const {
    terminalUserId,
    subscriptionActive,
    paywallUrl,
    category,
    documentContext,
    cardSaved,
    aiLockedReason = t("Сначала сохраните черновик карточки — затем откроется ассистент.", "Save card draft first — then assistant will unlock."),
    onApplyResult,
    showPlanButton = true,
    showReportButton = true,
    planButtonLabel = t("Сделать план", "Make plan"),
    reportButtonLabel = t("Сформировать отчет", "Form report"),
    showExpertiseButton = false,
    expertiseButtonLabel = t("Экспертиза", "Expertise"),
    expertProtocolId = "audit",
    customExpertisePrompt,
    showFillCardButton = false,
    fillCardButtonLabel = t("Внести в карточку", "Fill into card"),
    customFillCardPrompt,
  } = props;

  const [activeMode, setActiveMode] = useState<string>(() => {
    if (showPlanButton) return "plan";
    if (showFillCardButton) return "fill";
    if (props.customActions?.length) return props.customActions[0].id;
    if (showReportButton) return "report";
    return "chat";
  });

  const [input, setInput] = useState("");
  const [uploadedContext, setUploadedContext] = useState("");
  const [attachStatus, setAttachStatus] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState("");
  const [paywallHint, setPaywallHint] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastResult, setLastResult] = useState<{ stage: ArchitectStageId | "chat"; result: AiTurnResult } | null>(null);

  const lang = getTerminalEdition() === "ru" ? "ru" : "en";

  const effectiveContext = useMemo(() => {
    const parts = [documentContext, uploadedContext].map((s) => String(s || "").trim()).filter(Boolean);
    return parts.join("\n\n");
  }, [documentContext, uploadedContext]);

  const modeHintsDict: Record<string, string> = {
    plan: t("Сформирует план работы или ИПР на основе данных карточки. Напишите пожелания или нажмите «Запустить».", "Generates a work plan or IDP based on card data. Add notes or press «Run»."),
    fill: t(
      "Проанализирует ваш текст и разложит его по полям визита:\n" +
      "• Что было на встрече (наблюдения, жалобы)\n" +
      "• Что делали (техники, упражнения)\n" +
      "• Текущие выводы (оценка, динамика)\n" +
      "• Рекомендации и задания (план до следующего визита)\n" +
      "Расскажите или надиктуйте — ИИ разнесёт по полям.",
      "Analyzes your text and fills visit fields:\n" +
      "• What happened (observations, complaints)\n" +
      "• What was done (techniques, exercises)\n" +
      "• Current conclusions (assessment, dynamics)\n" +
      "• Recommendations & tasks (plan until next visit)\n" +
      "Dictate or paste — AI will populate the fields."
    ),
    report: t("Сформирует итоговый отчёт или официальный документ по текущему делу.", "Generates a final report or official document for the current case."),
    expertise: t("Проведёт методический анализ или функциональную оценку (ФАП/FBA).", "Runs methodological analysis or functional assessment (FBA)."),
    chat: t("Свободный диалог с ИИ-Консультантом по данному случаю.", "Free dialogue with AI Consultant on this case."),
  };

  const modePlaceholdersDict: Record<string, string> = {
    plan: t("Укажите особые пожелания к плану (акценты, длительность), или оставьте пустым для автогенерации…", "Specify special requirements for the plan, or leave blank for auto-generation..."),
    fill: t("Расскажите, что было на встрече: кто пришёл, с чем, что делали, какой результат, что дальше…", "Describe the session: who came, what happened, what you did, the result, what's next..."),
    report: t("Уточните требования к отчету (на что обратить внимание) или оставьте пустым…", "Specify report requirements or leave blank..."),
    expertise: t("Комментарий к материалам экспертизы (необязательно, если файл уже приложен)…", "Comment on materials (optional if file attached)..."),
    chat: t("Напишите вопрос или опишите ситуацию…", "Write a question or describe the situation..."),
  };

  async function onAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx") && !file.name.toLowerCase().endsWith(".pdf")) {
      setAttachStatus(t("Только .docx или .pdf", "Only .docx or .pdf"));
      return;
    }
    setAttachBusy(true);
    setAttachStatus(null);
    try {
      const { text, structured } = await parseUploadedDocument(file);
      setUploadedContext(text);
      setAttachStatus(`«${file.name}» — ${text.length} ${t("симв.", "chars.")}${structured ? t(" (структура OK)", " (structure OK)") : ""}`);
    } catch (err) {
      setAttachStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setAttachBusy(false);
      e.target.value = "";
    }
  }

  async function handleSendMain() {
    if (!subscriptionActive) {
      setPaywallHint(t("Подписка ИИ нужна для работы ассистента. Оформите подписку в настройках.", "AI subscription required. Subscribe in settings."));
      return;
    }
    if (!cardSaved) {
      setError(aiLockedReason);
      return;
    }

    let promptToUse = input.trim();
    let stageToSend: ArchitectStageId | "expertise" | "chat" = "chat";
    let customPromptOverride: string | undefined = undefined;

    if (activeMode === "plan") {
      stageToSend = "plan";
    } else if (activeMode === "fill") {
      stageToSend = "report";
      const defaultFillPrompt = getFillCardPrompt(category) + (promptToUse ? "\n" + promptToUse : "");
      customPromptOverride = customFillCardPrompt || defaultFillPrompt;
    } else if (activeMode === "report") {
      stageToSend = "report";
    } else if (activeMode === "expertise") {
      stageToSend = "expertise";
      customPromptOverride = customExpertisePrompt || promptToUse;
    } else {
      const customAction = props.customActions?.find((a) => a.id === activeMode);
      if (customAction) {
        stageToSend = "chat";
        customPromptOverride = customAction.prompt + (promptToUse ? "\n" + promptToUse : "");
      } else {
        stageToSend = "chat";
      }
    }

    const finalPrompt =
      customPromptOverride ||
      promptToUse ||
      (activeMode === "plan"
        ? t("Сформируй план работы по данным карточки.", "Create work plan based on card data.")
        : activeMode === "report"
        ? t("Сформируй итоговый отчет по делу.", "Create final case report.")
        : t("Проанализируй ситуацию.", "Analyze situation."));

    setPaywallHint(null);
    setError("");
    setBusy(true);

    const newUserMessage: ChatMessage = { sender: "user", text: finalPrompt };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");

    try {
      const mode = stageToSend === "expertise" ? "expert" : stageToSend === "chat" ? "consultant" : "architect";
      const architectDocType =
        stageToSend !== "expertise" && stageToSend !== "chat"
          ? resolveArchitectDocType(category, stageToSend as ArchitectStageId)
          : undefined;

      const res = await sendAiTurn({
        mode,
        message: finalPrompt,
        context: effectiveContext,
        ...(stageToSend === "expertise" ? { expertProtocolId } : stageToSend === "chat" ? { consultantSub: "case" } : { architectDocType }),
        lang,
        terminalUserId,
      });

      const replyText = documentText(res);
      const newAiMessage: ChatMessage = { sender: "ai", text: replyText };
      setMessages((prev) => [...prev, newAiMessage]);

      if (stageToSend !== "expertise" && stageToSend !== "chat") {
        setLastResult({ stage: stageToSend, result: res });
      }

      // Persist analysis to history
      if (props.onAnalysisSaved && replyText) {
        const customAction = props.customActions?.find((a) => a.id === activeMode);
        const modeLabel = customAction
          ? customAction.label
          : activeMode === "report"
          ? (props.reportButtonLabel || t("Отчет", "Report"))
          : activeMode === "plan"
          ? (props.planButtonLabel || t("План", "Plan"))
          : t("Анализ ИИ", "AI Analysis");
        props.onAnalysisSaved(modeLabel.replace(/^[\p{Emoji}\s]+/u, "").trim() || modeLabel, replyText);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "subscription_required") {
        setPaywallHint(t("Нужна подписка ИИ для этого режима.", "AI subscription required for this mode."));
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleExportDocx() {
    if (!lastResult || exportBusy) return;
    setExportBusy(true);
    setError("");
    try {
      const segments = (lastResult.result.segments || {}) as ArchitectSegments;
      const buffer = await packArchitectDocx({
        title: segments.title || t("Документ ИИ", "AI Document"),
        segments,
        rawFallback: lastResult.result.raw_text || lastResult.result.reply,
      });
      const targetPath = await save({
        defaultPath: buildArchitectFileName(resolveArchitectDocType(category, lastResult.stage as ArchitectStageId) || "consultation_plan"),
        filters: [{ name: "Word document", extensions: ["docx"] }],
      });
      if (!targetPath) return;
      await invoke("save_docx", {
        targetPath,
        base64Data: arrayBufferToBase64(buffer),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  }

  async function handleApply() {
    if (!lastResult) return;
    setBusy(true);
    setError("");
    try {
      const text = documentText(lastResult.result);
      if (lastResult.stage !== "chat") {
        await onApplyResult(lastResult.stage, text, lastResult.result.segments);
      }
      setLastResult(null);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!subscriptionActive) {
    return (
      <div className="document-smart-chat card" style={{ marginBottom: "24px", padding: "15px 20px", background: "var(--surface-soft)", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--line)" }}>
        <span style={{ fontWeight: "bold" }}>✨ {t("ИИ-Ассистент (Необходима подписка)", "AI Assistant (Subscription Required)")}</span>
        {paywallUrl && (
          <a href={paywallUrl} target="_blank" rel="noreferrer" className="ob-btn secondary tiny" style={{ textDecoration: "none" }}>
            {t("Подключить", "Subscribe")}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card ai-modes-panel document-smart-chat" style={{ marginBottom: "24px", padding: "24px", border: "1px solid var(--violet)", background: "var(--surface)", borderRadius: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--violet)", display: "flex", alignItems: "center", gap: "8px" }}>
          ✨ {t("ИИ-Помощник", "AI Assistant")}
        </h2>
      </div>

      {/* Explicit Mode Switch Tabs (Matching AiModesPanel .ai-mode-tabs) */}
      <div className="ai-mode-tabs" style={{ marginBottom: "14px" }}>
        {showPlanButton && (
          <button
            type="button"
            className={activeMode === "plan" ? "active" : ""}
            onClick={() => { setActiveMode("plan"); setError(""); }}
          >
            {planButtonLabel}
          </button>
        )}
        {showFillCardButton && (
          <button
            type="button"
            className={activeMode === "fill" ? "active" : ""}
            onClick={() => { setActiveMode("fill"); setError(""); }}
          >
            {fillCardButtonLabel}
          </button>
        )}
        {showExpertiseButton && (
          <button
            type="button"
            className={activeMode === "expertise" ? "active" : ""}
            onClick={() => { setActiveMode("expertise"); setError(""); }}
          >
            {expertiseButtonLabel}
          </button>
        )}
        {props.customActions?.map((action) => (
          <button
            key={action.id}
            type="button"
            className={activeMode === action.id ? "active" : ""}
            onClick={() => { setActiveMode(action.id); setError(""); }}
          >
            {action.label}
          </button>
        ))}
        {showReportButton && (
          <button
            type="button"
            className={activeMode === "report" ? "active" : ""}
            onClick={() => { setActiveMode("report"); setError(""); }}
          >
            {reportButtonLabel}
          </button>
        )}
      </div>

      {/* Mode Instruction Hint */}
      <p className="muted ai-mode-hint" style={{ marginBottom: "16px", fontSize: "0.9rem", color: "var(--muted)" }}>
        {modeHintsDict[activeMode] || props.customActions?.find((a) => a.id === activeMode)?.hint || modeHintsDict.chat}
      </p>

      {/* File Attachment Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        <label
          className="ai-attach-btn ob-btn secondary tiny"
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            margin: 0,
            background: "var(--surface-soft, #eef2ed)",
            color: "var(--text, #1f2933)",
            border: "1px solid var(--line, #d9e0d8)",
            padding: "6px 12px",
            borderRadius: "6px",
            fontWeight: 600
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--line, #d9e0d8)";
            e.currentTarget.style.color = "var(--text, #1f2933)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-soft, #eef2ed)";
            e.currentTarget.style.color = "var(--text, #1f2933)";
          }}
        >
          📎 <span>{attachBusy ? t("Загрузка...", "Uploading...") : t("Прикрепить файл (.docx / .pdf)", "Attach file (.docx / .pdf)")}</span>
          <input type="file" accept=".docx,.pdf" onChange={onAttachFile} disabled={attachBusy || busy} style={{ display: "none" }} />
        </label>
        {attachStatus && (
          <span className="muted tiny" style={{ background: "var(--surface-soft)", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
            {attachStatus}
            <button type="button" onClick={() => { setUploadedContext(""); setAttachStatus(null); }} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "6px", color: "var(--muted)" }}>✕</button>
          </span>
        )}
      </div>

      {/* Chat Conversation History */}
      {messages.length > 0 && (
        <div className="smart-chat-history" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px", maxHeight: "280px", overflowY: "auto", padding: "14px", background: "var(--surface-soft)", borderRadius: "10px", border: "1px solid var(--line)" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", background: msg.sender === "user" ? "var(--violet-light, rgba(139, 92, 246, 0.15))" : "var(--surface)", padding: "10px 14px", borderRadius: "10px", maxWidth: "85%", fontSize: "0.92rem", border: "1px solid var(--line)", color: "var(--text)" }}>
              <strong>{msg.sender === "user" ? t("Вы", "You") : t("ИИ", "AI")}:</strong>
              <p style={{ margin: "4px 0 0 0", whiteSpace: "pre-wrap" }}>{msg.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Visible, High-Contrast Textarea */}
      <div style={{ marginBottom: "16px" }}>
        <textarea
          className="smart-chat-textarea"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={subscriptionActive ? (modePlaceholdersDict[activeMode] || t("Напишите уточнение или запрос для ИИ…", "Write a clarification or request for AI...")) : t("Ассистент недоступен без подписки...", "Assistant unavailable without subscription...")}
          disabled={busy || !subscriptionActive}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "2px solid #0f766e",
            background: "#ffffff",
            color: "#111827",
            fontSize: "0.95rem",
            lineHeight: "1.5",
            outline: "none",
            boxShadow: "0 0 0 1px #0b5f59, 0 2px 10px rgba(15, 118, 110, 0.15)"
          }}
        />
      </div>

      {/* Action Row / Launch Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <button
          type="button"
          className="ob-btn success"
          onClick={() => void handleSendMain()}
          disabled={busy || !subscriptionActive}
          style={{ padding: "12px 28px", fontWeight: "bold", fontSize: "1rem", background: "#0f766e", color: "#ffffff", border: "1px solid #0b5f59", borderRadius: "10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(15, 118, 110, 0.35)" }}
        >
          <span>🚀 {busy ? t("Генерация...", "Generating...") : t("Запустить (ИИ)", "Run (AI)")}</span>
        </button>
      </div>

      {error && <p className="error" style={{ marginTop: "12px", color: "var(--danger, #ef4444)" }}>{error}</p>}
      {paywallHint && subscriptionActive && <AiSubscriptionPaywall context={paywallHint} paywallUrl={paywallUrl} terminalUserId={terminalUserId} />}

      {/* Result Application & Export Panel */}
      {lastResult && !lastResult.result.requires_user_input && subscriptionActive && lastResult.stage !== "chat" && (
        <div className="smart-chat-result-area" style={{ borderTop: "1px solid var(--line)", marginTop: "20px", paddingTop: "20px", background: "var(--surface-soft)", padding: "18px", borderRadius: "10px" }}>
          <h5 className="smart-chat-result-title" style={{ marginTop: 0, marginBottom: "12px", fontSize: "1rem", color: "var(--text)" }}>
            {t("Результат сгенерирован. Применить к документу?", "Result generated. Apply to document?")}
          </h5>
          <div className="smart-chat-result-actions" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ob-btn success"
              onClick={() => void handleApply()}
              disabled={busy}
              style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
            >
              {t("Применить к форме", "Apply to form")}
            </button>
            <button
              type="button"
              className="ob-btn"
              onClick={() => void handleExportDocx()}
              disabled={exportBusy}
              style={{ background: "var(--violet)", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer" }}
            >
              {exportBusy ? t("Скачивание...", "Downloading...") : t("Скачать Word (.docx)", "Download Word (.docx)")}
            </button>
            <button
              type="button"
              className="ob-btn secondary"
              onClick={() => {
                setLastResult(null);
                setMessages([]);
              }}
              disabled={busy}
              style={{ padding: "10px 18px", borderRadius: "8px", cursor: "pointer" }}
            >
              {t("Сбросить диалог", "Reset chat")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
