import type { UnifiedProgressNote } from "../lib/progress_note.ts";
import type { ConsultationPairMeta } from "../lib/consultation_session.ts";
import { SESSION_MODALITIES, RISK_LEVELS, MODALITY_LABELS, RISK_LEVEL_LABELS } from "../lib/progress_note.ts";
import { t } from "../lib/i18n.ts";
import { downloadIcsFile } from "../lib/calendar_sync.ts";

interface ConsultationMetadataPanelProps {
  draft: UnifiedProgressNote;
  pairMeta?: ConsultationPairMeta;
  visitDate: string;
  minutes: string;
  isBusy: boolean;
  onMetaChange: (key: "modality" | "riskLevel", value: string) => void;
  onPairChange: (field: "mode" | "coParticipant", value: string) => void;
  onDateChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
}

export function ConsultationMetadataPanel(props: ConsultationMetadataPanelProps) {
  const {
    draft, pairMeta, visitDate, minutes, isBusy,
    onMetaChange, onPairChange, onDateChange, onMinutesChange
  } = props;

  return (
    <div className="consultation-form-section wide" style={{ padding: '8px 0' }}>
      <div className="consultation-form-section-body" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="field intake-field" style={{ flex: '0 0 auto', minWidth: '130px' }}>
          <span style={{ fontSize: '0.78rem', marginBottom: '2px' }}>{t("Дата", "Date")}</span>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={isBusy}
            style={{ padding: '5px 8px', fontSize: '0.85rem' }}
          />
        </label>
        <label className="field intake-field" style={{ flex: '0 0 auto', minWidth: '80px', maxWidth: '100px' }}>
          <span style={{ fontSize: '0.78rem', marginBottom: '2px' }}>{t("Мин", "Min")}</span>
          <input
            type="number"
            min="5"
            step="5"
            value={minutes}
            onChange={(e) => onMinutesChange(e.target.value)}
            disabled={isBusy}
            style={{ padding: '5px 8px', fontSize: '0.85rem' }}
          />
        </label>
        <label className="field intake-field" style={{ flex: '0 0 auto', minWidth: '140px' }}>
          <span style={{ fontSize: '0.78rem', marginBottom: '2px' }}>{t("Модальность", "Modality")}</span>
          <select
            value={draft.modality}
            onChange={(e) => onMetaChange("modality", e.target.value)}
            disabled={isBusy}
            style={{ padding: '5px 8px', fontSize: '0.85rem' }}
          >
            {SESSION_MODALITIES.map((mod) => (
              <option key={mod} value={mod}>
                {MODALITY_LABELS[mod]}
              </option>
            ))}
          </select>
        </label>
        <label className="field intake-field" style={{ flex: '0 0 auto', minWidth: '140px' }}>
          <span style={{ fontSize: '0.78rem', marginBottom: '2px' }}>{t("Риск", "Risk")}</span>
          <select
            value={draft.riskLevel}
            onChange={(e) => onMetaChange("riskLevel", e.target.value)}
            disabled={isBusy}
            style={{ padding: '5px 8px', fontSize: '0.85rem' }}
          >
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {RISK_LEVEL_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ob-btn secondary tiny"
          title={t("Добавить в календарь (.ics)", "Add to calendar (.ics)")}
          onClick={() => downloadIcsFile(t("Сессия с клиентом", "Session with client"), t("Сгенерировано в IDA Pro", "Generated in IDA Pro"), visitDate, parseInt(minutes) || 60)}
          style={{ fontSize: '0.75rem', padding: '4px 8px', alignSelf: 'flex-end', marginBottom: '2px', opacity: 0.7 }}
        >
          📅
        </button>

        {draft.modality === "pair" && pairMeta && (
          <div className="consultation-form-pair-row wide" style={{ display: 'flex', gap: '10px', marginTop: '4px', width: '100%' }}>
            <label className="field intake-field" style={{ minWidth: '140px' }}>
              <span style={{ fontSize: '0.78rem' }}>{t("Тип парной работы", "Pair work type")}</span>
              <select
                value={pairMeta.mode}
                onChange={(e) => onPairChange("mode", e.target.value)}
                disabled={isBusy}
                style={{ padding: '5px 8px', fontSize: '0.85rem' }}
              >
                <option value="joint">{t("Совместная (пара одновременно)", "Joint (both partners together)")}</option>
                <option value="split">{t("Раздельная (с одним из пары)", "Separate (with one partner)")}</option>
              </select>
            </label>
            <label className="field intake-field" style={{ flex: 1 }}>
              <span style={{ fontSize: '0.78rem' }}>{t("ФИО / Роль второго участника", "Name / Role of second participant")}</span>
              <input
                type="text"
                placeholder={t("Например: супруг Иванов И.И.", "e.g. spouse J. Smith")}
                value={pairMeta.coParticipant}
                onChange={(e) => onPairChange("coParticipant", e.target.value)}
                disabled={isBusy}
                style={{ padding: '5px 8px', fontSize: '0.85rem' }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
