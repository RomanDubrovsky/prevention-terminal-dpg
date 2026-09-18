import type { LeadRow } from "./inbox_client.ts";

const CSV_HEADER = [
  "created_at",
  "status",
  "name",
  "contact",
  "specialist_id",
  "source",
  "comment",
  "intake_json",
] as const;

function csvCell(raw: string): string {
  const v = String(raw || "").replace(/"/g, '""');
  return `"${v}"`;
}

export function leadsToCsv(leads: LeadRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const row of leads) {
    let comment = "";
    try {
      const parsed = JSON.parse(row.intake_json || "{}") as { history?: string; message?: string };
      comment = String(parsed.history || parsed.message || "").trim();
    } catch {
      comment = "";
    }
    lines.push(
      [
        row.created_at,
        row.status,
        row.name,
        row.contact,
        row.specialist_id || "",
        row.source || "",
        comment,
        row.intake_json,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function downloadLeadsCsv(leads: LeadRow[], filename = "site-leads.csv"): void {
  const csv = `\uFEFF${leadsToCsv(leads)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
