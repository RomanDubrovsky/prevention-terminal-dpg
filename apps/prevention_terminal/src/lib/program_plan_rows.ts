import { parseArchitectRows } from "./architect_docx_export.ts";
import type { ArchitectSegments } from "./architect_docx_export.ts";
import type { SessionArtifacts } from "./section_artifacts.ts";
import { mergeArtifacts } from "./section_artifacts.ts";

/** Default columns for organization prevention program (matches Architect DATA_STREAM). */
export const DEFAULT_PROGRAM_PLAN_HEADERS = [
  "Направление",
  "Мероприятие",
  "Срок / период",
  "Охват",
  "Ответственный",
] as const;

export const GROUP_SESSION_PLAN_HEADERS = [
  "№ занятия",
  "Тема",
  "Цель",
  "Формат",
  "Длительность",
] as const;

export const IPR_PLAN_HEADERS = [
  "Этап",
  "Действие",
  "Срок",
  "Ответственный",
  "Ожидаемый результат",
] as const;

export interface ProgramPlanTable {
  headers: string[];
  rows: string[][];
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    joined.includes("направлен") ||
    joined.includes("мероприят") ||
    joined.includes("охват") ||
    joined.includes("срок") ||
    joined.includes("ответствен")
  );
}

export function emptyProgramPlanTable(
  headers: readonly string[] = DEFAULT_PROGRAM_PLAN_HEADERS,
): ProgramPlanTable {
  return { headers: [...headers], rows: [] };
}

export function normalizeProgramPlanTable(
  raw: ProgramPlanTable,
  fallbackHeaders: readonly string[] = DEFAULT_PROGRAM_PLAN_HEADERS,
): ProgramPlanTable {
  const headers =
    raw.headers.length > 0 ? raw.headers.map((h) => h.trim()).filter(Boolean) : [...fallbackHeaders];
  const width = headers.length;
  const rows = raw.rows
    .map((row) => {
      const cells = row.map((c) => String(c || "").trim());
      while (cells.length < width) cells.push("");
      return cells.slice(0, width);
    })
    .filter((row) => row.some((cell) => cell.length > 0));
  return { headers, rows };
}

export function programPlanTableFromDataStream(
  body: string,
  fallbackHeaders: readonly string[] = DEFAULT_PROGRAM_PLAN_HEADERS,
): ProgramPlanTable {
  const parsed = parseArchitectRows(body);
  if (!parsed.length) return emptyProgramPlanTable(fallbackHeaders);
  if (looksLikeHeaderRow(parsed[0])) {
    return normalizeProgramPlanTable({ headers: parsed[0], rows: parsed.slice(1) }, fallbackHeaders);
  }
  return normalizeProgramPlanTable({ headers: [...fallbackHeaders], rows: parsed }, fallbackHeaders);
}

export function serializeDataStreamBody(table: ProgramPlanTable): string {
  const normalized = normalizeProgramPlanTable(table);
  if (!normalized.rows.length) return "";
  const lines = normalized.rows.map((row) => `[ROW]${row.join("|")}[/ROW]`);
  return lines.join("\n");
}

export function formatPlanTextFromTable(table: ProgramPlanTable): string {
  const normalized = normalizeProgramPlanTable(table);
  if (!normalized.rows.length) return "";
  const lines = ["План мероприятий (таблица):"];
  for (const row of normalized.rows) {
    const parts = normalized.headers.map((header, idx) => `${header}: ${row[idx] || "—"}`);
    lines.push(`• ${parts.join("; ")}`);
  }
  return lines.join("\n");
}

export function extractProgramPlanTable(args: {
  segments?: Record<string, string> | ArchitectSegments;
  planText?: string;
  fallbackHeaders?: readonly string[];
}): ProgramPlanTable {
  const fallbackHeaders = args.fallbackHeaders ?? DEFAULT_PROGRAM_PLAN_HEADERS;
  const seg = args.segments || {};
  const body = String(seg.data_stream_body || "").trim();
  if (body) return programPlanTableFromDataStream(body, fallbackHeaders);

  const raw = String(args.planText || "");
  const inline = raw.match(/<DATA_STREAM>([\s\S]*?)<\/DATA_STREAM>/i);
  if (inline?.[1]) return programPlanTableFromDataStream(inline[1], fallbackHeaders);
  if (raw.includes("[ROW]")) return programPlanTableFromDataStream(raw, fallbackHeaders);

  return emptyProgramPlanTable(fallbackHeaders);
}

export function mergeSegmentsWithPlanTable(
  segments: Record<string, string> | undefined,
  table: ProgramPlanTable,
): Record<string, string> {
  const base = { ...(segments || {}) };
  const body = serializeDataStreamBody(table);
  if (body) base.data_stream_body = body;
  return base;
}

export function newPlanRowId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `row-${Date.now().toString(36)}`;
}

export function applyArchitectPlanSave(args: {
  artifacts: SessionArtifacts;
  segments?: Record<string, string>;
  planText: string;
  fallbackHeaders?: readonly string[];
}): { artifacts: SessionArtifacts; planText: string; table: ProgramPlanTable; importedRowCount: number } {
  const { artifacts, segments, planText } = args;
  const fallbackHeaders = args.fallbackHeaders ?? DEFAULT_PROGRAM_PLAN_HEADERS;
  let nextArtifacts = artifacts;
  let nextPlanText = planText;
  let importedRowCount = 0;

  if (segments) {
    const table = extractProgramPlanTable({ segments, planText, fallbackHeaders });
    importedRowCount = table.rows.length;
    if (table.rows.length) {
      nextArtifacts = mergeArtifacts(artifacts, {
        plan_segments: mergeSegmentsWithPlanTable(segments, table),
      });
      const tableSummary = formatPlanTextFromTable(table);
      if (tableSummary && !planText.toLowerCase().includes("план мероприятий")) {
        nextPlanText = planText.trim() ? `${planText.trim()}\n\n${tableSummary}` : tableSummary;
      }
    } else {
      nextArtifacts = mergeArtifacts(artifacts, { plan_segments: segments });
    }
    return {
      artifacts: nextArtifacts,
      planText: nextPlanText,
      table: importedRowCount ? table : extractProgramPlanTable({ segments: nextArtifacts.plan_segments, planText: nextPlanText, fallbackHeaders }),
      importedRowCount,
    };
  }

  return {
    artifacts: nextArtifacts,
    planText: nextPlanText,
    table: extractProgramPlanTable({ segments: artifacts.plan_segments, planText, fallbackHeaders }),
    importedRowCount: 0,
  };
}
