import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../lib/i18n.ts";

import { ensureSitePortal } from "../lib/site_portal.ts";
import { resolveOnboardingEntry } from "../lib/onboarding_entry.ts";
import {
  profileRolesForOrgSegment,
  isTerminalConfigComplete,
} from "../lib/terminal_config.ts";
import {
  buildVisibleSetupSections,
  setupSectionTitle,
  type SetupSection,
} from "../lib/terminal_setup_constants.ts";
import { useTerminalSetup } from "../lib/use_terminal_setup.ts";
import type { InstallationMeta } from "../lib/installation_meta.ts";
import { isOrgProfileComplete, type OrgProfile, type SpecialistProfile } from "../lib/terminal_profiles.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { getEditionConfig, getTerminalEdition } from "../lib/terminal_edition.ts";
import { getTerminalProductConfig } from "../lib/terminal_product.ts";
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
  onProceed: (email: string) => void;
  onRestored: (config: TerminalConfig) => void;
}

function EmailLookupScreen(props: EmailLookupScreenProps) {
  const { initialEmail, isInvite, edition, onProceed, onRestored } = props;
  const [email, setEmail] = useState(initialEmail);
  const [phase, setPhase] = useState<LookupPhase>(isInvite && initialEmail ? "not_found" : "input");
  const [foundNode, setFoundNode] = useState<TerminalNodeLookupResult["node"] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(t("Организация с таким email не найдена. Если вы регистрируетесь впервые, нажмите «Первичная настройка».", "Organization with this email not found. If you are registering for the first time, click «Initial setup»."));
        setPhase("input");
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
            {phase === "checking" ? t("Проверяем…", "Checking…") : t("Продолжить", "Continue")}
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", marginTop: "10px" }}>
            <button
              type="button"
              title={t("Создать новую организацию с нуля", "Create a new organization from scratch")}
              style={{ background: "transparent", color: "var(--muted)", border: "none", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
              onClick={() => onProceed("")}
            >
              {t("Первичная настройка (для новой организации)", "Initial setup (for new organization)")}
            </button>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", maxWidth: "260px", lineHeight: "1.2" }}>
              {t("Нажмите, если хотите зарегистрировать новое учреждение, а не восстанавливать доступ к старому.", "Click here if you want to register a new institution rather than restoring access to an old one.")}
            </span>
          </div>
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
          <button
            type="button"
            style={{ background: "transparent", color: "var(--muted)", border: "none", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
            onClick={() => onProceed(email.trim())}
          >
            {t("Игнорировать и создать новую организацию", "Ignore and create new organization")}
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
  const urlEmail = useMemo(() => readUrlParam("email") || storedEmail, [storedEmail]);
  const urlParentIn = useMemo(() => readUrlParam("parent_in"), []);
  const urlRole = useMemo(() => readUrlParam("role"), []);
  const isInviteLink = Boolean(readUrlParam("email") || urlParentIn);

  const [wizardPhase, setWizardPhase] = useState<"lookup" | "wizard">("lookup");
  const [contactEmail, setContactEmail] = useState(urlEmail);
  const [incompleteRestoreReason, setIncompleteRestoreReason] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (urlParentIn) setup.setParentIn(urlParentIn);
    if (urlRole) {
      const roleMap: Record<string, Parameters<typeof setup.applyProfileRole>[0]> = {
        director: "director", psychologist: "psychologist", specialist: "psychologist",
        admin: "director", superadmin: "director", territorial_admin: "territorial_admin",
      };
      setup.applyProfileRole(roleMap[urlRole] || "director");
    }
  }, [loaded]);

  const handleLookupProceed = useCallback((email: string) => {
    setContactEmail(email);
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
        await ensureSitePortal(orgLabel);
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
  }, [onCompleted, setup, visibleSteps]);

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
      {contactEmail && (
        <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          📧 {contactEmail}
        </p>
      )}
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
    </section>
  );
}

