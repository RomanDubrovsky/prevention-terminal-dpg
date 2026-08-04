import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import {
  buildArchitectFileName,
  packArchitectDocx,
  type ArchitectSegments,
} from "../lib/architect_docx_export.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";
import { parseUploadedDocument } from "../lib/document_api.ts";
import {
  EXPERT_PROTOCOL_OPTIONS,
  fixInArchitect,
  sectionExpertPrompt,
  sendAiTurn,
  type AiTurnResult,
} from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import {
  artifactFromAiResult,
  expertApiProtocol,
  expertLabel,
  type ExpertArtifact,
  type ExpertProtocolId,
} from "../lib/section_artifacts.ts";

export interface SectionExpertProtocolOption {
  id: ExpertProtocolId;
  label?: string;
  hint?: string;
}

export interface SectionExpertPanelProps {
  terminalUserId?: string;
  subscriptionActive: boolean;
  paywallUrl: string;
  documentContext: string;
  protocols?: SectionExpertProtocolOption[];
  savedExpert?: Partial<Record<ExpertProtocolId, ExpertArtifact>>;
  cardSaved: boolean;
  showFixInArchitect?: boolean;
  hideTitle?: boolean;
  handoffNotice?: string | null;
  onHandoffToArchitect?: (message: string) => void;
  onHandoffConsumed?: () => void;
  onSaveExpert: (protocolId: ExpertProtocolId, artifact: ExpertArtifact) => Promise<void>;
}

const DEFAULT_PROTOCOLS: SectionExpertProtocolOption[] = EXPERT_PROTOCOL_OPTIONS.map((opt) => ({
  id: opt.id as ExpertProtocolId,
  label: opt.label,
  hint: opt.hint,
}));

