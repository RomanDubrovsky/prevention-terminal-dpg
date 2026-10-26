import type { RegistrySubjectSummary } from "./registry_store.ts";
import { csvCell } from "./registry_spreadsheet.ts";

export function generateEducatorCode(className: string): string {
  // Hash or map class name to a simple code, e.g. PED-5A-AB12
  // For simplicity here, we'll hash the class name loosely
  const norm = className.trim().toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, "");
  if (!norm) return "PED-GENERAL";
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const suffix = Math.abs(hash).toString(16).substring(0, 4).toUpperCase().padStart(4, '0');
  return `PED-${norm}-${suffix}`;
}

export function downloadEducatorCodesSpreadsheet(subjects: RegistrySubjectSummary[], filename = "reestr-kodov-pedagogov.csv") {
  // We need to output: Class_Name, Student_Name, Teacher_Name, Teacher_Code
  const lines: string[] = [];
  
  // Explicit Excel separator hint + CSV header separated by semicolon
  lines.push("sep=;");
  lines.push(["Класс/Группа", "ФИО Ученика", "ФИО Классного руководителя (Педагога)", "Персональный код доступа педагога"].map(csvCell).join(";"));

  for (const sub of subjects) {
    const className = sub.profile.grade_class?.trim() || "Без класса";
    const studentName = sub.profile.full_name?.trim() || "Без имени";
    const code = generateEducatorCode(className);

    lines.push([className, studentName, "", code].map(csvCell).join(";"));
  }

  const csv = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
