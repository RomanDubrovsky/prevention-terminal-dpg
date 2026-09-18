interface NetworkIdentityFieldsProps {
  displayName: string;
  organizationLabel: string;
  orgNamePlaceholder?: string;
  busy: boolean;
  onDisplayNameChange: (value: string) => void;
  onOrganizationLabelChange: (value: string) => void;
}

export default function NetworkIdentityFields(props: NetworkIdentityFieldsProps) {
  const {
    displayName,
    organizationLabel,
    orgNamePlaceholder = "Название организации",
    busy,
    onDisplayNameChange,
    onOrganizationLabelChange,
  } = props;

  return (
    <div className="network-identity-fields federation-tier">
      <h3 className="federation-tier-title">Как вас видит сеть</h3>
      <p className="muted tiny">
        Имя и название организации нужны только для сетевого окружения — так вас увидят руководитель и
        коллеги в сводках. Подробные реквизиты организации можно изменить позже в «Настройках».
      </p>
      <label className="field">
        <span>Имя пользователя</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Анна Иванова"
          disabled={busy}
        />
      </label>
      <label className="field">
        <span>Название организации</span>
        <input
          type="text"
          value={organizationLabel}
          onChange={(e) => onOrganizationLabelChange(e.target.value)}
          placeholder={orgNamePlaceholder}
          disabled={busy}
        />
      </label>
    </div>
  );
}
