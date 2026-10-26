import { fetchSharedCaseHandoff, type SharedCaseHandoff } from "./consumer_bridge_client.ts";
import {
  getCaseArtifacts,
  saveCaseArtifacts,
  type CaseArtifactsPayload,
  type CaseExternalLink,
  type ExternalLinkScope,
} from "./case_store.ts";
import type { TerminalConfig } from "./terminal_config.ts";

export function handoffToSnapshot(handoff: SharedCaseHandoff): Record<string, string> {
  return {
    topic_text: handoff.topic_text || "",
    notes_local: handoff.notes_local || "",
    locale: handoff.locale || "ru",
    request_source: handoff.request_source || "",
    urgency: handoff.urgency || "normal",
    imported_at: new Date().toISOString(),
  };
}

export async function importSharedCaseLinkToCase(args: {
  caseId: string;
  token: string;
  cfg: TerminalConfig;
  scope?: ExternalLinkScope;
  participantAliasId?: string;
  app?: "teenology" | "ida";
}): Promise<CaseArtifactsPayload> {
  const bridgeCode = args.cfg.child_invite_code?.trim();
  if (!bridgeCode) {
    throw new Error("bridge_code_missing");
  }
  const handoff = await fetchSharedCaseHandoff({
    terminalUserId: args.cfg.terminal_user_id,
    bridgeCode,
    sharedCaseToken: args.token.trim(),
  });
  const existing = await getCaseArtifacts(args.caseId);
  const app = args.app || (args.cfg.consumer_app === "ida" ? "ida" : "teenology");
  const snapshot = handoffToSnapshot(handoff);
  if (handoff.terminal_invite_token) {
    snapshot.terminal_invite_token = handoff.terminal_invite_token;
  }
  if (handoff.purpose) {
    snapshot.purpose = handoff.purpose;
  }
  const link: CaseExternalLink = {
    id: `link-${Date.now()}`,
    app,
    scope: args.scope || "case",
    token_ref: args.token.trim(),
    participant_alias_id: args.participantAliasId,
    active_from: new Date().toISOString(),
    snapshot,
  };
  const notesAppend = [
    existing.situation_notes_append || "",
    `--- ${app.toUpperCase()} shared_case ${handoff.shared_case_token} ---`,
    handoff.topic_text,
    handoff.notes_local,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);

  const merged: CaseArtifactsPayload = {
    ...existing,
    external_links: [...(existing.external_links || []), link],
    situation_notes_append: notesAppend,
  };
  await saveCaseArtifacts(args.caseId, merged);
  return merged;
}
