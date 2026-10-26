/**
 * Universal Telemetry and Yandex.Metrika Goal Tracker for Prevention Terminal.
 */

declare global {
  interface Window {
    ymGoal?: (goalName: string, params?: Record<string, any>) => void;
    reachGoal?: (goalName: string, params?: Record<string, any>) => void;
    _ymCounterId?: number;
  }
}

export function trackGoal(goalName: string, params?: Record<string, any>): void {
  try {
    if (typeof window !== "undefined" && typeof window.ymGoal === "function") {
      window.ymGoal(goalName, params);
    }
  } catch (err) {
    console.debug("[Analytics] Failed to track goal:", goalName, err);
  }
}

/**
 * Tracking navigation across specialist cabinet tabs
 */
export function trackWorkspaceTab(tabId: string, orgType?: string): void {
  trackGoal(`tab_${tabId}`, { tab: tabId, org_type: orgType });
}

/**
 * Tracking 4-phase sprints in cases
 */
export function trackSprintPhase(phase: "intake" | "diagnostic" | "solution" | "plan", caseId?: string): void {
  trackGoal(`sprint_${phase}`, { case_id: caseId });
}

/**
 * Tracking actions on cases
 */
export function trackCaseAction(
  action: "create" | "focus" | "postpone" | "complete" | "archive" | "export_supervision" | "export_docx",
  caseId?: string
): void {
  trackGoal(`case_${action}`, { case_id: caseId });
}

/**
 * Tracking video sessions & in-session clinical tools
 */
export function trackVideoEvent(
  event: "room_join" | "room_leave" | "supervisor_sos" | "mindmap_toggle" | "soap_generate" | "recording_play" | "screen_share",
  details?: Record<string, any>
): void {
  trackGoal(`video_${event}`, details);
}

/**
 * Tracking commercial & corporate suite tools
 */
export function trackCommercialTool(
  tool: "defense_watcher" | "mindmap" | "webinar_studio" | "calendar" | "client_vault" | "pricing_click" | "subscription_modal",
  details?: Record<string, any>
): void {
  trackGoal(`tool_${tool}`, details);
}
