import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { t } from "../lib/i18n.ts";

import {
  ARCHITECT_CATEGORIES,
  ARCHITECT_STAGES,
  architectDocLabel,
  resolveArchitectDocType,
  type ArchitectCategoryId,
  type ArchitectStageId,
} from "../lib/architect_picker.ts";
import {
  buildArchitectFileName,
  packArchitectDocx,
  type ArchitectSegments,
} from "../lib/architect_docx_export.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";
import { parseUploadedDocument } from "../lib/document_api.ts";
import {
  CONSULTANT_SUB_OPTIONS,
  EDUCATOR_LITE_HINTS,
  EDUCATOR_LITE_TABS,
  EXPERT_DEFAULT_PROMPTS,
  EXPERT_PROTOCOL_OPTIONS,
  fixInArchitect,
  ARCHITECT_DEFAULT_PROMPT,
  sendAiTurn,
  type AiMode,
  type AiTurnResult,
  type ConsultantSub,
} from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

export type { AiMode };

const MODE_TITLES: Record<AiMode, string> = {
  consultant: t("Спросить", "Ask"),
  expert: t("Эксперт", "Expert"),
  architect: t("Архитектор", "Architect"),
};

const MODE_HINTS: Record<AiMode, string> = {
  consultant:
    t("Краткие консультации по теории и практике. Выберите подрежим и опишите ситуацию без лишней бюрократии.", "Brief consultations on theory and practice. Choose a sub-mode and describe the situation without unnecessary bureaucracy."),
  expert:
    t("Методическая экспертиза: выберите протокол, приложите программу или материал (.docx / .pdf), запустите аудит.", "Methodological expertise: select a protocol, attach a program or material (.docx / .pdf), run an audit."),
  architect:
    t("Конструктор документов: категория → план или отчёт. Можно приложить черновик или перенести результат экспертизы.", "Document constructor: category → plan or report. You can attach a draft or transfer the result of an expertise."),
};

interface AiModesPanelProps {
  documentContext?: string;
  enabled?: boolean;
  fixedMode?: AiMode;
  /** Lock architect to one category (e.g. safe_environment → safety). */
  architectCategoryLock?: ArchitectCategoryId;
  educatorLite?: boolean;
  supervisorOnly?: boolean;
  installId?: string;
  terminalUserId?: string;
  handoffNotice?: string | null;
  onHandoffConsumed?: () => void;
  onHandoffToArchitect?: (message: string) => void;
  onAiError?: (code: string) => void;
}

