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
    displayName,
    organizationLabel,
    orgNamePlaceholder,
    onDisplayNameChange,
    onOrganizationLabelChange,
  } = props;

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
          <h3 className="federation-tier-title">1. Подключение к руководителю</h3>
          <p className="muted tiny">
            Если руководитель прислал приглашение, вставьте его родительский код (PARENT-…). После подключения
            анонимные сводки могут попадать в его панель.
          </p>
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
        <div className="federation-tier">
          <h3 className="federation-tier-title">2. Ваш код для руководителя</h3>
          <p className="muted tiny">
            Отправьте этот дочерний код (CHILD-…) руководителю, чтобы он мог видеть агрегаты вашей работы (без
            ФИО).
          </p>
          <CopyField label="Дочерний код (CHILD)" value={childCode} />
        </div>
        <p className="muted tiny federation-privacy-note">
          Пока код не передан и приглашение не принято, сводки никуда не уходят. Отключение — удалите вставленный
          код руководителя до сохранения настроек.
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

  return (
    <div className="federation-stack">
      {identityBlock}
      {intro}
      <p className="muted tiny">
        Пресет: <strong>{presetName}</strong> — только сводные данные, без ФИО.
      </p>
      <div className="federation-tier">
        <h3 className="federation-tier-title">1. Ссылка для специалистов</h3>
        <p className="muted tiny">
          Передайте родительскую ссылку (PARENT-…) психологам и другим специалистам. Они вставят её у себя как
          ссылку руководителя.
        </p>
        <CopyField label="Родительская ссылка (PARENT)" value={parentCode} />
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
      <p className="muted tiny federation-privacy-note">
        Пока связи не настроены, персональные данные в облако не отправляются.
      </p>
    </div>
  );
}
