import { platformApiBase } from "./platform_api.ts";
import { createTerminalClientInvite } from "./case_client_invite.ts";
import {
  getCaseArtifacts,
  saveCaseArtifacts,
  type CaseArtifactsPayload,
  type CaseExternalLink,
} from "./case_store.ts";
import type { TerminalConfig } from "./terminal_config.ts";

export interface ClientHandoutDelivery {
  token: string;
  share_link: string;
  invite_link?: string;
  expires_at?: string;
  consumer_app: string;
  purpose: string;
}

export async function publishClientHandoutToConsumer(args: {
  cfg: TerminalConfig;
  caseId: string;
  caseLabel: string;
  handoutText: string;
  createInviteIfMissing?: boolean;
}): Promise<ClientHandoutDelivery> {
  const bridgeCode = args.cfg.child_invite_code?.trim();
  if (!bridgeCode) throw new Error("bridge_code_missing");
  const text = args.handoutText.trim();
  if (text.length < 40) throw new Error("handout_text_too_short");

  const consumerApp = args.cfg.consumer_app === "ida" ? "ida" : "teenology";
  const artifacts = await getCaseArtifacts(args.caseId);
  const existingInvite = (artifacts.external_links || []).find(
    (row) => row.app === consumerApp && row.scope === "case" && row.snapshot?.invite_link,
  );
  let inviteLink = existingInvite?.snapshot?.invite_link || "";
  let terminalInviteToken = existingInvite?.token_ref || "";

  if (!inviteLink && args.createInviteIfMissing !== false) {
    const invite = await createTerminalClientInvite({
      cfg: args.cfg,
      caseId: args.caseId,
      caseLabel: args.caseLabel,
      scope: "case",
    });
    inviteLink = invite.invite_link;
    terminalInviteToken = invite.token;
    const link: CaseExternalLink = {
      id: `invite-${Date.now()}`,
      app: consumerApp,
      scope: "case",
      token_ref: invite.token,
      active_from: new Date().toISOString(),
      snapshot: {
        invite_link: invite.invite_link,
        case_label: args.caseLabel,
      },
    };
    await saveCaseArtifacts(args.caseId, {
      external_links: [...(artifacts.external_links || []), link],
    });
  }

  const res = await fetch(`${platformApiBase()}/api/terminal/consumer/handout/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      terminal_user_id: args.cfg.terminal_user_id,
      bridge_code: bridgeCode,
      case_ref: args.caseId,
      case_label: args.caseLabel,
      handout_text: text,
      consumer_app: consumerApp,
      terminal_invite_token: terminalInviteToken,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    delivery?: ClientHandoutDelivery;
  };
  if (!data.ok || !data.delivery) throw new Error(data.error || "handout_publish_failed");

  await recordHandoutDelivery(args.caseId, data.delivery, inviteLink);
  return { ...data.delivery, invite_link: inviteLink || undefined };
}

async function recordHandoutDelivery(
  caseId: string,
  delivery: ClientHandoutDelivery,
  inviteLink: string,
): Promise<CaseArtifactsPayload> {
  const existing = await getCaseArtifacts(caseId);
  const app = delivery.consumer_app === "ida" ? "ida" : "teenology";
  const link: CaseExternalLink = {
    id: `handout-${Date.now()}`,
    app,
    scope: "case",
    token_ref: delivery.token,
    active_from: new Date().toISOString(),
    snapshot: {
      share_link: delivery.share_link,
      invite_link: inviteLink,
      purpose: delivery.purpose,
      published_at: new Date().toISOString(),
    },
  };
  const merged: CaseArtifactsPayload = {
    ...existing,
    external_links: [...(existing.external_links || []), link],
  };
  await saveCaseArtifacts(caseId, merged);
  return merged;
}
