import { platformApiBase } from "./platform_api.ts";

export interface InboxServerStatus {
  running: boolean;
  port: number;
  inbox_url: string;
  health_url: string;
  inbox_viewer_url: string;
}

export interface LeadRow {
  id: string;
  center_id: string;
  name: string;
  contact: string;
  specialist_id: string | null;
  intake_json: string;
  source: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
}

export interface InternalCaseRow {
  id: string;
  org_id: string;
  sender_id: string;
  sender_role: string;
  sender_name?: string | null;
  recipient_id?: string | null;
  recipient_role: string;
  topic: string;
  content: string;
  ai_context?: Record<string, any>;
  status: string;
  priority: string;
  internal_notes?: Array<{ author_id?: string; note: string; created_at: string; status_change?: string }>;
  case_file_id?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchInboxStatus(): Promise<InboxServerStatus> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<InboxServerStatus>("inbox_server_status");
  } catch {
    return {
      running: false,
      port: 0,
      inbox_url: "",
      health_url: "",
      inbox_viewer_url: "",
    };
  }
}

export async function listLeads(centerId?: string, limit = 50): Promise<LeadRow[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<LeadRow[]>("inbox_list_leads", {
      centerId: centerId || null,
      limit,
    });
  } catch {
    return [];
  }
}

export async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("inbox_update_lead_status", { leadId, status });
  } catch {
    // fallback
  }
}

export async function fetchCloudInbox(orgId: string, status?: string): Promise<InternalCaseRow[]> {
  const base = platformApiBase();
  const url = new URL(`${base}/api/internal/inbox`);
  url.searchParams.set("org_id", orgId);
  if (status) url.searchParams.set("status", status);
  const resp = await fetch(url.toString());
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.items || []) as InternalCaseRow[];
}

export async function fetchCloudOutbox(senderId: string): Promise<InternalCaseRow[]> {
  const base = platformApiBase();
  const url = new URL(`${base}/api/internal/outbox`);
  url.searchParams.set("sender_id", senderId);
  const resp = await fetch(url.toString());
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.items || []) as InternalCaseRow[];
}

export async function updateCloudCaseStatus(
  caseId: string,
  status: string,
  note?: string,
  authorId?: string,
  caseFileId?: string
): Promise<boolean> {
  const base = platformApiBase();
  const resp = await fetch(`${base}/api/internal/cases/${encodeURIComponent(caseId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note, author_id: authorId, case_file_id: caseFileId }),
  });
  return resp.ok;
}

