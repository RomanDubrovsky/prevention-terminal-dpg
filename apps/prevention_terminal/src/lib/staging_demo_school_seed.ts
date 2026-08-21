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

export function buildSchoolDemoStore(workspace: DemoWorkspace, edition: string): StagingStore {
  const isAuthority = workspace === "authority";
  const isManager = workspace === "manager" || isAuthority;
  const isIntl = edition === "intl";

  const modules = defaultEnabledModules(
    isManager ? "manager" : "specialist",
    isAuthority ? "preventive_public" : "education",
    isManager ? "manager" : "specialist",
  );
  modules.embed_client_widget = true;
  modules.consultation_journal = true;
  modules.reception_journal = true;
  modules.group_sessions = true;
  modules.reporting_panel = true;
  modules.safe_environment = true;
  modules.ipr = true;

  const terminalUserId = isAuthority ? "tu-demo-authority-12" : "tu-demo-school-321";
  const centerId = isAuthority ? "demo-authority-12" : "demo-school-321";

  // --- Кейсы ---
  const caseBullying = "case-demo-school-01";  // Кибербуллинг (Алиса + Боб)
  const caseExam     = "case-demo-school-02";  // Экзаменационная тревога (Майкл)
  const caseFamily   = "case-demo-school-03";  // Семейный конфликт (Даша)

  // --- Ученики реестра ---
  const regAlice   = "reg-demo-alice-01";
  const regBob     = "reg-demo-bob-02";
  const regMichael = "reg-demo-michael-03";
  const regSophia  = "reg-demo-sophia-04";
  const regDasha   = "reg-demo-dasha-05";

  const sessionTagsJson = (themes: string[], format = "group") =>
    JSON.stringify({
      themes: { catalog: themes, custom: [] },
      formats: { catalog: [format], custom: [] },
      methods: { catalog: ["cbt", "nvc"], custom: [] },
      techniques: { catalog: [], custom: [] },
    });

  const leads = [
    {
      id: "lead-demo-school-01",
      center_id: centerId,
      name: isIntl ? "Sarah J." : "Сара Д.",
      contact: "sarah@example.com",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Request regarding my son's bullying issue" : "Заявка по поводу буллинга сына в 8Б",
        themes: ["REL_PEER"],
      }),
      source: "embed_chat",
      user_id: null,
      status: "converted",
      created_at: daysAgoIso(5),
    },
    {
      id: "lead-demo-school-02",
      center_id: centerId,
      name: isIntl ? "Olga R." : "Ольга Р.",
      contact: "olga.r@example.com",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Daughter cries in mornings, refuses school (Grade 1)" : "Дочь плачет по утрам, отказывается идти в школу (1 класс)",
        themes: ["DEV_EMO", "EDU_SELF"],
      }),
      source: "embed_chat",
      user_id: null,
      status: "new",
      created_at: daysAgoIso(1),
    },
  ];

  return {
    unlocked: true,
    installationMeta: {
      install_id: isAuthority ? "install-demo-authority" : "install-demo-school",
      country: isIntl ? "US" : "RU",
      region: isIntl ? "New York" : "Москва",
      municipality: isIntl ? "Manhattan" : "ЦАО",
      settlement: isIntl ? "New York City" : "Москва",
      lat: 55.75,
      lng: 37.62,
      organization_type: isAuthority ? "preventive_public" : "school",
      organization_label: isIntl
        ? isAuthority ? "District Education Authority #12" : "International Public School #321"
        : isAuthority ? "Управление образования Центрального района" : "ГБОУ Школа №321",
      org_unit_id: null,
      org_unit_status: "local",
      telemetry_consent: false,
      created_at: daysAgoIso(90),
      updated_at: daysAgoIso(0),
    },
    orgProfile: {
      display_name: isIntl
        ? isAuthority ? "District Education Authority #12" : "Public School #321"
        : isAuthority ? "Управление образования Центрального района" : "ГБОУ Школа №321",
      isced_level: 2,
      org_kind: "combined_school",
      normative_overrides: "{}",
      approx_learner_count: 1200,
      org_sphere: "education_system",
      org_sphere_other: "",
      education_org_type: "general",
      approx_learner_ovz_count: 62,
    },
    specialistProfile: {
      display_name: isIntl
        ? isAuthority ? "Dr. Alexander Vance" : isManager ? "Dr. Helen Smith" : "David Martinez"
        : isAuthority ? "Воронцов Александр Сергеевич" : isManager ? "Смирнова Елена Николаевна" : "Мартинес Давид Иванович",
      role_text: isIntl
        ? isAuthority ? "Head of Education Authority" : isManager ? "Principal" : "School Psychologist"
        : isAuthority ? "Начальник Управления образования" : isManager ? "Директор" : "Педагог-психолог",
      weekly_contract_minutes: isManager ? 0 : 2160,
    },
    terminalConfig: {
      terminal_user_id: terminalUserId,
      edition: edition as "ru" | "intl",
      mode: isManager ? "manager" : "specialist",
      workspace_preset: isManager ? "manager" : "specialist",
      org_type: isAuthority ? "preventive_public" : "education",
      manager_scope: isAuthority ? "territorial" : null,
      job_title: isIntl
        ? isAuthority ? "Head of Education Authority" : isManager ? "Principal" : "School Psychologist"
        : isAuthority ? "Начальник Управления образования" : isManager ? "Директор" : "Педагог-психолог",
      child_invite_code: "CHILD-DEMOSCHOOL01",
      parent_invite_code: isManager ? "PARENT-DEMOSCHOOL01" : null,
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
      created_at: daysAgoIso(90),
      updated_at: daysAgoIso(0),
    },
    sitePortal: {
      center_id: centerId,
      setup_token: "demo-setup-token-32chars-minimum",
      inbox_login: "demo-inbox",
      inbox_password: "demo-pass-123",
      iconostasis_columns: 3,
      consult_booking_url: "",
      booking_mode: "internal",
      public_site_origin: "https://demo-school.example",
      site_page_paths_json: '{"consult":"/booking","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}',
      leads_export_webhook_url: "",
    },
    cases: [
      // --- Реестр: ученики ---
      {
        id: regAlice,
        created_at: daysAgoIso(28),
        updated_at: daysAgoIso(2),
        y_level: "Y2_Risk",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Alice Johnson (8th Grade)" : "Алиса Джонсон (8 класс)",
          registry_profile: {
            full_name: isIntl ? "Alice Johnson" : "Алиса Джонсон",
            gender: "female",
            age_years: 14,
            grade_class: "8Б",
            birth_date: "2012-05-14",
            phone: "",
            email: "",
            address: "",
            contact_person: isIntl ? "Sarah J. (Mother)" : "Сара Д. (Мама)",
            notes: isIntl
              ? "Victim of cyberbullying in class chat."
              : "Жертва кибербуллинга в чате класса. Сниженная самооценка, тенденция к самоизоляции.",
          },
        }),
      },
      {
        id: regBob,
        created_at: daysAgoIso(25),
        updated_at: daysAgoIso(2),
        y_level: "Y2_Risk",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Bob Miller (8th Grade)" : "Боб Миллер (8 класс)",
          registry_profile: {
            full_name: isIntl ? "Bob Miller" : "Боб Миллер",
            gender: "male",
            age_years: 14,
            grade_class: "8Б",
            birth_date: "2012-02-10",
            phone: "",
            email: "",
            address: "",
            contact_person: "",
            notes: isIntl
              ? "Aggressive behavior, initiator of class conflict."
              : "Агрессивное поведение, инициатор конфликта. Запрос к родителям отправлен.",
          },
        }),
      },
      {
        id: regMichael,
        created_at: daysAgoIso(18),
        updated_at: daysAgoIso(4),
        y_level: "Y2_Risk",
        x_stage: "X3_Intervention",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Michael Chen (11th Grade)" : "Майкл Чен (11 класс)",
          registry_profile: {
            full_name: isIntl ? "Michael Chen" : "Майкл Чен",
            gender: "male",
            age_years: 17,
            grade_class: "11А",
            birth_date: "2009-08-22",
            phone: "",
            email: "",
            address: "",
            contact_person: "",
            notes: isIntl
              ? "High exam anxiety. Perfectionism. Panic attacks before mock exams."
              : "Высокая тревожность перед экзаменами. Перфекционизм. Панические атаки на пробных ОГЭ.",
          },
        }),
      },
      {
        id: regSophia,
        created_at: daysAgoIso(30),
        updated_at: daysAgoIso(10),
        y_level: "Y1_Norm",
        x_stage: "X1_Intake",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Sophia R. (1st Grade)" : "София Р. (1 класс)",
          registry_profile: {
            full_name: isIntl ? "Sophia R." : "София Р.",
            gender: "female",
            age_years: 7,
            grade_class: "1В",
            birth_date: "2019-01-15",
            phone: "",
            email: "",
            address: "",
            contact_person: "Ольга Р. (Мама)",
            notes: isIntl
              ? "Adaptation difficulties, school refusal."
              : "Трудности адаптации к школе, школьный отказ. Плачет утром. Низкая коммуникация с одноклассниками.",
          },
        }),
      },
      {
        id: regDasha,
        created_at: daysAgoIso(12),
        updated_at: daysAgoIso(3),
        y_level: "Y2_Risk",
        x_stage: "X2_Assessment",
        notes: "",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Dasha Kozlova (6th grade)" : "Даша Козлова (6 класс)",
          registry_profile: {
            full_name: isIntl ? "Dasha Kozlova" : "Даша Козлова",
            gender: "female",
            age_years: 12,
            grade_class: "6A",
            birth_date: "2014-03-07",
            phone: "",
            email: "",
            address: "",
            contact_person: isIntl ? "Irina K. (Mother, divorced)" : "Ирина К. (Мама, в разводе)",
            notes: isIntl
              ? "Parents divorced 3 months ago. Sharp drop in academic grades, classroom aggression, withdrawal."
              : "Родители в разводе 3 месяца назад. Резкое снижение успеваемости, агрессия на уроках, замкнутость.",
          },
        }),
      },
      // --- Кейсы (ситуации) ---
      {
        id: caseBullying,
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(2),
        y_level: "Y3_Problem",
        x_stage: "X3_Intervention",
        notes: isIntl ? "Class 8B cyberbullying incident." : "Инцидент с кибербуллингом в 8Б.",
        case_artifacts_json: JSON.stringify({
          record_kind: "situation",
          situation_title: isIntl ? "8B Cyberbullying (Alice & Bob)" : "8Б — Кибербуллинг (Алиса и Боб)",
          situation_kind: "group_conflict",
          primary_description: isIntl
            ? "Alice is being targeted in a group chat created by Bob. Offensive messages and photos shared without consent."
            : "Алису травят в групповом чате, созданном Бобом. Оскорбительные сообщения, фотографии без согласия. Подключены классный руководитель и родители.",
          expert_by_participant: {
            "alias-demo-s1": {
              child_profile: {
                text: isIntl
                  ? "Alice demonstrates high anxiety and withdrawal after cyberbullying."
                  : "Алиса Д. демонстрирует высокий уровень тревожности, сниженную самооценку и тенденцию к самоизоляции после инцидента с кибербуллингом. По методике Спилбергера: ситуативная тревожность 58 баллов (высокая).",
                saved_at: daysAgoIso(5),
              },
              conclusion: {
                text: isIntl
                  ? "Anxiety state. Recommended individual consultations and peer support group."
                  : "Психологическое заключение 025/у: Рекомендуется курс индивидуальной психотерапии (8–10 сессий), направленный на проработку травматического опыта буллинга. Включение в группу психологической поддержки.",
                saved_at: daysAgoIso(5),
              },
            },
            "alias-demo-s2": {
              fba: {
                text: isIntl
                  ? "Cyberbullying behavior functions to gain peer attention and social dominance."
                  : "Анализ поведения Боба М. (ФАП): агрессивное поведение в чате выполняет функцию привлечения внимания сверстников и утверждения социального доминирования. Функциональный аналог — поиск признания.",
                saved_at: daysAgoIso(4),
              },
              bip: {
                text: isIntl
                  ? "BIP: Teach prosocial leader strategies. Behavioral contract with class teacher."
                  : "План поведенческого вмешательства (BIP): Обучение Боба альтернативным просоциальным способам лидерства, введение поведенческого контракта с классным руководителем. Контроль еженедельно.",
                saved_at: daysAgoIso(4),
              },
              mdr: {
                text: isIntl
                  ? "PPC Recommendation: Group empathy training. Parental meeting scheduled."
                  : "Заключение ППк: Рекомендована групповая работа по развитию эмпатии и снижению вербальной агрессии. Встреча с родителями назначена на 25.07.",
                saved_at: daysAgoIso(4),
              },
            },
          },
        }),
      },
      {
        id: caseExam,
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(4),
        y_level: "Y2_Risk",
        x_stage: "X3_Intervention",
        notes: isIntl ? "Exam stress for 11th grade." : "Стресс перед ОГЭ/ЕГЭ, 11 класс.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Michael - Exam Anxiety" : "Майкл — Экзаменационная тревога",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Panic attacks before mock exams. Sleep disturbances, somatic complaints."
            : "Панические атаки перед пробными экзаменами. Нарушение сна, соматические жалобы (тахикардия). Самооценка занижена. Страх провала.",
        }),
      },
      {
        id: caseFamily,
        created_at: daysAgoIso(12),
        updated_at: daysAgoIso(3),
        y_level: "Y2_Risk",
        x_stage: "X2_Assessment",
        notes: isIntl ? "Family situation, parental divorce. Referred by teacher." : "Семейная ситуация, развод родителей. Обратилась классный руководитель.",
        case_artifacts_json: JSON.stringify({
          record_kind: "consultation_lite",
          situation_title: isIntl ? "Dasha K. — Family conflict, adaptation" : "Даша К. — Семейный конфликт, адаптация",
          situation_kind: "individual_therapy",
          primary_description: isIntl
            ? "Parents divorced 3 months ago. Child lives with mother. Aggression in class, sleep disturbances, drop in grades from A to C. According to the teacher, she became withdrawn."
            : "Родители развелись 3 месяца назад. Ребёнок живёт с мамой. Агрессия в классе, нарушение режима сна, снижение успеваемости с 4 до 2-3. По данным классного руководителя — стала замкнутой.",
        }),
      },
    ],
    caseAliases: [
      { case_id: caseBullying, alias_id: "alias-demo-s1", role: "victim",    role_no: 1, real_name: isIntl ? "Alice J."   : "Алиса Д." },
      { case_id: caseBullying, alias_id: "alias-demo-s2", role: "aggressor", role_no: 1, real_name: isIntl ? "Bob M."     : "Боб М." },
      { case_id: caseExam,     alias_id: "alias-demo-s3", role: "client",    role_no: 1, real_name: isIntl ? "Michael C." : "Майкл Ч." },
      { case_id: caseFamily,   alias_id: "alias-demo-s4", role: "client",    role_no: 1, real_name: isIntl ? "Dasha K."   : "Даша К." },
    ],
    sessionRecords: [
      {
        record_id: "sess-demo-sch-01",
        case_id: caseBullying,
        session_no: 0,
        content_json: JSON.stringify({
          primaryDescription: isIntl ? "Mediation meeting regarding chat incident." : "Медиативная встреча по инциденту в чате.",
          problemThemes: emptyTags(["REL_PEER"]),
        }),
        recorded_at: daysAgoIso(14),
        created_at: daysAgoIso(14),
      },
      {
        record_id: "sess-demo-sch-02",
        case_id: caseExam,
        session_no: 0,
        content_json: JSON.stringify({
          primaryDescription: isIntl ? "Initial anxiety diagnostics. Spielberger test, projective drawing tests." : "Первичная диагностика тревожности. Методика Спилбергера, рисуночные тесты.",
          problemThemes: emptyTags(["EDU_SELF", "DEV_EMO"]),
        }),
        recorded_at: daysAgoIso(18),
        created_at: daysAgoIso(18),
      },
      {
        record_id: "sess-demo-sch-03",
        case_id: caseFamily,
        session_no: 0,
        content_json: JSON.stringify({
          primaryDescription: isIntl ? "Request from teacher. Initial meeting with Dasha. Expresses anger at mother and father." : "Запрос от классного руководителя. Первичная беседа с Дашей. Выражает злость на маму и папу.",
          problemThemes: emptyTags(["FAM_CONF"]),
        }),
        recorded_at: daysAgoIso(12),
        created_at: daysAgoIso(12),
      },
    ],
    workLog: [
      // --- Консультации (8 записей) ---
      {
        entry_id: "wl-demo-sch-1",
        case_id: caseBullying,
        action_kind: "consultation",
        minutes: 60,
        created_at: daysAgoEpoch(14, 11),
        note: consultationNote({
          goal: isIntl ? "Mediation meeting between Alice and Bob, setting ground rules" : "Медиативная встреча Алисы и Боба, установка правил",
          observations: isIntl ? "Bob was defensive, Alice was withdrawn. Tense verbal atmosphere." : "Боб защищался, Алиса была замкнута. Тон агрессивный.",
          intervention: isIntl ? "Restorative practices dialogue. Teaching 'I-statements' technique." : "Диалог по восстановительным практикам. Техника «Я-высказываний».",
          assessment: isIntl ? "Bob agreed to delete the group chat. Tense but productive session." : "Боб согласился удалить чат. Напряженно, но продуктивно.",
          plan: isIntl ? "Follow-up meeting in one week. Brief the class teacher." : "Повторная встреча через неделю. Информировать классного руководителя.",
          themes: ["REL_PEER"],
          visitDate: dateDaysAgo(14),
        }),
      },
      {
        entry_id: "wl-demo-sch-2",
        case_id: caseExam,
        action_kind: "consultation",
        minutes: 45,
        created_at: daysAgoEpoch(10, 14),
        note: consultationNote({
          goal: isIntl ? "Reduce test-related anxiety, learn self-regulation techniques" : "Снизить тревожность перед тестами, освоить техники саморегуляции",
          observations: isIntl ? "Complains of sleep loss, hand tremors. Catastrophizes test outcomes." : "Жалобы на потерю сна, тремор рук. Катастрофизирует исход экзамена.",
          intervention: isIntl ? "CBT reframing ('worst case is not the end of the world'). 5-4-3-2-1 grounding technique." : "КПТ-рефрейминг («худший сценарий — не конец света»). Техника заземления 5-4-3-2-1.",
          assessment: isIntl ? "Michael successfully applied grounding in session. Anxiety decreased from 8/10 to 5/10." : "Майкл успешно применил заземление на сессии. Уровень тревоги снизился с 8/10 до 5/10.",
          plan: isIntl ? "Practice 5-4-3-2-1 technique before sleep. Keep anxiety diary." : "Практиковать технику 5-4-3-2-1 перед сном. Дневник тревоги.",
          themes: ["EDU_SELF", "DEV_EMO"],
          visitDate: dateDaysAgo(10),
        }),
      },
      {
        entry_id: "wl-demo-sch-3",
        case_id: caseBullying,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(7, 10),
        note: consultationNote({
          goal: isIntl ? "Individual work with Alice — restoring self-esteem" : "Индивидуальная работа с Алисой — восстановление самооценки",
          observations: isIntl ? "Alice is less withdrawn than last week. Made contact with one friend." : "Алиса менее замкнута, чем неделю назад. Появился контакт с одной подругой.",
          intervention: isIntl ? "Narrative therapy — re-authoring the story. 'Letter to myself' technique." : "Нарративная терапия — переписывание истории. Техника «Письмо себе».",
          assessment: isIntl ? "Positive progress. Started talking about the future in a hopeful way." : "Положительная динамика. Начала говорить о будущем в позитивном ключе.",
          plan: isIntl ? "Continue individual sessions. Evaluate inclusion in support group." : "Продолжить индивидуальные встречи. Рассмотреть включение в группу поддержки.",
          themes: ["DEV_EMO", "REL_PEER"],
          visitDate: dateDaysAgo(7),
        }),
      },
      {
        entry_id: "wl-demo-sch-4",
        case_id: caseFamily,
        action_kind: "consultation",
        minutes: 40,
        created_at: daysAgoEpoch(5, 15),
        note: consultationNote({
          goal: isIntl ? "Normalize Dasha's emotional state, provide coping tools" : "Нормализовать эмоциональное состояние Даши, дать инструменты",
          observations: isIntl ? "Angry at both parents. Thinks they stopped loving her, not each other." : "Злится на обоих родителей. Думает, что разлюбили её, а не друг друга.",
          intervention: isIntl ? "Psychoeducation about divorce for kids. Drawing technique 'My emotions now'." : "Психоедукация о разводе для детей. Рисуночная техника «Мои эмоции сейчас».",
          assessment: isIntl ? "Partially reduced self-blame. Cried during session — good connection with feelings." : "Частично удалось снизить самообвинение. Плакала — это хорошо, контакт с чувствами.",
          plan: isIntl ? "Meeting with mother separately. Recommend family counseling." : "Встреча с мамой отдельно. Рекомендована семейная консультация.",
          themes: ["FAM_CONF", "DEV_EMO"],
          visitDate: dateDaysAgo(5),
        }),
      },
      {
        entry_id: "wl-demo-sch-5",
        case_id: caseExam,
        action_kind: "consultation",
        minutes: 45,
        created_at: daysAgoEpoch(4, 11),
        note: consultationNote({
          goal: isIntl ? "Learn diaphragmatic breathing, reduce somatic symptoms" : "Освоить диафрагмальное дыхание, снизить соматику",
          observations: isIntl ? "Fewer complaints of tremors. Keeping anxiety diary — good job." : "Меньше жалоб на тремор. Ведёт дневник тревоги — молодец.",
          intervention: isIntl ? "4-4-4 breathing technique. Progressive muscle relaxation (Jacobson)." : "4-4-4 техника дыхания. Прогрессивная мышечная релаксация (Джекобсон).",
          assessment: isIntl ? "PMR partially mastered. Needs practice. Anxiety rated at 6/10." : "ПМР освоена частично. Нужна практика. Тревога по шкале 6/10.",
          plan: isIntl ? "Daily PMR for 15 minutes. Next session in 5 days." : "Ежедневная ПМР 15 минут. Следующая встреча через 5 дней.",
          themes: ["EDU_SELF"],
          methods: ["relaxation", "cbt"],
          visitDate: dateDaysAgo(4),
        }),
      },
      {
        entry_id: "wl-demo-sch-6",
        case_id: caseBullying,
        action_kind: "consultation",
        minutes: 30,
        created_at: daysAgoEpoch(3, 14),
        note: consultationNote({
          goal: isIntl ? "Work with Bob — developing empathy" : "Работа с Бобом — развитие эмпатии",
          observations: isIntl ? "More open than expected. Mentions he 'didn't want it to end up like this'." : "Более открыт, чем ожидалось. Говорит, что «не хотел так».",
          intervention: isIntl ? "'Put yourself in other's shoes' technique. Deconstructing Alice's emotions." : "Техника «Встань на место другого». Разбор эмоций Алисы.",
          assessment: isIntl ? "Acknowledged the harm caused. Showed regret — progress." : "Признал причинённый вред. Появилось сожаление — прогресс.",
          plan: isIntl ? "Include in a 9th grade classroom group prevention session about bullying." : "Ввести в групповую сессию по профилактике буллинга в 9 классе.",
          risk: "low",
          themes: ["REL_PEER", "DEV_EMO"],
          visitDate: dateDaysAgo(3),
        }),
      },
      {
        entry_id: "wl-demo-sch-7",
        case_id: caseFamily,
        action_kind: "consultation",
        minutes: 60,
        created_at: daysAgoEpoch(2, 10),
        note: consultationNote({
          goal: isIntl ? "Meeting with mother Irina K. — parental consultation" : "Встреча с мамой Ирина К. — родительская консультация",
          observations: isIntl ? "Mother is stressed. Asks how to 'explain to daughter that everything is fine'." : "Мама сама в стрессе. Просит помочь «объяснить дочке, что всё хорошо».",
          intervention: isIntl ? "Psychoeducation on the role of stability in a child's life during divorce. Schedule guidelines." : "Психоедукация о роли стабильности в жизни ребёнка при разводе. Рекомендации по режиму.",
          assessment: isIntl ? "Mother is cooperative. Agreed on a stable daily routine." : "Мама открыта к сотрудничеству. Договорились о постоянном режиме дня.",
          plan: isIntl ? "Joint meeting with father if he agrees. Check-in in 2 weeks." : "Совместная встреча с папой при его согласии. Контроль через 2 недели.",
          themes: ["FAM_CONF"],
          visitDate: dateDaysAgo(2),
        }),
      },
      {
        entry_id: "wl-demo-sch-8",
        case_id: caseExam,
        action_kind: "consultation",
        minutes: 45,
        created_at: daysAgoEpoch(1, 11),
        note: consultationNote({
          goal: isIntl ? "Final session of the cycle — verifying stability" : "Итоговая сессия цикла — проверка стабильности",
          observations: isIntl ? "Michael reports feeling better. Anxiety scale 4/10. Sleeping normally." : "Майкл говорит, что стало лучше. Шкала тревоги 4/10. Спит нормально.",
          intervention: isIntl ? "Cognitive restructuring of beliefs about exams. Relapse prevention." : "Когнитивная реструктуризация убеждений об экзаменах. Профилактика рецидива.",
          assessment: isIntl ? "Positive dynamics. Exams in 12 days. Ready." : "Динамика положительная. ОГЭ через 12 дней. Готов.",
          plan: isIntl ? "Meeting after the first exam. Recommend follow-up in 11th grade." : "Встреча после первого экзамена. По итогу — рекомендация для 11 класса.",
          themes: ["EDU_SELF", "DEV_EMO"],
          visitDate: dateDaysAgo(1),
        }),
      },
    ],
    requests: [],
    groupSessions: [
      {
        session_id: "gs-demo-sch-01",
        title: isIntl ? "Anti-Bullying Workshop (Grade 8)" : "Семинар против буллинга (8 класс)",
        session_date: dateDaysAgo(5),
        duration_minutes: 45,
        theme: isIntl ? "Respect and peer relations" : "Уважение и отношения со сверстниками",
        notes: isIntl ? "Interactive workshop for Grade 8 classrooms. 24 students." : "Интерактивный семинар для параллели 8-х классов. 24 ученика.",
        plan_text: isIntl
          ? "Introduction (5m) → Roleplay game 'In their shoes' (20m) → Group reflection (10m) → Feedback (10m)"
          : "Введение (5 мин) → Ролевая игра «На чужом месте» (20 мин) → Групповая рефлексия (10 мин) → Обратная связь (10 мин)",
        report_text: isIntl
          ? "High engagement. Several students shared personal experiences. Bob M. participated — clear reflection noticed. Teacher requested follow-up."
          : "Высокая вовлечённость. Несколько учеников поделились личным опытом. Боб М. участвовал — заметна рефлексия. Запрошена повторная сессия классным руководителем.",
        audience_json: JSON.stringify({ grade_level: "8", participant_count: 24, format: "whole_class" }),
        artifacts_json: "{}",
        prevention_link: "L1_universal",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["REL_PEER"]),
        created_at: daysAgoEpoch(5),
        updated_at: daysAgoEpoch(5),
      },
      {
        session_id: "gs-demo-sch-02",
        title: isIntl ? "Communication Skills — Class 5A" : "Навыки общения — 5А класс",
        session_date: dateDaysAgo(12),
        duration_minutes: 40,
        theme: isIntl ? "Communication and emotional intelligence" : "Коммуникация и эмоциональный интеллект",
        notes: isIntl ? "30 students. First meeting of 'Communication School' cycle." : "30 учеников. Первая встреча из цикла «Школа коммуникации».",
        plan_text: isIntl
          ? "Warm-up 'Name and Gesture' (5m) → Mini-lecture on communication styles (10m) → Active Listening exercise (15m) → Reflection (10m)"
          : "Разминка — «Имя и жест» (5 мин) → Мини-лекция о видах общения (10 мин) → Упражнение «Активное слушание» (15 мин) → Рефлексия (10 мин)",
        report_text: isIntl
          ? "High activity. Children enjoyed the exercises. Three more sessions scheduled."
          : "Высокая активность. Дети с удовольствием участвовали в упражнениях. Запланировано ещё 3 встречи.",
        audience_json: JSON.stringify({ grade_level: "5", participant_count: 30, format: "whole_class" }),
        artifacts_json: "{}",
        prevention_link: "L1_universal",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["DEV_EMO", "REL_PEER"]),
        created_at: daysAgoEpoch(12),
        updated_at: daysAgoEpoch(12),
      },
      {
        session_id: "gs-demo-sch-03",
        title: isIntl ? "Support Group — 9A (Exam Preparation)" : "Группа поддержки — 9А (подготовка к ОГЭ)",
        session_date: dateDaysAgo(8),
        duration_minutes: 60,
        theme: isIntl ? "Anxiety management and school stress" : "Управление тревогой и учебный стресс",
        notes: isIntl ? "Group of 12 students at-risk for anxiety. Selective prevention level." : "Группа из 12 учеников группы риска по тревожности. Селективный уровень профилактики.",
        plan_text: isIntl
          ? "Check-in: anxiety scale (5m) → Cognitive restructuring (20m) → Breathing techniques practice (20m) → Sharing (15m)"
          : "Чекин — шкала тревоги (5 мин) → Когнитивное переструктурирование (20 мин) → Практика дыхательных техник (20 мин) → Шеринг (15 мин)",
        report_text: isIntl
          ? "Michael C. participated — opened up to the group. 10 of 12 reduced self-rated anxiety. Group cohesion building."
          : "Майкл Ч. участвовал — заметно открылся группе. 10 из 12 снизили самооценку тревоги за сессию. Группа сплачивается.",
        audience_json: JSON.stringify({ grade_level: "9", participant_count: 12, format: "support_group" }),
        artifacts_json: "{}",
        prevention_link: "L2_selective",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["EDU_SELF", "DEV_EMO"]),
        created_at: daysAgoEpoch(8),
        updated_at: daysAgoEpoch(8),
      },
      {
        session_id: "gs-demo-sch-04",
        title: isIntl ? "Bullying Prevention — Class 9B" : "Профилактика буллинга — 9Б класс",
        session_date: dateDaysAgo(18),
        duration_minutes: 45,
        theme: isIntl ? "Respect and non-violent communication" : "Бережное отношение и ненасильственное общение",
        notes: isIntl ? "28 students. Second visit to this grade on director's request." : "28 учеников. Второй визит в эту параллель по запросу директора.",
        plan_text: isIntl
          ? "Defining 'bullying' vs 'conflict' (10m) → Case study discussion (15m) → 'Freeze frame' roleplay (15m) → Outcomes (5m)"
          : "Введение понятий «буллинг» и «конфликт» (10 мин) → Кейс-разбор (15 мин) → Ролевая игра «Стоп-кадр» (15 мин) → Итоги (5 мин)",
        report_text: isIntl
          ? "Class initially resisted. Open dialogue by end of session. 4 students requested individual consults after class."
          : "Класс поначалу сопротивлялся теме. К концу сессии открытый диалог. 4 ученика обратились лично после занятия.",
        audience_json: JSON.stringify({ grade_level: "9", participant_count: 28, format: "whole_class" }),
        artifacts_json: "{}",
        prevention_link: "L1_universal",
        prevention_work_types_json: "{}",
        session_tags_json: sessionTagsJson(["REL_PEER", "DEV_EMO"]),
        created_at: daysAgoEpoch(18),
        updated_at: daysAgoEpoch(18),
      },
    ],
    workEntries: [
      { entry_id: "we-sch-1", date: dateDaysAgo(14), category: "consultation", minutes: 120, note: isIntl ? "Mediation 8B, prep materials" : "Медиация 8Б, подготовка материалов" },
      { entry_id: "we-sch-2", date: dateDaysAgo(12), category: "diagnostics",  minutes: 90,  note: isIntl ? "Initial diagnostics (Spielberger, projective)" : "Первичная диагностика (Тест Спилбергера, рисунки)" },
      { entry_id: "we-sch-3", date: dateDaysAgo(8),  category: "group",        minutes: 60,  note: isIntl ? "Group session exam prep 9A" : "Групповая сессия ОГЭ 9А" },
      { entry_id: "we-sch-4", date: dateDaysAgo(5),  category: "group",        minutes: 45,  note: isIntl ? "Bullying workshop Grade 8" : "Семинар против буллинга 8 класс" },
      { entry_id: "we-sch-5", date: dateDaysAgo(3),  category: "documentation", minutes: 60,  note: isIntl ? "Drafting IPR for Alice J." : "Оформление ИПР Алиса Д., заключение 025/у" },
      { entry_id: "we-sch-6", date: dateDaysAgo(2),  category: "consultation", minutes: 60,  note: isIntl ? "Parent consult (Dasha's mother)" : "Родительская консультация (мама Даши)" },
      { entry_id: "we-sch-7", date: dateDaysAgo(1),  category: "consultation", minutes: 45,  note: isIntl ? "Final session Michael C." : "Итоговая сессия Майкл Ч." },
    ],
    organizationPrograms: [
      {
        program_id: "op-demo-sch-01",
        title: isIntl ? "Bullying Prevention & Safe Environment" : "Профилактика буллинга и безопасная среда",
        program_year: "2025–2026",
        scope: isIntl ? "Whole school (Grades 1–11, 1200 students)" : "Вся школа (1–11 классы, 1200 уч.)",
        notes: isIntl
          ? "Comprehensive program to build a safe educational environment. Designed based on MHPSS standards. Includes universal and selective prevention levels."
          : "Комплексная программа организации безопасной образовательной среды. Разработана по стандарту MHPSS. Включает универсальный и селективный уровни профилактики.",
        plan_text: isIntl
          ? [
              "1. Diagnostic Phase (Sept): Start screening of psychological climate. Comfort survey.",
              "2. Awareness Phase (Oct-Nov): Class hours 'Respect and Non-Violent Communication'. Parent seminars.",
              "3. Intervention Phase (Dec-Apr): At-risk support groups. Individual cases. Conflict mediation.",
              "4. Evaluation Phase (May): Re-diagnostics. Report for principal and education board.",
            ].join("\n")
          : [
              "1. Диагностический этап (сентябрь): Стартовая диагностика психологического климата. Анкетирование «Безопасность и комфорт» (5–11 кл).",
              "2. Просветительский этап (октябрь–ноябрь): Серия классных часов «Уважение и ненасильственное общение». Семинары для родителей.",
              "3. Интервенционный этап (декабрь–апрель): Работа с группами риска. Индивидуальные кейсы. Медиация конфликтов.",
              "4. Оценочный этап (май): Повторная диагностика. Отчёт для директора и управления образования.",
            ].join("\n"),
        report_text: isIntl
          ? [
              "First semester: completed 12 group sessions (312 participants), 28 individual consults.",
              "6 bullying cases identified — all in intervention. 2 cases closed with positive outcomes.",
              "Active support group for grade 9 (exam prep) — 12 participants.",
            ].join("\n")
          : [
              "Первое полугодие: проведено 12 групповых занятий (312 участников), 28 индивидуальных консультаций.",
              "Выявлено 6 случаев буллинга — все взяты в работу. 2 случая закрыты с положительной динамикой.",
              "Активна группа поддержки для 9-классников (подготовка к ОГЭ) — 12 участников.",
            ].join("\n"),
        artifacts_json: "{}",
        audience_json: JSON.stringify({ target: "whole_school", learner_count: 1200 }),
        prevention_link: "L1_universal",
        prevention_work_types_json: JSON.stringify({ types: ["classroom_lessons", "peer_support", "mediation", "parent_meetings"] }),
        created_at: daysAgoEpoch(90),
        updated_at: daysAgoEpoch(5),
      },
      {
        program_id: "op-demo-sch-02",
        title: isIntl ? "Grade 1 Adaptation Program" : "Адаптация первоклассников",
        program_year: "2025",
        scope: isIntl ? "First grades (Classes 1A, 1B, 1C — 72 students)" : "1-е классы (1А, 1Б, 1В — 72 уч.)",
        notes: isIntl
          ? "Psycho-educational support program for first-graders during adaptation (Sept–Dec 2025)."
          : "Программа психолого-педагогического сопровождения первоклассников в период адаптации (сентябрь–декабрь 2025).",
        plan_text: isIntl
          ? [
              "September: Observation in classrooms. Anxiety diagnostics.",
              "October: Development lessons 'I am at school' (3 sessions per class).",
              "November: Parent engagement. Request-based counseling.",
              "December: Outcome diagnostics. Recommendations for teachers.",
            ].join("\n")
          : [
              "Сентябрь: Наблюдение в классах. Диагностика тревожности (метод Лаврентьевой–Титаренко).",
              "Октябрь: Развивающие занятия «Я в школе» (3 сессии на класс).",
              "Ноябрь: Работа с родителями. Консультации по запросу.",
              "Декабрь: Итоговая диагностика. Рекомендации учителям.",
            ].join("\n"),
        report_text: isIntl
          ? "Program completed. Covered 68 of 72 students. 4 identified with school phobia — referred to individual support. General adaptation: 1A — 89%, 1B — 92%, 1C — 81%."
          : "Программа завершена. Охват 68 из 72 учеников. У 4 выявлена школьная фобия — взяты в индивидуальное сопровождение. Общая адаптация по классам: 1А — 89%, 1Б — 92%, 1В — 81%.",
        artifacts_json: "{}",
        audience_json: JSON.stringify({ target: "grade_1", learner_count: 72 }),
        prevention_link: "L1_universal",
        prevention_work_types_json: JSON.stringify({ types: ["classroom_lessons", "parent_meetings", "diagnostics"] }),
        created_at: daysAgoEpoch(200),
        updated_at: daysAgoEpoch(60),
      },
    ],
    iprs: [
      {
        id: "ipr-demo-sch-01",
        case_id: caseBullying,
        title: isIntl ? "IPR — Alice J. (rehabilitation after bullying)" : "ИПР — Алиса Д. (реабилитация после буллинга)",
        description: isIntl
          ? "Individual psychological support plan after cyberbullying experience. Goals: restore self-esteem, decrease anxiety, reintegrate into class community."
          : "Индивидуальный план психологического сопровождения после пережитого кибербуллинга. Цели: восстановление самооценки, снижение тревожности, реинтеграция в коллектив.",
        status: "active",
        plan_text: isIntl
          ? "Support pathway is scheduled for 3 months (April-June). Includes individual consults, support group participation, and teacher coordination."
          : "Маршрут сопровождения рассчитан на 3 месяца (апрель–июнь). Включает индивидуальные консультации, участие в группе поддержки, координацию с классным руководителем.",
        report_text: isIntl
          ? "After 6 weeks: anxiety level decreased from 8/10 to 4/10. Friendly peer contacts emerged. Participates in class activities. Mother reports improved sleep."
          : "По итогам 6 недель: уровень тревоги снизился с 8/10 до 4/10. Появились дружеские контакты. Участвует в жизни класса. Мама отмечает улучшение сна.",
        artifacts_json: "{}",
        audience_json: "{}",
        session_tags_json: "{}",
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(2),
      },
      {
        id: "ipr-demo-sch-02",
        case_id: caseExam,
        title: isIntl ? "IPR — Michael C. (reducing exam anxiety)" : "ИПР — Майкл Ч. (снижение экзаменационной тревоги)",
        description: isIntl
          ? "Individual support plan before final exams. Goals: learn self-regulation techniques, reduce catastrophizing, increase academic self-efficacy."
          : "Индивидуальный план сопровождения перед ОГЭ. Цели: освоение техник саморегуляции, снижение катастрофизации, повышение академической самоэффективности.",
        status: "active",
        plan_text: isIntl
          ? "Cycle of 6 individual sessions + participation in 9A support group. Homework: anxiety diary, daily PMR."
          : "Цикл из 6 индивидуальных сессий + участие в групповой поддержке 9А. Домашние задания: дневник тревоги, ежедневная ПМР.",
        report_text: isIntl
          ? "Completed 5 out of 6 sessions. Significant positive dynamics. Ready for exams."
          : "Завершено 5 из 6 сессий. Значительная положительная динамика. Готов к ОГЭ.",
        artifacts_json: "{}",
        audience_json: "{}",
        session_tags_json: "{}",
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(1),
      },
    ],
    iprSteps: [
      // ИПР Алисы
      {
        id: "ipr-step-demo-01",
        ipr_id: "ipr-demo-sch-01",
        order_no: 1,
        title: isIntl ? "Individual psychologist consults (8 sessions)" : "Индивидуальные консультации психолога (8 сессий)",
        description: isIntl
          ? "Narrative therapy, working with traumatic experience, restoring self-image."
          : "Нарративная терапия, работа с травматическим опытом, восстановление образа Я.",
        target_date: daysAgoIso(-14),
        status: "in_progress",
        notes: isIntl ? "Completed 4 out of 8 sessions. Dynamics are positive." : "Проведено 4 из 8 сессий. Динамика положительная.",
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(2),
      },
      {
        id: "ipr-step-demo-02",
        ipr_id: "ipr-demo-sch-01",
        order_no: 2,
        title: isIntl ? "Inclusion in psychological support group" : "Включение в группу психологической поддержки",
        description: isIntl
          ? "Participation in a weekly support group for teenagers with anxiety."
          : "Участие в еженедельной группе поддержки для подростков с тревожностью.",
        target_date: daysAgoIso(-7),
        status: "done",
        notes: isIntl ? "Joined 9A group. Welcomed warmly by participants." : "Присоединилась к группе 9А. Хорошо принята участниками.",
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(5),
      },
      {
        id: "ipr-step-demo-03",
        ipr_id: "ipr-demo-sch-01",
        order_no: 3,
        title: isIntl ? "Coordination with class teacher" : "Координация с классным руководителем",
        description: isIntl ? "Weekly review exchange. Correcting approach in the classroom." : "Еженедельный обмен наблюдениями. Корректировка подхода в классе.",
        target_date: daysAgoIso(0),
        status: "in_progress",
        notes: isIntl ? "Meetings happen every Monday. Teacher reports improvement." : "Встречи проходят каждый понедельник. КР отмечает улучшение.",
        created_at: daysAgoIso(14),
        updated_at: daysAgoIso(1),
      },
      // ИПР Майкла
      {
        id: "ipr-step-demo-04",
        ipr_id: "ipr-demo-sch-02",
        order_no: 1,
        title: isIntl ? "Cognitive restructuring (CBT, 3 sessions)" : "Когнитивное переструктурирование (КПТ, 3 сессии)",
        description: isIntl
          ? "Working with catastrophic beliefs about exams. Socratic dialogue technique."
          : "Работа с катастрофическими убеждениями об экзамене. Техника сократовского диалога.",
        target_date: daysAgoIso(7),
        status: "done",
        notes: isIntl ? "Completed. Michael mastered the technique and applies it independently." : "Завершено. Майкл освоил технику и применяет самостоятельно.",
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(7),
      },
      {
        id: "ipr-step-demo-05",
        ipr_id: "ipr-demo-sch-02",
        order_no: 2,
        title: isIntl ? "Mastering relaxation techniques (PMR + breathing)" : "Освоение релаксационных техник (ПМР + дыхание)",
        description: isIntl
          ? "Progressive muscle relaxation by Jacobson, diaphragmatic breathing 4-4-4."
          : "Прогрессивная мышечная релаксация по Джекобсону, диафрагмальное дыхание 4-4-4.",
        target_date: daysAgoIso(3),
        status: "done",
        notes: isIntl ? "Completed. Practices daily before sleep." : "Завершено. Практикует ежедневно перед сном.",
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(3),
      },
      {
        id: "ipr-step-demo-06",
        ipr_id: "ipr-demo-sch-02",
        order_no: 3,
        title: isIntl ? "Participation in mock exams — psychological support" : "Участие в пробных экзаменах — психологическое сопровождение",
        description: isIntl ? "Support right before final exams. Short session on exam day." : "Поддержка непосредственно перед ОГЭ. Краткая сессия в день экзамена.",
        target_date: daysAgoIso(-10),
        status: "planned",
        notes: isIntl ? "Scheduled. Final exams start in 10 days." : "Запланировано. ОГЭ через 10 дней.",
        created_at: daysAgoIso(20),
        updated_at: daysAgoIso(1),
      },
    ],
    leads,
  };
}
