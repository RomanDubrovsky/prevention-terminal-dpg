import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import CaseExpertisePanel from "./CaseExpertisePanel.tsx";
import { getCaseArtifacts, type CaseArtifactsPayload } from "../lib/case_store.ts";
import { type ExpertArtifact, type ExpertProtocolId } from "../lib/section_artifacts.ts";
import { buildArchitectFileName, packArchitectDocx, type ArchitectSegments } from "../lib/architect_docx_export.ts";
import { arrayBufferToBase64 } from "../lib/docx_export.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { getDomainConfig } from "../lib/domain/index.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { t } from "../lib/i18n.ts";

interface ConsultationExpertisePanelProps {
  cfg: TerminalConfig;
  caseId: string;
}

const EXPERT_DOC_SLUG: Record<ExpertProtocolId, string> = {
  child_profile: "Harakteristika",
  conclusion: "025u",
  fba: "FAP",
  bip: "BIP",
  mdr: "PPk",
  audit: "Audit",
  program_audit: "ProgramAudit",
};

const EXPERT_ORDER: ExpertProtocolId[] = [
  "child_profile",
  "conclusion",
  "fba",
  "bip",
  "mdr",
];

function docFileName(slug: string, iso?: string): string {
  const safe = slug.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 32) || "document";
  const stamp = (iso || new Date().toISOString()).slice(0, 10);
  return `Expertise_${safe}_${stamp}`;
}

function expertLabel(id: string): string {
  if (id === "child_profile") return t("Характеристика", "Profile");
  if (id === "conclusion") return t("Заключение", "Conclusion");
  if (id === "fba") return "FBA";
  if (id === "bip") return "BIP";
  if (id === "mdr") return t("ПМПК/ППк", "PMPC/PPk");
  if (id === "audit") return t("Аудит", "Audit");
  return t("Экспертиза", "Expertise");
}

async function downloadDocx(args: {
  title: string;
  fileStem: string;
  text: string;
  segments?: Record<string, string>;
}): Promise<void> {
  const segments = (args.segments || {}) as ArchitectSegments;
  const buffer = await packArchitectDocx({
    title: args.title,
    segments: Object.keys(segments).length ? segments : { conclusion: args.text },
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

export default function ConsultationExpertisePanel(props: ConsultationExpertisePanelProps) {
  const { cfg, caseId } = props;
  const commercial = isCommercialOrg(cfg);
  
  const [artifacts, setArtifacts] = useState<CaseArtifactsPayload>({});
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const arts = await getCaseArtifacts(caseId);
      setArtifacts(arts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [caseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const expertDocs = useMemo(() => {
    const expert = artifacts.expert || {};
    const rows: { id: ExpertProtocolId; artifact: ExpertArtifact; fileStem: string }[] = [];
    for (const id of EXPERT_ORDER) {
      const artifact = expert[id];
      if (!artifact?.text?.trim()) continue;
      rows.push({
        id,
        artifact,
        fileStem: docFileName(EXPERT_DOC_SLUG[id], artifact.saved_at),
      });
    }
    return rows;
  }, [artifacts.expert]);

  return (
    <div className="consultation-expertise-view">
      <section className="card consultation-expertise-block">
        <CaseExpertisePanel
          caseId={caseId}
          terminalUserId={cfg.terminal_user_id}
          commercial={commercial}
          embedded
          title={t("Экспертизы", "Expertise")}
          intro={
            commercial
              ? t("Заключения по этой карточке. Результат сохраняется в карточку (текст + структура для учёта).", "Conclusions for this card. The result is saved to the card (text + structure for accounting).")
              : t("Индивидуальные заключения. Результат сохраняется в карточку (текст + структура для учёта).", "Individual conclusions. The result is saved to the card (text + structure for accounting).")
          }
          protocolFilter={
            commercial
              ? [
                  { id: "child_profile", label: t("Характеристика", "Profile") },
                  { id: "conclusion", label: t("Заключение", "Conclusion") },
                  { id: "fba", label: t("Анализ случая", "Case analysis") },
                  { id: "audit", label: t("Методический разбор", "Methodological analysis") },
                ]
              : getDomainConfig().protocols.caseExpertise.filter((p: any) => ["child_profile", "conclusion", "fba", "mdr"].includes(p.id)) as { id: ExpertProtocolId, label: string }[]
          }
          onExpertUpdated={() => void reload()}
        />
        {expertDocs.length > 0 && (
          <div className="consultation-doc-links" style={{ marginTop: '20px' }}>
            <h4>{t("Документы", "Documents")}</h4>
            <ul>
              {expertDocs.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="linkish consultation-doc-link"
                    onClick={() =>
                      setPreviewDoc({
                        title: `${row.fileStem}.docx · ${expertLabel(row.id)}`,
                        text: row.artifact.text,
                      })
                    }
                  >
                    {row.fileStem}.docx
                  </button>
                  <button
                    type="button"
                    className="ob-btn secondary tiny"
                    onClick={() =>
                      void downloadDocx({
                        title: expertLabel(row.id),
                        fileStem: row.fileStem,
                        text: row.artifact.text,
                        segments: row.artifact.segments,
                      })
                    }
                  >
                    {t("Скачать", "Download")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>{previewDoc.title}</h3>
              <button type="button" className="icon-btn" onClick={() => setPreviewDoc(null)}>✕</button>
            </header>
            <div className="modal-body docx-preview-text">
              <pre>{previewDoc.text}</pre>
            </div>
            <footer className="modal-footer">
              <button type="button" className="ob-btn secondary" onClick={() => setPreviewDoc(null)}>
                {t("Закрыть", "Close")}
              </button>
            </footer>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
