import { invoke } from "@tauri-apps/api/core";

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

export async function fetchInboxStatus(): Promise<InboxServerStatus> {
  return invoke<InboxServerStatus>("inbox_server_status");
}

export async function listLeads(centerId?: string, limit = 50): Promise<LeadRow[]> {
  return invoke<LeadRow[]>("inbox_list_leads", {
    centerId: centerId || null,
    limit,
  });
}

export async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  await invoke("inbox_update_lead_status", { leadId, status });
}
