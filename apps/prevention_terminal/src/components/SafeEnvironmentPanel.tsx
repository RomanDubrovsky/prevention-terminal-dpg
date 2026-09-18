import AiModesPanel from "./AiModesPanel.tsx";

interface SafeEnvironmentPanelProps {
  terminalUserId?: string;
  handoffNotice?: string | null;
  onHandoffConsumed?: () => void;
}

/** Безопасная среда: конструктор программ организации (Архитектор → «Безопасная среда»). */
export default function SafeEnvironmentPanel(props: SafeEnvironmentPanelProps) {
  const { terminalUserId, handoffNotice, onHandoffConsumed } = props;
  return (
    <AiModesPanel
      fixedMode="architect"
      architectCategoryLock="safety"
      terminalUserId={terminalUserId}
      handoffNotice={handoffNotice}
      onHandoffConsumed={onHandoffConsumed}
      enabled
    />
  );
}
