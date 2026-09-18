/**
 * Expert → Architect bridge: merge saved expert artifacts into architect context.
 * Group work uses card_only (no expert block).
 */

import type { WorkLogEntry } from "./worklog.ts";
import { parseConsultationSession } from "./consultation_session.ts";
import type { CaseArtifactsPayload } from "./case_store.ts";
import { flattenCaseExpertForBridge, formatFlattenedExpertForContext } from "./case_expert_store.ts";
import {
  expertLabel,
  formatExpertArtifactBody,
  type ExpertProtocolId,
  type SessionArtifacts,
} from "./section_artifacts.ts";

export const EXPERT_BRIDGE_MARKER = "--- РЕЗУЛЬТАТЫ ЭКСПЕРТИЗЫ (карточка и личное дело) ---";

export type ArchitectBridgeMode = "expert" | "card_only";

export { formatExpertArtifactBody };

export function formatExpertArtifactsBlock(
  expert: SessionArtifacts["expert"],
  heading = EXPERT_BRIDGE_MARKER,
): string {
  if (!expert) return "";
  const lines: string[] = [];
  for (const id of Object.keys(expert) as ExpertProtocolId[]) {
    const body = formatExpertArtifactBody(expert[id]!);
    if (!body) continue;
    lines.push(`### ${expertLabel(id)}\n${body}`);
  }
  if (!lines.length) return "";
  return `${heading}\n${lines.join("\n\n")}`;
}

/** Merge expert maps; newer saved_at wins per protocol. */
export function mergeExpertArtifacts(
  sources: Array<SessionArtifacts["expert"] | undefined>,
): NonNullable<SessionArtifacts["expert"]> {
  const out: NonNullable<SessionArtifacts["expert"]> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const id of Object.keys(source) as ExpertProtocolId[]) {
      const next = source[id];
      if (!next?.text?.trim() && !next?.segments) continue;
      const prev = out[id];
      if (!prev) {
        out[id] = { ...next };
        continue;
      }
      const prevTs = Date.parse(prev.saved_at || "") || 0;
      const nextTs = Date.parse(next.saved_at || "") || 0;
      if (nextTs >= prevTs) out[id] = { ...next };
    }
  }
  return out;
}

export function aggregateCaseExpertFromEntries(
  entries: readonly WorkLogEntry[],
  options?: { excludeEntryId?: string; includeEntryId?: string },
): SessionArtifacts["expert"] {
  const experts: Array<SessionArtifacts["expert"]> = [];
  for (const entry of entries) {
    if (entry.action_kind !== "consultation") continue;
    if (options?.excludeEntryId && entry.entry_id === options.excludeEntryId) continue;
    const session = parseConsultationSession(entry.note);
    if (session.artifacts.expert) experts.push(session.artifacts.expert);
  }
  return mergeExpertArtifacts(experts);
}

function summarizeVisit(entry: WorkLogEntry, index: number): string {
  const session = parseConsultationSession(entry.note);
  const p = session.progress;
  const parts = [
    p.goal,
    p.observations,
    p.assessmentResponse,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const date = formatVisitDate(entry.created_at);
  const head = `Посещение ${index}${date ? ` (${date})` : ""}`;
  if (!parts.length) return `${head}: без краткого протокола`;
  return `${head}: ${parts.join(" · ").slice(0, 400)}`;
}

function formatVisitDate(createdAt: string): string {
  const seconds = Number.parseInt(createdAt, 10);
  if (!Number.isFinite(seconds)) return "";
  return new Date(seconds * 1000).toLocaleDateString("ru-RU");
}

export function formatPriorVisitsBlock(
  entries: readonly WorkLogEntry[],
  excludeEntryId?: string,
): string {
  const visits = entries
    .filter((e) => e.action_kind === "consultation" && e.entry_id !== excludeEntryId)
    .slice(0, 12);
  if (!visits.length) return "";
  const lines = visits.map((e, i) => summarizeVisit(e, visits.length - i));
  return `--- ПРЕДЫДУЩИЕ ПОСЕЩЕНИЯ (кратко) ---\n${lines.join("\n")}`;
}

export function resolveCaseExpertForBridge(
  caseLevel?: SessionArtifacts["expert"],
  visitAggregated?: SessionArtifacts["expert"],
  visitCurrent?: SessionArtifacts["expert"],
): SessionArtifacts["expert"] {
  return mergeExpertArtifacts([caseLevel, visitAggregated, visitCurrent]);
}

export function caseExpertFromArtifacts(artifacts?: CaseArtifactsPayload): SessionArtifacts["expert"] {
  const flat = flattenCaseExpertForBridge(artifacts);
  return flat as SessionArtifacts["expert"];
}

export function formatCaseArtifactsExpertBlock(artifacts?: CaseArtifactsPayload): string {
  const flat = flattenCaseExpertForBridge(artifacts);
  return formatFlattenedExpertForContext(flat);
}

export function buildArchitectBridgeContext(args: {
  baseContext: string;
  bridgeMode: ArchitectBridgeMode;
  /** Full case artifacts (expert + by_participant). */
  caseArtifacts?: CaseArtifactsPayload;
  /** @deprecated use caseArtifacts */
  caseLevelExpert?: SessionArtifacts["expert"];
  currentArtifacts?: SessionArtifacts;
  priorVisits?: readonly WorkLogEntry[];
  excludeEntryId?: string;
}): string {
  const {
    baseContext,
    bridgeMode,
    caseArtifacts,
    caseLevelExpert,
    currentArtifacts,
    priorVisits = [],
    excludeEntryId,
  } = args;

  if (bridgeMode === "card_only") {
    return baseContext.trim();
  }

  const visitExpert = aggregateCaseExpertFromEntries(priorVisits, { excludeEntryId });
  const caseExpert =
    caseArtifacts != null ? caseExpertFromArtifacts(caseArtifacts) : caseLevelExpert;
  const mergedVisitExpert = resolveCaseExpertForBridge(undefined, visitExpert, currentArtifacts?.expert);
  const caseBlock =
    caseArtifacts != null
      ? formatCaseArtifactsExpertBlock(caseArtifacts)
      : formatExpertArtifactsBlock(caseExpert);
  const visitBlock = formatExpertArtifactsBlock(mergedVisitExpert);
  const expertBlock = [caseBlock, visitBlock].filter((s) => s.trim()).join("\n\n");
  const visitsBlock = formatPriorVisitsBlock(priorVisits, excludeEntryId);

  return [baseContext, visitsBlock, expertBlock].map((s) => String(s || "").trim()).filter(Boolean).join("\n\n");
}

export function hasExpertBridgeContent(
  caseLevelExpert?: SessionArtifacts["expert"],
  currentArtifacts?: SessionArtifacts,
): boolean {
  const merged = mergeExpertArtifacts([caseLevelExpert, currentArtifacts?.expert]);
  return Object.keys(merged).length > 0;
}
