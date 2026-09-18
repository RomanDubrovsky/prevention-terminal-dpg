import { invoke } from "@tauri-apps/api/core";

import { buildCasePassport, emptyDraft, newCaseId } from "./case.ts";
import {
  getCaseArtifacts,
  listCaseSummaries,
  saveCaseArtifacts,
  type CaseArtifactsPayload,
  type CaseSummary,
} from "./case_store.ts";
import { defaultSituationKind } from "./case_meta.ts";
import type { TerminalConfig } from "./terminal_config.ts";
import {
  formatRegistryProfileLine,
  parseRegistryProfile,
  type RegistryProfile,
} from "./registry_profile.ts";

export interface RegistrySubjectSummary extends CaseSummary {
  profile: RegistryProfile;
}

function isRegistrySubject(artifacts: CaseArtifactsPayload): boolean {
  return artifacts.record_kind === "registry_subject";
}

export async function listRegistrySubjects(): Promise<RegistrySubjectSummary[]> {
  const rows = await listCaseSummaries();
  const out: RegistrySubjectSummary[] = [];
  for (const row of rows) {
    const artifacts = await getCaseArtifacts(row.case_id);
    if (!isRegistrySubject(artifacts)) continue;
    out.push({
      ...row,
      situation_title: artifacts.registry_profile
        ? formatRegistryProfileLine(parseRegistryProfile(artifacts.registry_profile))
        : row.situation_title,
      profile: parseRegistryProfile(artifacts.registry_profile),
    });
  }
  return out;
}

export async function listConsultationLiteCards(): Promise<CaseSummary[]> {
  const rows = await listCaseSummaries();
  const out: CaseSummary[] = [];
  for (const row of rows) {
    const artifacts = await getCaseArtifacts(row.case_id);
    if (artifacts.record_kind === "registry_subject") continue;
    if (artifacts.record_kind === "situation") continue;
    out.push(row);
  }
  return out;
}

export type ConsultationClientKind = "registry" | "lite";

/** Единый список клиентов для журнала консультаций: реестр + псевдонимы. */
export interface ConsultationClientRow {
  case_id: string;
  title: string;
  kind: ConsultationClientKind;
  created_at: string;
  situation_kind: string;
  profile?: RegistryProfile;
}

export async function listConsultationClients(): Promise<ConsultationClientRow[]> {
  const rows = await listCaseSummaries();
  const out: ConsultationClientRow[] = [];
  for (const row of rows) {
    const artifacts = await getCaseArtifacts(row.case_id);
    if (artifacts.record_kind === "situation") continue;
    if (artifacts.record_kind === "registry_subject") {
      const profile = parseRegistryProfile(artifacts.registry_profile);
      out.push({
        case_id: row.case_id,
        title: profile.full_name || artifacts.situation_title || row.situation_title || "Без имени",
        kind: "registry",
        created_at: row.created_at,
        situation_kind: String(artifacts.situation_kind || row.situation_kind || ""),
        profile,
      });
      continue;
    }
    out.push({
      case_id: row.case_id,
      title: artifacts.situation_title || row.situation_title || "Без названия",
      kind: "lite",
      created_at: row.created_at,
      situation_kind: String(artifacts.situation_kind || row.situation_kind || ""),
    });
  }
  return out;
}

/** Многосторонние кейсы (пара / семья / группа) — без индивидуальных lite и реестра. */
export async function listSituationCases(): Promise<CaseSummary[]> {
  const rows = await listCaseSummaries();
  const out: CaseSummary[] = [];
  for (const row of rows) {
    const artifacts = await getCaseArtifacts(row.case_id);
    if (artifacts.record_kind !== "situation") continue;
    out.push({
      ...row,
      situation_title: artifacts.situation_title || row.situation_title,
      situation_kind: String(artifacts.situation_kind || row.situation_kind || ""),
    });
  }
  return out;
}

export async function createRegistrySubject(
  profile: RegistryProfile,
  commercial: boolean,
): Promise<string> {
  const fullName = profile.full_name.trim();
  if (!fullName) {
    throw new Error("Укажите ФИО — без этого запись не попадёт в реестр.");
  }
  const caseId = newCaseId();
  const passport = buildCasePassport(emptyDraft());
  await invoke("db_insert_case", {
    caseId,
    taxonomyPassportJson: JSON.stringify(passport),
    notesSanitized: "",
    aliases: [],
  });
  const displayTitle = formatRegistryProfileLine({ ...profile, full_name: fullName });
  await saveCaseArtifacts(caseId, {
    record_kind: "registry_subject",
    situation_title: displayTitle,
    situation_kind: defaultSituationKind(commercial),
    registry_profile: {
      ...profile,
      full_name: fullName,
    },
  });
  return caseId;
}

export async function updateRegistrySubject(
  caseId: string,
  profile: RegistryProfile,
): Promise<void> {
  const fullName = profile.full_name.trim();
  if (!fullName) throw new Error("ФИО обязательно.");
  const displayTitle = formatRegistryProfileLine({ ...profile, full_name: fullName });
  await saveCaseArtifacts(caseId, {
    record_kind: "registry_subject",
    situation_title: displayTitle,
    registry_profile: { ...profile, full_name: fullName },
  });
}

export async function deleteRegistrySubject(caseId: string): Promise<void> {
  await invoke("db_delete_case", { caseId });
}

export async function getRegistrySubjectProfile(caseId: string): Promise<RegistryProfile | null> {
  const artifacts = await getCaseArtifacts(caseId);
  if (!isRegistrySubject(artifacts)) return null;
  return parseRegistryProfile(artifacts.registry_profile);
}

/** Поиск по ФИО — только для поля в карточке реестра (минимум 2 символа). */
export function filterRegistrySubjectsByFio(
  subjects: RegistrySubjectSummary[],
  query: string,
  excludeCaseId?: string | null,
): RegistrySubjectSummary[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return subjects.filter((row) => {
    if (excludeCaseId && row.case_id === excludeCaseId) return false;
    return row.profile.full_name.toLowerCase().includes(q);
  });
}

export function registryRequiredForIpr(cfg: TerminalConfig): boolean {
  return cfg.registry_enabled === true;
}

export async function importRegistrySubjects(args: {
  profiles: RegistryProfile[];
  commercial: boolean;
  existing: RegistrySubjectSummary[];
  skipDuplicates?: boolean;
}): Promise<{ created: number; skipped: number; updated: number }> {
  let created = 0;
  let skipped = 0;
  let updated = 0;
  const skipDuplicates = args.skipDuplicates !== false;

  for (const profile of args.profiles) {
    const fullName = profile.full_name.trim();
    if (!fullName) continue;

    const duplicate = args.existing.find((row) =>
      row.profile.full_name.trim().toLowerCase() === fullName.toLowerCase() &&
      (!profile.phone.trim() ||
        !row.profile.phone.trim() ||
        row.profile.phone.trim() === profile.phone.trim()),
    );

    if (duplicate) {
      if (skipDuplicates) {
        skipped += 1;
        continue;
      }
      await updateRegistrySubject(duplicate.case_id, profile);
      updated += 1;
      continue;
    }

    await createRegistrySubject(profile, args.commercial);
    created += 1;
  }

  return { created, skipped, updated };
}
