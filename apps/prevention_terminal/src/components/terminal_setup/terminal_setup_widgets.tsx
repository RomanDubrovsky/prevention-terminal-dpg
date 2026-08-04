import type { TerminalModuleDef } from "../../lib/terminal_config.ts";
import { moduleDescription, moduleTitle } from "../../lib/terminal_config.ts";

export function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
      {props.hint && <p className="muted tiny" style={{ marginTop: '4px', marginBottom: 0 }}>{props.hint}</p>}
    </label>
  );
}

export function CopyField(props: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <div className="copy-row">
        <input type="text" readOnly value={props.value} />
        <button type="button" onClick={() => navigator.clipboard.writeText(props.value)}>
          Копировать
        </button>
      </div>
    </label>
  );
}

export function ModuleRow(props: {
  mod: TerminalModuleDef;
  locale: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { mod, locale, checked, onChange } = props;
  return (
    <div className="ob-mod">
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <strong>{moduleTitle(mod, locale)}</strong>
          {mod.paid && <span className="ob-mod-tag"> ИИ платно</span>}
        </span>
      </label>
      <p className="ob-mod-desc">{moduleDescription(mod, locale)}</p>
    </div>
  );
}
