import { useMemo, useState } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import {
  buildArchitectFileName,
  type ArchitectSegments,
} from "../lib/architect_docx_export.ts";
import { parseUploadedDocument } from "../lib/document_api.ts";

import {
  EXPERT_PROTOCOL_OPTIONS,
  fixInArchitect,
  sectionExpertPrompt,
  sendAiTurn,
  type AiTurnResult,
} from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { t } from "../lib/i18n.ts";
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
  const { handleKeyDown: onEnterKeyDown } = useSendOnEnter();
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
      setPaywallHint(t(`Подписка ИИ нужна для экспертизы. Оформление: ${paywallUrl}`, `AI subscription required for expert analysis: ${paywallUrl}`));
      return;
    }
    if (!cardSaved) {
      setError(t("Сначала сохраните карточку.", "Please save the case card first."));
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
      setAttachStatus(t("Только .docx или .pdf", "Only .docx or .pdf"));
      return;
    }
    setAttachBusy(true);
    setAttachStatus(null);
    try {
      const { text, structured } = await parseUploadedDocument(file);
      setUploadedContext(text);
      setAttachStatus(t(`«${file.name}» — ${text.length} симв.${structured ? " (структура OK)" : ""}`, `«${file.name}» — ${text.length} chars${structured ? " (structure OK)" : ""}`));
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
        setPaywallHint(t(`Подписка ИИ: ${paywallUrl}`, `AI Subscription required: ${paywallUrl}`));
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
      const [{ packArchitectDocx }, { arrayBufferToBase64 }] = await Promise.all([
        import("../lib/architect_docx_export.ts"),
        import("../lib/docx_export.ts"),
      ]);
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
    <div className="section-expert-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {!hideTitle && (
        <header className="workspace-card-header" style={{ marginBottom: 0, paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>{t("Экспертиза", "Expertise")}</h2>
            <p className="muted tiny" style={{ margin: '8px 0 0 0' }}>
              {t("Методическая экспертиза и индивидуальные заключения. Следуйте шагам ниже.", "Methodological expertise and case evaluations. Follow the steps below.")}
            </p>
          </div>
        </header>
      )}
      
      {!cardSaved && <p className="muted tiny">{t("Сохраните карточку выше, чтобы начать работу с экспертизой.", "Save the case card above to begin working with the expertise.")}</p>}
      {paywallHint && <p className="ai-error">{paywallHint}</p>}
      {error && <p className="ai-error">{error}</p>}

      {handoffNotice && (
        <div className="ai-handoff-banner" role="status">
          <p>{handoffNotice}</p>
          {onHandoffConsumed && (
            <button type="button" className="ai-attach-clear" onClick={onHandoffConsumed}>
              {t("Понятно", "Understood")}
            </button>
          )}
        </div>
      )}

      {subscriptionActive && cardSaved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          
          {/* Step 1 */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: 'var(--violet)' }}>
              {t("Шаг 1. Сбор материалов", "Step 1. Collect Materials")}
            </h3>
            <p className="muted tiny" style={{ marginBottom: "16px", marginTop: "-8px" }}>
              {t("Прикрепите исходные файлы (.docx, .pdf) или напишите комментарий.", "Attach source files (.docx, .pdf) or write your notes and comments.")}
            </p>
            
            <div className="ai-attach-row" style={{ marginBottom: '16px' }}>
              <label className="ob-btn secondary tiny" style={{ cursor: 'pointer' }}>
                <input type="file" accept=".docx,.pdf" hidden disabled={attachBusy} onChange={onAttachFile} />
                📸 {attachBusy ? t("Загрузка…", "Uploading…") : t("Прикрепить файл", "Attach file")}
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
                  {t("Убрать файл", "Remove file")}
                </button>
              )}
              {attachStatus && <span className="muted tiny">{attachStatus}</span>}
            </div>

            <label className="field wide" style={{ marginBottom: 0 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: '600' }}>
                <span>{t("Комментарий", "Notes & Comments")}</span>
                <SendOnEnterToggle />
              </span>
              <textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => onEnterKeyDown(e, () => void handleSend())}
                placeholder={t("Дополнительные сведения (необязательно)…", "Additional context (optional)…")}
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}
              />
            </label>
          </div>

          {/* Step 2 */}
          <section className="card" style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(139, 92, 246, 0.01))', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--violet-dark)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              ⚡ {t("Шаг 2. Запуск (ИИ)", "Step 2. Launch (AI)")}
            </h3>
            <p className="muted tiny" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
              {t("Выберите тип экспертизы и запустите анализ. ИИ проанализирует материалы из Шага 1.", "Select expertise type and run the analysis. AI will review materials from Step 1.")}
            </p>
            
            <div className="section-expert-mode-row" role="group" aria-label={t("Протокол экспертизы", "Expertise protocol")} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {protocols.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.hint || expertLabel(opt.id)}
                  className={`section-expert-mode${activeProtocol === opt.id ? " active" : ""}${!subscriptionActive ? " locked" : ""}${savedExpert[opt.id]?.text ? " has-saved" : ""}`}
                  disabled={!cardSaved && subscriptionActive}
                  onClick={() => openProtocol(opt.id)}
                  style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', padding: '10px' }}
                >
                  {opt.label || expertLabel(opt.id)}
                </button>
              ))}
            </div>
            
            <button type="button" className="ob-btn success w-full" style={{ background: 'var(--violet)', borderColor: 'var(--violet-dark)', color: '#fff', width: '100%', justifyContent: 'center', padding: '10px 20px', fontWeight: 'bold', marginTop: '16px' }} disabled={busy || !activeProtocol} onClick={() => void handleSend()}>
              {busy ? t("Анализируем...", "Analyzing...") : t("Запустить экспертизу", "Run expertise")}
            </button>
          </section>
          
          {/* Step 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: "0", fontSize: "1.1rem", color: "var(--violet)" }}>
              {t("Шаг 3. Результат экспертизы", "Step 3. Expertise Result")}
            </h3>
            <p className="muted tiny" style={{ marginTop: "-12px", marginBottom: "0" }}>
              {t("Ознакомьтесь с выводами ИИ. При необходимости вы можете повторить запрос или изменить комментарий на Шаге 1.", "Review AI conclusions. You can refine notes in Step 1 or re-run analysis if needed.")}
            </p>
            
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '120px' }}>
              {!lastResult?.reply && <p className="muted tiny" style={{ textAlign: 'center', margin: '40px 0' }}>{t("Результат появится здесь...", "The result will appear here...")}</p>}
              {lastResult?.reply && <pre className="ai-reply compact">{lastResult.reply}</pre>}
            </div>
            
            {canFixInArchitect && onHandoffToArchitect && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                 <button type="button" className="ob-btn secondary" disabled={handoffBusy} onClick={() => void handleFixInArchitect()}>
                   ✨ {handoffBusy ? t("Создание...", "Creating...") : t("Создать документ на основе экспертизы (Архитектор)", "Create document based on expertise (Architect)")}
                 </button>
              </div>
            )}
          </div>

          {/* Step 4 */}
          <section className="card" style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', background: '#fff' }}>
             <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.1rem' }}>
               {t("Шаг 4. Сохранение", "Step 4. Save & Export")}
             </h3>
             <p className="muted tiny" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
               {t("Сохраните результат в базу данных или выгрузите в DOCX.", "Save the result to the case record or export to DOCX.")}
             </p>
             
             <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" className="ob-btn secondary" style={{ padding: '8px 16px' }} disabled={!canActOnResult || saveBusy} onClick={() => void handleSaveToCard()}>
                  💾 {saveBusy ? t("Сохранение...", "Saving...") : t("Сохранить в карточку дела", "Save to case card")}
                </button>
                <button type="button" className="ob-btn secondary" style={{ padding: '8px 16px' }} disabled={!canActOnResult || exportBusy} onClick={() => void handleExportDocx()}>
                  📥 {exportBusy ? t("Формируем...", "Generating...") : t("Скачать DOCX", "Download DOCX")}
                </button>
             </div>
             
             {savedCount > 0 && (
               <p className="ok tiny" style={{ marginTop: '12px' }}>{t(`Сохранено заключений в деле: ${savedCount}`, `Saved evaluations in case: ${savedCount}`)}</p>
             )}
             {savedExpert[activeProtocol || '']?.text && (
               <details className="section-expert-saved-preview" style={{ marginTop: '12px' }}>
                 <summary className="muted tiny">{t("Показать сохранённый текст", "Show saved text")}</summary>
                 <pre className="ai-reply compact" style={{ maxHeight: '200px', overflowY: 'auto' }}>{savedExpert[activeProtocol || '']?.text}</pre>
               </details>
             )}
          </section>

        </div>
      )}
    </div>
  );
}