export default function AiModesPanel(props: AiModesPanelProps) {
  const {
    documentContext = "",
    enabled = true,
    fixedMode,
    architectCategoryLock,
    educatorLite = false,
    supervisorOnly = false,
    installId,
    terminalUserId,
    handoffNotice = null,
    onHandoffConsumed,
    onHandoffToArchitect,
    onAiError,
  } = props;

  const [mode, setMode] = useState<AiMode>(fixedMode || "consultant");
  const [consultantSub, setConsultantSub] = useState<ConsultantSub>("case");
  const [expertProtocol, setExpertProtocol] = useState("audit");
  const [archCategory, setArchCategory] = useState<ArchitectCategoryId | null>(
    architectCategoryLock ?? null,
  );
  const [archStage, setArchStage] = useState<ArchitectStageId | null>(null);
  const [uploadedContext, setUploadedContext] = useState("");
  const [attachStatus, setAttachStatus] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<AiTurnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [error, setError] = useState("");

  const effectiveMode = supervisorOnly ? "consultant" : fixedMode || mode;
  const sidebarMode = fixedMode != null && !supervisorOnly && !educatorLite;
  const lang = getTerminalEdition() === "ru" ? "ru" : "en";

  const architectDocType = useMemo(() => {
    if (educatorLite) return "group_plan";
    if (archCategory && archStage) return resolveArchitectDocType(archCategory, archStage);
    return null;
  }, [archCategory, archStage, educatorLite]);

  const effectiveContext = useMemo(() => {
    const parts = [documentContext, uploadedContext].map((s) => String(s || "").trim()).filter(Boolean);
    return parts.join("\n\n");
  }, [documentContext, uploadedContext]);

  if (!enabled) return null;

  const architectReady = educatorLite || architectDocType != null;

  const canExportDocx =
    lastResult &&
    !educatorLite &&
    !supervisorOnly &&
    (effectiveMode === "architect" || effectiveMode === "expert") &&
    (lastResult.raw_text || lastResult.segments);

  const showGroupExport =
    educatorLite && lastResult && effectiveMode === "architect" && (lastResult.raw_text || lastResult.segments);

  const showAttach = !educatorLite && !supervisorOnly && (effectiveMode === "expert" || effectiveMode === "architect");

  const canFixInArchitect =
    !educatorLite &&
    !supervisorOnly &&
    effectiveMode === "expert" &&
    lastResult &&
    (lastResult.raw_text || lastResult.structured || lastResult.segments);

  const canSendExpert =
    effectiveMode === "expert" && (input.trim().length > 0 || effectiveContext.length > 0);

  const canSendArchitect =
    effectiveMode === "architect" && architectReady && (input.trim().length > 0 || effectiveContext.length > 0);

  const canSendConsultant = effectiveMode === "consultant" && input.trim().length > 0;

  const canSend =
    effectiveMode === "expert"
      ? canSendExpert
      : effectiveMode === "architect"
        ? canSendArchitect
        : canSendConsultant;

  function resetArchitectPicker() {
    setArchCategory(architectCategoryLock ?? null);
    setArchStage(null);
    setLastResult(null);
    setError("");
  }

  function switchEducatorMode(next: "consultant" | "architect") {
    setMode(next);
    resetArchitectPicker();
    setLastResult(null);
    setError("");
  }

  function resolveOutgoingMessage(): string {
    const trimmed = input.trim();
    if (trimmed) return trimmed;
    if (effectiveMode === "expert" && effectiveContext) {
      return EXPERT_DEFAULT_PROMPTS[expertProtocol] || EXPERT_DEFAULT_PROMPTS.audit;
    }
    if (effectiveMode === "architect" && effectiveContext) {
      return ARCHITECT_DEFAULT_PROMPT;
    }
    return "";
  }

  const messagePlaceholder = educatorLite
    ? effectiveMode === "architect"
      ? t("Например: профилактическая группа 5–7 кл., тревожность перед контрольными, 90 минут…", "For example: preventive group 5-7 grades, anxiety before tests, 90 minutes...")
      : t("Опишите ситуацию без имён: что происходит, что уже пробовали…", "Describe the situation without names: what is happening, what have you tried...")
    : effectiveMode === "expert"
      ? t("Комментарий к материалу (необязательно, если файл уже приложен)…", "Comment on the material (optional if file is already attached)...")
      : effectiveMode === "architect"
        ? t("Опишите задачу, тему или уточните черновик…", "Describe the task, theme, or clarify the draft...")
        : t("Вопрос или задача…", "Question or task...");

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
      if (effectiveMode === "expert" && expertProtocol === "audit") {
        setAttachStatus(
          (prev) =>
            `${prev || ""} ${t("Выберите «Методический аудит» и нажмите «Запустить экспертизу», если ещё не отправляли.", "Select «Methodological audit» and press «Run expertise» if you haven't sent it yet.")}`,
        );
      }
    } catch (err) {
      setAttachStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setAttachBusy(false);
      e.target.value = "";
    }
  }

  async function handleSend() {
    if (!canSend || busy) return;
    const outgoing = resolveOutgoingMessage();
    if (!outgoing) return;
    if (effectiveMode === "architect" && !architectDocType) return;

    setBusy(true);
    setError("");
    try {
      const result = await sendAiTurn({
        mode: effectiveMode,
        message: outgoing,
        context: effectiveContext,
        expertProtocol,
        architectDocType: architectDocType || "group_plan",
        consultantSub: supervisorOnly
          ? "supervision"
          : educatorLite
            ? "educator"
            : effectiveMode === "consultant"
              ? consultantSub
              : undefined,
        educatorLite,
        installId,
        terminalUserId,
        lang,
      });
      setLastResult(result);
      setInput("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ai_error";
      onAiError?.(msg);
      if (msg === "educator_rate_limited") {
        setError(t("Достигнут суточный лимит бесплатных запросов (20/сутки).", "Daily limit of free requests reached (20/day)."));
      } else if (msg === "subscription_required") {
        setError(t("Нужна подписка ИИ для этого режима.", "AI subscription is required for this mode."));
      } else {
        setError(msg);
      }
      setLastResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleFixInArchitect() {
    if (!canFixInArchitect || handoffBusy) return;
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
        title: segments.title || t("Документ ИИ", "AI Document"),
        segments,
        rawFallback: lastResult.raw_text || lastResult.reply,
      });
      const targetPath = await save({
        defaultPath: buildArchitectFileName(architectDocType || "consultation_plan"),
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

  const panelTitle = architectCategoryLock === "safety"
    ? t("Безопасная среда", "Safe environment")
    : (architectCategoryLock === "ipr" || architectCategoryLock === "ipr_report") ? t("ИИ: план и отчёт IPP", "AI: IPP plan and report")
      : supervisorOnly
      ? t("ИИ-супервизор", "AI Supervisor")
      : educatorLite
        ? t("ИИ-помощник педагога", "AI Educator Assistant")
        : sidebarMode
          ? MODE_TITLES[effectiveMode]
          : t("ИИ-помощник", "AI Assistant");

  const panelHint =
    architectCategoryLock === "safety"
      ? t("План или отчёт профилактической программы организации. Приложите черновик (.docx / .pdf) или опишите задачу.", "Plan or report of the organization's preventive program. Attach a draft (.docx / .pdf) or describe the task.")
      : (architectCategoryLock === "ipr" || architectCategoryLock === "ipr_report") ? t("План IPP или отчёт о реализации. Приложите черновик (.docx / .pdf) или опишите контекст кейса.", "IPP plan or implementation report. Attach a draft (.docx / .pdf) or describe the context of the case.")
        : sidebarMode
        ? MODE_HINTS[effectiveMode]
        : null;

  const sendLabel =
    effectiveMode === "expert"
      ? busy
        ? "…"
        : t("Запустить экспертизу", "Run expertise")
      : busy
        ? "…"
        : t("Отправить", "Send");

  return (
    <section className="card ai-modes-panel">
      <h2>{panelTitle}</h2>

      {panelHint && <p className="muted ai-mode-hint">{panelHint}</p>}

      {handoffNotice && effectiveMode === "architect" && (
        <div className="ai-handoff-banner" role="status">
          <p>{handoffNotice}</p>
          {onHandoffConsumed && (
            <button type="button" className="ai-attach-clear" onClick={onHandoffConsumed}>
              {t("Понятно", "Got it")}
            </button>
          )}
        </div>
      )}

      {!supervisorOnly && educatorLite && (
        <div className="educator-mode-switch" role="tablist" aria-label={t("Режим педагога", "Educator mode")}>
          <div className={`educator-mode-switch__thumb ${effectiveMode === "architect" ? "is-plan" : "is-case"}`} aria-hidden />
          <button
            type="button"
            role="tab"
            className={`educator-mode-switch__option is-case ${effectiveMode === "consultant" ? "active" : ""}`}
            onClick={() => switchEducatorMode("consultant")}
          >
            <span className="educator-mode-switch__label">{EDUCATOR_LITE_TABS.case}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={`educator-mode-switch__option is-plan ${effectiveMode === "architect" ? "active" : ""}`}
            onClick={() => switchEducatorMode("architect")}
          >
            <span className="educator-mode-switch__label">{EDUCATOR_LITE_TABS.groupPlan}</span>
          </button>
        </div>
      )}

      {!supervisorOnly && !educatorLite && !sidebarMode && (
        <div className="ai-mode-tabs">
          <button type="button" className={mode === "consultant" ? "active" : ""} onClick={() => setMode("consultant")}>
            {t("Спросить", "Ask")}
          </button>
          <button type="button" className={mode === "expert" ? "active" : ""} onClick={() => setMode("expert")}>
            {t("Эксперт", "Expert")}
          </button>
          <button type="button" className={mode === "architect" ? "active" : ""} onClick={() => setMode("architect")}>
            {t("Архитектор", "Architect")}
          </button>
        </div>
      )}

      {educatorLite && !supervisorOnly && (
        <p className="muted educator-lite-mode-hint">
          {effectiveMode === "architect" ? EDUCATOR_LITE_HINTS.groupPlan : EDUCATOR_LITE_HINTS.case}
        </p>
      )}

      {effectiveMode === "expert" && !educatorLite && !supervisorOnly && (
        <div className="consultant-sub-chips" role="group" aria-label={t("Протокол экспертизы", "Expertise protocol")}>
          {EXPERT_PROTOCOL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={expertProtocol === opt.id ? "active" : ""}
              title={opt.hint}
              onClick={() => setExpertProtocol(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {effectiveMode === "architect" && !educatorLite && !supervisorOnly && (
        <div className="architect-picker">
          {!archCategory && !architectCategoryLock && (
            <>
              <p className="architect-picker-label">{t("Категория документа", "Document category")}</p>
              <div className="consultant-sub-chips" role="group" aria-label={t("Категория документа", "Document category")}>
                {ARCHITECT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    title={cat.hint}
                    onClick={() => {
                      setArchCategory(cat.id);
                      setArchStage(null);
                      setLastResult(null);
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {archCategory && !archStage && (
            <>
              <p className="architect-picker-label">
                {architectCategoryLock === "safety"
                  ? t("Профилактическая программа организации: план или отчёт?", "Organization's preventive program: plan or report?")
                  : architectCategoryLock === "ipr"
                    ? t("ИПР: план или отчёт о реализации?", "IDP: plan or implementation report?")
                    : `${ARCHITECT_CATEGORIES.find((c) => c.id === archCategory)?.label}: ${t("план или отчёт?", "plan or report?")}`}
              </p>
              <div className="consultant-sub-chips" role="group" aria-label={t("Формат документа", "Document format")}>
                {ARCHITECT_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      setArchStage(stage.id);
                      setLastResult(null);
                    }}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
              {!architectCategoryLock && (
                <button type="button" className="ai-attach-clear" onClick={() => setArchCategory(null)}>
                  ← {t("Другая категория", "Another category")}
                </button>
              )}
            </>
          )}

          {architectDocType && (
            <div className="architect-picker-selected">
              <span className="architect-picker-doc">{architectDocLabel(architectDocType)}</span>
              <button type="button" className="ai-attach-clear" onClick={resetArchitectPicker}>
                {t("Сменить тип документа", "Change document type")}
              </button>
            </div>
          )}
        </div>
      )}

      {supervisorOnly && (
        <p className="muted">
          {t("Контекст дашборда (без персональных данных). Спросите о нагрузке, приоритетах или интерпретации сводки.", "Dashboard context (without personal data). Ask about workload, priorities, or summary interpretation.")}
        </p>
      )}

      {effectiveMode === "consultant" && !educatorLite && !supervisorOnly && (
        <div className="consultant-sub-chips" role="group" aria-label={t("Режим консультанта", "Consultant mode")}>
          {CONSULTANT_SUB_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={consultantSub === opt.id ? "active" : ""}
              title={opt.hint}
              onClick={() => setConsultantSub(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {showAttach && (
        <div className="ai-attach-row">
          <label className="ai-attach-btn">
            <input type="file" accept=".docx,.pdf" hidden disabled={attachBusy} onChange={onAttachFile} />
            {attachBusy ? t("Загрузка…", "Loading...") : t("Прикрепить файл", "Attach file")}
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
      )}

      {(architectReady || effectiveMode !== "architect") && (
        <label className="field educator-input-field">
          <span>
            {educatorLite
              ? effectiveMode === "architect"
                ? t("Задача для плана", "Task for the plan")
                : t("Ваш случай", "Your case")
              : effectiveMode === "expert"
                ? t("Комментарий", "Comment")
                : t("Сообщение", "Message")}
          </span>
          <textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder={messagePlaceholder} />
        </label>
      )}

      <div className="ai-action-row">
        <button type="button" className="ob-btn" disabled={busy || !canSend} onClick={handleSend}>
          {sendLabel}
        </button>
        {canFixInArchitect && (
          <button type="button" className="ob-btn secondary" disabled={handoffBusy} onClick={handleFixInArchitect}>
            {handoffBusy ? "…" : t("Создать документ на основе экспертизы", "Create a document based on expertise")}
          </button>
        )}
        {(canExportDocx || showGroupExport) && (
          <button type="button" className="ob-btn secondary" disabled={exportBusy} onClick={handleExportDocx}>
            {exportBusy ? "…" : t("Сохранить DOCX", "Save DOCX")}
          </button>
        )}
      </div>

      {error && <p className="ai-error">{error}</p>}
      {lastResult?.reply && <pre className="ai-reply">{lastResult.reply}</pre>}
    </section>
  );
}
