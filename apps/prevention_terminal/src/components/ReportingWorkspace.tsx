import { useState } from "react";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { isCommercialOrg } from "../lib/case_meta.ts";
import { t } from "../lib/i18n.ts";
import WorkloadWorkspace from "./WorkloadWorkspace.tsx";
import AnnualReportWorkspace from "./AnnualReportWorkspace.tsx";

interface ReportingWorkspaceProps {
  terminalUserId: string;
  cfg: TerminalConfig;
  orgName?: string;
  specialistName?: string;
  isManager?: boolean;
  territorial?: boolean;
}

export default function ReportingWorkspace(props: ReportingWorkspaceProps) {
  const {
    terminalUserId,
    cfg,
    orgName,
    specialistName,
    isManager = false,
    territorial = false,
  } = props;

  const isComm = isCommercialOrg(cfg);

  // For school specialists, default to journals/workload (where COS export is),
  // with quick switching to annual report.
  // For managers or commercial, default appropriately.
  const [activeTab, setActiveTab] = useState<"workload" | "annual_report">(
    isManager ? "annual_report" : "workload",
  );

  return (
    <div className="workspace-panel-stack reporting-workspace" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top tab navigation for Reporting */}
      {!isManager && !isComm && (
        <div
          className="reporting-top-nav"
          style={{
            display: "flex",
            gap: "8px",
            background: "#fff",
            padding: "8px 16px",
            borderRadius: "10px",
            border: "1px solid var(--line, #e2e8f0)",
            marginBottom: "16px",
          }}
        >
          <button
            type="button"
            className={`ob-btn ${activeTab === "workload" ? "primary" : "secondary"}`}
            style={{
              padding: "8px 16px",
              fontWeight: activeTab === "workload" ? "700" : "500",
              fontSize: "0.95rem",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("workload")}
          >
            📊 {t("Журналы и нагрузка (ЦОС, Формы 4А–Ж)", "Journals & Workload (COS, Forms 4A–G)")}
          </button>
          <button
            type="button"
            className={`ob-btn ${activeTab === "annual_report" ? "primary" : "secondary"}`}
            style={{
              padding: "8px 16px",
              fontWeight: activeTab === "annual_report" ? "700" : "500",
              fontSize: "0.95rem",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("annual_report")}
          >
            📑 {t("Годовой аналитический отчет (Форма 5 / 5А)", "Annual Analytical Report (Form 5 / 5A)")}
          </button>
        </div>
      )}

      {/* Render selected reporting module */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === "workload" && !isManager && (
          <WorkloadWorkspace
            orgName={orgName}
            specialistName={specialistName}
            cfg={cfg}
          />
        )}

        {(activeTab === "annual_report" || isManager) && (
          <AnnualReportWorkspace
            terminalUserId={terminalUserId}
            isManager={isManager}
            territorial={territorial}
          />
        )}
      </div>
    </div>
  );
}
