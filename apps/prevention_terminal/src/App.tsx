
function getSpecialistAvatarText(displayName?: string, jobTitle?: string, isEducator?: boolean): string {
  if (isEducator) return "🎓";
  if (displayName && displayName.trim() && displayName !== "Специалист" && displayName !== "Педагог") {
    return displayName.trim().charAt(0).toUpperCase();
  }
  if (jobTitle) {
    const lower = jobTitle.toLowerCase();
    if (lower.includes("педагог") && lower.includes("психолог")) return "Ψ";
    if (lower.includes("педагог") || lower.includes("учитель") || lower.includes("классный")) return "🎓";
    if (lower.includes("психолог")) return "Ψ";
    if (lower.includes("руководитель") || lower.includes("директор")) return "💼";
    return jobTitle.trim().charAt(0).toUpperCase();
  }
  return "👤";
}

/**
 * Корневой компонент Prevention Terminal (Unified).
 */

import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";

import MasterPasswordGate from "./components/MasterPasswordGate";
import IdaAuthGate from "./components/IdaAuthGate";
import SchoolWebGate from "./components/SchoolWebGate";
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const reloaded = sessionStorage.getItem("chunk_reload_retry") === "true";
    try {
      const component = await factory();
      sessionStorage.setItem("chunk_reload_retry", "false");
      return component;
    } catch (error) {
      if (!reloaded) {
        sessionStorage.setItem("chunk_reload_retry", "true");
        window.location.reload();
      }
      throw error;
    }
  });
}

const isRoomInUrl = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("room");
if (isRoomInUrl) {
  // Eager prefetch room chunk immediately so browser downloads in parallel
  import("./components/video/LiveKitRoom.tsx").catch(() => {});
}

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent || navigator.vendor || "").toLowerCase();
  return (
    ua.includes("telegram") ||
    ua.includes("yasearchbrowser") ||
    ua.includes("yasearchapp") ||
    ua.includes("vkapp") ||
    ua.includes("vkclient") ||
    ua.includes("instagram") ||
    ua.includes("fban") ||
    ua.includes("fbav") ||
    ua.includes("micromessenger")
  );
}

function RoomLoadingFallback() {
  const [slowNotice, setSlowNotice] = useState(false);
  const [inAppNoticeDismissed, setInAppNoticeDismissed] = useState(false);
  const inApp = typeof window !== "undefined" && isInAppBrowser();

  useEffect(() => {
    const t = setTimeout(() => setSlowNotice(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#09090b", color: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      {inApp && !inAppNoticeDismissed && (
        <div style={{ position: "absolute", top: "16px", left: "16px", right: "16px", background: "rgba(234, 179, 8, 0.15)", border: "1px solid rgba(234, 179, 8, 0.4)", borderRadius: "10px", padding: "12px 14px", color: "#fef08a", fontSize: "0.85rem", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: "10px", textAlign: "left", maxWidth: "480px", margin: "0 auto" }}>
          <span>💡</span>
          <div style={{ flex: 1 }}>
            <strong>Вы открыли эфир во встроенном браузере приложения.</strong>
            <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#fef9c3" }}>
              Для стабильного видео и звука рекомендуем нажать <strong>⋮</strong> в углу экрана и выбрать <strong>«Открыть в браузере»</strong> (Chrome / Safari).
            </div>
          </div>
          <button type="button" onClick={() => setInAppNoticeDismissed(true)} style={{ background: "transparent", border: "none", color: "#fef08a", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
      )}

      <div style={{ width: "42px", height: "42px", border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "18px" }} />
      <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 700 }}>Подключение к защищенной видеосессии...</h3>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem", maxWidth: "340px" }}>Настройка медиа-канала и безопасного шифрования комнаты</p>

      {slowNotice && (
        <div style={{ marginTop: "24px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "14px 18px", maxWidth: "360px" }}>
          <p style={{ margin: "0 0 12px 0", fontSize: "0.84rem", color: "#cbd5e1" }}>
            Загрузка занимает больше времени из-за медленного мобильного интернета.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer" }}
          >
            ↻ Обновить страницу
          </button>
        </div>
      )}
    </div>
  );
}

const EducatorLiteWorkspace = lazyWithRetry(() => import("./components/EducatorLiteWorkspace"));
const AIAcademyWorkspace = lazyWithRetry(() => import("./components/AIAcademyWorkspace"));
const CreatorStudioWorkspace = lazyWithRetry(() => import("./components/CreatorStudioWorkspace.tsx"));
const SpecialistWorkspace = lazyWithRetry(() => import("./components/SpecialistWorkspace"));
const ManagerWorkspace = lazyWithRetry(() => import("./components/ManagerWorkspace.tsx"));
const UnifiedOnboardingWizard = lazyWithRetry(() => import("./components/UnifiedOnboardingWizard"));
const VideoConsultationRoom = lazyWithRetry(() => import("./components/video/LiveKitRoom.tsx"));
const WebinarWaitingLobby = lazyWithRetry(() => import("./components/video/WebinarWaitingLobby.tsx").then(m => ({ default: m.WebinarWaitingLobby })));
const ProtectedRecordingPlayer = lazyWithRetry(() => import("./components/video/ProtectedRecordingPlayer.tsx").then(m => ({ default: m.ProtectedRecordingPlayer })));
const StudentCourseWorkspace = lazyWithRetry(() => import("./components/academy/StudentCourseWorkspace.tsx"));
const AcademyAfishaView = lazyWithRetry(() => import("./components/academy/AcademyAfishaWidget.tsx").then(m => ({ default: m.AcademyAfishaView })));
const PublicSitePageView = lazyWithRetry(() => import("./components/academy/PublicSitePageView.tsx"));
import AiSubscriptionIndicator from "./components/AiSubscriptionIndicator.tsx";
import UserAccountMenu from "./components/UserAccountMenu.tsx";
import WorkspaceSwitcher, { type WorkspaceId } from "./components/WorkspaceSwitcher.tsx";
import type { InstallationMeta } from "./lib/installation_meta.ts";
import {
  defaultEnabledModules,
  getEnabledApplications,
  isEducatorLite,
  isTerritorialManager,
  isTerminalConfigComplete,
  isTerminalModuleEnabled,
  type OrgTypePreset,
  type TerminalConfig,
} from "./lib/terminal_config.ts";
import { t } from "./lib/i18n.ts";
import {
  isOrgProfileComplete,
  isSpecialistProfileComplete,
  type OrgProfile,
  type SpecialistProfile,
} from "./lib/terminal_profiles.ts";
import { preloadEnabledModuleBundles } from "./lib/module_bundles.ts";
import { bootstrapEducatorLiteInstallation } from "./lib/bootstrap_educator_lite.ts";
import { resolveOnboardingEntry } from "./lib/onboarding_entry.ts";
import { terminalAppTitle, terminalWorkspaceSubtitle, getMainLandingInfo, getTerminalHeaderBranding } from "./lib/terminal_branding.ts";
import { trySharedCaseDeepLink } from "./lib/shared_case_deeplink.ts";
import { maybeUploadResearchContribution } from "./lib/research_contribution.ts";
import { isWebStaging, readStagingAiPreview, resetStagingSetup, writeStagingAiPreview } from "./lib/web_staging.ts";
import { getTerminalEdition } from "./lib/terminal_edition.ts";
import { isCorporateProduct } from "./lib/terminal_product.ts";
import { lookupTerminalByEmail } from "./lib/federation_client.ts";
import {
  ensureDemoSeed,
  isDemoModeActive,
} from "./lib/staging_demo_seed.ts";

type InstallationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "missing" }
  | {
      kind: "ready";
      meta: InstallationMeta;
      orgProfile: OrgProfile;
      specialistProfile: SpecialistProfile;
      terminalConfig: TerminalConfig;
    }
  | { kind: "error"; message: string };

function modEnabled(cfg: TerminalConfig, id: string): boolean {
  return isTerminalModuleEnabled(cfg, id);
}

const isCorporateHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("corporate-health") || isCorporateProduct());

const isAcademyHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("academy.ida-psy.ru") ||
   window.location.hostname.includes("web.academy.") ||
   window.location.hostname.startsWith("academy.") ||
   new URLSearchParams(window.location.search).get("mode") === "academy" ||
   new URLSearchParams(window.location.search).get("entry") === "academy");

const isRoomParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("room");

const isWebinarCreatorEntry =
  typeof window !== "undefined" &&
  !isRoomParam &&
  (() => {
    const p = new URLSearchParams(window.location.search);
    const m = (p.get("mode") || "").trim().toLowerCase();
    const e = (p.get("entry") || "").trim().toLowerCase();
    const t = (p.get("tab") || "").trim().toLowerCase();
    return (
      m === "webinar" ||
      m === "webinars" ||
      m === "events" ||
      m === "creator" ||
      m === "studio" ||
      e === "webinar" ||
      e === "webinars" ||
      e === "events" ||
      e === "creator" ||
      e === "studio" ||
      t === "webinar" ||
      t === "webinars"
    );
  })();

const isAcademyOrWebinarHost = isAcademyHost || isWebinarCreatorEntry;

const isIdaHost =
  typeof window !== "undefined" &&
  !isCorporateHost &&
  (window.location.hostname.includes("ida-psy.pro") ||
   window.location.hostname.includes("ida-psy.ru") ||
   window.location.hostname.includes("ida-ai.chat") ||
   window.location.hostname.includes("ida.chat") ||
   window.location.hostname.includes("academy") ||
   window.location.hostname.includes("ida"));
const isSchoolWebHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "web.prevention.school" ||
   window.location.hostname === "web.prevention-ai.ru");
const isDemoUrlParam =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("demo") ||
   new URLSearchParams(window.location.search).get("entry") === "demo");
const isAutoLoginParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auto_login") === "1";
const isAfishaEmbedParam =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).get("embed_afisha") === "1" ||
   new URLSearchParams(window.location.search).get("mode") === "afisha");
const isEducatorEntry =
  typeof window !== "undefined" &&
  (() => {
    const raw = (new URLSearchParams(window.location.search).get("entry") || "").trim().toLowerCase();
    return raw === "educator" || raw === "educator_lite" || raw === "pedagog" || raw === "teacher";
  })();
const isStudentParam =
  typeof window !== "undefined" &&
  (() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("role") === "student" || sp.get("role") === "pupil" || sp.get("mode") === "course" || sp.get("mode") === "lesson" || sp.get("mode") === "tutor" || sp.get("mode") === "study" || sp.has("course");
  })();
const hasBypassParam = isDemoUrlParam || isAutoLoginParam || isAfishaEmbedParam || isRoomParam || isCorporateHost || isEducatorEntry || isStudentParam;

const idaAuthMode = (import.meta.env.VITE_IDA_AUTH_MODE === "supabase" || isIdaHost || isAcademyOrWebinarHost) && !hasBypassParam;
const schoolWebGateMode = isSchoolWebHost && !hasBypassParam;
const webStaging = (isWebStaging() || isCorporateHost) && !idaAuthMode && !schoolWebGateMode;
if ((webStaging || hasBypassParam) && !isAcademyOrWebinarHost) {
  try {
    ensureDemoSeed();
  } catch {
    /* ignore seed errors on boot */
  }
}

