import { t } from "./i18n.ts";

export type VisualStepKind = "manual_form" | "voice_mic" | "ai_magic" | "docx_export" | "companion_bridge";

export interface GuideStep {
  title: string;
  subtitle: string;
  visualKind: VisualStepKind;
  arrowText?: string;
  calloutText: string;
}

export interface ModuleGuideContent {
  id: string;
  title: string;
  badge: string;
  lead: string;
  traditional: {
    title: string;
    durationLabel: string;
    durationMinutes: number;
    description: string;
    steps: string[];
    pros: string;
  };
  aiBoost: {
    title: string;
    durationLabel: string;
    durationMinutes: number;
    savingsPercent: number;
    description: string;
    steps: string[];
    wowEffect: string;
  };
  steps: GuideStep[];
  faqTip?: string;
  ctaText: string;
}

export function getModuleGuide(moduleId: string, isCommercial: boolean): ModuleGuideContent | null {
  if (moduleId === "observation" || moduleId === "observations") {
    return {
      id: "observation",
      title: t("Журнал наблюдений и скрининг риска", "Observation Journal & Risk Screening"),
      badge: t("Связка Педагог ↔ Психолог", "Educator ↔ Psychologist Bridge"),
      lead: t(
        "Оперативный инструмент экспресс-оценки поведенческих и эмоциональных маркеров риска у обучающихся в классе.",
        "Operational tool for rapid screening of behavioral and emotional risk markers among students."
      ),
      traditional: {
        title: t("Бумажные служебные записки и журналы", "Paper Notes & Memorandums"),
        durationLabel: t("~2–3 дня на передачу сигнала", "~2–3 days for signal transmission"),
        durationMinutes: 40,
        description: t(
          "Педагог замечает странности в поведении ученика, пишет бумажную докладную записку завучу или пытается застать школьного психолога в кабинете между уроками.",
          "Educator notices strange behaviors, drafts a paper memo, or tries to catch the psychologist between classes."
        ),
        steps: [
          t("Ручное составление докладных и служебных записок", "Manual drafting of memos and notes"),
          t("Субъективные разрозненные описания без единой шкалы", "Subjective scattered descriptions without unified criteria"),
          t("Потеря времени: сигнал доходит до психолога с задержкой в дни или недели", "Lost time: signal reaches psychologist with days/weeks delay"),
        ],
        pros: t("Привычный бумажный документооборот.", "Familiar paper-based workflow."),
      },
      aiBoost: {
        title: t("Экспресс-скрининг и мгновенный сигнал", "Express Screening & Instant Signal"),
        durationLabel: t("~1 минута на класс", "~1 minute for whole class"),
        durationMinutes: 1,
        savingsPercent: 95,
        description: t(
          "В 1 клик по ячейкам таблицы вы отмечаете выраженность маркеров (0/1/2), система автоматически суммирует баллы риска, а сигнал [SOS] мгновенно поступает на панель школьного психолога.",
          "In 1 click per cell, mark marker severity (0/1/2), system calculates total risk sum, and [SOS] alert immediately lands in the psychologist workspace."
        ),
        steps: [
          t("📋 6 стандартизированных критериев ФГОС: агрессия, изоляция, оппозиция, эмоции, учеба, внешние маркеры", "📋 6 standard criteria: aggression, isolation, opposition, emotions, academics, physical signs"),
          t("🔢 Автоматическая сумма баллов по каждому ученику для мгновенной оценки степени риска", "🔢 Auto-calculated score sum per student for instant risk tier assessment"),
          t("🚨 Чекбокс «Нужна помощь» + комментарий передают фокус внимания психологу без бумажной волокиты", "🚨 'Needs Help' + comment forwards the case to psychologist instantly without paperwork"),
        ],
        wowEffect: t(
          "Школьный психолог сразу видит объективную картину по классу и подключается на ранней стадии до перехода проблемы в кризис.",
          "School psychologist immediately sees objective classroom dynamics and intervenes before crisis escalates."
        ),
      },
      steps: [
        {
          title: t("Шаг 1. Формирование списка класса", "Step 1. Student Roster"),
          subtitle: t("Автоматически из реестра или по PIN-коду", "From registry or via class PIN"),
          visualKind: "manual_form",
          arrowText: t("Список готов", "Roster ready"),
          calloutText: t(
            "Дети попадают сюда из общего реестра школы (загруженного психологом через Excel) или добавляются вами вручную по кнопке «+ Добавить в список».",
            "Students are loaded from the school registry (imported by psychologist via Excel) or added manually."
          ),
        },
        {
          title: t("Шаг 2. Оценка показателей (0, 1, 2)", "Step 2. Rating Indicators"),
          subtitle: t("Клик по ячейке: Норма → Слабо (1) → Остро (2)", "Click cell: Normal → Moderate (1) → High (2)"),
          visualKind: "ai_magic",
          arrowText: t("Клик по ячейке", "Click cell"),
          calloutText: t(
            "6 параметров риска сформированы на базе стандартов профилактики дезадаптации подростков: Агрессия, Социальная изоляция, Бунт/саботаж, Эмоциональная нестабильность, Спад учебы и Внешние маркеры.",
            "6 risk indicators are based on adolescent maladaptation screening standards: Aggression, Isolation, Opposition, Emotional instability, Academic drop, and Physical markers."
          ),
        },
        {
          title: t("Шаг 3. Сумма баллов и отправка психологу", "Step 3. Total Score & Send"),
          subtitle: t("Колонка суммы + кнопка «Отправить психологу»", "Total score column + 'Submit' button"),
          visualKind: "docx_export",
          arrowText: t("1 клик отправки", "1-click submit"),
          calloutText: t(
            "Колонка «Сумма баллов» автоматически подсчитывает итоговый уровень риска. Отметьте галочку «Нужна помощь» и напишите комментарий при необходимости экстренного вмешательства.",
            "'Total score' automatically sums points. Check 'Needs Help' and add a comment if immediate psychologist intervention is required."
          ),
        },
      ],
      faqTip: t(
        "💡 Все данные передаются внутри закрытого защищенного контура школы без передачи в публичные сети.",
        "💡 All observations remain in the secure school local perimeter with full privacy protection."
      ),
      ctaText: t("Понятно, перейти к журналу", "Got it, go to journal"),
    };
  }

  if (moduleId === "cases") {
    return isCommercial
      ? {
          id: "cases",
          title: t("Кейсы и клиентские дела", "Cases and Client Files"),
          badge: t("Частная практика IDA", "IDA Private Practice"),
          lead: t(
            "Единая зашифрованная карточка клиента: от первичного запроса до истории терапевтической динамики и домашних заданий.",
            "Unified encrypted client card: from initial request to therapy dynamics history and home exercises."
          ),
          traditional: {
            title: t("Привычный способ (ручной ввод)", "Traditional Way (Manual Input)"),
            durationLabel: t("~15-20 минут на случай", "~15-20 minutes per case"),
            durationMinutes: 20,
            description: t(
              "Вы можете вести записи привычным способом: вручную вбивать жалобы, формулировать контракт, копировать формулировки и сохранять в локальную базу данных.",
              "You can keep records the usual way: manually typing complaints, formulating contract, copying phrases and saving to local database."
            ),
            steps: [
              t("Ввод данных клиента и контактной информации", "Entering client data and contact info"),
              t("Ручной выбор направления (КПТ, ОРКТ, Гештальт) из списков", "Manual selection of approach (CBT, SFBT, Gestalt) from dropdowns"),
              t("Набор текста анамнеза и терапевтических целей на клавиатуре", "Typing anamnesis and therapeutic goals on keyboard"),
              t("Ручное составление плана сессий и экспорта в файл", "Manual plan preparation and export to file"),
            ],
            pros: t("100% привычный контроль, данные хранятся в защищенной базе на вашем компьютере.", "100% familiar control, data stored in secure database on your machine."),
          },
          aiBoost: {
            title: t("Ускорение с ИИ (через диктовку)", "AI Acceleration (Voice Dictation)"),
            durationLabel: t("~30 секунд", "~30 seconds"),
            durationMinutes: 0.5,
            savingsPercent: 85,
            description: t(
              "Нажмите значок микрофона и надиктуйте своими словами свободным языком суть проблемы клиента. ИИ сам выделит феноменологию, сформирует гипотезы и подберет техники вмешательства.",
              "Click the microphone icon and dictate in free conversational language. AI will extract phenomenology, hypothesize, and suggest intervention techniques."
            ),
            steps: [
              t("🎙️ Нажали микрофон и сказали 2–3 предложения своими словами", "🎙️ Clicked mic and spoke 2-3 sentences in your own words"),
              t("🪄 ИИ сам выделил маркеры запроса, эмоциональное состояние и цели", "🪄 AI automatically extracted request markers, emotional state, and goals"),
              t("⚡ Готовый структурированный протокол сформирован за 3 секунды", "⚡ Ready structured protocol formed in 3 seconds"),
            ],
            wowEffect: t(
              "Вы экономите до 40 минут между сессиями: больше не нужно сидеть над бумагами вечером после сложного приема.",
              "You save up to 40 minutes between sessions: no more paperwork late in the evening after client sessions."
            ),
          },
          steps: [
            {
              title: t("Шаг 1. Создание карточки", "Step 1. Create card"),
              subtitle: t("Нажмите «+ Новый кейс» в правом углу", "Click '+ New Case' in the top right"),
              visualKind: "manual_form",
              arrowText: t("Кликните сюда", "Click here"),
              calloutText: t("Достаточно имени или псевдонима — данные шифруются локально.", "Name or pseudonym is enough — data is encrypted locally."),
            },
            {
              title: t("Шаг 2. Надиктовка сути голосом", "Step 2. Voice dictation"),
              subtitle: t("Нажмите на микрофон рядом с полем заметок", "Click the microphone near notes field"),
              visualKind: "voice_mic",
              arrowText: t("Говорите как на супервизии", "Speak naturally"),
              calloutText: t("Не нужно думать о канцеляризмах: надиктуйте всё простыми словами.", "No need for formal jargon: speak in plain language."),
            },
            {
              title: t("Шаг 3. ИИ-структурирование", "Step 3. AI Structuring"),
              subtitle: t("ИИ формирует протокол и рекомендации", "AI structures protocol and recommendations"),
              visualKind: "ai_magic",
              arrowText: t("Мгновенно готово", "Instantly ready"),
              calloutText: t("Система подбирает валидные методики, протокол сессии и домашнее задание.", "System selects valid techniques, session protocol, and homework."),
            },
          ],
          faqTip: t(
            "💡 Персональные данные не передаются в открытые сети. Анализ происходит с шифрованием и псевдонимизацией.",
            "💡 Personal data is never leaked. Analysis is done with local encryption and pseudonymization."
          ),
          ctaText: t("Создать первый кейс", "Create First Case"),
        }
      : {
          id: "cases",
          title: t("Кейсы и личные дела учащихся", "Cases and Student Files"),
          badge: t("Школьная служба профилактики", "School Prevention Service"),
          lead: t(
            "Официальное психолого-педагогическое сопровождение учащихся, трудных подростков и семейных ситуаций по стандартам ФГОС.",
            "Official psychological and educational support for students, adolescents, and families according to standards."
          ),
          traditional: {
            title: t("Привычный способ (ручной ввод)", "Traditional Way (Manual Input)"),
            durationLabel: t("~25 минут на протокол", "~25 minutes per protocol"),
            durationMinutes: 25,
            description: t(
              "Как в привычных школьных журналах: заполнение класса, ФИО, статуса учета (ВШУ/КДН), ручной выбор таксономий риска и печатание характеристики.",
              "As in traditional school logs: entering class, student name, registry status, manual taxonomy selection, and typing characteristics."
            ),
            steps: [
              t("Ручной поиск кодов дезадаптации и уровней профилактики", "Manual lookup of maladaptation codes and tiers"),
              t("Печать длинного текста протокола профилактической беседы", "Typing lengthy preventive conversation protocol"),
              t("Ручное согласование с соцпедагогом и классным руководителем", "Manual alignment with social educator and teacher"),
              t("Оформление документов для комиссий и педсоветов", "Formatting documents for committees and meetings"),
            ],
            pros: t("Привычная бюрократическая надежность, полное соответствие школьным регламентам.", "Familiar bureaucratic reliability, full compliance with school regulations."),
          },
          aiBoost: {
            title: t("Ускорение с ИИ (через диктовку)", "AI Acceleration (Voice Dictation)"),
            durationLabel: t("~45 секунд", "~45 seconds"),
            durationMinutes: 0.75,
            savingsPercent: 90,
            description: t(
              "Скажите в микрофон: «Иванов 8Б, сорвал урок литературы, конфликт с одноклассником, мать на контакт не идет». ИИ мгновенно определит уровень риска, подберет техники ФГОС и составит официальный протокол.",
              "Speak into the mic: 'Ivanov 8B, disrupted class, conflict with peer, parent unresponsive'. AI instantly classifies risk, chooses techniques, and formats an official protocol."
            ),
            steps: [
              t("🎙️ 30 секунд быстрой голосовой заметки своими словами", "🎙️ 30 seconds of quick voice note in simple words"),
              t("🪄 ИИ сам выставил уровни дезадаптации (ТЦМ) и рекомендованные меры", "🪄 AI marked maladaptation tiers (TCM) and recommended measures"),
              t("📄 Готовый протокол для печати в DOCX или сохранения в годовой отчет", "📄 Ready protocol for DOCX printing or annual report inclusion"),
            ],
            wowEffect: t(
              "Вы избавляетесь от рутины заполнения папок: ИИ берет на себя канцелярские формулировки, освобождая время для живой работы с детьми.",
              "You eliminate paperwork routine: AI handles bureaucratic wording, freeing up time for real work with children."
            ),
          },
          steps: [
            {
              title: t("Шаг 1. Открытие дела", "Step 1. Open Case"),
              subtitle: t("Нажмите «+ Новый кейс» в списке", "Click '+ New Case' in the list"),
              visualKind: "manual_form",
              arrowText: t("Старт здесь", "Start here"),
              calloutText: t("Выберите направление: поддержка ученика, буллинг, семья-школа или профилактика.", "Select direction: student support, bullying, family-school, or prevention."),
            },
            {
              title: t("Шаг 2. Голосовая фиксация", "Step 2. Voice Note"),
              subtitle: t("Нажмите микрофон и опишите инцидент", "Click mic and describe incident"),
              visualKind: "voice_mic",
              arrowText: t("Без канцелярита", "No formal jargon"),
              calloutText: t("Говорите как есть. ИИ профессионально сформулирует педагогический протокол.", "Speak as is. AI will professionally format the educational protocol."),
            },
            {
              title: t("Шаг 3. Готовый протокол и DOCX", "Step 3. Ready Protocol & DOCX"),
              subtitle: t("ИИ выдаст план беседы и рекомендации", "AI provides conversation plan and advice"),
              visualKind: "docx_export",
              arrowText: t("Печать в 1 клик", "1-click print"),
              calloutText: t("Документ готов для школьного архива или распечатки родителям/педсовету.", "Ready for school archive or printout for parents/teachers."),
            },
          ],
          faqTip: t(
            "💡 Персональные данные учеников хранятся в защищенном виде на школьном компьютере (SQLCipher).",
            "💡 Students' personal data is stored securely on the local school computer (SQLCipher)."
          ),
          ctaText: t("Открыть первый кейс", "Open First Case"),
        };
  }

  if (moduleId === "consultations") {
    return isCommercial
      ? {
          id: "consultations",
          title: t("Журнал консультаций и сессий", "Consultations and Sessions Log"),
          badge: t("Прием клиентов", "Client Intake"),
          lead: t(
            "Быстрая фиксация терапевтических сессий, аудио-заметки, динамика запроса и согласование домашних заданий.",
            "Fast recording of therapy sessions, audio notes, request dynamics, and homework alignment."
          ),
          traditional: {
            title: t("Ручной протокол сессии", "Manual Session Protocol"),
            durationLabel: t("~15 минут на прием", "~15 minutes per session"),
            durationMinutes: 15,
            description: t(
              "Печатание конспекта сессии после каждого клиента, структурирование выводов и ведение бумажного/Excel журнала.",
              "Typing session notes after each client, structuring conclusions, and maintaining a paper/Excel journal."
            ),
            steps: [
              t("Выбор клиента из списка или заведение новой карточки", "Selecting client from list or creating card"),
              t("Заполнение даты, длительности и оплаты", "Filling date, duration, and fee"),
              t("Ручной ввод содержания беседы и инсайтов клиента", "Manual entry of conversation content and client insights"),
              t("Составление рекомендаций на следующую встречу", "Writing recommendations for next session"),
            ],
            pros: t("Полная фиксация всех деталей своими руками.", "Complete record of all details by your own hands."),
          },
          aiBoost: {
            title: t("Диктовка после сессии с ИИ", "AI Dictation After Session"),
            durationLabel: t("~40 секунд", "~40 seconds"),
            durationMinutes: 0.65,
            savingsPercent: 90,
            description: t(
              "Сразу после ухода клиента нажимаете кнопку микрофона и за 30 секунд проговариваете главные тезисы. ИИ мгновенно формирует клиническую заметку и домашнее задание.",
              "Right after client leaves, click mic and speak main points in 30 seconds. AI immediately formats clinical note and homework."
            ),
            steps: [
              t("🎙️ 30-секундный голосовой комментарий в свободной форме", "🎙️ 30-second free-form voice commentary"),
              t("🪄 Автоматическое выделение динамики, сопротивления и гипотез", "🪄 Automatic extraction of dynamics, resistance, and hypotheses"),
              t("📋 Чистая заметка готова к следующей сессии", "📋 Clean note ready for next session"),
            ],
            wowEffect: t(
              "Вы не накапливаете усталость от заполнения отчетов к концу рабочего дня.",
              "You don't accumulate paperwork fatigue by the end of your working day."
            ),
          },
          steps: [
            {
              title: t("Шаг 1. Выберите клиента", "Step 1. Select Client"),
              subtitle: t("Кликните на карточку или введите быстрый псевдоним", "Click card or enter quick pseudonym"),
              visualKind: "manual_form",
              calloutText: t("Можно работать полностью под псевдонимами для конфиденциальности.", "You can work fully under pseudonyms for confidentiality."),
            },
            {
              title: t("Шаг 2. Надиктуйте итоги", "Step 2. Dictate Summary"),
              subtitle: t("Нажмите на микрофон в журнале визита", "Click mic in visit journal"),
              visualKind: "voice_mic",
              arrowText: t("Быстро после сессии", "Quickly after session"),
              calloutText: t("«Клиент осознал триггер тревоги на работе, договорились вести дневник мыслей».", "'Client recognized anxiety trigger at work, agreed to keep thought journal'."),
            },
            {
              title: t("Шаг 3. Сохранение в защищенный архив", "Step 3. Save to Secure Vault"),
              subtitle: t("Протокол надежно сохранен и доступен в истории", "Protocol safely stored and accessible in history"),
              visualKind: "docx_export",
              calloutText: t("Перед следующей сессией вы за 10 секунд освежите всю картину в памяти.", "Refresh the whole picture in 10 seconds before next session."),
            },
          ],
          ctaText: t("Начать первую консультацию", "Start First Consultation"),
        }
      : {
          id: "consultations",
          title: t("Журнал консультаций специалиста", "Specialist Consultation Log"),
          badge: t("Школьный журнал приемов", "School Intake Journal"),
          lead: t(
            "Официальный журнал индивидуальных и групповых консультаций с учащимися, родителями и педагогами.",
            "Official journal of individual and group consultations with students, parents, and educators."
          ),
          traditional: {
            title: t("Традиционный бумажный/электронный журнал", "Traditional Log"),
            durationLabel: t("~15 минут на протокол", "~15 minutes per protocol"),
            durationMinutes: 15,
            description: t(
              "Ручное заполнение всех граф журнала консультаций: дата, время, категория посетителя, запрос, тема, рекомендации.",
              "Manual entry of all log columns: date, time, visitor category, request, theme, recommendations."
            ),
            steps: [
              t("Выбор категории (ученик, родитель, учитель)", "Selecting category (student, parent, teacher)"),
              t("Ручная классификация по темам трудностей", "Manual classification by difficulty themes"),
              t("Печать текста рекомендаций родителям или педагогу", "Typing recommendations for parents or teacher"),
              t("Перенос данных в журнал рабочего времени", "Transferring data to work-time register"),
            ],
            pros: t("Привычный формат журнала учета консультационной работы.", "Familiar record format for counseling work."),
          },
          aiBoost: {
            title: t("ИИ-помощник консультации", "AI Consultation Assistant"),
            durationLabel: t("~30 секунд", "~30 seconds"),
            durationMinutes: 0.5,
            savingsPercent: 88,
            description: t(
              "Надиктуйте кратко суть визита: «Мать ученика 7А, жалоба на снижение успеваемости после развода родителей». ИИ сам подберет коды таксономии и сформирует корректный педагогический протокол.",
              "Briefly dictate visit essence: 'Mother of 7A student, complaint about declining grades after divorce'. AI categorizes codes and generates proper protocol."
            ),
            steps: [
              t("🎙️ Диктовка голосом прямо во время или после беседы", "🎙️ Voice dictation right during or after talk"),
              t("🪄 Авто-разметка по таксономии школьных проблем", "🪄 Auto-tagging by school problem taxonomy"),
              t("📈 Автоматическое попадание в годовой отчет и нагрузку", "📈 Automatic inclusion in annual report and workload"),
            ],
            wowEffect: t(
              "Каждая записанная консультация сама пополняет ваш годовой отчет — в конце года не нужно ничего сводить вручную!",
              "Every recorded consultation auto-fills your annual report — no manual compilation at year end!"
            ),
          },
          steps: [
            {
              title: t("Шаг 1. Быстрый выбор", "Step 1. Quick Select"),
              subtitle: t("Выберите ученика или введите имя родителя", "Select student or parent name"),
              visualKind: "manual_form",
              calloutText: isCommercial
                ? t("Можно выбрать уже заведенного клиента из картотеки.", "You can pick an existing client from your records.")
                : t("Можно выбрать уже заведенного обучающегося из школьного реестра.", "You can pick an existing student from the school registry."),
            },
            {
              title: t("Шаг 2. Голосовая диктовка", "Step 2. Voice Dictation"),
              subtitle: t("Нажмите микрофон и надиктуйте суть проблемы", "Click mic and dictate core issue"),
              visualKind: "voice_mic",
              arrowText: t("30 секунд речи", "30 seconds speech"),
              calloutText: t("ИИ сразу предложит рекомендации для классного руководителя и родителей.", "AI immediately suggests recommendations for teacher and parents."),
            },
            {
              title: t("Шаг 3. Сохранение в отчет", "Step 3. Save to Report"),
              subtitle: t("Запись автоматически учитывается в часах нагрузки", "Entry auto-recorded in workload hours"),
              visualKind: "docx_export",
              calloutText: t("Всё готово для формирования аналитической справки в 1 клик.", "All ready for 1-click analytical report generation."),
            },
          ],
          ctaText: t("Записать консультацию", "Record Consultation"),
        };
  }

  if (moduleId === "registry") {
    return {
      id: "registry",
      title: isCommercial ? t("Реестр клиентов и договоров", "Clients and Contracts Registry") : t("Школьный реестр учащихся", "School Student Registry"),
      badge: t("База учета", "Registry Base"),
      lead: isCommercial
        ? t("Безопасная локальная картотека ваших клиентов с шифрованием и историей сопровождения.", "Secure local card index of your clients with encryption and support history.")
        : t("База контингента школы: классы, категории сопровождения (ВШУ, ОВЗ, группы риска) и учет согласий.", "School student database: grades, support categories, and parental consent tracking."),
      traditional: {
        title: t("Ручное ведение списков", "Manual List Keeping"),
        durationLabel: t("~10 минут на человека", "~10 minutes per person"),
        durationMinutes: 10,
        description: t(
          "Заполнение множества полей: контакты, дата рождения, статус согласия родителей, особенности развития.",
          "Filling numerous fields: contacts, birth date, consent status, development specifics."
        ),
        steps: [
          t("Построчный ручной ввод персональных данных", "Row-by-row manual data entry"),
          t("Проверка наличия бумажных согласий", "Checking paper consent presence"),
          t("Ручная сортировка по параллелям и классам", "Manual sorting by grades and classes"),
        ],
        pros: t("Знакомый вид электронной картотеки.", "Familiar electronic card index format."),
      },
      aiBoost: {
        title: t("Умный импорт и экспресс-карточки", "Smart Import & Express Cards"),
        durationLabel: t("~15 секунд", "~15 seconds"),
        durationMinutes: 0.25,
        savingsPercent: 95,
        description: t(
          "Не нужно вбивать всех руками! Достаточно ввести только имя или загрузить список класса из Excel в 1 клик. Остальные данные можно дополнять по мере консультаций через голос.",
          "No need to type everyone manually! Just enter a name or upload a class list from Excel in 1 click. Other data can be voice-supplemented later."
        ),
        steps: [
          t("📥 Быстрый импорт списка классов из Excel/CSV", "📥 Quick class list import from Excel/CSV"),
          t("🪄 Экспресс-создание по одной строке ФИО", "🪄 1-line express creation by Full Name"),
          t("🔒 Автоматическое сквозное шифрование базы", "🔒 Automatic end-to-end database encryption"),
        ],
        wowEffect: t(
          "Вы можете импортировать всю параллель школы или базу центра за 30 секунд.",
          "You can import an entire grade or center database in 30 seconds."
        ),
      },
      steps: [
        {
          title: t("Шаг 1. Добавление записи", "Step 1. Add Record"),
          subtitle: t("Нажмите «+ Добавить» или воспользуйтесь импортом", "Click '+ Add' or use Excel import"),
          visualKind: "manual_form",
          calloutText: t("Для начала достаточно только имени и класса / возраста.", "Name and grade / age is enough for a start."),
        },
        {
          title: t("Шаг 2. Связь с консультациями", "Step 2. Link to Consultations"),
          subtitle: t("Из карточки можно сразу открыть консультацию или кейс", "Open consultation or case directly from card"),
          visualKind: "ai_magic",
          calloutText: t("Вся история встреч привязывается к человеку автоматически.", "Complete history of sessions is linked automatically."),
        },
        {
          title: t("Шаг 3. Безопасность данных", "Step 3. Data Security"),
          subtitle: t("Все данные зашифрованы локально", "All data encrypted locally"),
          visualKind: "docx_export",
          calloutText: t("Данные не покидают ваше рабочее место без вашего согласия.", "Data never leaves your machine without consent."),
        },
      ],
      ctaText: isCommercial ? t("Перейти к клиентам", "Go to Clients") : t("Добавить обучающегося", "Add Student"),
    };
  }

  if (moduleId === "dashboard") {
    return {
      id: "dashboard",
      title: isCommercial ? t("Дашборд частной практики", "Private Practice Dashboard") : t("Дашборд специалиста службы сопровождения", "Specialist Dashboard"),
      badge: t("Командный центр", "Command Center"),
      lead: t(
        "Сводка всех ключевых показателей: количество встреч, динамика нагрузки, маркеры риска и готовая отчетность.",
        "Summary of all key metrics: session count, workload dynamics, risk markers, and ready reports."
      ),
      traditional: {
        title: t("Ручной сбор статистики в конце периода", "Manual Stats Compilation"),
        durationLabel: t("~2-3 дня в конце года", "~2-3 days at year end"),
        durationMinutes: 180,
        description: t(
          "В конце полугодия или года специалисту обычно приходится перелистывать все бумажные журналы, вручную считать часы, категории и темы консультаций.",
          "At the end of semester or year, specialist typically has to flip through all paper journals, manually calculating hours and topics."
        ),
        steps: [
          t("Сведение чисел по визитам и консультациям в черновики", "Aggregating session numbers into drafts"),
          t("Ручной подсчет охвата по категориям учащихся/клиентов", "Manual calculation of coverage by categories"),
          t("Составление сводных таблиц в Word или Excel", "Drafting summary tables in Word or Excel"),
        ],
        pros: t("Привычный процесс отчетности, знакомый каждому специалисту.", "Familiar reporting process known to every specialist."),
      },
      aiBoost: {
        title: t("Автоматический дашборд в реальном времени", "Real-Time Automatic Dashboard"),
        durationLabel: t("0 секунд (всё готово всегда)", "0 seconds (always ready)"),
        durationMinutes: 0.05,
        savingsPercent: 99,
        description: t(
          "Пока вы ведете обычную работу и надиктовываете заметки с ИИ, дашборд обновляется сам! В любой момент вы видите актуальные цифры, а годовой отчет генерируется нажатием одной кнопки.",
          "While you do routine work and dictate notes with AI, the dashboard updates itself! Real-time metrics and 1-click annual report."
        ),
        steps: [
          t("📊 Автоматический подсчет всех сессий и консультаций", "📊 Automatic calculation of all sessions and consultations"),
          t("🎯 Мгновенная визуализация уровней риска и направлений", "🎯 Instant visualization of risk tiers and directions"),
          t("📄 Готовая справка для руководства или Управления образования в 1 клик", "📄 1-click summary for management or education department"),
        ],
        wowEffect: t(
          "Вы навсегда забываете о кошмаре подготовки годового отчета — система формирует его сама из ежедневных записей.",
          "You forget about annual report nightmares forever — the system compiles it automatically from daily notes."
        ),
      },
      steps: [
        {
          title: isCommercial ? t("Шаг 1. Заведите первого клиента", "Step 1. Add First Client") : t("Шаг 1. Заведите первого обучающегося", "Step 1. Add First Student"),
          subtitle: isCommercial ? t("В картотеке или через быстрый кейс", "In client base or via quick case") : t("В реестре или через быстрый кейс", "In registry or via quick case"),
          visualKind: "manual_form",
          arrowText: t("1-й шаг", "Step 1"),
          calloutText: t("Создайте карточку ученика или клиента — это займет 1 минуту.", "Create student/client card in 1 minute."),
        },
        {
          title: t("Шаг 2. Надиктуйте первую консультацию", "Step 2. Dictate First Session"),
          subtitle: t("Попробуйте кнопку микрофона 🎙️", "Try the microphone button 🎙️"),
          visualKind: "voice_mic",
          arrowText: t("2-й шаг", "Step 2"),
          calloutText: t("Надиктуйте 2 предложения, и ИИ сформирует первый протокол.", "Dictate 2 sentences, and AI prepares the first protocol."),
        },
        {
          title: t("Шаг 3. Смотрите, как оживает статистика", "Step 3. Watch Stats Come Alive"),
          subtitle: t("Все графики и счетчики заполнятся автоматически", "All charts and counters will auto-populate"),
          visualKind: "ai_magic",
          arrowText: t("3-й шаг", "Step 3"),
          calloutText: t("Дашборд сразу покажет вашу нагрузку и охват.", "Dashboard immediately reflects your workload and coverage."),
        },
      ],
      ctaText: isCommercial ? t("Начать работу с клиентами", "Start with Clients") : t("Начать работу со школой", "Start with School"),
    };
  }

  if (moduleId === "ida_clients") {
    return {
      id: "ida_clients",
      title: t("Клиенты и приложение-компаньон IDA", "Clients & IDA Companion App"),
      badge: t("Связка Специалист ↔ Клиент", "Specialist ↔ Client Bridge"),
      lead: t(
        "Инновационная связка: вы отправляете клиенту ссылку-приглашение в мобильное веб-приложение / Telegram-компаньон, а терминал автоматически собирает дневники самонаблюдения и динамику настроения.",
        "Innovative link: send client an invite to mobile web / Telegram companion, and terminal gathers self-observation diaries and mood dynamics."
      ),
      traditional: {
        title: t("Бумажные домашние задания", "Paper Homework"),
        durationLabel: t("~30 минут на разбор бумажек", "~30 minutes reading notes"),
        durationMinutes: 30,
        description: t(
          "Клиент забывает блокнот с записями дома, теряет дневник мыслей, или тратит первые 20 минут сессии на воспоминания «что со мной происходило во вторник».",
          "Client forgets notepad at home, loses thought diary, or spends first 20 minutes recalling what happened during the week."
        ),
        steps: [
          t("Выдача бумажных бланков КПТ/ОРКТ", "Handing out paper CBT/SFBT forms"),
          t("Ожидание заполнения клиентом вручную", "Waiting for manual client filling"),
          t("Трата дорогого времени сессии на опрос о прошедшей неделе", "Spending costly session time reviewing the past week"),
        ],
        pros: t("Привычный классический подход.", "Familiar classic approach."),
      },
      aiBoost: {
        title: t("Умный компаньон с ИИ-выжимкой", "Smart Companion with AI Brief"),
        durationLabel: t("~1 минута перед сессией", "~1 minute before session"),
        durationMinutes: 1,
        savingsPercent: 95,
        description: t(
          "Клиент в течение недели в 1 клик нажимает кнопки настроения и пишет заметки в своем телефоне. Перед сессией ИИ формирует для вас краткую аналитическую выжимку: ключевые триггеры, пики тревоги и прогресс.",
          "Client taps mood buttons and notes in phone during the week. Before session, AI delivers a concise analytical brief for you."
        ),
        steps: [
          t("🔗 Отправили клиенту персональную ссылку на приложение-компаньон", "🔗 Sent client personal link to companion app"),
          t("📱 Клиент ведет дневник на смартфоне (PWA или Telegram)", "📱 Client keeps diary on phone (PWA or Telegram)"),
          t("🤖 ИИ готовит для вас готовую сводку к началу консультации", "🤖 AI prepares ready summary before your session"),
        ],
        wowEffect: t(
          "Вы начинаете сессию, уже точно зная, что происходило с клиентом всю неделю. Эффективность терапии возрастает в разы.",
          "You start session knowing exactly what client went through all week. Therapy efficacy jumps dramatically."
        ),
      },
      steps: [
        {
          title: t("Шаг 1. Скопируйте ссылку", "Step 1. Copy Link"),
          subtitle: t("Нажмите «Создать приглашение для клиента»", "Click 'Generate Client Invite'"),
          visualKind: "companion_bridge",
          arrowText: t("Ссылка в 1 клик", "1-click link"),
          calloutText: t("Отправьте ссылку клиенту в любой удобный мессенджер.", "Send the link to client via any messenger."),
        },
        {
          title: t("Шаг 2. Клиент открывает компаньон", "Step 2. Client Opens Companion"),
          subtitle: t("Без сложных паролей и установок", "No complex passwords or installations"),
          visualKind: "manual_form",
          calloutText: t("Клиент отмечает настроение и пишет заметки в защищенном диалоге.", "Client marks mood and notes in protected dialogue."),
        },
        {
          title: t("Шаг 3. ИИ-сводка в терминале", "Step 3. AI Summary in Terminal"),
          subtitle: t("Вы видите динамику прямо на этой панели", "You see dynamics directly on this panel"),
          visualKind: "ai_magic",
          arrowText: t("Готово к сессии", "Ready for session"),
          calloutText: t("ИИ выделит главное, сохранив ваше время на анализ.", "AI extracts key highlights, saving your prep time."),
        },
      ],
      ctaText: t("Создать приглашение клиенту", "Create Client Invite"),
    };
  }

  return null;
}
