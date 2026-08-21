import { useState } from "react";
import type { OnboardingProfileRole, OrgTypePreset, WorkspacePreset } from "../../lib/terminal_config.ts";
import { normalizeInviteCode } from "../../lib/federation_invite.ts";
import {
  FEDERATION_CLIENT_PD_NOTE,
  FEDERATION_CONNECTIVITY_NOTE,
  federationStepIntro,
} from "./federation_step_copy.ts";
import NetworkIdentityFields from "./NetworkIdentityFields.tsx";
import { CopyField, TextField } from "./terminal_setup_widgets.tsx";

function FederationIntro(props: { ctx: Parameters<typeof federationStepIntro>[0] }) {
  const { lead, paragraphs } = federationStepIntro(props.ctx);
  return (
    <div className="federation-intro">
      <p className="federation-intro-lead">{lead}</p>
      {paragraphs.map((p) => (
        <p key={p.slice(0, 48)} className="muted federation-intro-p">
          {p}
        </p>
      ))}
      <p className="muted federation-intro-p">{FEDERATION_CONNECTIVITY_NOTE}</p>
      <p className="muted federation-intro-p">{FEDERATION_CLIENT_PD_NOTE}</p>
    </div>
  );
}

function InviteField(props: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onClear?: () => void;
}) {
  const { label, value, placeholder, disabled, error, onChange, onClear } = props;
  return (
    <>
      <TextField
        label={label}
        value={value}
        onChange={(raw) => onChange(normalizeInviteCode(raw))}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && <p className="error-inline federation-field-error">{error}</p>}
      {value && onClear && (
        <button type="button" className="linkish" onClick={onClear}>
          Удалить связь
        </button>
      )}
    </>
  );
}

