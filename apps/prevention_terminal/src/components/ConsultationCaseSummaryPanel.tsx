import { useCallback, useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import DocumentSmartChat from "./DocumentSmartChat.tsx";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import {
  buildArchitectFileName,
  packArchitectDocx,
} from "../lib/architect_docx_export.ts";
import { type ArchitectStageId } from "../lib/architect_picker.ts";
import { appendDictatedChunk, architectDocStem } from "../lib/ai_text_utils.ts";
import { buildCaseBrainContext } from "../lib/case_brain_context.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import {
  emptyConsultationCaseSummary,
  loadConsultationCaseSummary,
  saveConsultationCaseSummary,
  type ConsultationCaseSummary,
} from "../lib/consultation_case_summary.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";
import {
  type CaseSummaryAiBlock,
} from "../lib/summary_block_ai.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { t } from "../lib/i18n.ts";
import { AI_NARRATIVE_HINT_FILL } from "../lib/consultation_copy.ts";

interface ConsultationCaseSummaryPanelProps {
  cfg: TerminalConfig;
  caseId: string;
  onSaved?: () => void;
}

const SUMMARY_BLOCKS: {
  id: CaseSummaryAiBlock;
  title: string;
  textKey: "conclusions" | "dynamics" | "recommendations" | "homework";
  notesKey: "conclusions_notes" | "dynamics_notes" | "recommendations_notes" | "homework_notes";
  placeholder: string;
  notesPlaceholder: string;
}[] = [
  {
    id: "conclusions",
    title: t("Текущие выводы", "Current conclusions"),
    textKey: "conclusions",
    notesKey: "conclusions_notes",
    placeholder: t("Выводы по делу…", "Case conclusions..."),
    notesPlaceholder: t("Краткие заметки по выводам…", "Brief notes on conclusions..."),
  },
  {
    id: "dynamics",
    title: t("Динамика", "Dynamics"),
    textKey: "dynamics",
    notesKey: "dynamics_notes",
    placeholder: t("Что изменилось с карточки / прошлых визитов…", "Changes since the card / previous visits..."),
    notesPlaceholder: t("Заметки по динамике…", "Dynamics notes..."),
  },
  {
    id: "recommendations",
    title: t("Рекомендации", "Recommendations"),
    textKey: "recommendations",
    notesKey: "recommendations_notes",
    placeholder: t("Рекомендации клиенту, семье, организации…", "Recommendations for client, family, organization..."),
    notesPlaceholder: t("Заметки для рекомендаций…", "Notes for recommendations..."),
  },
  {
    id: "homework",
    title: t("Задания на дом / удержание", "Homework / retention"),
    textKey: "homework",
    notesKey: "homework_notes",
    placeholder: t("Домашние задания, материалы для клиента…", "Homework, materials for client..."),
    notesPlaceholder: t("Заметки по домашнему заданию…", "Homework notes..."),
  },
];


function docFileName(slug: string, iso?: string): string {
  return architectDocStem(slug, iso);
}

