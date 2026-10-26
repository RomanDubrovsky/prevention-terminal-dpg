import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";

import CaseWorkspacePanel from "./CaseWorkspacePanel.tsx";
import CalendarWorkspace from "./CalendarWorkspace.tsx";
import ConsultantPanel from "./ConsultantPanel.tsx";
import SupportFeedbackSection from "./SupportFeedbackSection.tsx";
import SpecialistPublicProfileSettings from "./SpecialistPublicProfileSettings.tsx";
import SpecialistDashboard from "./SpecialistDashboard.tsx";
import ConsultationJournalWorkspace from "./ConsultationJournalWorkspace.tsx";
const AIAcademyWorkspace = lazy(() => import("./AIAcademyWorkspace.tsx"));
import { onOpenAcademy } from "../lib/workspace_navigation.ts";
import IprWorkspacePanel from "./IprWorkspacePanel.tsx";
import RegistryWorkspace from "./RegistryWorkspace.tsx";
import WorkspaceSidebar from "./WorkspaceSidebar.tsx";
import MobileBottomNav from "./MobileBottomNav.tsx";
import GlobalGuideButton from "./GlobalGuideButton.tsx";
import IdaClientsPanel from "./IdaClientsPanel.tsx";
import InboxPanel from "./InboxPanel.tsx";
import { fetchUnreadCount } from "../lib/admin_messages_client.ts";
import { trackWorkspaceTab } from "../lib/analytics.ts";

const TerminalSettingsPanel = lazy(() => import("./TerminalSettingsPanel.tsx"));
const SafeEnvironmentWorkspace = lazy(() => import("./SafeEnvironmentWorkspace.tsx"));
const ObservationReportsWorkspace = lazy(() => import("./ObservationReportsWorkspace.tsx"));
const GroupSessionsJournal = lazy(() => import("./GroupSessionsJournal.tsx"));
const VideoConsultationRoom = lazy(() => import("./video/LiveKitRoom.tsx"));
const WebinarsWorkspace = lazy(() => import("./WebinarsWorkspace.tsx"));
const WorkloadWorkspace = lazy(() => import("./WorkloadWorkspace.tsx"));
const ReportingWorkspace = lazy(() => import("./ReportingWorkspace.tsx"));
const AnnualReportWorkspace = lazy(() => import("./AnnualReportWorkspace.tsx"));
const LibraryWorkspace = lazy(() => import("./LibraryWorkspace.tsx"));


import { invoke } from "@tauri-apps/api/core";
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { TerminalConfig, TerminalConfigInput } from "../lib/terminal_config.ts";
import type { OrgProfile, SpecialistProfile } from "../lib/terminal_profiles.ts";
import { getEditionConfig } from "../lib/terminal_edition.ts";
import { t } from "../lib/i18n.ts";
import type { AiMode } from "../lib/ai_workspace.ts";
import {
  buildSpecialistNav,
  defaultSpecialistView,
  isAiWorkspaceView,
  type SpecialistWorkspaceView,
} from "../lib/workspace_nav.ts";
import { confirmLeaveIfUnsaved } from "../lib/unsaved_changes.ts";
import { isTerminalModuleEnabled } from "../lib/terminal_config.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { onOpenFeedbackSettings, onOpenConsultationCase, onOpenSettings } from "../lib/workspace_navigation.ts";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";

const VALID_SPECIALIST_VIEWS: Record<string, SpecialistWorkspaceView> = {
  ipr: "ipr",
  cases: "case_workspace",
  case_workspace: "case_workspace",
  registry: "registry",
  observations: "observations",
  consultations: "consultations",
  group_work: "group_work",
  group: "group_work",
  safe_environment: "safe_environment",
  safety: "safe_environment",
  analytical_report: "analytical_report",
  report: "analytical_report",
  reports: "analytical_report",
  workload: "workload",
  dashboard: "dashboard",
  inbox: "inbox",
  calendar: "calendar",
  academy: "academy",
  library: "library",
  articles: "library",
  methodology: "library",
  ai_consultant: "ai_consultant",
  ai: "ai_consultant",
  feedback: "feedback",
  settings: "settings",
  video_room: "video_room",
  webinars: "webinars",
  ida_clients: "ida_clients",
  my_profile: "my_profile",
};

