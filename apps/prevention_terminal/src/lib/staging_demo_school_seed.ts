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
  const isEducator = workspace === "educator";
  const isManager = (workspace === "manager" || workspace === "school_manager" || isAuthority) && !isEducator;
  const isIntl = edition === "intl";

  const modules = isEducator
    ? defaultEnabledModules("specialist", "education", "educator_lite")
    : defaultEnabledModules(
        isManager ? "manager" : "specialist",
        isAuthority ? "preventive_public" : "education",
        isManager ? "manager" : "specialist",
      );
  if (!isEducator) {
    modules.embed_client_widget = true;
    modules.consultation_journal = true;
    modules.reception_journal = true;
    modules.group_sessions = true;
    modules.reporting_panel = true;
    modules.safe_environment = true;
    modules.ipr = true;
    modules.observations = true;
  }

  const terminalUserId = isAuthority ? "tu-demo-authority-12" : "tu-demo-school-321";
  const centerId = isAuthority ? "demo-authority-12" : "demo-school-321";

  // --- Единственный эталонный кейс сопровождения (Кирилл Соколов, 16 лет) ---
  const regSokolov = "reg-demo-sokolov-01";

  const sessionTagsJson = (themes: string[], format = "individual") =>
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
      name: isIntl ? "Elena S." : "Соколова Елена Викторовна (мать Кирилла)",
      contact: "+7 (911) 234-56-78",
      specialist_id: null,
      intake_json: JSON.stringify({
        summary: isIntl ? "Referred by Commission on Juvenile Affairs (KDN)" : "Постановление КДНиЗП Центрального района СПб №14/2-24",
        themes: ["DEV_EMO", "REL_PEER"],
      }),
      source: "embed_chat",
      user_id: null,
      status: "converted",
      created_at: daysAgoIso(21),
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
        ? isAuthority ? "Dr. Alexander Vance" : isManager ? "Dr. Helen Smith" : isEducator ? "Sarah Connor" : "David Martinez"
        : isAuthority ? "Воронцов Александр Сергеевич" : isManager ? "Смирнова Елена Николаевна" : isEducator ? "Иванова Ольга Сергеевна" : "Морозов Дмитрий Иванович",
      role_text: isIntl
        ? isAuthority ? "Head of Education Authority" : isManager ? "Principal" : isEducator ? "Classroom Teacher (8B)" : "School Psychologist"
        : isAuthority ? "Начальник Управления образования" : isManager ? "Директор" : isEducator ? "Классный руководитель (8Б)" : "Педагог-психолог",
      weekly_contract_minutes: isManager ? 0 : 2160,
    },
    terminalConfig: {
      terminal_user_id: terminalUserId,
      edition: edition as "ru" | "intl",
      mode: isManager ? "manager" : "specialist",
      workspace_preset: isManager ? "manager" : isEducator ? "educator_lite" : "specialist",
      org_type: isAuthority ? "preventive_public" : "education",
      manager_scope: isAuthority ? "territorial" : null,
      job_title: isIntl
        ? isAuthority ? "Head of Education Authority" : isManager ? "Principal" : isEducator ? "Classroom Teacher (8B)" : "School Psychologist"
        : isAuthority ? "Начальник Управления образования" : isManager ? "Директор" : isEducator ? "Классный руководитель (8Б)" : "Педагог-психолог",
      child_invite_code: "CHILD-DEMOSCHOOL01",
      parent_invite_code: isManager ? "PARENT-DEMOSCHOOL01" : null,
      parent_invite_in: null,
      child_invite_in: null,
      consumer_app: null,
      enabled_modules: modules,
      registry_enabled: !isManager && !isEducator,
      research_contribution_enabled: false,
      research_contribution_consented_at: null,
      research_contribution_consent_version: null,
      research_contribution_last_period_key: null,
      registry_vault_initialized: !isManager && !isEducator,
      registry_recovery_key_hash: (isManager || isEducator) ? null : "demo-registry-vault-hash",
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
      // --- Делинквентные подростки (Служба профилактики / КДНиЗП) ---
      {
        id: regSokolov,
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(1),
        y_level: "Y3_Problem",
        x_stage: "X3_Intervention",
        notes: "Служба профилактического сопровождения. КДНиЗП Центрального района СПб. Постановление №14/2-24. Мелкое хищение (ст. 7.27 ч. 2 КоАП РФ / отказной по ст. 158 УК РФ).",
        case_artifacts_json: JSON.stringify({
          record_kind: "registry_subject",
          situation_title: isIntl ? "Kirill Sokolov (16 y.o., Grade 9)" : "Соколов Кирилл Дмитриевич (16 лет, 9 класс)",
          registry_profile: {
            full_name: isIntl ? "Kirill Sokolov" : "Соколов Кирилл Дмитриевич",
            gender: "male",
            age_years: 16,
            grade_class: "9В",
            birth_date: "2009-04-14",
            phone: "+7 (921) 450-88-12",
            email: "sokol_kirill09@bk.ru",
            address: "г. Санкт-Петербург, Центральный район, ул. Марата, д. 42, кв. 17",
            contact_person: "Соколова Елена Викторовна (мать, +7 911 234-56-78)",
            notes: "Правонарушитель. Состоит на учете в ОДН УМВД по Центральному району СПб и КДНиЗП. Хищение брендовой одежды в ТРК «Галерея». Конфликты с отчимом. Увлекается картингом и автоделом.",
          },
        }),
      },
    ],
    caseAliases: [
      { case_id: regSokolov, alias_id: "alias-demo-sokolov", role: "client", role_no: 1, real_name: isIntl ? "Kirill S." : "Соколов К.Д." },
    ],
    sessionRecords: [],
    workLog: [
      // Консультации с делинквентными подростками (служба профилактики)
      {
        entry_id: "wl-demo-sok-1",
        case_id: regSokolov,
        action_kind: "consultation",
        minutes: 60,
        created_at: daysAgoEpoch(14, 14),
        note: consultationNote({
          goal: "Первичная встреча с Кириллом и матерью — анализ правонарушения и жизненной ситуации",
          observations: "Кирилл держится настороженно, защитная бравада («все воруют в ТРК»). Мать подавлена, конфликты дома.",
          intervention: "Установление контакта без нотаций и обвинений. Прояснение реальных интересов (картинг, автодело, дедушка).",
          assessment: "Снизился защитный барьер. Согласился на индивидуальные встречи и посещение автоклуба вместо шатания по ТРК.",
          plan: "Консультация с юристом службы правовой помощи по ст. 158 УК РФ. Направление в секцию автодела ПМК «Смена».",
          themes: ["DEV_EMO", "REL_PEER"],
          methods: ["cbt"],
          visitDate: dateDaysAgo(14),
        }),
      },
      {
        entry_id: "wl-demo-sok-2",
        case_id: regSokolov,
        action_kind: "consultation",
        minutes: 50,
        created_at: daysAgoEpoch(7, 15),
        note: consultationNote({
          goal: "Проработка импульсивности и влияния уличной группы сверстников",
          observations: "Кирилл пришел вовремя. Рассказал, что в ТРК подстрекали старшие («на слабо»).",
          intervention: "Разбор ситуации «стимул — импульс — пауза — выбор». Отработка отказа от провокаций сверстников.",
          assessment: "Понимает манипуляцию старших. Посетил первое занятие по картингу, очень увлечен инструктором.",
          plan: "Семейный совет с отчимом для снижения домашних ссор. Контроль школьной посещаемости.",
          themes: ["DEV_EMO", "EDU_SELF"],
          methods: ["cbt"],
          visitDate: dateDaysAgo(7),
        }),
      },
      {
        entry_id: "wl-demo-sok-gs-1",
        case_id: regSokolov,
        action_kind: "group_session",
        minutes: 60,
        created_at: daysAgoEpoch(3, 14),
        note: isIntl
          ? "Group session: «Digital Balance & Focus: Screen Time & Gadgets»"
          : "Групповое занятие: «Цифровой баланс и фокус внимания: управление экранным временем и гаджетами»",
      },
    ],
    requests: [],
    groupSessions: [
      {
        session_id: "gs-demo-school-gadgets-01",
        title: isIntl
          ? "Digital Balance & Focus: Screen Time & Gadgets"
          : "Цифровой баланс и фокус внимания: управление экранным временем и гаджетами",
        session_date: dateDaysAgo(3),
        duration_minutes: 60,
        theme: isIntl
          ? "Prevention of screen addiction, clip thinking, and sleep deprivation in high schoolers (15–18 years)"
          : "Профилактика экранной зависимости, клипового мышления и депривации сна у старшеклассников (15–18 лет)",
        notes: isIntl
          ? "Group of 8 high schoolers (including Kirill Sokolov from at-risk register). High engagement in screen time audit. Discussed night scrolling and fatigue."
          : "Группа из 8 старшеклассников (включая Кирилла Соколова из группы внимания). Подростки охотно включились в практическое упражнение с аудитом экранного времени (скриншоты настроек смартфона). Отмечен высокий интерес к теме ночного дофаминового скроллинга и его влияния на школьную усталость и импульсивность.",
        plan_text: isIntl
          ? [
              "Session Plan: Digital Balance & Focus",
              "1. Warm-up & Intro (10 min): Trust rules, 'My First Screen Pulse' exercise.",
              "2. Psychoeducation (15 min): Dopamine loop, recommendation algorithms, blue light & sleep.",
              "3. Practical Workshop (20 min): Screen time audit, app timers, grayscale mode.",
              "4. Experiment Setup (10 min): 'Clean Bedroom' rule (no phone 45 min before sleep).",
              "5. Closing Agreement (5 min): One personal digital habit contract.",
            ].join("\n")
          : [
              "План группового занятия «Цифровой баланс и фокус внимания»",
              "",
              "1. Вводная часть и разогрев (10 мин):",
              "— Приветствие, установление правил доверия без осуждения и нотаций.",
              "— Упражнение «Мой первый импульс»: участники фиксируют, сколько минут проходит от утреннего пробуждения до проверки уведомлений в телефоне.",
              "",
              "2. Информационно-аналитический блок: «Дофаминовая петля и клиповый скролл» (15 мин):",
              "— Механизмы алгоритмов рекомендательных лент и вариативного подкрепления («бесконечная лента»).",
              "— Влияние синего спектра экранов на блокаду выработки мелатонина и фазы глубокого сна.",
              "— Почему после 2 часов соцсетей наступает апатия, раздражительность и истощение волевого ресурса.",
              "",
              "3. Практикум: «Аудит экранного времени» (20 мин):",
              "— Открытие встроенной статистики смартфона (экранное время за последние 7 дней).",
              "— Выявление «пожирателей внимания» и сопоставление со своими целями (спорт, друзья, подготовка к экзаменам, автодело).",
              "— Настройка быстрых фильтров: отключение второстепенных пуш-уведомлений, включение монохромного режима (оттенки серого) для снижения визуального триггера.",
              "",
              "4. Моделирование и эксперимент: «Цифровой детокс без ломки» (10 мин):",
              "— Техника «Чистая спальня»: зарядка телефона вне спального места за 45 минут до сна.",
              "— Альтернативные ритуалы снятия напряжения: музыка, чтение, вечерняя прогулка, спорт.",
              "",
              "5. Рефлексия и личный договор с собой (5 мин):",
              "— Шеринг по кругу: одно конкретное правило цифрового баланса, которое каждый участник обязуется протестировать в течение недели.",
            ].join("\n"),
        report_text: isIntl
          ? [
              "Group Session Report",
              "Date: 3 days ago. Duration: 60 minutes. Participants: 8 students (grades 9-11), including 1 student under individual prevention trajectory (Kirill Sokolov).",
              "Dynamics & Results: High trust, open sharing of real screen time (average 6.2 hours/day). Kirill actively participated in the sleep deprivation discussion, acknowledging phone use provoked fatigue and irritability. All participants disabled push badges for gaming/shopping apps. Goal achieved.",
            ].join("\n")
          : [
              "Отчёт о проведении группового занятия",
              "",
              "Дата: 3 дня назад. Длительность: 60 минут.",
              "Состав группы: 8 человек (учащиеся 9–11 классов), в т.ч. 1 обучающийся, находящийся на индивидуальном профилактическом маршруте (Соколов Кирилл Дмитриевич).",
              "",
              "Динамика и результаты работы:",
              "1. Занятие прошло в атмосфере доверия и живой вовлечённости. Среднее экранное время участников по данным смартфонов составило от 5.5 до 8 часов в сутки.",
              "2. Кирилл Соколов открыто включился в дискуссию о ночном скроллинге, подтвердил прямую связь между недосыпом из-за ночных видео и вспышками раздражительности на уроках.",
              "3. Все участники прямо во время тренинга отключили всплывающие уведомления в 3–5 приложениях, 6 подростков включили режим «оттенки серого».",
              "4. Заключение: цели занятия достигнуты в полном объёме. Запланирована поддерживающая обратная связь через 14 дней.",
            ].join("\n"),
        artifacts_json: JSON.stringify({
          participant_case_ids: [regSokolov],
          plan_segments: {
            passport: isIntl
              ? "Digital Balance & Focus: Screen Time & Gadgets (15–18 years)"
              : "Цифровой баланс и фокус внимания: управление экранным временем и гаджетами (15–18 лет)",
            data_stream: isIntl
              ? [
                  "1 | Warm-up «First Screen Pulse» | Diagnostics of screen checking habits | Interactive poll | 10 min",
                  "2 | Infoblock «Dopamine Loop» | Algorithms and sleep impact | Visual mini-lecture | 15 min",
                  "3 | Workshop «Screen Audit» | Identifying attention sinks | Phone settings stats | 20 min",
                  "4 | Case «Clean Bedroom» | Night digital hygiene | Group discussion | 10 min",
                  "5 | Self-Contract | 1 digital balance rule commitment | Feedback round | 5 min",
                ].join("\n")
              : [
                  "1 | Разогрев «Первый импульс» | Диагностика привычки проверки экрана | Интерактивный опрос | 10 мин",
                  "2 | Инфоблок «Дофаминовая петля» | Механизмы алгоритмов и влияние на сон | Мини-лекция с инфографикой | 15 мин",
                  "3 | Практикум «Аудит экрана» | Выявление пожирателей внимания | Работа со статистикой смартфона | 20 мин",
                  "4 | Кейс «Чистая спальня» | Правила гигиены сна без экрана | Групповая дискуссия | 10 мин",
                  "5 | Итог и личный договор | Фиксация 1 правила цифрового баланса | Круг обратной связи | 5 мин",
                ].join("\n"),
          },
        }),
        audience_json: JSON.stringify({
          target: "high_school_gadgets",
          category: "selective",
          age_band: "15_18",
          learner_count: 8,
          description: isIntl
            ? "High school students (grades 9-11) experiencing digital overload and concentration fatigue"
            : "Обучающиеся 9–11 классов с выраженным экранным перегрузом и трудностями концентрации",
        }),
        prevention_link: "L2_selective",
        prevention_work_types_json: JSON.stringify({
          types: ["group_training", "psychoeducation", "behavioral_skills"],
        }),
        session_tags_json: JSON.stringify(emptyTags(["DEV_EMO", "EDU_SELF"])),
        created_at: daysAgoEpoch(3, 14),
        updated_at: daysAgoEpoch(3, 15),
      },
    ],
    workEntries: [
      {
        entry_id: "we-sch-1",
        work_date: dateDaysAgo(14),
        activity_kind: "consultation",
        minutes_actual: 60,
        case_id: regSokolov,
        title: isIntl ? "Initial consultation with Kirill and mother" : "Первичная консультация с Кириллом и матерью",
        notes: isIntl ? "Offense analysis and contact establishment" : "Анализ правонарушения и факторов риска, установление контакта",
        created_at: daysAgoEpoch(14, 14),
      },
      {
        entry_id: "we-sch-2",
        work_date: dateDaysAgo(7),
        activity_kind: "consultation",
        minutes_actual: 50,
        case_id: regSokolov,
        title: isIntl ? "CBT session: impulsivity & peer pressure" : "КПТ-сессия: импульсивность и влияние компании",
        notes: isIntl ? "Impulsivity coping and peer refusal skills" : "Отработка отказа от провокаций сверстников, пауза перед действием",
        created_at: daysAgoEpoch(7, 15),
      },
      {
        entry_id: "we-sch-3",
        work_date: dateDaysAgo(3),
        activity_kind: "methodology_work",
        minutes_actual: 45,
        case_id: regSokolov,
        title: isIntl ? "Drafting IPR form and risk routing" : "Оформление карты и плана сопровождения ИПР",
        notes: isIntl ? "Interagency prevention plan routing" : "Межведомственный план профилактических мероприятий",
        created_at: daysAgoEpoch(3, 11),
      },
      {
        entry_id: "we-sch-4",
        work_date: dateDaysAgo(3),
        activity_kind: "group_session",
        minutes_actual: 60,
        case_id: regSokolov,
        title: isIntl ? "Group session: digital balance & gadgets for 9-11 grades" : "Групповое занятие: цифровой баланс и гаджеты (9–11 кл)",
        notes: isIntl ? "Screen time audit, night digital hygiene, 8 participants" : "Аудит экранного времени, цифровая гигиена сна, 8 участников",
        created_at: daysAgoEpoch(3, 14),
      },
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
      // 1. Соколов Кирилл Дмитриевич (Кража, правонарушитель, КДНиЗП Центрального р-на)
      {
        id: "ipr-demo-sokolov-01",
        case_id: regSokolov,
        title: "ИПР — Соколов Кирилл (профилактика рецидива правонарушений)",
        description: "Индивидуальная программа реабилитации несовершеннолетнего правонарушителя (ст. 7.27 КоАП РФ / отказной ст. 158 УК РФ). Направление: снижение криминальных рисков, нормализация семейной обстановки, профориентация и организованный досуг.",
        status: "active",
        plan_text: [
          "1. Диагностический блок: оценка рисков и защитных ресурсов (ОРВ), выявление триггеров импульсивного воровства.",
          "2. Психолого-педагогический блок: 6 сессий КПТ импульсивности, семейная медиация с матерью и отчимом.",
          "3. Правовой блок: консультация юрисконсульта службы правовой помощи по уголовной ответственности за хищения (ст. 158 УК РФ).",
          "4. Досуговый и трудовой блок: вовлечение в автоклуб ПМК «Смена» (картинг, автодело), временное трудоустройство на лето через АЗН СПб.",
          "5. Образовательный блок: контроль посещаемости уроков, ликвидация академических задолженностей за 3-ю четверть."
        ].join("\n"),
        report_text: [
          "Мониторинг за 1-й месяц реализации ИПР:",
          "— Прекратил контакты с деструктивной группой сверстников у ТРК «Галерея».",
          "— Посещает занятия по картингу 2 раза в неделю, проявляет высокий интерес к автослесарному делу.",
          "— Проведена семейная медиация: уровень конфликтности дома снизился, отчим поддерживает интерес к автомобилям.",
          "— Пропуски занятий в школе сократились с 14 дней до 1 дня (по уважительной причине).",
          "— Заключение куратора сопровождения: выраженная положительная динамика. Рекомендовано продлить ИПР на 6 месяцев до устойчивой стабилизации."
        ].join("\n"),
        artifacts_json: JSON.stringify({
          contact_sed: {
            demographics: {
              gender: "Мужской",
              birthDate: "2009-04-14",
              birthPlace: "г. Санкт-Петербург",
              citizenship: "Гражданин РФ",
              registrationAddress: "г. Санкт-Петербург, Центральный район, ул. Марата, д. 42, кв. 17",
              actualAddress: "г. Санкт-Петербург, Центральный район, ул. Марата, д. 42, кв. 17",
              phone: "+7 (921) 450-88-12",
              socialLinks: "vk.com/id89201144, tg: @kirill_sok",
              documents: "Паспорт РФ 4019 №482910, выдан ГУ МВД по СПб и ЛО 28.04.2023",
              parents: "Мать: Соколова Елена Викторовна (продавец-кассир, +7 911 234-56-78). Отчим: Волков Дмитрий Алексеевич (водитель). Отец: Соколов Дмитрий Николаевич (развод с 2017 г., алименты нерегулярно). Дедушка: Соколов Виктор Иванович (пенсионер, поддерживающий ресурс)."
            },
            offense: {
              basis: "Постановление КДНиЗП Центрального района СПб от 12.03.2024 №14/2-24",
              articles: "ст. 7.27 ч. 2 КоАП РФ (мелкое хищение), отказной материал КУСП №8412 по ст. 158 ч. 2 УК РФ",
              clientCategory: "crim_underage",
              registrations: "ОДН УМВД по Центральному району СПб (с 15.03.2024), КДНиЗП Центрального района, ВШК ГБОУ СОШ №206",
              isSop: false,
              sopDateStart: "",
              sopDateEnd: "",
              criminalBlockEnabled: true
            },
            risks: {
              "1.4_family": ["single_parent", "emotional_abuse", "inconsistent_rules"],
              "1.6_personality": ["criminal_romance", "physical_aggression", "low_self_esteem"],
              "1.7_learning": ["truancy_periodic", "low_academic", "teacher_conflict_oo"],
              "1.8_leisure": ["no_organized_leisure"],
              "1.9_peers": ["antisocial_friends", "older_friends"],
              "1.10_virtual": ["patriot_crim", "ofniks"],
              "1.11_offense_eval": ["client_no_action"]
            },
            protectiveFactors: {
              "1.3_housing": ["adequate_housing", "basic_needs_met"],
              "1.4_family": ["supportive_adult", "family_cooperation"],
              "1.6_personality": ["critical_thinking", "accepts_specialist_help"],
              "1.8_leisure": ["organized_club_activity", "constructive_hobbies"],
              "1.11_offense_eval": ["active_cooperation_contact", "ready_for_restitution"]
            },
            actions: [
              {
                id: "act-sok-1",
                category: "2.1. Сопровождение семьи",
                actionName: "Беседа с ребенком",
                plannedDate: dateDaysAgo(14),
                actualDate: dateDaysAgo(14),
                executor: "Педагог-психолог службы сопровождения Морозов Д.И.",
                notes: "Первичная беседа, диагностика триггеров импульсивного воровства, установление контакта."
              },
              {
                id: "act-sok-2",
                category: "2.1. Сопровождение семьи",
                actionName: "Семейный совет",
                plannedDate: dateDaysAgo(7),
                actualDate: dateDaysAgo(7),
                executor: "Специалист по социальной работе, педагог-психолог",
                notes: "Медиативная встреча с матерью и отчимом. Снижение градуса взаимных претензий, выработка понятных правил."
              },
              {
                id: "act-sok-3",
                category: "2.2. Правовое сопровождение",
                actionName: "Индивидуальная консультация юриста",
                plannedDate: dateDaysAgo(5),
                actualDate: dateDaysAgo(5),
                executor: "Юрисконсульт службы правовой помощи",
                notes: "Разъяснение уголовной ответственности по ст. 158 УК РФ с 16 лет и правовых последствий судимости."
              },
              {
                id: "act-sok-4",
                category: "2.3. Стабилизация / восстановление в ОО",
                actionName: "Контроль за посещением ОО",
                plannedDate: dateDaysAgo(-30),
                actualDate: "",
                executor: "Социальный педагог школы №206, куратор службы сопровождения",
                notes: "Еженедельный мониторинг посещаемости уроков и ликвидация академических задолженностей."
              },
              {
                id: "act-sok-5",
                category: "2.6. Организация досуга",
                actionName: "Содействие в организации системного досуга",
                plannedDate: dateDaysAgo(2),
                actualDate: dateDaysAgo(2),
                executor: "Специалист службы сопровождения, молодежный клуб «Смена»",
                notes: "Зачисление в секцию автодела и картинга ПМК Центрального района СПб. Вовлечение в мужское наставничество."
              },
              {
                id: "act-sok-6",
                category: "2.4. Профориентация и трудоустройство",
                actionName: "Содействие в профориентации через АЗН",
                plannedDate: dateDaysAgo(-60),
                actualDate: "",
                executor: "Агентство занятости населения Центрального района СПб",
                notes: "Включение в программу временной трудовой занятости несовершеннолетних на лето (помощник автомеханика)."
              },
              {
                id: "act-sok-7",
                category: "2.3. Стабилизация / восстановление в ОО",
                actionName: "Групповой тренинг цифрового баланса и концентрации",
                plannedDate: dateDaysAgo(3),
                actualDate: dateDaysAgo(3),
                executor: "Педагог-психолог службы сопровождения Морозов Д.И.",
                notes: "Участие в групповом занятии «Цифровой баланс и фокус внимания». Осознание влияния ночного скроллинга на раздражительность и режим дня."
              }
            ],
            conclusions: {
              status: "в работе",
              monthsExtension: 6,
              closeReason: "",
              notes: "Выраженная положительная динамика. Кирилл прекратил контакты с околокриминальной группой у ТРК «Галерея». Посещает автоклуб 2 раза в неделю. Конфликты в семье снизились."
            }
          }
        }),
        audience_json: JSON.stringify({ target: "individual", learner_count: 1 }),
        session_tags_json: sessionTagsJson(["DEV_EMO", "REL_PEER"]),
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(1),
      },
    ],
    iprSteps: [
      // Шаги ИПР Соколова Кирилла
      {
        id: "step-sok-01",
        ipr_id: "ipr-demo-sokolov-01",
        order_no: 1,
        title: "Первичная оценка рисков и защитных ресурсов (ОРВ / 120-ФЗ)",
        description: "Формирование Формы №1 с фиксацией 9 сфер жизнедеятельности и факторов делинквентности.",
        target_date: daysAgoIso(14),
        status: "completed",
        notes: "Завершено. Выявлены риски в сферах 1.4, 1.6, 1.7, 1.9, 1.10. Ресурс: картинг, дедушка.",
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(14),
      },
      {
        id: "step-sok-02",
        ipr_id: "ipr-demo-sokolov-01",
        order_no: 2,
        title: "Индивидуальная консультация юриста по уголовной ответственности",
        description: "Разъяснение правовых последствий повторных хищений (ст. 158 УК РФ, судимость).",
        target_date: daysAgoIso(5),
        status: "completed",
        notes: "Проведено юрисконсультом службы правовой помощи. Подросток осознал последствия для будущего трудоустройства.",
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(5),
      },
      {
        id: "step-sok-03",
        ipr_id: "ipr-demo-sokolov-01",
        order_no: 3,
        title: "Включение в секцию автодела и картинга ПМК «Смена»",
        description: "Организация системного просоциального досуга с наставником.",
        target_date: daysAgoIso(2),
        status: "completed",
        notes: "Зачислен в клуб, посещает тренировки 2 раза в неделю, интерес устойчивый.",
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(2),
      },
      {
        id: "step-sok-04",
        ipr_id: "ipr-demo-sokolov-01",
        order_no: 4,
        title: "Курс индивидуальных консультаций психолога по совладанию с импульсивностью",
        description: "6 сессий КПТ, обучение паузе перед импульсивным действием, противостояние подстрекательству.",
        target_date: daysAgoIso(-14),
        status: "in_progress",
        notes: "Проведено 3 из 6 сессий. Положительная динамика.",
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(1),
      },
      {
        id: "step-sok-05",
        ipr_id: "ipr-demo-sokolov-01",
        order_no: 5,
        title: "Временное трудоустройство на летний период через АЗН СПб",
        description: "Оформление в молодежную трудовую бригаду (помощник автослесаря).",
        target_date: daysAgoIso(-60),
        status: "planned",
        notes: "Документы собраны, направлены в АЗН Центрального района.",
        created_at: daysAgoIso(21),
        updated_at: daysAgoIso(1),
      },
    ],
    leads,
  };
}
