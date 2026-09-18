import { getTerminalEdition } from "./terminal_edition.ts";
import { sendAiTurn } from "./ai_workspace.ts";

export async function generateClientHandout(args: {
  context: string;
  terminalUserId?: string;
  lang?: string;
}): Promise<string> {
  const lang = args.lang || (getTerminalEdition() === "ru" ? "ru" : "en");
  const prompt =
    lang.startsWith("ru")
      ? "Составь краткий документ для клиента (1–2 страницы): без жаргона, с понятными выводами, рекомендациями и домашним заданием. Без ФИО и контактов. В конце — мягкое приглашение продолжить работу и при желании использовать IDA между визитами."
      : "Write a short client-facing handout: plain language, conclusions, recommendations, homework. No PII.";
  const result = await sendAiTurn({
    mode: "consultant",
    consultantSub: "case",
    message: prompt,
    context: args.context,
    terminalUserId: args.terminalUserId,
    lang,
  });
  return result.raw_text?.trim() || result.reply.trim();
}
