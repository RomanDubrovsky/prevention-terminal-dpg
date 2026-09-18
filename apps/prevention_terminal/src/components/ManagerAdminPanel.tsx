import SiteWidgetsSection from "./terminal_setup/SiteWidgetsSection.tsx";

interface ManagerAdminPanelProps {
  organizationName: string;
  enabled?: boolean;
}

export default function ManagerAdminPanel(props: ManagerAdminPanelProps) {
  const { organizationName, enabled = true } = props;
  if (!enabled) return null;

  return (
    <section className="card">
      <h2>Сайт центра</h2>
      <SiteWidgetsSection organizationName={organizationName} centerId={undefined} setupToken={undefined} allowTokenRotation={false} />
    </section>
  );
}
