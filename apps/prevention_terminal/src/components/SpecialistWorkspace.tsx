import { useCallback, useEffect, useMemo, useState } from "react";

import CaseWorkspacePanel from "./CaseWorkspacePanel.tsx";
import CalendarWorkspace from "./CalendarWorkspace.tsx";
import ConsultantPanel from "./ConsultantPanel.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import TerminalSettingsPanel from "./TerminalSettingsPanel.tsx";
import SpecialistDashboard from "./SpecialistDashboard.tsx";
import ConsultationJournalWorkspace from "./ConsultationJournalWorkspace.tsx";
import GroupSessionsJournal from "./GroupSessionsJournal.tsx";
import WorkloadWorkspace from "./WorkloadWorkspace.tsx";
import AnnualReportWorkspace from "./AnnualReportWorkspace.tsx";
import SafeEnvironmentWorkspace from "./SafeEnvironmentWorkspace.tsx";
import IprWorkspacePanel from "./IprWorkspacePanel.tsx";
import RegistryWorkspace from "./RegistryWorkspace.tsx";
import WorkspaceSidebar from "./WorkspaceSidebar.tsx";
import AIAcademyWorkspace from "./AIAcademyWorkspace.tsx";
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { OrgProfile, SpecialistProfile } from "../lib/terminal_profiles.ts";
import { getEditionConfig } from "../lib/terminal_edition.ts";
import type { AiMode } from "../lib/ai_workspace.ts";
import {
  buildSpecialistNav,
  defaultSpecialistView,
  isAiWorkspaceView,
  type SpecialistWorkspaceView,
} from "../lib/workspace_nav.ts";
import { isTerminalModuleEnabled } from "../lib/terminal_config.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { onOpenFeedbackSettings, onOpenConsultationCase } from "../lib/workspace_navigation.ts";

function aiModeFromView(view: SpecialistWorkspaceView): AiMode | null {
  if (view === "ai_consultant") return "consultant";
  return null;
}

interface SpecialistWorkspaceProps {
  meta: InstallationMeta;
  orgProfile: OrgProfile;
  specialistProfile: SpecialistProfile;
  terminalConfig: TerminalConfig;
  deepLinkMsg: string | null;
  onConfigSaved: (payload: {
    meta: InstallationMeta;
    orgProfile: OrgProfile;
    specialistProfile: SpecialistProfile;
    terminalConfig: TerminalConfig;
  }) => void;
}