async function downloadDocx(args: {
  title: string;
  fileStem: string;
  text: string;
}): Promise<void> {
  const buffer = await packArchitectDocx({
    title: args.title,
    segments: { conclusion: args.text },
    rawFallback: args.text,
  });
  try {
    const targetPath = await save({
      defaultPath: buildArchitectFileName("consultation_report").replace(
        /consultation_report/i,
        args.fileStem,
      ),
      filters: [{ name: "Word document", extensions: ["docx"] }],
    });
    if (targetPath) {
      await invoke("save_docx", {
        targetPath,
        base64Data: arrayBufferToBase64(buffer),
      });
      return;
    }
  } catch {
    /* web staging — fall through to browser download */
  }
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.fileStem}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConsultationCaseSummaryPanel(props: ConsultationCaseSummaryPanelProps) {
  const { cfg, caseId, onSaved } = props;
  const commercial = isCommercialOrg(cfg);
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(cfg.terminal_user_id);
  const [draft, setDraft] = useState<ConsultationCaseSummary>(() => emptyConsultationCaseSummary());
  const [caseContext, setCaseContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const [summary, ctx] = await Promise.all([
        loadConsultationCaseSummary(caseId),
        buildCaseBrainContext(caseId, { commercial }),
      ]);
      setDraft(summary);
      setCaseContext(ctx);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [caseId, commercial]);

  useEffect(() => {
    void reload();
  }, [reload]);



  const reportFileStem = draft.report_text?.trim()
    ? docFileName("Otchet", draft.report_created_at || draft.updated_at)
    : null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveConsultationCaseSummary(caseId, draft);
      setMessage(t("Сводка сохранена.", "Summary saved."));
      onSaved?.();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAiDoc(stage: ArchitectStageId, text: string, segments?: Record<string, string>) {
    if (stage === "report") {
      let nextDraft = { ...draft, report_text: text, report_created_at: new Date().toISOString() };
      if (segments) {
        if (segments.conclusions) nextDraft.conclusions = segments.conclusions;
        if (segments.dynamics) nextDraft.dynamics = segments.dynamics;
        if (segments.recommendations) nextDraft.recommendations = segments.recommendations;
        if (segments.homework) nextDraft.homework = segments.homework;
      }
      setDraft(nextDraft);
      try {
        await saveConsultationCaseSummary(caseId, nextDraft);
        setMessage(t("Отчёт создан и поля итогов заполнены.", "Report created and summary fields filled."));
        onSaved?.();
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  return (
    <div className="consultation-case-summary-view">
      <section className="card consultation-case-summary">
        <h3>{t("Итог (Сводка)", "Summary")}</h3>
        <p className="muted tiny" style={{ marginBottom: 20 }}>
          {AI_NARRATIVE_HINT_FILL} {t("(слева вносите заметки, либо используйте ИИ-чат ниже для автоматического заполнения).", "(add notes on the left, or use the AI chat below for auto-fill).")}
        </p>
        
        <DocumentSmartChat
          terminalUserId={cfg.terminal_user_id}
          subscriptionActive={subscriptionActive}
          paywallUrl={paywallUrl}
          category="consultation"
          documentContext={caseContext}
          cardSaved={true}
          onApplyResult={handleSaveAiDoc}
          showPlanButton={false}
          showReportButton={true}
          reportButtonLabel={t("Создать отчет и заполнить итоги", "Create report and fill summary")}
        />
        
        {reportFileStem && (
          <div className="consultation-doc-links" style={{ marginBottom: '20px' }}>
            <h4>{t("Сформированные документы", "Generated documents")}</h4>
            <ul>
              <li>
                <button
                  type="button"
                  className="linkish consultation-doc-link"
                  onClick={() =>
                    setPreviewDoc({
                      title: `${reportFileStem}.docx · Отчёт`,
                      text: draft.report_text || "",
                    })
                  }
                >
                  {reportFileStem}.docx
                </button>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  onClick={() =>
                    void downloadDocx({
                      title: "Отчёт по делу",
                      fileStem: reportFileStem,
                      text: draft.report_text || "",
                    })
                  }
                >
                  Скачать
                </button>
              </li>
            </ul>
          </div>
        )}

        {previewDoc && (
          <details className="consultation-doc-preview" style={{ marginBottom: '20px' }} open>
            <summary>{previewDoc.title}</summary>
            <pre className="ai-reply compact">{previewDoc.text}</pre>
            <button type="button" className="ob-btn secondary tiny" onClick={() => setPreviewDoc(null)}>
              {t("Скрыть", "Hide")}
            </button>
          </details>
        )}

        {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

        <form className="consultation-summary-form" onSubmit={(e) => void handleSave(e)}>
          {SUMMARY_BLOCKS.map((block) => {
            const textVal = String(draft[block.textKey] ?? "");
            const notesVal = String(draft[block.notesKey] ?? "");

            return (
              <div key={block.id} className="summary-split-block" style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="field intake-field">
                    <span>{block.title} {t("(заметки)", "(notes)")}</span>
                    <textarea
                      rows={5}
                      value={notesVal}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [block.notesKey]: e.target.value }))
                      }
                      placeholder={block.notesPlaceholder}
                    />
                  </label>
                  <div className="workspace-actions">
                    <SpeechDictationButton
                      onText={(chunk) => setDraft((d) => ({ ...d, [block.notesKey]: appendDictatedChunk(String(d[block.notesKey] ?? ""), chunk) }))}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="field intake-field">
                    <span>{t("Итог: ", "Result: ")}{block.title}</span>
                    <textarea
                      rows={5}
                      value={textVal}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [block.textKey]: e.target.value }))
                      }
                      placeholder={block.placeholder}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <div className="workspace-actions" style={{ marginTop: '30px' }}>
            <button type="submit" className="ob-btn secondary" disabled={busy}>
              {busy ? t("Сохраняем…", "Saving...") : t("Сохранить сводку", "Save summary")}
            </button>
          </div>
        </form>

        {message && <p className="ok tiny">{message}</p>}
        {error && <p className="error">{error}</p>}
        {showPaywall && (
          <AiSubscriptionPaywall
            soft
            terminalUserId={cfg.terminal_user_id}
            context={t("Сводка и отчёт — по подписке ИИ.", "Summary and report — with AI subscription.")}
            onDismiss={() => setShowPaywall(false)}
            paywallUrl={paywallUrl}
          />
        )}
      </section>
    </div>
  );
}
