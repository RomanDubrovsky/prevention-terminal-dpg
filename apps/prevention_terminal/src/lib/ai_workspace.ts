import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";
import { t } from "./i18n.ts";
import {
  isLocalLeadSink,
  publicConsultUrlForEmbed,
  publicLeadSinkForEmbed,
  sanitizeIdaSiteWidgets,
  type IdaSiteWidgets,
} from "./site_embed_public.ts";
import { getDomainConfig } from "./domain/index.ts";

export type { IdaSiteWidgets } from "./site_embed_public.ts";

export type AiMode = "consultant" | "expert" | "architect";

/** Sub-mode inside «Спросить» (consultant). */
export type ConsultantSub = "case" | "supervision" | "theory" | "mnemonics" | "educator" | "academy";

export const CONSULTANT_SUB_OPTIONS = [
  {
    id: "case" as const,
    label: t("Консультант", "Consultant"),
    hint: t("Разбор конкретной ситуации и рекомендации", "Analysis of specific situation and recommendations"),
  },
  {
    id: "supervision" as const,
    label: t("Супервизия", "Supervision"),
    hint: t("Ваш кейс как специалиста — зеркало и гипотезы", "Your case as a specialist — mirror and hypotheses"),
  },
  {
    id: "theory" as const,
    label: t("Теория", "Theory"),
    hint: t("Методика и алгоритмы без разбора клиента", "Methodology and algorithms without client details"),
  },
  {
    id: "mnemonics" as const,
    label: t("🧠 Мнемоника и термины", "🧠 Mnemonics & Terms"),
    hint: t("Быстрое запоминание понятий, ассоциации, мнемотехники и карточки знаний", "Quick memorization of concepts, associations, mnemonics and knowledge cards"),
  },
];

/** Educator lite: two top-level modes (tabs). */
export const EDUCATOR_LITE_TABS = {
  case: "Разобрать случай",
  groupPlan: "Создать план группового занятия",
} as const;

export const EDUCATOR_LITE_HINTS = {
  case:
    "Конкретная ситуация в классе или с учеником: что происходит, ваши шаги, гипотезы. " +
    "Без ФИО и без реестра — только профилактический разбор.",
  groupPlan:
    "Профилактическое групповое занятие (не план обычного урока по предмету): цель, состав группы, " +
    "риски, этапы и упражнения. Тот же конструктор, что у специалиста в Архитекторе → «Групповые занятия». " +
    "Опишите задачу — система сначала предложит концепцию, затем таблицу этапов; правки — следующими сообщениями в этом же режиме.",
} as const;

function apiBase(): string {
  return platformApiBase();
}

export interface AiMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AiTurnResult {
  reply: string;
  session_id: string;
  raw_text?: string;
  segments?: Record<string, string>;
  structured?: boolean;
  handoff?: string;
  requires_user_input?: boolean;
}

const SESSION_KEY = "terminal_ai_session";

function terminalAiSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export const EXPERT_PROTOCOL_OPTIONS = getDomainConfig().protocols.caseExpertise;

export {
  EXPERT_DEFAULT_PROMPTS,
  ARCHITECT_DEFAULT_PROMPT,
  SECTION_ARCHITECT_PROMPTS,
  SECTION_EXPERT_PROMPTS,
  sectionArchitectPrompt,
  sectionExpertPrompt,
} from "./ai_prompts.ts";

export async function sendAiTurn(args: {
  mode: AiMode;
  message: string;
  context: string;
  expertProtocol?: string;
  architectDocType?: string;
  lang?: string;
  consultantSub?: ConsultantSub;
  educatorLite?: boolean;
  appId?: string;
  installId?: string;
  terminalUserId?: string;
}): Promise<AiTurnResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (args.appId) {
    headers["X-App-ID"] = args.appId;
  }
  const res = await fetch(`${apiBase()}/api/terminal/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mode: args.mode,
      message: args.message,
      context: args.context,
      expert_protocol: args.expertProtocol,
      architect_doc_type: args.architectDocType,
      session_id: terminalAiSessionId(),
      lang: args.lang || "ru",
      consultant_sub: args.consultantSub,
      app_id: args.appId,
      educator_lite: args.educatorLite === true,
      install_id: args.installId,
      terminal_user_id: args.terminalUserId,
      edition: getTerminalEdition(),
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    paywall_url?: string;
    reply?: string;
    text?: string;
    session_id?: string;
    raw_text?: string;
    segments?: Record<string, string>;
    structured?: boolean;
    handoff?: string;
    requires_user_input?: boolean;
  };
  if (res.status === 402 || !res.ok || !data.ok) {
    if (res.status === 402 || data.error === "subscription_required") {
      throw new Error("subscription_required");
    }
    if (data.error === "educator_rate_limited") {
      throw new Error("educator_rate_limited");
    }
    throw new Error(data.error || "ai_chat_failed");
  }
  const reply = String(data.reply || data.text || "").trim();
  if (data.session_id) {
    try {
      localStorage.setItem(SESSION_KEY, data.session_id);
    } catch {
      /* ignore */
    }
  }
  return {
    reply,
    session_id: data.session_id || terminalAiSessionId(),
    raw_text: data.raw_text,
    segments: data.segments,
    structured: data.structured,
    handoff: data.handoff,
    requires_user_input: data.requires_user_input,
  };
}

export async function sendSupervisionWorkflow(args: {
  reflection: string;
  terminalUserId?: string;
}): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const res = await fetch(`${apiBase()}/api/supervision/workflow`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      reflection: args.reflection,
      userId: args.terminalUserId,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "supervision_failed");
  }
  return data.data;
}

/** Handoff expert audit results into architect context (server-side session). */
export async function fixInArchitect(lang = "ru"): Promise<AiTurnResult> {
  const res = await fetch(`${apiBase()}/api/terminal/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "architect",
      message: "",
      action: "fix_in_architect",
      session_id: terminalAiSessionId(),
      lang,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    reply?: string;
    text?: string;
    session_id?: string;
    handoff?: string;
  };
  if (!data.ok) throw new Error(data.error || "handoff_failed");
  return {
    reply: String(data.reply || data.text || "").trim(),
    session_id: data.session_id || terminalAiSessionId(),
    handoff: data.handoff || "fix_in_architect",
  };
}