export default function SpecialistWorkspace(props: SpecialistWorkspaceProps) {
  const { meta, orgProfile, specialistProfile, terminalConfig, deepLinkMsg, onConfigSaved } = props;
  const cfg = terminalConfig;
  const locale = getEditionConfig().locale_default;

  const [activeView, setActiveView] = useState<SpecialistWorkspaceView>(() => defaultSpecialistView());
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [registrySubjectId, setRegistrySubjectId] = useState<string | null>(null);
  const [settingsRequest, setSettingsRequest] = useState<"feedback" | null>(null);
  const { active: aiSubscriptionActive } = useTerminalSubscription(cfg.terminal_user_id);

  const navItems = useMemo(
    () => buildSpecialistNav(cfg, locale, { aiSubscriptionActive }),
    [aiSubscriptionActive, cfg, locale],
  );

  const handleNavSelect = useCallback(
    (id: string) => {
      const item = navItems.find((row) => row.id === id);
      if (item?.locked) {
        setActiveView("ai_consultant");
        return;
      }
      setActiveView(id as SpecialistWorkspaceView);
    },
    [navItems],
  );

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("entry") === "academy") {
        setActiveView("academy");
        
        // Clear param so a page reload/navigation doesn't force switch back to academy
        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        window.history.replaceState({}, "", url.toString());
      }
    } catch (e) {
      /* ignore searchParams error */
    }
  }, []);

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeView)) {
      setActiveView(defaultSpecialistView());
    }
  }, [activeView, navItems]);

  useEffect(() => {
    return onOpenFeedbackSettings(() => {
      setActiveView("settings");
      setSettingsRequest("feedback");
    });
  }, []);

  useEffect(() => {
    return onOpenConsultationCase((caseId) => {
      setActiveCaseId(caseId);
      setActiveView("consultations");
    });
  }, []);

  const handleCaseSaved = useCallback((caseId: string) => {
    setActiveCaseId(caseId);
    setActiveView("case_workspace");
  }, []);

  const handleCaseSelect = useCallback((caseId: string | null) => {
    setActiveCaseId(caseId);
  }, []);

  const handleRegistryEnabled = useCallback(
    (nextCfg: TerminalConfig) => {
      onConfigSaved({
        meta,
        orgProfile,
        specialistProfile,
        terminalConfig: nextCfg,
      });
    },
    [meta, onConfigSaved, orgProfile, specialistProfile],
  );

  const activeAiMode = aiModeFromView(activeView);

  return (
    <div className="workspace-shell">
      <WorkspaceSidebar items={navItems} activeId={activeView} onSelect={handleNavSelect} />

      <div className="workspace-main">
        {activeView === "dashboard" && (
          <SpecialistDashboard cfg={cfg} deepLinkMsg={deepLinkMsg} onNavigate={setActiveView} />
        )}

        {activeView === "case_workspace" && (
          <CaseWorkspacePanel
            cfg={cfg}
            activeCaseId={activeCaseId}
            onCaseSelect={handleCaseSelect}
            onCaseSaved={handleCaseSaved}
            onNavigate={setActiveView}
          />
        )}

        {activeView === "calendar" && (
          <CalendarWorkspace
            cfg={cfg}
            activeCaseId={activeCaseId}
            onCaseSelect={handleCaseSelect}
            onNavigate={setActiveView}
          />
        )}

        {activeView === "registry" && (
          <RegistryWorkspace
            cfg={cfg}
            selectedSubjectId={registrySubjectId}
            onSubjectSelect={setRegistrySubjectId}
            onRegistryEnabled={handleRegistryEnabled}
          />
        )}

        {activeView === "consultations" && (
          <ConsultationJournalWorkspace
            cfg={cfg}
            activeCaseId={activeCaseId}
            onCaseSelect={handleCaseSelect}
            onRegistrySubjectSelect={setRegistrySubjectId}
            onOpenCaseWorkspace={() => setActiveView("case_workspace")}
            onOpenRegistry={() => setActiveView("registry")}
          />
        )}

        {activeView === "ipr" && isTerminalModuleEnabled(cfg, "ipr") && (
          <IprWorkspacePanel
            cfg={cfg}
            registrySubjectId={registrySubjectId}
            onRegistrySubjectSelect={setRegistrySubjectId}
            onOpenRegistry={() => setActiveView("registry")}
            terminalUserId={cfg.terminal_user_id}
          />
        )}

        {activeView === "group_work" && (
          <GroupSessionsJournal terminalUserId={cfg.terminal_user_id} cfg={cfg} />
        )}

        {activeView === "workload" && (
          <WorkloadWorkspace
            orgName={orgProfile.display_name}
            specialistName={specialistProfile.display_name}
            cfg={cfg}
          />
        )}

        {activeView === "analytical_report" && (
          <AnnualReportWorkspace terminalUserId={cfg.terminal_user_id} />
        )}

        {activeView === "safe_environment" && isTerminalModuleEnabled(cfg, "safe_environment") && (
          <SafeEnvironmentWorkspace terminalUserId={cfg.terminal_user_id} />
        )}

        {isAiWorkspaceView(activeView) && activeAiMode && (
          aiSubscriptionActive ? (
            <ConsultantPanel terminalUserId={cfg.terminal_user_id} caseId={activeCaseId || undefined} />
          ) : (
            <AiSubscriptionPaywall
              terminalUserId={cfg.terminal_user_id}
              compact={false}
            />
          )
        )}

        {activeView === "settings" && (
          <TerminalSettingsPanel
            terminalUserId={cfg.terminal_user_id}
            terminalConfig={cfg}
            requestedSection={settingsRequest}
            onRequestedSectionHandled={() => setSettingsRequest(null)}
            onSaved={onConfigSaved}
            onTerminalConfigChange={(terminalConfig) =>
              onConfigSaved({ meta, orgProfile, specialistProfile, terminalConfig })
            }
          />
        )}

        {activeView === "academy" && (
          <AIAcademyWorkspace aiSubscriptionActive={aiSubscriptionActive} />
        )}
      </div>
    </div>
  );
}
