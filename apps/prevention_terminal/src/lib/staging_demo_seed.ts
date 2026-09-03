/**
 * Buyer-facing demo seed for web staging (?demo=1 / ?demo=manager).
 * Fictional commercial center — all names and contacts are synthetic.
 */

import { defaultEnabledModules } from "./terminal_config.ts";
import { getTerminalEdition } from "./terminal_edition.ts";
import {
  readStagingStore,
  writeStagingStore,
  writeStagingAiPreview,
  emptyStore,
  type StagingStore,
} from "./web_staging.ts";
import { buildSchoolDemoStore } from "./staging_demo_school_seed.ts";

export const DEMO_SEED_VERSION = "ida-demo-v7-intl";
export const DEMO_FLAG_KEY = "prevention_terminal_demo_flag";
export const DEMO_VERSION_KEY = "prevention_terminal_demo_version";

export type DemoWorkspace = "specialist" | "manager" | "school" | "authority";

function daysAgoEpoch(days: number, hour = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return String(Math.floor(d.getTime() / 1000));
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function emptyTags(themes: string[], methods: string[] = ["cbt"]) {
  return {
    themes: { catalog: themes, custom: [] as string[] },
    formats: { catalog: ["individual"] as string[], custom: [] as string[] },
    methods: { catalog: methods, custom: [] as string[] },
    techniques: { catalog: [] as string[], custom: [] as string[] },
  };
}

function consultationNote(args: {
  goal: string;
  observations: string;
  intervention: string;
  assessment: string;
  plan: string;
  risk?: string;
  themes: string[];
  methods?: string[];
  visitDate: string;
}): string {
  return JSON.stringify({
    format: "consultation_session_v1",
    templatePreset: "dap",
    goal: args.goal,
    observations: args.observations,
    intervention: args.intervention,
    assessmentResponse: args.assessment,
    plan: args.plan,
    modality: "in_person",
    riskLevel: args.risk || "low",
    visitDate: args.visitDate,
    sessionTags: emptyTags(args.themes, args.methods),
    artifacts: {},
  });
}

function readDemoParam(): DemoWorkspace | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("demo");
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  const host = window.location.hostname;
  const isIdaHost = host.includes("ida-ai.chat") || host.includes("ida.chat");
  if (isIdaHost) {
    if (v === "manager") return "manager";
    return "specialist";
  }
  if (v === "manager") return "manager";
  if (v === "school") return "school";
  if (v === "authority") return "authority";
  if (v === "" || v === "1" || v === "true" || v === "yes" || v === "specialist") {
    if (host.includes("prevention.school")) {
      return "school";
    }
    return "specialist";
  }
  return null;
}

export function isDemoModeRequested(): boolean {
  return readDemoParam() != null;
}

export function isDemoModeActive(): boolean {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("entry") || params.has("org") || params.has("preset")) {
      return false;
    }
  }
  if (typeof localStorage === "undefined") return false;
  try {
    if (localStorage.getItem(DEMO_FLAG_KEY)) return true;
  } catch {
    /* ignore */
  }
  return isDemoModeRequested();
}

export function readDemoWorkspace(): DemoWorkspace {
  const fromUrl = readDemoParam();
  if (fromUrl) return fromUrl;
  if (typeof localStorage === "undefined") return "specialist";
  try {
    const stored = localStorage.getItem(DEMO_FLAG_KEY);
    if (stored === "manager") return "manager";
    if (stored === "school") return "school";
    if (stored === "authority") return "authority";
  } catch {
    /* ignore */
  }
  return "specialist";
}

function markDemoActive(workspace: DemoWorkspace): void {
  if (typeof localStorage === "undefined") return;
  const flag = workspace === "manager" ? "manager"
    : workspace === "school" ? "school"
    : workspace === "authority" ? "authority"
    : "1";
  localStorage.setItem(DEMO_FLAG_KEY, flag);
  localStorage.setItem(DEMO_VERSION_KEY, DEMO_SEED_VERSION);
}

export function clearDemoFlags(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_VERSION_KEY);
}

