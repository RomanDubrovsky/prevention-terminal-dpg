import { useEffect } from "react";
import {
  AUDIENCE_GROUP_LABELS,
  STUDENT_AGE_BAND_LABELS,
  type StudentAgeBand,
  type TargetAudienceData,
} from "../lib/target_audience.ts";

interface TargetAudienceFieldsProps {
  value: TargetAudienceData;
  onChange: (next: TargetAudienceData) => void;
  disabled?: boolean;
  /** Свободный текст — для последующей обработки ИИ; доступен только с подпиской. */
  aiEnabled?: boolean;
}

export default function TargetAudienceFields(props: TargetAudienceFieldsProps) {
  const { value, onChange, disabled, aiEnabled = false } = props;

  useEffect(() => {
    if (!aiEnabled && value.mode === "free_text") {
      onChange({ ...value, mode: "structured" });
    }
  }, [aiEnabled, value.mode]);

  function setMode(mode: TargetAudienceData["mode"]) {
    if (mode === "free_text" && !aiEnabled) return;
    onChange({ ...value, mode });
  }

  function updateGroup(
    group: TargetAudienceData["groups"][number]["group"],
    patch: Partial<TargetAudienceData["groups"][number]>,
  ) {
    onChange({
      ...value,
      groups: value.groups.map((row) => (row.group === group ? { ...row, ...patch } : row)),
    });
  }

  return (
    <div className="target-audience-fields">
      <div className="target-audience-mode" role="radiogroup" aria-label="Способ указания целевой группы">
        <label className="target-audience-mode-option">
          <input
            type="radio"
            name="audience-mode"
            checked={value.mode === "structured"}
            disabled={disabled}
            onChange={() => setMode("structured")}
          />
          <span>По полям</span>
        </label>
        <label className={`target-audience-mode-option${!aiEnabled ? " locked" : ""}`}>
          <input
            type="radio"
            name="audience-mode"
            checked={value.mode === "free_text"}
            disabled={disabled || !aiEnabled}
            onChange={() => setMode("free_text")}
          />
          <span>Свободный текст (для ИИ)</span>
        </label>
      </div>

      {!aiEnabled && (
        <p className="muted tiny target-audience-ai-hint">
          Свободный текст предназначен для последующей обработки ИИ (целевая группа и охват в
          отчёте). Для этого режима нужна{" "}
          <strong>подписка ИИ</strong> — используйте поля ниже или подключите подписку в шапке
          терминала.
        </p>
      )}

      {value.mode === "free_text" ? (
        <>
          {aiEnabled && (
            <p className="muted tiny target-audience-ai-hint">
              Опишите целевую группу свободно — ИИ разберёт формулировку при формировании плана и
              отчёта.
            </p>
          )}
          <label className="field wide">
          <span>Целевая группа</span>
          <textarea
            rows={2}
            value={value.freeText}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, freeText: e.target.value })}
            placeholder="Например: 7А–7В, родители 5–6 классов, классные руководители"
          />
        </label>
        </>
      ) : (
        <div className="target-audience-groups">
          {value.groups.map((row) => (
            <div key={row.group} className="target-audience-row">
              <label className="target-audience-check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={disabled}
                  onChange={(e) => updateGroup(row.group, { enabled: e.target.checked })}
                />
                <span>{AUDIENCE_GROUP_LABELS[row.group]}</span>
              </label>
              {row.enabled && row.group === "students" && (
                <label className="field target-audience-age">
                  <span className="tiny muted">Возраст</span>
                  <select
                    value={row.ageBand || "mixed"}
                    disabled={disabled}
                    onChange={(e) =>
                      updateGroup(row.group, { ageBand: e.target.value as StudentAgeBand })
                    }
                  >
                    {(Object.keys(STUDENT_AGE_BAND_LABELS) as StudentAgeBand[]).map((band) => (
                      <option key={band} value={band}>
                        {STUDENT_AGE_BAND_LABELS[band]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {row.enabled && (
                <label className="field target-audience-count">
                  <span className="tiny muted">Охват, чел.</span>
                  <input
                    type="number"
                    min={0}
                    value={row.count ?? ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      updateGroup(row.group, {
                        count: raw === "" ? null : Math.max(0, Number.parseInt(raw, 10) || 0),
                      });
                    }}
                    placeholder="0"
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
