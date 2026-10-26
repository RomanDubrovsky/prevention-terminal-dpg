import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../lib/i18n.ts";

import { ensureSitePortal, updateSitePortal } from "../lib/site_portal.ts";
import { resolveOnboardingEntry } from "../lib/onboarding_entry.ts";
import {
  profileRolesForOrgSegment,
  isTerminalConfigComplete,
  type OrgTypePreset,
  type OnboardingProfileRole,
} from "../lib/terminal_config.ts";
import {
  buildVisibleSetupSections,
  setupSectionTitle,
  type SetupSection,
} from "../lib/terminal_setup_constants.ts";
import { useTerminalSetup } from "../lib/use_terminal_setup.ts";
import type { InstallationMeta } from "../lib/installation_meta.ts";
import {
  isOrgProfileComplete,
  educationOrgTypeToLegacy,
  type OrgProfile,
  type SpecialistProfile,
  type EducationOrgType,
} from "../lib/terminal_profiles.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { getEditionConfig, getTerminalEdition } from "../lib/terminal_edition.ts";
import { getTerminalProductConfig, isIdaProduct, isSchoolProduct } from "../lib/terminal_product.ts";
import { ONBOARDING_ORG_SEGMENT } from "../lib/terminal_config.ts";
import TerminalSetupFormSections from "./terminal_setup/TerminalSetupFormSections.tsx";
import { lookupTerminalByEmail, type TerminalNodeLookupResult } from "../lib/federation_client.ts";

function readUrlParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

type LookupPhase = "input" | "checking" | "found" | "not_found" | "skipped";

interface EmailLookupScreenProps {
  initialEmail: string;
  isInvite: boolean;
  edition: string;
  onProceed: (email: string, linkParams?: { centerId?: string; setupToken?: string }) => void;
  onRestored: (config: TerminalConfig) => void;
}

