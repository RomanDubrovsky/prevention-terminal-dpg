import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import { arrayBufferToBase64 } from "./docx_export.ts";
import {
  buildSchoolFormFileName,
  packSchoolFormDocx,
} from "./school_form_docx_export.ts";
import type { SchoolFormId } from "./school_psychologist_forms.ts";
import { isWebStaging } from "./web_staging.ts";
import {
  workEntryToSourceRow,
  type WorkEntry,
} from "./work_entries.ts";

export async function exportWorkloadJournalDocx(args: {
  formId: SchoolFormId;
  entries: WorkEntry[];
  periodLabel: string;
  orgName?: string;
  specialistName?: string;
}): Promise<{ path: string } | { downloaded: true }> {
  const sourceRows = args.entries.map((entry, idx) =>
    workEntryToSourceRow(args.formId, entry, idx + 1),
  );
  const buffer = await packSchoolFormDocx({
    formId: args.formId,
    sourceRows,
    periodLabel: args.periodLabel,
    orgName: args.orgName,
    specialistName: args.specialistName,
  });

  const fileName = buildSchoolFormFileName(args.formId);

  if (isWebStaging()) {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return { downloaded: true };
  }

  const path = await save({
    defaultPath: fileName,
    filters: [{ name: "Word", extensions: ["docx"] }],
  });
  if (!path) {
    throw new Error("cancelled");
  }
  await invoke("save_docx", {
    targetPath: path,
    base64Data: arrayBufferToBase64(buffer),
  });
  return { path };
}
