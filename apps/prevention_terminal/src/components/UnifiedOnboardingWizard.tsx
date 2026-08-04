import { useCallback, useEffect, useMemo, useState } from "react";

import { ensureSitePortal } from "../lib/site_portal.ts";
import { resolveOnboardingEntry } from "../lib/onboarding_entry.ts";
import {
  profileRolesForOrgSegment,
} from "../lib/terminal_config.ts";
import {
  buildVisibleSetupSections,
  setupSectionTitle,
  type SetupSection,
} from "../lib/terminal_setup_constants.ts";
import { useTerminalSetup } from "../lib/use_terminal_setup.ts";
import type { InstallationMeta } from "../lib/installation_meta.ts";
import type { OrgProfile, SpecialistProfile } from "../lib/terminal_profiles.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { editionLabel, getEditionConfig, getTerminalEdition } from "../lib/terminal_edition.ts";
import { getTerminalProductConfig } from "../lib/terminal_product.ts";
import { ONBOARDING_ORG_SEGMENT } from "../lib/terminal_config.ts";
import TerminalSetupFormSections from "./terminal_setup/TerminalSetupFormSections.tsx";

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
  const stepLabel = `Шаг ${stepIndex + 1} из ${visibleSteps.length}`;

  const orgSegmentLabel =
    setup.orgType === "education" || setup.orgType === "commercial"
      ? ONBOARDING_ORG_SEGMENT[setup.orgType].title
      : null;

  const goNext = useCallback(() => {
    setup.setError(null);
    if (step === "org") {
      if (setup.orgType !== "education" && setup.orgType !== "commercial") {
        setup.setError("Выберите тип организации.");
        return;
      }
    }
    if (step === "profile") {
      if (setup.orgType !== "education" && setup.orgType !== "commercial") {
        setup.setError("Сначала выберите тип организации.");
        return;
      }
      if (!profileRolesForOrgSegment(setup.orgType).includes(setup.profileRole)) {
        setup.setError("Выберите вашу роль.");
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
        "Моя организация";
      try {
        await ensureSitePortal(orgLabel);
      } catch (e) {
        // Игнорируем ошибки сети или инициализации портала, чтобы не блокировать оффлайн-работу
      }
    }
    try {
      const payload = await setup.save();
      onCompleted(payload);
    } catch {
      /* setup.error */
    }
  }, [onCompleted, setup, visibleSteps]);

  return (
    <section className="card installation-wizard unified-wizard">
      <p className="ob-edition-badge">
        {productConfig.title_ru} · {editionLabel(edition)} · карты: {editionConfig.map_provider}
      </p>
      <h2>Первичная настройка</h2>
      {landingEntry.skipOrgStep && orgSegmentLabel && landingEntry.presetSource === "url" && (
        <p className="ob-landing-segment muted">
          С лендинга: <strong>{orgSegmentLabel}</strong>
        </p>
      )}
      <p className="muted">{stepLabel}</p>

      <div className="wizard-steps" aria-label="Шаги настройки">
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

        <div className="workspace-actions wizard-nav">
          {stepIndex > 0 && (
            <button type="button" className="wizard-btn wizard-btn--back" disabled={setup.busy} onClick={goBack}>
              Назад
            </button>
          )}
          {step !== visibleSteps[visibleSteps.length - 1] ? (
            <button type="button" className="wizard-btn wizard-btn--next" disabled={setup.busy} onClick={goNext}>
              Далее
            </button>
          ) : (
            <button
              type="button"
              className="wizard-btn wizard-btn--finish"
              disabled={setup.busy}
              onClick={() => void handleFinish()}
            >
              {setup.busy ? "Сохраняем…" : "Открыть рабочее место"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
