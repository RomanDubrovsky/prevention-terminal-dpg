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
import { t } from "../../lib/i18n.ts";

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
      <p className="muted federation-intro-p">{FEDERATION_CONNECTIVITY_NOTE()}</p>
      <p className="muted federation-intro-p">{FEDERATION_CLIENT_PD_NOTE()}</p>
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
        {t("📱 Подключение смартфона или другого ПК к вашему центру:", "📱 Connect smartphone or another PC to your center:")}
      </div>
      <p className="muted tiny" style={{ margin: "0 0 10px" }}>
        {t(
          "Вы можете открывать заявки и управлять записью с телефона. Введите эти данные при входе на новом устройстве:",
          "Manage client bookings and cases from your phone. Enter these details when signing in on a new device:"
        )}
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <span className="muted tiny">{t("ID центра: ", "Center ID: ")}</span>
          <code style={{ background: "#e2e8f0", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, userSelect: "all" }}>
            {props.centerId.startsWith("CTR-") ? props.centerId.slice(4) : props.centerId}
          </code>
        </div>
        <div>
          <span className="muted tiny">{t("Ключ подключения (Token): ", "Setup Token: ")}</span>
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
            {showEdit ? t("✕ Отмена привязки", "✕ Cancel") : t("⚙️ Изменить привязку к организации", "⚙️ Change Organization Connection")}
          </button>
          
          {showEdit && (
            <div style={{ marginTop: "12px", padding: "12px", background: "var(--surface-raised, #fff)", border: "1px solid var(--line)", borderRadius: "8px" }}>
              <p className="muted tiny" style={{ margin: "0 0 12px 0" }}>
                {t(
                  "Вы можете привязать этот терминал к другому ID центра и ключу, чтобы управлять им. Изменения сохранятся при нажатии «Сохранить настройки» внизу страницы.",
                  "You can link this terminal to another Center ID and token. Changes will apply after clicking 'Save Settings' below."
                )}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span className="muted tiny">{t("ID центра (Center ID):", "Center ID:")}</span>
                  <input
                    type="text"
                    value={props.centerId.startsWith("CTR-") ? props.centerId.slice(4) : props.centerId}
                    onChange={(e) => props.onCenterIdChange?.(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="muted tiny">{t("Ключ подключения (Setup Token):", "Setup Token:")}</span>
                    {props.allowTokenRotation && (
                      <button
                        type="button"
                        className="linkish"
                        style={{ fontSize: "12px", padding: 0 }}
                        onClick={() => {
                          if (window.confirm(t("Вы уверены? Старый токен перестанет работать на всех устройствах руководителей!", "Are you sure? The old token will be revoked across all devices!"))) {
                            const array = new Uint8Array(8);
                            window.crypto.getRandomValues(array);
                            const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
                            props.onSetupTokenChange?.(`sec_auto_${hex}`);
                          }
                        }}
                      >
                        {t("Сгенерировать новый", "Generate New")}
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
          {t("Удалить связь", "Remove Link")}
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
          {t("Пресет: ", "Preset: ")}<strong>{presetName}</strong>
        </p>
        <div className="federation-tier">
          <h3 className="federation-tier-title">{t("Код от дашборда руководителя", "Manager Dashboard Code")}</h3>
          <InviteField
            label={t("Код руководителя (PARENT-…)", "Manager Code (PARENT-…)")}
            value={parentIn}
            placeholder="PARENT-XXXX"
            disabled={busy}
            error={parentInError}
            onChange={onParentInChange}
            onClear={() => onParentInChange("")}
          />
        </div>
        <CopyField label={t("Ваш дочерний код (CHILD)", "Your Child Code (CHILD)")} value={childCode} />
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
          {t("Пресет: ", "Preset: ")}<strong>{presetName}</strong>
        </p>
        <div className="federation-tier">
          <h3 className="federation-tier-title">{t("1. Подключение к вашей организации", "1. Connect to your organization")}</h3>
          <p className="muted tiny">
            {t(
              "Введите код организации (PARENT-…), полученный от вашего руководителя. После привязки анонимные сводки будут синхронизироваться с вашей организацией.",
              "Enter the organization code (PARENT-…) from your manager. After linking, anonymous summaries will sync with your organization."
            )}
          </p>
          <InviteField
            label={t("Код организации (PARENT-…)", "Organization Code (PARENT-…)")}
            value={parentIn}
            placeholder="PARENT-XXXX"
            disabled={busy}
            error={parentInError}
            onChange={onParentInChange}
            onClear={() => onParentInChange("")}
          />
        </div>
        <div className="federation-tier">
          <h3 className="federation-tier-title">{t("2. Ваш личный код специалиста", "2. Your specialist personal code")}</h3>
          <p className="muted tiny">
            {t(
              "Если нужно — отправьте ваш личный дочерний код (CHILD-…) руководителю для прямой привязки.",
              "If needed, send your personal child code (CHILD-…) to your manager for direct linking."
            )}
          </p>
          <CopyField label={t("Личный код специалиста (CHILD)", "Personal Specialist Code (CHILD)")} value={childCode} />
        </div>
        <p className="muted tiny federation-privacy-note">
          {t(
            "Пока код не передан и привязка не установлена, сводки никуда не уходят. Отключение — удалите вставленный код организации до сохранения настроек.",
            "Until linked, summaries stay on your device. To disconnect, clear the code before saving."
          )}
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
          {t("Пресет: ", "Preset: ")}<strong>{presetName}</strong> — {t("территориальное управление.", "territorial management.")}
        </p>
        <div className="federation-tier">
          <h3 className="federation-tier-title">{t("1. Подключить организацию (руководитель)", "1. Link Organization (Director)")}</h3>
          <p className="muted tiny">
            {t(
              "Руководитель организации присылает вам дочернюю ссылку (CHILD-…). Вставьте её здесь. Территории для сводки определятся по профилям подключённых организаций.",
              "Organization directors send you their child link (CHILD-…). Paste it here."
            )}
          </p>
          <InviteField
            label={t("Ссылка руководителя организации (CHILD-…)", "Organization Director Code (CHILD-…)")}
            value={childIn}
            placeholder="CHILD-XXXX"
            disabled={busy}
            error={childInError}
            onChange={onChildInChange}
            onClear={() => onChildInChange("")}
          />
        </div>
        <div className="federation-tier">
          <h3 className="federation-tier-title">{t("2. Ваша ссылка для вышестоящего уровня", "2. Upstream Link")}</h3>
          <p className="muted tiny">
            {t("Если нужно — передайте родительскую ссылку (PARENT-…) вышестоящему дашборду.", "If needed, share the PARENT-... code with upstream dashboards.")}
          </p>
          <CopyField label={t("Родительская ссылка (PARENT)", "Parent Link (PARENT)")} value={parentCode} />
        </div>
        <p className="muted tiny federation-privacy-note">
          {t("В облако уходят только агрегаты. Подтверждение подключений — при приёме ссылки на вашей стороне.", "Only aggregates are synced. Confirm connections by accepting codes.")}
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
        {t("Пресет: ", "Preset: ")}<strong>{presetName}</strong> — {t("только сводные данные, без ФИО.", "aggregated metrics only, no personal names.")}
      </p>

      {isCommercialManager && (
        <div className="federation-tier" style={{ background: "var(--background-soft)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <label style={{ display: "flex", gap: "8px", alignItems: "center", cursor: "pointer", fontWeight: 500 }}>
            <input type="checkbox" checked={joinExisting} onChange={(e) => setJoinExisting(e.target.checked)} />
            {t("Подключиться к существующему центру (как соруководитель)", "Connect to existing center (as co-manager)")}
          </label>
          {joinExisting && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p className="muted tiny" style={{ margin: 0 }}>
                {t("Введите ID центра (например, 8A2C3F5E) и ключ подключения (Setup Token), чтобы получить доступ к его заявкам и аналитике.", "Enter Center ID (e.g. 8A2C3F5E) and Setup Token to access leads and analytics.")}
              </p>
              <TextField
                label={t("ID центра (например, 8A2C3F5E)", "Center ID (e.g. 8A2C3F5E)")}
                value={centerId}
                onChange={onCenterIdChange}
                placeholder="8A2C3F5E"
                disabled={busy}
              />
              <TextField
                label={t("Ключ подключения (Setup Token)", "Setup Token")}
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
            <h3 className="federation-tier-title">{t("1. Код вашей организации (PARENT-…)", "1. Organization Code (PARENT-…)")}</h3>
            <p className="muted tiny">
              {t(
                "Передайте этот код вашей организации (PARENT-…) директорам, психологам и сотрудникам вашей службы. Вставив его при входе на шаге «Сеть», они подключатся к вашей организации.",
                "Share this PARENT-... code with your directors and specialists to connect them to your center."
              )}
            </p>
            <CopyField label={t("Код организации (PARENT)", "Organization Code (PARENT)")} value={parentCode} />
          </div>
          <div className="federation-tier">
            <h3 className="federation-tier-title">{t("2. Подключить специалиста", "2. Connect Specialist")}</h3>
            <p className="muted tiny">
              {t(
                "Если специалист прислал дочернюю ссылку (CHILD-…) — вставьте её здесь. Родительские ссылки специалистов не подходят.",
                "If a specialist sent their CHILD-... code, enter it here."
              )}
            </p>
            <InviteField
              label={t("Ссылка специалиста (CHILD-…)", "Specialist Code (CHILD-…)")}
              value={childIn}
              placeholder="CHILD-XXXX"
              disabled={busy}
              error={childInError}
              onChange={onChildInChange}
              onClear={() => onChildInChange("")}
            />
          </div>
          <div className="federation-tier">
            <h3 className="federation-tier-title">{t("3. Ваша ссылка для вышестоящего уровня", "3. Upstream Link")}</h3>
            <p className="muted tiny">
              {t(
                "Для подключения к панели ведомства или головного офиса сети отправьте наверх эту дочернюю ссылку (CHILD-…).",
                "To link to a parent office or regional coordinator, share this CHILD-... code."
              )}
            </p>
            <CopyField label={t("Дочерняя ссылка (CHILD)", "Child Link (CHILD)")} value={childCode} />
          </div>
        </>
      )}

      <p className="muted tiny federation-privacy-note">
        {t("Пока связи не настроены, персональные данные в облако не отправляются.", "Until connections are set, no personal data is sent to the cloud.")}
      </p>
    </div>
  );
}
