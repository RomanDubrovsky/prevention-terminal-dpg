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
      <div className="consultation-form-section-body" style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'flex', flexDirection: 'column', minWidth: '120px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{t("Дата", "Date")}</span>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={isBusy}
            style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', width: '70px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{t("Мин", "Min")}</span>
          <input
            type="number"
            min="5"
            step="5"
            value={minutes}
            onChange={(e) => onMinutesChange(e.target.value)}
            disabled={isBusy}
            style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{t("Модальность", "Modality")}</span>
          <select
            value={draft.modality}
            onChange={(e) => onMetaChange("modality", e.target.value)}
            disabled={isBusy}
            style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}
          >
            {SESSION_MODALITIES.map((mod) => (
              <option key={mod} value={mod}>
                {MODALITY_LABELS[mod]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>{t("Риск", "Risk")}</span>
          <select
            value={draft.riskLevel}
            onChange={(e) => onMetaChange("riskLevel", e.target.value)}
            disabled={isBusy}
            style={{ padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}
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
          onClick={() => downloadIcsFile(t("Сессия с клиентом", "Session with client"), t("Сгенерировано в IDA Psy", "Generated in IDA Psy"), visitDate, parseInt(minutes) || 60)}
          style={{ fontSize: '0.85rem', padding: '6px 10px', opacity: 0.8, border: '1px solid #cbd5e1' }}
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
