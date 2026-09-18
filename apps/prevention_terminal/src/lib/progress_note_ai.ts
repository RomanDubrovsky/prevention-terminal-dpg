import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";
import type { NoteTemplatePreset } from "./progress_note.ts";

export interface ProgressNoteStructureResult {
  segments: Record<string, string>;
  reply: string;
}

export async function structureProgressNoteFromText(args: {
  text: string;
  templatePreset?: NoteTemplatePreset;
  caseContext?: string;
  lang?: string;
  terminalUserId?: string;
}): Promise<ProgressNoteStructureResult> {
  const res = await fetch(`${platformApiBase()}/api/terminal/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "consultant",
      message: args.text,
      context: args.caseContext || "",
      action: "structure_progress_note",
      session_id: crypto.randomUUID(),
      lang: args.lang || "ru",
      template_preset: args.templatePreset || "dap",
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
  };
  if (!data.ok) {
    if (data.error === "subscription_required") {
      throw new Error("subscription_required");
    }
    throw new Error(data.error || "progress_note_structure_failed");
  }
  if (!data.segments) {
    throw new Error("progress_note_structure_failed");
  }
  return {
    segments: data.segments,
    reply: String(data.reply || data.text || "").trim(),
  };
}
