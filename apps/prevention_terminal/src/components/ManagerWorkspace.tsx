import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import ManagerDashboard from "./ManagerDashboard.tsx";
import TerminalSettingsPanel from "./TerminalSettingsPanel.tsx";
import WorkspaceSidebar from "./WorkspaceSidebar.tsx";
import MobileBottomNav from "./MobileBottomNav.tsx";
import GlobalGuideButton from "./GlobalGuideButton.tsx";

import UsersPanel from "./UsersPanel.tsx";
import ConsultantPanel from "./ConsultantPanel.tsx";
import InboxPanel from "./InboxPanel.tsx";
import { fetchUnreadCount } from "../lib/admin_messages_client.ts";
import AnnualReportWorkspace from "./AnnualReportWorkspace.tsx";
import CenterFinancesWorkspace from "./finances/CenterFinancesWorkspace.tsx";
const AiSubscriptionPaywall = lazy(() => import("./AiSubscriptionPaywall.tsx"));
const AIAcademyWorkspace = lazy(() => import("./AIAcademyWorkspace.tsx"));
const LibraryWorkspace = lazy(() => import("./LibraryWorkspace.tsx"));
const WebinarsWorkspace = lazy(() => import("./WebinarsWorkspace.tsx"));
const VideoConsultationRoom = lazy(() => import("./video/LiveKitRoom.tsx"));
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import type { OrgProfile, SpecialistProfile } from "../lib/terminal_profiles.ts";
import { buildManagerNav, type ManagerWorkspaceView } from "../lib/workspace_nav.ts";
import { onOpenFeedbackSettings } from "../lib/workspace_navigation.ts";
import SupportFeedbackSection from "./SupportFeedbackSection.tsx";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { t } from "../lib/i18n.ts";

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

const VALID_MANAGER_VIEWS: Record<string, ManagerWorkspaceView> = {
  dashboard: "dashboard",
  inbox: "inbox",
  leads: "leads",
  specialists: "specialists",
  users: "users",
  webinars: "webinars",
  video_room: "video_room",
  ai_consultant: "ai_consultant",
  ai: "ai_consultant",
  academy: "academy",
  library: "library",
  articles: "library",
  methodology: "library",
  feedback: "feedback",
  settings: "settings",
  analytical_report: "analytical_report",
  report: "analytical_report",
  reports: "analytical_report",
  finances: "finances",
};

function parseManagerViewFromLocation(): ManagerWorkspaceView | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  if (hash && VALID_MANAGER_VIEWS[hash]) {
    return VALID_MANAGER_VIEWS[hash];
  }
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get("tab") || "").trim().toLowerCase();
  if (tab && VALID_MANAGER_VIEWS[tab]) {
    return VALID_MANAGER_VIEWS[tab];
  }
  return null;
}

