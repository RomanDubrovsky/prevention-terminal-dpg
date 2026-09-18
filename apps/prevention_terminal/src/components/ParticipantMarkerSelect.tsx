import { useEffect, useState } from "react";

import { listCaseParticipants, participantMarker } from "../lib/case_participants.ts";
import { participantRoleLabel } from "../lib/case_meta.ts";
import type { AliasRole } from "../lib/case.ts";
import type { IntakePresetOption } from "../lib/intake_field_presets.ts";
import PresetSelectWithCustom from "./PresetSelectWithCustom.tsx";

interface ParticipantMarkerSelectProps {
  caseId: string;
  commercial: boolean;
  label: string;
  hint?: string;
  options: IntakePresetOption[];
  value: string;
  onChange: (value: string) => void;
  customPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function ParticipantMarkerSelect(props: ParticipantMarkerSelectProps) {
  const {
    caseId,
    commercial,
    label,
    hint,
    options,
    value,
    onChange,
    customPlaceholder,
    disabled,
    className,
  } = props;
  const [participants, setParticipants] = useState<
    { alias_id: string; role: AliasRole; role_no: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    void listCaseParticipants(caseId).then((rows) => {
      if (!cancelled) setParticipants(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className={`participant-marker-field${className ? ` ${className}` : ""}`}>
      {participants.length > 0 && (
        <label className="field intake-field">
          <span className="tiny muted">Из участников дела</span>
          <select
            className="participant-marker-pick"
            disabled={disabled}
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const p = participants.find((row) => row.alias_id === id);
              if (p) onChange(participantMarker(p.role, p.role_no));
            }}
          >
            <option value="">Выбрать участника…</option>
            {participants.map((p) => (
              <option key={p.alias_id} value={p.alias_id}>
                {participantMarker(p.role, p.role_no)} ({participantRoleLabel(p.role, commercial)})
              </option>
            ))}
          </select>
        </label>
      )}
      <PresetSelectWithCustom
        label={label}
        hint={hint}
        options={options}
        value={value}
        onChange={onChange}
        customPlaceholder={customPlaceholder}
        disabled={disabled}
      />
    </div>
  );
}
