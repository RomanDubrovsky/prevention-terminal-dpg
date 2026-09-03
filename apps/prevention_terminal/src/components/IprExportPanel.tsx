/**
 * Phase 3.10 — demo-генерация ИПР через Cloudflare Worker + DOCX-экспорт.
 *
 * Цепочка:
 *   1) Запросить у Worker'а структурированный план (`requestArchitectPlan`).
 *      Если Worker недоступен — без падения сгенерировать тот же план
 *      локально (`buildMockIpr`), пометив источник как `local-fallback`.
 *   2) Спросить путь сохранения через нативный save-диалог.
 *   3) Собрать DOCX из плана (`packIprDocx`).
 *   4) Записать файл через Rust-команду `save_docx`.
 *
 * Никаких Gemini-ключей и персональных данных в этом пути нет: Worker в demo-режиме
 * возвращает каноничный mock-документ, а локальный санитайзер уже отрезал
 * ФИО на этапе карточки кейса.
 */

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import {
  requestArchitectPlan,
  type ArchitectResult,
} from "../lib/architect_client.ts";
import {
  arrayBufferToBase64,
  buildIprFileName,
  packIprDocx,
} from "../lib/docx_export.ts";

interface IprExportPanelProps {
  caseId: string;
}

type Stage =
  | "connecting"
  | "planning"
  | "packing"
  | "awaiting-path"
  | "saving";

type ExportState =
  | { kind: "idle" }
  | { kind: "running"; stage: Stage }
  | { kind: "saved"; path: string; source: ArchitectResult["source"]; notice?: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

const STAGE_LABEL: Record<Stage, string> = {
  connecting: "Подключение к Архитектору…",
  planning: "Получение плана…",
  packing: "Сборка DOCX…",
  "awaiting-path": "Выбор файла для сохранения…",
  saving: "Запись файла…",
};

export default function IprExportPanel(props: IprExportPanelProps) {
  const { caseId } = props;
  const [state, setState] = useState<ExportState>({ kind: "idle" });

  const handleGenerate = useCallback(async () => {
    setState({ kind: "running", stage: "connecting" });

    try {
      setState({ kind: "running", stage: "planning" });
      const architectResult = await requestArchitectPlan(caseId);

      setState({ kind: "running", stage: "awaiting-path" });
      const targetPath = await save({
        defaultPath: buildIprFileName(caseId),
        filters: [{ name: "Word document", extensions: ["docx"] }],
      });
      if (!targetPath) {
        setState({ kind: "cancelled" });
        return;
      }

      setState({ kind: "running", stage: "packing" });
      const buffer = await packIprDocx(architectResult.document);

      setState({ kind: "running", stage: "saving" });
      await invoke("save_docx", {
        targetPath,
        base64Data: arrayBufferToBase64(buffer),
      });

      setState({
        kind: "saved",
        path: targetPath,
        source: architectResult.source,
        notice: architectResult.notice,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: `Не удалось сформировать DOCX: ${String(err)}`,
      });
    }
  }, [caseId]);

  const buttonLabel =
    state.kind === "running" ? STAGE_LABEL[state.stage] : "Сформировать ИПР (demo)";

  return (
    <section className="card workspace-card ipr-export-card">
      <header className="workspace-card-header">
        <div>
          <h2>ИПР — demo через Архитектора</h2>
          <p className="muted">
            Worker возвращает структурированный план (mock-режим, без Gemini),
            Terminal собирает Word-документ локально. Если воркер недоступен —
            используется офлайн-копия плана.
          </p>
        </div>
        <span className="ipr-mode-badge">mock</span>
      </header>

      <div className="ipr-export-body">
        <div>
          <strong>Что попадёт в документ</strong>
          <p className="muted">
            Контекст, цели сопровождения, сигналы риска, план действий,
            мониторинг динамики и блок приватности.
          </p>
        </div>
        <button
          type="button"
          className="ipr-generate-button"
          onClick={handleGenerate}
          disabled={state.kind === "running"}
        >
          {buttonLabel}
        </button>
      </div>

      {state.kind === "saved" && (
        <p className={state.source === "worker" ? "ok" : "warn"}>
          DOCX сохранён: <code>{state.path}</code>
          <br />
          <span className="muted tiny">
            Источник плана:{" "}
            {state.source === "worker"
              ? "Cloudflare Worker (demo)"
              : "локальный fallback"}
            {state.notice ? `. ${state.notice}` : ""}
          </span>
        </p>
      )}
      {state.kind === "cancelled" && (
        <p className="muted tiny">Сохранение отменено пользователем.</p>
      )}
      {state.kind === "error" && <p className="error">{state.message}</p>}
    </section>
  );
}
