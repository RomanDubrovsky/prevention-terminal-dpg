import { useMemo, useState } from "react";
import { SendOnEnterToggle, useSendOnEnter } from "./SendOnEnterToggle.tsx";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import { resolveArchitectDocType, type ArchitectCategoryId, type ArchitectStageId } from "../lib/architect_picker.ts";
import {
  buildArchitectFileName,
  packArchitectDocx,
  type ArchitectSegments,
} from "../lib/architect_docx_export.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";
import { sectionArchitectPrompt, sendAiTurn, fixInArchitect, type AiTurnResult } from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import type { ArchitectBridgeMode } from "../lib/expert_bridge.ts";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";

export interface SectionArchitectPanelProps {
  terminalUserId?: string;
  subscriptionActive: boolean;
  paywallUrl: string;
  category: ArchitectCategoryId;
  documentContext: string;
  planButtonLabel: string;
  reportButtonLabel: string;
  cardSaved: boolean;
  /** Shown on disabled plan/report buttons before card is saved. */
  aiLockedReason?: string;
  savedPlanText?: string;
  savedReportText?: string;
  manualPlanText?: string;
  manualReportText?: string;
  onManualPlanChange?: (text: string) => void;
  onManualReportChange?: (text: string) => void;
  handoffNotice?: string | null;
  onHandoffConsumed?: () => void;
  onSaveToCard: (stage: ArchitectStageId, text: string, segments?: Record<string, string>) => Promise<void>;
  sectionHint?: string;
  /** expert = include saved expert artifacts in context; card_only = group work */
  bridgeMode?: ArchitectBridgeMode;
  /** Full context for architect (card + expert bridge + prior visits). Overrides documentContext when set. */
  architectContext?: string;
  showPlanSection?: boolean;
  showReportSection?: boolean;
  /** Скрыть заголовок «Архитектор» (групповая работа и др.). */
  hideBranding?: boolean;
  /** Подсказка вместо стандартной под заголовком. */
  panelIntro?: string;
  /** Крупнее кнопка плана / отчёта. */
  emphasizeModeButtons?: boolean;
}

