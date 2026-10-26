import { loadCaseAiContext } from "./case_ai_context.ts";
import { listCaseParticipants, participantMarker } from "./case_participants.ts";
import {
  formatLinkedCardMaterialsForContext,
  resolveParticipantCardLinks,
} from "./case_participant_cards.ts";
import {
  flattenCaseExpertForBridge,
  formatFlattenedExpertForContext,
} from "./case_expert_store.ts";
import { getCaseArtifacts, type CaseArtifactsPayload } from "./case_store.ts";
import { situationKindLabel } from "./case_meta.ts";

function formatExternalFeeds(artifacts: CaseArtifactsPayload): string {
  const links = artifacts.external_links || [];
  if (!links.length) return "";
  const lines = links.map((link) => {
    const snap = link.snapshot || {};
    const parts = [
      `${link.app} (${link.scope})`,
      snap.topic_text ? `Тема: ${snap.topic_text}` : "",
      snap.notes_local ? String(snap.notes_local).slice(0, 1500) : "",
    ].filter(Boolean);
    return parts.join("\n");
  });
  return `--- ВНЕШНИЕ СИГНАЛЫ (Teenology / IDA) ---\n${lines.join("\n\n")}`;
}

function formatSituationMeta(artifacts: CaseArtifactsPayload, commercial: boolean): string {
  const parts: string[] = [];
  if (artifacts.situation_title) parts.push(`Кейс: ${artifacts.situation_title}`);
  if (artifacts.situation_kind) {
    parts.push(`Тип: ${situationKindLabel(String(artifacts.situation_kind), commercial)}`);
  }
  if (artifacts.situation_notes_append?.trim()) {
    parts.push(`Доп. контекст:\n${artifacts.situation_notes_append.trim().slice(0, 2000)}`);
  }
  if (artifacts.situation_synthesis?.text?.trim()) {
    parts.push(`Синтез по ситуации:\n${artifacts.situation_synthesis.text.trim().slice(0, 2000)}`);
  }
  return parts.join("\n");
}

/** Unified privacy-safe context for Expert, Architect, Consultant (case scope). */
export async function buildCaseBrainContext(
  caseId: string,
  options?: { commercial?: boolean },
): Promise<string> {
  if (!caseId.trim()) return "";
  const commercial = options?.commercial === true;
  try {
    const [base, artifacts, participants] = await Promise.all([
      loadCaseAiContext(caseId),
      getCaseArtifacts(caseId),
      listCaseParticipants(caseId),
    ]);
    const markers: Record<string, string> = {};
    for (const p of participants) {
      markers[p.alias_id] = participantMarker(p.role, p.role_no);
    }
    if (participants.length) {
      const plist = participants.map((p) => markers[p.alias_id]).join(", ");
      markers._list = plist;
    }
    const participantLinks = await resolveParticipantCardLinks(caseId, artifacts);
    const linkedCards = await formatLinkedCardMaterialsForContext(participantLinks);
    const flatExpert = flattenCaseExpertForBridge(artifacts);
    const blocks = [
      formatSituationMeta(artifacts, commercial),
      participants.length
        ? `Участники дела: ${participants.map((p) => markers[p.alias_id]).join(", ")}`
        : "",
      base,
      commercial ? "" : formatExternalFeeds(artifacts),
      linkedCards,
      formatFlattenedExpertForContext(flatExpert, markers),
    ]
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    return blocks.join("\n\n").slice(0, 12000);
  } catch {
    return loadCaseAiContext(caseId);
  }
}
