import { useState } from "react";

import { RESEARCH_CONTRIBUTION_COPY } from "../content/research_contribution_copy.ts";
import {
  saveResearchContributionEnabled,
} from "../lib/research_contribution.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";

interface ResearchContributionSectionProps {
  terminalConfig: TerminalConfig;
  onTerminalConfigChange: (cfg: TerminalConfig) => void;
}

export default function ResearchContributionSection(props: ResearchContributionSectionProps) {
  const { terminalConfig, onTerminalConfigChange } = props;
  const copy = RESEARCH_CONTRIBUTION_COPY;
  const enabled = terminalConfig.research_contribution_enabled === true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const cfg = await saveResearchContributionEnabled({
        cfg: terminalConfig,
        enabled: next,
      });
      onTerminalConfigChange(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const lastPeriod = terminalConfig.research_contribution_last_period_key?.trim();

  return (
    <div className="research-contribution-section">
      <h3>{copy.sectionTitle}</h3>
      <p className="muted">{copy.sectionLead}</p>
      <ul className="research-contribution-bullets">
        {copy.bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="muted tiny">{copy.aiNote}</p>

      <label className="research-contribution-toggle">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => void handleToggle(e.target.checked)}
        />
        <span>
          <strong>{copy.checkboxLabel}</strong>
          <span className="muted tiny block">{copy.checkboxHint}</span>
        </span>
      </label>

      <p className="muted tiny">
        {enabled ? copy.enabledNote : copy.disabledNote}
      </p>
      <p className="muted tiny">
        {copy.lastUploadLabel}: {lastPeriod || copy.neverUploaded}
      </p>

      <details className="research-contribution-details">
        <summary>{copy.privacyLinkLabel}</summary>
        <ul className="research-contribution-bullets tiny">
          <li>Количество консультаций и минут работы за месяц</li>
          <li>Групповые занятия (число сессий)</li>
          <li>Агрегаты по кодам Y/X (уровень риска, этап работы) — без привязки к людям</li>
          <li>Тип организации, редакция терминала, страна/регион (без названия школы или центра)</li>
          <li>Хеш установки (participant_id) — не позволяет восстановить ФИО или адрес</li>
        </ul>
      </details>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
