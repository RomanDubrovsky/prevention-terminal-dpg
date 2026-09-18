/** Target audience for group work, IPR and organization programs (local JSON). */

export type AudienceGroupId = "students" | "parents" | "educators";

export type StudentAgeBand = "6_10" | "11_14" | "15_18" | "mixed";

export interface StructuredAudienceRow {
  group: AudienceGroupId;
  enabled: boolean;
  count: number | null;
  ageBand?: StudentAgeBand;
}

export interface TargetAudienceData {
  mode: "structured" | "free_text";
  freeText: string;
  groups: StructuredAudienceRow[];
}

export const AUDIENCE_GROUP_LABELS: Record<AudienceGroupId, string> = {
  students: "Учащиеся / воспитанники",
  parents: "Родители",
  educators: "Педагоги",
};

export const STUDENT_AGE_BAND_LABELS: Record<StudentAgeBand, string> = {
  "6_10": "6–10 лет",
  "11_14": "11–14 лет",
  "15_18": "15–18 лет",
  mixed: "Смешанный возраст",
};

const DEFAULT_GROUPS: StructuredAudienceRow[] = [
  { group: "students", enabled: false, count: null, ageBand: "mixed" },
  { group: "parents", enabled: false, count: null },
  { group: "educators", enabled: false, count: null },
];

export function emptyTargetAudience(): TargetAudienceData {
  return {
    mode: "structured",
    freeText: "",
    groups: DEFAULT_GROUPS.map((row) => ({ ...row })),
  };
}

export function parseTargetAudienceJson(raw: string | undefined | null): TargetAudienceData {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "{}") return emptyTargetAudience();
  try {
    const parsed = JSON.parse(trimmed) as Partial<TargetAudienceData>;
    const mode = parsed.mode === "free_text" ? "free_text" : "structured";
    const freeText = String(parsed.freeText || "");
    const byId = new Map<AudienceGroupId, StructuredAudienceRow>();
    for (const row of DEFAULT_GROUPS) {
      byId.set(row.group, { ...row });
    }
    if (Array.isArray(parsed.groups)) {
      for (const item of parsed.groups) {
        const group = item?.group;
        if (group !== "students" && group !== "parents" && group !== "educators") continue;
        const countRaw = item?.count;
        const count =
          countRaw === null || countRaw === undefined || (countRaw as any) === ""
            ? null
            : Number(countRaw);
        byId.set(group, {
          group,
          enabled: Boolean(item?.enabled),
          count: Number.isFinite(count) && count !== null && count >= 0 ? Math.floor(count) : null,
          ageBand:
            group === "students" && item?.ageBand && item.ageBand in STUDENT_AGE_BAND_LABELS
              ? (item.ageBand as StudentAgeBand)
              : group === "students"
                ? "mixed"
                : undefined,
        });
      }
    }
    return { mode, freeText, groups: DEFAULT_GROUPS.map((row) => byId.get(row.group) || { ...row }) };
  } catch {
    return emptyTargetAudience();
  }
}

export function serializeTargetAudience(data: TargetAudienceData): string {
  return JSON.stringify({
    mode: data.mode,
    freeText: data.freeText.trim(),
    groups: data.groups.map((row) => ({
      group: row.group,
      enabled: row.enabled,
      count: row.count,
      ...(row.group === "students" ? { ageBand: row.ageBand || "mixed" } : {}),
    })),
  });
}

export function formatTargetAudienceSummary(data: TargetAudienceData): string {
  if (data.mode === "free_text") return data.freeText.trim();
  const parts: string[] = [];
  for (const row of data.groups) {
    if (!row.enabled) continue;
    let line = AUDIENCE_GROUP_LABELS[row.group];
    if (row.group === "students" && row.ageBand) {
      line += ` (${STUDENT_AGE_BAND_LABELS[row.ageBand]})`;
    }
    if (row.count != null && row.count > 0) {
      line += ` — охват ${row.count}`;
    }
    parts.push(line);
  }
  return parts.join("; ");
}

export function formatTargetAudienceForAi(data: TargetAudienceData): string {
  const summary = formatTargetAudienceSummary(data);
  if (!summary) return "";
  if (data.mode === "free_text") {
    return `Целевая группа (свободный ввод): ${summary}`;
  }
  const lines = ["Целевые группы и охват:"];
  for (const row of data.groups) {
    if (!row.enabled) continue;
    let line = `- ${AUDIENCE_GROUP_LABELS[row.group]}`;
    if (row.group === "students" && row.ageBand) {
      line += `, возраст: ${STUDENT_AGE_BAND_LABELS[row.ageBand]}`;
    }
    if (row.count != null && row.count > 0) {
      line += `, охват: ${row.count} чел.`;
    }
    lines.push(line);
  }
  return lines.length > 1 ? lines.join("\n") : summary;
}
