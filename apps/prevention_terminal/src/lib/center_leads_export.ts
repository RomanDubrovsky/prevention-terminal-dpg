import { platformApiBase } from "./platform_api.ts";

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || fallback;
}

/** Download center leads CSV from cloud (RU edition). Opens in Excel. */
export async function downloadCenterLeadsExport(
  centerId: string,
  setupToken: string,
  fallbackName = "center-leads.csv",
): Promise<void> {
  const cid = String(centerId || "").trim();
  const token = String(setupToken || "").trim();
  if (!cid || token.length < 16) {
    throw new Error("center_id_and_setup_token_required");
  }
  const q = new URLSearchParams({ center_id: cid, setup_token: token });
  const res = await fetch(`${platformApiBase()}/api/terminal/ida/leads/export?${q.toString()}`);
  if (!res.ok) {
    let msg = `export_failed_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* binary / empty */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("no_leads_yet");
  }
  const name = filenameFromDisposition(res.headers.get("Content-Disposition"), fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
