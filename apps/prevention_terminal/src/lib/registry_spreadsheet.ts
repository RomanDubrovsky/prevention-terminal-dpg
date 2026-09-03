import {
  type RegistryGender,
  type RegistryProfile,
} from "./registry_profile.ts";
import type { RegistrySubjectSummary } from "./registry_store.ts";

/** Колонки для Excel / CSV (UTF-8 BOM — открывается в Excel без кракозябр). */
export const REGISTRY_SPREADSHEET_HEADERS = [
  "ФИО",
  "Пол",
  "Возраст",
  "Класс или группа",
  "Дата рождения",
  "Телефон",
  "Email",
  "Адрес",
  "Контактное лицо",
  "Заметки",
] as const;

type RegistryField = keyof RegistryProfile;

const HEADER_ALIASES: Record<RegistryField, string[]> = {
  full_name: [
    "фио",
    "fio",
    "full_name",
    "fullname",
    "name",
    "имя",
    "клиент",
    "client",
    "full name",
    "ф.и.о.",
  ],
  gender: ["пол", "gender", "sex"],
  age_years: ["возраст", "age", "age_years", "лет"],
  grade_class: ["класс", "группа", "класс или группа", "grade", "grade_class", "class"],
  birth_date: ["дата рождения", "birth_date", "birthdate", "dob", "д.р."],
  phone: ["телефон", "phone", "mobile", "тел"],
  email: ["email", "e-mail", "почта", "mail"],
  address: ["адрес", "address"],
  contact_person: ["контактное лицо", "contact_person", "родитель", "представитель", "contact"],
  notes: ["заметки", "notes", "comment", "комментарий", "примечание"],
};

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function csvCell(raw: string | number | null | undefined): string {
  const v = String(raw ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

function detectDelimiter(line: string): "," | ";" | "\t" {
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (inQuotes) continue;
    if (ch === ",") comma += 1;
    if (ch === ";") semi += 1;
    if (ch === "\t") tab += 1;
  }
  if (tab >= semi && tab >= comma && tab > 0) return "\t";
  if (semi >= comma && semi > 0) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: "," | ";" | "\t"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseGender(raw: string): RegistryGender {
  const v = raw.trim().toLowerCase();
  if (!v) return "unknown";
  if (["м", "муж", "мужской", "male", "m", "boy"].includes(v)) return "male";
  if (["ж", "жен", "женский", "female", "f", "girl"].includes(v)) return "female";
  if (["другое", "other"].includes(v)) return "other";
  return "unknown";
}

function parseAge(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function mapHeaders(cells: string[]): Partial<Record<RegistryField, number>> {
  const out: Partial<Record<RegistryField, number>> = {};
  cells.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [RegistryField, string[]][]) {
      if (aliases.includes(norm)) {
        out[field] = idx;
        break;
      }
    }
  });
  return out;
}

function rowToProfile(cells: string[], headerMap: Partial<Record<RegistryField, number>>): RegistryProfile {
  const pick = (field: RegistryField) => {
    const idx = headerMap[field];
    return idx == null ? "" : String(cells[idx] ?? "").trim();
  };
  return {
    full_name: pick("full_name"),
    gender: parseGender(pick("gender")),
    age_years: parseAge(pick("age_years")),
    grade_class: pick("grade_class"),
    birth_date: pick("birth_date"),
    phone: pick("phone"),
    email: pick("email"),
    address: pick("address"),
    contact_person: pick("contact_person"),
    notes: pick("notes"),
  };
}

export function registrySubjectsToCsv(subjects: RegistrySubjectSummary[]): string {
  const lines = [REGISTRY_SPREADSHEET_HEADERS.map(csvCell).join(",")];
  for (const row of subjects) {
    const p = row.profile;
    lines.push(
      [
        p.full_name,
        p.gender === "male" ? "Мужской" : p.gender === "female" ? "Женский" : "",
        p.age_years ?? "",
        p.grade_class,
        p.birth_date,
        p.phone,
        p.email,
        p.address,
        p.contact_person,
        p.notes,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function downloadRegistrySpreadsheet(
  subjects: RegistrySubjectSummary[],
  filename = "reestr-export.csv",
): void {
  const csv = `\uFEFF${registrySubjectsToCsv(subjects)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface RegistryImportPreview {
  profiles: RegistryProfile[];
  skippedEmpty: number;
  errors: string[];
}

export function parseRegistrySpreadsheet(text: string): RegistryImportPreview {
  const raw = text.replace(/^\uFEFF/, "").trim();
  const errors: string[] = [];
  if (!raw) {
    return { profiles: [], skippedEmpty: 0, errors: ["Файл пустой."] };
  }
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { profiles: [], skippedEmpty: 0, errors: ["Нет строк для импорта."] };
  }
  const delimiter = detectDelimiter(lines[0]);
  const headerCells = parseCsvLine(lines[0], delimiter);
  const headerMap = mapHeaders(headerCells);
  if (headerMap.full_name == null) {
    return {
      profiles: [],
      skippedEmpty: 0,
      errors: [
        "Не найдена колонка «ФИО». Первая строка должна содержать заголовки (ФИО, Телефон, Email…).",
      ],
    };
  }
  const profiles: RegistryProfile[] = [];
  let skippedEmpty = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], delimiter);
    const profile = rowToProfile(cells, headerMap);
    if (!profile.full_name.trim()) {
      skippedEmpty += 1;
      continue;
    }
    profiles.push(profile);
  }
  if (profiles.length === 0 && skippedEmpty > 0) {
    errors.push("Все строки без ФИО — импортировать нечего.");
  }
  return { profiles, skippedEmpty, errors };
}

export function registryImportFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `reestr-export-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
}