function needsReseed(workspace: DemoWorkspace): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    if (localStorage.getItem(DEMO_VERSION_KEY) !== DEMO_SEED_VERSION) return true;
    const storedFlag = localStorage.getItem(DEMO_FLAG_KEY);
    const expectedFlag = workspace === "manager" ? "manager"
      : workspace === "school" ? "school"
      : workspace === "authority" ? "authority"
      : "1";
    if (storedFlag !== expectedFlag) return true;

    const store = readStagingStore();
    if (!store.terminalConfig || !store.orgProfile) return true;
    if (!(store.cases || []).length) return true;
    
    // Also reseed if stored edition does not match current runtime edition
    const currentEdition = getTerminalEdition();
    const storedEdition = (store.terminalConfig as { edition?: string }).edition;
    if (storedEdition !== currentEdition) return true;

    return false;
  } catch {
    return true;
  }
}

function buildDemoStore(workspace: DemoWorkspace): StagingStore {
  const edition = getTerminalEdition();
  const isManager = workspace === "manager";
  const modules = defaultEnabledModules(
    isManager ? "manager" : "specialist",
    "commercial",
    isManager ? "manager" : "specialist",
  );
  modules.embed_client_widget = true;
  modules.consultation_journal = true;
  modules.reception_journal = true;
  modules.group_sessions = true;
  modules.reporting_panel = true;

  const terminalUserId = "tu-demo-severnaya-zvezda";
  const centerId = "demo-severnaya-zvezda";

  const caseAnxiety = "case-demo-anxiety-01";
  const caseCouple = "case-demo-couple-02";
  const caseBurnout = "case-demo-burnout-03";
  const caseTeen = "case-demo-teen-04";
  const situationFamily = "case-demo-situation-05";
  const regElena = "reg-demo-elena-01";
  const regDmitry = "reg-demo-dmitry-02";
  const regAnna = "reg-demo-anna-03";
  const regIgor = "reg-demo-igor-04";
  const regOlga = "reg-demo-olga-05";

  const sessionTagsJson = (themes: string[]) =>
    JSON.stringify({
      themes: { catalog: themes, custom: [] },
      formats: { catalog: ["group"], custom: [] },
      methods: { catalog: ["cbt", "nvc"], custom: [] },
      techniques: { catalog: [], custom: [] },
    });

  const isIntl = edition === "intl";

  const leads = [
    {
      id: "lead-demo-01",
      center_id: centerId,
      name: isIntl ? "Maria K." : "Мария К.",
      contact: isIntl ? "+1 555-0199" : "+7 900 111-22-33",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Public speaking anxiety, sleep disturbance" : "Тревога перед выступлениями, нарушение сна",
        themes: ["DEV_EMO"]
      }),
      source: "embed_chat",
      user_id: null,
      status: "new",
      created_at: daysAgoIso(1),
    },
    {
      id: "lead-demo-02",
      center_id: centerId,
      name: isIntl ? "Alex P." : "Алексей П.",
      contact: "a.petrov@example.com",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Couples conflicts, want couples therapy" : "Конфликты в паре, хотят парную консультацию",
        themes: ["REL_FAM", "REL_DEP"]
      }),
      source: "embed_chat",
      user_id: null,
      status: "new",
      created_at: daysAgoIso(2),
    },
    {
      id: "lead-demo-03",
      center_id: centerId,
      name: isIntl ? "Helen S." : "Елена С.",
      contact: isIntl ? "+1 555-0245" : "+7 900 444-55-66",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Work burnout, apathy" : "Выгорание на работе, апатия",
        themes: ["ORG_BURN", "DEV_EMO"]
      }),
      source: "embed_chat",
      user_id: null,
      status: "converted",
      created_at: daysAgoIso(5),
    },
    {
      id: "lead-demo-04",
      center_id: centerId,
      name: isIntl ? "Igor N." : "Игорь Н.",
      contact: isIntl ? "+1 555-0318" : "+7 900 777-88-99",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Teenager difficulties at school" : "Трудности подростка в школе",
        themes: ["EDU_SELF", "REL_PEER"]
      }),
      source: "embed_chat",
      user_id: null,
      status: "converted",
      created_at: daysAgoIso(8),
    },
    {
      id: "lead-demo-05",
      center_id: centerId,
      name: isIntl ? "Olga V." : "Ольга В.",
      contact: "o.volkova@example.com",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Cancelled booking" : "Отменила запись"
      }),
      source: "embed_chat",
      user_id: null,
      status: "closed",
      created_at: daysAgoIso(12),
    },
  ];

  return {
    unlocked: true,
    installationMeta: {
      install_id: "install-demo-severnaya",
      country: isIntl ? "US" : "RU",
      region: isIntl ? "New York" : "Москва",
      municipality: isIntl ? "New York" : "Москва",
      settlement: isIntl ? "New York" : "Москва",
      lat: 40.71,
      lng: -74.00,
      organization_type: "psychological_center",
      organization_label: isIntl ? "North Star Psychological Center" : "Психологический центр «Северная звезда»",
      org_unit_id: null,
      org_unit_status: "local",
      telemetry_consent: false,
      created_at: daysAgoIso(30),
      updated_at: daysAgoIso(0),
    },
    orgProfile: {
      display_name: isIntl ? "North Star Psychological Center" : "Психологический центр «Северная звезда»",
      isced_level: 0,
      org_kind: "psych_support_center",
      normative_overrides: "{}",
      approx_learner_count: null,
      org_sphere: "other",
      org_sphere_other: isIntl ? "Commercial psychological center" : "Коммерческий психологический центр",
      education_org_type: null,
      approx_learner_ovz_count: null,
    },
    specialistProfile: {
      display_name: isIntl
        ? isManager ? "Dr. Irene Bell" : "Ann Warren"
        : isManager ? "Ирина Белова" : "Анна Воронова",
      role_text: isIntl
        ? isManager ? "Center Director" : "Counseling Psychologist"
        : isManager ? "Директор центра" : "Психолог-консультант",
      weekly_contract_minutes: isManager ? 0 : 2400,
    },
    terminalConfig: {
      terminal_user_id: terminalUserId,
      edition: edition as "ru" | "intl",
      mode: isManager ? "manager" : "specialist",
      workspace_preset: isManager ? "manager" : "specialist",
      org_type: "commercial",
      manager_scope: null,
      job_title: isIntl
        ? isManager ? "Center Director" : "Psychologist"
        : isManager ? "Директор центра" : "Психолог",
      child_invite_code: "CHILD-DEMOSEVERNAYA01",
      parent_invite_code: isManager ? "PARENT-DEMOSEVERNAYA01" : null,
      parent_invite_in: null,
      child_invite_in: null,
      consumer_app: null,
      enabled_modules: modules,
      registry_enabled: !isManager,
      research_contribution_enabled: false,
      research_contribution_consented_at: null,
      research_contribution_consent_version: null,
      research_contribution_last_period_key: null,
      registry_vault_initialized: !isManager,
      registry_recovery_key_hash: isManager ? null : "demo-registry-vault-hash",
      onboarding_complete: true,
      created_at: daysAgoIso(30),
      updated_at: daysAgoIso(0),
    },
    sitePortal: {
      center_id: centerId,
      setup_token: "demo-setup-token-32chars-minimum",
      inbox_login: "demo-inbox",
      inbox_password: "demo-pass-123",
      iconostasis_columns: 3,
      consult_booking_url: "https://example.com/demo-booking-medflex",
      booking_mode: "external",
      public_site_origin: "https://demo-severnaya.example",
      site_page_paths_json:
        '{"consult":"/booking","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}',
      leads_export_webhook_url: "",
    },
    cases: [
      {
        id: regElena,
        created_at: daysAgoIso(28),
        updated_at: daysAgoIso(2),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Helen Smith" : "Смирнова Елена Владимировна",
          registry_profile: {
            full_name: isIntl ? "Helen Smith" : "Смирнова Елена Владимировна",
            gender: "female",
            age_years: 34,
            grade_class: "",
            birth_date: "1991-03-12",
            phone: isIntl ? "+1 (555) 0123" : "+7 (916) 123-45-67",
            email: isIntl ? "h.smith@example.com" : "e.smirnova@example.ru",
            address: isIntl ? "New York, 12 Forest Ave" : "Москва, ул. Лесная, 12",
            contact_person: "",
            notes: isIntl
              ? "Website request: anxiety, sleep. Connected to case 'Maria K.' - demo alias."
              : "Заявка с сайта: тревога, сон. Связь с кейсом «Мария К.» — демо-алиас.",
          },
        }),
      },
      {
        id: regDmitry,
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(5),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Dmitry Orlov" : "Орлов Дмитрий Сергеевич",
          registry_profile: {
            full_name: isIntl ? "Dmitry Orlov" : "Орлов Дмитрий Сергеевич",
            gender: "male",
            age_years: 41,
            grade_class: "",
            birth_date: "1984-11-02",
            phone: isIntl ? "+1 (555) 0140" : "+7 (903) 555-12-40",
            email: isIntl ? "d.orlov@example.com" : "d.orlov@example.ru",
            address: isIntl ? "New York, 88 Peace Ave" : "Москва, пр-т Мира, 88",
            contact_person: isIntl ? "Marina Orlova (Spouse)" : "Орлова Марина (супруга)",
            notes: isIntl
              ? "Couples work. Contact for visit reminders."
              : "Парная работа. Контакт для напоминаний о визитах.",
          },
        }),
      },
      {
        id: regAnna,
        created_at: daysAgoIso(18),
        updated_at: daysAgoIso(4),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Anna Taylor" : "Кузнецова Анна Игоревна",
          registry_profile: {
            full_name: isIntl ? "Anna Taylor" : "Кузнецова Анна Игоревна",
            gender: "female",
            age_years: 29,
            grade_class: "",
            birth_date: "1996-07-19",
            phone: isIntl ? "+1 (555) 0188" : "+7 (926) 401-33-21",
            email: isIntl ? "a.taylor@example.com" : "a.kuznetsova@example.ru",
            address: isIntl ? "New York, 3 May St" : "Химки, ул. Майская, 3",
            contact_person: "",
            notes: isIntl
              ? "Work burnout. Preferred time: evenings."
              : "Выгорание на работе. Удобное время — вечера.",
          },
        }),
      },
      {
        id: regIgor,
        created_at: daysAgoIso(12),
        updated_at: daysAgoIso(1),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Igor Wolf" : "Волков Игорь Николаевич",
          registry_profile: {
            full_name: isIntl ? "Igor Wolf" : "Волков Игорь Николаевич",
            gender: "male",
            age_years: 16,
            grade_class: "",
            birth_date: "2009-09-04",
            phone: isIntl ? "+1 (555) 0195" : "+7 (999) 210-08-15",
            email: "",
            address: isIntl ? "New York, 5 Queen St" : "Москва, ул. Академика Королёва, 5",
            contact_person: isIntl ? "Tatiana Wolf (Mother)" : "Волкова Татьяна (мама)",
            notes: isIntl
              ? "Teenager. Registration via parent from website."
              : "Подросток. Запись через родителя с сайта.",
          },
        }),
      },
      {
        id: regOlga,
        created_at: daysAgoIso(7),
        updated_at: daysAgoIso(0),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Olga Peacock" : "Павлова Ольга Михайловна",
          registry_profile: {
            full_name: isIntl ? "Olga Peacock" : "Павлова Ольга Михайловна",
            gender: "female",
            age_years: 47,
            grade_class: "",
            birth_date: "1978-01-28",
            phone: isIntl ? "+1 (555) 0177" : "+7 (915) 777-02-19",
            email: isIntl ? "o.peacock@example.com" : "o.pavlova@example.ru",
            address: isIntl ? "New York, 41 Garden St" : "Москва, ул. Садовая, 41",
            contact_person: "",
            notes: isIntl
              ? "New lead in inbox - awaiting first visit."
              : "Новая заявка inbox — ожидает первый визит.",
          },
        }),
      },
      {
        id: caseAnxiety,
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(1),
        y_level: "Y2_Risk",
        x_stage: "X3_Intervention",
        notes: isIntl
          ? "Client presented with public speaking anxiety."
          : "Клиент обратился с тревогой перед публичными выступлениями.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Maria K. — anxiety & sleep" : "Мария К. — тревога и сон",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Public speaking anxiety, sleep disturbances for the past 2 months."
            : "Тревога перед выступлениями, нарушение сна последние 2 месяца.",
        }),
      },
      {
        id: caseCouple,
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(3),
        y_level: "Y2_Risk",
        x_stage: "X2_Diag",
        notes: isIntl ? "Couple: budget & intimacy conflicts." : "Пара: конфликты о бюджете и близости.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Alex & Helen — couples work" : "Алексей и Елена — парная работа",
          situation_kind: "couple_therapy",
          primary_description: isIntl ? "Frequent arguments, feeling distant." : "Частые ссоры, чувство дистанции.",
        }),
      },
      {
        id: caseBurnout,
        created_at: daysAgoIso(10),
        updated_at: daysAgoIso(2),
        y_level: "Y3_Problem",
        x_stage: "X3_Intervention",
        notes: isIntl ? "Burnout, low energy." : "Выгорание, снижение энергии.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Helen S. — burnout" : "Елена С. — выгорание",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Fatigue, cynicism towards work, sleep issues."
            : "Усталость, цинизм к работе, нарушение сна.",
        }),
      },
      {
        id: caseTeen,
        created_at: daysAgoIso(7),
        updated_at: daysAgoIso(0),
        y_level: "Y2_Risk",
        x_stage: "X1_Intake",
        notes: isIntl ? "Teenager, fear of school failure." : "Подросток, страх ошибки в учёбе.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Daniel, 15yo — school & anxiety" : "Даниил, 15 лет — учёба и тревога",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Decreased motivation, fear of exams."
            : "Снижение мотивации, страх контрольных.",
        }),
      },
      {
        id: situationFamily,
        created_at: daysAgoIso(4),
        updated_at: daysAgoIso(1),
        y_level: "Y3_Problem",
        x_stage: "X2_Diag",
        notes: isIntl
          ? "Multilateral case: family adaptation after divorce."
          : "Многосторонний кейс: семья после развода родителей.",
        case_artifacts_json: JSON.stringify({
          record_kind: "situation",
          situation_title: isIntl ? "Family I. — post-divorce adaptation" : "Семья И. — адаптация после развода",
          situation_kind: "couple_therapy",
          primary_description: isIntl
            ? "Parental conflict over child schedule, joint plan needed."
            : "Конфликт родителей об режиме ребёнка, нужен совместный план.",
        }),
      },
    ],
    caseAliases: [
      { case_id: caseAnxiety, alias_id: "alias-demo-a1", role: "client", role_no: 1, real_name: "Мария К." },
      { case_id: caseCouple, alias_id: "alias-demo-c1", role: "client", role_no: 1, real_name: "Алексей П." },
      { case_id: caseCouple, alias_id: "alias-demo-c2", role: "partner", role_no: 1, real_name: "Елена П." },
      { case_id: caseBurnout, alias_id: "alias-demo-b1", role: "client", role_no: 1, real_name: "Елена С." },
      { case_id: caseTeen, alias_id: "alias-demo-t1", role: "client", role_no: 1, real_name: "Даниил" },
      { case_id: caseTeen, alias_id: "alias-demo-t2", role: "parent", role_no: 1, real_name: "Игорь Н." },
      { case_id: situationFamily, alias_id: "alias-demo-s1", role: "parent", role_no: 1, real_name: "Ольга И." },
      { case_id: situationFamily, alias_id: "alias-demo-s2", role: "parent", role_no: 2, real_name: "Сергей И." },
      { case_id: situationFamily, alias_id: "alias-demo-s3", role: "child", role_no: 1, real_name: "Миша, 9 лет" },
    ],
    sessionRecords: [
      {
        record_id: "sess-demo-a0",
        case_id: caseAnxiety,
        session_no: 0,
        content_json: JSON.stringify({
          primaryDescription: isIntl ? "Initial contact: anxiety and sleep issues." : "Первичный контакт: тревога и сон.",
          problemThemes: emptyTags(["DEV_EMO"]),
        }),
        recorded_at: daysAgoIso(14),
        created_at: daysAgoIso(14),
      },
      {
        record_id: "sess-demo-a1",
        case_id: caseAnxiety,
        session_no: 1,
        content_json: JSON.stringify({
          progressNote: isIntl ? "Analysis of triggers before public speeches." : "Разбор триггеров перед выступлением.",
          problemThemes: emptyTags(["DEV_EMO"]),
        }),
        recorded_at: daysAgoIso(7),
        created_at: daysAgoIso(7),
      },
    ],
    workLog: [
      {
        entry_id: "wl-demo-a1",
        case_id: caseAnxiety,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(7, 11),
        note: consultationNote({
          goal: isIntl ? "Reduce anxiety before presentations" : "Снизить тревогу перед выступлениями",
          observations: isIntl
            ? "Client describes heart palpitations and insomnia before major meetings."
            : "Клиент описывает сердцебиение и бессонницу перед важными встречами.",
          intervention: isIntl
            ? "Psychoeducation, breathing technique, exposure plan."
            : "Психообразование, дыхательная техника, план экспозиции.",
          assessment: isIntl ? "Subjective anxiety decreased by end of session." : "Снижение субъективной тревоги в конце сессии.",
          plan: isIntl ? "Homework: trigger diary, 2 breathing exercises." : "Домашнее: дневник триггеров, 2 упражнения на дыхание.",
          themes: ["DEV_EMO"],
          visitDate: dateDaysAgo(7),
        }),
      },
      {
        entry_id: "wl-demo-a2",
        case_id: caseAnxiety,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(1, 15),
        note: consultationNote({
          goal: isIntl ? "Reinforce self-regulation skills" : "Закрепить навыки саморегуляции",
          observations: isIntl ? "Sleep improved, less avoidance of meetings." : "Лучше спит, меньше избегает встреч.",
          intervention: isIntl ? "Review CBT exercises, discuss successful episode." : "Повтор КПТ-упражнений, разбор успешного эпизода.",
          assessment: isIntl ? "Stable progress." : "Устойчивая динамика.",
          plan: isIntl ? "Next visit in one week." : "Следующая встреча через неделю.",
          themes: ["DEV_EMO", "DEV_SELF"],
          visitDate: dateDaysAgo(1),
        }),
      },
      {
        entry_id: "wl-demo-c1",
        case_id: caseCouple,
        action_kind: "consultation",
        minutes: 80,
        created_at: daysAgoEpoch(3, 18),
        note: consultationNote({
          goal: isIntl ? "De-escalate arguments" : "Снять эскалацию ссор",
          observations: isIntl ? "Both interrupt each other, active listening is low." : "Оба прерывают друг друга, мало слышат.",
          intervention: isIntl ? "NVC: dialogue rules, roles in conflict." : "ННО: правила диалога, роли в конфликте.",
          assessment: isIntl ? "Agreed on a 24h timeout." : "Согласились на паузу 24 ч.",
          plan: isIntl ? "Homework: one 'safe' structured conversation." : "Дома: один «безопасный» разговор по правилам.",
          themes: ["REL_FAM", "REL_DEP"],
          methods: ["nvc", "family_sys"],
          visitDate: dateDaysAgo(3),
        }),
      },
      {
        entry_id: "wl-demo-b1",
        case_id: caseBurnout,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(2, 10),
        note: consultationNote({
          goal: isIntl ? "Restore resources & workplace boundaries" : "Вернуть ресурсы и границы на работе",
          observations: isIntl ? "Severe fatigue, cynicism." : "Высокая усталость, цинизм.",
          intervention: isIntl ? "Workload mapping, recovery planning." : "Карта нагрузки, план восстановления.",
          assessment: isIntl ? "Ready to discuss boundaries with director." : "Готова обсудить границы с руководителем.",
          plan: isIntl ? "7+ hours sleep, one weekend off email." : "Сон 7+ ч, один выходной без рабочей почты.",
          risk: "moderate",
          themes: ["ORG_BURN", "DEV_EMO"],
          visitDate: dateDaysAgo(2),
        }),
      },
      {
        entry_id: "wl-demo-t1",
        case_id: caseTeen,
        action_kind: "consultation",
        minutes: 45,
        created_at: daysAgoEpoch(0, 16),
        note: consultationNote({
          goal: isIntl ? "Initial contact with teenager" : "Первичный контакт с подростком",
          observations: isIntl ? "Withdrawn, fears of failure." : "Замкнут, говорит о страхе ошибки.",
          intervention: isIntl ? "Alliance building, normalization, strengths inventory." : "Альянс, нормализация, карта сильных сторон.",
          assessment: isIntl ? "Agreed to a second meeting." : "Согласился на вторую встречу.",
          plan: isIntl ? "Brief contact with parent." : "Краткий контакт с родителем.",
          themes: ["EDU_SELF", "DEV_EMO"],
          visitDate: dateDaysAgo(0),
        }),
      },
    ],
    requests: [],
    groupSessions: [
      {
        session_id: "gs-demo-01",
        title: isIntl ? "Support Group: Anxiety" : "Группа поддержки: тревога",
        session_date: dateDaysAgo(5),
        duration_minutes: 90,
        theme: isIntl ? "Anxiety & Self-Regulation" : "Тревога и саморегуляция",
        notes: isIntl ? "6 participants, breathing exercises." : "6 участников, упражнения на дыхание.",
        plan_text: isIntl ? "Warmup -> theory -> practice" : "Разминка → теория → практика",
        report_text: isIntl ? "Participants noted tension decrease." : "Участники отметили снижение напряжения.",
        audience_json: "{}",
        artifacts_json: "{}",
        prevention_link: "L1_universal",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["DEV_EMO"]),
        created_at: daysAgoEpoch(5),
        updated_at: daysAgoEpoch(5),
      },
      {
        session_id: "gs-demo-02",
        title: isIntl ? "Parent Webinar: Boundaries" : "Вебинар для родителей: границы",
        session_date: dateDaysAgo(9),
        duration_minutes: 60,
        theme: isIntl ? "Family Boundaries" : "Границы в семье",
        notes: isIntl ? "Online, 12 participants." : "Онлайн, 12 участников.",
        plan_text: "",
        report_text: "",
        audience_json: "{}",
        artifacts_json: "{}",
        prevention_link: "L1_universal",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["REL_FAM", "DEV_WILL"]),
        created_at: daysAgoEpoch(9),
        updated_at: daysAgoEpoch(9),
      },
    ],
    workEntries: [],
    organizationPrograms: [],
    iprs: [],
    iprSteps: [],
    leads,
  };
}

