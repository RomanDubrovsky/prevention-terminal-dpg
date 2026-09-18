import { useCallback, useState } from "react";

import { uploadWeeklyAggregate } from "../lib/federation_client.ts";
import { rollupMetricLabel } from "../lib/dashboard_labels.ts";
import {
  uploadMetricsFromDashboard,
  type SpecialistDashboardL1,
} from "../lib/specialist_dashboard.ts";

interface LocalReportingPanelProps {
  terminalUserId: string;
  dashboard: SpecialistDashboardL1;
}

export default function LocalReportingPanel(props: LocalReportingPanelProps) {
  const { terminalUserId, dashboard } = props;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const metrics = uploadMetricsFromDashboard(dashboard);

  const upload = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      await uploadWeeklyAggregate({ terminalUserId, metrics });
      setMsg("Агрегаты отправлены в облако (без ФИО и текста сессий).");
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }, [metrics, terminalUserId]);

  return (
    <section className="card dashboard-section">
      <h3>Отчёт для руководителя</h3>
      <p className="muted tiny">
        Директор школы или центра видит только эти агрегаты в своём дашборде — после присоединения
        рабочего места по invite-коду.
      </p>
      <dl className="rollup-grid">
        {Object.entries(metrics).map(([k, v]) => (
          <div key={k}>
            <dt>{rollupMetricLabel(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" disabled={busy} onClick={() => void upload()}>
        {busy ? "Отправляем…" : "Отправить агрегаты в облако"}
      </button>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
