import { useMemo, useState } from "react";

import { getRegistryWizardContent } from "../content/registry_wizard.ts";
import RegistrySecurityGuide from "./RegistrySecurityGuide.tsx";

const DISMISS_KEY = "prevention_registry_wizard_dismissed";

export function isRegistryWizardDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissRegistryWizard(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetRegistryWizardDismiss(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

interface RegistrySetupWizardProps {
  commercial?: boolean;
  busy: boolean;
  error: string | null;
  introOnly?: boolean;
  onCreate: () => void;
  onDismiss: () => void;
  onStartSetup?: () => void;
}

type WizardPhase = "intro" | "steps" | "create";

export default function RegistrySetupWizard(props: RegistrySetupWizardProps) {
  const { commercial = false, busy, error, introOnly = false, onCreate, onDismiss, onStartSetup } = props;
  const content = useMemo(() => getRegistryWizardContent(commercial), [commercial]);
  const [phase, setPhase] = useState<WizardPhase>(introOnly ? "intro" : "intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [stepChecks, setStepChecks] = useState<Record<string, boolean>>({});
  const [keyChoice, setKeyChoice] = useState("");
  const [createAck, setCreateAck] = useState(false);
  const [showFullGuide, setShowFullGuide] = useState(false);
  const [stepHint, setStepHint] = useState<string | null>(null);
  const [createHint, setCreateHint] = useState<string | null>(null);

  const steps = content.steps;
  const currentStep = phase === "steps" ? steps[stepIndex] : null;
  const totalSteps = steps.length + 1;

  function toggleStepCheck(id: string, checked: boolean) {
    setStepChecks((prev) => ({ ...prev, [id]: checked }));
    if (checked) setStepHint(null);
  }

  function validateCurrentStep(): string | null {
    if (!currentStep) return null;
    if (!stepChecks[currentStep.id]) return content.stepAckRequiredHint;
    if (currentStep.id === "save-key" && !keyChoice) return content.keyStorageRequiredHint;
    return null;
  }

  function handleNext() {
    const err = validateCurrentStep();
    if (err) {
      setStepHint(err);
      return;
    }
    setStepHint(null);
    goNext();
  }

  function handleCreateClick() {
    if (!createAck) {
      setCreateHint(content.createAckRequiredHint);
      return;
    }
    setCreateHint(null);
    onCreate();
  }

  function goNext() {
    if (phase === "steps" && stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      setStepHint(null);
      return;
    }
    if (phase === "steps") {
      setPhase("create");
      setStepHint(null);
    }
  }

  function goBack() {
    setStepHint(null);
    setCreateHint(null);
    if (phase === "create") {
      setPhase("steps");
      setStepIndex(steps.length - 1);
      return;
    }
    if (phase === "steps" && stepIndex > 0) {
      setStepIndex((i) => i - 1);
      return;
    }
    if (phase === "steps") {
      setPhase("intro");
    }
  }

  const stepNumber = phase === "create" ? totalSteps : phase === "steps" ? stepIndex + 1 : 0;
  const stepCheckInvalid = Boolean(stepHint && currentStep && !stepChecks[currentStep.id]);
  const keyChoiceInvalid = Boolean(stepHint && currentStep?.id === "save-key" && !keyChoice);

  return (
    <div className="registry-wizard">
      {phase !== "intro" && (
        <div className="registry-wizard-progress" aria-hidden>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={`registry-wizard-dot ${i + 1 <= stepNumber ? "done" : ""} ${i + 1 === stepNumber ? "current" : ""}`} />
          ))}
        </div>
      )}

      {phase === "intro" && (
        <div className="registry-wizard-panel">
          <h3>{content.introTitle}</h3>
          <p className="muted">{content.introLead}</p>
          <div className="registry-wizard-compare">
            <div className="registry-wizard-col">
              <h4>Без реестра</h4>
              <ul>
                {content.withoutRegistry.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="registry-wizard-col registry-wizard-col--accent">
              <h4>С реестром</h4>
              <ul>
                {content.withRegistry.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="registry-wizard-actions wizard-nav">
            <button
              type="button"
              className="wizard-btn wizard-btn--next"
              onClick={() => {
                onStartSetup?.();
                setPhase("steps");
              }}
            >
              {content.continueLabel}
            </button>
            {!introOnly && (
              <button type="button" className="wizard-btn wizard-btn--back" onClick={onDismiss}>
                {content.dismissLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "steps" && currentStep && (
        <div className="registry-wizard-panel">
          <h3>{currentStep.title}</h3>
          <p className="muted">{currentStep.lead}</p>
          <ul className="registry-wizard-bullets">
            {currentStep.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {currentStep.id === "save-key" && (
            <div
              className={`registry-wizard-key-options${keyChoiceInvalid ? " registry-wizard-key-options--error" : ""}`}
              role="radiogroup"
              aria-label="Способ хранения ключа"
            >
              {content.keyStorageOptions.map((opt) => (
                <label key={opt.id} className={`registry-wizard-key-option ${keyChoice === opt.id ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="key-storage"
                    value={opt.id}
                    checked={keyChoice === opt.id}
                    onChange={() => {
                      setKeyChoice(opt.id);
                      setStepHint(null);
                    }}
                  />
                  <span>
                    <strong>{opt.label}</strong>
                    <span className="muted tiny">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {currentStep.tip && <p className="registry-wizard-tip">{currentStep.tip}</p>}
          <label
            className={`field inline registry-wizard-check${stepCheckInvalid ? " registry-wizard-check--error" : ""}`}
          >
            <input
              type="checkbox"
              checked={Boolean(stepChecks[currentStep.id])}
              onChange={(e) => toggleStepCheck(currentStep.id, e.target.checked)}
            />
            <span>
              <strong>{currentStep.confirmLabel}</strong>
            </span>
          </label>
          {stepHint && <p className="error registry-wizard-step-hint">{stepHint}</p>}
          <div className="registry-wizard-actions wizard-nav">
            <button type="button" className="wizard-btn wizard-btn--back" onClick={goBack}>
              {content.backLabel}
            </button>
            <button type="button" className="wizard-btn wizard-btn--next" onClick={handleNext}>
              {content.nextLabel}
            </button>
          </div>
        </div>
      )}

      {phase === "create" && (
        <div className="registry-wizard-panel">
          <h3>{content.createTitle}</h3>
          <p className="muted">{content.createLead}</p>
          <label
            className={`field inline registry-wizard-check${createHint ? " registry-wizard-check--error" : ""}`}
          >
            <input
              type="checkbox"
              checked={createAck}
              onChange={(e) => {
                setCreateAck(e.target.checked);
                if (e.target.checked) setCreateHint(null);
              }}
            />
            <span>
              <strong>{content.createConfirmLabel}</strong>
            </span>
          </label>
          {createHint && <p className="error registry-wizard-step-hint">{createHint}</p>}
          <div className="registry-wizard-actions wizard-nav">
            <button type="button" className="wizard-btn wizard-btn--back" onClick={goBack}>
              {content.backLabel}
            </button>
            <button type="button" className="wizard-btn wizard-btn--finish" disabled={busy} onClick={handleCreateClick}>
              {busy ? "Создаём реестр…" : content.createButtonLabel}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      <div className="registry-wizard-footer">
        <button type="button" className="linkish" onClick={() => setShowFullGuide((v) => !v)}>
          {showFullGuide ? content.hideGuideLabel : content.fullGuideLabel}
        </button>
      </div>
      {showFullGuide && <RegistrySecurityGuide commercial={commercial} />}
    </div>
  );
}

interface RegistryActiveReminderProps {
  commercial?: boolean;
  onOpenGuide?: () => void;
}

export function RegistryActiveReminder(props: RegistryActiveReminderProps) {
  const { commercial = false } = props;
  const content = useMemo(() => getRegistryWizardContent(commercial), [commercial]);
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="registry-active-reminder">
      <p className="muted registry-active-lead">{content.activeReminderLead}</p>
      <button type="button" className="linkish registry-active-guide" onClick={() => setShowGuide((v) => !v)}>
        {showGuide ? content.hideGuideLabel : content.fullGuideLabel}
      </button>
      {showGuide && <RegistrySecurityGuide commercial={commercial} />}
    </div>
  );
}