export function FederationStep(props: {
  preset: WorkspacePreset;
  presetName: string;
  orgType: OrgTypePreset;
  profileRole: OnboardingProfileRole;
  isManager: boolean;
  territorial: boolean;
  busy: boolean;
  parentIn: string;
  childIn: string;
  childCode: string;
  parentCode: string;
  parentInError: string | null;
  childInError: string | null;
  onParentInChange: (v: string) => void;
  onChildInChange: (v: string) => void;
  centerId: string;
  setupToken: string;
  onCenterIdChange: (v: string) => void;
  onSetupTokenChange: (v: string) => void;
  displayName: string;
  organizationLabel: string;
  orgNamePlaceholder?: string;
  onDisplayNameChange: (v: string) => void;
  onOrganizationLabelChange: (v: string) => void;
}) {
  const {
    preset,
    presetName,
    orgType,
    profileRole,
    isManager,
    territorial,
    busy,
    parentIn,
    childIn,
    childCode,
    parentCode,
    parentInError,
    childInError,
    onParentInChange,
    onChildInChange,
    centerId,
    setupToken,
    onCenterIdChange,
    onSetupTokenChange,
    displayName,
    organizationLabel,
    orgNamePlaceholder,
    onDisplayNameChange,
    onOrganizationLabelChange,
  } = props;

  const [joinExisting, setJoinExisting] = useState(false);

  const identityBlock = (
    <NetworkIdentityFields
      displayName={displayName}
      organizationLabel={organizationLabel}
      orgNamePlaceholder={orgNamePlaceholder}
      busy={busy}
      onDisplayNameChange={onDisplayNameChange}
      onOrganizationLabelChange={onOrganizationLabelChange}
    />
  );

  const copyCtx = {
    orgType,
    profileRole,
    preset,
    isManager,
    territorial,
  };
  const intro = <FederationIntro ctx={copyCtx} />;

  if (preset === "educator_lite") {
    return (
      <div className="federation-stack">
        {identityBlock}
        {intro}
        <p className="muted tiny">
          Пресет: <strong>{presetName}</strong>
        </p>
        <div className="federation-tier">
          <h3 className="federation-tier-title">Код от дашборда руководителя</h3>
          <InviteField
            label="Код руководителя (PARENT-…)"
            value={parentIn}
            placeholder="PARENT-XXXX"
            disabled={busy}
            error={parentInError}
            onChange={onParentInChange}
            onClear={() => onParentInChange("")}
          />
        </div>
        <CopyField label="Ваш дочерний код (CHILD)" value={childCode} />
      </div>
    );
  }

  if (preset === "specialist") {
    return (
      <div className="federation-stack">
        {identityBlock}
        {intro}
        <p className="muted tiny">
          Пресет: <strong>{presetName}</strong>
        </p>
        <div className="federation-tier">
          <h3 className="federation-tier-title">1. Подключение к вашей организации</h3>
          <p className="muted tiny">
            Введите код организации (PARENT-…), полученный от вашего руководителя. После привязки
            анонимные сводки будут синхронизироваться с вашей организацией.
          </p>
          <InviteField
            label="Код организации (PARENT-…)"
            value={parentIn}
            placeholder="PARENT-XXXX"
            disabled={busy}
            error={parentInError}
            onChange={onParentInChange}
            onClear={() => onParentInChange("")}
          />
        </div>
        <div className="federation-tier">
          <h3 className="federation-tier-title">2. Ваш личный код специалиста</h3>
          <p className="muted tiny">
            Если нужно — отправьте ваш личный дочерний код (CHILD-…) руководителю для прямой привязки.
          </p>
          <CopyField label="Личный код специалиста (CHILD)" value={childCode} />
        </div>
        <p className="muted tiny federation-privacy-note">
          Пока код не передан и привязка не установлена, сводки никуда не уходят. Отключение — удалите вставленный
          код организации до сохранения настроек.
        </p>
      </div>
    );
  }

  if (isManager && territorial) {
    return (
      <div className="federation-stack">
        {identityBlock}
        {intro}
        <p className="muted tiny">
          Пресет: <strong>{presetName}</strong> — территориальное управление.
        </p>
        <div className="federation-tier">
          <h3 className="federation-tier-title">1. Подключить организацию (руководитель)</h3>
          <p className="muted tiny">
            Руководитель организации присылает вам дочернюю ссылку (CHILD-…). Вставьте её здесь. Территории для
            сводки определятся по профилям подключённых организаций.
          </p>
          <InviteField
            label="Ссылка руководителя организации (CHILD-…)"
            value={childIn}
            placeholder="CHILD-XXXX"
            disabled={busy}
            error={childInError}
            onChange={onChildInChange}
            onClear={() => onChildInChange("")}
          />
        </div>
        <div className="federation-tier">
          <h3 className="federation-tier-title">2. Ваша ссылка для вышестоящего уровня</h3>
          <p className="muted tiny">
            Если нужно — передайте родительскую ссылку (PARENT-…) вышестоящему дашборду.
          </p>
          <CopyField label="Родительская ссылка (PARENT)" value={parentCode} />
        </div>
        <p className="muted tiny federation-privacy-note">
          В облако уходят только агрегаты. Подтверждение подключений — при приёме ссылки на вашей стороне.
        </p>
      </div>
    );
  }

  const isCommercialManager = orgType === "commercial" && isManager && !territorial;

  return (
    <div className="federation-stack">
      {identityBlock}
      {intro}
      <p className="muted tiny">
        Пресет: <strong>{presetName}</strong> — только сводные данные, без ФИО.
      </p>

      {isCommercialManager && (
        <div className="federation-tier" style={{ background: "var(--background-soft)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <label style={{ display: "flex", gap: "8px", alignItems: "center", cursor: "pointer", fontWeight: 500 }}>
            <input type="checkbox" checked={joinExisting} onChange={(e) => setJoinExisting(e.target.checked)} />
            Подключиться к существующему центру (как соруководитель)
          </label>
          {joinExisting && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p className="muted tiny" style={{ margin: 0 }}>
                Введите ID центра (CTR-…) и ключ интеграции (Setup Token), чтобы получить доступ к его заявкам и аналитике.
              </p>
              <TextField
                label="ID Центра (CTR-…)"
                value={centerId}
                onChange={onCenterIdChange}
                placeholder="CTR-XXXX"
                disabled={busy}
              />
              <TextField
                label="Ключ интеграции (Setup Token)"
                value={setupToken}
                onChange={onSetupTokenChange}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                disabled={busy}
              />
            </div>
          )}
        </div>
      )}

      {!joinExisting && (
        <>
          <div className="federation-tier">
            <h3 className="federation-tier-title">1. Код вашей организации (PARENT-…)</h3>
            <p className="muted tiny">
              Передайте этот код вашей организации (PARENT-…) директорам, психологам и сотрудникам вашей службы.
              Вставив его при входе на шаге «Сеть», они подключатся к вашей организации.
            </p>
            <CopyField label="Код организации (PARENT)" value={parentCode} />
          </div>
          <div className="federation-tier">
            <h3 className="federation-tier-title">2. Подключить специалиста</h3>
            <p className="muted tiny">
              Если специалист прислал дочернюю ссылку (CHILD-…) — вставьте её здесь. Родительские ссылки специалистов
              не подходят.
            </p>
            <InviteField
              label="Ссылка специалиста (CHILD-…)"
              value={childIn}
              placeholder="CHILD-XXXX"
              disabled={busy}
              error={childInError}
              onChange={onChildInChange}
              onClear={() => onChildInChange("")}
            />
          </div>
          <div className="federation-tier">
            <h3 className="federation-tier-title">3. Ваша ссылка для вышестоящего уровня</h3>
            <p className="muted tiny">
              Для подключения к панели ведомства или головного офиса сети отправьте наверх эту дочернюю ссылку
              (CHILD-…).
            </p>
            <CopyField label="Дочерняя ссылка (CHILD)" value={childCode} />
          </div>
        </>
      )}

      <p className="muted tiny federation-privacy-note">
        Пока связи не настроены, персональные данные в облако не отправляются.
      </p>
    </div>
  );
}
