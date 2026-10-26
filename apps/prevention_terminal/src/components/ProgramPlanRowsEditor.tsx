import {
  formatPlanTextFromTable,
  normalizeProgramPlanTable,
  type ProgramPlanTable,
} from "../lib/program_plan_rows.ts";
import { t } from "../lib/i18n.ts";
import {
  PLAN_AI_PATH_HINT,
  PLAN_ROWS_FREE_HINT,
} from "../content/plan_workspace_copy.ts";

interface ProgramPlanRowsEditorProps {
  table: ProgramPlanTable;
  onChange: (next: ProgramPlanTable) => void;
  onImportFromAi?: () => void;
  importHint?: string;
  disabled?: boolean;
}

export default function ProgramPlanRowsEditor(props: ProgramPlanRowsEditorProps) {
  const { table, onChange, onImportFromAi, importHint, disabled } = props;
  const normalized = normalizeProgramPlanTable(table);

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    const rows = normalized.rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : [...row],
    );
    onChange({ ...normalized, rows });
  }

  function addRow() {
    const blank = normalized.headers.map(() => "");
    onChange({ ...normalized, rows: [...normalized.rows, blank] });
  }

  function removeRow(rowIdx: number) {
    onChange({ ...normalized, rows: normalized.rows.filter((_, i) => i !== rowIdx) });
  }

  return (
    <div className="program-plan-rows">
      <div className="program-plan-rows-head">
        <h4>{t("Строки плана (мероприятия)", "Plan rows (activities)")}</h4>
        <p className="muted tiny">
          {PLAN_ROWS_FREE_HINT} {onImportFromAi ? PLAN_AI_PATH_HINT : ""}
        </p>
        <div className="program-plan-rows-actions">
          <button type="button" className="ob-btn program-plan-add-row-btn" disabled={disabled} onClick={addRow}>
            {t("Добавить строку", "Add row")}
          </button>
          {onImportFromAi && (
            <button type="button" className="ob-btn secondary" disabled={disabled} onClick={onImportFromAi}>
              {t("Заполнить из ИИ-плана", "Fill from AI plan")}
            </button>
          )}
        </div>
        {importHint && <p className="muted tiny">{importHint}</p>}
      </div>

      {normalized.rows.length === 0 ? (
        <p className="muted tiny">
          {t("Строк пока нет — нажмите «Добавить строку» и заполните таблицу вручную.", "No rows yet — click 'Add row' and fill out the table manually.")}
        </p>
      ) : (
        <div className="program-plan-table-wrap">
          <table className="program-plan-table">
            <thead>
              <tr>
                {normalized.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
                <th aria-label={t("Действия", "Actions")} />
              </tr>
            </thead>
            <tbody>
              {normalized.rows.map((row, rowIdx) => (
                <tr key={`plan-row-${rowIdx}`}>
                  {normalized.headers.map((header, colIdx) => (
                    <td key={`${header}-${rowIdx}`}>
                      <input
                        type="text"
                        value={row[colIdx] || ""}
                        disabled={disabled}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="program-plan-row-remove"
                      disabled={disabled}
                      onClick={() => removeRow(rowIdx)}
                      aria-label={t("Удалить строку", "Delete row")}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {normalized.rows.length > 0 && (
        <details className="program-plan-preview">
          <summary className="muted tiny">{t("Предпросмотр текста плана", "Plan text preview")}</summary>
          <pre className="program-plan-preview-text">{formatPlanTextFromTable(normalized)}</pre>
        </details>
      )}
    </div>
  );
}
