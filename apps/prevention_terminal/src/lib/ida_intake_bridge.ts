import type { LeadRow } from "./inbox_client.ts";
import type { SessionDraft } from "./session_records.ts";
import type { SessionTagSelection } from "./session_tagging.ts";
import { problemKeyAllowedMap } from "./taxonomy_picker.ts";

export interface CaseIdaLeadLink {
  lead_id: string;
  name?: string;
  contact?: string;
  intake_json?: string;
  applied_to_primary_at?: string;
}

export interface IdaIntakeBrief {
  disclaimer?: string;
  summary_bullets?: string[];
  clarify_on_first_session?: string[];
  taxonomy_codes?: {
    problem_keys?: string[];
    method_tags?: string[];
    crisis_flag?: boolean;
    org_scale?: string;
  };
  history?: string;
  assessment?: Record<string, unknown>;
  turns?: number;
}

export function parseIdaIntakeBrief(raw: string): IdaIntakeBrief | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return null;
  try {
    return JSON.parse(trimmed) as IdaIntakeBrief;
  } catch {
    return null;
  }
}

function linesFromBrief(brief: IdaIntakeBrief): string[] {
  const lines: string[] = [];
  if (brief.disclaimer) lines.push(brief.disclaimer);
  for (const item of brief.summary_bullets || []) {
    if (item.trim()) lines.push(`• ${item.trim()}`);
  }
  for (const item of brief.clarify_on_first_session || []) {
    if (item.trim()) lines.push(`Уточнить: ${item.trim()}`);
  }
  if (brief.history?.trim()) lines.push(`История из виджета: ${brief.history.trim()}`);
  return lines;
}

export function sessionDraftFromIdaLead(
  lead: LeadRow,
  commercial: boolean,
): { draft: Partial<SessionDraft>; problemThemes: SessionTagSelection } {
  const brief = parseIdaIntakeBrief(lead.intake_json);
  const allowed = problemKeyAllowedMap(commercial);
  const themeIds = (brief?.taxonomy_codes?.problem_keys || []).filter((id) => allowed.has(id));
  const narrative = brief ? linesFromBrief(brief).join("\n") : "";
  const draft: Partial<SessionDraft> = {
    contactedBy: lead.name ? `[Заявитель: ${lead.name}]` : "",
    initiative: "Обращение через виджет IDA на сайте центра",
    primaryDescription: narrative,
    concernFor: "",
  };
  if (brief?.taxonomy_codes?.crisis_flag) {
    draft.riskNotes = "По данным виджета: повышенная острота — уточнить риски на встрече.";
  }
  return {
    draft,
    problemThemes: {
      catalog: themeIds,
      custom: [],
    },
  };
}

export function leadLinkFromRow(lead: LeadRow): CaseIdaLeadLink {
  return {
    lead_id: lead.id,
    name: lead.name,
    contact: lead.contact,
    intake_json: lead.intake_json,
  };
}
