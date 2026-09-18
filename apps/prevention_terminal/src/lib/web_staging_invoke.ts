/**
 * Tauri invoke shim for browser staging (localStorage-backed).
 * Vite aliases `@tauri-apps/api/core` here when VITE_TERMINAL_STAGING=true.
 */

import type { TerminalConfigInput } from "./terminal_config.ts";
import { generateOpaqueCenterId, slugifyCenterId } from "./center_id.ts";
import { parseWorkLogNote } from "./dap_note.ts";
import { parseConsultationSession } from "./consultation_session.ts";
import {
  readStagingStore,
  resetStagingStore,
  writeStagingStore,
  type StagingStore,
} from "./web_staging.ts";
import {
  base64ToBytes,
  bytesToBase64,
  decryptVaultBytes,
  encryptVaultBytes,
  generateRecoveryKeyDisplay,
  hashRecoveryKeyHex,
  normalizeRecoveryKey,
} from "./registry_vault_staging.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function genId(prefix: string): string {
  const part =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${part}`;
}

function withStore(mutator: (store: StagingStore) => unknown): unknown {
  const store = readStagingStore();
  const result = mutator(store);
  writeStagingStore(store);
  return result;
}

function generateSetupToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveSetupToken(raw?: unknown): string {
  const s = String(raw || "").trim();
  if (!s || s === "staging-setup-token-32chars-min") {
    return generateSetupToken();
  }
  return s;
}

function sanitizeCenterId(cid: string): string {
  const s = String(cid || "").trim();
  if (!s || s === "moya-organizatsiya" || s === "center" || s === "staging-center" || !s.toUpperCase().startsWith("CTR-")) {
    return generateOpaqueCenterId();
  }
  return s;
}

function defaultSitePortal(store?: StagingStore) {
  const orgLabel = String(store?.installationMeta?.organization_label || store?.orgProfile?.display_name || "");
  const rawCid = slugifyCenterId(orgLabel);
  return {
    center_id: sanitizeCenterId(rawCid),
    setup_token: generateSetupToken(),
    inbox_login: "inbox-staging",
    inbox_password: "staging-pass-123",
    iconostasis_columns: 3,
    consult_booking_url: "",
    booking_mode: "prevention",
    public_site_origin: "",
    site_page_paths_json:
      '{"consult":"/specialists","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}',
    leads_export_webhook_url: "",
    privacy_policy_url: "",
    personal_data_agreement_url: "",
  };
}

function normalizeWorkLogEntry(row: Record<string, unknown>) {
  return {
    entry_id: String(row.entry_id || row.id || genId("wl")),
    case_id: String(row.case_id),
    action_kind: String(row.action_kind || "consultation"),
    minutes: Number(row.minutes) || 0,
    note: String(row.note || ""),
    created_at: String(row.created_at || Math.floor(Date.now() / 1000)),
  };
}

function normalizeSessionRecord(row: Record<string, unknown>) {
  return {
    record_id: String(row.record_id || row.id || genId("sess")),
    case_id: String(row.case_id),
    session_no: Number(row.session_no) || 0,
    content_json: String(row.content_json || "{}"),
    recorded_at: String(row.recorded_at || row.created_at || ""),
    created_at: String(row.created_at || ""),
  };
}

function isoWeekBucket(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekBucketFromEpoch(raw: string): string {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds)) return isoWeekBucket();
  return isoWeekBucket(new Date(seconds * 1000));
}

function currentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 9) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function buildStagingDashboardL1(store: StagingStore) {
  const org = store.orgProfile as Record<string, unknown> | null;
  const specialist = store.specialistProfile as Record<string, unknown> | null;
  const weekBucket = isoWeekBucket();
  const workLog = store.workLog.map((row) => normalizeWorkLogEntry(row));
  const consultations = workLog.filter((row) => row.action_kind === "consultation");
  const weekConsultations = consultations.filter(
    (row) => weekBucketFromEpoch(row.created_at) === weekBucket,
  );

  let elevatedRisk = 0;
  for (const entry of consultations) {
    const sessionRisk = parseConsultationSession(entry.note).progress.riskLevel;
    if (sessionRisk === "moderate" || sessionRisk === "high" || sessionRisk === "crisis") {
      elevatedRisk += 1;
      continue;
    }
    const parsed = parseWorkLogNote(entry.note);
    if (
      parsed.kind === "structured" &&
      (parsed.content.riskLevel === "moderate" ||
        parsed.content.riskLevel === "high" ||
        parsed.content.riskLevel === "crisis")
    ) {
      elevatedRisk += 1;
    }
  }

  const weekConsultationMinutes = weekConsultations.reduce((acc, row) => acc + row.minutes, 0);
  const weekActualMinutes = workLog
    .filter((row) => weekBucketFromEpoch(row.created_at) === weekBucket)
    .reduce((acc, row) => acc + row.minutes, 0);
  const weekContractMinutes = Number(specialist?.weekly_contract_minutes) || 0;
  const weekLoadPct =
    weekContractMinutes > 0 ? Math.round((weekActualMinutes * 100) / weekContractMinutes) : 0;

  return {
    specialist_name: String(specialist?.display_name || "Специалист"),
    org_name: String(org?.display_name || "Организация"),
    school_year: currentSchoolYear(),
    week_planned_minutes: weekActualMinutes,
    week_actual_minutes: weekActualMinutes,
    week_contract_minutes: weekContractMinutes,
    week_load_pct: weekLoadPct,
    week_consultation_count: weekConsultations.length,
    week_consultation_minutes: weekConsultationMinutes,
    total_consultation_count: consultations.length,
    elevated_risk_sessions: elevatedRisk,
    open_requests_count: 0,
    crisis_requests_count: 0,
    oldest_open_requests: [],
    active_cases_count: store.cases.length,
    cases_with_overdue_steps: [],
    year_plan_progress: [],
    group_sessions_count: store.groupSessions?.length ?? 0,
  };
}

function inPeriod(isoDate: string, periodStart: string, periodEnd: string): boolean {
  return isoDate >= periodStart && isoDate <= periodEnd;
}

function epochToIsoDate(raw: string): string {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds)) return new Date().toISOString().slice(0, 10);
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function buildStagingResearchMonthlyMetrics(
  store: StagingStore,
  periodStart: string,
  periodEnd: string,
) {
  const workLog = store.workLog.map((row) => normalizeWorkLogEntry(row));
  const consultations = workLog.filter(
    (row) =>
      row.action_kind === "consultation" &&
      inPeriod(epochToIsoDate(row.created_at), periodStart, periodEnd),
  );
  const workMinutes = workLog
    .filter((row) => inPeriod(epochToIsoDate(row.created_at), periodStart, periodEnd))
    .reduce((acc, row) => acc + row.minutes, 0);
  const groupSessions = (store.groupSessions || []).filter((row) => {
    const date = String((row as { session_date?: string }).session_date || "").slice(0, 10);
    return date && inPeriod(date, periodStart, periodEnd);
  });
  let elevatedRisk = 0;
  for (const entry of consultations) {
    const sessionRisk = parseConsultationSession(entry.note).progress.riskLevel;
    if (sessionRisk === "moderate" || sessionRisk === "high" || sessionRisk === "crisis") {
      elevatedRisk += 1;
      continue;
    }
    const parsed = parseWorkLogNote(entry.note);
    if (
      parsed.kind === "structured" &&
      (parsed.content.riskLevel === "moderate" ||
        parsed.content.riskLevel === "high" ||
        parsed.content.riskLevel === "crisis")
    ) {
      elevatedRisk += 1;
    }
  }
  const caseIds = new Set(
    workLog
      .filter((row) => inPeriod(epochToIsoDate(row.created_at), periodStart, periodEnd))
      .map((row) => row.case_id)
      .filter(Boolean),
  );
  const metrics: Record<string, number> = {
    consultation_count: consultations.length,
    work_minutes: workMinutes,
    group_session_count: groupSessions.length,
    active_cases: caseIds.size,
    elevated_risk_sessions: elevatedRisk,
  };
  for (const row of store.cases) {
    const id = String(row.id || "");
    if (!caseIds.has(id)) continue;
    const y = String((row as { y_level?: string }).y_level || "").trim();
    const x = String((row as { x_stage?: string }).x_stage || "").trim();
    if (y) {
      const key = `y_level_${y.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
      metrics[key] = (metrics[key] || 0) + 1;
    }
    if (x) {
      const key = `x_stage_${x.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
      metrics[key] = (metrics[key] || 0) + 1;
    }
  }
  return { metrics };
}

function collectStagingRegistrySubjects(store: StagingStore) {
  const out: Array<{
    case_id: string;
    created_at: string;
    updated_at: string;
    profile: Record<string, unknown>;
  }> = [];
  for (const row of store.cases) {
    try {
      const artifacts = JSON.parse(
        String((row as { case_artifacts_json?: string }).case_artifacts_json || "{}"),
      ) as { record_kind?: string; registry_profile?: Record<string, unknown> };
      if (artifacts.record_kind !== "registry_subject") continue;
      out.push({
        case_id: String(row.id || ""),
        created_at: String(row.created_at || ""),
        updated_at: String((row as { updated_at?: string }).updated_at || row.created_at || ""),
        profile: artifacts.registry_profile || {},
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

async function restoreStagingRegistryBackup(base64Data: string, recoveryKey: string) {
  const bytes = base64ToBytes(base64Data);
  const plain = await decryptVaultBytes(bytes, recoveryKey);
  const payload = JSON.parse(new TextDecoder().decode(plain)) as {
    subjects?: Array<{
      case_id: string;
      created_at: string;
      updated_at: string;
      profile: Record<string, unknown>;
    }>;
  };
  return withStore((store) => {
    let imported = 0;
    let skipped = 0;
    for (const subject of payload.subjects || []) {
      const caseId = String(subject.case_id || "").trim();
      if (!caseId) {
        skipped += 1;
        continue;
      }
      if (store.cases.some((c) => String(c.id) === caseId)) {
        skipped += 1;
        continue;
      }
      const fullName = String(subject.profile?.full_name || "").trim();
      if (!fullName) {
        skipped += 1;
        continue;
      }
      const artifacts = {
        record_kind: "registry_subject",
        registry_profile: subject.profile,
        situation_title: fullName,
      };
      store.cases.push({
        id: caseId,
        created_at: subject.created_at || String(Math.floor(Date.now() / 1000)),
        updated_at: subject.updated_at || subject.created_at || String(Math.floor(Date.now() / 1000)),
        case_artifacts_json: JSON.stringify(artifacts),
        y_level: "Y1_Normal",
        x_stage: "X1_Intake",
      });
      imported += 1;
    }
    return { imported, skipped };
  }) as { imported: number; skipped: number };
}

function buildStagingManagerDashboardL1(store: StagingStore) {
  const org = store.orgProfile as Record<string, unknown> | null;
  const month = new Date().toISOString().slice(0, 7);
  const gsCount = store.groupSessions?.length ?? 0;
  const progCount = store.organizationPrograms?.length ?? 0;
  return {
    org_name: String(org?.display_name || "Организация"),
    school_year: currentSchoolYear(),
    threats: [
      {
        category_key: "anxiety_fears",
        month,
        incidents: store.cases.length > 0 ? 1 : 0,
        severe_incidents: 0,
        avg_severity: 2,
      },
    ],
    prevention_levels: [
      {
        prevention_link: "L1_universal",
        month,
        planned_hours: 4,
        planned_reach: 0,
        actual_hours: progCount,
        actual_reach: progCount * 30,
      },
      {
        prevention_link: "L2_selective",
        month,
        planned_hours: 2,
        planned_reach: 0,
        actual_hours: gsCount,
        actual_reach: gsCount * 15,
      },
    ],
    monthly_severe: [{ month, severe_incidents: 0, elevated_consultations: 0 }],
    year_plan_progress: [],
    totals: {
      active_cases: store.cases.length,
      open_requests: store.requests?.length ?? 0,
      crisis_requests: 0,
      group_sessions_year: gsCount,
      organization_programs_year: progCount,
    },
  };
}

export async function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  switch (cmd) {
    case "db_list_profiles":
      return [{ slug: "staging", display_name: "Staging (без пароля)", is_initialized: true }] as T;

    case "db_profile_is_initialized":
      return true as T;

    case "db_create_profile":
      return {
        slug: "staging",
        display_name: String(args.displayName || "Staging"),
        is_initialized: false,
      } as T;

    case "db_unlock_profile":
      return withStore((store) => {
        store.unlocked = true;
        return null;
      }) as T;

    case "db_lock":
      resetStagingStore();
      return null as T;

    case "installation_get_meta":
      return readStagingStore().installationMeta as T;

    case "installation_save_meta": {
      const input = args.input as Record<string, unknown>;
      return withStore((store) => {
        const existing = store.installationMeta;
        const meta = {
          install_id: String(existing?.install_id || genId("inst")),
          country: String(input.country || "RU"),
          region: String(input.region || ""),
          municipality: String(input.municipality || ""),
          settlement: String(input.settlement || ""),
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          organization_type: String(input.organization_type || "school"),
          organization_label: String(input.organization_label || ""),
          org_unit_id: existing?.org_unit_id ?? null,
          org_unit_status: String(existing?.org_unit_status || "pending"),
          telemetry_consent: Boolean(input.telemetry_consent),
          created_at: String(existing?.created_at || nowIso()),
          updated_at: nowIso(),
        };
        store.installationMeta = meta;
        return meta;
      }) as T;
    }

    case "terminal_get_config":
      return readStagingStore().terminalConfig as T;

    case "terminal_save_config": {
      const input = args.input as TerminalConfigInput;
      return withStore((store) => {
        const existing = store.terminalConfig as Record<string, unknown> | null;
        const cfg = {
          terminal_user_id: String(existing?.terminal_user_id || genId("tu")),
          edition: input.edition,
          mode: input.mode,
          workspace_preset: input.workspace_preset,
          org_type: input.org_type,
          manager_scope: input.manager_scope ?? null,
          job_title: input.job_title,
          child_invite_code: input.child_invite_code,
          parent_invite_code: input.parent_invite_code,
          parent_invite_in: input.parent_invite_in,
          child_invite_in: input.child_invite_in,
          consumer_app: input.consumer_app,
          enabled_modules: input.enabled_modules,
          registry_enabled: input.registry_enabled,
          contact_email: input.contact_email ?? (existing?.contact_email as string | null | undefined) ?? null,
          research_contribution_enabled: Boolean(input.research_contribution_enabled),
          research_contribution_consented_at: input.research_contribution_consented_at ?? null,
          research_contribution_consent_version: input.research_contribution_consent_version ?? null,
          research_contribution_last_period_key: input.research_contribution_last_period_key ?? null,
          registry_vault_initialized: Boolean(input.registry_vault_initialized),
          registry_recovery_key_hash: input.registry_recovery_key_hash ?? null,
          onboarding_complete: true,
          created_at: String(existing?.created_at || nowIso()),
          updated_at: nowIso(),
        };
        store.terminalConfig = cfg;
        return cfg;
      }) as T;
    }

    case "terminal_restore_config": {
      // Restore a terminal config from a server-fetched node (account recovery after reset).
      // args.node: the safe_node object from /api/terminal/nodes/lookup-by-email
      // args.edition: current edition string
      // args.contactEmail: the email the user typed
      const node = args.node as Record<string, unknown>;
      const edition = String(args.edition || "ru");
      const contactEmail = String(args.contactEmail || node.contact_email || "");
      return withStore((store) => {
        const existing = store.terminalConfig as Record<string, unknown> | null;
        const cfg = {
          terminal_user_id: String(node.terminal_user_id || existing?.terminal_user_id || genId("tu")),
          edition,
          mode: String(node.mode || "manager"),
          workspace_preset: String(node.workspace_preset || "manager"),
          org_type: (node.org_type as string | null) ?? null,
          manager_scope: (node.manager_scope as string | null) ?? null,
          job_title: String((node.org_snapshot as Record<string, unknown>)?.job_title || ""),
          child_invite_code: String(node.child_invite_code || genId("CHILD")),
          parent_invite_code: (node.parent_invite_code as string | null) ?? null,
          parent_invite_in: null,
          child_invite_in: null,
          consumer_app: null,
          enabled_modules: (node.enabled_modules as Record<string, boolean>) || {},
          registry_enabled: false,
          contact_email: contactEmail || null,
          research_contribution_enabled: false,
          research_contribution_consented_at: null,
          research_contribution_consent_version: null,
          research_contribution_last_period_key: null,
          registry_vault_initialized: false,
          registry_recovery_key_hash: null,
          onboarding_complete: true,
          created_at: String(existing?.created_at || nowIso()),
          updated_at: nowIso(),
        };
        store.terminalConfig = cfg;
        // Restore org profile from snapshot
        const snap = (node.org_snapshot as Record<string, unknown>) || {};
        store.orgProfile = {
          display_name: String(node.organization_name || snap.organization_name || ""),
          isced_level: (snap.isced_level as string | null) ?? null,
          org_kind: (snap.org_kind as string | null) ?? "combined_school",
          normative_overrides: "{}",
          approx_learner_count: (snap.approx_learner_count as number | null) ?? null,
          org_sphere: (snap.org_sphere as string | null) ?? "education_system",
          org_sphere_other: (snap.org_sphere_other as string) ?? "",
          education_org_type: (snap.education_org_type as string | null) ?? null,
          approx_learner_ovz_count: (snap.approx_learner_ovz_count as number | null) ?? null,
        };
        store.specialistProfile = {
          display_name: cfg.job_title || "",
          role_text: cfg.job_title || "",
          weekly_contract_minutes: 0,
          rate_type: "fixed",
          rate_value: 0,
        };
        store.installationMeta = {
          install_id: cfg.terminal_user_id,
          country: "RU",
          region: "",
          municipality: "",
          settlement: String(node.settlement || ""),
          lat: null,
          lng: null,
          organization_type: cfg.org_type === "commercial" ? "commercial_center" : "school",
          organization_label: store.orgProfile.display_name,
          org_unit_id: null,
          org_unit_status: "pending",
          telemetry_consent: false,
          created_at: cfg.created_at,
          updated_at: cfg.updated_at,
        };
        return cfg;
      }) as T;
    }

    case "db_get_org_profile":
      return readStagingStore().orgProfile as T;

    case "db_save_org_profile":
      return withStore((store) => {
        store.orgProfile = args.payload as Record<string, unknown>;
        return null;
      }) as T;

    case "db_get_specialist_profile":
      return readStagingStore().specialistProfile as T;

    case "db_save_specialist_profile":
      return withStore((store) => {
        store.specialistProfile = args.payload as Record<string, unknown>;
        return null;
      }) as T;

    case "db_get_case_ai_context": {
      const caseId = String(args.caseId || "");
      const found = readStagingStore().cases.find((c) => c.id === caseId);
      if (!found) return null as T;
      return {
        notesSanitized: String((found as { notes?: string }).notes || ""),
        yLevel: "Y3_Normal",
        xStage: "X2_Diag",
        topicTags: "[]",
      } as T;
    }

    case "db_get_case_artifacts": {
      const caseId = String(args.caseId || "");
      const found = readStagingStore().cases.find((c) => c.id === caseId);
      if (!found) return "{}" as T;
      return String((found as { case_artifacts_json?: string }).case_artifacts_json || "{}") as T;
    }

    case "db_update_case_artifacts":
      return withStore((store) => {
        const caseId = String(args.caseId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const json = String(payload.case_artifacts_json || "{}");
        const row = store.cases.find((c) => c.id === caseId);
        if (row) {
          (row as { case_artifacts_json?: string }).case_artifacts_json = json;
        } else {
          store.cases.push({
            id: caseId,
            created_at: nowIso(),
            case_artifacts_json: json,
          });
        }
        return null;
      }) as T;

    case "db_list_case_participants": {
      const caseId = String(args.caseId || "");
      const store = readStagingStore();
      const aliases = store.caseAliases || [];
      return aliases
        .filter((a) => String(a.case_id) === caseId)
        .map((a) => ({
          alias_id: String(a.alias_id || ""),
          role: String(a.role || "other"),
          role_no: Number(a.role_no) || 1,
        })) as T;
    }

    case "db_list_case_aliases_local": {
      const caseId = String(args.caseId || "");
      const aliases = readStagingStore().caseAliases || [];
      return aliases
        .filter((a) => String(a.case_id) === caseId)
        .map((a) => ({
          alias_id: String(a.alias_id || ""),
          role: String(a.role || "other"),
          role_no: Number(a.role_no) || 1,
          real_name: String(a.real_name || ""),
        })) as T;
    }

    case "db_list_case_summaries":
      return readStagingStore().cases
        .map((row) => {
          const id = String(row.id || "");
          let title = "";
          let kind = "";
          try {
            const artifacts = JSON.parse(String((row as { case_artifacts_json?: string }).case_artifacts_json || "{}"));
            title = String(artifacts.situation_title || "");
            kind = String(artifacts.situation_kind || "");
          } catch {
            /* ignore */
          }
          const participant_count = (readStagingStore().caseAliases || []).filter(
            (a) => String(a.case_id) === id,
          ).length;
          return {
            case_id: id,
            situation_title: title || `Кейс ${id.slice(0, 8)}`,
            situation_kind: kind,
            participant_count,
            y_level: String((row as { y_level?: string }).y_level || "Y1_Normal"),
            x_stage: String((row as { x_stage?: string }).x_stage || "X1_Intake"),
            created_at: String(row.created_at || ""),
            updated_at: String((row as { updated_at?: string }).updated_at || row.created_at || ""),
          };
        })
        .sort((a, b) => `${b.updated_at}${b.created_at}`.localeCompare(`${a.updated_at}${a.created_at}`)) as T;

    case "db_insert_case": {
      const caseId = String(args.caseId || genId("case"));
      const rawAliases = Array.isArray(args.aliases) ? (args.aliases as Record<string, unknown>[]) : [];
      withStore((store) => {
        store.cases.push({
          id: caseId,
          created_at: nowIso(),
          taxonomy: args.taxonomyPassportJson,
          notes: String(args.notesSanitized || ""),
          case_artifacts_json: "{}",
          participant_count: rawAliases.length,
        });
        if (!store.caseAliases) store.caseAliases = [];
        for (const a of rawAliases) {
          store.caseAliases.push({
            case_id: caseId,
            alias_id: String(a.alias_id || genId("alias")),
            role: String(a.role || "client"),
            role_no: Number(a.role_no) || 1,
            real_name: String(a.real_name || ""),
          });
        }
      });
      return caseId as T;
    }

    case "db_list_session_records":
      return readStagingStore().sessionRecords
        .filter((row) => String(row.case_id) === String(args.caseId))
        .map((row) => normalizeSessionRecord(row)) as T;

    case "db_add_session_record":
      return withStore((store) => {
        const caseId = String(args.caseId);
        const isInitial = Boolean(args.isInitial);
        const existing = store.sessionRecords.filter((row) => String(row.case_id) === caseId);
        const sessionNo = isInitial
          ? 0
          : existing.reduce((max, row) => Math.max(max, Number(row.session_no) || 0), 0) + 1;
        const now = Math.floor(Date.now() / 1000).toString();
        store.sessionRecords.push({
          record_id: String(args.recordId || genId("sess")),
          case_id: caseId,
          session_no: sessionNo,
          content_json: String(args.contentJson || "{}"),
          recorded_at: now,
          created_at: now,
        });
        return null;
      }) as T;

    case "db_list_work_log_entries":
      return readStagingStore().workLog
        .filter((row) => String(row.case_id) === String(args.caseId))
        .map((row) => normalizeWorkLogEntry(row)) as T;

    case "db_add_work_log_entry":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        store.workLog.push({
          entry_id: String(args.entryId || genId("wl")),
          case_id: String(args.caseId),
          action_kind: String(args.actionKind || "consultation"),
          minutes: Number(args.minutes) || 0,
          note: String(args.note || ""),
          created_at: now,
        });
        return null;
      }) as T;

    case "db_update_work_log_entry":
      return withStore((store) => {
        const entryId = String(args.entryId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const row = store.workLog.find((item) => String(item.entry_id) === entryId);
        if (!row) throw new Error("work log entry not found");
        if (payload.minutes != null) row.minutes = Number(payload.minutes);
        if (payload.note != null) row.note = String(payload.note);
        return null;
      }) as T;

    case "db_list_group_sessions":
      return [...readStagingStore().groupSessions]
        .map((row) => ({
          session_id: String(row.session_id || row.id || ""),
          title: String(row.title || ""),
          session_date: String(row.session_date || ""),
          duration_minutes: Number(row.duration_minutes) || 0,
          theme: String(row.theme || ""),
          notes: String(row.notes || ""),
          plan_text: String(row.plan_text || ""),
          report_text: String(row.report_text || ""),
          audience_json: String(row.audience_json || "{}"),
          artifacts_json: String(row.artifacts_json || "{}"),
          prevention_link: String(row.prevention_link || "L1_universal"),
          prevention_work_types_json: String(row.prevention_work_types_json || "{}"),
          session_tags_json: String(row.session_tags_json || "{}"),
          created_at: String(row.created_at || ""),
          updated_at: String(row.updated_at || row.created_at || ""),
        }))
        .sort((a, b) =>
          `${b.session_date}${b.updated_at}`.localeCompare(`${a.session_date}${a.updated_at}`),
        ) as T;

    case "db_add_group_session":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        store.groupSessions.push({
          session_id: String(args.sessionId || genId("gs")),
          title: String(args.title || "").trim(),
          session_date: String(args.sessionDate || "").trim(),
          duration_minutes: Number(args.durationMinutes) || 0,
          theme: String(args.theme || "").trim(),
          notes: String(args.notes || "").trim(),
          plan_text: "",
          report_text: "",
          audience_json: "{}",
          artifacts_json: "{}",
          prevention_link: "L1_universal",
          prevention_work_types_json: "{}",
          session_tags_json: "{}",
          created_at: now,
          updated_at: now,
        });
        return null;
      }) as T;

    case "db_update_group_session":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const sessionId = String(args.sessionId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const row = store.groupSessions.find((item) => String(item.session_id) === sessionId);
        if (!row) throw new Error("group session not found");
        if (payload.title != null) row.title = String(payload.title);
        if (payload.session_date != null) row.session_date = String(payload.session_date);
        if (payload.duration_minutes != null) row.duration_minutes = Number(payload.duration_minutes);
        if (payload.theme != null) row.theme = String(payload.theme);
        if (payload.notes != null) row.notes = String(payload.notes);
        if (payload.plan_text != null) row.plan_text = String(payload.plan_text);
        if (payload.report_text != null) row.report_text = String(payload.report_text);
        if (payload.audience_json != null) row.audience_json = String(payload.audience_json);
        if (payload.artifacts_json != null) row.artifacts_json = String(payload.artifacts_json);
        if (payload.prevention_link != null) row.prevention_link = String(payload.prevention_link);
        if (payload.prevention_work_types_json != null) {
          row.prevention_work_types_json = String(payload.prevention_work_types_json);
        }
        if (payload.session_tags_json != null) {
          row.session_tags_json = String(payload.session_tags_json);
        }
        row.updated_at = now;
        return null;
      }) as T;

    case "db_list_work_entries": {
      const kinds = Array.isArray(args.activityKinds)
        ? (args.activityKinds as unknown[]).map((k) => String(k))
        : [];
      const fromDate = args.fromDate ? String(args.fromDate) : "";
      const toDate = args.toDate ? String(args.toDate) : "";
      return [...readStagingStore().workEntries]
        .filter((row) => {
          const kind = String(row.activity_kind || "");
          if (kinds.length && !kinds.includes(kind)) return false;
          const date = String(row.work_date || "");
          if (fromDate && date < fromDate) return false;
          if (toDate && date > toDate) return false;
          return true;
        })
        .map((row) => ({
          entry_id: String(row.entry_id || ""),
          work_date: String(row.work_date || ""),
          minutes_actual: Number(row.minutes_actual) || 0,
          activity_kind: String(row.activity_kind || "admin_other"),
          effort_phase: String(row.effort_phase || ""),
          title: String(row.title || ""),
          notes: String(row.notes || ""),
          subject_label: String(row.subject_label || ""),
          case_id: row.case_id ? String(row.case_id) : null,
          plan_id: row.plan_id ? String(row.plan_id) : null,
          audience_note: String(row.audience_note || ""),
          audience_contingent: String(row.audience_contingent || ""),
          time_start: String(row.time_start || ""),
          time_end: String(row.time_end || ""),
          referrer: String(row.referrer || ""),
          visit_kind: String(row.visit_kind || ""),
          anonymous_code: String(row.anonymous_code || ""),
          event_form: String(row.event_form || ""),
          diagnostic_kind: String(row.diagnostic_kind || ""),
          co_executors_text: String(row.co_executors_text || ""),
          created_at: String(row.created_at || ""),
          updated_at: String(row.updated_at || row.created_at || ""),
        }))
        .sort((a, b) =>
          `${b.work_date}${b.updated_at}`.localeCompare(`${a.work_date}${a.updated_at}`),
        ) as T;
    }

    case "db_add_work_entry":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        store.workEntries.push({
          entry_id: String(args.entryId || genId("we")),
          work_date: String(args.workDate || "").trim(),
          minutes_actual: Number(args.minutesActual) || 0,
          activity_kind: String(args.activityKind || "admin_other"),
          effort_phase: String(args.effortPhase || ""),
          title: String(args.title || "").trim(),
          notes: String(args.notes || "").trim(),
          subject_label: String(args.subjectLabel || "").trim(),
          case_id: args.caseId ? String(args.caseId) : null,
          plan_id: args.planId ? String(args.planId) : null,
          audience_note: String(args.audienceNote || ""),
          audience_contingent: String(args.audienceContingent || ""),
          time_start: String(args.timeStart || ""),
          time_end: String(args.timeEnd || ""),
          referrer: String(args.referrer || ""),
          visit_kind: String(args.visitKind || ""),
          anonymous_code: String(args.anonymousCode || ""),
          event_form: String(args.eventForm || ""),
          diagnostic_kind: String(args.diagnosticKind || ""),
          co_executors_text: String(args.coExecutorsText || ""),
          created_at: now,
          updated_at: now,
        });
        return null;
      }) as T;

    case "db_update_work_entry":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const entryId = String(args.entryId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const row = store.workEntries.find((item) => String(item.entry_id) === entryId);
        if (!row) throw new Error("work entry not found");
        const set = (key: string, val: unknown) => {
          if (val != null) row[key] = val;
        };
        set("work_date", payload.work_date);
        set("minutes_actual", payload.minutes_actual);
        set("activity_kind", payload.activity_kind);
        set("effort_phase", payload.effort_phase);
        set("title", payload.title);
        set("notes", payload.notes);
        set("subject_label", payload.subject_label);
        if (payload.case_id !== undefined) row.case_id = payload.case_id;
        if (payload.plan_id !== undefined) row.plan_id = payload.plan_id;
        set("audience_note", payload.audience_note);
        set("audience_contingent", payload.audience_contingent);
        set("time_start", payload.time_start);
        set("time_end", payload.time_end);
        set("referrer", payload.referrer);
        set("visit_kind", payload.visit_kind);
        set("anonymous_code", payload.anonymous_code);
        set("event_form", payload.event_form);
        set("diagnostic_kind", payload.diagnostic_kind);
        set("co_executors_text", payload.co_executors_text);
        row.updated_at = now;
        return null;
      }) as T;

    case "db_delete_work_entry":
      return withStore((store) => {
        const entryId = String(args.entryId || "");
        const before = store.workEntries.length;
        store.workEntries = store.workEntries.filter((item) => String(item.entry_id) !== entryId);
        if (store.workEntries.length === before) throw new Error("work entry not found");
        return null;
      }) as T;

    case "db_list_organization_programs":
      return [...(readStagingStore().organizationPrograms || [])]
        .map((row) => ({
          program_id: String(row.program_id || ""),
          title: String(row.title || ""),
          program_year: String(row.program_year || ""),
          scope: String(row.scope || ""),
          notes: String(row.notes || ""),
          plan_text: String(row.plan_text || ""),
          report_text: String(row.report_text || ""),
          artifacts_json: String(row.artifacts_json || "{}"),
          audience_json: String(row.audience_json || "{}"),
          prevention_link: String(row.prevention_link || ""),
          prevention_work_types_json: String(row.prevention_work_types_json || "{}"),
          created_at: String(row.created_at || ""),
          updated_at: String(row.updated_at || row.created_at || ""),
        }))
        .sort((a, b) =>
          `${b.program_year}${b.updated_at}`.localeCompare(`${a.program_year}${a.updated_at}`),
        ) as T;

    case "db_add_organization_program":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        if (!store.organizationPrograms) store.organizationPrograms = [];
        store.organizationPrograms.push({
          program_id: String(args.programId || genId("op")),
          title: String(args.title || "").trim(),
          program_year: String(args.programYear || "").trim(),
          scope: String(args.scope || "").trim(),
          notes: String(args.notes || "").trim(),
          plan_text: "",
          report_text: "",
          artifacts_json: "{}",
          audience_json: "{}",
          prevention_link: "",
          prevention_work_types_json: "{}",
          created_at: now,
          updated_at: now,
        });
        return null;
      }) as T;

    case "db_update_organization_program":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const programId = String(args.programId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const row = (store.organizationPrograms || []).find(
          (item) => String(item.program_id) === programId,
        );
        if (!row) throw new Error("organization program not found");
        if (payload.title != null) row.title = String(payload.title);
        if (payload.program_year != null) row.program_year = String(payload.program_year);
        if (payload.scope != null) row.scope = String(payload.scope);
        if (payload.notes != null) row.notes = String(payload.notes);
        if (payload.plan_text != null) row.plan_text = String(payload.plan_text);
        if (payload.report_text != null) row.report_text = String(payload.report_text);
        if (payload.artifacts_json != null) row.artifacts_json = String(payload.artifacts_json);
        if (payload.audience_json != null) row.audience_json = String(payload.audience_json);
        if (payload.prevention_link != null) row.prevention_link = String(payload.prevention_link);
        if (payload.prevention_work_types_json != null) {
          row.prevention_work_types_json = String(payload.prevention_work_types_json);
        }
        row.updated_at = now;
        return null;
      }) as T;

    case "db_list_iprs":
      return [...readStagingStore().iprs]
        .filter((row) => String(row.case_id) === String(args.caseId))
        .map((row) => ({
          id: String(row.id || ""),
          case_id: String(row.case_id || ""),
          title: String(row.title || ""),
          description: String(row.description || ""),
          status: String(row.status || "draft"),
          plan_text: String(row.plan_text || ""),
          report_text: String(row.report_text || ""),
          artifacts_json: String(row.artifacts_json || "{}"),
          audience_json: String(row.audience_json || "{}"),
          session_tags_json: String(row.session_tags_json || "{}"),
          created_at: String(row.created_at || ""),
          updated_at: String(row.updated_at || ""),
        }))
        .sort((a, b) => `${b.updated_at}${b.id}`.localeCompare(`${a.updated_at}${a.id}`)) as T;

    case "db_create_ipr":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const payload = (args.payload || {}) as Record<string, unknown>;
        const id = genId("ipr");
        store.iprs.push({
          id,
          case_id: String(payload.case_id || payload.caseId || ""),
          title: String(payload.title || "").trim(),
          description: String(payload.description || "").trim(),
          status: "draft",
          plan_text: "",
          report_text: "",
          artifacts_json: "{}",
          audience_json: "{}",
          session_tags_json: "{}",
          created_at: now,
          updated_at: now,
        });
        return id;
      }) as T;

    case "db_update_ipr":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const iprId = String(args.iprId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const row = store.iprs.find((item) => String(item.id) === iprId);
        if (!row) throw new Error("ipr not found");
        if (payload.title != null) row.title = String(payload.title);
        if (payload.description != null) row.description = String(payload.description);
        if (payload.status != null) row.status = String(payload.status);
        if (payload.plan_text != null) row.plan_text = String(payload.plan_text);
        if (payload.report_text != null) row.report_text = String(payload.report_text);
        if (payload.artifacts_json != null) row.artifacts_json = String(payload.artifacts_json);
        if (payload.audience_json != null) row.audience_json = String(payload.audience_json);
        if (payload.session_tags_json != null) row.session_tags_json = String(payload.session_tags_json);
        row.updated_at = now;
        return null;
      }) as T;

    case "db_list_ipr_steps":
      return [...readStagingStore().iprSteps]
        .filter((row) => String(row.ipr_id) === String(args.iprId))
        .map((row) => ({
          id: String(row.id || ""),
          ipr_id: String(row.ipr_id || ""),
          order_no: Number(row.order_no) || 0,
          title: String(row.title || ""),
          description: String(row.description || ""),
          target_date: row.target_date ? String(row.target_date) : null,
          status: String(row.status || "planned"),
          created_at: String(row.created_at || ""),
          updated_at: String(row.updated_at || ""),
        }))
        .sort((a, b) => a.order_no - b.order_no || a.id.localeCompare(b.id)) as T;

    case "db_add_ipr_step":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const payload = (args.payload || {}) as Record<string, unknown>;
        const iprId = String(payload.ipr_id || payload.iprId || "");
        const siblings = store.iprSteps.filter((row) => String(row.ipr_id) === iprId);
        const nextOrder = siblings.reduce((max, row) => Math.max(max, Number(row.order_no) || 0), -1) + 1;
        const id = genId("step");
        store.iprSteps.push({
          id,
          ipr_id: iprId,
          order_no: nextOrder,
          title: String(payload.title || "").trim(),
          description: String(payload.description || "").trim(),
          target_date: payload.target_date || payload.targetDate || null,
          status: "planned",
          created_at: now,
          updated_at: now,
        });
        const ipr = store.iprs.find((row) => String(row.id) === iprId);
        if (ipr) ipr.updated_at = now;
        return id;
      }) as T;

    case "db_update_ipr_step":
      return withStore((store) => {
        const now = Math.floor(Date.now() / 1000).toString();
        const stepId = String(args.stepId || "");
        const payload = (args.payload || {}) as Record<string, unknown>;
        const row = store.iprSteps.find((item) => String(item.id) === stepId);
        if (!row) throw new Error("ipr_step not found");
        if (payload.title != null) row.title = String(payload.title);
        if (payload.description != null) row.description = String(payload.description);
        if (payload.status != null) row.status = String(payload.status);
        if (payload.target_date !== undefined) {
          row.target_date = payload.target_date || null;
        }
        row.updated_at = now;
        const ipr = store.iprs.find((item) => String(item.id) === String(row.ipr_id));
        if (ipr) ipr.updated_at = now;
        return null;
      }) as T;

    case "db_delete_ipr_step":
      return withStore((store) => {
        const stepId = String(args.stepId || "");
        const idx = store.iprSteps.findIndex((item) => String(item.id) === stepId);
        if (idx < 0) throw new Error("ipr_step not found");
        store.iprSteps.splice(idx, 1);
        return null;
      }) as T;

    case "db_dashboard_l1":
      return buildStagingDashboardL1(readStagingStore()) as T;

    case "db_research_monthly_metrics":
      return buildStagingResearchMonthlyMetrics(
        readStagingStore(),
        String(args.periodStart || ""),
        String(args.periodEnd || ""),
      ) as T;

    case "db_manager_dashboard_l1":
      return buildStagingManagerDashboardL1(readStagingStore()) as T;

    case "db_create_request":
      return withStore((store) => {
        const id = genId("req");
        store.requests.push({ id, created_at: nowIso(), payload: args });
        return id;
      }) as T;

    case "inbox_server_status":
      return {
        running: false,
        port: 47831,
        inbox_url: "http://127.0.0.1:47831/api/inbox",
        health_url: "http://127.0.0.1:47831/api/inbox/health",
        inbox_viewer_url: "http://127.0.0.1:47831/inbox-viewer.html",
        message: "staging: локальный inbox выключен",
      } as T;

    case "inbox_list_leads": {
      const store = readStagingStore();
      const centerId = args.centerId != null ? String(args.centerId) : "";
      const limit = Math.max(1, Number(args.limit) || 50);
      const rows = Array.isArray(store.leads) ? store.leads : [];
      const filtered = rows
        .filter((row) => !centerId || String(row.center_id || "") === centerId)
        .map((row) => ({
          id: String(row.id || ""),
          center_id: String(row.center_id || ""),
          name: String(row.name || ""),
          contact: String(row.contact || ""),
          specialist_id: row.specialist_id != null ? String(row.specialist_id) : null,
          intake_json: String(row.intake_json || "{}"),
          source: row.source != null ? String(row.source) : null,
          user_id: row.user_id != null ? String(row.user_id) : null,
          status: String(row.status || "new"),
          created_at: String(row.created_at || ""),
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
      return filtered as T;
    }

    case "inbox_update_lead_status":
      return withStore((store) => {
        if (!store.leads) store.leads = [];
        const leadId = String(args.leadId || "");
        const status = String(args.status || "new");
        const row = store.leads.find((item) => String(item.id) === leadId);
        if (row) row.status = status;
        return null;
      }) as T;

    case "site_portal_get": {
      const store = readStagingStore();
      const p = store.sitePortal || defaultSitePortal(store);
      if (p.setup_token === "staging-setup-token-32chars-min") {
        p.setup_token = generateSetupToken();
        withStore((s) => {
          s.sitePortal = p;
        });
      }
      return p as T;
    }

    case "site_portal_ensure": {
      const orgName = String(args.organizationName || "");
      const centerId = String(args.centerId || "").trim();
      const setupToken = String(args.setupToken || "").trim();
      return withStore((store) => {
        const existing = (store.sitePortal || {}) as Record<string, unknown>;
        const cid = sanitizeCenterId(
          String(existing.center_id || "").trim() ||
          centerId ||
          slugifyCenterId(orgName)
        );
        const cfg = {
          center_id: cid,
          setup_token: setupToken || resolveSetupToken(existing.setup_token),
          inbox_login: String(existing.inbox_login || "inbox-staging"),
          inbox_password: String(existing.inbox_password || "staging-pass-123"),
          iconostasis_columns: Number(existing.iconostasis_columns) || 3,
          consult_booking_url: String(existing.consult_booking_url || ""),
          booking_mode: existing.booking_mode === "external" ? "external" : "prevention",
          public_site_origin: String(existing.public_site_origin || ""),
          site_page_paths_json: String(
            existing.site_page_paths_json ||
              '{"consult":"/specialists","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}',
          ),
          leads_export_webhook_url: String(existing.leads_export_webhook_url || ""),
          privacy_policy_url: String(existing.privacy_policy_url || ""),
          personal_data_agreement_url: String(existing.personal_data_agreement_url || ""),
        };
        store.sitePortal = cfg;
        return cfg;
      }) as T;
    }

    case "site_portal_update":
      return withStore((store) => {
        const existing = (store.sitePortal || defaultSitePortal(store)) as Record<string, unknown>;
        const patch = args as Record<string, unknown>;
        const next = {
          center_id: patch.centerId != null ? String(patch.centerId).trim() : String(existing.center_id || "staging-center"),
          setup_token: patch.setupToken != null ? String(patch.setupToken).trim() : resolveSetupToken(existing.setup_token),
          inbox_login:
            patch.inboxLogin != null ? String(patch.inboxLogin).trim() : String(existing.inbox_login || ""),
          inbox_password:
            patch.inboxPassword != null
              ? String(patch.inboxPassword).trim()
              : String(existing.inbox_password || ""),
          iconostasis_columns:
            patch.iconostasisColumns != null
              ? Number(patch.iconostasisColumns)
              : Number(existing.iconostasis_columns) || 3,
          consult_booking_url:
            patch.consultBookingUrl != null
              ? String(patch.consultBookingUrl).trim()
              : String(existing.consult_booking_url || ""),
          booking_mode:
            patch.bookingMode != null
              ? String(patch.bookingMode) === "external"
                ? "external"
                : "prevention"
              : existing.booking_mode === "external"
                ? "external"
                : "prevention",
          public_site_origin:
            patch.publicSiteOrigin != null
              ? String(patch.publicSiteOrigin).trim().replace(/\/+$/, "")
              : String(existing.public_site_origin || ""),
          site_page_paths_json:
            patch.sitePagePathsJson != null
              ? String(patch.sitePagePathsJson).trim()
              : String(
                  existing.site_page_paths_json ||
                    '{"consult":"/specialists","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}',
                ),
          leads_export_webhook_url:
            patch.leadsExportWebhookUrl != null
              ? String(patch.leadsExportWebhookUrl).trim()
              : String(existing.leads_export_webhook_url || ""),
          privacy_policy_url:
            patch.privacyPolicyUrl != null
              ? String(patch.privacyPolicyUrl).trim()
              : String(existing.privacy_policy_url || ""),
          personal_data_agreement_url:
            patch.personalDataAgreementUrl != null
              ? String(patch.personalDataAgreementUrl).trim()
              : String(existing.personal_data_agreement_url || ""),
        };
        if (next.booking_mode === "external" && !next.consult_booking_url) {
          throw new Error("consult_booking_url_required");
        }
        store.sitePortal = next;
        return next;
      }) as T;

    case "app_version":
      return "staging-web" as T;

    case "registry_generate_recovery_key":
      return generateRecoveryKeyDisplay() as T;

    case "registry_recovery_key_hash": {
      const norm = normalizeRecoveryKey(String(args.recoveryKey || ""));
      if (norm.length !== 64) throw new Error("invalid_recovery_key");
      return (await hashRecoveryKeyHex(norm)) as T;
    }

    case "registry_export_backup": {
      const recoveryKey = String(args.recoveryKey || "");
      const store = readStagingStore();
      const subjects = collectStagingRegistrySubjects(store);
      const exportedAt = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        format: "prevention_registry_vault",
        version: 1,
        exported_at: exportedAt,
        subjects,
      });
      const enc = await encryptVaultBytes(new TextEncoder().encode(payload), recoveryKey);
      return bytesToBase64(enc) as T;
    }

    case "registry_verify_backup": {
      const bytes = base64ToBytes(String(args.base64Data || ""));
      const plain = await decryptVaultBytes(bytes, String(args.recoveryKey || ""));
      const payload = JSON.parse(new TextDecoder().decode(plain)) as {
        subjects?: unknown[];
        exported_at?: string;
      };
      return {
        ok: true,
        subject_count: Array.isArray(payload.subjects) ? payload.subjects.length : 0,
        exported_at: String(payload.exported_at || ""),
      } as T;
    }

    case "registry_restore_backup":
      return (await restoreStagingRegistryBackup(
        String(args.base64Data || ""),
        String(args.recoveryKey || ""),
      )) as T;

    case "db_list_calendar_slots": {
      const caseId = args.caseId ? String(args.caseId) : null;
      const startEpoch = Number(args.startEpoch) || 0;
      const endEpoch = Number(args.endEpoch) || Infinity;
      let slots = readStagingStore().calendarSlots || [];
      if (caseId) {
        slots = slots.filter((s) => String(s.case_id) === caseId);
      }
      if (args.startEpoch || args.endEpoch) {
        slots = slots.filter((s) => {
          const t = Number(s.start_time) || 0;
          return t >= startEpoch && t <= endEpoch;
        });
      }
      return slots as T;
    }

    case "db_save_calendar_slot":
      return withStore((store) => {
        if (!store.calendarSlots) store.calendarSlots = [];
        const payload = (args.slot || {}) as Record<string, unknown>;
        const id = String(payload.slot_id || genId("slot"));
        const idx = store.calendarSlots.findIndex((s) => String(s.slot_id) === id);
        const slot = {
          slot_id: id,
          case_id: String(payload.case_id || ""),
          specialist_id: String(payload.specialist_id || ""),
          start_time: Number(payload.start_time) || 0,
          end_time: Number(payload.end_time) || 0,
          buffer_minutes: Number(payload.buffer_minutes) || 0,
          recurrence_weeks: Number(payload.recurrence_weeks) || 0,
          visit_status: String(payload.visit_status || "scheduled"),
          client_name: String(payload.client_name || ""),
          notes: String(payload.notes || ""),
        };
        if (idx >= 0) {
          store.calendarSlots[idx] = slot;
        } else {
          store.calendarSlots.push(slot);
        }
        return slot;
      }) as T;

    case "db_delete_calendar_slot":
      return withStore((store) => {
        if (!store.calendarSlots) store.calendarSlots = [];
        const id = String(args.slotId);
        store.calendarSlots = store.calendarSlots.filter((s) => String(s.slot_id) !== id);
        return null;
      }) as T;

    case "save_vault_backup":
    case "read_vault_backup_file":
      return null as T;

    case "save_docx":
      return null as T;

    default:
      throw new Error(`[staging] unsupported command: ${cmd}`);
  }
}
