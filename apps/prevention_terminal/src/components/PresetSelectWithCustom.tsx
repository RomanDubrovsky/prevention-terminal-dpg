import { useMemo } from "react";
import { t } from "../lib/i18n.ts";

import {
  CUSTOM_PRESET_ID,
  presetValueFromSelect,
  resolvePresetSelectValue,
  type IntakePresetOption,
} from "../lib/intake_field_presets.ts";

interface PresetSelectWithCustomProps {
  label: string;
  hint?: string;
  options: IntakePresetOption[];
  value: string;
  onChange: (value: string) => void;
  customPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function PresetSelectWithCustom(props: PresetSelectWithCustomProps) {
  const {
    label,
    hint,
    options,
    value,
    onChange,
    customPlaceholder = t("Опишите свой вариант…", "Describe your option…"),
    disabled,
    className,
  } = props;

  const { selectValue, customText } = useMemo(
    () => resolvePresetSelectValue(value, options),
    [value, options],
  );
  const showCustom = selectValue === CUSTOM_PRESET_ID;

  return (
    <label className={`field intake-field preset-select-field${className ? ` ${className}` : ""}`}>
      <span>{label}</span>
      {hint ? <span className="muted tiny">{hint}</span> : null}
      <select
        disabled={disabled}
        value={selectValue}
        onChange={(e) => {
          const nextId = e.target.value;
          onChange(presetValueFromSelect(nextId, customText, options));
        }}
      >
        <option value="">{t("Выберите…", "Select…")}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {showCustom && (
        <input
          type="text"
          disabled={disabled}
          value={customText}
          placeholder={customPlaceholder}
          onChange={(e) => onChange(presetValueFromSelect(CUSTOM_PRESET_ID, e.target.value, options))}
        />
      )}
    </label>
  );
}