export default function ManagerWorkspace(props: ManagerWorkspaceProps) {
  const { meta, orgProfile, specialistProfile, terminalConfig, territorial, onConfigSaved } = props;
  const [activeView, setActiveView] = useState<ManagerWorkspaceView>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode === "webinar" || mode === "webinars" || mode === "events") return "webinars";
      if (params.get("entry") === "academy") return "academy";
      if (params.get("entry") === "library" || params.get("entry") === "methodology") return "library";
      const fromLoc = parseManagerViewFromLocation();
      if (fromLoc) return fromLoc;
    }
    return "dashboard";
  });
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
  const [settingsRequest, setSettingsRequest] = useState<"feedback" | "inbox" | null>(null);
  const { active: aiSubscriptionActive } = useTerminalSubscription(terminalConfig.terminal_user_id, terminalConfig.org_type);
  const [inboxBadge, setInboxBadge] = useState(0);

  // Sync activeView to window.location.hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const currentHash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
      const targetHash = activeView.toLowerCase();
      if (currentHash !== targetHash) {
        const url = new URL(window.location.href);
        url.hash = targetHash;
        window.history.replaceState(null, "", url.toString());
      }
    } catch (_) {}
  }, [activeView]);

  // Listen to browser hash changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleHashChange = () => {
      const parsed = parseManagerViewFromLocation();
      if (parsed && parsed !== activeView) {
        setActiveView(parsed);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeView]);

  // Fetch unread count on mount
  useEffect(() => {
    if (terminalConfig.terminal_user_id) {
      const aud = terminalConfig.org_type === "commercial" ? "commercial" : "ru";
      void fetchUnreadCount(terminalConfig.terminal_user_id, aud).then(setInboxBadge);
    }
  }, [terminalConfig.terminal_user_id, terminalConfig.org_type]);

  const navItems = useMemo(() => {
    const items = buildManagerNav(
      {
        aiSubscriptionActive,
        commercial: terminalConfig.org_type === "commercial",
        territorial,
      },
      terminalConfig,
    );
    return items.map((item) =>
      item.id === "inbox" ? { ...item, badge: inboxBadge } : item,
    );
  }, [aiSubscriptionActive, terminalConfig, territorial, inboxBadge]);

  const handleNavSelect = useCallback((id: string) => {
    const item = navItems.find((row) => row.id === id);
    if (item?.locked) {
      setActiveView("ai_consultant");
      return;
    }
    setActiveView(id as ManagerWorkspaceView);
  }, [navItems]);

  useEffect(() => {
    return onOpenFeedbackSettings(() => {
      setActiveView("feedback");
    });
  }, []);

  return (
    <div className="workspace-shell">
      <WorkspaceSidebar
        items={navItems}
        activeId={activeView}
        onSelect={handleNavSelect}
        cfg={terminalConfig}
      />

      <div className="workspace-main">
        {activeView === "inbox" && (
          <InboxPanel
            centerId={terminalConfig.org_id || terminalConfig.terminal_user_id}
            enabled={true}
            commercial={terminalConfig.org_type === "commercial"}
            userId={terminalConfig.terminal_user_id}
            audience={terminalConfig.org_type === "commercial" ? "commercial" : "ru"}
            userName={specialistProfile.full_name || specialistProfile.display_name}
            userOrg={orgProfile.display_name}
            onUnreadChange={setInboxBadge}
          />
        )}


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

        {activeView === "feedback" && (
          <div className="p-8 pb-32">
            <div className="max-w-3xl">
              <SupportFeedbackSection terminalUserId={terminalConfig.terminal_user_id} />
            </div>
          </div>
        )}

        {activeView === "analytical_report" && (
          <div className="h-full overflow-y-auto">
            <AnnualReportWorkspace terminalUserId={terminalConfig.terminal_user_id} territorial={territorial} isManager={true} />
          </div>
        )}

        {activeView === "finances" && (
          <div className="h-full overflow-y-auto">
            <CenterFinancesWorkspace
              terminalConfig={terminalConfig}
              orgDisplayName={orgProfile.display_name}
            />
          </div>
        )}

        {(activeView === "academy" || activeView === "webinars") && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка Академии...", "Loading Academy...")}</div>}>
            <AIAcademyWorkspace
              aiSubscriptionActive={aiSubscriptionActive}
              cfg={terminalConfig}
              defaultSubTab={activeView === "webinars" ? "webinars" : "courses"}
              specialistName={specialistProfile.full_name || specialistProfile.display_name || "Директор центра"}
              onLaunchStudio={(roomName) => {
                setActiveRoomName(roomName);
                setActiveView("video_room");
              }}
              onNavigateToSpecialist={(view) => setActiveView(view as any)}
            />
          </Suspense>
        )}

        {(activeView === "library" || (activeView as string) === "articles") && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка библиотеки...", "Loading library...")}</div>}>
            <LibraryWorkspace />
          </Suspense>
        )}

        {activeView === "video_room" && (
          <div className="ida-video-room-container" style={{ flex: 1, width: '100%', height: 'calc(100vh - 120px)', minHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px' }}>
            <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка видеокомнаты...", "Loading video room...")}</div>}>
              <VideoConsultationRoom 
                mode="webinar"
                roomName={activeRoomName ? `room-${activeRoomName}` : `room-${terminalConfig.terminal_user_id || 'demo'}`} 
                serverUrl={terminalConfig.org_type === "commercial" ? "wss://live.ida-psy.ru" : "wss://live.prevention.school"} 
                onLeave={() => setActiveView("webinars")} 
                clientName="Студент / Клиент" 
                specialistName={specialistProfile.full_name || specialistProfile.display_name || "Спикер IDA"}
              />
            </Suspense>
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
      <MobileBottomNav
        activeView={activeView}
        onSelect={(view) => handleNavSelect(view as ManagerWorkspaceView)}
        onOpenAllModules={() => {
          window.dispatchEvent(new CustomEvent("terminal:open-mobile-sidebar"));
        }}
        inboxBadge={inboxBadge}
        isCommercial={terminalConfig.org_type === "commercial"}
      />

      <GlobalGuideButton activeView={activeView} cfg={terminalConfig} />
    </div>
  );
}