function EmailLookupScreen(props: EmailLookupScreenProps) {
  const { initialEmail, isInvite, edition, onProceed, onRestored } = props;
  const [email, setEmail] = useState(initialEmail);
  const [phase, setPhase] = useState<LookupPhase>(isInvite && initialEmail ? "not_found" : "input");
  const [foundNode, setFoundNode] = useState<TerminalNodeLookupResult["node"] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centerIdInput, setCenterIdInput] = useState("");
  const [setupTokenInput, setSetupTokenInput] = useState("");

  useEffect(() => {
    if (isInvite && initialEmail && phase === "not_found") {
      onProceed(initialEmail);
    }
  }, [isInvite, initialEmail, phase, onProceed]);

  const handleCheck = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError(t("Введите корректный email", "Enter a valid email"));
      return;
    }
    setError(null);
    setPhase("checking");
    try {
      const result = await lookupTerminalByEmail(trimmed);
      if (result.found && result.node) {
        setFoundNode(result.node);
        setPhase("found");
      } else {
        setError(null);
        setPhase("not_found");
      }
    } catch (e) {
      setError(t("Ошибка проверки аккаунта. Попробуйте еще раз.", "Account check error. Please try again."));
      setPhase("input");
    }
  }, [email, onProceed]);

  const handleRestore = useCallback(async () => {
    if (!foundNode) return;
    setRestoring(true);
    setError(null);
    try {
      const cfg = await invoke<TerminalConfig>("terminal_restore_config", {
        node: foundNode,
        edition,
        contactEmail: email.trim().toLowerCase(),
      });
      onRestored(cfg);
    } catch (e) {
      setError(t("Не удалось восстановить аккаунт", "Failed to restore account") + ": " + String(e));
    } finally {
      setRestoring(false);
    }
  }, [foundNode, edition, email, onRestored]);

  const roleLabel = (preset: string | null) => {
    const map: Record<string, string> = {
      manager: t("Руководитель / Директор", "Manager / Director"),
      specialist: t("Специалист (психолог)", "Specialist (Psychologist)"),
      educator_lite: t("Педагог", "Educator"),
    };
    return preset ? (map[preset] || preset) : "";
  };

  if (phase === "input" || phase === "checking") {
    return (
      <section className="card installation-wizard unified-wizard">
        <h2 style={{ marginBottom: "0.5rem" }}>
          {t("Войти в рабочее место", "Access Your Workspace")}
        </h2>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          {t(
            "Введите email, который использовался при настройке. Мы восстановим конфигурацию автоматически.",
            "Enter the email used during setup. We'll restore your configuration automatically.",
          )}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
            placeholder={t("почта@организация.ru", "email@org.ru")}
            disabled={phase === "checking"}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--line, #ccc)",
              fontSize: "1rem",
              background: "var(--surface, #fff)",
              color: "var(--text, #000)",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCheck(); }}
            autoFocus
          />
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <button
            type="button"
            className="wizard-btn wizard-btn--next"
            disabled={phase === "checking" || !email.trim()}
            onClick={() => void handleCheck()}
          >
            {phase === "checking" ? t("Проверяем…", "Checking…") : t("Проверить и войти", "Check and Sign In")}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "10px 0 2px" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--line, #e2e8f0)" }} />
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("или", "or")}
            </span>
            <div style={{ flex: 1, height: "1px", background: "var(--line, #e2e8f0)" }} />
          </div>

          <button
            type="button"
            className="wizard-btn wizard-btn--finish"
            style={{ padding: "12px 16px", fontSize: "0.95rem" }}
            onClick={() => onProceed("")}
          >
            {t("✨ Новое рабочее место (Быстрый старт за 30 сек)", "✨ New Workspace (Fast Track in 30 sec)")}
          </button>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>
            {t("Начните работу без ввода email. Почту можно привязать позже в Настройках.", "Start without email. Email can be linked later in Settings.")}
          </span>
        </div>
      </section>
    );
  }

  if (phase === "not_found") {
    return (
      <section className="card installation-wizard unified-wizard">
        <h2 style={{ marginBottom: "0.5rem" }}>
          {t("Организация не найдена", "Organization Not Found")}
        </h2>
        <p className="muted" style={{ marginBottom: "1.2rem" }}>
          {t("Мы не нашли зарегистрированной организации для email: ", "We couldn't find a registered organization for email: ")}
          <strong>{email}</strong>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
          <button
            type="button"
            className="wizard-btn wizard-btn--finish"
            onClick={() => onProceed(email.trim())}
          >
            {t("Создать новый аккаунт", "Create New Account")}
          </button>

          <div style={{ borderTop: "1px solid var(--line, #eee)", paddingTop: "16px", marginTop: "8px" }}>
            <p className="muted tiny" style={{ marginBottom: "10px", fontWeight: 600 }}>
              {t("Если у вас уже есть код организации, полученный от сотрудников, введите его:", "If you already have your organization code, enter it below:")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                type="text"
                placeholder={t("ID центра (например, 8A2C3F5E)", "Center ID (e.g. 8A2C3F5E)")}
                value={centerIdInput}
                onChange={(e) => setCenterIdInput((e.target as HTMLInputElement).value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--line, #ccc)",
                  background: "var(--surface, #fff)",
                  color: "var(--text, #000)",
                  fontSize: "0.9rem",
                }}
              />
              <input
                type="text"
                placeholder={t("Ключ подключения (Setup Token)", "Setup Token")}
                value={setupTokenInput}
                onChange={(e) => setSetupTokenInput((e.target as HTMLInputElement).value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--line, #ccc)",
                  background: "var(--surface, #fff)",
                  color: "var(--text, #000)",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="button"
                className="wizard-btn wizard-btn--next"
                disabled={!centerIdInput.trim() || !setupTokenInput.trim()}
                onClick={() => {
                  const rawId = centerIdInput.trim().toUpperCase();
                  const normalizedId = rawId.startsWith("CTR-") ? rawId : `CTR-${rawId}`;
                  onProceed(email.trim(), {
                    centerId: normalizedId,
                    setupToken: setupTokenInput.trim(),
                  });
                }}
              >
                {t("Подключить и войти", "Connect and Sign In")}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="wizard-btn wizard-btn--outline"
            style={{ marginTop: "8px" }}
            onClick={() => setPhase("input")}
          >
            {t("← Назад к вводу email", "← Back to email input")}
          </button>
        </div>
      </section>
    );
  }

  if (phase === "found" && foundNode) {
    const orgName = foundNode.organization_name || String((foundNode.org_snapshot as Record<string, unknown>)?.organization_name || "");
    const settlement = foundNode.settlement || "";
    return (
      <section className="card installation-wizard unified-wizard">
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
        <h2 style={{ marginBottom: "0.5rem" }}>{t("Аккаунт найден", "Account Found")}</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          {t("Найдена сохранённая конфигурация:", "Found saved configuration:")}
        </p>
        <div style={{ background: "var(--surface-raised, #f5f5f5)", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px 20px", marginBottom: "1.5rem", lineHeight: "1.8" }}>
          {orgName && <div><strong>{t("Организация:", "Organization:")}</strong> {orgName}</div>}
          {settlement && <div><strong>{t("Город:", "City:")}</strong> {settlement}</div>}
          <div><strong>{t("Роль:", "Role:")}</strong> {roleLabel(foundNode.workspace_preset || foundNode.mode)}</div>
          <div><strong>Email:</strong> {email}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
          <button type="button" className="wizard-btn wizard-btn--finish" disabled={restoring} onClick={() => void handleRestore()}>
            {restoring ? t("Восстанавливаем…", "Restoring…") : t("✓ Восстановить мои настройки", "✓ Restore my settings")}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </section>
    );
  }

  return null;
}

interface UnifiedOnboardingWizardProps {
  onCompleted: (payload: {
    meta: InstallationMeta;
    orgProfile: OrgProfile;
    specialistProfile: SpecialistProfile;
    terminalConfig: TerminalConfig;
  }) => void;
}

export default function UnifiedOnboardingWizard(props: UnifiedOnboardingWizardProps) {
  const { onCompleted } = props;
  const edition = getTerminalEdition();
  const editionConfig = getEditionConfig();
  const productConfig = getTerminalProductConfig();
  const locale = editionConfig.locale_default;
  const landingEntry = useMemo(() => resolveOnboardingEntry(), []);
  const setup = useTerminalSetup();
  const { loaded, applyOrgType } = setup;

  const storedEmail = typeof localStorage !== "undefined" ? (localStorage.getItem("platform_email") || "") : "";
  const storedCenterId = typeof localStorage !== "undefined" ? (localStorage.getItem("platform_center_id") || "") : "";
  const storedSetupToken = typeof localStorage !== "undefined" ? (localStorage.getItem("platform_setup_token") || "") : "";
  const storedParentIn = typeof localStorage !== "undefined" ? (localStorage.getItem("platform_parent_in") || "") : "";
  const urlEmail = useMemo(() => readUrlParam("email") || storedEmail, [storedEmail]);
  const urlParentIn = useMemo(() => readUrlParam("parent_in") || storedParentIn, [storedParentIn]);
  const urlRole = useMemo(() => readUrlParam("role"), []);
  const isInviteLink = Boolean(readUrlParam("email") || urlParentIn || storedCenterId);

  const [wizardPhase, setWizardPhase] = useState<"lookup" | "wizard">(() => {
    if (urlEmail && urlEmail.includes("@")) return "wizard";
    return "wizard"; // Direct 1-page setup by default for seamless onboarding
  });
  const [contactEmail, setContactEmail] = useState(urlEmail);
  const [incompleteRestoreReason, setIncompleteRestoreReason] = useState<string | null>(null);
  const [preenteredPortal, setPreenteredPortal] = useState<{ centerId?: string; setupToken?: string } | null>(() => {
    if (storedCenterId || storedSetupToken) {
      return { centerId: storedCenterId, setupToken: storedSetupToken };
    }
    return null;
  });
  const [showDetailedSetup, setShowDetailedSetup] = useState(() => Boolean(isInviteLink || urlRole));

  const [linkToCenter, setLinkToCenter] = useState(() => {
    return Boolean(
      storedCenterId ||
      storedSetupToken ||
      storedParentIn ||
      readUrlParam("center_id") ||
      readUrlParam("parent_in") ||
      readUrlParam("setup_token")
    );
  });
  const [centerIdInput, setCenterIdInput] = useState(() => {
    const cid = storedCenterId || readUrlParam("center_id") || "";
    return cid.startsWith("CTR-") ? cid.slice(4) : cid;
  });
  const [setupTokenInput, setSetupTokenInput] = useState(() => {
    return storedSetupToken || readUrlParam("setup_token") || "";
  });
  const [parentInInput, setParentInInput] = useState(() => {
    return urlParentIn || storedParentIn || "";
  });

  useEffect(() => {
    if (preenteredPortal?.centerId) {
      const cid = preenteredPortal.centerId;
      setCenterIdInput(cid.startsWith("CTR-") ? cid.slice(4) : cid);
      setLinkToCenter(true);
    }
    if (preenteredPortal?.setupToken) {
      setSetupTokenInput(preenteredPortal.setupToken);
      setLinkToCenter(true);
    }
  }, [preenteredPortal]);

  const isCommercialBranch = useMemo(() => {
    return Boolean(
      landingEntry.orgType === "commercial" ||
      productConfig.org_segment === "commercial" ||
      isIdaProduct() ||
      setup.orgType === "commercial"
    );
  }, [landingEntry.orgType, productConfig.org_segment, setup.orgType]);

  useEffect(() => {
    if (!loaded) return;
    const isCommercial = landingEntry.orgType === "commercial" || productConfig.org_segment === "commercial" || isIdaProduct();
    const isEdu = landingEntry.orgType === "education" || productConfig.org_segment === "education" || isSchoolProduct();
    const targetOrgType = isCommercial ? "commercial" : (isEdu ? "education" : (edition === "ru" ? "education" : "commercial"));

    if (!setup.orgType || (isCommercial && setup.orgType !== "commercial") || (isEdu && setup.orgType !== "education")) {
      applyOrgType(targetOrgType);
      setup.applyProfileRole("psychologist");
      if (targetOrgType === "commercial") {
        setFastTrackOrgType("private_office");
        if (!setup.displayName) setup.setDisplayName(t("Психолог", "Psychologist"));
        if (!setup.installationDraft.organization_label) {
          setup.setInstallationField("organization_label", t("Частная практика", "Private Practice"));
          setup.setOrgDraft((p) => ({ ...p, display_name: t("Частная практика", "Private Practice") }));
        }
      } else {
        setFastTrackOrgType("general_school");
        if (!setup.displayName) setup.setDisplayName(t("Педагог-психолог", "School Psychologist"));
        if (!setup.installationDraft.organization_label) {
          setup.setInstallationField("organization_label", t("ГБОУ Школа", "General School"));
          setup.setOrgDraft((p) => ({ ...p, display_name: t("ГБОУ Школа", "General School") }));
        }
      }
    }
  }, [edition, landingEntry.orgType, loaded, productConfig.org_segment, setup, applyOrgType]);

  const [fastTrackOrgType, setFastTrackOrgType] = useState<string>(() => {
    if (isCommercialBranch) return "private_office";
    return setup.orgDraft.education_org_type || "general_school";
  });

  useEffect(() => {
    if (isCommercialBranch) {
      if (!fastTrackOrgType || fastTrackOrgType === "general_school") {
        setFastTrackOrgType(setup.profileRole === "director" ? "commercial_center" : "private_office");
      }
    } else if (!fastTrackOrgType || fastTrackOrgType === "private_office") {
      setFastTrackOrgType("general_school");
    }
  }, [isCommercialBranch, setup.profileRole]);

  const isSoloPsychologist = useMemo(() => {
    return isCommercialBranch && fastTrackOrgType === "private_office" && setup.profileRole === "psychologist";
  }, [fastTrackOrgType, isCommercialBranch, setup.profileRole]);

  const dynamicOrgPlaceholder = useMemo(() => {
    if (setup.orgType === "commercial") {
      return fastTrackOrgType === "commercial_center"
        ? t("например, Центр «Гармония» или Психологическая студия", "e.g. Harmony Center or Studio")
        : t("например, Кабинет частного психолога", "e.g. Private Practice Office");
    }
    if (fastTrackOrgType === "ppms_center") {
      return t("например, ППМС-центр «Диалог» или ЦППМСП", "e.g. PPMS Center Dialogue");
    }
    if (fastTrackOrgType === "cve_college") {
      return t("например, Политехнический колледж №8", "e.g. Polytechnic College No. 8");
    }
    if (fastTrackOrgType === "higher_education") {
      return t("например, Педагогический университет", "e.g. Pedagogical University");
    }
    if (fastTrackOrgType === "correctional") {
      return t("например, Школа-интернат №5 (ОВЗ)", "e.g. Boarding School No. 5");
    }
    if (fastTrackOrgType === "supplementary") {
      return t("например, Дворец детского творчества «Родник»", "e.g. Children's Creative Center");
    }
    if (fastTrackOrgType === "camp_vacation") {
      return t("например, ДОЛ «Берёзка» или Лагерь «Орлёнок»", "e.g. Children Camp Berezka");
    }
    if (fastTrackOrgType.startsWith("youth_")) {
      return t("например, Молодёжный центр «Горизонт» или ПМК «Форпост»", "e.g. Youth Center Horizon");
    }
    return t("например, ГБОУ Школа №123 или Лицей «Перспектива»", "e.g. School No. 123 or Lyceum");
  }, [fastTrackOrgType, setup.orgType]);

  const handleFastTrackSubmit = useCallback(async () => {
    setup.setError(null);
    const effOrgType: OrgTypePreset =
      setup.orgType === "commercial" || setup.orgType === "education"
        ? setup.orgType
        : (productConfig.org_segment || "education");

    const effRole: OnboardingProfileRole = setup.profileRole || "psychologist";
    const defaultJob = effRole === "psychologist"
      ? (effOrgType === "commercial" ? t("Психолог", "Psychologist") : t("Педагог-психолог", "School Psychologist"))
      : (effOrgType === "commercial" ? t("Руководитель", "Director") : t("Директор школы", "School Principal"));

    const effName = setup.displayName.trim() || defaultJob;
    const defaultOrg =
      effOrgType === "commercial"
        ? t("Частная практика", "Private Practice")
        : t("Психологическая служба", "Psychological Service");
    const effOrgLabel = setup.installationDraft.organization_label.trim() || defaultOrg;

    const isYouth = fastTrackOrgType.startsWith("youth_");
    const isCommercial = effOrgType === "commercial";
    const effEduType = (isYouth || isCommercial) ? undefined : (fastTrackOrgType as EducationOrgType);
    const effOrgSphere = isYouth ? "youth_policy" : (isCommercial ? "other" : "education_system");

    const installTypeMap: Record<string, string> = {
      general_school: "school",
      ppms_center: "ppms_center",
      cve_college: "cve_college",
      higher_education: "higher_education",
      correctional: "correctional",
      supplementary: "supplementary",
      camp_vacation: "camp_vacation",
      pre_primary: "school",
      edu_other: "other",
      private_office: "private_practice",
      commercial_center: "psychological_center",
      online_practice: "private_practice",
      commercial_other: "other",
      youth_municipal_center: "youth_center",
      youth_regional_center: "youth_center",
      youth_club_space: "youth_center",
      youth_authority: "youth_center",
      youth_other: "youth_center",
    };

    let effCenterId: string | undefined = undefined;
    let effSetupToken: string | undefined = undefined;
    let effParentIn: string | undefined = undefined;

    if (linkToCenter) {
      const rawCid = centerIdInput.trim().toUpperCase();
      if (rawCid) {
        effCenterId = rawCid.startsWith("CTR-") ? rawCid : `CTR-${rawCid}`;
        setup.setCenterId(effCenterId);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("platform_center_id", effCenterId);
        }
      }
      const rawTok = setupTokenInput.trim();
      if (rawTok.toUpperCase().startsWith("PARENT-")) {
        effParentIn = rawTok.toUpperCase();
        setup.setParentIn(effParentIn);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("platform_parent_in", effParentIn);
        }
      } else if (rawTok) {
        effSetupToken = rawTok;
        setup.setSetupToken(effSetupToken);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("platform_setup_token", effSetupToken);
        }
      }
      const rawParent = parentInInput.trim().toUpperCase();
      if (rawParent) {
        effParentIn = rawParent;
        setup.setParentIn(effParentIn);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("platform_parent_in", effParentIn);
        }
      }
    }

    try {
      const payload = await setup.save({
        displayName: effName,
        organizationLabel: effOrgLabel,
        orgType: effOrgType,
        role: effRole,
        educationOrgType: effEduType,
        orgSphere: effOrgSphere,
        organizationType: installTypeMap[fastTrackOrgType] || (isCommercial ? "private_practice" : "school"),
        centerId: effCenterId,
        setupToken: effSetupToken,
        parentIn: effParentIn,
      });
      onCompleted(payload);
    } catch {
      // setup.error is set in hook
    }
  }, [
    centerIdInput,
    fastTrackOrgType,
    linkToCenter,
    onCompleted,
    parentInInput,
    productConfig.org_segment,
    setup,
    setupTokenInput,
  ]);

  useEffect(() => {
    if (!loaded) return;
    if (urlParentIn) setup.setParentIn(urlParentIn);
    
    // Apply pre-entered center ID and setup token if available
    if (preenteredPortal?.centerId) {
      const rawId = preenteredPortal.centerId.trim().toUpperCase();
      const normalizedId = rawId.startsWith("CTR-") ? rawId : `CTR-${rawId}`;
      setup.setCenterId(normalizedId);
    }
    if (preenteredPortal?.setupToken) {
      setup.setSetupToken(preenteredPortal.setupToken.trim());
    }

    if (urlRole) {
      const roleMap: Record<string, Parameters<typeof setup.applyProfileRole>[0]> = {
        director: "director", psychologist: "psychologist", specialist: "psychologist",
        admin: "director", superadmin: "director", territorial_admin: "territorial_admin",
      };
      setup.applyProfileRole(roleMap[urlRole] || "director");
    }

    // Auto-login bypass
    const isAutoLogin = readUrlParam("auto_login") === "1";
    if (isAutoLogin && urlRole === "specialist" && urlParentIn && urlEmail) {
      const b64DecodeUnicode = (str: string) => {
        try {
          return decodeURIComponent(Array.prototype.map.call(atob(str), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        } catch { return ""; }
      };
      
      const n64 = readUrlParam("n64");
      const o64 = readUrlParam("o64");
      const name = n64 ? b64DecodeUnicode(n64) : (readUrlParam("name") || urlEmail.split("@")[0]);
      const org = o64 ? b64DecodeUnicode(o64) : (readUrlParam("org") || "Организация");
      
      import("../lib/persist_terminal_setup.ts").then(({ persistTerminalSetup }) => {
        import("../lib/terminal_setup_constants.ts").then(({ DEFAULT_INSTALLATION }) => {
          import("../lib/terminal_profiles.ts").then(({ DEFAULT_ORG_PROFILE }) => {
            import("../lib/terminal_config.ts").then(({ defaultEnabledModules }) => {
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
                childCode: setup.childCode || "CHILD-AUTO",
                parentCode: setup.parentCode || "PARENT-AUTO",
                parentIn: urlParentIn,
                childIn: "",
                modules: defaultEnabledModules("specialist", "commercial", "specialist"),
                registryEnabled: false,
                isManagerPreset: false,
                centerId: preenteredPortal?.centerId || "",
                setupToken: preenteredPortal?.setupToken || "",
              }).then(payload => {
                onCompleted(payload);
              }).catch(err => {
                console.error("Auto-login failed:", err);
                setWizardPhase("wizard");
              });
            });
          });
        });
      });
      return;
    }
  }, [loaded, preenteredPortal?.centerId, preenteredPortal?.setupToken, urlRole, urlParentIn, urlEmail]);

  const handleLookupProceed = useCallback((email: string, linkParams?: { centerId?: string; setupToken?: string }) => {
    setContactEmail(email);
    if (linkParams) {
      setPreenteredPortal(linkParams);
    }
    setWizardPhase("wizard");
  }, []);

  const handleRestored = useCallback((cfg: TerminalConfig) => {
    invoke<OrgProfile | null>("db_get_org_profile")
      .then((orgProfile) => {
        if (!orgProfile) throw new Error("no_org_profile");
        if (!isOrgProfileComplete(orgProfile)) throw new Error("incomplete_org");
        if (!isTerminalConfigComplete(cfg)) throw new Error("incomplete_config");
        const specialistProfile: SpecialistProfile = {
          display_name: cfg.job_title || "",
          role_text: cfg.job_title || "",
          weekly_contract_minutes: 0,
          rate_type: "fixed",
          rate_value: 0,
        };
        const meta: InstallationMeta = {
          install_id: cfg.terminal_user_id,
          country: "RU",
          region: "",
          municipality: "",
          settlement: "",
          lat: null,
          lng: null,
          organization_type: cfg.org_type === "commercial" ? "commercial_center" : "school",
          organization_label: orgProfile.display_name || "",
          org_unit_id: null,
          org_unit_status: "pending",
          telemetry_consent: false,
          created_at: cfg.created_at,
          updated_at: cfg.updated_at,
        };
        onCompleted({ meta, orgProfile, specialistProfile, terminalConfig: cfg });
      })
      .catch((e: unknown) => {
        let msg = "Конфигурация не завершена.";
        const errStr = e instanceof Error ? e.message : String(e);
        if (errStr === "incomplete_org") msg = "Не указано название организации.";
        if (errStr === "incomplete_config") msg = "Не выбраны рабочие модули или роль.";
        setIncompleteRestoreReason(msg);
        setWizardPhase("wizard");
      });
  }, [onCompleted]);

  const visibleSteps = useMemo(
    () =>
      buildVisibleSetupSections(setup.workspacePreset, {
        skipOrgStep: landingEntry.skipOrgStep,
        territorialManager: setup.territorialManager,
        includeAdvancedOrganization: setup.orgType !== "commercial",
      }),
    [landingEntry.skipOrgStep, setup.territorialManager, setup.workspacePreset, setup.orgType],
  );

  const [step, setStep] = useState<SetupSection>(() =>
    landingEntry.skipOrgStep && landingEntry.orgType ? "profile" : "org",
  );

  useEffect(() => {
    if (!loaded) return;
    if (landingEntry.orgType && landingEntry.skipOrgStep) {
      applyOrgType(landingEntry.orgType);
    }
  }, [applyOrgType, landingEntry.orgType, landingEntry.skipOrgStep, loaded]);

  useEffect(() => {
    if (!visibleSteps.includes(step)) {
      setStep(visibleSteps[visibleSteps.length - 1] ?? visibleSteps[0] ?? "org");
    }
  }, [step, visibleSteps]);

  const stepIndex = visibleSteps.indexOf(step);
  const stepLabel = t(`Шаг ${stepIndex + 1} из ${visibleSteps.length}`, `Step ${stepIndex + 1} of ${visibleSteps.length}`);

  const orgSegmentLabel =
    setup.orgType === "education" || setup.orgType === "commercial"
      ? ONBOARDING_ORG_SEGMENT[setup.orgType].title
      : null;

  const goNext = useCallback(() => {
    setup.setError(null);
    if (step === "org") {
      if (setup.orgType !== "education" && setup.orgType !== "commercial") {
        setup.setError(t("Выберите тип организации.", "Select organization type."));
        return;
      }
    }
    if (step === "profile") {
      if (setup.orgType !== "education" && setup.orgType !== "commercial") {
        setup.setError(t("Сначала выберите тип организации.", "Select organization type first."));
        return;
      }
      if (!profileRolesForOrgSegment(setup.orgType).includes(setup.profileRole)) {
        setup.setError(t("Выберите вашу роль.", "Select your role."));
        return;
      }
    }
    if (step === "federation") {
      const err = setup.validateAll();
      if (err) {
        setup.setError(err);
        return;
      }
    }
    const idx = visibleSteps.indexOf(step);
    if (idx < 0) return;
    if (idx < visibleSteps.length - 1) setStep(visibleSteps[idx + 1]);
  }, [setup, step, visibleSteps]);

  const goBack = useCallback(() => {
    const idx = visibleSteps.indexOf(step);
    if (idx <= 0) return;
    setStep(visibleSteps[idx - 1]);
  }, [step, visibleSteps]);

  const handleFinish = useCallback(async () => {
    setup.setError(null);
    const err = setup.validateAll();
    if (err) {
      setup.setError(err);
      return;
    }
    if (visibleSteps.includes("site_widgets") && setup.workspacePreset === "manager") {
      const orgLabel =
        setup.installationDraft.organization_label.trim() ||
        setup.orgDraft.display_name.trim() ||
        t("Моя организация", "My Organization");
      try {
        const portal = await ensureSitePortal(orgLabel);
        if (setup.centerId || setup.setupToken) {
          await updateSitePortal({
            center_id: setup.centerId || portal.center_id,
            setup_token: setup.setupToken || portal.setup_token,
          });
        }
      } catch (e) {
        // ignore
      }
    }
    try {
      const payload = await setup.save();
      onCompleted(payload);
    } catch {
      /* setup.error */
    }
  }, [onCompleted, setup, visibleSteps, preenteredPortal]);

  const dynamicBadgeParts = useMemo(() => {
    const parts: string[] = [t(productConfig.title_ru, "IDA Terminal")];
    if (setup.orgType === "commercial") parts.push(t("Коммерческий центр", "Commercial Center"));
    else if (setup.orgType === "education") parts.push(t("Образовательная организация", "Educational Organization"));
    if (setup.workspacePreset === "manager") parts.push(t("Дашборд руководителя", "Manager Dashboard"));
    else if (setup.workspacePreset === "educator_lite") parts.push(t("Педагог (lite)", "Educator (lite)"));
    else if (setup.profileRole === "psychologist") parts.push(t("Психолог", "Psychologist"));
    else if ((setup.profileRole as string) === "social_pedagogue") parts.push(t("Соц. педагог", "Social Pedagogue"));
    else if (setup.workspacePreset === "specialist") parts.push(t("Рабочее место специалиста", "Specialist Workspace"));
    const orgLabelStr = String(setup.installationDraft?.organization_label || "").trim();
    const orgDisplayStr = String(setup.orgDraft?.display_name || "").trim();
    const orgName = orgLabelStr || orgDisplayStr;
    if (orgName) parts.push(`${t("Организация:", "Org:")} ${orgName}`);
    const cityStr = String(setup.installationDraft?.settlement || "").trim();
    const countryStr = String(setup.installationDraft?.country || "").trim();
    const loc = [cityStr, countryStr].filter(Boolean).join(", ");
    if (loc) parts.push(loc);
    parts.push(`${t("карты:", "maps:")} ${editionConfig.map_provider}`);
    return parts;
  }, [
    edition,
    editionConfig.map_provider,
    productConfig.title_ru,
    setup.installationDraft?.settlement,
    setup.installationDraft?.country,
    setup.installationDraft?.organization_label,
    setup.orgDraft?.display_name,
    setup.orgType,
    setup.profileRole,
    setup.workspacePreset,
  ]);

  if (wizardPhase === "lookup") {
    return (
      <EmailLookupScreen
        initialEmail={urlEmail}
        isInvite={isInviteLink}
        edition={edition}
        onProceed={handleLookupProceed}
        onRestored={handleRestored}
      />
    );
  }

  return (
    <section className="card installation-wizard unified-wizard">
      <p className="ob-edition-badge">
        {dynamicBadgeParts.join(" · ")}
      </p>
      <h2>{t("Первичная настройка", "Initial Setup")}</h2>
      {incompleteRestoreReason && (
        <div style={{ background: "var(--bg-warning)", color: "var(--text)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-warning)", marginBottom: "16px", fontSize: "0.9rem", lineHeight: "1.5" }}>
          <strong>Настройка не завершена:</strong> {incompleteRestoreReason} Пожалуйста, пройдите шаги до конца.
        </div>
      )}
      {landingEntry.skipOrgStep && orgSegmentLabel && landingEntry.presetSource === "url" && (
        <p className="ob-landing-segment muted">
          {t("С лендинга:", "From landing:")} <strong>{orgSegmentLabel}</strong>
        </p>
      )}
      <p className="muted" style={{ display: "none" }}>{stepLabel}</p>

      {/* 1-PAGE FAST TRACK WORKSPACE SETUP */}
      <div className="wizard-fast-track-card" style={{ maxWidth: "880px", margin: "0 auto", padding: "28px" }}>
        
        {/* Header with quick Email Sign-in toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div className="wizard-fast-badge" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              ⚡ {t("Быстрый старт: 1 минута до начала работы", "Fast Track: 1 min to launch")}
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: "800", color: "var(--text-color)" }}>
              {t("Настройка рабочего места", "Workspace Setup")}
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
              {isCommercialBranch
                ? t("Выберите ваш формат — все протоколы, защищенная видеокомната и карточки клиентов уже настроены.", "Choose your format — all protocols, secure video room and client records are pre-configured.")
                : t("Выберите вашу роль — все протоколы по стандартам образования, журнал консультаций и видеокабинет уже настроены.", "Choose your role — all educational standard protocols, consultation journal and video room are pre-configured.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardPhase("lookup")}
            style={{
              background: "var(--surface-soft, #f8fafc)",
              border: "1px solid var(--line, #e2e8f0)",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
              color: "var(--text-color)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            🔑 {t("Войти по email", "Sign in by email")}
          </button>
        </div>

        {/* 1. ВЫБОР ФОРМАТА / РОЛИ В ЗАВИСИМОСТИ ОТ ВЕТКИ (КОММЕРЧЕСКАЯ ИЛИ ШКОЛЬНАЯ) */}
        <div className="wizard-fast-field-group" style={{ marginBottom: "24px" }}>
          <label className="wizard-fast-label" style={{ display: "block", fontWeight: "700", marginBottom: "10px", fontSize: "0.95rem" }}>
            {isCommercialBranch
              ? t("1. Выберите формат вашей практики:", "1. Choose your practice format:")
              : t("1. Выберите вашу роль в образовательной организации:", "1. Choose your role in the educational organization:")}
          </label>

          {isCommercialBranch ? (
            /* КОММЕРЧЕСКАЯ ВЕТКА (IDA): 3 ТРЕКА */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {/* ТРЕК 1: Частный психолог (Solo) */}
              <button
                type="button"
                className={`wizard-fast-segment-btn ${setup.orgType === "commercial" && fastTrackOrgType === "private_office" && setup.profileRole === "psychologist" ? "active" : ""}`}
                style={{
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: "12px",
                  border: (setup.orgType === "commercial" && fastTrackOrgType === "private_office" && setup.profileRole === "psychologist") ? "2px solid var(--violet)" : "1px solid var(--line)",
                  background: (setup.orgType === "commercial" && fastTrackOrgType === "private_office" && setup.profileRole === "psychologist") ? "rgba(124, 58, 237, 0.04)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onClick={() => {
                  applyOrgType("commercial");
                  setup.applyProfileRole("psychologist");
                  setFastTrackOrgType("private_office");
                  setLinkToCenter(false);
                  if (!setup.displayName || setup.displayName === t("Руководитель", "Director") || setup.displayName === t("Директор школы", "School Principal") || setup.displayName === t("Педагог-психолог", "School Psychologist")) {
                    setup.setDisplayName(t("Психолог", "Psychologist"));
                  }
                  if (!setup.installationDraft.organization_label || setup.installationDraft.organization_label.includes("Школа") || setup.installationDraft.organization_label.includes("центр") || setup.installationDraft.organization_label.includes("Центр")) {
                    setup.setInstallationField("organization_label", t("Частная практика", "Private Practice"));
                    setup.setOrgDraft((p) => ({ ...p, display_name: t("Частная практика", "Private Practice") }));
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>🛋️</span>
                  <strong style={{ fontSize: "1rem", color: "var(--text-color)" }}>{t("Частный психолог (Solo)", "Private Practice (Solo)")}</strong>
                </div>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  {t("Частная практика, онлайн-сессии, клиенты, ИИ-супервизор и авто-отчеты", "Private practice, online sessions, clients, AI supervisor & auto-reports")}
                </span>
              </button>

              {/* ТРЕК 2: Психолог в центре (Team) */}
              <button
                type="button"
                className={`wizard-fast-segment-btn ${setup.orgType === "commercial" && fastTrackOrgType === "commercial_center" && setup.profileRole === "psychologist" ? "active" : ""}`}
                style={{
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: "12px",
                  border: (setup.orgType === "commercial" && fastTrackOrgType === "commercial_center" && setup.profileRole === "psychologist") ? "2px solid #0284c7" : "1px solid var(--line)",
                  background: (setup.orgType === "commercial" && fastTrackOrgType === "commercial_center" && setup.profileRole === "psychologist") ? "rgba(2, 132, 199, 0.04)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onClick={() => {
                  applyOrgType("commercial");
                  setup.applyProfileRole("psychologist");
                  setFastTrackOrgType("commercial_center");
                  setLinkToCenter(true);
                  if (!setup.displayName || setup.displayName === t("Руководитель", "Director") || setup.displayName === t("Директор школы", "School Principal") || setup.displayName === t("Педагог-психолог", "School Psychologist")) {
                    setup.setDisplayName(t("Психолог", "Psychologist"));
                  }
                  if (!setup.installationDraft.organization_label || setup.installationDraft.organization_label.includes("Школа") || setup.installationDraft.organization_label === t("Частная практика", "Private Practice")) {
                    setup.setInstallationField("organization_label", t("Психологический центр", "Psychological Center"));
                    setup.setOrgDraft((p) => ({ ...p, display_name: t("Психологический центр", "Psychological Center") }));
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>🏢</span>
                  <strong style={{ fontSize: "1rem", color: "var(--text-color)" }}>{t("Психолог в центре (Team)", "Specialist in Center (Team)")}</strong>
                </div>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  {t("Работа в коммерческой клинике или студии, совместное ведение кейсов", "Working in a commercial clinic or studio, collaborative caseloads")}
                </span>
              </button>

              {/* ТРЕК 3: Руководитель центра */}
              <button
                type="button"
                className={`wizard-fast-segment-btn ${setup.orgType === "commercial" && setup.profileRole === "director" ? "active" : ""}`}
                style={{
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: "12px",
                  border: (setup.orgType === "commercial" && setup.profileRole === "director") ? "2px solid #7c3aed" : "1px solid var(--line)",
                  background: (setup.orgType === "commercial" && setup.profileRole === "director") ? "rgba(124, 58, 237, 0.04)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onClick={() => {
                  applyOrgType("commercial");
                  setup.applyProfileRole("director");
                  setFastTrackOrgType("commercial_center");
                  setLinkToCenter(true);
                  if (!setup.displayName || setup.displayName === t("Психолог", "Psychologist") || setup.displayName === t("Педагог-психолог", "School Psychologist") || setup.displayName === t("Директор школы", "School Principal")) {
                    setup.setDisplayName(t("Руководитель", "Director"));
                  }
                  if (!setup.installationDraft.organization_label || setup.installationDraft.organization_label.includes("Школа") || setup.installationDraft.organization_label === t("Частная практика", "Private Practice")) {
                    setup.setInstallationField("organization_label", t("Психологический центр", "Psychological Center"));
                    setup.setOrgDraft((p) => ({ ...p, display_name: t("Психологический центр", "Psychological Center") }));
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>👔</span>
                  <strong style={{ fontSize: "1rem", color: "var(--text-color)" }}>{t("Руководитель центра", "Center Director / Manager")}</strong>
                </div>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  {t("Управление центром, дашборд аналитики, команда специалистов и общая статистика", "Center management, analytics dashboard, team caseloads & statistics")}
                </span>
              </button>
            </div>
          ) : (
            /* ШКОЛЬНАЯ ВЕТКА (PREVENTION SCHOOL / AI): 2 ТРЕКА */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              {/* ТРЕК 1: Школьный психолог (Edu) */}
              <button
                type="button"
                className={`wizard-fast-segment-btn ${setup.orgType === "education" && setup.profileRole === "psychologist" ? "active" : ""}`}
                style={{
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: "12px",
                  border: (setup.orgType === "education" && setup.profileRole === "psychologist") ? "2px solid #0d9488" : "1px solid var(--line)",
                  background: (setup.orgType === "education" && setup.profileRole === "psychologist") ? "rgba(13, 148, 136, 0.04)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onClick={() => {
                  applyOrgType("education");
                  setup.applyProfileRole("psychologist");
                  setFastTrackOrgType("general_school");
                  if (!setup.displayName || setup.displayName === t("Руководитель", "Director") || setup.displayName === t("Директор школы", "School Principal") || setup.displayName === t("Психолог", "Psychologist")) {
                    setup.setDisplayName(t("Педагог-психолог", "School Psychologist"));
                  }
                  if (!setup.installationDraft.organization_label || setup.installationDraft.organization_label.includes("центр") || setup.installationDraft.organization_label === t("Частная практика", "Private Practice") || setup.installationDraft.organization_label.includes("Центр")) {
                    setup.setInstallationField("organization_label", t("ГБОУ Школа", "General School"));
                    setup.setOrgDraft((p) => ({ ...p, display_name: t("ГБОУ Школа", "General School") }));
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>🏫</span>
                  <strong style={{ fontSize: "1rem", color: "var(--text-color)" }}>{t("Школьный психолог (Педагог-психолог)", "School Psychologist")}</strong>
                </div>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  {t("Школа, СПО, ППМС-центр, работа по стандартам ФГОС/ФОП, журнал консультаций и протоколы", "School, college, support center, educational standards, protocols & journal")}
                </span>
              </button>

              {/* ТРЕК 2: Директор школы / Руководитель */}
              <button
                type="button"
                className={`wizard-fast-segment-btn ${setup.orgType === "education" && setup.profileRole === "director" ? "active" : ""}`}
                style={{
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: "12px",
                  border: (setup.orgType === "education" && setup.profileRole === "director") ? "2px solid #0d9488" : "1px solid var(--line)",
                  background: (setup.orgType === "education" && setup.profileRole === "director") ? "rgba(13, 148, 136, 0.04)" : "var(--surface)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onClick={() => {
                  applyOrgType("education");
                  setup.applyProfileRole("director");
                  setFastTrackOrgType("general_school");
                  if (!setup.displayName || setup.displayName === t("Психолог", "Psychologist") || setup.displayName === t("Педагог-психолог", "School Psychologist") || setup.displayName === t("Руководитель", "Director")) {
                    setup.setDisplayName(t("Директор школы", "School Principal"));
                  }
                  if (!setup.installationDraft.organization_label || setup.installationDraft.organization_label.includes("центр") || setup.installationDraft.organization_label === t("Частная практика", "Private Practice") || setup.installationDraft.organization_label.includes("Центр")) {
                    setup.setInstallationField("organization_label", t("ГБОУ Школа", "General School"));
                    setup.setOrgDraft((p) => ({ ...p, display_name: t("ГБОУ Школа", "General School") }));
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem" }}>👔</span>
                  <strong style={{ fontSize: "1rem", color: "var(--text-color)" }}>{t("Директор школы / Руководитель", "School Principal / Director")}</strong>
                </div>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  {t("Администрация школы, мониторинг психологического климата, сводная отчетность", "School administration, psychological climate monitoring & rollup reports")}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 2 & 3. КЛЮЧЕВЫЕ ПОЛЯ ВВОДА */}
        <div className="wizard-fast-inputs-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          
          <div className="wizard-fast-input-block">
            <label htmlFor="fast-track-display-name" style={{ display: "block", fontWeight: "700", marginBottom: "6px", fontSize: "0.9rem" }}>
              {t("2. Как к вам обращаться (имя или псевдоним):", "2. Your name or how to address you:")} <span style={{ color: "#e11d48" }}>*</span>
            </label>
            <input
              id="fast-track-display-name"
              type="text"
              value={setup.displayName}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setup.setDisplayName(val);
                setup.setSpecialistDraft((p) => ({ ...p, display_name: val }));
              }}
              placeholder={isCommercialBranch ? t("например, Анна Смирнова или Психолог", "e.g. Anna Smirnova or Psychologist") : t("например, Анна Смирнова или Педагог-психолог", "e.g. Anna Smirnova or School Psychologist")}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line, #cbd5e1)", fontSize: "0.95rem" }}
            />
          </div>

          <div className="wizard-fast-input-block">
            <label htmlFor="fast-track-org-label" style={{ display: "block", fontWeight: "700", marginBottom: "6px", fontSize: "0.9rem" }}>
              {isCommercialBranch
                ? <>{t("3. Название практики или центра:", "3. Practice or center name:")} <span style={{ color: "#e11d48" }}>*</span></>
                : <>{t("3. Название образовательной организации:", "3. Educational organization name:")} <span style={{ color: "#e11d48" }}>*</span></>}
            </label>
            <input
              id="fast-track-org-label"
              type="text"
              value={setup.installationDraft.organization_label}
              onChange={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setup.setInstallationField("organization_label", val);
                setup.setOrgDraft((p) => ({ ...p, display_name: val }));
              }}
              placeholder={dynamicOrgPlaceholder}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--line, #cbd5e1)", fontSize: "0.95rem" }}
            />
          </div>
        </div>

        {/* ПРИВЯЗКА К СУЩЕСТВУЮЩЕМУ ЦЕНТРУ / ОРГАНИЗАЦИИ (скрыта для Solo, отображается для Team и Руководителя) */}
        {!isSoloPsychologist && (
          <div style={{ marginBottom: "22px" }}>
            {!linkToCenter ? (
              <button
                type="button"
                onClick={() => setLinkToCenter(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--surface, #fff)",
                  border: "1px dashed var(--line, #cbd5e1)",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  fontSize: "0.88rem",
                  color: isCommercialBranch ? "var(--violet, #7c3aed)" : "#0d9488",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out"
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = isCommercialBranch ? "var(--violet, #7c3aed)" : "#0d9488";
                  (e.currentTarget as HTMLElement).style.background = isCommercialBranch ? "rgba(124, 58, 237, 0.04)" : "rgba(13, 148, 136, 0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--line, #cbd5e1)";
                  (e.currentTarget as HTMLElement).style.background = "var(--surface, #fff)";
                }}
              >
                <span>🔗</span>
                <span>{setup.profileRole === "director"
                  ? t("Подключиться к филиалу / сети центров (ввести ID центра или код)", "Connect to branch / network (enter Center ID or code)")
                  : t("Подключиться к существующему центру / организации (ввести ID центра или код)", "Connect to existing center / organization (enter Center ID or code)")}
                </span>
              </button>
            ) : (
              <div style={{
                background: isCommercialBranch ? "rgba(124, 58, 237, 0.03)" : "rgba(13, 148, 136, 0.03)",
                border: isCommercialBranch ? "1px solid rgba(124, 58, 237, 0.25)" : "1px solid rgba(13, 148, 136, 0.25)",
                borderRadius: "12px",
                padding: "16px 18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.1rem" }}>🏢</span>
                    <strong style={{ fontSize: "0.92rem", color: "var(--text-color)" }}>
                      {setup.profileRole === "director"
                        ? t("Привязка к сети центров / филиалу (опционально)", "Link to branch / network (optional)")
                        : t("Привязка к существующему центру / клинике", "Link to existing center / clinic")}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkToCenter(false);
                      setCenterIdInput("");
                      setSetupTokenInput("");
                      setParentInInput("");
                      setup.setCenterId("");
                      setup.setSetupToken("");
                      setup.setParentIn("");
                      if (typeof localStorage !== "undefined") {
                        localStorage.removeItem("platform_center_id");
                        localStorage.removeItem("platform_setup_token");
                        localStorage.removeItem("platform_parent_in");
                      }
                    }}
                    className="linkish"
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    ✕ {setup.profileRole === "director"
                      ? t("Создать независимый центр без привязки", "Create independent center without link")
                      : t("Отменить привязку (создать независимый кабинет)", "Cancel link (create standalone workspace)")}
                  </button>
                </div>

                <p className="muted tiny" style={{ margin: "0 0 12px 0", lineHeight: "1.45" }}>
                  {setup.profileRole === "director"
                    ? t(
                      "Если ваш центр открывает дополнительный филиал или входит в сеть центров, укажите ID центра или код головной организации. Для создания нового независимого центра оставьте эти поля пустыми.",
                      "If your center is opening a branch or part of a network, enter the Center ID or code. To create a new independent center, leave these fields blank."
                    )
                    : t(
                      "Если у вас есть ID центра или код от руководителя/клиники, укажите их здесь. Все записи клиентов, протоколы и общая аналитика будут синхронизированы в общее пространство центра.",
                      "If you have a Center ID or code from your director/clinic, enter it here. Client leads, protocols, and analytics will be synced to the shared workspace."
                    )}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                  <div>
                    <label htmlFor="fast-track-center-id" style={{ display: "block", fontSize: "0.82rem", fontWeight: "600", marginBottom: "5px", color: "var(--text-color)" }}>
                      {t("ID центра (Center ID):", "Center ID:")}
                    </label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{
                        background: "var(--surface-raised, #e2e8f0)",
                        padding: "10px 12px",
                        border: "1px solid var(--line, #cbd5e1)",
                        borderRight: "none",
                        borderRadius: "8px 0 0 8px",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                        color: "var(--muted)"
                      }}>CTR-</span>
                      <input
                        id="fast-track-center-id"
                        type="text"
                        value={centerIdInput}
                        onChange={(e) => {
                          const raw = (e.target as HTMLInputElement).value.toUpperCase().replace(/\s+/g, "");
                          const clean = raw.startsWith("CTR-") ? raw.slice(4) : raw;
                          setCenterIdInput(clean);
                          const normalized = clean ? `CTR-${clean}` : "";
                          setup.setCenterId(normalized);
                        }}
                        placeholder="8A2C3F5E"
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          border: "1px solid var(--line, #cbd5e1)",
                          borderRadius: "0 8px 8px 0",
                          fontSize: "0.92rem",
                          fontFamily: "monospace",
                          textTransform: "uppercase"
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px", display: "block" }}>
                      {t("например: 8A2C3F5E (буквы и цифры)", "e.g. 8A2C3F5E (alphanumeric)")}
                    </span>
                  </div>

                  <div>
                    <label htmlFor="fast-track-setup-token" style={{ display: "block", fontSize: "0.82rem", fontWeight: "600", marginBottom: "5px", color: "var(--text-color)" }}>
                      {t("Ключ подключения (Setup Token) или Код (PARENT-…):", "Setup Token or PARENT-… code:")}
                    </label>
                    <input
                      id="fast-track-setup-token"
                      type="text"
                      value={setupTokenInput}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value.trim();
                        setSetupTokenInput(val);
                        if (val.toUpperCase().startsWith("PARENT-")) {
                          setup.setParentIn(val.toUpperCase());
                        } else {
                          setup.setSetupToken(val);
                        }
                      }}
                      placeholder={t("sec_auto_... или PARENT-XXXX", "sec_auto_... or PARENT-XXXX")}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--line, #cbd5e1)",
                        borderRadius: "8px",
                        fontSize: "0.92rem",
                        fontFamily: "monospace"
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px", display: "block" }}>
                      {t("Секретный ключ или код организации от руководства", "Secret key or parent organization code from leadership")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. ПАМЯТКА: ЧТО НАСТРОЕНО И ЧТО МОЖНО ИЗМЕНИТЬ ПОЗЖЕ */}
        <div style={{
          background: isCommercialBranch ? "rgba(124, 58, 237, 0.04)" : "rgba(13, 148, 136, 0.04)",
          border: isCommercialBranch ? "1px solid rgba(124, 58, 237, 0.2)" : "1px solid rgba(13, 148, 136, 0.2)",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "24px",
          fontSize: "0.88rem",
          lineHeight: "1.6"
        }}>
          <div style={{ fontWeight: "700", color: isCommercialBranch ? "var(--violet)" : "#0d9488", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>💡</span> {t("Памятка по началу работы:", "Quick Start Memo:")}
          </div>
          <div style={{ color: "var(--text-color)" }}>
            {isCommercialBranch ? (
              <>
                ✓ <strong>Уже активно:</strong> 12 рабочих модулей, защищенный видеокабинет WebRTC, карточки клиентов, шифрование и <strong>🎁 5 бесплатных AI-сессий в подарок</strong>.<br />
                ⚙️ <strong>Доступно в «Настройках»:</strong> Привязать email для синхронизации, настроить виджет онлайн-записи на сайт или подключить коллег можно в любой момент.
              </>
            ) : (
              <>
                ✓ <strong>Уже активно:</strong> 12 рабочих модулей по ФГОС, журнал консультаций, защищенный видеокабинет WebRTC, шифрование и <strong>🎁 5 бесплатных AI-протоколов в подарок</strong>.<br />
                ⚙️ <strong>Доступно в «Настройках»:</strong> Настроить шаблоны отчетов по нормативам, печать, логотип школы или подключить классных руководителей можно в любой момент.
              </>
            )}
          </div>
        </div>

        {/* 5. ГЛАВНАЯ CTA КНОПКА ЗАПУСКА В 1 КЛИК */}
        <div className="wizard-fast-actions" style={{ textAlign: "center" }}>
          <button
            type="button"
            className="wizard-btn wizard-btn--hero"
            style={{
              width: "100%",
              padding: "16px",
              fontSize: "1.15rem",
              fontWeight: "800",
              background: "var(--violet)",
              color: "#fff",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(124, 58, 237, 0.28)",
              transition: "transform 0.15s, box-shadow 0.15s"
            }}
            disabled={setup.busy}
            onClick={() => void handleFastTrackSubmit()}
          >
            {setup.busy ? t("Запуск рабочего места…", "Launching workspace…") : t("🚀 Перейти в рабочее поле (1 клик)", "🚀 Open Workspace (1 click)")}
          </button>
          
          {setup.error && !(showDetailedSetup || stepIndex > 0) && (
            <p className="error" style={{ margin: "10px 0 0", textAlign: "center", color: "#e11d48", fontWeight: "600" }}>{setup.error}</p>
          )}

          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "14px", fontSize: "0.82rem", color: "var(--muted)", flexWrap: "wrap" }}>
            <span>✓ {t("Без ввода паролей и привязки карт", "No passwords or cards required")}</span>
            <span>✓ {t("Локальное шифрование 152-ФЗ / HIPAA", "Local encryption 152-FZ / HIPAA")}</span>
            <span>✓ {t("Настройки можно изменить в любой момент", "Customizable anytime in Settings")}</span>
          </div>
        </div>

      </div>

      {/* Переключатель тонкой пошаговой настройки */}
      <div className="wizard-detailed-toggle-wrapper">
        <button
          type="button"
          className="wizard-detailed-toggle-btn"
          onClick={() => setShowDetailedSetup((prev) => !prev)}
        >
          {(showDetailedSetup || stepIndex > 0) ? (
            <>▲ {t("Скрыть подробную пошаговую настройку", "Hide detailed step-by-step setup")}</>
          ) : (
            <>⚙️ {t("Нужна тонкая пошаговая настройка? (P2P-сеть, выбор модулей, расчет тарифа) ▼", "Need detailed setup? (P2P network, modules, tariffs) ▼")}</>
          )}
        </button>
      </div>

      {(showDetailedSetup || stepIndex > 0) && (
        <div className="wizard-detailed-steps-container">
          <p className="muted">{stepLabel}</p>

          <div className="wizard-steps" aria-label={t("Шаги настройки", "Setup steps")}>
            {visibleSteps.map((s) => (
              <button key={s} type="button" className={step === s ? "active" : ""} onClick={() => setStep(s)}>
                {setupSectionTitle(s)}
              </button>
            ))}
          </div>

          <form
            className={`installation-form${step === "site_widgets" ? " installation-form--site" : ""}`}
            onSubmit={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement) return;
              if (step === visibleSteps[visibleSteps.length - 1]) return;
              event.preventDefault();
            }}
          >
            <TerminalSetupFormSections
              setup={setup}
              section={step}
              visibleSteps={visibleSteps}
              locale={locale}
              busy={setup.busy}
              onJumpToSection={setStep}
              lockedSteps={landingEntry.skipOrgStep ? ["org"] : []}
            />

            {setup.error && <p className="error">{setup.error}</p>}

            <div className="workspace-actions wizard-nav" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {stepIndex > 0 && (
                <button type="button" className="wizard-btn wizard-btn--back" disabled={setup.busy} onClick={goBack}>
                  {t("Назад", "Back")}
                </button>
              )}
              {step !== visibleSteps[visibleSteps.length - 1] ? (
                <button type="button" className="wizard-btn wizard-btn--next" disabled={setup.busy} onClick={goNext}>
                  {t("Далее", "Next")}
                </button>
              ) : (
                <button
                  type="button"
                  className="wizard-btn wizard-btn--finish"
                  disabled={setup.busy}
                  onClick={() => void handleFinish()}
                >
                  {setup.busy ? t("Сохранение…", "Saving…") : t("Открыть рабочее место", "Open Workplace")}
                </button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <button
                  type="button"
                  className="wizard-btn"
                  title={t("Очищает черновик анкеты", "Clears the form draft")}
                  onClick={() => {
                    if (window.confirm(t("Сбросить текущий выбор и начать настройку с 1 шага?", "Reset current choices and start setup from step 1?"))) {
                      localStorage.removeItem("prevention_terminal_staging_v1");
                      window.location.reload();
                    }
                  }}
                  style={{
                    background: "transparent",
                    color: "var(--muted)",
                    border: "1px solid var(--line)",
                    fontSize: "0.85rem",
                    padding: "8px 12px",
                  }}
                >
                  🔄 {t("Сбросить с начала", "Reset from start")}
                </button>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", maxWidth: "180px", textAlign: "right", lineHeight: "1.2" }}>
                  {t("Удаляет черновик этой формы и возвращает на 1 шаг", "Deletes this form draft and returns to step 1")}
                </span>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

