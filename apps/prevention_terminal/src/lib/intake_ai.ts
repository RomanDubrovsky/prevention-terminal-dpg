import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";

export interface PrimaryIntakeStructureResult {
  segments: {
    contactedBy?: string;
    concernFor?: string;
    initiative?: string;
    primaryDescription?: string;
    riskNotes?: string;
  };
  theme_ids?: string[];
  custom_themes?: string[];
  reply: string;
}

export async function structurePrimaryIntakeFromText(args: {
  text: string;
  caseContext?: string;
  lang?: string;
  terminalUserId?: string;
}): Promise<PrimaryIntakeStructureResult> {
  const res = await fetch(`${platformApiBase()}/api/terminal/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "consultant",
      message: args.text,
      context: args.caseContext || "",
      action: "structure_primary_intake",
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
    segments?: Record<string, string>;
    theme_ids?: string[];
    custom_themes?: string[];
  };
  if (!data.ok) {
    if (data.error === "subscription_required") throw new Error("subscription_required");
    throw new Error(data.error || "primary_intake_structure_failed");
  }
  if (!data.segments) throw new Error("primary_intake_structure_failed");
  return {
    segments: data.segments,
    theme_ids: data.theme_ids,
    custom_themes: data.custom_themes,
    reply: String(data.reply || data.text || "").trim(),
  };
}
