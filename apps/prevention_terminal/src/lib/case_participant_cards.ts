/**
 * Link case aliases to individual consultation cards (by local name match)
 * and pull privacy-safe expertises / summaries into case AI context.
 */

import type { AliasRole } from "./case.ts";
import { listCaseAliasesLocal, participantMarker } from "./case_participants.ts";
import {
  getCaseArtifacts,
  type CaseArtifactsPayload,
  type CaseParticipantCardLink,
} from "./case_store.ts";
import {
  listConsultationClients,
  type ConsultationClientRow,
} from "./registry_store.ts";
import { expertLabel, formatExpertArtifactBody, type ExpertProtocolId } from "./section_artifacts.ts";

export function normalizePersonName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function matchConsultationCard(
  realName: string,
  clients: readonly ConsultationClientRow[],
): ConsultationClientRow | null {
  const key = normalizePersonName(realName);
  if (key.length < 2) return null;
  const exact = clients.find((c) => normalizePersonName(c.title) === key);
  if (exact) return exact;
  // Allow "Иванов" matching "Иванов Пётр" and vice versa when unique.
  const partial = clients.filter((c) => {
    const t = normalizePersonName(c.title);
    return t.includes(key) || key.includes(t);
  });
  return partial.length === 1 ? partial[0]! : null;
}

export async function buildParticipantCardLinksFromDraft(
  aliases: ReadonlyArray<{ aliasId: string; role: AliasRole; realName: string; roleNo?: number }>,
): Promise<CaseParticipantCardLink[]> {
  const clients = await listConsultationClients();
  const roleCounters: Record<string, number> = {};
  const out: CaseParticipantCardLink[] = [];
  for (const a of aliases) {
    const name = a.realName.trim();
    if (!name) continue;
    const role = a.role;
    roleCounters[role] = (roleCounters[role] || 0) + 1;
    const role_no = a.roleNo || roleCounters[role]!;
    const matched = matchConsultationCard(name, clients);
    out.push({
      alias_id: a.aliasId,
      role,
      role_no,
      card_case_id: matched?.case_id,
    });
  }
  return out;
}

/** Resolve stored links or rematch from local alias names. */
export async function resolveParticipantCardLinks(
  caseId: string,
  artifacts: CaseArtifactsPayload,
): Promise<CaseParticipantCardLink[]> {
  const stored = artifacts.participant_links || [];
  if (stored.some((l) => l.card_case_id)) return stored;

  try {
    const [aliases, clients] = await Promise.all([
      listCaseAliasesLocal(caseId),
      listConsultationClients(),
    ]);
    if (!aliases.length) return stored;
    return aliases.map((a) => {
      const matched = matchConsultationCard(a.real_name, clients);
      return {
        alias_id: a.alias_id,
        role: a.role,
        role_no: a.role_no,
        card_case_id: matched?.case_id,
      };
    });
  } catch {
    return stored;
  }
}

/** Privacy-safe block: markers only, no ФИО. */
export async function formatLinkedCardMaterialsForContext(
  links: readonly CaseParticipantCardLink[],
): Promise<string> {
  const withCards = links.filter((l) => l.card_case_id);
  if (!withCards.length) return "";

  const sections: string[] = [];
  for (const link of withCards) {
    const marker = participantMarker(link.role as AliasRole, link.role_no);
    try {
      const card = await getCaseArtifacts(link.card_case_id!);
      const parts: string[] = [];
      const expert = card.expert || {};
      for (const id of Object.keys(expert) as ExpertProtocolId[]) {
        const body = formatExpertArtifactBody(expert[id]!);
        if (!body) continue;
        parts.push(`${expertLabel(id)}:\n${body.slice(0, 2500)}`);
      }
      const summary = card.consultation_case_summary;
      if (summary) {
        const sumParts = [
          summary.conclusions?.trim() ? `Выводы: ${summary.conclusions.trim().slice(0, 1200)}` : "",
          summary.dynamics?.trim() ? `Динамика: ${summary.dynamics.trim().slice(0, 800)}` : "",
          summary.recommendations?.trim()
            ? `Рекомендации: ${summary.recommendations.trim().slice(0, 1200)}`
            : "",
        ].filter(Boolean);
        if (sumParts.length) parts.push(`Сводка карточки:\n${sumParts.join("\n")}`);
      }
      if (!parts.length) continue;
      sections.push(`### ${marker}\n${parts.join("\n\n")}`);
    } catch {
      /* skip missing card */
    }
  }
  if (!sections.length) return "";
  return (
    "--- ЭКСПЕРТИЗЫ И СВОДКИ ИЗ ИНДИВИДУАЛЬНЫХ КАРТОЧЕК УЧАСТНИКОВ ---\n" +
    "Используй как готовый материал; не выдумывай новые заключения по участникам.\n" +
    sections.join("\n\n")
  );
}