function documentText(result: AiTurnResult): string {
  if (result.raw_text?.trim()) return result.raw_text.trim();
  if (result.segments) {
    return Object.values(result.segments)
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return result.reply.trim();
}

const STAGE_HINTS: Record<ArchitectCategoryId, Record<ArchitectStageId, string>> = {
  group: {
    plan: "Опишите группу, цель и контекст — бот уточнит детали и предложит план с этапами и упражнениями.",
    report: "Отчёт строится из карточки, заметок и сохранённого плана. Уточните, что включить в итоговый документ.",
  },
  consultation: {
    plan: "План консультации / сопровождения: цели, формат встреч, методы. Можно без ИИ — вставьте текст в поле ниже.",
    report: "Отчёт по сессии и кейсу. Учитываются протокол, экспертные заключения и сохранённый план.",
  },
  ipr: {
    plan: "План ИПР: цели маршрута, шаги, сроки. Можно заполнить вручную в поле «План в карточке».",
    report: "Отчёт о реализации ИПР: выполненные шаги, динамика, рекомендации.",
  },
  ipr_report: {
    plan: "Отчёт о реализации ИПР: выполненные шаги, динамика, рекомендации.",
    report: "Отчёт о реализации ИПР: выполненные шаги, динамика, рекомендации.",
  },
  safety: {
    plan: "План профилактической программы организации. Можно вести карточку без ИИ — текст плана сохраняется локально.",
    report: "Отчёт о реализации программы: охват, эффекты, корректировки.",
  },
};

export default function SectionArchitectPanel(props: SectionArchitectPanelProps) {
  const {
    terminalUserId,
    subscriptionActive,
    category,
    documentContext,
    planButtonLabel,
    reportButtonLabel,
    cardSaved,
    savedPlanText = "",
    savedReportText = "",
    manualPlanText,
    manualReportText,
    onManualPlanChange,
    onManualReportChange,
    handoffNotice = null,
    onHandoffConsumed,
    onSaveToCard,
    sectionHint,
    bridgeMode = "expert",
    architectContext,
    showPlanSection = true,
    showReportSection = true,
    hideBranding = false,
    panelIntro,
    emphasizeModeButtons = false,
  } = props;

  const aiLockedReason =
    props.aiLockedReason ??
    (hideBranding
      ? "Сначала сохраните паспорт плана — затем откроется генерация с ИИ."
      : "Сохраните черновик карточки — затем откроется конструктор документов.");

  const baseDocumentContext = architectContext ?? documentContext;

  const [activeStage, setActiveStage] = useState<ArchitectStageId | null>(null);
  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<AiTurnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const { handleKeyDown: onEnterKeyDown } = useSendOnEnter();
  const [manualSaveBusy, setManualSaveBusy] = useState(false);
  const [error, setError] = useState("");
  const [paywallHint, setPaywallHint] = useState<string | null>(null);

  const lang = getTerminalEdition() === "ru" ? "ru" : "en";
  const architectDocType = activeStage ? resolveArchitectDocType(category, activeStage) : null;

  const stageHint = useMemo(() => {
    if (!activeStage) return sectionHint || "";
    return STAGE_HINTS[category]?.[activeStage] || "";
  }, [activeStage, category, sectionHint]);

  const showManualFields = cardSaved && onManualPlanChange && onManualReportChange;

  function openStage(stage: ArchitectStageId) {
    if (!subscriptionActive) {
      setPaywallHint(
        "Подписка ИИ нужна для конструктора документов. Оформите подписку в настройках или на странице оплаты ИРПП.",
      );
      return;
    }
    if (!cardSaved) {
      setError(aiLockedReason);
      return;
    }
    setPaywallHint(null);
    setError("");
    setActiveStage(stage);
    setLastResult(null);
    setInput("");
    if (bridgeMode === "expert") {
      void syncServerExpertHandoff();
    }
  }

  async function syncServerExpertHandoff() {
    try {
      await fixInArchitect(lang);
    } catch {
      /* saved expert block in architectContext is enough */
    }
  }

  async function handleSend() {
    if (!activeStage || !architectDocType || busy) return;
    const trimmed = input.trim();
    const outgoing = trimmed || sectionArchitectPrompt(category, activeStage);
    if (!outgoing) return;

    setBusy(true);
    setError("");
    try {
      const result = await sendAiTurn({
        mode: "architect",
        message: outgoing,
        context: baseDocumentContext,
        architectDocType,
        terminalUserId,
        lang,
      });
      setLastResult(result);
      setInput("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "subscription_required") {
        setPaywallHint("Подписка ИИ не активна. Откройте блок оплаты в настройках терминала.");
      } else {
        setError(msg);
      }
      setLastResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleExportDocx() {
    if (!lastResult || !architectDocType || exportBusy) return;
    setExportBusy(true);
    setError("");
    try {
      const segments = (lastResult.segments || {}) as ArchitectSegments;
      const buffer = await packArchitectDocx({
        title: segments.title || planButtonLabel,
        segments,
        rawFallback: lastResult.raw_text || lastResult.reply,
      });
      const targetPath = await save({
        defaultPath: buildArchitectFileName(architectDocType),
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
    if (!lastResult || !activeStage || saveBusy) return;
    setSaveBusy(true);
    setError("");
    try {
      await onSaveToCard(activeStage, documentText(lastResult), lastResult.segments);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleManualSave(stage: ArchitectStageId) {
    if (!showManualFields || manualSaveBusy) return;
    const text = stage === "plan" ? (manualPlanText ?? "") : (manualReportText ?? "");
    if (!text.trim()) {
      setError("Введите текст для сохранения.");
      return;
    }
    setManualSaveBusy(true);
    setError("");
    try {
      await onSaveToCard(stage, text.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setManualSaveBusy(false);
    }
  }

  const canActOnResult = Boolean(lastResult && (lastResult.raw_text || lastResult.segments || lastResult.reply));

  return (
    <div className="section-architect-panel">
      {!hideBranding && <h4>Архитектор</h4>}
      <p className="muted tiny">
        {panelIntro ??
          (bridgeMode === "card_only"
            ? "План и отчёт по данным карточки и чату (без экспертиз)."
            : "План и отчёт учитывают карточку, сохранённые экспертизы по личному делу и чат. Без подписки — ручной ввод ниже.")}
      </p>

      {bridgeMode === "expert" && cardSaved && !hideBranding && (
        <p className="muted tiny section-architect-bridge-hint">
          При открытии плана или отчёта подставляются все сохранённые экспертизы по делу.
        </p>
      )}

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

      <div className="section-architect-mode-row">
        {showPlanSection && (
        <button
          type="button"
          className={`section-architect-mode${activeStage === "plan" ? " active" : ""}${!subscriptionActive ? " locked" : ""}${emphasizeModeButtons ? " section-architect-mode--cta" : ""}`}
          disabled={!cardSaved && subscriptionActive}
          title={!cardSaved ? aiLockedReason : undefined}
          onClick={() => openStage("plan")}
        >
          {planButtonLabel}
        </button>
        )}
        {showReportSection && (
        <button
          type="button"
          className={`section-architect-mode${activeStage === "report" ? " active" : ""}${!subscriptionActive ? " locked" : ""}${emphasizeModeButtons ? " section-architect-mode--cta" : ""}`}
          disabled={!cardSaved && subscriptionActive}
          title={!cardSaved ? aiLockedReason : undefined}
          onClick={() => openStage("report")}
        >
          {reportButtonLabel}
        </button>
        )}
      </div>

      {(savedPlanText || savedReportText) && (
        <p className="muted tiny section-architect-saved-hint">
          {savedPlanText ? "План сохранён в карточке. " : ""}
          {savedReportText ? "Отчёт сохранён в карточке." : ""}
        </p>
      )}

      {showManualFields && (showPlanSection || showReportSection) && (
        <div className="section-architect-manual">
          {showPlanSection && (
          <>
          <label className="field">
            <span>План в карточке (вручную, без ИИ)</span>
            <textarea
              rows={3}
              value={manualPlanText ?? ""}
              onChange={(e) => onManualPlanChange!(e.target.value)}
              placeholder="Вставьте или напишите план…"
            />
          </label>
          <button
            type="button"
            className="ob-btn secondary tiny-btn"
            disabled={manualSaveBusy || !cardSaved}
            onClick={() => void handleManualSave("plan")}
          >
            Сохранить план
          </button>
          </>
          )}
          {showReportSection && (
          <>
          <label className="field">
            <span>Отчёт в карточке (вручную, без ИИ)</span>
            <textarea
              rows={3}
              value={manualReportText ?? ""}
              onChange={(e) => onManualReportChange!(e.target.value)}
              placeholder="Вставьте или напишите отчёт…"
            />
          </label>
          <button
            type="button"
            className="ob-btn secondary tiny-btn"
            disabled={manualSaveBusy || !cardSaved}
            onClick={() => void handleManualSave("report")}
          >
            Сохранить отчёт
          </button>
          </>
          )}
        </div>
      )}

      {!cardSaved && (
        <p className="muted tiny">
          {hideBranding ? "Сохраните паспорт плана выше, чтобы открыть генерацию с ИИ." : "Сохраните карточку выше, чтобы открыть конструктор."}
        </p>
      )}
      {paywallHint && <p className="ai-error">{paywallHint}</p>}
      {paywallHint && !subscriptionActive && terminalUserId && (
        <AiSubscriptionPaywall
          terminalUserId={terminalUserId}
          compact
          soft
          context="Конструктор документов (план и отчёт) доступен по подписке ИИ."
          onDismiss={() => setPaywallHint(null)}
        />
      )}

      {activeStage && subscriptionActive && cardSaved && (
        <div className="section-architect-chat">
          <p className="muted tiny">{stageHint}</p>
          <label className="field">
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Сообщение</span>
              <SendOnEnterToggle />
            </span>
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => onEnterKeyDown(e, () => void handleSend())}
              placeholder={
                activeStage === "plan"
                  ? "Опишите задачу, контекст, ограничения…"
                  : "Что включить в отчёт: факты, динамика, следующий шаг…"
              }
            />
          </label>
          <div className="ai-action-row">
            <button type="button" className="ob-btn" disabled={busy} onClick={() => void handleSend()}>
              {busy ? "…" : "Отправить"}
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
          </div>
          {error && <p className="ai-error">{error}</p>}
          {lastResult?.reply && <pre className="ai-reply">{lastResult.reply}</pre>}
        </div>
      )}
      {!activeStage && error && <p className="ai-error">{error}</p>}
    </div>
  );
}
