import {
  PREVENTION_LINK_GUIDE,
  PREVENTION_LINK_HINTS_RU,
  PREVENTION_LINK_LABELS_RU,
  PREVENTION_LINK_VALUES,
  preventionLinkGuideGrouped,
  type PreventionLink,
} from "../lib/prevention_link.ts";

interface PreventionLinkPickerProps {
  value: PreventionLink | "";
  onChange: (value: PreventionLink) => void;
  disabled?: boolean;
}

export default function PreventionLinkPicker(props: PreventionLinkPickerProps) {
  const { value, onChange, disabled } = props;
  const selected = value && PREVENTION_LINK_VALUES.includes(value as PreventionLink) ? value : "";
  const selectedGuide = selected ? PREVENTION_LINK_GUIDE.find((entry) => entry.link === selected) : null;

  return (
    <div className="prevention-link-picker">
      <label className="field wide">
        <span>Звено профилактики</span>
        <select
          value={selected}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as PreventionLink)}
        >
          <option value="" disabled>
            Выберите звено…
          </option>
          {preventionLinkGuideGrouped().map((group) => (
            <optgroup key={group.tier} label={group.label}>
              {group.entries.map((entry) => (
                <option key={entry.link} value={entry.link}>
                  {PREVENTION_LINK_LABELS_RU[entry.link]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {selectedGuide && (
        <p className="muted tiny prevention-link-selected-audience">
          <strong>Для кого:</strong> {PREVENTION_LINK_HINTS_RU[selectedGuide.link]}
        </p>
      )}
    </div>
  );
}
