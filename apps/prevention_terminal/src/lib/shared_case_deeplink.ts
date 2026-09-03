import {
  fetchSharedCaseHandoff,
  importSharedCaseToRequest,
} from "./consumer_bridge_client.ts";
import type { TerminalConfig } from "./terminal_config.ts";

const PARAMS = ["shared_case_token", "shared_case", "case_token", "token", "specialist_request"] as const;

export function readSharedCaseTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  for (const key of PARAMS) {
    const v = params.get(key)?.trim();
    if (v && v.length >= 8) return v;
  }
  return null;
}

export function clearSharedCaseTokenFromUrl(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
}

/** Auto-import Teenology shared_case when opened via deep link. */
export async function trySharedCaseDeepLink(cfg: TerminalConfig): Promise<string | null> {
  const token = readSharedCaseTokenFromUrl();
  if (!token) return null;
  if (!cfg.child_invite_code?.trim()) return null;

  const handoff = await fetchSharedCaseHandoff({
    terminalUserId: cfg.terminal_user_id,
    bridgeCode: cfg.child_invite_code,
    sharedCaseToken: token,
  });
  const requestId = await importSharedCaseToRequest(handoff);
  clearSharedCaseTokenFromUrl();
  return requestId;
}
