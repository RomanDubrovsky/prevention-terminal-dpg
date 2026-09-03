import { invoke } from "@tauri-apps/api/core";

import type { IprStatus, IprStepStatus } from "./taxonomy.ts";
import { formatExpertArtifactsBlock } from "./expert_bridge.ts";
import { formatTargetAudienceForAi, parseTargetAudienceJson } from "./target_audience.ts";
import {
  formatConsultationSessionTagsForAi,
  parseSessionTagsJson,
} from "./session_tagging.ts";
import { EMPTY_ARTIFACTS, type SessionArtifacts } from "./section_artifacts.ts";

export interface IprRecord {
  id: string;
  case_id: string;
  title: string;
  description: string;
  status: IprStatus;
  plan_text: string;
  report_text: string;
  artifacts_json: string;
  audience_json: string;
  session_tags_json: string;
  created_at: string;
  updated_at: string;
}

export interface IprStepRecord {
  id: string;
  ipr_id: string;
  order_no: number;
  title: string;
  description: string;
  target_date: string | null;
  status: IprStepStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const IPR_STATUS_LABEL: Record<IprStatus, string> = {
  draft: "Черновик",
  active: "В работе",
  completed: "Завершён",
  archived: "В архиве",
};

export const IPR_STEP_STATUS_LABEL: Record<IprStepStatus, string> = {
  planned: "Запланирован",
  in_progress: "В работе",
  completed: "Выполнен",
  skipped: "Пропущен",
};

export async function listIprs(caseId: string): Promise<IprRecord[]> {
  return invoke<IprRecord[]>("db_list_iprs", { caseId });
}

export async function createIpr(caseId: string, title: string, description = ""): Promise<string> {
  return invoke<string>("db_create_ipr", {
    payload: { case_id: caseId, title, description },
  });
}

export async function updateIpr(
  iprId: string,
  patch: {
    title?: string;
    description?: string;
    status?: IprStatus;
    plan_text?: string;
    report_text?: string;
    artifacts?: SessionArtifacts;
    audience_json?: string;
    session_tags_json?: string;
  },
): Promise<void> {
  const payload: Record<string, string | undefined> = {
    title: patch.title,
    description: patch.description,
    status: patch.status,
    plan_text: patch.plan_text,
    report_text: patch.report_text,
    audience_json: patch.audience_json,
    session_tags_json: patch.session_tags_json,
  };
  if (patch.artifacts) {
    payload.artifacts_json = JSON.stringify(patch.artifacts);
  }
  await invoke("db_update_ipr", { iprId, payload });
}

export function parseIprArtifacts(raw: string): SessionArtifacts {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return { ...EMPTY_ARTIFACTS };
  try {
    return { ...EMPTY_ARTIFACTS, ...(JSON.parse(trimmed) as SessionArtifacts) };
  } catch {
    return { ...EMPTY_ARTIFACTS };
  }
}

export function buildIprAiContext(args: {
  ipr: Pick<
    IprRecord,
    | "title"
    | "description"
    | "plan_text"
    | "report_text"
    | "artifacts_json"
    | "audience_json"
    | "session_tags_json"
  >;
  steps: IprStepRecord[];
  caseContext?: string;
}): string {
  const artifacts = parseIprArtifacts(args.ipr.artifacts_json);
  const audience = formatTargetAudienceForAi(parseTargetAudienceJson(args.ipr.audience_json));
  const sessionTags = formatConsultationSessionTagsForAi(
    parseSessionTagsJson(args.ipr.session_tags_json),
  );
  const stepLines = args.steps.map(
    (s, i) =>
      `${i + 1}. ${s.title} [${s.status}]${s.target_date ? ` до ${s.target_date}` : ""}${s.description ? `: ${s.description}` : ""}`,
  );
  return [
    args.caseContext || "",
    `ИПР: ${args.ipr.title}`,
    audience,
    sessionTags,
    args.ipr.description ? `Описание: ${args.ipr.description}` : "",
    stepLines.length ? `Шаги маршрута:\n${stepLines.join("\n")}` : "",
    args.ipr.plan_text ? `План ИПР:\n${args.ipr.plan_text}` : "",
    args.ipr.report_text ? `Отчёт ИПР:\n${args.ipr.report_text}` : "",
    artifacts.expert?.child_profile?.text
      ? `Анализ характеристики:\n${artifacts.expert.child_profile.text}`
      : "",
    formatExpertArtifactsBlock(artifacts.expert),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function listIprSteps(iprId: string): Promise<IprStepRecord[]> {
  return invoke<IprStepRecord[]>("db_list_ipr_steps", { iprId });
}

export async function addIprStep(
  iprId: string,
  title: string,
  description = "",
  targetDate?: string | null,
): Promise<string> {
  return invoke<string>("db_add_ipr_step", {
    payload: {
      ipr_id: iprId,
      title,
      description,
      target_date: targetDate ?? null,
    },
  });
}

export async function updateIprStep(
  stepId: string,
  patch: {
    title?: string;
    description?: string;
    status?: IprStepStatus;
    target_date?: string | null;
    notes?: string;
    order_no?: number;
  },
): Promise<void> {
  await invoke("db_update_ipr_step", { stepId, payload: patch });
}

export async function deleteIprStep(stepId: string): Promise<void> {
  await invoke("db_delete_ipr_step", { stepId });
}
