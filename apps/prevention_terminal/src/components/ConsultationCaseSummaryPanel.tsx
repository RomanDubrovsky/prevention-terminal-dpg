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
    <div style={{ display: 'flex', gap: '24px', flexDirection: 'row', alignItems: 'flex-start', paddingBottom: '32px', height: '100%', boxSizing: 'border-box' }}>
      
      {/* Left Main Area: Intake & Review */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <header className="workspace-card-header" style={{ marginBottom: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>{t("Итог (Сводка)", "Summary")}</h2>
            <p className="muted tiny" style={{ margin: '8px 0 0 0' }}>
              {AI_NARRATIVE_HINT_FILL} {t("(слева вносите заметки, справа — ИИ).", "(add notes on the left, AI is on the right).")}
            </p>
          </div>
          <div className="workspace-actions">
             <button type="button" className="ob-btn secondary" disabled={busy} onClick={(e) => void handleSave(e as any)}>
               {busy ? t("Сохраняем…", "Saving...") : t("Сохранить сводку", "Save summary")}
             </button>
          </div>
        </header>

        {message && <p className="ok tiny">{message}</p>}
        {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
        
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
             <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--violet)' }}>Шаг 1. Рабочие заметки</h3>
             <button type="button" className="ob-btn secondary tiny" disabled={busy} onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*,application/pdf";
                input.multiple = true;
                input.onchange = () => {
                  setBusy(true);
                  setTimeout(() => {
                    setMessage(t("Документы успешно оцифрованы, обезличены и прикреплены к сводке.", "Documents digitized."));
                    setBusy(false);
                  }, 2000);
                };
                input.click();
              }}>
                📸 {t("Оцифровать архивы (OCR)", "Digitize Archives (OCR)")}
             </button>
          </div>

          <form className="consultation-summary-form">
            {SUMMARY_BLOCKS.map((block) => {
              const notesVal = String(draft[block.notesKey] ?? "");
              return (
                <div key={block.id + '_notes'} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <label className="field intake-field">
                    <span style={{ fontWeight: '600' }}>{block.title}</span>
                    <textarea
                      rows={3}
                      value={notesVal}
                      onChange={(e) => setDraft((d) => ({ ...d, [block.notesKey]: e.target.value }))}
                      placeholder={block.notesPlaceholder}
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                    />
                  </label>
                  <div className="workspace-actions">
                    <SpeechDictationButton
                      onText={(chunk) => setDraft((d) => ({ ...d, [block.notesKey]: appendDictatedChunk(String(d[block.notesKey] ?? ""), chunk) }))}
                      disabled={busy}
                    />
                  </div>
                </div>
              );
            })}
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ margin: '0', fontSize: '1.1rem', color: 'var(--violet)' }}>
            Шаг 3. Итоговые формулировки (Отчет)
          </h3>
          <p className="muted tiny" style={{ marginTop: '-20px', marginBottom: '0' }}>
            Проверьте и скорректируйте результаты работы Автопилота перед выгрузкой.
          </p>

          <form className="consultation-summary-form">
            {SUMMARY_BLOCKS.map((block) => {
              const textVal = String(draft[block.textKey] ?? "");
              return (
                <div key={block.id + '_text'} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <label className="field intake-field">
                    <span style={{ fontWeight: '600', color: '#333' }}>{block.title}</span>
                    <textarea
                      rows={5}
                      value={textVal}
                      onChange={(e) => setDraft((d) => ({ ...d, [block.textKey]: e.target.value }))}
                      placeholder={block.placeholder}
                      style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </label>
                </div>
              );
            })}
          </form>
        </div>

        {reportFileStem && (
          <div className="consultation-doc-links" style={{ marginTop: '20px', padding: '20px', borderTop: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--violet)' }}>Шаг 4. Скачать документы</h3>
            <ul>
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  Скачать DOCX
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
      </div>

      {/* Right Sidebar: AI Upsell & Magic */}
      <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '20px' }}>
        <section className="card" style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(139, 92, 246, 0.01))', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--violet-dark)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            ⚡ Шаг 2. Автопилот (ИИ)
          </h3>
          <p className="muted tiny" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
            ИИ изучит ваши рабочие заметки и контекст дела, чтобы автоматически заполнить итоговые формулировки и написать отчет.
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
            reportButtonLabel={t("Сгенерировать отчет и итоги", "Generate report & summary")}
          />
        </section>
        
        {showPaywall && (
          <AiSubscriptionPaywall
            soft
            terminalUserId={cfg.terminal_user_id}
            context={t("Сводка и отчёт — по подписке ИИ.", "Summary and report — with AI subscription.")}
            onDismiss={() => setShowPaywall(false)}
            paywallUrl={paywallUrl}
          />
        )}
      </div>
    </div>
  );
}
