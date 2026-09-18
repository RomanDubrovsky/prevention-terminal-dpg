import { setupSectionTitle, type SetupSection } from "../../lib/terminal_setup_constants.ts";
import type { TerminalSetupState } from "../../lib/use_terminal_setup.ts";
import { setupStepSelectionLabel } from "./setup_selection_labels.ts";
import { t } from "../../lib/i18n.ts";

interface SetupBreadcrumbsProps {
  visibleSteps: SetupSection[];
  currentSection: SetupSection;
  setup: TerminalSetupState;
  locale: string;
  onJumpToSection?: (section: SetupSection) => void;
  /** Steps shown as read-only chips (no navigation). */
  lockedSteps?: SetupSection[];
}

export default function SetupBreadcrumbs(props: SetupBreadcrumbsProps) {
  const { visibleSteps, currentSection, setup, locale, onJumpToSection, lockedSteps = [] } = props;
  const currentIdx = visibleSteps.indexOf(currentSection);
  if (currentIdx <= 0) return null;

  const priorSteps = visibleSteps.slice(0, currentIdx);
  const crumbs = priorSteps
    .map((step) => ({
      step,
      title: setupSectionTitle(step),
      value: setupStepSelectionLabel(step, setup, locale),
    }))
    .filter((c): c is { step: SetupSection; title: string; value: string } => Boolean(c.value));

  if (crumbs.length === 0) return null;

  return (
    <nav className="ob-setup-breadcrumbs" aria-label={t("Выбранные параметры", "Selected parameters")}>
      {crumbs.map(({ step, title, value }) => {
        const canJump = Boolean(onJumpToSection) && !lockedSteps.includes(step);
        const body = (
          <>
            <span className="ob-crumb-step">{title}</span>
            <span className="ob-crumb-value">
              {t("Выбрано:", "Selected:")} <strong>{value}</strong>
            </span>
          </>
        );
        if (canJump) {
          return (
            <button
              key={step}
              type="button"
              className="ob-crumb"
              onClick={() => onJumpToSection?.(step)}
              title={`${t("Изменить:", "Change:")} ${title}`}
            >
              {body}
            </button>
          );
        }
        return (
          <span key={step} className="ob-crumb ob-crumb--static" aria-label={`${title}: ${value}`}>
            {body}
          </span>
        );
      })}
    </nav>
  );
}

