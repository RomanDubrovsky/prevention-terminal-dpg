/**
 * Case summary - per-block AI interpretation (left notes -> right text).
 */

import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";

export type CaseSummaryAiBlock = "conclusions" | "recommendations" | "dynamics" | "homework";

export interface CaseSummaryBlockResult {
  block: CaseSummaryAiBlock;
  text: string;
  reply: string;
}

export async function structureCaseSummaryBlock(args: {
  block: CaseSummaryAiBlock;
  notes?: string;
  caseContext?: string;
  lang?: string;
  terminalUserId?: string;
}): Promise<CaseSummaryBlockResult> {
  const notes = (args.notes || "").trim();
  const message =
    notes ||
    (args.lang?.startsWith("en")
      ? "Generate interpretation from case context."
      : "Сформируй интерпретацию по контексту дела.");

  const res = await fetch(`${platformApiBase()}/api/terminal/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "consultant",
      message,
      context: args.caseContext || "",
      action: "structure_case_summary_block",
      summary_block: args.block,
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
    block?: string;
    interpretation?: string;
    segments?: { text?: string };
  };
  if (!data.ok) {
    if (data.error === "subscription_required") throw new Error("subscription_required");
    throw new Error(data.error || "summary_block_structure_failed");
  }
  const interpretation = String(
    data.interpretation || data.segments?.text || data.text || "",
  ).trim();
  if (!interpretation) throw new Error("summary_block_structure_failed");
  return {
    block: args.block,
    text: interpretation,
    reply: String(data.reply || "").trim(),
  };
}

