import { t } from "./i18n.ts";

export type VisualStepKind = "manual_form" | "voice_mic" | "ai_magic" | "docx_export" | "companion_bridge";

export interface GuideStep {
  title: string;
  subtitle: string;
  visualKind: VisualStepKind;
  arrowText?: string;
  calloutText: string;
  checklist?: string[];
}

export interface GuideOverviewCard {
  icon: string;
  title: string;
  description: string;
  tip?: string;
}

export interface ModuleGuideContent {
  id: string;
  title: string;
  badge: string;
  lead: string;
  overviewCards: GuideOverviewCard[];
  steps: GuideStep[];
  tips?: string[];
  faqTip?: string;
  learnMoreLink?: { url: string; label: string };
  ctaText: string;
}

export function getModuleGuide(moduleId: string, isCommercial: boolean): ModuleGuideContent {
  // Normalize module key
  const key = moduleId.toLowerCase().trim();

  // 1. DASHBOARD
  if (key === "dashboard") {
    if (isCommercial) {
      return {
        id: "dashboard",
        title: t("Главная панель частной практики", "Private Practice Dashboard"),
        badge: t("Обзор и статистика", "Overview & Analytics"),
        lead: t(
          "Центральный пульт управления частной практикой: текущая загрузка, записи клиентов, расписание на сегодня и ключевые показатели динамики.",
          "Central control panel of your private practice: workload, client sessions, today's schedule, and key dynamics."
        ),
        overviewCards: [
          {
            icon: "📊",
            title: t("Сводка сессий и клиентов", "Sessions & Clients Summary"),
            description: t("Счетчики активных клиентов в терапии, проведенных консультаций за неделю и месяц, а также динамика обращений.", "Counters of active clients in therapy, conducted sessions per week and month, and dynamics of requests."),
          },
          {
            icon: "📅",
            title: t("Расписание на сегодня", "Today's Schedule"),
            description: t("Список запланированных встреч с быстрым переходом в карточку клиента или протокол сессии.", "List of scheduled sessions with fast access to client cards or session protocols."),
          },
          {
            icon: "💡",
            title: t("Быстрые действия", "Quick Actions"),
            description: t("В один клик заводите нового клиента, открывайте журнал сессий или запускайте видеокомнату для онлайн-приема.", "In one click create a new client, open the session journal, or launch the video room for online sessions."),
          },
          {
            icon: "🔒",
            title: t("Приватность и безопасность", "Privacy & Security"),
            description: t("Все данные хранятся в зашифрованном виде (SQLCipher) на вашем устройстве и защищены от стороннего доступа.", "All data is stored locally encrypted (SQLCipher) on your device and protected from unauthorized access."),
          },
        ],
        steps: [
          {
            title: t("Шаг 1. Добавление клиента в картотеку", "Step 1. Add Client to Database"),
            subtitle: t("Имя или псевдоним + контактные данные", "Name or pseudonym + contact info"),
            visualKind: "manual_form",
            calloutText: t("Для начала достаточно указать только имя/псевдоним клиента и тему первого обращения.", "Just enter client name/pseudonym and initial request topic to start."),
            checklist: [
              t("Укажите удобное имя для картотеки", "Enter convenient display name"),
              t("Зафиксируйте первоначальный запрос", "Record initial consultation request"),
              t("При необходимости установите дату первой встречи", "Set first session date if scheduled"),
            ],
          },
          {
            title: t("Шаг 2. Проведение сессии и фиксация заметок", "Step 2. Conduct Session & Record Notes"),
            subtitle: t("Текстовый ввод или быстрая надиктовка голосом", "Text notes or fast voice dictation"),
            visualKind: "voice_mic",
            calloutText: t("Сразу после сессии надиктуйте или запишите основные тезисы, динамику и договоренности.", "Right after session dictate or write down key insights, dynamics, and agreements."),
            checklist: [
              t("Отметьте актуальное эмоциональное состояние клиента", "Note client's current emotional state"),
              t("Зафиксируйте ключевые инсайты и домашнее задание", "Record key insights and home assignment"),
              t("Сохраните заметку в карточке клиента", "Save note directly into client card"),
            ],
          },
          {
            title: t("Шаг 3. Анализ динамики и управление расписанием", "Step 3. Track Dynamics & Manage Schedule"),
            subtitle: t("Все цифры и графики обновляются на дашборде автоматически", "All charts and counters auto-update on dashboard"),
            visualKind: "docx_export",
            calloutText: t("Дашборд сводит вашу практику в понятную картину: частота сессий, динамика клиентов и финансовая сводка.", "Dashboard aggregates your practice into clear stats: session frequency, client dynamics, and summary."),
            checklist: [
              t("Контролируйте регулярность встреч с каждым клиентом", "Track session regularity for each client"),
              t("Планируйте слоты в календаре без накладок", "Plan calendar slots without conflicts"),
              t("Отслеживайте завершение терапевтических контрактов", "Monitor therapeutic contract completions"),
            ],
          },
        ],
        tips: [
          t("Используйте псевдонимы для клиентов, если хотите обеспечить максимальную анонимность записей.", "Use pseudonyms for clients to ensure maximum anonymity of your records."),
          t("Кнопка микрофона в журнале позволяет за 30 секунд сохранить все мысли после сессии без долгого набора текста.", "The mic button in the journal lets you save post-session notes in 30 seconds without manual typing."),
        ],
        ctaText: t("Понятно, к рабочему кабинету", "Got it, go to dashboard"),
      };
    }

    // School Dashboard
    return {
      id: "dashboard",
      title: t("Главная панель педагога-психолога", "School Psychologist Dashboard"),
      badge: t("Командный центр школы", "School Command Center"),
      lead: t(
        "Сводка психологического климата и работы службы сопровождения: количество консультаций, маркеры риска по классам и оперативные сигналы.",
        "Summary of psychological climate and support service: session volume, risk markers across grades, and urgent alerts."
      ),
      overviewCards: [
        {
          icon: "📈",
          title: t("Счетчики работы по ФГОС", "Standard Workload Metrics"),
          description: t("Количество консультаций с учениками, родителями и педагогами, часы коррекционной и диагностической работы.", "Volume of consultations with students, parents, and educators; diagnostic and intervention hours."),
        },
        {
          icon: "🚨",
          title: t("Группы внимания и сигналы риска", "Attention Groups & Risk Alerts"),
          description: t("Оперативный мониторинг учащихся на внутришкольном учете (ВШУ), детей группы риска и сигналов из журнала наблюдений.", "Real-time monitoring of students on school watchlists, risk groups, and incoming observation signals."),
        },
        {
          icon: "📝",
          title: t("Быстрый старт протокола", "Quick Protocol Start"),
          description: t("Мгновенная фиксация консультации, беседы с родителем или инцидента прямо с главного экрана.", "Instant recording of a consultation, parent meeting, or incident directly from the main screen."),
        },
        {
          icon: "📄",
          title: t("Готовность к годовому отчету", "Annual Report Readiness"),
          description: t("Все ежедневные записи автоматически суммируются в аналитическую справку и официальный годовой отчет.", "All daily entries auto-aggregate into analytical summaries and the official annual report."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Импорт или просмотр школьного реестра", "Step 1. School Roster Import & Review"),
          subtitle: t("Списки классов и распределение по параллелям", "Class rosters and grade distribution"),
          visualKind: "manual_form",
          calloutText: t("Загрузите список классов через Excel или добавьте детей вручную в разделе «Реестр».", "Import class lists via Excel or add students manually in the 'Registry' section."),
          checklist: [
            t("Проверьте наличие списков классов", "Check class roster availability"),
            t("Отметьте категории учета (ОВЗ, ВШУ, группы внимания)", "Mark support categories (IEP, watchlist, attention group)"),
          ],
        },
        {
          title: t("Шаг 2. Фиксация консультаций и встреч", "Step 2. Record Consultations & Meetings"),
          subtitle: t("1 клик для открытия формы протокола беседы", "1 click to open interview protocol form"),
          visualKind: "voice_mic",
          calloutText: t("Записывайте каждую встречу с ребенком или родителем — это формирует официальную базу часов.", "Log every meeting with child or parent — this compiles your official workload hours."),
          checklist: [
            t("Выберите участника (ученик, родитель, учитель)", "Select participant (student, parent, teacher)"),
            t("Зафиксируйте суть обращения и рекомендации", "Record reason for consultation and recommendations"),
            t("Сохраните запись в журнале", "Save record to journal"),
          ],
        },
        {
          title: t("Шаг 3. Анализ ситуации и выгрузка отчетов", "Step 3. Analyze Dynamics & Export Reports"),
          subtitle: t("Сводная статистика за четверть, полугодие и год", "Summary stats for term, semester, and year"),
          visualKind: "docx_export",
          calloutText: t("Дашборд в реальном времени показывает охват профилактической работой всех параллелей школы.", "Dashboard shows real-time prevention coverage across all school grades."),
          checklist: [
            t("Следите за распределением нагрузки по направлениям", "Monitor workload distribution across activities"),
            t("Скачивайте аналитическую справку для завуча в 1 клик", "Download analytical memo for administration in 1 click"),
          ],
        },
      ],
      tips: [
        t("Все внесенные консультации автоматически учитываются в распределении 36-часовой рабочей недели.", "All recorded consultations automatically count toward your 36-hour weekly workload balance."),
        t("Сигналы [SOS] из журнала наблюдений классных руководителей подсвечиваются на дашборде в приоритетном порядке.", "[SOS] alerts from homeroom teachers' observation journals are highlighted on the dashboard with top priority."),
      ],
      ctaText: t("Понятно, к работе", "Got it, go to workspace"),
    };
  }

  // 2. CASES / CASE WORKSPACE
  if (key === "cases" || key === "case_workspace") {
    if (isCommercial) {
      return {
        id: "cases",
        title: t("Кейсы и клиентские дела", "Client Cases & Case Files"),
        badge: t("Долгосрочная терапия", "Long-term Therapy"),
        lead: t(
          "Единая зашифрованная карточка терапевтического случая: формулирование контракта, динамика сессий, диагностические гипотезы и домашние задания.",
          "Unified encrypted case card: therapy contract formulation, session dynamics, diagnostic hypotheses, and home assignments."
        ),
        overviewCards: [
          {
            icon: "📁",
            title: t("История и терапевтический контракт", "History & Therapy Contract"),
            description: t("Фиксация целей терапии, договоренностей о сеттинге, частоте встреч и ключевых темах работы.", "Documentation of therapy goals, setting agreements, session frequency, and core topics."),
          },
          {
            icon: "📈",
            title: t("Хронология сессий и динамика", "Session Timeline & Progress"),
            description: t("Последовательный таймлайн всех встреч с заметками, изменениями состояния и промежуточными итогами.", "Sequential timeline of all sessions with notes, state changes, and milestone reviews."),
          },
          {
            icon: "🎯",
            title: t("Фокус и домашние задания", "Focus & Home Assignments"),
            description: t("Назначение упражнений, дневников мыслей и поведенческих экспериментов с контролем выполнения.", "Assigning exercises, thought records, and behavioral experiments with progress tracking."),
          },
          {
            icon: "📄",
            title: t("Экспорт сводного дела", "Full Case Summary Export"),
            description: t("Формирование аккуратного отчета по динамике случая для супервизии или личного архива.", "Generating a neat case progress summary for supervision or personal archive."),
          },
        ],
        steps: [
          {
            title: t("Шаг 1. Создание кейса", "Step 1. Create Case"),
            subtitle: t("Нажмите «+ Новый кейс» и выберите клиента", "Click '+ New Case' and select client"),
            visualKind: "manual_form",
            calloutText: t("Укажите направление работы (индивидуальная терапия, работа с парой, семейное консультирование).", "Select work modality (individual therapy, couples counseling, family therapy)."),
            checklist: [
              t("Выберите клиента из картотеки", "Select client from database"),
              t("Сформулируйте первичный терапевтический запрос", "Formulate initial therapeutic request"),
            ],
          },
          {
            title: t("Шаг 2. Ведение сессий внутри кейса", "Step 2. Document Sessions within Case"),
            subtitle: t("Добавляйте встречи в хронологическую ленту", "Add sessions to chronological feed"),
            visualKind: "voice_mic",
            calloutText: t("Каждая запись привязывается к кейсу, сохраняя полную картину терапевтического процесса.", "Each entry attaches to the case, preserving the full picture of the therapeutic journey."),
            checklist: [
              t("Фиксируйте эмоциональные реакции и инсайты", "Note emotional reactions and breakthroughs"),
              t("Отмечайте выполнение предыдущих договоренностей", "Review previous assignments completion"),
            ],
          },
          {
            title: t("Шаг 3. Подведение итогов и супервизия", "Step 3. Milestones & Supervision"),
            subtitle: t("Оценка динамики и формулирование гипотез", "Assess dynamics & refine hypotheses"),
            visualKind: "docx_export",
            calloutText: t("В любой момент вы можете выгрузить деперсонализированный кейс для обсуждения с супервизором.", "Export depersonalized case materials at any time for supervision discussions."),
            checklist: [
              t("Сверяйтесь с исходными целями контракта", "Check progress against initial contract goals"),
              t("Формируйте итоговую справку по завершении", "Generate closing summary upon completion"),
            ],
          },
        ],
        tips: [
          t("Для подготовки к супервизии используйте кнопку деперсонализации, чтобы скрыть личные данные клиента.", "Use depersonalization when preparing cases for supervision to keep client data private."),
        ],
        ctaText: t("Понятно, к кейсам", "Got it, go to cases"),
      };
    }

    // School Case Workspace
    return {
      id: "cases",
      title: t("Кейсы и личные дела учащихся", "Student Support Cases & Files"),
      badge: t("Индивидуальное сопровождение", "Individual Support"),
      lead: t(
        "Система ведения сложных психолого-педагогических случаев: диагностика, психокоррекция, работа с семьей, консилиумы и динамика по четвертям.",
        "System for managing complex psycho-educational cases: diagnostics, intervention, family work, multidisciplinary meetings, and term progress."
      ),
      overviewCards: [
        {
          icon: "📁",
          title: t("Личное дело сопровождения", "Support Case File"),
          description: t("Единый свод всех материалов по ученику: жалобы, диагностические протоколы, беседы с учителями и родителями.", "Unified folder for student materials: complaints, diagnostic sheets, teacher & parent interviews."),
        },
        {
          icon: "🎯",
          title: t("План психологической помощи", "Psychological Action Plan"),
          description: t("Постановка целей коррекционно-развивающей работы, выбор методик и фиксация контрольных сроков.", "Setting intervention goals, selecting methods, and establishing milestone review dates."),
        },
        {
          icon: "🤝",
          title: t("Межведомственный консилиум", "Multidisciplinary Case Conference"),
          description: t("Учет рекомендаций ПМПК, решений школьного консилиума (ППк) и координация с социальным педагогом.", "Documenting commission recommendations, school team decisions, and coordination with social educators."),
        },
        {
          icon: "📄",
          title: t("Официальная характеристика и справка", "Official Psychological Report"),
          description: t("Генерация психологической характеристики ученика для ПМПК, КДНиЗП или военкомата по ГОСТ/ФГОС.", "Generating standardized psychological reports for diagnostic commissions or authorities."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Открытие личного дела / кейса", "Step 1. Open Student Case"),
          subtitle: t("Выберите учащегося из реестра школы", "Select student from school registry"),
          visualKind: "manual_form",
          calloutText: t("Укажите категорию сопровождения: адаптация 1/5/10 классы, девиантное поведение, ОВЗ или кризисная ситуация.", "Select support category: 1st/5th/10th grade adaptation, behavioral issues, special needs, or crisis."),
          checklist: [
            t("Привяжите кейс к ученику из школьного реестра", "Link case to student in registry"),
            t("Сформулируйте повод обращения / сигнал консилиума", "State referral reason or team signal"),
          ],
        },
        {
          title: t("Шаг 2. Фиксация этапов работы", "Step 2. Document Support Stages"),
          subtitle: t("Диагностика, индивидуальные занятия, встречи с семьей", "Diagnostics, individual sessions, family meetings"),
          visualKind: "voice_mic",
          calloutText: t("Все протоколы встреч автоматически выстраиваются в хронологическую шкалу сопровождения.", "All meeting protocols automatically organize into a chronological support timeline."),
          checklist: [
            t("Вносите протоколы диагностических обследований", "Record diagnostic assessment protocols"),
            t("Фиксируйте консультации с классным руководителем и родителями", "Document talks with homeroom teacher and parents"),
          ],
        },
        {
          title: t("Шаг 3. Заключение и выгрузка документов", "Step 3. Closing Report & Export"),
          subtitle: t("Готовая характеристика в DOCX за 1 клик", "Ready DOCX report in 1 click"),
          visualKind: "docx_export",
          calloutText: t("Система компилирует все записи в официальную справку установленного образца.", "The system compiles all entries into an official standard psychological evaluation sheet."),
          checklist: [
            t("Оцените динамику адаптации и успеваемости", "Evaluate adaptation and academic dynamics"),
            t("Сформируйте итоговое заключение для школьного консилиума", "Generate final evaluation for school team"),
          ],
        },
      ],
      tips: [
        t("При формировании характеристики для ПМПК все формулировки соответствуют профессиональным стандартам педагогической этики.", "When generating commission reports, all phrasing adheres to professional pedagogical standards."),
      ],
      ctaText: t("Понятно, к кейсам школы", "Got it, go to student cases"),
    };
  }

  // 3. CONSULTATIONS / JOURNAL
  if (key === "consultations" || key === "journal") {
    if (isCommercial) {
      return {
        id: "consultations",
        title: t("Журнал терапевтических сессий", "Therapy Sessions Journal"),
        badge: t("Ежедневный учет", "Daily Log"),
        lead: t(
          "Хронологический журнал индивидуальных, парных и семейных консультаций: быстрый ввод заметок, фиксация динамики и печать протоколов.",
          "Chronological log of individual, couples, and family sessions: fast note entry, dynamics tracking, and protocol printing."
        ),
        overviewCards: [
          {
            icon: "📝",
            title: t("Заметки по сессии", "Session Notes"),
            description: t("Фиксация жалоб, гипотез, интервенций и домашнего задания сразу после окончания встречи.", "Documenting complaints, hypotheses, interventions, and home tasks right after the session."),
          },
          {
            icon: "🎙️",
            title: t("Голосовой ввод за 30 секунд", "30-Second Voice Dictation"),
            description: t("Надиктуйте основные мысли вслух — система структурирует текст без необходимости долгого ручного набора.", "Dictate core points aloud — system structures text without tedious manual typing."),
          },
          {
            icon: "🔍",
            title: t("Поиск и фильтры по клиентам", "Client Search & Filters"),
            description: t("Мгновенный поиск истории встреч по имени клиента, дате приема или ключевым темам запроса.", "Instant lookup of meeting history by client name, session date, or key request topics."),
          },
          {
            icon: "🖨️",
            title: t("Печать и экспорт протокола", "Print & Protocol Export"),
            description: t("Выгрузка аккуратного протокола сессии в DOCX или PDF для личного архива или по запросу клиента.", "Exporting clean session protocols to DOCX/PDF for personal archive or client requests."),
          },
        ],
        steps: [
          {
            title: t("Шаг 1. Выбор клиента или быстрый ввод", "Step 1. Select Client or Quick Entry"),
            subtitle: t("Выберите клиента из списка или введите имя", "Pick client from list or enter name"),
            visualKind: "manual_form",
            calloutText: t("Дата и время приема подставляются автоматически, их можно изменить при необходимости.", "Session date and time are set automatically, editable when needed."),
            checklist: [
              t("Укажите клиента", "Specify client"),
              t("Выберите формат встречи (очно / онлайн)", "Select session format (in-person / online)"),
            ],
          },
          {
            title: t("Шаг 2. Фиксация содержания сессии", "Step 2. Record Session Content"),
            subtitle: t("Заполните поля или надиктуйте голосом", "Fill fields or dictate via microphone"),
            visualKind: "voice_mic",
            calloutText: t("Отметьте, с чем работал клиент, какие техники применялись и какие договоренности достигнуты.", "Note what the client worked through, techniques applied, and agreements made."),
            checklist: [
              t("Ключевая тема и запрос встречи", "Core topic and session focus"),
              t("Примененные техники и инсайты", "Techniques used and insights gained"),
              t("Домашнее задание для клиента", "Home assignment for client"),
            ],
          },
          {
            title: t("Шаг 3. Сохранение в архив", "Step 3. Save to Archive"),
            subtitle: t("Запись надежно сохраняется в локальной зашифрованной базе", "Entry is securely saved in local encrypted database"),
            visualKind: "docx_export",
            calloutText: t("Запись мгновенно пополняет историю клиента и статистику проведенных часов.", "Entry instantly enriches client history and completed hours statistics."),
            checklist: [
              t("Нажмите «Сохранить запись»", "Click 'Save Entry'"),
              t("При необходимости распечатайте протокол в DOCX", "Optionally export protocol to DOCX"),
            ],
          },
        ],
        tips: [
          t("Кнопка микрофона работает прямо в браузере и приложении без передачи аудио в сторонние сервисы.", "Microphone button works directly in your app with complete privacy preservation."),
        ],
        ctaText: t("Понятно, к журналу сессий", "Got it, go to sessions journal"),
      };
    }

    // School Consultations Journal
    return {
      id: "consultations",
      title: t("Журнал консультаций педагога-психолога", "School Psychologist Consultations Journal"),
      badge: t("Официальный журнал по ФГОС", "Standard Official Journal"),
      lead: t(
        "Официальный журнал индивидуальных и групповых консультаций с обучающимися, родителями и педагогами с автоматическим учетом часов.",
        "Official journal of individual and group consultations with students, parents, and educators with automatic hour accounting."
      ),
      overviewCards: [
        {
          icon: "📖",
          title: t("Единый реестр консультаций", "Unified Consultations Registry"),
          description: t("Фиксация всех обращений с разделением по категориям участников: учащиеся, родители/законные представители, педагоги.", "Logging all visits categorized by participant types: students, parents/guardians, educators."),
        },
        {
          icon: "⏱️",
          title: t("Автоматический хронометраж", "Automatic Workload Tracking"),
          description: t("Каждая консультация автоматически учитывается в балансе рабочего времени (18 часов индивидуальной работы).", "Each session automatically logs into your workload balance (18 hours direct work)."),
        },
        {
          icon: "💡",
          title: t("Формулировки по стандартам", "Standardized Phrasings"),
          description: t("Корректные формулировки тем обращений и рекомендаций, готовые для проверок надзорными органами.", "Compliant referral reasons and recommendations ready for administrative audits."),
        },
        {
          icon: "📄",
          title: t("Протокол беседы в DOCX", "Interview Protocol DOCX"),
          description: t("Формирование официального протокола индивидуальной беседы или консультации с подписями сторон.", "Generating official individual interview protocols with signature blocks."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Выбор участника и категории", "Step 1. Select Participant & Category"),
          subtitle: t("Ученик (с классом), родитель или педагог", "Student (with grade), parent or teacher"),
          visualKind: "manual_form",
          calloutText: t("Выберите ребенка из школьного реестра или введите имя родителя/учителя.", "Select student from school registry or enter parent/teacher name."),
          checklist: [
            t("Укажите категорию: ученик, родитель, педагог", "Select category: student, parent, educator"),
            t("Выберите класс обучающегося", "Select student grade"),
          ],
        },
        {
          title: t("Шаг 2. Фиксация содержания и рекомендаций", "Step 2. Record Content & Recommendations"),
          subtitle: t("Краткая суть беседы и выводы", "Brief interview summary and takeaways"),
          visualKind: "voice_mic",
          calloutText: t("Надиктуйте или напишите суть обращения: конфликт, трудности в учебе, детско-родительские отношения.", "Dictate or write referral reason: conflict, academic difficulties, parent-child relations."),
          checklist: [
            t("Зафиксируйте тему консультации", "Record consultation topic"),
            t("Сформулируйте рекомендации для классного руководителя и родителей", "State advice for teacher and parents"),
          ],
        },
        {
          title: t("Шаг 3. Сохранение в официальный отчет", "Step 3. Save to Official Log"),
          subtitle: t("Запись автоматически попадает в годовую аналитическую справку", "Entry auto-aggregates into annual statistical report"),
          visualKind: "docx_export",
          calloutText: t("Никакого пересчета вручную в конце года — журнал формирует сводку самостоятельно.", "No manual recalculations at year end — journal generates summaries automatically."),
          checklist: [
            t("Сохраните запись в журнале", "Save record to journal"),
            t("При необходимости распечатайте протокол беседы для подписи", "Print protocol for signatures if needed"),
          ],
        },
      ],
      tips: [
        t("При беседах по сложным конфликтным ситуациям обязательно распечатывайте протокол беседы с родителем для подписи.", "For complex conflicts, always print the parent interview protocol for signature confirmation."),
      ],
      ctaText: t("Понятно, к журналу консультаций", "Got it, go to consultations journal"),
    };
  }

  // 4. REGISTRY
  if (key === "registry") {
    if (isCommercial) {
      return {
        id: "registry",
        title: t("Реестр клиентов и договоров", "Clients & Contracts Registry"),
        badge: t("База клиентов", "Client Database"),
        lead: t(
          "Защищенная картотека ваших клиентов: контактные данные, договоры, статус терапии, архив завершенных случаев и быстрый переход к сессиям.",
          "Secure client card index: contacts, agreements, therapy status, completed archive, and quick session launch."
        ),
        overviewCards: [
          {
            icon: "👥",
            title: t("Картотека клиентов", "Client Directory"),
            description: t("Полный список клиентов в работе с поиском по имени, телефону, дате первого обращения и статусу.", "Full client roster with search by name, phone, initial date, and therapy status."),
          },
          {
            icon: "📥",
            title: t("Импорт и экспорт базы", "Import & Export"),
            description: t("Быстрый перенос списков из Excel/CSV или создание резервной зашифрованной копии базы.", "Quick import from Excel/CSV or creating an encrypted backup of your database."),
          },
          {
            icon: "🔒",
            title: t("Локальное шифрование", "Local Encryption"),
            description: t("Персональные данные защищены локальным ключом и не передаются на сторонние серверы.", "Personal data is protected with a local key and never sent to third-party servers."),
          },
          {
            icon: "🚀",
            title: t("Быстрый старт сессии", "Quick Session Start"),
            description: t("Из карточки клиента в 1 клик открывается форма новой консультации, видеокомната или история кейса.", "Open a new session, video room, or case history directly from any client card."),
          },
        ],
        steps: [
          {
            title: t("Шаг 1. Добавление клиента", "Step 1. Add Client"),
            subtitle: t("Нажмите «+ Добавить» или воспользуйтесь импортом", "Click '+ Add' or use Excel import"),
            visualKind: "manual_form",
            calloutText: t("Для начала достаточно указать только имя/псевдоним. Остальные поля можно заполнить позже.", "Only name/pseudonym is required initially. Other fields can be filled later."),
            checklist: [
              t("Введите имя или псевдоним клиента", "Enter client name or pseudonym"),
              t("Укажите контакт для связи при необходимости", "Add contact information if needed"),
            ],
          },
          {
            title: t("Шаг 2. Ведение карточки и истории", "Step 2. Maintain Card & History"),
            subtitle: t("Все сессии и заметки привязываются к клиенту", "All sessions and notes link to client"),
            visualKind: "ai_magic",
            calloutText: t("Вся история консультаций, заметок и файлов собирается в одном месте.", "Complete timeline of sessions, notes, and files is organized in one central place."),
            checklist: [
              t("Просматривайте хронологию встреч", "Review session chronology"),
              t("Контролируйте актуальный статус терапии", "Track current therapy status"),
            ],
          },
          {
            title: t("Шаг 3. Завершение работы или архив", "Step 3. Archive or Complete"),
            subtitle: t("Перевод завершенных клиентов в архив", "Move finished clients to archive"),
            visualKind: "docx_export",
            calloutText: t("Архивированные клиенты не загромождают активный список, но их история всегда доступна для поиска.", "Archived clients don't clutter your active list while history remains searchable."),
            checklist: [
              t("Отметьте завершение контракта", "Mark contract completion"),
              t("Сохраните итоговую выписку при необходимости", "Export final summary if needed"),
            ],
          },
        ],
        tips: [
          t("Вы можете загрузить шаблон Excel, заполнить его именами клиентов и импортировать всю базу за пару секунд.", "Download the Excel template, fill in client names, and import your entire client base in seconds."),
        ],
        ctaText: t("Понятно, к реестру клиентов", "Got it, go to client registry"),
      };
    }

    // School Registry
    return {
      id: "registry",
      title: t("Школьный реестр обучающихся", "School Student Registry"),
      badge: t("Контингент школы", "School Roster"),
      lead: t(
        "База контингента учащихся школы по параллелям и классам: категории сопровождения (ОВЗ, ВШУ, группы внимания), согласия родителей и быстрый доступ к делам.",
        "School student database by grades and classes: support categories (IEP, watchlist, risk groups), parental consents, and fast file access."
      ),
      overviewCards: [
        {
          icon: "🏫",
          title: t("Списки классов и параллелей", "Class & Grade Rosters"),
          description: t("Структурированный список учащихся с фильтрацией по классам, литерам и возрастным группам.", "Structured student list with filtering by classes, sections, and age groups."),
        },
        {
          icon: "📥",
          title: t("Импорт из Excel за 1 клик", "1-Click Excel Import"),
          description: t("Загрузите списки классов школы из любого стандартного файла Excel без ручного набора сотен фамилий.", "Upload school class rosters from any standard Excel file without manual typing."),
        },
        {
          icon: "🏷️",
          title: t("Категории учета и внимания", "Support Categories & Badges"),
          description: t("Маркировка детей с ОВЗ/инвалидностью, находящихся на ВШУ, КДНиЗП или требующих повышенного внимания.", "Marking students with special needs, on school watchlists, or requiring heightened monitoring."),
        },
        {
          icon: "📄",
          title: t("Учет согласий родителей", "Parental Consent Tracking"),
          description: t("Фиксация наличия письменного согласия родителей на психологическое сопровождение по закону РФ.", "Tracking written parental consent status for psychological support per legal regulations."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Импорт списков классов", "Step 1. Import Class Rosters"),
          subtitle: t("Скачайте шаблон Excel и загрузите списки", "Download Excel template and upload rosters"),
          visualKind: "manual_form",
          calloutText: t("Система автоматически распознает ФИО, класс и дату рождения учеников.", "The system automatically recognizes Full Name, class, and birth date of students."),
          checklist: [
            t("Загрузите файл со списками классов", "Upload file with class lists"),
            t("Проверьте распределение по классам", "Verify class distribution"),
          ],
        },
        {
          title: t("Шаг 2. Разметка категорий учета", "Step 2. Mark Support Categories"),
          subtitle: t("Отметьте статусы ОВЗ, ВШУ, группы риска", "Mark IEP, watchlist, and risk statuses"),
          visualKind: "ai_magic",
          calloutText: t("Категории помогают автоматически формировать списки для школьного консилиума и завуча.", "Categories enable instant list generation for school multidisciplinary teams and administration."),
          checklist: [
            t("Проставьте отметки согласий родителей", "Check parental consent boxes"),
            t("Отметьте учащихся особых категорий сопровождения", "Flag special support category students"),
          ],
        },
        {
          title: t("Шаг 3. Использование в журналах и кейсах", "Step 3. Use in Journals & Cases"),
          subtitle: t("Все ученики доступны для быстрого выбора в один клик", "All students available for 1-click selection"),
          visualKind: "docx_export",
          calloutText: t("При фиксации консультации достаточно ввести первые буквы фамилии — данные подтянутся автоматически.", "When recording a session, just type the first letters of the surname — details auto-fill."),
          checklist: [
            t("Открывайте консультации прямо из реестра", "Start consultations directly from registry"),
            t("Создавайте личные дела сопровождения", "Create individual support case files"),
          ],
        },
      ],
      tips: [
        t("Импорт из Excel не создает дубликатов — система автоматически обновляет существующие записи по ФИО и классу.", "Excel import prevents duplicates — system updates existing records automatically by Name and Class."),
      ],
      ctaText: t("Понятно, к школьному реестру", "Got it, go to school registry"),
    };
  }

  // 5. OBSERVATIONS / OBSERVATION
  if (key === "observation" || key === "observations") {
    return {
      id: "observation",
      title: t("Журнал наблюдений и скрининг риска", "Observation Journal & Risk Screening"),
      badge: t("Связка Педагог ↔ Психолог", "Educator ↔ Psychologist Bridge"),
      lead: t(
        "Инструмент экспресс-оценки поведенческих и эмоциональных маркеров риска у обучающихся в классе для классных руководителей и школьного психолога.",
        "Rapid screening tool for behavioral and emotional risk markers in the classroom for homeroom teachers and school psychologists."
      ),
      overviewCards: [
        {
          icon: "📋",
          title: t("6 стандартных маркеров риска", "6 Standard Risk Indicators"),
          description: t("Агрессия, Социальная изоляция, Бунт/саботаж, Эмоциональная нестабильность, Спад учебы и Внешние маркеры.", "Aggression, Social isolation, Opposition, Emotional instability, Academic drop, and Physical markers."),
        },
        {
          icon: "🔢",
          title: t("Балльная шкала (0, 1, 2)", "Point Scale (0, 1, 2)"),
          description: t("Клик по ячейке: Норма (0) → Слабая выраженность (1) → Острая выраженность (2) с автоподсчетом суммы.", "Cell click: Normal (0) → Moderate (1) → High (2) with auto-calculated total risk sum."),
        },
        {
          icon: "🚨",
          title: t("Кнопка сигнала [SOS]", "Urgent [SOS] Alert"),
          description: t("Возможность мгновенно передать сигнал школьному психологу с комментарием без бумажной волокиты.", "Instantly notify the school psychologist with comments without paper bureaucracy."),
        },
        {
          icon: "📊",
          title: t("Сводная карта класса", "Classroom Risk Map"),
          description: t("Школьный психолог сразу видит общую динамику класса и подключается на ранней стадии до кризиса.", "School psychologist immediately sees classroom dynamics and intervenes before crisis escalates."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Формирование списка класса", "Step 1. Class Roster"),
          subtitle: t("Автоматически из реестра или добавление вручную", "From registry or manual addition"),
          visualKind: "manual_form",
          calloutText: t("Ученики загружаются из школьного реестра либо добавляются классным руководителем.", "Students are loaded from registry or added by homeroom teacher."),
          checklist: [
            t("Выберите нужный класс", "Select class"),
            t("Проверьте наличие всех учащихся в списке", "Verify all students are present in list"),
          ],
        },
        {
          title: t("Шаг 2. Экспресс-оценка по клику", "Step 2. 1-Click Indicator Rating"),
          subtitle: t("Клик по ячейкам таблицы: 0 → 1 → 2", "Click cells: 0 → 1 → 2"),
          visualKind: "ai_magic",
          calloutText: t("Оценка занимает 1-2 минуты на весь класс. Цветовая подсветка сразу выделяет острые маркеры.", "Rating takes 1-2 minutes for the whole class. Color highlights instantly flag acute markers."),
          checklist: [
            t("Отметьте выраженность маркеров у учеников, вызывающих беспокойство", "Rate markers for students of concern"),
            t("Обратите внимание на сумму баллов риска", "Review the calculated total risk sum"),
          ],
        },
        {
          title: t("Шаг 3. Отправка сигнала психологу", "Step 3. Submit Alert to Psychologist"),
          subtitle: t("Нажмите «Отправить психологу»", "Click 'Submit to Psychologist'"),
          visualKind: "docx_export",
          calloutText: t("Данные мгновенно передаются на панель школьного психолога в защищенном контуре школы.", "Data is securely transmitted to the school psychologist's dashboard within the local perimeter."),
          checklist: [
            t("Добавьте краткий комментарий при необходимости", "Add brief contextual comment if needed"),
            t("Нажмите кнопку отправки", "Click submit button"),
          ],
        },
      ],
      tips: [
        t("Регулярный скрининг 1 раз в четверть позволяет выявить скрытый буллинг и дезадаптацию на самых ранних стадиях.", "Regular quarterly screening detects hidden bullying and maladaptation at the earliest stages."),
      ],
      learnMoreLink: {
        url: "https://prevention-ai.ru/academy/course/player.html#9",
        label: t("🎓 Смотреть видеоурок «Наблюдение и скрининг риска»", "🎓 Watch Video Lesson 'Observation & Risk Screening'"),
      },
      ctaText: t("Понятно, к журналу наблюдений", "Got it, go to observations journal"),
    };
  }

  // 6. IPR
  if (key === "ipr") {
    return {
      id: "ipr",
      title: t("ИПР: Индивидуальная программа реабилитации и сопровождения", "ISP: Individual Support & Rehabilitation Program"),
      badge: t("Комплексная модель ОРВ", "Targeted Support Model"),
      lead: t(
        "Полный регламент ведения сложных случаев дезадаптации и девиантного поведения: комплексная диагностика, целеполагание, психокоррекция и межведомственный консилиум.",
        "Comprehensive protocol for managing severe maladaptation and behavioral cases: diagnostics, goal setting, psychological intervention, and multidisciplinary coordination."
      ),
      overviewCards: [
        {
          icon: "📋",
          title: t("Структура и этапы программы", "Program Structure & Stages"),
          description: t("Стандартизированные блоки: Первичный сбор данных, Оценка рисков (ОРВ), План мероприятий, Мониторинг динамики.", "Standardized modules: Initial intake, Risk assessment, Action plan, and Dynamics monitoring."),
        },
        {
          icon: "🎯",
          title: t("Диагностические мишени", "Diagnostic Targets"),
          description: t("Точная фиксация факторов риска (семейные, школьные, личностные) и защитных ресурсов подростка.", "Precise identification of risk factors (family, school, personal) and adolescent protective assets."),
        },
        {
          icon: "🤝",
          title: t("Межведомственный консилиум", "Interagency Coordination"),
          description: t("Распределение зон ответственности: психолог, классный руководитель, социальный педагог, администрация, КДНиЗП.", "Responsibility matrix: psychologist, homeroom teacher, social educator, administration, youth commission."),
        },
        {
          icon: "📄",
          title: t("Официальная документация и экспорт", "Official Documentation & Export"),
          description: t("Печать полного пакета документов ИПР по утвержденным региональным и федеральным формам.", "Printing the complete ISP documentation package per approved regional and federal templates."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Первичная оценка и консилиум", "Step 1. Initial Assessment & Intake"),
          subtitle: t("Сбор анамнеза, факторов риска и защитных факторов", "History intake, risk factors and protective assets"),
          visualKind: "manual_form",
          calloutText: t("Заполните диагностические блоки и сформулируйте обоснование постановки на учет.", "Fill diagnostic sections and state the rationale for opening the support program."),
          checklist: [
            t("Укажите повод открытия ИПР", "Specify rationale for opening program"),
            t("Оцените уровень риска дезадаптации", "Evaluate maladaptation risk tier"),
          ],
        },
        {
          title: t("Шаг 2. Разработка плана интервенций", "Step 2. Intervention Action Plan"),
          subtitle: t("Индивидуальные занятия, работа с семьей, школьная среда", "Individual sessions, family work, school climate"),
          visualKind: "ai_magic",
          calloutText: t("Определите конкретные мероприятия, сроки и ответственных специалистов.", "Define specific activities, milestones, and responsible team members."),
          checklist: [
            t("Сформулируйте измеримые цели коррекционной работы", "Formulate measurable intervention goals"),
            t("Закрепите график встреч и контрольных срезов", "Establish meeting schedule and review checkpoints"),
          ],
        },
        {
          title: t("Шаг 3. Мониторинг и завершение программы", "Step 3. Progress Review & Program Closure"),
          subtitle: t("Оценка динамики по итогам контрольного периода", "Progress evaluation upon period completion"),
          visualKind: "docx_export",
          calloutText: t("Консилиум принимает решение о снятии с учета, продлении или корректировке программы.", "Case conference decides on program completion, extension, or adjustment."),
          checklist: [
            t("Зафиксируйте достигнутые результаты", "Document achieved milestones"),
            t("Сформируйте итоговый отчет консилиума", "Generate closing conference evaluation report"),
          ],
        },
      ],
      tips: [
        t("Воспользуйтесь кнопкой «Кейс Кирилла (10 мин)», чтобы посмотреть интерактивный разбор реального случая сопровождения.", "Click 'Kirill Case (10 mins)' to explore an interactive walkthrough of a real-life support case."),
      ],
      ctaText: t("Понятно, к программе сопровождения", "Got it, go to support program"),
    };
  }

  // 7. GROUP WORK
  if (key === "group_work" || key === "group") {
    return {
      id: "group_work",
      title: t("Групповая работа и тренинги", "Group Work & Workshops"),
      badge: t("Тренинги и классные часы", "Trainings & Group Sessions"),
      lead: t(
        "Учет групповых развивающих и коррекционных занятий, психологических тренингов, классных часов, родительских клубов и просветительских встреч.",
        "Management of group development and correction sessions, psychological workshops, homeroom classes, parent clubs, and psycho-educational lectures."
      ),
      overviewCards: [
        {
          icon: "👥",
          title: t("Журнал групповых занятий", "Group Sessions Log"),
          description: t("Фиксация даты, темы, целевой аудитории (класс, группа, педагоги, родители) и количества участников.", "Logging date, topic, target audience (grade, group, educators, parents), and participant count."),
        },
        {
          icon: "🎯",
          title: t("Тематические тренинговые программы", "Training Programs & Themes"),
          description: t("Учет занятий по сплочению коллектива, развитию эмоционального интеллекта, профилактике буллинга и стресса.", "Tracking team building, emotional intelligence, anti-bullying, and stress prevention programs."),
        },
        {
          icon: "📊",
          title: t("Охват и учет часов нагрузки", "Coverage & Workload Hours"),
          description: t("Все групповые мероприятия автоматически суммируются в годовой отчет и подтверждают часы просветительской работы.", "All group events automatically aggregate into annual reports and verify group workload hours."),
        },
        {
          icon: "📄",
          title: t("Протокол группового занятия", "Group Session Protocol"),
          description: t("Быстрое формирование официального протокола или сценария проведенного занятия для аттестации.", "Quick generation of official group session protocols or activity scenarios for accreditation."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Создание группового мероприятия", "Step 1. Create Group Event"),
          subtitle: t("Укажите тему, дату и целевую аудиторию", "Specify topic, date, and target audience"),
          visualKind: "manual_form",
          calloutText: t("Выберите направление: тренинг, классный час, родительское собрание или семинар для учителей.", "Select category: training, homeroom class, parent meeting, or teacher workshop."),
          checklist: [
            t("Укажите тему и цель занятия", "Enter topic and objective"),
            t("Выберите класс или группу участников", "Select class or participant cohort"),
          ],
        },
        {
          title: t("Шаг 2. Фиксация хода и динамики группы", "Step 2. Document Progress & Group Dynamics"),
          subtitle: t("Отметьте вовлеченность и ключевые упражнения", "Note engagement and key exercises"),
          visualKind: "voice_mic",
          calloutText: t("Кратко запишите, какие упражнения вызвали наибольший отклик и какие сложности возникли.", "Briefly note which exercises had the strongest impact and any difficulties encountered."),
          checklist: [
            t("Укажите количество присутствующих", "Record number of attendees"),
            t("Зафиксируйте выводы и рекомендации", "Document key takeaways and recommendations"),
          ],
        },
        {
          title: t("Шаг 3. Сохранение в отчетность", "Step 3. Save to Workload Stats"),
          subtitle: t("Автоматический зачет часов в годовую нагрузку", "Automatic hour credit in annual workload"),
          visualKind: "docx_export",
          calloutText: t("Занятие автоматически учитывается в часах групповой и просветительской деятельности.", "Activity auto-registers into group and preventive education workload hours."),
          checklist: [
            t("Сохраните протокол мероприятия", "Save event protocol"),
            t("При необходимости распечатайте сценарий", "Print scenario or protocol if needed"),
          ],
        },
      ],
      tips: [
        t("Фиксация родительских собраний в этом разделе позволяет подтвердить охват родительской общественности для аттестации.", "Logging parent meetings here verifies parental outreach coverage for specialist certification."),
      ],
      ctaText: t("Понятно, к групповой работе", "Got it, go to group work"),
    };
  }

  // 8. SAFE ENVIRONMENT / SOS
  if (key === "safe_environment" || key === "safety") {
    return {
      id: "safe_environment",
      title: t("Безопасная среда и SOS-протоколы", "Safe School Climate & Crisis SOS"),
      badge: t("Кризисное реагирование", "Crisis Response"),
      lead: t(
        "Алгоритмы экстренного реагирования и протоколы профилактики кризисных ситуаций: буллинг, аутоагрессивное поведение, семейное насилие и деструктивные группы.",
        "Emergency response algorithms and prevention protocols for crisis situations: bullying, self-harm, family violence, and destructive behaviors."
      ),
      overviewCards: [
        {
          icon: "🛡️",
          title: t("Алгоритмы пошаговых действий", "Step-by-Step Crisis Algorithms"),
          description: t("Четкие пошаговые регламенты действий специалиста при выявлении суицидального риска, буллинга или насилия.", "Step-by-step specialist action protocols for self-harm risk, bullying incidents, or abuse disclosures."),
        },
        {
          icon: "🚨",
          title: t("Экстренная фиксация инцидента", "Emergency Incident Logging"),
          description: t("Быстрое составление служебной записки и акта первичного реагирования с юридически выверенными формулировками.", "Fast incident documentation and initial response memo drafting with legally verified phrasing."),
        },
        {
          icon: "📞",
          title: t("Телефоны экстренных служб", "Emergency Hotlines & Contacts"),
          description: t("Контакты кризисных служб, детского телефона доверия, служб психологической помощи и органов опеки.", "Contacts for crisis hotlines, child helplines, municipal psychological centers, and guardianship services."),
        },
        {
          icon: "🔒",
          title: t("Конфиденциальность и безопасность", "Confidentiality & Privacy"),
          description: t("Все кризисные протоколы шифруются и защищены строгими протоколами служебной тайны.", "All crisis records are encrypted and protected under strict professional confidentiality rules."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Выбор типа кризисной ситуации", "Step 1. Select Crisis Type"),
          subtitle: t("Буллинг, кризис/аутоагрессия, насилие, деструктивное поведение", "Bullying, self-harm crisis, abuse, destructive group"),
          visualKind: "manual_form",
          calloutText: t("Выберите категорию ситуации, чтобы система открыла соответствующий алгоритм действий.", "Select situation category to open the specialized action protocol."),
          checklist: [
            t("Определите степень срочности (Экстренно / Планово)", "Assess urgency level (Urgent / Planned)"),
            t("Ознакомьтесь с чек-листом первоочередных мер безопасности", "Review immediate safety checklist"),
          ],
        },
        {
          title: t("Шаг 2. Выполнение обязательных шагов", "Step 2. Execute Mandatory Protocol Steps"),
          subtitle: t("Уведомление администрации, беседа, привлечение служб", "Admin notification, interview, interagency referral"),
          visualKind: "voice_mic",
          calloutText: t("Следуйте пунктам алгоритма: безопасность ребенка, информирование руководства, контакт с родителями.", "Follow the protocol steps: child safety, informing management, contacting parents."),
          checklist: [
            t("Обеспечьте безопасную обстановку для ребенка", "Ensure safe environment for child"),
            t("Уведомите руководство школы / центра", "Notify school / center leadership"),
          ],
        },
        {
          title: t("Шаг 3. Составление служебных документов", "Step 3. Generate Official Crisis Memo"),
          subtitle: t("Акт первичного реагирования и направление к специалистам", "Initial incident report and referral documentation"),
          visualKind: "docx_export",
          calloutText: t("Сформируйте официальный документ для передачи в консилиум или внешние кризисные службы.", "Generate official report for internal multidisciplinary team or external crisis agencies."),
          checklist: [
            t("Зафиксируйте принятые меры", "Document measures taken"),
            t("Сохраните протокол в защищенный архив", "Save protocol to secure archive"),
          ],
        },
      ],
      tips: [
        t("В ситуациях непосредственной угрозы жизни ребенка немедленно связывайтесь с экстренными службами и руководством.", "In direct life-threatening situations, immediately contact emergency services and administration."),
      ],
      ctaText: t("Понятно, к разделу безопасности", "Got it, go to safety section"),
    };
  }

  // 9. ANALYTICAL REPORT
  if (key === "analytical_report" || key === "reports" || key === "report") {
    return {
      id: "analytical_report",
      title: isCommercial ? t("Аналитика практики и отчеты", "Practice Analytics & Reports") : t("Аналитический и годовой отчет", "Analytical & Annual Report"),
      badge: t("Сводная отчетность", "Summary Reports"),
      lead: isCommercial
        ? t("Сводная аналитика частной практики: количество сессий, распределение по темам запросов, динамика клиентов и финансовая отчетность.", "Summary private practice analytics: session volume, request topic distribution, client dynamics, and revenue stats.")
        : t("Автоматический свод работы психологической службы по всем направлениям ФГОС: диагностика, коррекция, консультирование, просвещение и экспертиза.", "Automatic summary of school psychological service across all standard areas: diagnostics, intervention, counseling, and prevention."),
      overviewCards: [
        {
          icon: "📊",
          title: t("Автоматический свод за период", "Automated Period Summary"),
          description: t("Выбор любого периода (четверть, полугодие, учебный год или произвольные даты) с мгновенным пересчетом всех показателей.", "Select any period (term, semester, school year, or custom dates) with instant recalculation."),
        },
        {
          icon: "📈",
          title: t("Диаграммы и структура нагрузки", "Charts & Workload Breakdown"),
          description: t("Наглядные графики распределения времени по направлениям работы и охвату целевых аудиторий.", "Visual charts of time distribution across activity types and target audience coverage."),
        },
        {
          icon: "📄",
          title: t("Экспорт в Word (DOCX) по ГОСТ", "Export to Word (DOCX)"),
          description: t("Формирование готового официального аналитического отчета с текстовыми выводами и таблицами.", "Generating complete official analytical report with text conclusions and data tables."),
        },
        {
          icon: "🔒",
          title: t("Конфиденциальность данных", "Data Privacy"),
          description: t("В отчет включаются только обобщенные статистические данные без раскрытия персональных тайн.", "Only aggregated statistical data is included without exposing personal details."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Выбор отчетного периода", "Step 1. Select Reporting Period"),
          subtitle: t("Четверть, полугодие, год или свой диапазон", "Term, semester, full year or custom range"),
          visualKind: "manual_form",
          calloutText: t("Выберите нужный период — система мгновенно соберет данные из всех ваших журналов и кейсов.", "Pick desired timeframe — system aggregates data from all your logs and cases instantly."),
          checklist: [
            t("Установите границы периода", "Set period boundaries"),
            t("Проверьте общие счетчики консультаций и занятий", "Verify total session and activity counters"),
          ],
        },
        {
          title: t("Шаг 2. Просмотр и редактирование выводов", "Step 2. Review & Refine Conclusions"),
          subtitle: t("Проверьте текстовые блоки и аналитические выводы", "Review text blocks and analytical takeaways"),
          visualKind: "ai_magic",
          calloutText: t("Вы можете дополнить текстовые разделы отчета своими авторскими комментариями и выводами.", "Supplement text sections with your own professional insights and conclusions."),
          checklist: [
            t("Оцените динамику решения проблемных ситуаций", "Evaluate dynamics of resolved situations"),
            t("Сформулируйте задачи на следующий период", "Outline objectives for next period"),
          ],
        },
        {
          title: t("Шаг 3. Скачивание официального отчета", "Step 3. Download Official Report"),
          subtitle: t("Нажмите «Скачать отчет DOCX»", "Click 'Download DOCX Report'"),
          visualKind: "docx_export",
          calloutText: t("Готовый документ сформирован с правильными отступами, таблицами и местом для подписи.", "Finished document is formatted with standard margins, tables, and signature blocks."),
          checklist: [
            t("Скачайте файл DOCX", "Download DOCX file"),
            t("Распечатайте или отправьте руководству", "Print or email to administration"),
          ],
        },
      ],
      tips: [
        t("Благодаря ежедневному ведению журнала подготовка годового отчета занимает ровно 1 минуту.", "Because you maintain daily records in the journal, annual report preparation takes exactly 1 minute."),
      ],
      ctaText: t("Понятно, к отчетам", "Got it, go to reports"),
    };
  }

  // 10. WORKLOAD
  if (key === "workload") {
    return {
      id: "workload",
      title: t("Учет рабочего времени и нагрузка", "Workload Tracking & Hours Balance"),
      badge: t("Нормирование труда", "Workload Standards"),
      lead: t(
        "Мониторинг баланса 36-часовой рабочей недели школьного психолога: 18 часов непосредственной работы с людьми и 18 часов научно-методической подготовки.",
        "Monitoring the 36-hour weekly workload balance: 18 hours of direct client work and 18 hours of methodological preparation."
      ),
      overviewCards: [
        {
          icon: "⏱️",
          title: t("Баланс 18ч + 18ч", "18h + 18h Balance"),
          description: t("Наглядное разделение часов: индивидуальная и групповая работа vs подготовка, обработка тестов и консилиумы.", "Clear separation: direct individual & group sessions vs preparation, test processing, and case conferences."),
        },
        {
          icon: "📊",
          title: t("Диаграмма по видам деятельности", "Activity Distribution Chart"),
          description: t("Консультирование, диагностика, развивающая работа, просвещение, экспертиза и методработа.", "Counseling, diagnostics, developmental interventions, prevention, expertise, and method work."),
        },
        {
          icon: "🛡️",
          title: t("Защита от перегрузок", "Overwork Protection"),
          description: t("Предупреждение о перекосах в нагрузке и обоснование нормативов перед администрацией.", "Alerts on workload imbalances and verifiable standards for administrative review."),
        },
        {
          icon: "📄",
          title: t("Справка о фактически отработанном времени", "Actual Working Hours Summary"),
          description: t("Формирование официальной выписки по отработанным часам за любой месяц или четверть.", "Generating official statements of actual hours worked for any month or term."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Просмотр текущей недели", "Step 1. Review Current Week"),
          subtitle: t("Счетчики часов прямой и методической работы", "Direct and method work hour counters"),
          visualKind: "manual_form",
          calloutText: t("Система автоматически учитывает все консультации, занятия и консилиумы из ваших журналов.", "System automatically accounts for all sessions, activities, and meetings from your logs."),
          checklist: [
            t("Проверьте сумму часов прямой работы", "Check sum of direct work hours"),
            t("Убедитесь в балансе с методическими часами", "Verify balance with methodological hours"),
          ],
        },
        {
          title: t("Шаг 2. Добавление методической работы", "Step 2. Log Methodological Work"),
          subtitle: t("Обработка методик, подготовка заключений, супервизия", "Test scoring, report writing, supervision"),
          visualKind: "ai_magic",
          calloutText: t("Фиксируйте время, затраченное на составление программ, обработку тестов и методические совещания.", "Log time spent drafting programs, scoring assessments, and attending team meetings."),
          checklist: [
            t("Внесите часы подготовки к занятиям", "Enter session preparation hours"),
            t("Отметьте участие в консилиумах и совещаниях", "Note attendance at conferences and meetings"),
          ],
        },
        {
          title: t("Шаг 3. Формирование табеля / справки", "Step 3. Generate Timesheet / Statement"),
          subtitle: t("Официальное подтверждение выполнения нормы", "Official verification of standard fulfillment"),
          visualKind: "docx_export",
          calloutText: t("Готовая справка подтверждает соблюдение нормативов рабочего времени при аттестации.", "Ready statement confirms working hour compliance during accreditation reviews."),
          checklist: [
            t("Сверьте итоговые часы за месяц", "Reconcile monthly total hours"),
            t("Экспортируйте выписку при необходимости", "Export statement if needed"),
          ],
        },
      ],
      tips: [
        t("Все нормативы соответствуют Приказу Минобрнауки РФ о продолжительности рабочего времени педагогических работников.", "All standards comply with official regulations on educator working hours."),
      ],
      ctaText: t("Понятно, к учету нагрузки", "Got it, go to workload section"),
    };
  }

  // 11. CALENDAR
  if (key === "calendar") {
    return {
      id: "calendar",
      title: t("Календарь и расписание", "Calendar & Scheduling"),
      badge: t("Планирование встреч", "Appointment Planning"),
      lead: t(
        "Удобный календарь для планирования индивидуальных приемов, школьных консилиумов, родительских встреч и групповых занятий.",
        "Convenient calendar for scheduling individual sessions, case conferences, parent meetings, and group activities."
      ),
      overviewCards: [
        {
          icon: "📅",
          title: t("Сетка расписания", "Schedule Grid"),
          description: t("Просмотр по дням, неделям и месяцам с цветовым кодированием типов встреч.", "View by day, week, and month with color-coded appointment types."),
        },
        {
          icon: "⏰",
          title: t("Слоты и напоминания", "Time Slots & Reminders"),
          description: t("Гибкая настройка длительности сессий, перерывов и фиксация времени для подготовки.", "Flexible session duration settings, breaks, and buffer time allocation."),
        },
        {
          icon: "🔗",
          title: t("Связь с журналами и карточками", "Direct Log Integration"),
          description: t("Из запланированного слота можно в 1 клик перейти к началу сессии или карточке клиента.", "Jump directly from any scheduled slot into the session protocol or client card in 1 click."),
        },
        {
          icon: "🔄",
          title: t("Повторяющиеся события", "Recurring Events"),
          description: t("Быстрое создание регулярных еженедельных занятий, консилиумов и циклических консультаций.", "Quick creation of recurring weekly sessions, conferences, and cyclical consultations."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Создание события в календаре", "Step 1. Create Calendar Event"),
          subtitle: t("Кликните на нужное время в сетке дня", "Click the desired time slot in the day grid"),
          visualKind: "manual_form",
          calloutText: t("Выберите клиента/ученика и тип встречи (консультация, диагностика, консилиум, родительское собрание).", "Select client/student and meeting type (consultation, diagnostics, conference, parent meeting)."),
          checklist: [
            t("Укажите время начала и окончания", "Set start and end time"),
            t("Выберите участника из картотеки/реестра", "Select participant from database/registry"),
          ],
        },
        {
          title: t("Шаг 2. Настройка напоминаний", "Step 2. Set Notes & Reminders"),
          subtitle: t("Добавьте тему и важные детали встречи", "Add meeting topic and key details"),
          visualKind: "voice_mic",
          calloutText: t("Зафиксируйте предварительную цель встречи или вопросы, которые необходимо обсудить.", "Note preliminary meeting objective or questions to be discussed."),
          checklist: [
            t("Укажите формат (очно / онлайн)", "Specify format (in-person / online)"),
            t("Добавьте краткую заметку", "Add a brief prep note"),
          ],
        },
        {
          title: t("Шаг 3. Старт приема из календаря", "Step 3. Launch Session from Slot"),
          subtitle: t("1 клик открывает протокол консультации", "1 click opens the session protocol"),
          visualKind: "docx_export",
          calloutText: t("Когда наступает время встречи, нажмите на слот в календаре для мгновенного перехода к протоколу.", "When appointment time arrives, click the calendar slot to open the protocol instantly."),
          checklist: [
            t("Откройте протокол встречи", "Open meeting protocol"),
            t("Зафиксируйте результаты после сессии", "Record results after session"),
          ],
        },
      ],
      tips: [
        t("Цветовые метки помогают с первого взгляда оценить баланс индивидуальных приемов и групповых занятий на неделю.", "Color tags help you instantly visualize the weekly balance between individual and group commitments."),
      ],
      ctaText: t("Понятно, к календарю", "Got it, go to calendar"),
    };
  }

  // 12. WEBINARS & VIDEO ROOM
  if (key === "webinars" || key === "webinar" || key === "video_room" || key === "video") {
    return {
      id: "webinars",
      title: t("Вебинары и защищенные видеовстречи", "Webinars & Secure Video Sessions"),
      badge: t("Онлайн-прием и трансляции", "Online Consultations & Broadcasts"),
      lead: t(
        "Встроенная защищенная видеосвязь для онлайн-консультаций с клиентами, родительских собраний, супервизий и обучающих вебинаров.",
        "Built-in secure video conferencing for online client sessions, parent meetings, supervisions, and educational webinars."
      ),
      overviewCards: [
        {
          icon: "🎥",
          title: t("Защищенная видеокомната", "Encrypted Video Room"),
          description: t("Высокое качество видео и звука без необходимости установки сторонних программ клиентом (работает по ссылке в браузере).", "High-quality video and audio without requiring client software installs (works via browser link)."),
        },
        {
          icon: "🎙️",
          title: t("Родительские онлайн-собрания", "Online Parent Meetings"),
          description: t("Проведение собраний с родителями с защитой от посторонних и автоматической фиксацией присутствующих.", "Hosting parent meetings with access protection and automated attendee logging."),
        },
        {
          icon: "📝",
          title: t("Заметки и протокол во время встречи", "In-Meeting Notes & Protocol"),
          description: t("Возможность вести рабочий протокол прямо в процессе видеовстречи на соседней панели экрана.", "Take working notes and draft protocol side-by-side during the live video session."),
        },
        {
          icon: "🔒",
          title: t("Сквозная безопасность (WebRTC)", "End-to-End Security (WebRTC)"),
          description: t("Прямое шифрованное соединение гарантирует конфиденциальность психологической беседы.", "Direct peer-to-peer encrypted connection guarantees psychological session privacy."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Создание видеокомнаты / ссылки", "Step 1. Generate Video Room / Link"),
          subtitle: t("Нажмите «Создать комнату» и скопируйте ссылку", "Click 'Create Room' and copy invite link"),
          visualKind: "manual_form",
          calloutText: t("Отправьте ссылку клиенту или родителям в любой мессенджер — они подключатся в 1 клик со смартфона.", "Send the link to client or parents via any messenger — they join in 1 click from their phone."),
          checklist: [
            t("Укажите тему встречи", "Enter meeting topic"),
            t("Скопируйте ссылку-приглашение", "Copy invitation link"),
          ],
        },
        {
          title: t("Шаг 2. Проведение онлайн-встречи", "Step 2. Conduct Online Meeting"),
          subtitle: t("Видеосвязь, демонстрация экрана и заметки", "Video, screen sharing, and live notes"),
          visualKind: "voice_mic",
          calloutText: t("Используйте разделение экрана: видео собеседника слева, ваши терапевтические заметки справа.", "Use split screen: participant video on the left, your therapeutic notes on the right."),
          checklist: [
            t("Проверьте микрофон и камеру", "Check microphone and camera"),
            t("Ведите тезисы консультации в процессе беседы", "Log session insights during conversation"),
          ],
        },
        {
          title: t("Шаг 3. Завершение и сохранение протокола", "Step 3. End Call & Save Protocol"),
          subtitle: t("Запись автоматически попадает в журнал сессий", "Entry auto-attaches to sessions journal"),
          visualKind: "docx_export",
          calloutText: t("После завершения звонка протокол сохраняется в карточке клиента с отметкой об онлайн-формате.", "After call ends, protocol saves to client card marked as an online session."),
          checklist: [
            t("Нажмите «Завершить встречу»", "Click 'End Meeting'"),
            t("Сохраните протокол консультации", "Save consultation protocol"),
          ],
        },
      ],
      tips: [
        t("Клиенту не нужно регистрироваться — он просто переходит по вашей безопасной ссылке с телефона или компьютера.", "Clients do not need to register — they simply open your secure link on phone or computer."),
      ],
      ctaText: t("Понятно, к видеовстречам", "Got it, go to video meetings"),
    };
  }

  // 13. IDA CLIENTS BRIDGE
  if (key === "ida_clients") {
    return {
      id: "ida_clients",
      title: t("Мост IDA: связь с приложением клиента", "IDA Bridge: Client Mobile Companion"),
      badge: t("Клиентский мост", "Client Bridge"),
      lead: t(
        "Интерактивная связь со смартфоном клиента: отправка домашних заданий, дневников мыслей (КПТ/ОРКТ), трекеров самочувствия и безопасный чат.",
        "Interactive link with client's smartphone: assigning home tasks, thought records (CBT/SFBT), mood trackers, and secure chat."
      ),
      overviewCards: [
        {
          icon: "📱",
          title: t("Мобильное приложение клиента", "Client Mobile App"),
          description: t("Клиент ведет дневник мыслей, отмечает уровень тревоги и выполняет практики прямо в своем телефоне.", "Client keeps thought journals, tracks anxiety levels, and completes exercises directly on their phone."),
        },
        {
          icon: "🔗",
          title: t("Инвайт-код в 1 клик", "1-Click QR / Invite Code"),
          description: t("Генерация защищенной ссылки или QR-кода для мгновенного сопряжения приложения клиента с вашим терминалом.", "Generate secure link or QR code for instant pairing of client app with your workspace."),
        },
        {
          icon: "📝",
          title: t("Назначение заданий и практик", "Assigning Exercises & Tasks"),
          description: t("Отправляйте техники саморегуляции, поведенческие эксперименты и дневники эмоций прямо из карточки.", "Send self-regulation techniques, behavioral experiments, and emotion journals right from card."),
        },
        {
          icon: "📊",
          title: t("Сводка динамики к началу сессии", "Pre-Session Dynamics Summary"),
          description: t("Перед началом очередной сессии вы сразу видите, как менялось состояние клиента за неделю.", "Before each session, immediately see how client's mood and compliance evolved during the week."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Отправка инвайта клиенту", "Step 1. Send Invite to Client"),
          subtitle: t("Сгенерируйте ссылку-приглашение", "Generate personal invitation link"),
          visualKind: "manual_form",
          calloutText: t("Клиент переходит по ссылке и подключается к вашему кабинету без сложных паролей.", "Client opens link and connects to your workspace without complex passwords."),
          checklist: [
            t("Нажмите «Пригласить клиента»", "Click 'Invite Client'"),
            t("Отправьте QR-код или ссылку в мессенджер", "Send QR code or link via messenger"),
          ],
        },
        {
          title: t("Шаг 2. Назначение домашних заданий", "Step 2. Assign Home Tasks & Journals"),
          subtitle: t("Выберите упражнение или технику", "Select exercise or technique"),
          visualKind: "companion_bridge",
          calloutText: t("Назначьте дневник автоматических мыслей, шкалу настроения или дыхательное упражнение.", "Assign automatic thoughts journal, mood scale, or breathing exercise."),
          checklist: [
            t("Выберите технику из встроенной библиотеки", "Select technique from built-in library"),
            t("Установите срок и частоту заполнения", "Set schedule and completion frequency"),
          ],
        },
        {
          title: t("Шаг 3. Анализ записей перед встречей", "Step 3. Review Insights Before Session"),
          subtitle: t("Просмотр динамики и выполненных записей", "Review compliance and state progression"),
          visualKind: "docx_export",
          calloutText: t("Вы видите график динамики и конкретные записи мыслей клиента, что экономит 15 минут в начале сессии.", "View mood graphs and specific thought records, saving 15 minutes at the start of each session."),
          checklist: [
            t("Просмотрите записи клиента за неделю", "Review client's weekly journal entries"),
            t("Используйте материал для фокуса новой сессии", "Use findings to focus the new session"),
          ],
        },
      ],
      tips: [
        t("Клиент видит в приложении только то, что вы ему назначили. Ваши внутренние терапевтические заметки остаются скрытыми.", "Clients only see assigned tasks. Your private clinical notes remain completely invisible to them."),
      ],
      ctaText: t("Понятно, к мосту с клиентами", "Got it, go to client bridge"),
    };
  }

  // 14. AI CONSULTANT
  if (key === "ai_consultant" || key === "ai") {
    return {
      id: "ai_consultant",
      title: t("Профессиональный ИИ-ассистент психолога", "Professional AI Psychological Assistant"),
      badge: t("Методическая поддержка", "Clinical & Methodological Support"),
      lead: t(
        "Методический консультант и супервизор в трудных случаях: генерация гипотез, подбор интервенций по школам (КПТ, ОРКТ, Гештальт), составление рекомендаций для учителей и родителей.",
        "Clinical assistant for complex cases: hypothesis formulation, intervention selection across modalities (CBT, SFBT, Gestalt), and drafting tailored advice for teachers and parents."
      ),
      overviewCards: [
        {
          icon: "🧠",
          title: t("Клинические и терапевтические гипотезы", "Clinical & Therapeutic Hypotheses"),
          description: t("Анализ симптоматики и структуры трудностей клиента с позиций доказательных психотерапевтических подходов.", "Analyzing symptoms and client difficulties through evidence-based psychotherapy frameworks."),
        },
        {
          icon: "🎯",
          title: t("Подбор техник и интервенций", "Techniques & Intervention Matching"),
          description: t("Точный подбор упражнений, метафор, домашних заданий и протоколов под конкретный запрос.", "Precision matching of exercises, metaphors, home tasks, and protocols for specific requests."),
        },
        {
          icon: "📝",
          title: t("Формулировки для родителей и педагогов", "Phrasing for Parents & Teachers"),
          description: t("Перевод профессионального психологического видения на простой, бережный и понятный человеческий язык.", "Translating complex psychological findings into empathetic, actionable advice for laypeople."),
        },
        {
          icon: "🔒",
          title: t("Анонимный контур запросов", "Depersonalized Query Perimeter"),
          description: t("Персональные данные не передаются: в запросах используются только обезличенные клинические маркеры.", "Personal identities are never transmitted: only anonymized clinical markers are analyzed."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Формулирование запроса или ситуации", "Step 1. Describe Situation or Case"),
          subtitle: t("Опишите ситуацию своими словами или надиктуйте", "Describe situation in your words or dictate"),
          visualKind: "voice_mic",
          calloutText: t("Укажите возраст клиента, основные жалобы, контекст ситуации и в чем состоит главная трудность.", "Specify client age, core complaints, situational context, and where the main roadblock lies."),
          checklist: [
            t("Опишите проявления и симптомы", "Describe manifestations and symptoms"),
            t("Укажите желаемый подход (КПТ, ОРКТ, семейный и др.)", "Specify preferred approach (CBT, SFBT, family, etc.)"),
          ],
        },
        {
          title: t("Шаг 2. Получение структурированного разбора", "Step 2. Receive Structured Analysis"),
          subtitle: t("Гипотезы, мишени работы, техники и вопросы для сессии", "Hypotheses, work targets, techniques, session questions"),
          visualKind: "ai_magic",
          calloutText: t("Ассистент предоставит структурированный план беседы, список диагностических вопросов и упражнения.", "Assistant provides a structured interview plan, diagnostic inquiry questions, and exercises."),
          checklist: [
            t("Изучите предложенные гипотезы", "Review suggested hypotheses"),
            t("Выберите подходящие техники для сессии", "Select suitable techniques for session"),
          ],
        },
        {
          title: t("Шаг 3. Использование в работе с клиентом", "Step 3. Apply in Session or Notes"),
          subtitle: t("Скопируйте рекомендации в карточку кейса", "Copy recommendations into case file"),
          visualKind: "docx_export",
          calloutText: t("Используйте сгенерированные материалы для подготовки к сессии, консилиуму или супервизии.", "Use generated materials for session preparation, multidisciplinary conference, or supervision."),
          checklist: [
            t("Скопируйте текст в протокол или заметки", "Copy text into protocol or notes"),
            t("Адаптируйте под индивидуальные особенности клиента", "Tailor to client's individual needs"),
          ],
        },
      ],
      tips: [
        t("Ассистент обучен на клинических протоколах и стандартах психологического консультирования.", "Assistant is trained on evidence-based clinical protocols and ethical counseling standards."),
      ],
      ctaText: t("Понятно, к ИИ-ассистенту", "Got it, go to AI assistant"),
    };
  }

  // 15. LIBRARY / ACADEMY
  if (key === "library" || key === "academy" || key === "articles" || key === "methodology") {
    return {
      id: "library",
      title: t("База знаний, методики и Академия", "Knowledge Base, Protocols & Academy"),
      badge: t("Библиотека специалиста", "Specialist Library"),
      lead: t(
        "Библиотека проверенных методик психодиагностики, клинических протоколов, стандартов сопровождения и обучающих видеокурсов.",
        "Library of validated psychodiagnostic tools, clinical protocols, support standards, and video masterclasses."
      ),
      overviewCards: [
        {
          icon: "📚",
          title: t("Банк диагностических методик", "Diagnostic Assessment Bank"),
          description: t("Стандартизированные опросники, проективные тесты и скрининги с ключами и нормами обработки.", "Standardized questionnaires, projective tests, and screening scales with scoring keys."),
        },
        {
          icon: "📋",
          title: t("Практические протоколы по проблемам", "Problem-Based Protocols"),
          description: t("Готовые пошаговые протоколы работы с тревогой, паническими атаками, буллингом, детскими капризами и депрессией.", "Step-by-step protocols for anxiety, panic attacks, bullying, childhood defiance, and depression."),
        },
        {
          icon: "🎓",
          title: t("Академия и видеоуроки", "Academy & Video Lessons"),
          description: t("Обучающие видеоматериалы от ведущих экспертов по ключевым темам психологической практики.", "Educational masterclasses by leading experts on essential topics of psychological practice."),
        },
        {
          icon: "📄",
          title: t("Бланки, опросники и раздаточные материалы", "Printable Blanks & Handouts"),
          description: t("Готовые для печати стимульные материалы, бланки для клиентов и памятки для родителей.", "Print-ready stimulus materials, client exercise sheets, and parent guidance brochures."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Поиск методики или протокола", "Step 1. Search Tool or Protocol"),
          subtitle: t("Используйте строку поиска или фильтр по категориям", "Use search bar or category filters"),
          visualKind: "manual_form",
          calloutText: t("Фильтруйте материалы по возрасту (младшие школьники, подростки, взрослые) или по теме запроса.", "Filter materials by age (elementary, adolescents, adults) or by problem category."),
          checklist: [
            t("Введите тему или название методики в поиск", "Enter topic or tool name in search bar"),
            t("Выберите нужный раздел библиотеки", "Select target library category"),
          ],
        },
        {
          title: t("Шаг 2. Изучение протокола и инструкций", "Step 2. Study Protocol & Guidelines"),
          subtitle: t("Ознакомьтесь со структурой проведения", "Review implementation structure"),
          visualKind: "ai_magic",
          calloutText: t("Каждый протокол содержит четкие этапы: от установления контакта до домашних заданий.", "Every protocol features clear phases: from rapport building to home exercises."),
          checklist: [
            t("Ознакомьтесь с клиническими рекомендациями", "Review clinical guidance"),
            t("Изучите критерии интерпретации результатов", "Check scoring and interpretation criteria"),
          ],
        },
        {
          title: t("Шаг 3. Скачивание бланков для работы", "Step 3. Download Printables"),
          subtitle: t("Распечатайте стимульный материал или опросник", "Print stimulus sheets or questionnaires"),
          visualKind: "docx_export",
          calloutText: t("Скачивайте готовые PDF или DOCX бланки для раздачи клиентам или ученикам на очном приеме.", "Download ready PDF or DOCX blanks for distribution during in-person sessions."),
          checklist: [
            t("Скачайте нужный бланк", "Download required blank"),
            t("Используйте в консультационной практике", "Incorporate into consultation workflow"),
          ],
        },
      ],
      tips: [
        t("Все материалы библиотеки регулярно обновляются ведущими экспертами Академии.", "All library materials are continually updated by leading clinical faculty."),
      ],
      ctaText: t("Понятно, к базе знаний", "Got it, go to knowledge base"),
    };
  }

  // 16. FINANCES
  if (key === "finances") {
    return {
      id: "finances",
      title: t("Финансы и учет оплат", "Finances & Billing"),
      badge: t("Финансовый учет", "Financial Accounting"),
      lead: t(
        "Учет стоимости консультаций, абонементов, поступивших оплат, задолженностей и финансовая сводка частной практики или психологического центра.",
        "Tracking session fees, subscriptions, incoming payments, outstanding balances, and financial summaries for private practices or centers."
      ),
      overviewCards: [
        {
          icon: "💰",
          title: t("Сводка выручки и доходов", "Revenue & Earnings Summary"),
          description: t("Наглядные счетчики поступлений за сегодня, текущую неделю, месяц и год.", "Clear counters of incoming revenue for today, current week, month, and full year."),
        },
        {
          icon: "💳",
          title: t("Учет оплат по клиентам", "Client Payment Records"),
          description: t("Фиксация факта оплаты каждой сессии, баланс депозитов и учет предоплат.", "Logging payment per session, client deposit balances, and prepayment records."),
        },
        {
          icon: "📦",
          title: t("Пакеты сессий и абонементы", "Session Packages & Subscriptions"),
          description: t("Удобное ведение пакетных предложений (например, 5 или 10 сессий) с автоматическим списанием.", "Easy tracking of package deals (e.g. 5 or 10 sessions) with automated balance deduction."),
        },
        {
          icon: "📄",
          title: t("Финансовые отчеты и экспорт", "Financial Export & Statements"),
          description: t("Выгрузка финансовой статистики в Excel для бухгалтерии или налогового учета.", "Exporting financial data to Excel for accounting and tax reporting."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Настройка тарифов и услуг", "Step 1. Configure Services & Rates"),
          subtitle: t("Укажите базовую стоимость индивидуальных и семейных сессий", "Set base rates for individual and couples sessions"),
          visualKind: "manual_form",
          calloutText: t("Настройте стоимость различных типов консультаций — она будет автоматически подставляться в журнал.", "Configure rates for various consultation formats — auto-applied in the session log."),
          checklist: [
            t("Укажите стоимость индивидуальной сессии", "Set individual session price"),
            t("Укажите стоимость парной/семейной консультации", "Set couples/family session price"),
          ],
        },
        {
          title: t("Шаг 2. Фиксация оплаты после сессии", "Step 2. Record Payment Upon Completion"),
          subtitle: t("Отметьте факт оплаты в 1 клик", "Mark payment received in 1 click"),
          visualKind: "ai_magic",
          calloutText: t("В журнале сессий выберите способ оплаты (карта, наличные, безналичный расчет) или спишите сессию с пакета.", "Select payment method (card, cash, transfer) or deduct session from active package."),
          checklist: [
            t("Отметьте статус оплаты", "Mark payment status"),
            t("При необходимости внесите комментарий", "Add payment memo if needed"),
          ],
        },
        {
          title: t("Шаг 3. Анализ доходов и отчетность", "Step 3. Analyze Revenue & Trends"),
          subtitle: t("Графики доходности практики", "Practice revenue charts & analytics"),
          visualKind: "docx_export",
          calloutText: t("Отслеживайте динамику выручки, средний чек и регулярность оплат в наглядных графиках.", "Monitor income dynamics, average session value, and payment regularities in visual charts."),
          checklist: [
            t("Проверяйте балансы клиентов", "Review client deposit balances"),
            t("Скачивайте финансовый отчет за месяц", "Download monthly revenue spreadsheet"),
          ],
        },
      ],
      tips: [
        t("Все финансовые данные хранятся локально на вашем компьютере с шифрованием.", "All financial records are encrypted and stored strictly on your local machine."),
      ],
      ctaText: t("Понятно, к финансам", "Got it, go to finances"),
    };
  }

  // 17. INBOX / LEADS
  if (key === "inbox" || key === "leads") {
    return {
      id: "inbox",
      title: t("Входящие заявки и обращения", "Incoming Requests & Client Inquiries"),
      badge: t("Воронка обращений", "Inquiry Funnel"),
      lead: t(
        "Центр обработки входящих обращений с сайта, онлайн-записи и виджетов: распределение заявок, первичный контакт и перевод в реестр.",
        "Central hub for incoming requests from website widgets, online booking, and referrals: routing, initial intake, and registry onboarding."
      ),
      overviewCards: [
        {
          icon: "📥",
          title: t("Входящая очередь заявок", "Incoming Request Queue"),
          description: t("Новые обращения клиентов с контактами, темой запроса и предпочтительным временем встречи.", "New incoming client requests with contact details, primary complaint, and preferred times."),
        },
        {
          icon: "🎯",
          title: t("Статусы воронки", "Funnel Status Workflow"),
          description: t("Управление статусами: Новая → На связи → Назначена встреча → В работе → Архив.", "Status progression: New → Contacted → Session Booked → Active Client → Archived."),
        },
        {
          icon: "⚡",
          title: t("Быстрый перевод в клиента", "1-Click Client Onboarding"),
          description: t("В 1 клик создавайте карточку клиента в реестре и назначайте первичную сессию.", "Create a full client profile in registry and schedule the initial session in 1 click."),
        },
        {
          icon: "👥",
          title: t("Распределение по специалистам", "Specialist Assignment"),
          description: t("Для психологических центров: назначение ответственного специалиста под профиль запроса.", "For centers: assign responsible therapist based on specialization and availability."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Просмотр новой заявки", "Step 1. Review Incoming Request"),
          subtitle: t("Изучите контактные данные и тему обращения", "Examine contact information and referral reason"),
          visualKind: "manual_form",
          calloutText: t("Ознакомьтесь с запросом клиента и его предпочтениями по формату (очно / онлайн).", "Review client's complaint description and preferred format (in-person / online)."),
          checklist: [
            t("Проверьте имя и телефон клиента", "Verify client name and phone number"),
            t("Оцените соответствие профилю вашей практики", "Ensure case matches your practice scope"),
          ],
        },
        {
          title: t("Шаг 2. Связь и согласование времени", "Step 2. Contact & Schedule Slot"),
          subtitle: t("Свяжитесь с клиентом и согласуйте время приема", "Reach out to client and agree on session time"),
          visualKind: "voice_mic",
          calloutText: t("Переведите статус заявки в «Назначена встреча» и зафиксируйте время в календаре.", "Update inquiry status to 'Session Booked' and lock time slot in calendar."),
          checklist: [
            t("Согласуйте дату и время первой сессии", "Agree on date and time for initial meeting"),
            t("Отправьте клиенту подтверждение и правила сеттинга", "Send confirmation and setting guidelines"),
          ],
        },
        {
          title: t("Шаг 3. Перевод в реестр клиентов", "Step 3. Onboard to Registry"),
          subtitle: t("Нажмите «Создать карточку клиента»", "Click 'Create Client Card'"),
          visualKind: "docx_export",
          calloutText: t("Заявка автоматически конвертируется в карточку клиента, открывая доступ к журналу сессий.", "The inquiry converts into a client file, unlocking session journaling and history."),
          checklist: [
            t("Нажмите кнопку конвертации", "Click convert button"),
            t("Начните ведение сессий в кабинете", "Begin session tracking in workspace"),
          ],
        },
      ],
      tips: [
        t("Оперативный ответ на заявку в течение первых 15 минут повышает доходимость клиента до первой сессии в 2 раза.", "Prompt response within 15 minutes doubles initial session attendance rates."),
      ],
      ctaText: t("Понятно, к входящим заявкам", "Got it, go to incoming requests"),
    };
  }

  // 18. SPECIALISTS / USERS
  if (key === "specialists" || key === "users") {
    return {
      id: "users",
      title: t("Специалисты и команда службы", "Specialists & Service Team"),
      badge: t("Управление командой", "Team Management"),
      lead: t(
        "Управление составом психологической службы или центра: специалисты, роли, распределение нагрузки и совместное ведение консилиумов.",
        "Managing psychological service staff or center team: therapists, roles, workload distribution, and joint case conferences."
      ),
      overviewCards: [
        {
          icon: "👥",
          title: t("Список специалистов", "Specialists Directory"),
          description: t("Профили коллег с указанием специализации, квалификационной категории и контактных данных.", "Staff profiles with specialization, qualification level, and contact details."),
        },
        {
          icon: "🔐",
          title: t("Роли и права доступа", "Roles & Access Permissions"),
          description: t("Разграничение прав: руководитель, педагог-психолог, социальный педагог, классный руководитель.", "Role-based access: director, psychologist, social educator, homeroom teacher."),
        },
        {
          icon: "📊",
          title: t("Распределение нагрузки", "Workload Distribution"),
          description: t("Мониторинг загрузки специалистов и распределение сложных случаев сопровождения.", "Monitoring staff capacity and balanced assignment of complex support cases."),
        },
        {
          icon: "🤝",
          title: t("Совместные консилиумы", "Team Conferences"),
          description: t("Возможность совместной работы нескольких специалистов над одним сложным случаем.", "Collaborative multidisciplinary case work between multiple team specialists."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Добавление специалиста", "Step 1. Add Specialist"),
          subtitle: t("Нажмите «+ Добавить сотрудника»", "Click '+ Add Staff Member'"),
          visualKind: "manual_form",
          calloutText: t("Укажите ФИО специалиста, должность и его профессиональную специализацию.", "Enter full name, job title, and professional specialization."),
          checklist: [
            t("Введите ФИО и должность", "Enter full name and job title"),
            t("Назначьте соответствующую роль доступа", "Assign appropriate access role"),
          ],
        },
        {
          title: t("Шаг 2. Назначение нагрузки и классов", "Step 2. Assign Workload & Grades"),
          subtitle: t("Закрепите параллели или профильные направления", "Assign grade levels or clinical domains"),
          visualKind: "ai_magic",
          calloutText: t("Распределите классы школы или направления частной практики между сотрудниками службы.", "Distribute school grades or clinical focus areas among service team members."),
          checklist: [
            t("Закрепите зоны ответственности", "Define responsibility zones"),
            t("Проверьте равномерность распределения часов", "Verify balanced hour distribution"),
          ],
        },
        {
          title: t("Шаг 3. Совместная работа в консилиумах", "Step 3. Collaborate in Conferences"),
          subtitle: t("Совместное ведение личных дел и ИПР", "Joint case management and ISP records"),
          visualKind: "docx_export",
          calloutText: t("Специалисты могут вносить свои разделы в общую характеристику и протокол консилиума.", "Team members contribute their respective sections into joint evaluation reports."),
          checklist: [
            t("Обменивайтесь материалами внутри консилиума", "Share materials within case team"),
            t("Формируйте единый сводный отчет службы", "Generate unified service report"),
          ],
        },
      ],
      tips: [
        t("Четкое разделение ролей обеспечивает соблюдение профессиональной тайны и законодательства о защите персональных данных.", "Role separation ensures strict compliance with professional confidentiality and data protection laws."),
      ],
      ctaText: t("Понятно, к списку специалистов", "Got it, go to team directory"),
    };
  }

  // 19. SETTINGS
  if (key === "settings") {
    return {
      id: "settings",
      title: t("Настройки кабинета и безопасность", "Workspace Settings & Security"),
      badge: t("Параметры системы", "System Preferences"),
      lead: t(
        "Управление параметрами рабочего места: локальное шифрование базы (SQLCipher), шапки официальных документов, резервные копии и выбор профиля работы.",
        "Managing workspace preferences: local database encryption (SQLCipher), official document headers, backups, and profile switching."
      ),
      overviewCards: [
        {
          icon: "🔒",
          title: t("Шифрование данных (SQLCipher)", "Data Encryption (SQLCipher)"),
          description: t("Все ваши клиентские записи, протоколы и дневники хранятся в зашифрованной локальной базе на вашем устройстве.", "All client notes, protocols, and journals are stored in an encrypted local database on your device."),
        },
        {
          icon: "🏢",
          title: t("Шапка организации и бланки", "Organization Header & Templates"),
          description: t("Настройка наименования школы, центра или кабинета, автоматически выводящегося на всех печатных протоколах.", "Customize school or practice headers automatically stamped onto all printed documents."),
        },
        {
          icon: "💾",
          title: t("Резервное копирование базы", "Database Backup & Restore"),
          description: t("Создание зашифрованного резервного архива базы данных в 1 клик для переноса на другой компьютер.", "1-click creation of encrypted database backups for safekeeping or machine transfer."),
        },
        {
          icon: "🎨",
          title: t("Интерфейс и языки", "Interface & Localization"),
          description: t("Переключение темы оформления, языков интерфейса и настройка отображения разделов меню.", "Theme switching, language settings, and workspace navigation preferences."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Заполнение профиля организации", "Step 1. Fill Organization Profile"),
          subtitle: t("Укажите наименование школы или центра", "Enter school or center official name"),
          visualKind: "manual_form",
          calloutText: t("Эти данные будут автоматически подставляться в верхний колонтитул всех формируемых документов DOCX.", "These details will automatically populate headers of all exported DOCX documents."),
          checklist: [
            t("Укажите официальное название учреждения", "Enter official organization title"),
            t("Укажите город и контактные данные", "Enter city and contact info"),
          ],
        },
        {
          title: t("Шаг 2. Настройка печатных бланков", "Step 2. Setup Document Signatures"),
          subtitle: t("ФИО и должность для подписи в документах", "Full Name and title for document signature blocks"),
          visualKind: "ai_magic",
          calloutText: t("Укажите ваше имя и должность, чтобы они автоматически выводились в блоке подписи протоколов.", "Set your name and title to automatically appear in protocol signature lines."),
          checklist: [
            t("Введите ФИО специалиста", "Enter specialist full name"),
            t("Укажите квалификацию или должность", "Specify qualification or title"),
          ],
        },
        {
          title: t("Шаг 3. Создание резервной копии", "Step 3. Create Backup Archive"),
          subtitle: t("Регулярно сохраняйте резервную копию", "Regularly export encrypted backup file"),
          visualKind: "docx_export",
          calloutText: t("Нажмите «Создать бэкап», чтобы сохранить зашифрованный файл со всеми вашими записями на флешку или диск.", "Click 'Create Backup' to save an encrypted archive with all your records onto disk."),
          checklist: [
            t("Скачайте файл резервной копии", "Download backup archive file"),
            t("Храните его в безопасном месте", "Store in a secure location"),
          ],
        },
      ],
      tips: [
        t("Рекомендуется создавать резервную копию базы данных в конце каждого учебного периода или месяца.", "We recommend generating a database backup at the end of every term or month."),
      ],
      ctaText: t("Понятно, к настройкам", "Got it, go to settings"),
    };
  }

  // 20. MY PROFILE
  if (key === "my_profile") {
    return {
      id: "my_profile",
      title: t("Профиль специалиста", "Specialist Profile"),
      badge: t("Персональные данные", "Personal Details"),
      lead: t(
        "Персональные и профессиональные данные специалиста: квалификация, образование, специализация и реквизиты для официальных протоколов.",
        "Personal and professional specialist credentials: qualifications, education, clinical scope, and official signature settings."
      ),
      overviewCards: [
        {
          icon: "👤",
          title: t("Визитка специалиста", "Specialist Identity"),
          description: t("ФИО, должность, квалификационная категория и контактные данные для связи.", "Full name, official title, certification rank, and contact info."),
        },
        {
          icon: "🎓",
          title: t("Образование и сертификаты", "Education & Certifications"),
          description: t("Фиксация базового образования, курсов повышения квалификации и направлений переподготовки.", "Documenting primary degree, continuing education courses, and training programs."),
        },
        {
          icon: "✍️",
          title: t("Автоподпись протоколов", "Automatic Protocol Signatures"),
          description: t("Автоматическая подстановка ваших реквизитов во все генерируемые заключения и справки.", "Automatic stamping of your credentials into all generated evaluation sheets and reports."),
        },
        {
          icon: "🔑",
          title: t("Безопасный доступ", "Secure Credentials"),
          description: t("Управление паролями, локальным ключом шифрования и настройками безопасности терминала.", "Managing login credentials, local encryption key, and workspace security options."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Заполнение личных данных", "Step 1. Fill Personal Credentials"),
          subtitle: t("ФИО и должность для документов", "Full Name and official title"),
          visualKind: "manual_form",
          calloutText: t("Проверьте корректность написания ФИО — именно так они будут выводиться в официальных протоколах.", "Verify accurate spelling of your name — exactly as it should appear in official reports."),
          checklist: [
            t("Укажите фамилию, имя и отчество", "Enter full legal name"),
            t("Укажите официальную должность", "Enter official title"),
          ],
        },
        {
          title: t("Шаг 2. Указание специализации", "Step 2. Specify Specialization"),
          subtitle: t("Подходы и методы работы (КПТ, ОРКТ, семейная и др.)", "Approaches and modalities (CBT, SFBT, family, etc.)"),
          visualKind: "ai_magic",
          calloutText: t("Это помогает ИИ-ассистенту адаптировать формулировки и техники под ваши ведущие методы.", "This enables the AI assistant to tailor suggestions to your primary clinical modalities."),
          checklist: [
            t("Отметьте основные методы консультирования", "Select primary counseling modalities"),
            t("Укажите целевую аудиторию практики", "Specify target practice audience"),
          ],
        },
        {
          title: t("Шаг 3. Сохранение профиля", "Step 3. Save Profile"),
          subtitle: t("Данные сохранены локально", "Data saved locally"),
          visualKind: "docx_export",
          calloutText: t("Нажмите «Сохранить» для применения обновлений ко всем модулям платформы.", "Click 'Save' to apply updates across all workspace modules."),
          checklist: [
            t("Нажмите кнопку сохранения", "Click save button"),
            t("Проверьте отображение в шапке экрана", "Check display in workspace top bar"),
          ],
        },
      ],
      tips: [
        t("Корректно заполненный профиль гарантирует юридическую безупречность всех формируемых протоколов.", "Accurately completed profiles ensure legal compliance of all generated evaluation documents."),
      ],
      ctaText: t("Понятно, к профилю", "Got it, go to profile"),
    };
  }

  // 21. FEEDBACK / SUPPORT
  if (key === "feedback" || key === "support") {
    return {
      id: "feedback",
      title: t("Служба заботы и обратная связь", "Care & Support Desk"),
      badge: t("Поддержка пользователей", "User Support"),
      lead: t(
        "Прямая связь с разработчиками и методистами платформы: задавайте вопросы, сообщайте о трудностях и предлагайте новые функции.",
        "Direct link with platform engineers and clinical authors: ask questions, report issues, and propose new features."
      ),
      overviewCards: [
        {
          icon: "💬",
          title: t("Прямое обращение к разработчикам", "Direct Ticket to Developers"),
          description: t("Отправляйте текстовые или голосовые сообщения — команда поддержки отвечает в течение 1 рабочего дня.", "Send text or voice messages — our support team responds within 1 business day."),
        },
        {
          icon: "🎙️",
          title: t("Голосовая отправка отзыва", "Voice Feedback Recording"),
          description: t("Не нужно долго печатать — надиктуйте вопрос или пожелание голосом прямо в форму обращения.", "No typing required — dictate your question or suggestion directly via microphone."),
        },
        {
          icon: "💡",
          title: t("Предложения по улучшению", "Feature Requests & Ideas"),
          description: t("Мы постоянно развиваем систему на основе реального опыта школьных психологов и терапевтов.", "We continuously refine the platform based on real-world feedback from practicing psychologists."),
        },
        {
          icon: "🛠️",
          title: t("Техническая помощь", "Technical Assistance"),
          description: t("Оперативное решение вопросов по установке, обновлению, печати документов и работе с базой данных.", "Swift assistance with installation, updates, document printing, and database maintenance."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Описание вопроса или идеи", "Step 1. Describe Question or Idea"),
          subtitle: t("Напишите текст или надиктуйте голосом", "Type message or dictate via microphone"),
          visualKind: "voice_mic",
          calloutText: t("Опишите, в каком разделе возник вопрос и какую задачу вам необходимо решить.", "Explain what you're trying to accomplish and where any confusion or difficulty arose."),
          checklist: [
            t("Укажите суть вопроса", "State core question"),
            t("При необходимости прикрепите контекст", "Include relevant context"),
          ],
        },
        {
          title: t("Шаг 2. Отправка в службу заботы", "Step 2. Submit to Support Desk"),
          subtitle: t("Нажмите «Отправить обращение»", "Click 'Submit Ticket'"),
          visualKind: "ai_magic",
          calloutText: t("Обращение регистрируется в системе поддержки и передается профильному специалисту.", "Your ticket logs into our support system and routes directly to the responsible team specialist."),
          checklist: [
            t("Нажмите кнопку отправки", "Click submit button"),
            t("Получите подтверждение отправки", "Receive submission confirmation"),
          ],
        },
        {
          title: t("Шаг 3. Ответ и решение задачи", "Step 3. Receive Answer & Resolution"),
          subtitle: t("Ответ поступит в ваш кабинет или на указанный контакт", "Response arrives in your workspace or contact channel"),
          visualKind: "docx_export",
          calloutText: t("Мы поможем настроить кабинет или учтем ваше пожелание в следующем обновлении платформы.", "We will help resolve the issue or incorporate your idea into the next platform release."),
          checklist: [
            t("Ознакомьтесь с ответом поддержки", "Review support answer"),
            t("Оцените качество помощи", "Rate assistance quality"),
          ],
        },
      ],
      tips: [
        t("Вы также можете воспользоваться кнопкой «❓ Непонятно» внизу любого всплывающего окна справки.", "You can also click the '❓ Unclear' button at the bottom of any help modal on any page."),
      ],
      ctaText: t("Понятно, к службе поддержки", "Got it, go to support desk"),
    };
  }

  // 22. EDUCATOR TOOLS (Кабинет педагога)
  if (key === "educator_tools" || key === "educator") {
    return {
      id: "educator_tools",
      title: t("Кабинет педагога: Конструктор и разбор ситуаций", "Educator Workspace: Class Planner & Case Review"),
      badge: t("Помощь классному руководителю", "Homeroom Teacher Toolkit"),
      lead: t(
        "Инструмент классного руководителя для оперативного анализа конфликтных ситуаций в классе, подготовки к родительским собраниям и составления планов бесед.",
        "Homeroom teacher tool for swift classroom conflict analysis, parent meeting preparation, and structured conversation planning."
      ),
      overviewCards: [
        {
          icon: "🛠️",
          title: t("Конструктор классных часов и бесед", "Class Hour & Meeting Planner"),
          description: t("Быстрое составление сценариев бесед по сложным темам (дисциплина, травля, дружба, мотивация).", "Rapid drafting of structured conversation scenarios on discipline, bullying, friendship, and motivation."),
        },
        {
          icon: "🔍",
          title: t("Разбор сложных ситуаций в классе", "Classroom Incident Analysis"),
          description: t("Пошаговый педагогический разбор конфликта с практическими рекомендациями, как вести себя с ребенком и родителями.", "Step-by-step incident review with practical advice on handling students and parents constructively."),
        },
        {
          icon: "🎙️",
          title: t("Родительские собрания", "Parent Meetings"),
          description: t("Подготовка тезисов и протоколов родительских собраний с фокусом на сотрудничество и доверие.", "Drafting parent meeting agendas and protocols focused on constructive partnership."),
        },
        {
          icon: "🤝",
          title: t("Прямая связь со школьным психологом", "Bridge to School Psychologist"),
          description: t("Возможность в 1 клик запросить консультацию психологической службы по тревожному случаю.", "Request psychological service consultation for concerning student cases in 1 click."),
        },
      ],
      steps: [
        {
          title: t("Шаг 1. Выбор задачи (Беседа / Разбор / Собрание)", "Step 1. Select Task (Chat / Case / Meeting)"),
          subtitle: t("Выберите нужный режим работы", "Choose desired workflow mode"),
          visualKind: "manual_form",
          calloutText: t("Выберите, что нужно подготовить: беседу с учеником, ответ на претензию родителя или план классного часа.", "Choose what to prepare: student talk, parent complaint response, or homeroom session plan."),
          checklist: [
            t("Выберите режим", "Select mode"),
            t("Укажите возраст/класс учащихся", "Specify student grade/age"),
          ],
        },
        {
          title: t("Шаг 2. Описание ситуации", "Step 2. Describe Situation"),
          subtitle: t("Надиктуйте или напишите суть проблемы", "Dictate or write core issue"),
          visualKind: "voice_mic",
          calloutText: t("Опишите, что произошло, кто участвует в конфликте и какой результат вы хотите получить.", "Describe what happened, who is involved in the conflict, and your desired outcome."),
          checklist: [
            t("Опишите поведение учеников", "Describe student behaviors"),
            t("Укажите позицию родителей", "Note parents' stance"),
          ],
        },
        {
          title: t("Шаг 3. Получение готового сценария и фраз", "Step 3. Receive Scenario & Talking Points"),
          subtitle: t("Четкие пошаговые фразы и план действий", "Clear step-by-step phrasing and action plan"),
          visualKind: "docx_export",
          calloutText: t("Система предоставит готовые формулировки, которые снижают напряжение и помогают договориться.", "System generates respectful phrasing that de-escalates tension and builds agreement."),
          checklist: [
            t("Изучите предложенные речевые модули", "Review recommended speaking points"),
            t("Используйте в беседе с учеником или родителями", "Apply in conversation with student or parents"),
          ],
        },
      ],
      tips: [
        t("При острых признаках риска дезадаптации немедленно заполните Журнал наблюдений для передачи сигнала психологу.", "For acute risk markers, immediately log an entry in the Observation Journal to alert the psychologist."),
      ],
      ctaText: t("Понятно, к инструментам педагога", "Got it, go to educator tools"),
    };
  }

  // DEFAULT FALLBACK GUIDE FOR ANY OTHER VIEW
  return {
    id: key || "workspace",
    title: isCommercial ? t("Рабочий кабинет частной практики", "Private Practice Workspace") : t("Рабочее место специалиста", "Specialist Workspace"),
    badge: t("Справка по разделу", "Section Guide"),
    lead: t(
      "Данный раздел помогает организовать профессиональную деятельность, вести учет клиентов и формировать официальную отчетность.",
      "This section helps organize professional activities, manage client records, and generate official documentation."
    ),
    overviewCards: [
      {
        icon: "📋",
        title: t("Основные функции раздела", "Core Section Functions"),
        description: t("Все инструменты оптимизированы для быстрой работы без лишней бюрократии и ручного перепечатывания.", "All tools are optimized for rapid workflow without unnecessary paperwork or manual retyping."),
      },
      {
        icon: "🔒",
        title: t("Локальная безопасность данных", "Local Data Security"),
        description: t("Все записи зашифрованы и надежно хранятся на вашем рабочем месте в соответствии со стандартами приватности.", "All records are encrypted and stored securely on your machine per privacy standards."),
      },
      {
        icon: "📄",
        title: t("Готовность к экспорту и печати", "Ready for Export & Printing"),
        description: t("Любые результаты и протоколы можно в один клик выгрузить в удобные форматы DOCX и PDF.", "Any results and protocols can be exported to DOCX and PDF in one click."),
      },
      {
        icon: "❓",
        title: t("Служба помощи и вопросов", "Help & Questions Desk"),
        description: t("Если у вас возникли вопросы по разделу, нажмите кнопку «❓ Непонятно» внизу для отправки отзыва.", "If you have questions about this section, click '❓ Unclear' at the bottom to send feedback."),
      },
    ],
    steps: [
      {
        title: t("Шаг 1. Заполнение основных полей", "Step 1. Fill Required Fields"),
        subtitle: t("Внесите необходимые данные или надиктуйте голосом", "Enter required data or dictate via mic"),
        visualKind: "manual_form",
        calloutText: t("Для большинства форм достаточно заполнить ключевые поля — остальные подставятся автоматически.", "For most forms, filling key fields is sufficient — others auto-fill."),
        checklist: [
          t("Заполните обязательные поля формы", "Complete mandatory form fields"),
          t("Проверьте правильность введенных данных", "Verify entered information"),
        ],
      },
      {
        title: t("Шаг 2. Сохранение и фиксация", "Step 2. Save & Commit"),
        subtitle: t("Нажмите кнопку сохранения", "Click save button"),
        visualKind: "ai_magic",
        calloutText: t("Данные мгновенно сохраняются в защищенной локальной базе данных.", "Data saves immediately to your secure local database."),
        checklist: [
          t("Нажмите «Сохранить»", "Click 'Save'"),
          t("Убедитесь в подтверждении сохранения", "Verify save confirmation"),
        ],
      },
      {
        title: t("Шаг 3. Использование результатов", "Step 3. Utilize Results"),
        subtitle: t("Экспорт в отчет или продолжение работы", "Export to report or continue workflow"),
        visualKind: "docx_export",
        calloutText: t("Все внесенные записи автоматически учитываются в общей статистике и аналитике.", "All entries auto-aggregate into overall analytics and reports."),
        checklist: [
          t("Распечатайте документ при необходимости", "Print document if needed"),
          t("Переходите к следующим задачам", "Proceed to next tasks"),
        ],
      },
    ],
    tips: [
      t("Плавающая кнопка «?» в правом нижнем углу всегда открывает понятную справку по открытой странице.", "The floating '?' button at the bottom-right always opens clear guidance for the active page."),
    ],
    ctaText: t("Понятно, продолжить работу", "Got it, continue work"),
  };
}
