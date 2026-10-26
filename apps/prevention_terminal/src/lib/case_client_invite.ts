import { platformApiBase } from "./platform_api.ts";
import type { TerminalConfig } from "./terminal_config.ts";
import type { ExternalLinkScope } from "./case_store.ts";

export interface TerminalConsumerInvite {
  token: string;
  invite_link: string;
  expires_at?: string;
  consumer_app: string;
  case_ref: string;
  case_label: string;
  scope: ExternalLinkScope;
}

export async function createTerminalClientInvite(args: {
  cfg: TerminalConfig;
  caseId: string;
  caseLabel: string;
  scope?: ExternalLinkScope;
  participantAliasId?: string;
}): Promise<TerminalConsumerInvite> {
  const bridgeCode = args.cfg.child_invite_code?.trim();
  if (!bridgeCode) throw new Error("bridge_code_missing");
  const consumerApp = args.cfg.consumer_app === "ida" ? "ida" : "teenology";
  const res = await fetch(`${platformApiBase()}/api/terminal/consumer/invite/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      terminal_user_id: args.cfg.terminal_user_id,
      bridge_code: bridgeCode,
      case_ref: args.caseId,
      case_label: args.caseLabel,
      consumer_app: consumerApp,
      scope: args.scope || "case",
      participant_alias_id: args.participantAliasId,
    }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; invite?: TerminalConsumerInvite };
  if (!data.ok || !data.invite) throw new Error(data.error || "invite_create_failed");
  return data.invite;
}

export async function resolveTerminalClientInvite(token: string): Promise<TerminalConsumerInvite> {
  const tok = token.trim();
  const res = await fetch(
    `${platformApiBase()}/api/terminal/consumer/invite?token=${encodeURIComponent(tok)}`,
  );
  const data = (await res.json()) as { ok: boolean; error?: string; invite?: TerminalConsumerInvite };
  if (!data.ok || !data.invite) throw new Error(data.error || "invite_not_found");
  return {
    ...data.invite,
    invite_link: data.invite.invite_link || `?terminal_link=${tok}`,
  };
}
