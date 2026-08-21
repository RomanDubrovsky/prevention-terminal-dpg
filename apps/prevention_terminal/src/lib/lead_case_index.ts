/**
 * Local index: IDA inbox lead_id -> consultation case_id.
 * Survives page reloads; also rebuilt by scanning case artifacts.
 */

import { getCaseArtifacts, listCaseSummaries } from "./case_store.ts";

const STORAGE_KEY = "terminal.ida_lead_case_map_v1";

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function rememberLeadCase(leadId: string, caseId: string): void {
  const id = String(leadId || "").trim();
  const cid = String(caseId || "").trim();
  if (!id || !cid) return;
  const map = readMap();
  map[id] = cid;
  writeMap(map);
}

export function getRememberedLeadCase(leadId: string): string | null {
  const id = String(leadId || "").trim();
  if (!id) return null;
  return readMap()[id] || null;
}

/** Resolve lead_id -> case_id from local map + case artifacts with ida_lead. */
export async function resolveLeadCaseIds(leadIds: string[]): Promise<Map<string, string>> {
  const wanted = new Set(leadIds.map((id) => String(id || "").trim()).filter((Boolean)));
  const result = new Map<string, string>();
  const remembered = readMap();
  for (const id of wanted) {
    if (remembered[id]) result.set(id, remembered[id]);
  }
  const missing = [...wanted].filter((id) => !result.has(id));
  if (!missing.length) return result;

  try {
    const summaries = await listCaseSummaries();
    const patch: Record<string, string> = { ...remembered };
    for (const row of summaries) {
      try {
        const artifacts = await getCaseArtifacts(row.case_id);
        const leadId = artifacts.ida_lead?.lead_id?.trim();
        if (leadId && wanted.has(leadId) && !result.has(leadId)) {
          result.set(leadId, row.case_id);
          patch[leadId] = row.case_id;
        }
      } catch {
        /* skip one case */
      }
    }
    writeMap(patch);
  } catch {
    /* staging / empty db */
  }
  return result;
}