export default function SectionExpertPanel(props: SectionExpertPanelProps) {
  const {
    terminalUserId,
    subscriptionActive,
    paywallUrl,
    documentContext,
    protocols = DEFAULT_PROTOCOLS,
    savedExpert = {},
    cardSaved,
    showFixInArchitect = true,
    hideTitle = false,
    handoffNotice = null,
    onHandoffToArchitect,
    onHandoffConsumed,
    onSaveExpert,
  } = props;

  const [activeProtocol, setActiveProtocol] = useState<ExpertProtocolId | null>(null);
  const [uploadedContext, setUploadedContext] = useState("");
  const [attachStatus, setAttachStatus] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<AiTurnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [error, setError] = useState("");
  const [paywallHint, setPaywallHint] = useState<string | null>(null);

  const lang = getTerminalEdition() === "ru" ? "ru" : "en";

  const effectiveContext = useMemo(() => {
    const parts = [documentContext, uploadedContext].map((s) => String(s || "").trim()).filter(Boolean);
    return parts.join("\n\n");
  }, [documentContext, uploadedContext]);

  const savedCount = useMemo(
    () => protocols.filter((p) => savedExpert[p.id]?.text?.trim()).length,
    [protocols, savedExpert],
  );

  function openProtocol(id: ExpertProtocolId) {
    if (!subscriptionActive) {
      setPaywallHint(`Подписка ИИ нужна для экспертизы. Оформление: ${paywallUrl}`);
      return;
    }
    if (!cardSaved) {
      setError("Сначала сохраните карточку.");
      return;
    }
    setPaywallHint(null);
    setError("");
    setActiveProtocol(id);
    setLastResult(null);
    setInput("");
  }

  async function onAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx") && !file.name.toLowerCase().endsWith(".pdf")) {
      setAttachStatus("Только .docx или .pdf");
      return;
    }
    setAttachBusy(true);
    setAttachStatus(null);
    try {
      const { text, structured } = await parseUploadedDocument(file);
      setUploadedContext(text);
      setAttachStatus(`«${file.name}» — ${text.length} симв.${structured ? " (структура OK)" : ""}`);
    } catch (err) {
      setAttachStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setAttachBusy(false);
      e.target.value = "";
    }
  }

  async function handleSend() {
    if (!activeProtocol || busy) return;
    const trimmed = input.trim();
    const outgoing = trimmed || sectionExpertPrompt(activeProtocol);
    if (!outgoing && !effectiveContext) return;

    setBusy(true);
    setError("");
    try {
      const result = await sendAiTurn({
        mode: "expert",
        message: outgoing,
        context: effectiveContext,
        expertProtocol: expertApiProtocol(activeProtocol),
        terminalUserId,
        lang,
      });
      setLastResult(result);
      setInput("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "subscription_required") {
        setPaywallHint(`Подписка ИИ: ${paywallUrl}`);
      } else {
        setError(msg);
      }
      setLastResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleFixInArchitect() {
    if (!lastResult || handoffBusy) return;
    setHandoffBusy(true);
    setError("");
    try {
      const result = await fixInArchitect(lang);
      onHandoffToArchitect?.(result.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHandoffBusy(false);
    }
  }

  async function handleExportDocx() {
    if (!lastResult || exportBusy) return;
    setExportBusy(true);
    setError("");
    try {
      const segments = (lastResult.segments || {}) as ArchitectSegments;
      const buffer = await packArchitectDocx({
        title: segments.title || expertLabel(activeProtocol || "audit"),
        segments,
        rawFallback: lastResult.raw_text || lastResult.reply,
      });
      const targetPath = await save({
        defaultPath: buildArchitectFileName("consultation_plan"),
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

  async function handleSaveToCard() {
    if (!lastResult || !activeProtocol || saveBusy) return;
    setSaveBusy(true);
    setError("");
    try {
      await onSaveExpert(activeProtocol, artifactFromAiResult(lastResult));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  const canActOnResult = Boolean(lastResult && (lastResult.raw_text || lastResult.segments || lastResult.reply));
  const canFixInArchitect =
    showFixInArchitect &&
    canActOnResult &&
    (lastResult?.raw_text || lastResult?.structured || lastResult?.segments);

  return (
    <div className="section-expert-panel">
      {!hideTitle && (
        <>
          <h4>Эксперт</h4>
          <p className="muted tiny">
            Методическая экспертиза и индивидуальные заключения. Результат сохраняется в карточку (текст + структура для учёта).
          </p>
        </>
      )}
      {savedCount > 0 && (
        <p className="muted tiny section-expert-saved-hint">Сохранено заключений: {savedCount}</p>
      )}

      <div className="section-expert-mode-row" role="group" aria-label="Протокол экспертизы">
        {protocols.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.hint || expertLabel(opt.id)}
            className={`section-expert-mode${activeProtocol === opt.id ? " active" : ""}${!subscriptionActive ? " locked" : ""}${savedExpert[opt.id]?.text ? " has-saved" : ""}`}
            disabled={!cardSaved && subscriptionActive}
            onClick={() => openProtocol(opt.id)}
          >
            {opt.label || expertLabel(opt.id)}
          </button>
        ))}
      </div>

      {!cardSaved && <p className="muted tiny">Сохраните карточку выше, чтобы открыть экспертизу.</p>}
      {paywallHint && <p className="ai-error">{paywallHint}</p>}

      {handoffNotice && (
        <div className="ai-handoff-banner" role="status">
          <p>{handoffNotice}</p>
          {onHandoffConsumed && (
            <button type="button" className="ai-attach-clear" onClick={onHandoffConsumed}>
              Понятно
            </button>
          )}
        </div>
      )}

      {activeProtocol && subscriptionActive && cardSaved && (
        <div className="section-expert-chat">
          <div className="ai-attach-row">
            <label className="ai-attach-btn">
              <input type="file" accept=".docx,.pdf" hidden disabled={attachBusy} onChange={onAttachFile} />
              {attachBusy ? "Загрузка…" : "Прикрепить файл"}
            </label>
            {uploadedContext && (
              <button
                type="button"
                className="ai-attach-clear"
                onClick={() => {
                  setUploadedContext("");
                  setAttachStatus(null);
                }}
              >
                Убрать файл
              </button>
            )}
            {attachStatus && <span className="muted tiny">{attachStatus}</span>}
          </div>

          <label className="field">
            <span>Комментарий</span>
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Комментарий к материалу (необязательно, если файл уже приложен)…"
            />
          </label>

          <div className="ai-action-row">
            <button type="button" className="ob-btn" disabled={busy} onClick={() => void handleSend()}>
              {busy ? "…" : "Запустить экспертизу"}
            </button>
            {canActOnResult && (
              <>
                <button type="button" className="ob-btn secondary" disabled={exportBusy} onClick={() => void handleExportDocx()}>
                  {exportBusy ? "…" : "Скачать DOCX"}
                </button>
                <button type="button" className="ob-btn secondary" disabled={saveBusy} onClick={() => void handleSaveToCard()}>
                  {saveBusy ? "…" : "Сохранить в карточку"}
                </button>
              </>
            )}
            {canFixInArchitect && onHandoffToArchitect && (
              <button type="button" className="ob-btn secondary" disabled={handoffBusy} onClick={() => void handleFixInArchitect()}>
                {handoffBusy ? "…" : "Создать документ на основе экспертизы"}
              </button>
            )}
          </div>

          {savedExpert[activeProtocol]?.text && (
            <details className="section-expert-saved-preview">
              <summary className="muted tiny">Сохранённый текст в карточке</summary>
              <pre className="ai-reply compact">{savedExpert[activeProtocol]?.text}</pre>
            </details>
          )}

          {error && <p className="ai-error">{error}</p>}
          {lastResult?.reply && <pre className="ai-reply">{lastResult.reply}</pre>}
        </div>
      )}
    </div>
  );
}
