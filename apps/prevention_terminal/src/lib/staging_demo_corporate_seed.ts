import { defaultEnabledModules } from "./terminal_config.ts";
import { type StagingStore } from "./web_staging.ts";
import { type DemoWorkspace } from "./staging_demo_seed.ts";

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
  transcript?: string;
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
    artifacts: args.transcript ? { transcript: args.transcript } : {},
  });
}

export function buildCorporateDemoStore(workspace: DemoWorkspace, edition: string): StagingStore {
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

  const terminalUserId = "tu-demo-corp-health";
  const centerId = "demo-corp-health";

  // Identifiers for cases
  const caseRoman = "case-corp-roman-01";
  const caseEkaterina = "case-corp-ekat-02";
  const caseMediation = "case-corp-med-03";
  const caseOlga = "case-corp-olga-04";

  // Registry profile cases
  const regRoman = "reg-corp-roman-01";
  const regEkaterina = "reg-corp-ekat-02";
  const regDenis = "reg-corp-denis-03";
  const regArtem = "reg-corp-artem-04";
  const regOlga = "reg-corp-olga-05";

  const sessionTagsJson = (themes: string[]) =>
    JSON.stringify({
      themes: { catalog: themes, custom: [] },
      formats: { catalog: ["group"], custom: [] },
      methods: { catalog: ["cbt", "nvc", "act"], custom: [] },
      techniques: { catalog: [], custom: [] },
    });

  const isIntl = edition === "intl";

  const leads = [
    {
      id: "lead-corp-01",
      center_id: centerId,
      name: isIntl ? "Roman V. (Backend Lead)" : "Роман В. (Team Lead Backend)",
      contact: "r.vasiliev@corp.tech",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl
          ? "Chronic insomnia, severe emotional exhaustion in sprint, communication friction with PM"
          : "Хроническая бессонница, сильнейшее эмоциональное истощение в релизном спринте, трения с PM",
        themes: ["ORG_BURN", "DEV_EMO"]
      }),
      source: "corp_intranet",
      user_id: null,
      status: "converted",
      created_at: daysAgoIso(14),
    },
    {
      id: "lead-corp-02",
      center_id: centerId,
      name: isIntl ? "Ekaterina M. (PO Core Products)" : "Екатерина М. (Product Owner Core)",
      contact: "e.morozova@corp.tech",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl
          ? "Imposter syndrome, panic attacks before quarterly VP defense"
          : "Синдром самозванца, панические атаки перед защитой квартальных KPI перед вице-президентом",
        themes: ["DEV_EMO", "DEV_SELF"]
      }),
      source: "corp_intranet",
      user_id: null,
      status: "converted",
      created_at: daysAgoIso(8),
    },
    {
      id: "lead-corp-03",
      center_id: centerId,
      name: isIntl ? "Denis K. & Artem S. (Mediation)" : "Денис К. и Артем С. (Медиация разработки и продаж)",
      contact: "d.kuznetsov@corp.tech",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl
          ? "Interdepartmental communication deadlock between Analytics & Sales teams, mutual accusations"
          : "Междепартаментный тупик между Аналитикой и Продажами, срывы кросс-функциональных сиSync, взаимные претензии",
        themes: ["REL_DEP", "REL_FAM"]
      }),
      source: "hr_referral",
      user_id: null,
      status: "new",
      created_at: daysAgoIso(3),
    },
    {
      id: "lead-corp-04",
      center_id: centerId,
      name: isIntl ? "Olga P. (Lead UX)" : "Ольга П. (Ведущий UX/UI дизайнер)",
      contact: "o.pavlova@corp.tech",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl
          ? "Adjustment after office relocation, anxiety upon receiving review edits"
          : "Адаптация в распределенной команде после релокации, острая тревога при критике макетов от стейкхолдеров",
        themes: ["DEV_EMO"]
      }),
      source: "corp_bot",
      user_id: null,
      status: "new",
      created_at: daysAgoIso(2),
    },
    {
      id: "lead-corp-05",
      center_id: centerId,
      name: isIntl ? "Anonymous Dev Lead" : "Анонимная заявка (Инженерный департамент)",
      contact: "anon-482@corp.internal",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl
          ? "Apathy, loss of meaning in coding, fear of missing release deadlines"
          : "Апатия, потеря смысла в решении тикетов, страх подвести команду перед релизом",
        themes: ["ORG_BURN"]
      }),
      source: "corp_widget",
      user_id: null,
      status: "new",
      created_at: daysAgoIso(1),
    },
  ];

  // Realistic AI transcript for Roman's session demonstrating speech recognition and targets
  const romanSessionTranscript = isIntl
    ? `Psychologist: Hello Roman. Let's see where we left off last session. How did the release sprint go?
Roman: Hi Elena. Frankly, the sprint was hell. The PM moved the deadline by four days again.
Psychologist: What did you feel at the moment when you saw this notification?
Roman: Panic and complete helplessness. My pulse spiked, couldn't breathe. I thought: "If I don't pull this off overnight, I'm worthless as a lead."
Psychologist: Notice that belief: "If I don't pull it off, I am worthless". That is the toxic shame and imposter syndrome pattern we talked about.
Roman: Yes, exactly. And instead of delegating to senior engineers, I sat till 4 AM writing code myself. Slept for 2 hours. My hands were shaking.
Psychologist: Let's do the stop-pause technique right now and examine the real facts: what would happen if you openly communicated capacity limits to the PM?
Roman: He would be irritated, but the team wouldn't burn out. Actually, they are already asking me to protect them from scope creep.
Psychologist: Excellent realization. Let's practice an assertive script right now: "Done is better than perfect, and team stability is our top priority".`
    : `Психолог: Здравствуйте, Роман! Рада вас видеть. Как прошла неделя после нашей прошлой встречи? Как прошел релизный спринт?
Роман: Здравствуйте, Елена. Честно говоря, спринт превратился в ад. Продакт-менеджер в пятницу снова сдвинул дедлайн на 4 дня раньше и накинул три критических тикета без согласования.
Психолог: Что вы почувствовали в тот момент, когда увидели это в трекере?
Роман: Сначала вспышку ярости, а потом ступор и панику. Сердце колотится, в груди спазм. В голове сразу мысль: «Если я сейчас не закрою это сам за выходные, я никчемный тимлид и меня уволят».
Психолог: Обратите внимание на это убеждение: «Я должен сделать всё идеально любой ценой, иначе я провалился». Это именно та когнитивная ловушка перфекционизма и токсичного стыда, которую мы фиксировали на карте мишеней.
Роман: Да, в точности. И вместо того чтобы сказать «нет» менеджеру или распределить задачи между сеньорами, я снова сидел до 5 утра субботы и писал код в одиночку. Спал по два часа, в воскресенье просто лежал лицом в стену, не мог поднять руку.
Психолог: Давайте сейчас зафиксируем это состояние и применим технику когнитивного разделения и стоп-паузы. Что случится объективно, если вы открыто обозначите границы емкости спринта?
Роман: Наверное, менеджер поворчит, но перенесет вторичные фичи в бэклог. На самом деле ребята в команде сами просят меня не соглашаться на овертаймы, потому что видят, как я выгораю.
Психолог: Это очень ценное наблюдение. Давайте прямо сейчас отрепетируем адаптивный скрипт для синхронизации: «Сделано хорошо лучше, чем сделано идеально ценой срыва людей. Команда берет только согласованный скоуп».`;

  return {
    unlocked: true,
    installationMeta: {
      install_id: "install-corp-health-01",
      country: isIntl ? "US" : "RU",
      region: isIntl ? "Moscow HQ" : "Москва",
      municipality: isIntl ? "Moscow HQ" : "Москва",
      settlement: isIntl ? "Moscow HQ" : "Москва",
      lat: 55.75,
      lng: 37.61,
      organization_type: "psychological_center",
      organization_label: isIntl
        ? "TechEnterprise Group (Corporate Wellbeing Hub)"
        : "Корпоративная служба психологической поддержки | Wellbeing & Resilience Hub",
      org_unit_id: null,
      org_unit_status: "local",
      telemetry_consent: false,
      created_at: daysAgoIso(45),
      updated_at: daysAgoIso(0),
    },
    orgProfile: {
      display_name: isIntl
        ? "TechEnterprise Group (Corporate Wellbeing Hub)"
        : "Корпоративная служба психологической поддержки | Wellbeing & Resilience Hub",
      isced_level: 0,
      org_kind: "psych_support_center",
      normative_overrides: "{}",
      approx_learner_count: 1450,
      org_sphere: "other",
      org_sphere_other: isIntl ? "Corporate Health & Well-being" : "Корпоративное здоровье и Well-being сотрудников",
      education_org_type: null,
      approx_learner_ovz_count: null,
    },
    specialistProfile: {
      display_name: isIntl ? "Elena Grigorieva" : "Елена Григорьева",
      role_text: isIntl
        ? "Lead Corporate Psychologist / Certified CBT & ACT Practitioner"
        : "Ведущий корпоративный психолог / КПТ- и АКТ-терапевт",
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
        ? isManager ? "Head of Corporate Health" : "Lead Corporate Psychologist"
        : isManager ? "Руководитель службы корпоративного здоровья" : "Корпоративный психолог",
      child_invite_code: "CORP-LEAD-2026",
      parent_invite_code: isManager ? "CORP-HR-2026" : null,
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
      registry_recovery_key_hash: isManager ? null : "demo-corp-registry-vault-hash",
      onboarding_complete: true,
      created_at: daysAgoIso(45),
      updated_at: daysAgoIso(0),
    },
    sitePortal: {
      center_id: centerId,
      setup_token: "demo-corp-setup-token-32chars-min",
      inbox_login: "corp-inbox",
      inbox_password: "demo-corp-pass-123",
      iconostasis_columns: 3,
      consult_booking_url: "https://corporate-health.ida-psy.pro/terminal/staging/?demo=1",
      booking_mode: "external",
      public_site_origin: "https://corporate-health.ida-psy.pro",
      site_page_paths_json:
        '{"consult":"/booking","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}',
      leads_export_webhook_url: "",
    },
    cases: [
      // 1. Employee Registry Cards
      {
        id: regRoman,
        created_at: daysAgoIso(28),
        updated_at: daysAgoIso(1),
        y_level: "Y2_Risk",
        x_stage: "X3_Intervention",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Roman Vasiliev (Backend Lead)" : "Васильев Роман Сергеевич (Team Lead Backend)",
          registry_profile: {
            full_name: isIntl ? "Roman Vasiliev" : "Васильев Роман Сергеевич",
            gender: "male",
            age_years: 34,
            grade_class: isIntl ? "Engineering Dept, Lead" : "Департамент разработки, Тимлид",
            birth_date: "1992-04-14",
            phone: "+7 (916) 440-12-88",
            email: "r.vasiliev@corp.tech",
            address: isIntl ? "Moscow HQ, Floor 7" : "Москва, Ленинградский пр-т 39 (Офис)",
            contact_person: isIntl ? "Roman V. (Backend Lead)" : "Роман В. (Team Lead Backend)",
            notes: isIntl
              ? "Key engineering lead. High cognitive load, severe sprint burnout, insomnia."
              : "Ключевой технический лидер. Высокая когнитивная нагрузка, хронический стресс релизов, бессонница. Заявка с интранета.",
          },
        }),
      },
      {
        id: regEkaterina,
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(3),
        y_level: "Y2_Risk",
        x_stage: "X3_Intervention",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Ekaterina Morozova (Product Owner)" : "Морозова Екатерина Андреевна (Product Owner Core)",
          registry_profile: {
            full_name: isIntl ? "Ekaterina Morozova" : "Морозова Екатерина Андреевна",
            gender: "female",
            age_years: 29,
            grade_class: isIntl ? "Product Directorate" : "Дирекция продуктов, CPO Stream",
            birth_date: "1997-09-11",
            phone: "+7 (926) 310-75-20",
            email: "e.morozova@corp.tech",
            address: isIntl ? "Moscow HQ, Floor 5" : "Москва, ул. Вавилова 19",
            contact_person: isIntl ? "Ekaterina M. (PO Core Products)" : "Екатерина М. (Product Owner Core)",
            notes: isIntl
              ? "Imposter syndrome, panic symptoms before executive demos."
              : "Синдром самозванца, панические приступы перед защитой дорожной карты перед C-level.",
          },
        }),
      },
      {
        id: regDenis,
        created_at: daysAgoIso(15),
        updated_at: daysAgoIso(2),
        y_level: "Y2_Risk",
        x_stage: "X2_Diag",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Denis Kuznetsov (Head of Analytics)" : "Кузнецов Денис Викторович (Руководитель аналитики)",
          registry_profile: {
            full_name: isIntl ? "Denis Kuznetsov" : "Кузнецов Денис Викторович",
            gender: "male",
            age_years: 38,
            grade_class: isIntl ? "Data Analytics" : "Управление Big Data и аналитики",
            birth_date: "1988-02-18",
            phone: "+7 (903) 771-45-12",
            email: "d.kuznetsov@corp.tech",
            address: isIntl ? "Moscow, Remote" : "Москва, удаленный формат",
            contact_person: isIntl ? "Denis K. & Artem S. (Mediation)" : "Денис К. и Артем С. (Медиация разработки и продаж)",
            notes: isIntl
              ? "Mediation case with sales director regarding SLA and deadlines."
              : "Кейс междепартаментной медиации с директором по продажам. Срывы SLA по отчетам.",
          },
        }),
      },
      {
        id: regArtem,
        created_at: daysAgoIso(15),
        updated_at: daysAgoIso(2),
        y_level: "Y2_Risk",
        x_stage: "X2_Diag",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Artem Smirnov (Sales Director)" : "Смирнов Артем Олегович (Директор корпоративных продаж)",
          registry_profile: {
            full_name: isIntl ? "Artem Smirnov" : "Смирнов Артем Олегович",
            gender: "male",
            age_years: 42,
            grade_class: isIntl ? "B2B Sales" : "Департамент B2B и партнерств",
            birth_date: "1984-06-25",
            phone: "+7 (915) 880-99-11",
            email: "a.smirnov@corp.tech",
            address: isIntl ? "Moscow HQ, Floor 11" : "Москва, Пресненская наб. 10",
            contact_person: isIntl ? "Denis K. & Artem S. (Mediation)" : "Денис К. и Артем С. (Медиация разработки и продаж)",
            notes: isIntl
              ? "Mediation participant. Demanding speed from data team under sales pressure."
              : "Участник медиации. Давление квартального плана продаж, агрессивный стиль эскалаций.",
          },
        }),
      },
      {
        id: regOlga,
        created_at: daysAgoIso(10),
        updated_at: daysAgoIso(1),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Olga Pavlova (Lead UX)" : "Павлова Ольга Дмитриевна (Ведущий UX дизайнер)",
          registry_profile: {
            full_name: isIntl ? "Olga Pavlova" : "Павлова Ольга Дмитриевна",
            gender: "female",
            age_years: 27,
            grade_class: isIntl ? "Design Team" : "Дизайн-система и пользовательский опыт",
            birth_date: "1999-11-04",
            phone: "+7 (999) 555-14-30",
            email: "o.pavlova@corp.tech",
            address: isIntl ? "St. Petersburg Hub" : "Санкт-Петербург, удаленный офис",
            contact_person: isIntl ? "Olga P. (Lead UX)" : "Ольга П. (Ведущий UX/UI дизайнер)",
            notes: isIntl
              ? "Adjustment in remote team, rejection sensitivity to stakeholder critique."
              : "Адаптация в распределенной команде, болезненная чувствительность к правкам стейкхолдеров.",
          },
        }),
      },

      // 2. Consultation Cases (DAP Protocols & Evidence Records)
      {
        id: caseRoman,
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(1),
        y_level: "Y3_Problem",
        x_stage: "X3_Intervention",
        notes: isIntl
          ? "Backend Team Lead: Severe burnout (MBI exhaustion 84/100), deadline anxiety, perfectionism."
          : "Тимлид разработки: Острое эмоциональное выгорание (MBI 84 балла), бессонница, трения с PM.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Roman V. — Sprint Burnout & Imposter Syndrome" : "Роман В. — Выгорание в спринтах и синдром самозванца",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Team lead with chronic workaholism, severe exhaustion, panic attacks on deadline changes."
            : "Тимлид бэкенда: хронический трудоголизм, бессонница перед дедлайнами, панические зажимы в теле, страх делегировать.",
        }),
      },
      {
        id: caseEkaterina,
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(3),
        y_level: "Y2_Risk",
        x_stage: "X3_Intervention",
        notes: isIntl
          ? "Product Owner: Imposter syndrome, somatic anxiety before C-level demos."
          : "Product Owner: Синдром самозванца, соматическая тревога перед защитой KPI перед топ-менеджментом.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Ekaterina M. — Imposter Syndrome & Presentation Anxiety" : "Екатерина М. — Синдром самозванца и тревога выступлений",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Panic attacks, catastrophic thinking before executive boards, micromanagement defense."
            : "Панические приступы и гиперконтроль перед демонстрацией продукта вице-президентам. Страх показаться некомпетентной.",
        }),
      },
      {
        id: caseMediation,
        created_at: daysAgoIso(10),
        updated_at: daysAgoIso(2),
        y_level: "Y3_Problem",
        x_stage: "X2_Diag",
        notes: isIntl
          ? "Corporate Mediation: Data Analytics vs Enterprise Sales leadership conflict."
          : "Корпоративная медиация: Конфликт между руководителем аналитики и директором продаж.",
        case_artifacts_json: JSON.stringify({
          record_kind: "situation",
          situation_title: isIntl ? "Mediation: Analytics & Sales Teams Deadlock" : "Медиация: Конфликт команд Аналитики и Продаж",
          situation_kind: "couple_therapy",
          primary_description: isIntl
            ? "Communication deadlock over SLA, aggressive escalation culture, burnout of middle managers."
            : "Хронический межкомандный конфликт из-за сроков кастомной аналитики для сделок. Эскалации, срывы встреч, взаимное недоверие.",
        }),
      },
      {
        id: caseOlga,
        created_at: daysAgoIso(7),
        updated_at: daysAgoIso(0),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: isIntl
          ? "Senior UX Designer: Adaptation in distributed team, feedback vulnerability."
          : "Ведущий дизайнер: Адаптация после релокации, сверхчувствительность к критике.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Olga P. — Remote Work Adaptation & Feedback Resilience" : "Ольга П. — Адаптация на удаленке и стресс от правок",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Anxiety when receiving PR/Figma comments, feelings of isolation in remote office."
            : "Тревога при получении правок в Figma от разработчиков и стейкхолдеров, чувство изолированности на удаленке.",
        }),
      },
    ],
    caseAliases: [
      { case_id: caseRoman, alias_id: "alias-corp-r1", role: "client", role_no: 1, real_name: isIntl ? "Roman V." : "Роман В." },
      { case_id: caseEkaterina, alias_id: "alias-corp-e1", role: "client", role_no: 1, real_name: isIntl ? "Ekaterina M." : "Екатерина М." },
      { case_id: caseMediation, alias_id: "alias-corp-m1", role: "client", role_no: 1, real_name: isIntl ? "Denis K." : "Денис К." },
      { case_id: caseMediation, alias_id: "alias-corp-m2", role: "partner", role_no: 1, real_name: isIntl ? "Artem S." : "Артем С." },
      { case_id: caseOlga, alias_id: "alias-corp-o1", role: "client", role_no: 1, real_name: isIntl ? "Olga P." : "Ольга П." },
    ],
    sessionRecords: [
      {
        record_id: "sess-corp-r0",
        case_id: caseRoman,
        session_no: 0,
        content_json: JSON.stringify({
          primaryDescription: isIntl
            ? "Initial intake: severe sprint exhaustion, sleep deprivation, panic before deadline shifts."
            : "Первичный скрининг: синдром эмоционального выгорания (MBI 84), сон 3-4 часа, панические атаки.",
          problemThemes: emptyTags(["ORG_BURN", "DEV_EMO"]),
        }),
        recorded_at: daysAgoIso(21),
        created_at: daysAgoIso(21),
      },
      {
        record_id: "sess-corp-r1",
        case_id: caseRoman,
        session_no: 1,
        content_json: JSON.stringify({
          progressNote: isIntl
            ? "CBT exploration of irrational core beliefs: perfectionism and catastrophic thinking."
            : "КПТ-разбор когнитивных искажений перфекционизма: «Я обязан закрыть всё сам, иначе я никчемный лидер».",
          problemThemes: emptyTags(["ORG_BURN", "DEV_SELF"]),
        }),
        recorded_at: daysAgoIso(14),
        created_at: daysAgoIso(14),
      },
      {
        record_id: "sess-corp-r2",
        case_id: caseRoman,
        session_no: 2,
        content_json: JSON.stringify({
          progressNote: isIntl
            ? "Behavioral experiments: boundary setting with PM, delegation protocol to senior devs."
            : "Поведенческий эксперимент: защита границ спринта перед PM, делегирование трех фич senior-инженерам.",
          problemThemes: emptyTags(["ORG_BURN", "DEV_WILL"]),
        }),
        recorded_at: daysAgoIso(1),
        created_at: daysAgoIso(1),
      },
    ],
    workLog: [
      {
        entry_id: "wl-corp-r1",
        case_id: caseRoman,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(14, 11),
        note: consultationNote({
          goal: isIntl
            ? "Map exhaustion triggers and establish emergency sleep hygiene protocol"
            : "Картирование триггеров истощения и стабилизация гигиены сна в спринте",
          observations: isIntl
            ? "Client is visibly exhausted. Dark circles under eyes, motor restlessness, tremors when discussing release. Pulse rises to 110 bpm."
            : "Клиент в состоянии выраженного утомления. Спит по 3-4 часа, мышечный панцирь шейно-воротниковой зоны. Высокая ажитация при упоминании сдвига дедлайнов.",
          intervention: isIntl
            ? "CBT psychoeducation on burnout stages (Maslach). Diaphragmatic breathing and 4-7-8 regulation. Digital detox anchor from 22:00."
            : "Психообразование по стадиям выгорания (Маслач). Протокол заземления 5-4-3-2-1 при паническом спазме. Ограничение рабочих мессенджеров после 21:00.",
          assessment: isIntl
            ? "Client acknowledged workaholism as avoidance of fear of inadequacy. SUDS decreased from 85/100 to 45/100."
            : "Клиент осознал механизм трудоголизма как гиперкомпенсацию страха несоответствия. Тревога SUDS снизилась с 85 до 45 баллов.",
          plan: isIntl
            ? "Keep sleep log. Enforce 7 hours in bed. Prepare delegation list for next sprint planning."
            : "Вести дневник автоматических мыслей перед сном. Минимум 7 часов в постели без ноутбука. Составить матрицу делегирования задач.",
          risk: "moderate",
          themes: ["ORG_BURN", "DEV_EMO"],
          methods: ["cbt", "act"],
          visitDate: dateDaysAgo(14),
        }),
      },
      {
        entry_id: "wl-corp-r2",
        case_id: caseRoman,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(1, 15),
        note: consultationNote({
          goal: isIntl
            ? "Assertive communication with Product Manager and cognitive reframing of perfectionism"
            : "Отработка ассертивных границ с продакт-менеджером и переоценка перфекционизма",
          observations: isIntl
            ? "Significant clinical improvement. Sleeping 6.5 hours consistently. Successfully refused weekend overtime."
            : "Заметная позитивная динамика. Сон нормализован до 6.5 часов. Впервые отказался писать код на выходных, делегировал релизные тесты.",
          intervention: isIntl
            ? "Role-play: assertive conversation with PM using NVC structure (Observation, Feeling, Need, Request). Adaptive mantra formulation."
            : "Ролевая игра: разговор с PM по алгоритму ненасильственного общения (ННО). Формулирование адаптивного убеждения: «Сделано хорошо лучше, чем идеально ценой здоровья».",
          assessment: isIntl
            ? "Stable progress. Professional efficacy score in MBI increased by 22 points."
            : "Устойчивый прогресс. Индекс редукции профессиональных достижений сократился. Команда поддержала новые правила планирования.",
          plan: isIntl
            ? "Follow-up session in 14 days. Participate in the upcoming team resilience workshop."
            : "Контрольная сессия через две недели. Участие в корпоративном воркшопе по устойчивости к спринтам.",
          risk: "low",
          themes: ["ORG_BURN", "DEV_WILL", "DEV_SELF"],
          methods: ["cbt", "nvc", "act"],
          visitDate: dateDaysAgo(1),
          transcript: romanSessionTranscript,
        }),
      },
      {
        entry_id: "wl-corp-e1",
        case_id: caseEkaterina,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(3, 16),
        note: consultationNote({
          goal: isIntl
            ? "Deconstruct imposter syndrome before quarterly board presentation"
            : "Деконструкция синдрома самозванца перед защитой стратегии перед вице-президентом",
          observations: isIntl
            ? "High anticipation anxiety, catastrophic scenarios of being publicly criticized."
            : "Высокая тревога ожидания, катастрофизация реакции руководства («меня спросят то, чего я не знаю, и все поймут, что я случайно на этой должности»).",
          intervention: isIntl
            ? "Cognitive challenging of double standards. Formulation of evidence-based 'competence portfolio'."
            : "Техника «Адвокат»: сбор объективных фактов достижений продукта за год (рост MAU на 34%). Разделение роли эксперта и всезнающего робота.",
          assessment: isIntl
            ? "Cognitive defusion achieved. Anxiety dropped from 80% to 30%."
            : "Когнитивное разделение прошло успешно. Клиентка почувствовала опору на факты и команду.",
          plan: isIntl
            ? "Rehearse demo once without self-criticism. Breathing square before stepping into the boardroom."
            : "Провести сухой прогон презентации с таймингом. Дыхательный квадрат за 5 минут до входа в переговорную.",
          themes: ["DEV_EMO", "DEV_SELF"],
          methods: ["cbt"],
          visitDate: dateDaysAgo(3),
        }),
      },
      {
        entry_id: "wl-corp-m1",
        case_id: caseMediation,
        action_kind: "consultation",
        minutes: 80,
        created_at: daysAgoEpoch(2, 17),
        note: consultationNote({
          goal: isIntl
            ? "De-escalate interdepartmental conflict between Head of Analytics and Sales Director"
            : "Снятие взаимных претензий и согласование прозрачного SLA между Аналитикой и Продажами",
          observations: isIntl
            ? "High tension, mutual interruptions, aggressive body language at start of session."
            : "Высокая поляризация позиций. Продажи обвиняют аналитиков в медлительности, аналитики обвиняют продажи в хаотичных внеочередных запросах.",
          intervention: isIntl
            ? "Structured mediation session using NVC. Identification of shared business goal. Drafting clear 3-day SLA criteria."
            : "Медиативный протокол ННО: перевод обвинений в потребности бизнеса. Выработка регламента приоритизации отчетов по размеру потенциальной сделки.",
          assessment: isIntl
            ? "Both parties signed off on trial SLA protocol. Respectful dialogue restored."
            : "Стороны согласовали тестовый регламент на 30 дней. Уровень напряжения снизился, договоренность зафиксирована в общем документе.",
          plan: isIntl
            ? "30-day trial period review with psychologist facilitation."
            : "Ретроспектива выполнения договоренностей через 30 дней.",
          themes: ["REL_DEP", "DEV_WILL"],
          methods: ["nvc"],
          visitDate: dateDaysAgo(2),
        }),
      },
    ],
    requests: [],
    groupSessions: [
      {
        session_id: "gs-corp-01",
        title: isIntl
          ? "Workshop: Cognitive Load Management & Burnout Prevention in Tech Teams"
          : "Воркшоп для тимлидов: Управление когнитивной нагрузкой и профилактика выгорания в спринтах",
        session_date: dateDaysAgo(4),
        duration_minutes: 90,
        theme: isIntl ? "Sprint Resilience & Cognitive Hygiene" : "Устойчивость в спринтах и когнитивная гигиена",
        notes: isIntl
          ? "16 team leads attended. Practiced workload mapping, sprint boundary scripts, asynchronous communication rules."
          : "16 тимлидов и техлидов. Практика картирования нагрузки, скрипты защиты емкости команды, правила асинхронных коммуникаций.",
        plan_text: isIntl
          ? "Sprint biology -> Warning signs in telemetry -> Assertive negotiation with stakeholders -> Q&A"
          : "Биология стресса в релизах → Симптомы выгорания в метриках команды → Переговоры с заказчиками → Практикум",
        report_text: isIntl
          ? "High engagement, 9.4/10 average NPS from engineering managers."
          : "Средняя оценка полезности 9.4 из 10. Тимлиды запросили шаблон матрицы делегирования в интранет.",
        audience_json: JSON.stringify({
          category: "secondary",
          customCategory: "",
          freeText: isIntl
            ? "16 Tech Leads and Engineering Managers (Backend / Frontend Streams)"
            : "16 тимлидов и техлидов (бэкенд / фронтенд стримы)",
          groups: [
            {
              group: "parents",
              ageBand: "senior_lead",
              headCount: 16,
            },
          ],
        }),
        artifacts_json: "{}",
        prevention_link: "L4_secondary",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["ORG_BURN", "DEV_WILL"]),
        created_at: daysAgoEpoch(4),
        updated_at: daysAgoEpoch(4),
      },
      {
        session_id: "gs-corp-02",
        title: isIntl
          ? "Webinar: Overcoming Imposter Syndrome & Psychological Safety in Remote Teams"
          : "Вебинар: Синдром самозванца и психологическая безопасность в распределенных командах",
        session_date: dateDaysAgo(9),
        duration_minutes: 60,
        theme: isIntl ? "Psychological Safety & Growth Mindset" : "Психологическая безопасность и самооценка",
        notes: isIntl
          ? "Online webinar, 48 participants across 4 time zones. Polls and Q&A active."
          : "Онлайн-вебинар, 48 участников из разных городов. Активный блок вопросов про страх критики и перфекционизм.",
        plan_text: "",
        report_text: "",
        audience_json: JSON.stringify({
          category: "universal",
          customCategory: "",
          freeText: isIntl
            ? "48 employees across product and engineering streams"
            : "48 сотрудников продуктовых и инженерных команд",
          groups: [
            {
              group: "students",
              ageBand: "adults",
              headCount: 48,
            },
          ],
        }),
        artifacts_json: "{}",
        prevention_link: "L1_universal",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["DEV_SELF", "DEV_EMO"]),
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
