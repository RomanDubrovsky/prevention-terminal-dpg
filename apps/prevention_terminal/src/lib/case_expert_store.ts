import type { CaseArtifactsPayload } from "./case_store.ts";
import { formatExpertArtifactBody, type ExpertArtifact, type ExpertProtocolId } from "./section_artifacts.ts";

export type ParticipantExpertMap = Partial<
  Record<string, Partial<Record<ExpertProtocolId, ExpertArtifact>>>
>;

export function getParticipantExpert(
  artifacts: CaseArtifactsPayload,
  aliasId: string,
): Partial<Record<ExpertProtocolId, ExpertArtifact>> {
  return artifacts.expert_by_participant?.[aliasId] || {};
}

export function setParticipantExpert(
  artifacts: CaseArtifactsPayload,
  aliasId: string,
  protocolId: ExpertProtocolId,
  artifact: ExpertArtifact,
): CaseArtifactsPayload {
  const byParticipant: ParticipantExpertMap = { ...(artifacts.expert_by_participant || {}) };
  const row = { ...(byParticipant[aliasId] || {}) };
  row[protocolId] = artifact;
  byParticipant[aliasId] = row;
  return { ...artifacts, expert_by_participant: byParticipant as any };
}

/** Flatten case-level + per-participant expert maps for architect bridge. */
export function flattenCaseExpertForBridge(
  artifacts?: CaseArtifactsPayload,
): Record<string, ExpertArtifact> {
  const out: Record<string, ExpertArtifact> = {};
  if (artifacts?.expert) {
    for (const [id, art] of Object.entries(artifacts.expert)) {
      if (art?.text?.trim() || art?.segments) out[id] = art;
    }
  }
  const byP = artifacts?.expert_by_participant || {};
  for (const [aliasId, protos] of Object.entries(byP)) {
    if (!protos) continue;
    for (const [pid, art] of Object.entries(protos)) {
      if (!art?.text?.trim() && !art?.segments) continue;
      out[`participant:${aliasId}:${pid}`] = art;
    }
  }
  return out;
}

export function formatFlattenedExpertForContext(
  flat: Record<string, ExpertArtifact>,
  participantMarkers?: Record<string, string>,
): string {
  const lines: string[] = [];
  for (const [key, art] of Object.entries(flat)) {
    const body = formatExpertArtifactBody(art);
    if (!body) continue;
    let heading = key;
    const m = /^participant:([^:]+):(.+)$/.exec(key);
    if (m) {
      const marker = participantMarkers?.[m[1]!] || m[1]!;
      heading = `${marker} · ${m[2]}`;
    }
    lines.push(`### ${heading}\n${body}`);
  }
  if (!lines.length) return "";
  return `--- ЭКСПЕРТИЗА ПО ДЕЛУ ---\n${lines.join("\n\n")}`;
}
