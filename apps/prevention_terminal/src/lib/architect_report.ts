import { sectionArchitectPrompt, sendAiTurn } from "./ai_workspace.ts";

export type ArchitectReportCategory = "case" | "consultation";

/** Run section architect report turn; returns trimmed document text. */
export async function generateArchitectReport(args: {
  category: ArchitectReportCategory;
  context: string;
  terminalUserId: string;
  lang?: "ru" | "en";
}): Promise<string> {
  const result = await sendAiTurn({
    mode: "architect",
    message: sectionArchitectPrompt(args.category, "report"),
    context: args.context,
    architectDocType: "consultation_report",
    terminalUserId: args.terminalUserId,
    lang: args.lang || "ru",
  });
  const text = String(result.raw_text || result.reply || "").trim();
  if (!text) throw new Error("report_empty");
  return text;
}
