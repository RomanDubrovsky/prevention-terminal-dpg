import { invoke } from "@tauri-apps/api/core";

import { platformApiBase } from "./platform_api.ts";

function apiBase(): string {
  return platformApiBase();
}

export interface SharedCaseHandoff {
  handoff_version: string;
  shared_case_token: string;
  locale: string;
  topic_text: string;
  notes_local: string;
  request_source: string;
  urgency: string;
  subject_shadow_id: string;
  purpose?: string;
  terminal_invite_token?: string;
}

export async function fetchSharedCaseHandoff(args: {
  terminalUserId: string;
  bridgeCode: string;
  sharedCaseToken: string;
}): Promise<SharedCaseHandoff> {
  const res = await fetch(`${apiBase()}/api/terminal/consumer/shared-case`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      terminal_user_id: args.terminalUserId,
      bridge_code: args.bridgeCode,
      shared_case_token: args.sharedCaseToken,
    }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; handoff?: SharedCaseHandoff };
  if (!data.ok || !data.handoff) throw new Error(data.error || "handoff_failed");
  return data.handoff;
}

export async function importSharedCaseToRequest(handoff: SharedCaseHandoff): Promise<string> {
  return invoke<string>("db_create_request", {
    payload: {
      source: handoff.request_source || "parent",
      topic_text: handoff.topic_text,
      subject_shadow_id: handoff.subject_shadow_id || "Teenology",
      urgency: handoff.urgency || "normal",
      notes_local: `[shared_case ${handoff.shared_case_token}]\n${handoff.notes_local || ""}`,
    },
  });
}
