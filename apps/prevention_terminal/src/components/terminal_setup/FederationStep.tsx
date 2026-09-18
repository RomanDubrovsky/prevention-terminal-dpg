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

function SmartphoneConnectionWidget(props: {
  centerId: string;
  setupToken: string;
  isSettings?: boolean;
  allowTokenRotation?: boolean;
  onCenterIdChange?: (v: string) => void;
  onSetupTokenChange?: (v: string) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);

  if (!props.centerId || !props.setupToken) return null;
  return (
    <div style={{ padding: "14px 18px", background: "#f8fafc", border: "1px solid var(--line)", borderRadius: "12px", margin: "12px 0 24px 0", fontSize: "0.85rem", lineHeight: "1.5" }}>
      <div style={{ fontWeight: 700, color: "var(--text-color)", marginBottom: "6px" }}>
        📱 Подключение смартфона или другого ПК к вашему центру:
      </div>
      <p className="muted tiny" style={{ margin: "0 0 10px" }}>
        Вы можете открывать заявки и управлять записью с телефона. Введите эти данные при входе на новом устройстве:
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <span className="muted tiny">ID центра: </span>
          <code style={{ background: "#e2e8f0", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, userSelect: "all" }}>
            {props.centerId.startsWith("CTR-") ? props.centerId.slice(4) : props.centerId}
          </code>
        </div>
        <div>
          <span className="muted tiny">Ключ подключения (Token): </span>
          <code style={{ background: "#e2e8f0", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, userSelect: "all" }}>
            {props.setupToken}
          </code>
        </div>
      </div>
      {props.isSettings && (
        <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
          <button
            type="button"
            className="wizard-btn wizard-btn--outline"
            style={{ fontSize: "0.8rem", padding: "4px 8px", minHeight: "auto" }}
            onClick={() => setShowEdit(!showEdit)}
          >
            {showEdit ? "✕ Отмена привязки" : "⚙️ Изменить привязку к организации"}
          </button>
          
          {showEdit && (
            <div style={{ marginTop: "12px", padding: "12px", background: "var(--surface-raised, #fff)", border: "1px solid var(--line)", borderRadius: "8px" }}>
              <p className="muted tiny" style={{ margin: "0 0 12px 0" }}>
                Вы можете привязать этот терминал к другому ID центра и ключу, чтобы управлять им. Изменения сохранятся при нажатии «Сохранить настройки» внизу страницы.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="muted tiny">ID центра (Center ID):</span>
                  <input
                    type="text"
                    value={props.centerId.startsWith("CTR-") ? props.centerId.slice(4) : props.centerId}
                    onChange={(e) => props.onCenterIdChange?.(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="muted tiny">Ключ подключения (Setup Token):</span>
                    {props.allowTokenRotation && (
                      <button
                        type="button"
                        className="linkish"
                        style={{ fontSize: "12px", padding: 0 }}
                        onClick={() => {
                          if (window.confirm("Вы уверены? Старый токен перестанет работать на всех устройствах руководителей!")) {
                            const array = new Uint8Array(8);
                            window.crypto.getRandomValues(array);
                            const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
                            props.onSetupTokenChange?.(`sec_auto_${hex}`);
                          }
                        }}
                      >
                        Сгенерировать новый
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={props.setupToken}
                    onChange={(e) => props.onSetupTokenChange?.(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontFamily: "monospace" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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
  isSettings?: boolean;
  allowTokenRotation?: boolean;
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
    isSettings,
    allowTokenRotation,
  } = props;

  const [joinExisting, setJoinExisting] = useState(() => Boolean(props.centerId || props.setupToken));

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
        <SmartphoneConnectionWidget
          centerId={centerId}
          setupToken={setupToken}
          isSettings={isSettings}
          allowTokenRotation={allowTokenRotation}
          onCenterIdChange={onCenterIdChange}
          onSetupTokenChange={onSetupTokenChange}
        />
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
        <SmartphoneConnectionWidget
          centerId={centerId}
          setupToken={setupToken}
          isSettings={isSettings}
          allowTokenRotation={allowTokenRotation}
          onCenterIdChange={onCenterIdChange}
          onSetupTokenChange={onSetupTokenChange}
        />
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
        <SmartphoneConnectionWidget
          centerId={centerId}
          setupToken={setupToken}
          isSettings={isSettings}
          allowTokenRotation={allowTokenRotation}
          onCenterIdChange={onCenterIdChange}
          onSetupTokenChange={onSetupTokenChange}
        />
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
      <SmartphoneConnectionWidget
          centerId={centerId}
          setupToken={setupToken}
          isSettings={isSettings}
          allowTokenRotation={allowTokenRotation}
          onCenterIdChange={onCenterIdChange}
          onSetupTokenChange={onSetupTokenChange}
        />
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
                Введите ID центра (например, 8A2C3F5E) и ключ подключения (Setup Token), чтобы получить доступ к его заявкам и аналитике.
              </p>
              <TextField
                label="ID центра (например, 8A2C3F5E)"
                value={centerId}
                onChange={onCenterIdChange}
                placeholder="8A2C3F5E"
                disabled={busy}
              />
              <TextField
                label="Ключ подключения (Setup Token)"
                value={setupToken}
                onChange={onSetupTokenChange}
                placeholder="sec_auto_7c399b94dc5a91f6"
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