function parseSpecialistViewFromLocation(): SpecialistWorkspaceView | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  if (hash && VALID_SPECIALIST_VIEWS[hash]) {
    return VALID_SPECIALIST_VIEWS[hash];
  }
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get("tab") || "").trim().toLowerCase();
  if (tab && VALID_SPECIALIST_VIEWS[tab]) {
    return VALID_SPECIALIST_VIEWS[tab];
  }
  return null;
}

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

  const [activeView, setActiveView] = useState<SpecialistWorkspaceView>(() => {
    if (typeof window !== "undefined") {
      const isAcademy =
        window.location.hostname.includes("academy.ida-psy.ru") ||
        window.location.hostname.startsWith("academy.");
      if (isAcademy) return "academy";
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode === "webinar" || mode === "webinars" || mode === "events") return "webinars";
      if (mode === "academy" || params.get("entry") === "academy") return "academy";
      if (mode === "library" || params.get("entry") === "library") return "library";
      const fromLoc = parseSpecialistViewFromLocation();
      if (fromLoc) return fromLoc;
    }
    return defaultSpecialistView();
  });
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [registrySubjectId, setRegistrySubjectId] = useState<string | null>(null);
  const [iprNavEpoch, setIprNavEpoch] = useState(0);
  const [settingsRequest, setSettingsRequest] = useState<"feedback" | "ai_subscription" | null>(null);
  const [academyQuery, setAcademyQuery] = useState<string | undefined>();

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

  // Listen to browser hash changes (back/forward or external links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleHashChange = () => {
      const parsed = parseSpecialistViewFromLocation();
      if (parsed && parsed !== activeView) {
        setActiveView(parsed);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeView]);


  useEffect(() => {
    return onOpenAcademy((query) => {
      if (query) setAcademyQuery(query);
      setActiveView("academy");
    });
  }, []);
  const { active: aiSubscriptionActive } = useTerminalSubscription(cfg.terminal_user_id, cfg.org_type);
  const [inboxBadge, setInboxBadge] = useState(0);

  // Determine audience for admin messages
  const adminAudience = useMemo(() => {
    if (cfg.org_type === "commercial") return "commercial";
    return locale === "en" ? "intl" : "ru";
  }, [cfg.org_type, locale]);

  // Fetch unread count on mount
  useEffect(() => {
    if (cfg.terminal_user_id) {
      void fetchUnreadCount(cfg.terminal_user_id, adminAudience).then(setInboxBadge);
    }
  }, [cfg.terminal_user_id, adminAudience]);

  const navItems = useMemo(
    () => {
      const items = buildSpecialistNav(cfg, locale, { aiSubscriptionActive });
      return items.map((item) =>
        item.id === "inbox" ? { ...item, badge: inboxBadge } : item,
      );
    },
    [aiSubscriptionActive, cfg, locale, inboxBadge],
  );

  const handleNavSelect = useCallback(
    (id: string) => {
      if (!confirmLeaveIfUnsaved()) {
        return;
      }
      const item = navItems.find((row) => row.id === id);
      if (item?.locked) {
        setActiveView("ai_consultant");
        return;
      }
      if (id === "ipr") {
        setRegistrySubjectId(null);
        setIprNavEpoch((prev) => prev + 1);
      }
      if (id === "consultations" || id === "case_workspace") {
        setActiveCaseId(null);
      }
      if (id === "registry") {
        setRegistrySubjectId(null);
      }
      trackWorkspaceTab(id, cfg.org_type);
      setActiveView(id as SpecialistWorkspaceView);
    },
    [navItems],
  );

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const entry = (params.get("entry") || "").toLowerCase();
      const section = (params.get("section") || "").toLowerCase();
      const paywall = params.get("paywall");

      if (entry === "academy") {
        setActiveView("academy");
        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        window.history.replaceState({}, "", url.toString());
      } else if (entry === "library" || entry === "methodology") {
        setActiveView("library");
        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        window.history.replaceState({}, "", url.toString());
      } else if (entry === "subscribe" || section === "ai_subscription" || paywall === "1") {
        setActiveView("settings");
        setSettingsRequest("ai_subscription");
        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        url.searchParams.delete("section");
        url.searchParams.delete("paywall");
        window.history.replaceState({}, "", url.toString());
      }
    } catch (e) {
      /* ignore searchParams error */
    }
  }, []);

  useEffect(() => {
    if (activeView === "video_room" || activeView === "webinars" || activeView === "academy" || activeView === "library") return;
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
    return onOpenSettings((section) => {
      setActiveView("settings");
      if (section === "feedback" || section === "ai_subscription") {
        setSettingsRequest(section);
      }
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
    if (caseId !== activeCaseId) {
      if (!confirmLeaveIfUnsaved()) return;
    }
    setActiveCaseId(caseId);
  }, [activeCaseId]);

  const handleRegistrySubjectSelect = useCallback((subjectId: string | null) => {
    if (subjectId !== registrySubjectId) {
      if (!confirmLeaveIfUnsaved()) return;
    }
    setRegistrySubjectId(subjectId);
  }, [registrySubjectId]);

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

  const handleUpdateModules = useCallback(
    async (nextModules: Record<string, boolean>) => {
      const mergedModules = {
        ...cfg.enabled_modules,
        ...nextModules,
      };

      const terminalInput: TerminalConfigInput = {
        edition: cfg.edition,
        mode: cfg.mode,
        workspace_preset: cfg.workspace_preset,
        org_type: cfg.org_type,
        manager_scope: cfg.manager_scope,
        job_title: cfg.job_title,
        child_invite_code: cfg.child_invite_code,
        parent_invite_code: cfg.parent_invite_code,
        parent_invite_in: cfg.parent_invite_in,
        child_invite_in: cfg.child_invite_in,
        consumer_app: cfg.consumer_app,
        enabled_modules: mergedModules,
        registry_enabled: cfg.registry_enabled,
      };

      try {
        const nextCfg = await invoke<TerminalConfig>("terminal_save_config", { input: terminalInput });
        onConfigSaved({
          meta,
          orgProfile,
          specialistProfile,
          terminalConfig: nextCfg,
        });
      } catch (err) {
        console.error("Failed to save terminal modules:", err);
      }
    },
    [cfg, meta, onConfigSaved, orgProfile, specialistProfile],
  );

  const activeAiMode = aiModeFromView(activeView);

  return (
    <div className="workspace-shell">
      <WorkspaceSidebar
        items={navItems}
        activeId={activeView}
        onSelect={handleNavSelect}
        cfg={cfg}
        onUpdateModules={handleUpdateModules}
      />

      <div className="workspace-main">
        {activeView === "dashboard" && (
          <SpecialistDashboard cfg={cfg} deepLinkMsg={deepLinkMsg} onNavigate={setActiveView} />
        )}

        {activeView === "inbox" && (
          <InboxPanel
            centerId={cfg.org_id || cfg.terminal_user_id}
            enabled={true}
            commercial={cfg.org_type === "commercial"}
            userId={cfg.terminal_user_id}
            audience={adminAudience}
            userName={specialistProfile.full_name || specialistProfile.display_name}
            userOrg={orgProfile.display_name}
            onUnreadChange={setInboxBadge}
          />
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

        {activeView === "academy" && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка Академии...", "Loading Academy...")}</div>}>
            <AIAcademyWorkspace
              aiSubscriptionActive={aiSubscriptionActive}
              initialQuery={academyQuery}
              cfg={cfg}
              specialistName={specialistProfile.full_name || specialistProfile.display_name || "Специалист IDA"}
              onLaunchStudio={(roomName) => {
                setActiveCaseId(roomName);
                setActiveView("video_room");
              }}
              onNavigateToSpecialist={(view) => setActiveView(view as any)}
            />
          </Suspense>
        )}

        {activeView === "webinars" && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка Академии...", "Loading Academy...")}</div>}>
            <AIAcademyWorkspace
              aiSubscriptionActive={aiSubscriptionActive}
              initialQuery={academyQuery}
              cfg={cfg}
              defaultSubTab="webinars"
              specialistName={specialistProfile.full_name || specialistProfile.display_name || "Специалист IDA"}
              onLaunchStudio={(roomName) => {
                setActiveCaseId(roomName);
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

        {activeView === "registry" && (
          <RegistryWorkspace
            cfg={cfg}
            selectedSubjectId={registrySubjectId}
            onSubjectSelect={handleRegistrySubjectSelect}
            onRegistryEnabled={handleRegistryEnabled}
          />
        )}

        {activeView === "observations" && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка наблюдений...", "Loading observations...")}</div>}>
            <ObservationReportsWorkspace
              cfg={cfg}
              onNavigateToAcademy={(topic) => {
                if (topic) setAcademyQuery(topic);
                setActiveView("academy");
              }}
            />
          </Suspense>
        )}

        {activeView === "consultations" && (
          <ConsultationJournalWorkspace
            cfg={cfg}
            activeCaseId={activeCaseId}
            onCaseSelect={handleCaseSelect}
            onRegistrySubjectSelect={handleRegistrySubjectSelect}
            onOpenCaseWorkspace={() => setActiveView("case_workspace")}
            onOpenRegistry={() => setActiveView("registry")}
            specialistName={specialistProfile.full_name || "Специалист"}
          />
        )}

        {activeView === "ipr" && isTerminalModuleEnabled(cfg, "ipr") && (
          <IprWorkspacePanel
            key={`ipr-workspace-${iprNavEpoch}`}
            cfg={cfg}
            registrySubjectId={registrySubjectId}
            onRegistrySubjectSelect={handleRegistrySubjectSelect}
            onOpenRegistry={() => setActiveView("registry")}
            terminalUserId={cfg.terminal_user_id}
          />
        )}

        {activeView === "group_work" && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка групповой работы...", "Loading group sessions...")}</div>}>
            <GroupSessionsJournal terminalUserId={cfg.terminal_user_id} cfg={cfg} />
          </Suspense>
        )}

        {activeView === "workload" && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка...", "Loading...")}</div>}>
            <WorkloadWorkspace
              orgName={orgProfile.display_name}
              specialistName={specialistProfile.display_name}
              cfg={cfg}
            />
          </Suspense>
        )}

        {activeView === "analytical_report" && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка...", "Loading...")}</div>}>
            <ReportingWorkspace
              terminalUserId={cfg.terminal_user_id}
              cfg={cfg}
              orgName={orgProfile.display_name}
              specialistName={specialistProfile.display_name}
            />
          </Suspense>
        )}

        {activeView === "safe_environment" && isTerminalModuleEnabled(cfg, "safe_environment") && (
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка безопасной среды...", "Loading safe environment...")}</div>}>
            <SafeEnvironmentWorkspace terminalUserId={cfg.terminal_user_id} />
          </Suspense>
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
          <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка настроек...", "Loading settings...")}</div>}>
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
          </Suspense>
        )}

        {activeView === "feedback" && (
          <div className="workspace-panel-stack">
            <section className="card workspace-panel">
              <SupportFeedbackSection terminalUserId={cfg.terminal_user_id} />
            </section>
          </div>
        )}

        {activeView === "my_profile" && (
          <div className="workspace-panel-stack">
            <SpecialistPublicProfileSettings
              centerId={cfg.center_id || cfg.org_id || cfg.organization_id || "default-center"}
              setupToken={meta.setup_token || cfg.setup_token || cfg.terminal_api_key || ""}
              terminalUserId={cfg.terminal_user_id || "local"}
            />
          </div>
        )}

        {activeView === "video_room" && (
          <div className="ida-video-room-container" style={{ flex: 1, width: '100%', height: 'calc(100vh - 120px)', minHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px' }}>
            <Suspense fallback={<div className="workspace-panel-loading">{t("Загрузка видеокомнаты...", "Loading video room...")}</div>}>
              <VideoConsultationRoom 
                mode={activeCaseId?.startsWith("webinar-") || activeCaseId?.startsWith("instant-") ? "webinar" : "consultation"}
                caseId={activeCaseId && !activeCaseId.startsWith("webinar-") && !activeCaseId.startsWith("instant-") ? activeCaseId : undefined}
                roomName={activeCaseId ? `room-${activeCaseId}` : `room-${cfg.terminal_user_id || 'demo'}`} 
                serverUrl={cfg.org_type === "commercial" ? "wss://live.ida-psy.ru" : "wss://live.prevention.school"} 
                onLeave={() => {
                  if (activeCaseId && !activeCaseId.startsWith("webinar-") && !activeCaseId.startsWith("instant-")) {
                    setActiveView("calendar");
                  } else {
                    setActiveView("webinars");
                  }
                }} 
                clientName="Студент / Клиент" 
                specialistName={specialistProfile.full_name || specialistProfile.display_name || "Специалист IDA"}
              />
            </Suspense>
          </div>
        )}

        {activeView === "ida_clients" && (
          <div className="workspace-panel-stack" style={{ padding: 0, height: "100%" }}>
            <section className="card workspace-panel" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
              <IdaClientsPanel
                specialistId={cfg.terminal_user_id}
                setupToken={cfg.setup_token || ""}
              />
            </section>
          </div>
        )}
      </div>

      <MobileBottomNav
        activeView={activeView}
        onSelect={handleNavSelect}
        onOpenAllModules={() => {
          window.dispatchEvent(new CustomEvent("terminal:open-mobile-sidebar"));
        }}
        inboxBadge={inboxBadge}
        isCommercial={cfg.org_type === "commercial"}
      />

      <GlobalGuideButton activeView={activeView} cfg={cfg} />
    </div>
  );
}
