import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";
import type { AiSessionTagsSuggestion, SessionTagsProfile } from "./session_tagging.ts";

export interface SessionTagsStructureResult {
  sessionTags: AiSessionTagsSuggestion;
  reply: string;
}

export async function suggestSessionTagsFromText(args: {
  text: string;
  caseContext?: string;
  profile?: SessionTagsProfile;
  lang?: string;
  terminalUserId?: string;
}): Promise<SessionTagsStructureResult> {
  const res = await fetch(`${platformApiBase()}/api/terminal/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "consultant",
      message: args.text,
      context: args.caseContext || "",
      action: "structure_session_tags",
      tags_profile: args.profile || "consultation",
      session_id: crypto.randomUUID(),
      lang: args.lang || "ru",
      terminal_user_id: args.terminalUserId,
      edition: getTerminalEdition(),
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    reply?: string;
    text?: string;
    session_tags?: AiSessionTagsSuggestion;
  };
  if (!data.ok) {
    if (data.error === "subscription_required") {
      throw new Error("subscription_required");
    }
    throw new Error(data.error || "session_tags_structure_failed");
  }
  if (!data.session_tags) {
    throw new Error("session_tags_structure_failed");
  }
  return {
    sessionTags: data.session_tags,
    reply: String(data.reply || data.text || "").trim(),
  };
}
