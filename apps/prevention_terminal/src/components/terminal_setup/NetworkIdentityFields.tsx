import { t } from "../../lib/i18n.ts";

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
    orgNamePlaceholder = t("Название организации", "Organization Name"),
    busy,
    onDisplayNameChange,
    onOrganizationLabelChange,
  } = props;

  return (
    <div className="network-identity-fields federation-tier">
      <h3 className="federation-tier-title">{t("Как вас видит сеть", "How the network sees you")}</h3>
      <p className="muted tiny">
        {t(
          "Имя и название организации нужны только для сетевого окружения — так вас увидят руководитель и коллеги в сводках. Подробные реквизиты организации можно изменить позже в «Настройках».",
          "Name and organization label are used for network display — this is how managers and colleagues will see you in summaries. Detailed organization details can be updated later in 'Settings'."
        )}
      </p>
      <label className="field">
        <span>{t("Имя пользователя", "User Name")}</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder={t("Анна Иванова", "Dr. Jane Doe")}
          disabled={busy}
        />
      </label>
      <label className="field">
        <span>{t("Название организации", "Organization Name")}</span>
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
