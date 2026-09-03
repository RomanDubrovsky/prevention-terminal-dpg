import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import ManagerDashboard from "./ManagerDashboard.tsx";
import TerminalSettingsPanel from "./TerminalSettingsPanel.tsx";
import WorkspaceSidebar from "./WorkspaceSidebar.tsx";

import UsersPanel from "./UsersPanel.tsx";
import ConsultantPanel from "./ConsultantPanel.tsx";
const AIAcademyWorkspace = lazy(() => import("./AIAcademyWorkspace.tsx"));
const AiSubscriptionPaywall = lazy(() => import("./AiSubscriptionPaywall.tsx"));
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { OrgProfile, SpecialistProfile } from "../lib/terminal_profiles.ts";
import { buildManagerNav, type ManagerWorkspaceView } from "../lib/workspace_nav.ts";
import { onOpenFeedbackSettings } from "../lib/workspace_navigation.ts";
import SupportFeedbackSection from "./SupportFeedbackSection.tsx";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";

interface ManagerWorkspaceProps {
  meta: InstallationMeta;
  orgProfile: OrgProfile;
  specialistProfile: SpecialistProfile;
  terminalConfig: TerminalConfig;
  territorial: boolean;
  onConfigSaved: (payload: {
    meta: InstallationMeta;
    orgProfile: OrgProfile;
    specialistProfile: SpecialistProfile;
    terminalConfig: TerminalConfig;
  }) => void;
}

export default function ManagerWorkspace(props: ManagerWorkspaceProps) {
  const { meta, orgProfile, specialistProfile, terminalConfig, territorial, onConfigSaved } = props;
  const [activeView, setActiveView] = useState<ManagerWorkspaceView>("dashboard");
  const [settingsRequest, setSettingsRequest] = useState<"feedback" | "inbox" | null>(null);
  const { active: aiSubscriptionActive } = useTerminalSubscription(terminalConfig.terminal_user_id);

  const isCommercial = terminalConfig.org_type === "commercial";
  const navItems = useMemo(
    () => buildManagerNav({ aiSubscriptionActive, commercial: isCommercial, territorial }, terminalConfig),
    [aiSubscriptionActive, isCommercial, territorial, terminalConfig],
  );

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeView)) {
      setActiveView("dashboard");
    }
  }, [navItems, activeView]);

  const handleNavSelect = useCallback(
    (id: string) => {
      const item = navItems.find((row) => row.id === id);
      if (item?.locked) {
        setActiveView("ai_consultant");
        return;
      }
      setActiveView(id as ManagerWorkspaceView);
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
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return onOpenFeedbackSettings(() => {
      setActiveView("settings");
      setSettingsRequest("feedback");
    });
  }, []);

  return (
    <div className="workspace-shell">
      <WorkspaceSidebar
        items={navItems}
        activeId={activeView}
        onSelect={handleNavSelect}
      />

      <div className={`workspace-main${activeView === "academy" ? " workspace-main--academy" : ""}`}>
        {(activeView === "dashboard" || activeView === "leads" || activeView === "specialists") && (
          <ManagerDashboard
            terminalUserId={terminalConfig.terminal_user_id}
            terminalConfig={terminalConfig}
            orgDisplayName={orgProfile.display_name}
            territorial={territorial}
            commercial={terminalConfig.org_type === "commercial"}
            activeTab={activeView === "dashboard" ? "summary" : activeView as "leads" | "specialists"}
          />
        )}

        {activeView === "users" && (
          <UsersPanel
            terminalConfig={terminalConfig}
            orgDisplayName={orgProfile.display_name}
            territorial={territorial}
            commercial={terminalConfig.org_type === "commercial"}
          />
        )}

        {activeView === "ai_consultant" && (
          aiSubscriptionActive ? (
            <ConsultantPanel terminalUserId={terminalConfig.terminal_user_id} />
          ) : (
            <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>Загрузка...</div>}>
              <AiSubscriptionPaywall
                terminalUserId={terminalConfig.terminal_user_id}
                compact={false}
              />
            </Suspense>
          )
        )}

        {activeView === "academy" && (
          <Suspense fallback={<div style={{ padding: "40px", display: "flex", justifyContent: "center", color: "#64748b" }}>Загрузка Академии...</div>}>
            <AIAcademyWorkspace aiSubscriptionActive={aiSubscriptionActive} />
          </Suspense>
        )}

        {activeView === "feedback" && (
          <div className="workspace-panel-stack">
            <section className="card workspace-panel">
              <SupportFeedbackSection terminalUserId={terminalConfig.terminal_user_id} />
            </section>
          </div>
        )}

        {activeView === "settings" && (
          <TerminalSettingsPanel
            terminalUserId={terminalConfig.terminal_user_id}
            terminalConfig={terminalConfig}
            requestedSection={settingsRequest}
            onRequestedSectionHandled={() => setSettingsRequest(null)}
            onSaved={onConfigSaved}
            onTerminalConfigChange={(nextConfig) =>
              onConfigSaved({ meta, orgProfile, specialistProfile, terminalConfig: nextConfig })
            }
          />
        )}
      </div>
    </div>
  );
}
