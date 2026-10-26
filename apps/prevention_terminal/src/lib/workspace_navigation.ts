/** Cross-panel navigation signals (ModuleBundle errors → settings feedback). */

export const OPEN_FEEDBACK_EVENT = "terminal:open-feedback";
export const OPEN_CONSULTATION_CASE_EVENT = "terminal:open-consultation-case";

export function requestOpenFeedbackSettings(): void {
  window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT));
}

export function onOpenFeedbackSettings(handler: () => void): () => void {
  window.addEventListener(OPEN_FEEDBACK_EVENT, handler);
  return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, handler);
}

export function requestOpenConsultationCase(caseId: string): void {
  const id = caseId.trim();
  if (!id) return;
  window.dispatchEvent(new CustomEvent(OPEN_CONSULTATION_CASE_EVENT, { detail: { caseId: id } }));
}

export function onOpenConsultationCase(handler: (caseId: string) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ caseId?: string }>).detail;
    const caseId = String(detail?.caseId || "").trim();
    if (caseId) handler(caseId);
  };
  window.addEventListener(OPEN_CONSULTATION_CASE_EVENT, listener);
  return () => window.removeEventListener(OPEN_CONSULTATION_CASE_EVENT, listener);
}

export const OPEN_ACADEMY_EVENT = "terminal:open-academy";

export function requestOpenAcademy(query?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_ACADEMY_EVENT, { detail: { query } }));
}

export function onOpenAcademy(handler: (query?: string) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ query?: string }>).detail;
    handler(detail?.query);
  };
  window.addEventListener(OPEN_ACADEMY_EVENT, listener);
  return () => window.removeEventListener(OPEN_ACADEMY_EVENT, listener);
}

export const OPEN_SETTINGS_EVENT = "terminal:open-settings";

export function requestOpenSettings(section?: "feedback" | "ai_subscription" | "profile" | null): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { section } }));
}

export function onOpenSettings(handler: (section?: "feedback" | "ai_subscription" | "profile" | null) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ section?: "feedback" | "ai_subscription" | "profile" | null }>).detail;
    handler(detail?.section);
  };
  window.addEventListener(OPEN_SETTINGS_EVENT, listener);
  return () => window.removeEventListener(OPEN_SETTINGS_EVENT, listener);
}