export async function fetchConsumerBridge(args: {
  consumerApp: string;
  childInviteCode: string;
  terminalUserId: string;
}): Promise<{ pwa_url: string; bridge_code: string }> {
  const res = await fetch(`${apiBase()}/api/terminal/consumer/bridge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consumer_app: args.consumerApp,
      child_invite_code: args.childInviteCode,
      terminal_user_id: args.terminalUserId,
    }),
  });
  const data = (await res.json()) as { ok: boolean; bridge?: { pwa_url: string; bridge_code: string } };
  if (!data.ok || !data.bridge) throw new Error("bridge_failed");
  return data.bridge;
}

export function buildLocalIdaWidgets(args: {
  organizationName: string;
  leadSinkUrl?: string;
  centerId: string;
  setupToken: string;
  iconostasisColumns?: number;
  inboxViewerUrl?: string;
  consultBookingUrl?: string;
  isSchool?: boolean;
}): IdaSiteWidgets {
  const cid = (args.centerId || "CTR-DEMO-CENTER").trim();
  const brand = (args.organizationName || "Центр").trim();
  const setupToken = (args.setupToken || "").trim();
  const consultUrl = publicConsultUrlForEmbed(args.consultBookingUrl || "");
  const leadSink = publicLeadSinkForEmbed(args.leadSinkUrl || "");
  const cols = args.iconostasisColumns || 3;
  const source = args.isSchool ? "school_embed" : "center_embed";

  const consultAttr = consultUrl ? `\n  data-consult-url="${consultUrl}"` : "";
  const leadSinkAttr = leadSink ? `\n  data-lead-sink="${leadSink}"` : "";

  const embed_snippet = `<script src="https://prevention.school/ida/embed/loader.js" defer
  data-embed-base="https://prevention.school/ida/embed"
  data-api-base="https://api.prevention.school"
  data-app-id="ida"
  data-source="${source}"
  data-center-id="${cid}"
  data-brand="${brand}"${consultAttr}${leadSinkAttr}
  data-locale="ru"></script>`;

  const registration_embed_snippet = `<script src="https://prevention.school/ida/embed/loader.js" defer
  data-embed-base="https://prevention.school/ida/embed"
  data-widget="register"
  data-api-base="https://api.prevention.school"
  data-center-id="${cid}"
  data-setup-token="${setupToken}"
  data-brand="${brand}"
  data-locale="ru"
  data-taxonomy-domain="ida_relationships"></script>`;

  const iconostasis_embed_snippet = `<script src="https://prevention.school/ida/embed/loader.js" defer
  data-embed-base="https://prevention.school/ida/embed"
  data-widget="roster"
  data-api-base="https://api.prevention.school"
  data-center-id="${cid}"
  data-brand="${brand}"
  data-locale="ru"
  data-columns="${cols}"></script>`;

  return {
    center_id: cid,
    embed_snippet,
    registration_embed_snippet,
    iconostasis_embed_snippet,
    inbox_viewer_embed_snippet: "",
    inbox_viewer_url: "",
    lead_sink_url: leadSink,
    iconostasis_columns: String(cols),
  };
}

export async function fetchIdaWidgets(args: {
  organizationName: string;
  leadSinkUrl?: string;
  centerId: string;
  setupToken: string;
  iconostasisColumns?: number;
  inboxViewerUrl?: string;
  consultBookingUrl?: string;
  isSchool?: boolean;
  schoolPrivacyMode?: string;
}): Promise<IdaSiteWidgets> {
  const rawSink = (args.leadSinkUrl || "").trim();
  const leadSink =
    rawSink && !isLocalLeadSink(rawSink) ? rawSink : publicLeadSinkForEmbed(rawSink);
  try {
    const res = await fetch(`${apiBase()}/api/terminal/ida/widgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_name: args.organizationName,
        center_id: args.centerId,
        setup_token: args.setupToken,
        lead_sink_url: leadSink,
        iconostasis_columns: args.iconostasisColumns ?? 3,
        inbox_viewer_url: args.inboxViewerUrl || "",
        is_school: Boolean(args.isSchool),
        consult_booking_url: (args.consultBookingUrl || "").trim(),
        school_privacy_mode: args.schoolPrivacyMode || "hybrid",
      }),
    });
    const data = (await res.json()) as { ok: boolean; widgets?: IdaSiteWidgets };
    if (data.ok && data.widgets) {
      return sanitizeIdaSiteWidgets(data.widgets);
    }
  } catch (e) {
    console.warn("fetchIdaWidgets network call failed, falling back to local widget generator:", e);
  }
  return buildLocalIdaWidgets(args);
}