export function ensureDemoSeed(): boolean {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("entry") || params.has("org") || params.has("preset")) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(DEMO_FLAG_KEY);
      }
      writeStagingStore(emptyStore());
      return false;
    }
  }

  const workspace = readDemoParam();
  if (!workspace) return false;
  
  if (!needsReseed(workspace)) {
    markDemoActive(workspace);
    writeStagingAiPreview(true);
    return false;
  }
  
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isSchoolHost = (host.includes("prevention.school") && !host.includes("ida-ai.chat") && !host.includes("ida.chat")) ||
                       (typeof import.meta.env !== "undefined" && import.meta.env.VITE_TERMINAL_PRODUCT === "school");

  if (workspace === "school" || workspace === "authority" || (isSchoolHost && workspace === "manager")) {
    writeStagingStore(buildSchoolDemoStore(workspace, getTerminalEdition()));
  } else {
    writeStagingStore(buildDemoStore(workspace));
  }
  markDemoActive(workspace);
  writeStagingAiPreview(true);
  return true;
}

/** Force reseed (e.g. banner button). */
export function reseedDemo(workspace?: DemoWorkspace): void {
  const ws = workspace || readDemoWorkspace();
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isSchoolHost = (host.includes("prevention.school") && !host.includes("ida-ai.chat") && !host.includes("ida.chat")) ||
                       (typeof import.meta.env !== "undefined" && import.meta.env.VITE_TERMINAL_PRODUCT === "school");

  if (ws === "school" || ws === "authority" || (isSchoolHost && ws === "manager")) {
    writeStagingStore(buildSchoolDemoStore(ws, getTerminalEdition()));
  } else {
    writeStagingStore(buildDemoStore(ws));
  }
  markDemoActive(ws);
  writeStagingAiPreview(true);
}

export function terminalDemoUrl(workspace: DemoWorkspace = "specialist"): string {
  const q = workspace === "manager" ? "manager"
    : workspace === "school" ? "school"
    : workspace === "authority" ? "authority"
    : "1";
  return `/terminal/staging/?demo=${q}`;
}
