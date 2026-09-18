/**
 * Создание consultation_lite дела из локальной заявки IDA inbox.
 */

import { invoke } from "@tauri-apps/api/core";

import { buildCasePassport, emptyDraft, newCaseId } from "./case.ts";
import { defaultSituationKind } from "./case_meta.ts";
import { saveCaseArtifacts } from "./case_store.ts";
import {
  leadLinkFromRow,
  sessionDraftFromIdaLead,
  type CaseIdaLeadLink,
} from "./ida_intake_bridge.ts";
import type { LeadRow } from "./inbox_client.ts";
import { updateLeadStatus } from "./inbox_client.ts";
import { hasSessionDraftContent, newSessionRecordId } from "./session_records.ts";

export interface CreateCaseFromLeadResult {
  caseId: string;
  title: string;
  idaLead: CaseIdaLeadLink;
  primaryPrefilled: boolean;
}

function leadTitle(lead: LeadRow): string {
  const name = lead.name?.trim();
  if (name) return name;
  const contact = lead.contact?.trim();
  if (contact) return contact.slice(0, 80);
  return `Заявка ${lead.id.slice(0, 8)}`;
}

/** Создаёт lite-дело, привязывает ida_lead и при возможности сохраняет первичный приём. */
export async function createCaseFromIdaLead(args: {
  lead: LeadRow;
  commercial: boolean;
  prefillPrimary?: boolean;
}): Promise<CreateCaseFromLeadResult> {
  const { lead, commercial } = args;
  const prefillPrimary = args.prefillPrimary !== false;
  const title = leadTitle(lead);
  const caseId = newCaseId();
  const passport = buildCasePassport(emptyDraft());
  const idaLead: CaseIdaLeadLink = {
    ...leadLinkFromRow(lead),
    applied_to_primary_at: prefillPrimary ? new Date().toISOString() : undefined,
  };

  await invoke("db_insert_case", {
    caseId,
    taxonomyPassportJson: JSON.stringify(passport),
    notesSanitized: "",
    aliases: [],
  });
  await saveCaseArtifacts(caseId, {
    record_kind: "consultation_lite",
    situation_title: title,
    situation_kind: defaultSituationKind(commercial),
    ida_lead: idaLead,
  });

  let primaryPrefilled = false;
  if (prefillPrimary) {
    const { draft: partial, problemThemes } = sessionDraftFromIdaLead(lead, commercial);
    const draft = { ...partial, problemThemes } as any;
    if (hasSessionDraftContent(draft)) {
      await invoke("db_add_session_record", {
        recordId: newSessionRecordId(),
        caseId,
        contentJson: JSON.stringify(draft),
        isInitial: true,
      });
      primaryPrefilled = true;
    }
  }

  if (lead.status !== "converted") {
    await updateLeadStatus(lead.id, "converted");
  }

  return { caseId, title, idaLead, primaryPrefilled };
}