export default function App() {
  const urlSearchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const clientRoomName = urlSearchParams?.get("room") || null;
  const urlRole = urlSearchParams?.get("role")?.toLowerCase();
  const urlMode = urlSearchParams?.get("mode")?.toLowerCase();
  const isLessonMode = urlMode === "lesson" || urlMode === "tutor" || urlMode === "study";
  const isCourseMode = !isLessonMode && (urlMode === "course" || urlSearchParams?.get("type") === "course" || urlRole === "student");
  const isWebinarMode = !isLessonMode && !isCourseMode && (
    urlMode === "webinar" ||
    Boolean(urlSearchParams?.get("time")) ||
    urlRole === "guest" ||
    urlRole === "listener" ||
    urlRole === "speaker" ||
    urlRole === "cohost" ||
    urlRole === "author"
  );

  const isTeacherRole = urlRole === "teacher" || urlRole === "tutor" || urlRole === "instructor";
  const isAuthorRole = isTeacherRole || urlRole === "author" || urlRole === "host" || urlRole === "admin";
  const isSpeakerRole = urlRole === "speaker" || urlRole === "cohost";
  const isStudentRole = urlRole === "student" || urlRole === "pupil" || ((isCourseMode || isLessonMode) && !isAuthorRole && !isSpeakerRole);
  const isListenerRole = urlRole === "listener" || urlRole === "guest" || (!isSpeakerRole && !isAuthorRole && !isStudentRole && isWebinarMode);

  const [currentRole, setCurrentRole] = useState<string>(() => {
    if (urlRole) return urlRole;
    if (isLessonMode) return "student";
    if (isCourseMode) return "student";
    if (isWebinarMode) return "listener";
    return "client";
  });
  const isClientRole = isStudentRole || isListenerRole || (!isAuthorRole && !isSpeakerRole && currentRole === "client");
  const webinarTitle = urlSearchParams?.get("title") || undefined;
  const webinarTime = urlSearchParams?.get("time") || undefined;
  const webinarSpeaker = urlSearchParams?.get("speaker") || undefined;
  const webinarDesc = urlSearchParams?.get("desc") || undefined;

  const [customJoinedName, setCustomJoinedName] = useState<string>(() => {
    return urlSearchParams?.get("name") || (typeof localStorage !== "undefined" ? localStorage.getItem("ida_user_display_name") || "" : "");
  });

  const [inWebinarLobby, setInWebinarLobby] = useState(() => {
    // Ведущий (спикер, автор) никогда не должен застревать в лобби ожидания: сразу входит в студию
    if (isSpeakerRole || isAuthorRole) {
      return urlSearchParams?.get("lobby") === "1";
    }
    if (urlSearchParams?.get("no_lobby") === "1") return false;
    return Boolean(clientRoomName && (isWebinarMode || urlSearchParams?.get("lobby") === "1"));
  });

  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const hasUrlToken = !!(
        sp.get("token") ||
        sp.get("auth_token") ||
        sp.get("access_token") ||
        sp.get("platform_access_token")
      );
      if (hasUrlToken) return true;
    }
    if (hasBypassParam) return true;
    if (idaAuthMode || schoolWebGateMode) {
      return typeof localStorage !== "undefined" && !!localStorage.getItem("platform_access_token");
    }
    return webStaging;
  });
  const [deepLinkMsg, setDeepLinkMsg] = useState<string | null>(null);
  const [installation, setInstallation] = useState<InstallationState>(() => {
    let authorized = false;
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const hasUrlToken = !!(
        sp.get("token") ||
        sp.get("auth_token") ||
        sp.get("access_token") ||
        sp.get("platform_access_token")
      );
      if (hasUrlToken) authorized = true;
    }
    if (hasBypassParam || webStaging) authorized = true;
    if ((idaAuthMode || schoolWebGateMode) && typeof localStorage !== "undefined" && !!localStorage.getItem("platform_access_token")) {
      authorized = true;
    }
    return authorized ? { kind: "loading" } : { kind: "idle" };
  });
  const [stagingAiPreview, setStagingAiPreview] = useState(() => readStagingAiPreview());

  const handleAuthorized = useCallback(() => {
    setIsAuthorized(true);
    setInstallation({ kind: "loading" });
  }, []);

  // SSO handshake from URL parameters (?token=...&email=...&name=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const urlToken =
        sp.get("token") ||
        sp.get("auth_token") ||
        sp.get("access_token") ||
        sp.get("platform_access_token");
      const urlEmail = sp.get("email") || sp.get("platform_email");
      const urlName = sp.get("name") || sp.get("platform_name");

      let changed = false;
      if (urlToken && urlToken.trim()) {
        localStorage.setItem("platform_access_token", urlToken.trim());
        changed = true;
        try {
          const parts = urlToken.trim().split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))));
            if (payload.email && !localStorage.getItem("platform_email")) {
              localStorage.setItem("platform_email", String(payload.email).toLowerCase());
            }
            if ((payload.user_metadata?.full_name || payload.user_metadata?.name || payload.name) && !localStorage.getItem("platform_name")) {
              localStorage.setItem("platform_name", payload.user_metadata?.full_name || payload.user_metadata?.name || payload.name);
            }
            if (payload.sub && !localStorage.getItem("platform_user_id")) {
              localStorage.setItem("platform_user_id", payload.sub);
            }
          }
        } catch {}
      }
      if (urlEmail && urlEmail.trim()) {
        localStorage.setItem("platform_email", urlEmail.trim().toLowerCase());
        changed = true;
      }
      if (urlName && urlName.trim()) {
        localStorage.setItem("platform_name", urlName.trim());
        changed = true;
      }

      if (changed) {
        setIsAuthorized(true);
        setInstallation((prev) => (prev.kind === "idle" ? { kind: "loading" } : prev));
        // Clean up sensitive tokens from query parameters without reload
        sp.delete("token");
        sp.delete("auth_token");
        sp.delete("access_token");
        sp.delete("platform_access_token");
        const cleanQuery = sp.toString();
        const cleanUrl =
          window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "") + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location && window.history) {
      const p = window.location.pathname.replace(/\/+$/, "");
      if (p === "/register" || p === "/login") {
        const u = new URL(window.location.href);
        u.pathname = "/";
        window.history.replaceState({}, document.title, u.toString());
      }
    }
  }, []);

  if (clientRoomName) {
    if (inWebinarLobby) {
      return (
        <Suspense fallback={<div style={{ padding: "40px", color: "#fff", textAlign: "center", background: "#09090b", minHeight: "100vh" }}>Подготовка прямого эфира...</div>}>
          <WebinarWaitingLobby
            roomName={clientRoomName}
            title={webinarTitle}
            scheduledTime={webinarTime}
            speakerName={webinarSpeaker}
            description={webinarDesc}
            role={(currentRole as any) || (isClientRole ? "listener" : "speaker")}
            onJoinRoom={(name) => {
              if (name) setCustomJoinedName(name);
              setInWebinarLobby(false);
            }}
            onSwitchRole={(newRole) => setCurrentRole(newRole)}
            onBack={() => {
              if (isAcademyHost) {
                window.location.href = "/";
              } else {
                window.location.href = "https://ida-psy.ru";
              }
            }}
            onOpenPsychologistWorkspace={() => {
              if (isAcademyHost) {
                const isIntl = typeof window !== "undefined" && window.location.hostname.endsWith(".pro");
                window.location.href = isIntl
                  ? "https://ida-psy.pro/terminal/staging/?demo=1"
                  : "https://ida-psy.ru/terminal/staging/?demo=1";
              } else {
                window.location.href = "/?tab=academy";
              }
            }}
          />
        </Suspense>
      );
    }

    return (
      <main style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#09090b", margin: 0, padding: 0 }}>
        <Suspense fallback={<RoomLoadingFallback />}>
          <VideoConsultationRoom
            roomName={clientRoomName}
            specialistName={
              isStudentRole
                ? (customJoinedName || (isLessonMode ? "Ученик" : "Студент"))
                : isListenerRole
                  ? (customJoinedName || "Слушатель")
                  : (webinarSpeaker || (currentRole === "cohost" || currentRole === "speaker" ? "Со-ведущий" : (isLessonMode || isTeacherRole ? "Преподаватель" : isCourseMode ? "Преподаватель" : "Ведущий")))
            }
            clientName={customJoinedName || (isStudentRole ? (isLessonMode ? "Ученик" : "Студент") : isListenerRole ? "Слушатель" : "Участник")}
            isClient={isClientRole}
            mode={isLessonMode ? "lesson" : (isCourseMode ? "course" : (isWebinarMode ? "webinar" : "consultation"))}
            role={currentRole}
            onLeave={() => {
              if (isAcademyHost) {
                window.location.href = "/";
              } else {
                window.location.href = "https://ida-psy.ru";
              }
            }}
          />
        </Suspense>
      </main>
    );
  }

  useEffect(() => {
    if (!isAuthorized) return;
    if (installation.kind !== "loading") {
      if (installation.kind === "idle") {
        setInstallation({ kind: "loading" });
      }
      return;
    }
    let alive = true;

    // Direct auto-login check: If auto_login=1 is in URL, initialize profile directly without wizard/lookup
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isAutoLogin = urlParams.get("auto_login") === "1";
    const urlRole = urlParams.get("role");
    const urlParentIn = urlParams.get("parent_in");
    const urlEmail = urlParams.get("email");

    if (isAutoLogin && urlRole === "specialist" && urlParentIn && urlEmail) {
      const b64DecodeUnicode = (str: string) => {
        try {
          return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        } catch { return ""; }
      };
      const n64 = urlParams.get("n64") || "";
      const o64 = urlParams.get("o64") || "";
      const name = n64 ? b64DecodeUnicode(n64) : (urlParams.get("name") || urlEmail.split("@")[0]);
      const org = o64 ? b64DecodeUnicode(o64) : (urlParams.get("org") || "Организация");
      const edition = getTerminalEdition();

      try {
        localStorage.setItem("platform_email", urlEmail.trim().toLowerCase());
        localStorage.setItem("platform_name", name);
      } catch {}

      import("./lib/persist_terminal_setup.ts").then(({ persistTerminalSetup }) => {
        import("./lib/terminal_setup_constants.ts").then(({ DEFAULT_INSTALLATION }) => {
          import("./lib/terminal_profiles.ts").then(({ DEFAULT_ORG_PROFILE }) => {
            import("./lib/terminal_config.ts").then(({ defaultEnabledModules }) => {
              persistTerminalSetup({
                installationInput: {
                  ...DEFAULT_INSTALLATION,
                  organization_label: org,
                  organization_type: "psychological_center",
                  settlement: "Онлайн",
                },
                orgDraft: {
                  ...DEFAULT_ORG_PROFILE,
                  display_name: org,
                  org_kind: "psych_support_center",
                  org_sphere: "education_system",
                },
                specialistPayload: {
                  display_name: name,
                  role_text: "Психолог",
                  weekly_contract_minutes: 2160,
                  rate_type: "fixed",
                  rate_value: 0,
                },
                edition,
                mode: "specialist",
                workspacePreset: "specialist",
                orgType: "commercial",
                managerScopeChoice: null,
                jobTitle: "Психолог",
                childCode: "CHILD-AUTO",
                parentCode: "PARENT-AUTO",
                parentIn: urlParentIn,
                childIn: "",
                modules: defaultEnabledModules("specialist", "commercial", "specialist"),
                registryEnabled: false,
                isManagerPreset: false,
                centerId: "",
                setupToken: "",
              }).then((payload) => {
                if (!alive) return;
                setInstallation({ kind: "ready", ...payload });
              }).catch((err) => {
                console.error("Direct auto-login error:", err);
                if (!alive) return;
                setInstallation({ kind: "missing" });
              });
            });
          });
        });
      });
      return () => { alive = false; };
    }

    if (webStaging || hasBypassParam) {
      try {
        ensureDemoSeed();
      } catch {
        /* ignore seed errors on boot */
      }
    }

    Promise.all([
      invoke<InstallationMeta | null>("installation_get_meta"),
      invoke<TerminalConfig | null>("terminal_get_config"),
      invoke<OrgProfile | null>("db_get_org_profile"),
      invoke<SpecialistProfile | null>("db_get_specialist_profile"),
    ])
      .then(async ([meta, terminalConfig, orgProfile, specialistProfile]) => {
        if (!alive) return;
        const isDemoActive = isDemoModeActive();
        const isSyntheticDemo =
          terminalConfig?.terminal_user_id?.startsWith("tu-demo-") ||
          (typeof orgProfile?.display_name === "string" && (orgProfile.display_name.includes("Северная звезда") || orgProfile.display_name.includes("ЭкоСистема Технологий") || orgProfile.display_name.includes("EcoSystem Technologies"))) ||
          (typeof specialistProfile?.display_name === "string" && (specialistProfile.display_name.includes("Воронова") || specialistProfile.display_name.includes("Ростова"))) ||
          (typeof terminalConfig?.center_id === "string" && terminalConfig.center_id.includes("demo-"));

        const authEmail = localStorage.getItem("platform_email") || new URLSearchParams(window.location.search).get("email") || "";
        if (isSyntheticDemo && !isDemoActive && !isAcademyOrWebinarHost) {
          // Clear cached demo seed so clean workspace / onboarding is loaded
          try {
            localStorage.removeItem("prevention_terminal_staging_v1");
            localStorage.removeItem("prevention_terminal_demo_flag");
            localStorage.removeItem("prevention_terminal_demo_version");
            localStorage.removeItem("ida_terminal_webinars_v1");
          } catch {}
          setInstallation({ kind: "missing" });
          return;
        }

        const isEducatorDeepLink = resolveOnboardingEntry().kind === "educator";
        if (isEducatorDeepLink) {
          if (
            meta &&
            terminalConfig &&
            isEducatorLite(terminalConfig) &&
            orgProfile &&
            specialistProfile
          ) {
            setInstallation({
              kind: "ready",
              meta,
              orgProfile,
              specialistProfile,
              terminalConfig,
            });
            return;
          }
          try {
            const payload = await bootstrapEducatorLiteInstallation();
            if (!alive) return;
            setInstallation({ kind: "ready", ...payload });
          } catch (err) {
            if (!alive) return;
            setInstallation({
              kind: "error",
              message: `Не удалось открыть кабинет педагога: ${String(err)}`,
            });
          }
          return;
        }

        if (
          meta &&
          terminalConfig &&
          isTerminalConfigComplete(terminalConfig) &&
          orgProfile &&
          isOrgProfileComplete(orgProfile) &&
          specialistProfile &&
          isSpecialistProfileComplete(specialistProfile)
        ) {
          const entryVal = new URLSearchParams(window.location.search).get("entry");
          if (entryVal === "specialist" || entryVal === "school" || entryVal === "education" || !isEducatorEntry) {
            if (isEducatorLite(terminalConfig)) {
              terminalConfig = {
                ...terminalConfig,
                workspace_preset: "specialist",
                job_title: "Педагог-психолог",
                enabled_modules: {
                  ...terminalConfig.enabled_modules,
                  ...defaultEnabledModules("specialist", "education", "specialist"),
                  ai_consultant_lite: false,
                },
              };
              void invoke("terminal_save_config", { input: terminalConfig }).catch(() => {});
            }
          }
          setInstallation({
            kind: "ready",
            meta,
            orgProfile,
            specialistProfile,
            terminalConfig,
          });
          return;
        }

        // Try automatic cloud account recovery by email before showing onboarding wizard
        if (authEmail && authEmail.includes("@")) {
          try {
            const lookupResult = await lookupTerminalByEmail(authEmail);
            if (!alive) return;
            if (lookupResult.found && lookupResult.node) {
              const edition = getTerminalEdition();
              const restoredCfg = await invoke<TerminalConfig>("terminal_restore_config", {
                node: lookupResult.node,
                edition,
                contactEmail: authEmail,
              });
              if (!alive) return;
              const [restoredMeta, restoredOrg, restoredSpecialist] = await Promise.all([
                invoke<InstallationMeta | null>("installation_get_meta"),
                invoke<OrgProfile | null>("db_get_org_profile"),
                invoke<SpecialistProfile | null>("db_get_specialist_profile"),
              ]);
              if (!alive) return;
              if (restoredMeta && restoredOrg) {
                const specProf: SpecialistProfile = restoredSpecialist || {
                  display_name: restoredCfg.job_title || "",
                  role_text: restoredCfg.job_title || "",
                  weekly_contract_minutes: 0,
                  rate_type: "fixed",
                  rate_value: 0,
                };
                setInstallation({
                  kind: "ready",
                  meta: restoredMeta,
                  orgProfile: restoredOrg,
                  specialistProfile: specProf,
                  terminalConfig: restoredCfg,
                });
                return;
              }
            }
          } catch {
            /* ignore cloud lookup errors, fallback to wizard */
          }
        }

        setInstallation({ kind: "missing" });

      })
      .catch((err) => {
        if (!alive) return;
        setInstallation({
          kind: "error",
          message: `Не удалось загрузить данные установки: ${String(err)}`,
        });
      });
    return () => {
      alive = false;
    };
  }, [installation.kind, isAuthorized]);

  const cfg = installation.kind === "ready" ? installation.terminalConfig : null;

  useEffect(() => {
    if (installation.kind !== "ready" || !cfg) return;
    void preloadEnabledModuleBundles(cfg);
  }, [installation.kind, cfg?.terminal_user_id]);

  useEffect(() => {
    if (installation.kind !== "ready" || !cfg) return;
    if (!modEnabled(cfg, "consumer_app_link")) return;
    let alive = true;
    trySharedCaseDeepLink(cfg)
      .then((requestId) => {
        if (!alive || !requestId) return;
        setDeepLinkMsg(`Импорт из Teenology: заявка ${requestId}`);
      })
      .catch((err) => {
        if (!alive) return;
        setDeepLinkMsg(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [installation.kind, cfg?.terminal_user_id, cfg?.child_invite_code]);

  useEffect(() => {
    if (installation.kind !== "ready") return;
    const { terminalConfig, meta } = installation;
    if (!terminalConfig.research_contribution_enabled) return;
    let alive = true;
    void maybeUploadResearchContribution({ cfg: terminalConfig, meta }).then((result) => {
      if (!alive || !result.uploaded || !result.terminalConfig) return;
      setInstallation((prev) =>
        prev.kind === "ready" ? { ...prev, terminalConfig: result.terminalConfig! } : prev,
      );
    });
    return () => {
      alive = false;
    };
  }, [
    installation.kind,
    installation.kind === "ready"
      ? installation.terminalConfig.research_contribution_enabled
      : false,
    installation.kind === "ready"
      ? installation.terminalConfig.research_contribution_last_period_key
      : null,
    installation.kind === "ready" ? installation.terminalConfig.terminal_user_id : null,
  ]);

  const isManager = installation.kind === "ready" && installation.terminalConfig.mode === "manager";
  const educatorLite =
    installation.kind === "ready" && isEducatorLite(installation.terminalConfig) && isEducatorEntry;
  const territorialManager =
    installation.kind === "ready" && isTerritorialManager(installation.terminalConfig);
  const workspaceReady = installation.kind === "ready" && !isManager && !educatorLite;
  const onboarding = installation.kind === "missing";
  const currentMode: "specialist" | "manager" | "educator_lite" | "onboarding" = isManager
    ? "manager"
    : educatorLite
      ? "educator_lite"
      : onboarding
        ? "onboarding"
        : "specialist";

  useEffect(() => {
    if (isAcademyOrWebinarHost) {
      document.title = "Академия IDA — Платформа онлайн-школ и вебинаров для психологов";
    } else {
      document.title = terminalAppTitle(currentMode);
    }
  }, [currentMode, isAcademyOrWebinarHost]);

  const demoMode = webStaging && isDemoModeActive();
  const pageSearchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEmbedWorkspace = pageSearchParams.get("embed") === "true";
  const landingInfo = getMainLandingInfo();
  const headerBranding = getTerminalHeaderBranding(currentMode);
  const isExplicitEmbed = pageSearchParams.get("embed_afisha") === "1";
  const isAfishaEmbed = isExplicitEmbed || pageSearchParams.get("mode") === "afisha";
  const sitePageParam = pageSearchParams.get("page") || pageSearchParams.get("site_page");
  const activeTabParam = pageSearchParams.get("tab");
  const modeParam = pageSearchParams.get("mode");
  const recIdParam = pageSearchParams.get("id");
  const ticketParam = pageSearchParams.get("ticket") || undefined;

  if (sitePageParam || modeParam === "page" || modeParam === "site") {
    const targetSlug = sitePageParam || pageSearchParams.get("slug") || "main";
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "#0b121f", border: "none", maxWidth: "none", overflowY: "auto" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#94a3b8", fontFamily: "sans-serif" }}>Загрузка страницы школы…</div>}>
          <PublicSitePageView
            slug={targetSlug}
            onOpenCreatorStudio={() => {
              const targetUrl = new URL(window.location.href);
              targetUrl.search = "";
              targetUrl.searchParams.set("entry", "creator");
              window.location.href = targetUrl.toString();
            }}
            onNavigateToPage={(newSlug) => {
              const targetUrl = new URL(window.location.href);
              targetUrl.search = "";
              targetUrl.searchParams.set("page", newSlug);
              window.location.href = targetUrl.toString();
            }}
          />
        </Suspense>
      </main>
    );
  }

  if (isAfishaEmbed) {
    const afishaModeRaw = pageSearchParams.get("afisha_mode");
    const afishaMode =
      afishaModeRaw === "school" || afishaModeRaw === "topic" || afishaModeRaw === "single" || afishaModeRaw === "all"
        ? afishaModeRaw
        : afishaModeRaw === "global"
          ? "all"
          : "school";
    const afishaTheme = pageSearchParams.get("theme") === "dark" ? "dark" : "light";
    return (
      <main style={{ position: "fixed", inset: 0, padding: isExplicitEmbed ? "16px" : 0, margin: 0, background: afishaTheme === "dark" ? "#090d16" : "#f8fafc", border: "none", maxWidth: "none", overflowY: "auto" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#64748b", fontFamily: "sans-serif" }}>Загрузка витрины курсов и вебинаров…</div>}>
          <AcademyAfishaView
            mode={afishaMode}
            schoolNameFilter={pageSearchParams.get("school") || undefined}
            topicFilter={pageSearchParams.get("topic") || undefined}
            singleItemId={pageSearchParams.get("item") || undefined}
            theme={afishaTheme}
            isEmbed={isExplicitEmbed}
            showStudentLogin={pageSearchParams.get("student_login") !== "0"}
            showPsychologistPromo={pageSearchParams.get("promo") !== "0"}
            paymentGatewayLabel={pageSearchParams.get("gateway") || undefined}
            partnerRef={pageSearchParams.get("ref") || undefined}
            onOpenStudentCourse={(courseId, code) => {
              const targetUrl = new URL(window.location.href);
              targetUrl.search = "";
              targetUrl.searchParams.set("course", courseId);
              targetUrl.searchParams.set("role", "student");
              if (code) targetUrl.searchParams.set("student", code);
              window.location.href = targetUrl.toString();
            }}
            onOpenPsychologistWorkspace={() => {
              window.open("https://ida-psy.pro/", "_blank", "noopener,noreferrer");
            }}
          />
        </Suspense>
      </main>
    );
  }

  if (modeParam === "recording" && recIdParam) {
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "#090d16", border: "none", maxWidth: "none", overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#94a3b8", fontFamily: "sans-serif" }}>Загрузка плеера записи…</div>}>
          <ProtectedRecordingPlayer
            recordingId={recIdParam}
            initialTicket={ticketParam}
            onOpenPsychologistWorkspace={() => {
              if (isAcademyHost) {
                const isIntl = typeof window !== "undefined" && window.location.hostname.endsWith(".pro");
                window.location.href = isIntl
                  ? "https://ida-psy.pro/terminal/staging/?demo=1"
                  : "https://ida-psy.ru/terminal/staging/?demo=1";
              } else {
                window.location.href = "/?tab=academy";
              }
            }}
          />
        </Suspense>
      </main>
    );
  }

  if (isEmbedWorkspace && activeTabParam === "academy") {
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "none", border: "none", maxWidth: "none", overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#64748b", fontFamily: "sans-serif" }}>Загрузка Академии…</div>}>
          <AIAcademyWorkspace aiSubscriptionActive={true} />
        </Suspense>
      </main>
    );
  }

  if (isEmbedWorkspace && activeTabParam === "articles") {
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "var(--bg-main, #f8fafc)", border: "none", maxWidth: "none", overflow: "auto" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#64748b", fontFamily: "sans-serif" }}>Загрузка статей…</div>}>
          {(() => {
            const ArticlesWorkspace = lazyWithRetry(() => import("./components/ArticlesWorkspace.tsx"));
            return <ArticlesWorkspace />;
          })()}
        </Suspense>
      </main>
    );
  }

  if (isEmbedWorkspace && activeTabParam === "practicum") {
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "none", border: "none", maxWidth: "none", overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#64748b", fontFamily: "sans-serif" }}>Загрузка симулятора…</div>}>
          {(() => {
            const PracticumSimulator = lazyWithRetry(() => import("./components/PracticumSimulator.tsx"));
            return <PracticumSimulator caseId="anxiety" onExit={() => {}} />
          })()}
        </Suspense>
      </main>
    );
  }

  const courseIdParam = pageSearchParams.get("course");
  const studentCodeParam = pageSearchParams.get("student") || undefined;
  const lessonIdParam = pageSearchParams.get("lesson") || undefined;
  const isStudentWorkspaceView =
    Boolean(courseIdParam) ||
    urlRole === "student" ||
    (isCourseMode && !isAuthorRole && !isSpeakerRole && pageSearchParams.get("entry") !== "creator");

  if (isStudentWorkspaceView) {
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "#f8fafc", border: "none", maxWidth: "none", overflowY: "auto" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#64748b", fontFamily: "sans-serif" }}>Загрузка учебного класса…</div>}>
          <StudentCourseWorkspace
            initialCourseId={courseIdParam || undefined}
            initialLessonId={lessonIdParam}
            studentCode={studentCodeParam}
            onOpenPsychologistWorkspace={() => {
              if (isAcademyHost) {
                const isIntl = typeof window !== "undefined" && window.location.hostname.endsWith(".pro");
                window.location.href = isIntl
                  ? "https://ida-psy.pro/terminal/staging/?demo=1"
                  : "https://ida-psy.ru/terminal/staging/?demo=1";
              } else {
                window.location.href = "/?tab=academy";
              }
            }}
            onBackToAcademy={() => {
              window.location.href = isAcademyHost ? "/" : "/terminal/staging/";
            }}
          />
        </Suspense>
      </main>
    );
  }

  if (isAcademyOrWebinarHost) {
    if (!isAuthorized && idaAuthMode) {
      return (
        <main
          className="terminal-shell"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
          }}
        >
          <IdaAuthGate onAuthorized={handleAuthorized} />
        </main>
      );
    }

    if (activeTabParam === "practicum") {
      return (
        <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "#0b1120", border: "none", maxWidth: "none", overflow: "hidden" }}>
          <Suspense fallback={<div style={{ padding: 24, color: "#64748b", fontFamily: "sans-serif" }}>Загрузка симулятора…</div>}>
            {(() => {
              const PracticumSimulator = lazyWithRetry(() => import("./components/PracticumSimulator.tsx"));
              return <PracticumSimulator caseId="anxiety" onExit={() => { window.location.href = "/"; }} />
            })()}
          </Suspense>
        </main>
      );
    }
    return (
      <main style={{ position: "fixed", inset: 0, padding: 0, margin: 0, background: "#f8fafc", border: "none", maxWidth: "none", overflow: "auto" }}>
        <Suspense fallback={<div style={{ padding: 24, color: "#475569", fontFamily: "sans-serif" }}>Загрузка Студии ведущего…</div>}>
          <CreatorStudioWorkspace
            onLaunchStudio={(roomName) => {
              const url = new URL(window.location.href);
              url.searchParams.set("room", roomName);
              url.searchParams.set("mode", "webinar");
              url.searchParams.set("role", "speaker");
              window.location.href = url.toString();
            }}
            onNavigateToSpecialist={() => {
              if (isAcademyHost) {
                const isIntl = typeof window !== "undefined" && window.location.hostname.endsWith(".pro");
                window.location.href = isIntl
                  ? "https://ida-psy.pro/terminal/staging/?demo=1"
                  : "https://ida-psy.ru/terminal/staging/?demo=1";
                return;
              }
              if (window.location.search) {
                const url = new URL(window.location.href);
                url.searchParams.delete("entry");
                url.searchParams.delete("mode");
                url.searchParams.delete("tab");
                url.searchParams.delete("room");
                url.searchParams.delete("role");
                window.location.href = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
              } else {
                window.location.href = "/";
              }
            }}
          />
        </Suspense>
      </main>
    );
  }

  const workspaceSubtitle = terminalWorkspaceSubtitle(currentMode);

  const currentWorkspace: WorkspaceId = (() => {
    if (isAcademyOrWebinarHost) return "creator";
    if (educatorLite || isEducatorEntry) return "educator";
    if (isCorporateHost || cfg?.org_type === "preventive_public") return "corporate";
    if (cfg?.org_type === "commercial") return "commercial";
    return "school";
  })();

  const handleSwitchWorkspace = async (target: WorkspaceId) => {
    if (target === currentWorkspace) return;

    if (target === "creator") {
      const url = new URL(window.location.href);
      url.searchParams.set("entry", "creator");
      url.searchParams.delete("room");
      url.searchParams.delete("role");
      window.location.href = url.toString();
      return;
    }

    if (target === "corporate") {
      const token = localStorage.getItem("platform_access_token") || "";
      const email = localStorage.getItem("platform_email") || "";
      const corpUrl = new URL("https://corporate-health.ida-psy.pro/");
      if (token) corpUrl.searchParams.set("token", token);
      if (email) corpUrl.searchParams.set("email", email);
      window.location.href = corpUrl.toString();
      return;
    }

    if (target === "educator") {
      try {
        const payload = await bootstrapEducatorLiteInstallation();
        setInstallation({ kind: "ready", ...payload });
        const url = new URL(window.location.href);
        url.searchParams.set("entry", "educator");
        url.searchParams.delete("mode");
        window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
      } catch (err) {
        console.error("Failed to switch to educator workspace", err);
      }
      return;
    }

    // target is "school" or "commercial"
    if (!cfg) return;
    const isTargetCommercial = target === "commercial";
    const nextOrgType: OrgTypePreset = isTargetCommercial ? "commercial" : "education";
    const nextJobTitle = isTargetCommercial
      ? (cfg.job_title && cfg.job_title !== "Педагог-психолог" && !cfg.job_title.includes("Педагог") ? cfg.job_title : "Психолог (частная практика)")
      : (cfg.job_title && !cfg.job_title.includes("частная") ? cfg.job_title : "Педагог-психолог");

    const nextModules = {
      ...cfg.enabled_modules,
      ...defaultEnabledModules("specialist", nextOrgType, "specialist"),
    };
    if (isTargetCommercial) {
      nextModules.ai_consultant_lite = false;
      nextModules.workload = true;
    } else {
      nextModules.ai_consultant_lite = false;
      nextModules.workload = false;
    }

    const nextConfig: TerminalConfig = {
      ...cfg,
      org_type: nextOrgType,
      workspace_preset: "specialist",
      mode: "specialist",
      job_title: nextJobTitle,
      enabled_modules: nextModules,
      updated_at: new Date().toISOString(),
    };

    try {
      await invoke("terminal_save_config", { input: nextConfig });
      if (installation.kind === "ready") {
        const platformName = localStorage.getItem("platform_name") || "";
        const nextSpecialistProfile = {
          ...installation.specialistProfile,
          role_text: nextJobTitle,
          display_name:
            installation.specialistProfile.display_name === "Педагог"
              ? (platformName || (isTargetCommercial ? "Психолог" : "Педагог-психолог"))
              : installation.specialistProfile.display_name,
        };
        await invoke("db_save_specialist_profile", { payload: nextSpecialistProfile }).catch(() => {});
        setInstallation({
          ...installation,
          terminalConfig: nextConfig,
          specialistProfile: nextSpecialistProfile,
        });
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("entry");
      url.searchParams.delete("mode");
      url.searchParams.delete("tab");
      window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
    } catch (err) {
      console.error("Failed to save switched terminal config", err);
    }
  };

  const getLivePortalUrl = () => {
    if (typeof window !== "undefined") {
      if (isIdaHost) return "https://ida-psy.pro/";
      if (isCorporateHost) return "https://corporate-health.ida-psy.pro/";
      return "https://web.prevention-ai.ru/";
    }
    return "https://web.prevention-ai.ru/";
  };

  const handleLogoutToLive = () => {
    localStorage.removeItem("platform_access_token");
    localStorage.removeItem("platform_user_id");
    localStorage.removeItem("platform_email");
    localStorage.removeItem("platform_name");
    localStorage.removeItem("prevention_terminal_staging_v1");
    localStorage.removeItem("prevention_terminal_demo_flag");
    localStorage.removeItem("prevention_terminal_demo_version");
    window.location.href = getLivePortalUrl();
  };

  return (
    <main
      className={`terminal-shell${workspaceReady || isManager ? " terminal-shell--workspace" : onboarding ? " terminal-shell--onboarding" : ""}`}
      style={isEmbedWorkspace ? { position: "fixed" as const, inset: 0, padding: 0, margin: 0, background: "none", border: "none", maxWidth: "none", overflow: "hidden" } : undefined}
    >
      {demoMode && !isEmbedWorkspace && (
        <div className="staging-banner staging-banner--demo" role="note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="staging-badge">{t("Демо-режим", "Demo Mode")}</span>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              {t("Демонстрационный стенд с синтетическими данными", "Interactive demo workspace")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label className="staging-ai-preview-toggle" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={stagingAiPreview}
                onChange={(e) => {
                  const next = e.target.checked;
                  writeStagingAiPreview(next);
                  setStagingAiPreview(next);
                }}
              />
              <span>{t("Превью подписки ИИ", "AI Subscription Preview")}</span>
            </label>
            <button
              type="button"
              onClick={handleLogoutToLive}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title={t("Выйти из демо и открыть рабочий кабинет", "Exit demo and open live portal")}
            >
              🚪 {t("В рабочий кабинет", "To Live Portal")} ↗
            </button>
          </div>
        </div>
      )}
      {!isEmbedWorkspace && (
        <header className="terminal-header">
          <div className="terminal-header-left">
            {isAuthorized && installation.kind === "ready" && !educatorLite && (
              <button
                type="button"
                className="terminal-header-mobile-toggle terminal-mobile-menu-btn"
                aria-label={t("Открыть меню разделов", "Open workspace menu")}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("terminal:open-mobile-sidebar"));
                }}
              >
                ☰
              </button>
            )}
            <div className="terminal-header-brand">
              <a
                href={headerBranding.landingUrl}
                title={headerBranding.landingTitle}
                className="terminal-brand-link"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    background: "linear-gradient(135deg, #0f766e, #14b8a6)",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "0.88rem",
                    boxShadow: "0 2px 4px rgba(15,118,110,0.25)",
                    flexShrink: 0,
                  }}
                >
                  {headerBranding.brandMark}
                </span>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: "2px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.08rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                    {headerBranding.brandPrefix}
                  </span>
                  {headerBranding.brandHighlight ? (
                    <span style={{ fontSize: "1.08rem", fontWeight: 800, color: "#0f766e" }}>
                      {headerBranding.brandHighlight}
                    </span>
                  ) : null}
                  {headerBranding.betaBadge ? (
                    <span
                      style={{
                        marginLeft: "4px",
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#0f766e",
                        background: "#ccfbf1",
                        border: "1px solid #99f6e4",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        verticalAlign: "middle",
                      }}
                    >
                      {headerBranding.betaBadge}
                    </span>
                  ) : null}
                  {headerBranding.roleLabel ? (
                    <span
                      style={{
                        marginLeft: "6px",
                        fontSize: "0.82rem",
                        fontWeight: 500,
                        color: "#64748b",
                      }}
                    >
                      • {headerBranding.roleLabel}
                    </span>
                  ) : null}
                </span>
              </a>
              {workspaceSubtitle ? (
                <p className="subtitle" style={{ margin: "2px 0 0 0" }}>
                  {workspaceSubtitle}
                </p>
              ) : null}
            </div>
            {isAuthorized && installation.kind === "ready" && !educatorLite && (
              <WorkspaceSwitcher
                currentWorkspace={currentWorkspace}
                onSwitchWorkspace={handleSwitchWorkspace}
                enabledWorkspaces={getEnabledApplications(installation.kind === "ready" ? installation.terminalConfig : undefined)}
              />
            )}
          </div>

          {/* Header Account Menu */}
          {isAuthorized && (
            <div className="terminal-header-right-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <UserAccountMenu
                userEmail={
                  localStorage.getItem("platform_email") ||
                  (installation.kind === "ready" ? installation.terminalConfig.contact_email : undefined)
                }
                userName={
                  installation.kind === "ready"
                    ? installation.specialistProfile?.display_name
                    : (localStorage.getItem("platform_name") || undefined)
                }
                jobTitle={
                  installation.kind === "ready"
                    ? installation.terminalConfig.job_title
                    : undefined
                }
                orgName={
                  installation.kind === "ready"
                    ? installation.orgProfile?.display_name
                    : undefined
                }
                orgType={
                  installation.kind === "ready"
                    ? installation.terminalConfig.org_type
                    : undefined
                }
                terminalUserId={
                  installation.kind === "ready"
                    ? installation.terminalConfig.terminal_user_id
                    : undefined
                }
                terminalConfig={
                  installation.kind === "ready"
                    ? installation.terminalConfig
                    : undefined
                }
                specialistName={
                  installation.kind === "ready"
                    ? installation.specialistProfile?.display_name
                    : undefined
                }
                educatorLite={educatorLite}
                onLogout={handleLogoutToLive}
                onSwitchAccount={() => {
                  if (window.confirm(t("Выйти из этого аккаунта и сменить специалиста?", "Log out of this account and switch specialist?"))) {
                    handleLogoutToLive();
                  }
                }}
              />
            </div>
          )}
        </header>
      )}

      {isAuthorized ? (
        installation.kind === "loading" || installation.kind === "idle" ? (
          <section className="card">
            <p className="muted">Проверяем данные установки…</p>
          </section>
        ) : installation.kind === "missing" ? (
          <Suspense fallback={<section className="card"><p className="muted">Загрузка мастера настройки…</p></section>}>
            <UnifiedOnboardingWizard onCompleted={(payload) => setInstallation({ kind: "ready", ...payload })} />
          </Suspense>
        ) : installation.kind === "error" ? (
          <section className="card">
            <h2>Не удалось открыть Терминал</h2>
            <p className="error">{installation.message}</p>
          </section>
        ) : (
          <Suspense fallback={<section className="card"><p className="muted">Загрузка рабочей среды…</p></section>}>
            {isManager && installation.kind === "ready" && cfg ? (
              <ManagerWorkspace
                meta={installation.meta}
                orgProfile={installation.orgProfile}
                specialistProfile={installation.specialistProfile}
                terminalConfig={installation.terminalConfig}
                territorial={territorialManager}
                onConfigSaved={(payload) => setInstallation({ kind: "ready", ...payload })}
              />
            ) : educatorLite && cfg ? (
              <EducatorLiteWorkspace onSwitchToPsychologist={() => handleSwitchWorkspace("school")} />
            ) : (
              installation.kind === "ready" && (
                <SpecialistWorkspace
                  meta={installation.meta}
                  orgProfile={installation.orgProfile}
                  specialistProfile={installation.specialistProfile}
                  terminalConfig={installation.terminalConfig}
                  deepLinkMsg={deepLinkMsg}
                  onConfigSaved={(payload) => setInstallation({ kind: "ready", ...payload })}
                />
              )
            )}
          </Suspense>
        )
      ) : schoolWebGateMode ? (
        <SchoolWebGate onAuthorized={handleAuthorized} />
      ) : webStaging ? (
        <section className="card">
          <p className="muted">Загрузка staging…</p>
        </section>
      ) : idaAuthMode ? (
        <IdaAuthGate onAuthorized={handleAuthorized} />
      ) : (
        <MasterPasswordGate onAuthorized={handleAuthorized} />
      )}
    </main>
  );
}
