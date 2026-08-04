import { invoke } from "@tauri-apps/api/core";

import { ALIAS_ROLE_LABEL, type AliasRole } from "./case.ts";

export interface CaseParticipant {
  alias_id: string;
  role: AliasRole;
  role_no: number;
}

/** Local-only row: real_name never leaves the device / never goes into AI prompts. */
export interface CaseAliasLocal {
  alias_id: string;
  role: AliasRole;
  role_no: number;
  real_name: string;
}

export function participantMarker(role: AliasRole, roleNo: number): string {
  const label = ALIAS_ROLE_LABEL[role] || role;
  return `[${label} №${roleNo}]`;
}

export async function listCaseParticipants(caseId: string): Promise<CaseParticipant[]> {
  if (!caseId.trim()) return [];
  const rows = await invoke<CaseParticipant[]>("db_list_case_participants", { caseId });
  return rows.map((r) => ({
    alias_id: r.alias_id,
    role: r.role as AliasRole,
    role_no: Number(r.role_no) || 1,
  }));
}

/** For local name→card matching and re-sanitize. Do not put real_name into AI context. */
export async function listCaseAliasesLocal(caseId: string): Promise<CaseAliasLocal[]> {
  if (!caseId.trim()) return [];
  try {
    const rows = await invoke<CaseAliasLocal[]>("db_list_case_aliases_local", { caseId });
    return rows.map((r) => ({
      alias_id: r.alias_id,
      role: r.role as AliasRole,
      role_no: Number(r.role_no) || 1,
      real_name: String(r.real_name || "").trim(),
    }));
  } catch {
    return [];
  }
}
