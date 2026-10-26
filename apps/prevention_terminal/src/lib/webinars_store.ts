/**
 * Webinars and Live Events Storage & State Management
 * Handles scheduled webinars, cloud recordings in S3, attached materials, and AI summaries.
 */

import { isDemoModeActive } from "./staging_demo_seed.ts";
import { getTerminalProductId } from "./terminal_product.ts";
import { getTerminalEdition } from "./terminal_edition.ts";

export interface AttachedMaterial {
  id: string;
  title: string;
  type: "presentation" | "handout" | "protocol" | "document";
  fileName: string;
  fileSizeMb: number;
  url?: string;
  kbProtocolTag?: string; // If linked to IDA KB protocol
  uploadedAt: string;
}

export interface VideoCutInterval {
  id: string;
  startSeconds: number;
  endSeconds: number;
  label?: string; // e.g. "Кофе-брейк 15 мин"
}

export interface VideoTrimSettings {
  trimStartSeconds: number; // отсечь начало (секунды)
  trimEndSeconds?: number;   // отсечь конец (секунды)
  cutIntervals: VideoCutInterval[]; // вырезанные паузы/перерывы внутри
  cleanDurationMinutes?: number; // итоговый чистый хронометраж
}

export interface RecordingMonetization {
  isPaid: boolean;
  priceRub?: number;
  paymentUrl?: string; // Прямая ссылка на кассу спикера (ЮKassa / Prodamus / Тинькофф / Точка)
  accessDays?: number; // 0 = бессрочно, 30, 90 дней
  salesCount?: number;
  watermarkEnabled?: boolean; // Плавающий email покупателя для защиты от пиратства
  singleSessionEnforced?: boolean; // 1 активный зритель на билет
  customOfferTitle?: string;
}

export interface CloudRecording {
  id: string;
  webinarId: string;
  webinarTitle: string;
  recordedAt: string;
  durationMinutes: number;
  fileSizeMb: number;
  s3Key: string;
  videoUrl: string;
  status: "ready" | "processing" | "expired";
  expiresAt: string; // 14 days retention
  isArchivedForever?: boolean;
  transcriptText?: string;
  aiSummary?: {
    overview: string;
    keyPoints: string[];
    actionItems: string[];
    termGlossary: { term: string; definition: string }[];
  };
  trimSettings?: VideoTrimSettings;
  monetization?: RecordingMonetization;
}

export interface WebinarItem {
  id: string;
  title: string;
  description: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  durationMinutes: number;
  roomName: string;
  speakerName: string;
  coHosts?: string[];
  accessType: "open_200" | "closed_group" | "practicum_breakout";
  status: "scheduled" | "live" | "finished" | "cancelled";
  registeredCount: number;
  guestLink: string;
  speakerLink: string;
  coHostLink?: string;
  materials: AttachedMaterial[];
  recording?: CloudRecording;
  recordingStorageMode?: "local" | "cloud";
  autoCloudFallback?: boolean;
  publishToGlobalCatalog?: boolean;
  topicTag?: string;
  schoolName?: string;
  priceRub?: number;
  paymentUrl?: string;
  isFeatured?: boolean;
  settings: {
    waitingRoom: boolean;
    breakoutRooms: boolean;
    qaModeration: boolean;
    autoCloudRecording: boolean;
    aiSmartSummary: boolean;
    recordingStorageMode?: "local" | "cloud";
    autoCloudFallback?: boolean;
  };
}

export interface StorageQuota {
  usedMb: number;
  totalQuotaMb: number;
  freeRetentionDays: number;
  archivedRecordingsCount: number;
  tier: "standard_free" | "pro_cloud_archive";
}

const STORAGE_KEY = "ida_terminal_webinars_v1";

const DEFAULT_INTL_WEBINARS: WebinarItem[] = [
  {
    id: "web-001",
    title: "Differential Diagnosis of Anxiety and Panic Disorders",
    description: "Clinical case studies, initial interview protocols, anxiety assessment scales (HADS, GAD-7), and stabilization techniques.",
    scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    scheduledTime: "19:00",
    durationMinutes: 90,
    roomName: "room-anxiety-diff-diag",
    speakerName: "Lead Institute Expert",
    coHosts: ["Moderation Assistant"],
    accessType: "open_200",
    status: "scheduled",
    registeredCount: 142,
    guestLink: "https://ida-psy.pro/live/anxiety-diff-diag",
    speakerLink: "https://ida-psy.pro/studio/room-anxiety-diff-diag",
    materials: [
      {
        id: "mat-1",
        title: "Presentation: Diagnosis of Anxiety & Panic 2026",
        type: "presentation",
        fileName: "diff_diag_anxiety_slides.pdf",
        fileSizeMb: 14.2,
        uploadedAt: "2026-09-28",
      },
      {
        id: "mat-2",
        title: "Rapid Clinical Interview Protocol IDA-TCM",
        type: "protocol",
        fileName: "protocol_ida_tcm_anxiety.pdf",
        fileSizeMb: 1.8,
        kbProtocolTag: "anxiety_panic_primary_v2",
        uploadedAt: "2026-09-28",
      },
      {
        id: "mat-3",
        title: "Client Handout: Breathing Anchors & Grounding",
        type: "handout",
        fileName: "patient_handout_grounding.pdf",
        fileSizeMb: 0.9,
        uploadedAt: "2026-09-28",
      },
    ],
    settings: {
      waitingRoom: false,
      breakoutRooms: true,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
  {
    id: "web-002",
    title: "Supervision Practicum: Working with Complex PTSD Cases",
    description: "Closed group for practicing psychotherapists. Practicing desensitization protocols in small breakout rooms.",
    scheduledDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    scheduledTime: "18:30",
    durationMinutes: 120,
    roomName: "room-ptsd-supervision-group",
    speakerName: "Lead Institute Expert",
    accessType: "practicum_breakout",
    status: "scheduled",
    registeredCount: 18,
    guestLink: "https://ida-psy.pro/live/ptsd-supervision-group",
    speakerLink: "https://ida-psy.pro/studio/room-ptsd-supervision-group",
    materials: [
      {
        id: "mat-4",
        title: "Clinical Review: Case #402 (Anonymized)",
        type: "document",
        fileName: "case_402_ptsd_overview.pdf",
        fileSizeMb: 3.4,
        uploadedAt: "2026-09-29",
      },
    ],
    settings: {
      waitingRoom: true,
      breakoutRooms: true,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
  {
    id: "web-003",
    title: "Introductory Webinar: Integrating AI Clinical Copilot into Practice",
    description: "Overview of IDA Platform features, digital records management, automated clinical session notes, and audio transcription.",
    scheduledDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    scheduledTime: "19:00",
    durationMinutes: 105,
    roomName: "room-ida-intro-ai",
    speakerName: "Lead Institute Expert",
    accessType: "open_200",
    status: "finished",
    registeredCount: 189,
    guestLink: "https://ida-psy.pro/live/ida-intro-ai",
    speakerLink: "https://ida-psy.pro/studio/room-ida-intro-ai",
    materials: [
      {
        id: "mat-5",
        title: "Slides: AI in Psychotherapy — Ethics & Automation",
        type: "presentation",
        fileName: "ai_psychotherapy_slides.pdf",
        fileSizeMb: 22.1,
        uploadedAt: "2026-09-26",
      },
    ],
    recording: {
      id: "rec-003",
      webinarId: "web-003",
      webinarTitle: "Introductory Webinar: Integrating AI Clinical Copilot into Practice",
      recordedAt: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
      durationMinutes: 105,
      fileSizeMb: 1420,
      s3Key: "recordings/2026-09-26/room-ida-intro-ai.mp4",
      videoUrl: "https://storage.yandexcloud.net/ps-recordings/room-ida-intro-ai.mp4",
      status: "ready",
      expiresAt: new Date(Date.now() + 86400000 * 11).toISOString().slice(0, 10),
      isArchivedForever: false,
      transcriptText: "Good evening, colleagues! Today we explore evidence-based practice supported by AI clinical tools...",
      aiSummary: {
        overview: "The session covers secure adoption of AI tools in psychological practice, minimizing administrative load, and maintaining protocols according to APA/TCM standards.",
        keyPoints: [
          "AI does not replace therapeutic alliance, but handles documentation and transcription.",
          "Data privacy: client records isolation in a secure local boundary.",
          "Using IDA Clinical Copilot speeds up supervision preparation by 3x.",
          "Event economics: broadcasts for up to 200 participants with unlimited time and no hidden fees.",
        ],
        actionItems: [
          "Set up personalized intake templates in the terminal.",
          "Test the built-in webinar studio with the Ghost test chat.",
          "Import CBT-3 protocols into personal Knowledge Base.",
        ],
        termGlossary: [
          { term: "IDA TCM", definition: "Therapeutic case taxonomy and protocol matching module." },
          { term: "Breakout Rooms", definition: "Practice rooms for exercises in pairs and triads." },
          { term: "Egress S3", definition: "Direct stream recording from WebRTC server to cloud bucket without local CPU overhead." },
        ],
      },
      trimSettings: {
        trimStartSeconds: 320,
        trimEndSeconds: 5880,
        cutIntervals: [
          {
            id: "cut-1",
            startSeconds: 2700,
            endSeconds: 3600,
            label: "☕ Coffee break (15 min)",
          },
        ],
        cleanDurationMinutes: 77,
      },
      monetization: {
        isPaid: true,
        priceRub: 1490,
        paymentUrl: "https://pay.yookassa.ru/sample-order-ai-webinar",
        accessDays: 90,
        salesCount: 28,
        watermarkEnabled: true,
        singleSessionEnforced: true,
        customOfferTitle: "Full clean recording + clinical handouts & AI summary",
      },
    },
    settings: {
      waitingRoom: false,
      breakoutRooms: false,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
];

const DEFAULT_WEBINARS: WebinarItem[] = [
  {
    id: "web-001",
    title: "Дифференциальная диагностика тревожных и панических расстройств",
    description: "Разбор клинических кейсов, протоколы первичного интервью, шкалы оценки тревоги (HADS, GAD-7) и техники стабилизации.",
    scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    scheduledTime: "19:00",
    durationMinutes: 90,
    roomName: "room-anxiety-diff-diag",
    speakerName: "Ведущий эксперт института",
    coHosts: ["Ассистент модерации"],
    accessType: "open_200",
    status: "scheduled",
    registeredCount: 142,
    guestLink: "https://ida-psy.ru/live/anxiety-diff-diag",
    speakerLink: "https://web.ida-psy.ru/studio/room-anxiety-diff-diag",
    materials: [
      {
        id: "mat-1",
        title: "Презентация: Диагностика тревоги и паники 2026",
        type: "presentation",
        fileName: "diff_diag_anxiety_slides.pdf",
        fileSizeMb: 14.2,
        uploadedAt: "2026-09-28",
      },
      {
        id: "mat-2",
        title: "Протокол экспресс-интервью IDA-TCM",
        type: "protocol",
        fileName: "protocol_ida_tcm_anxiety.pdf",
        fileSizeMb: 1.8,
        kbProtocolTag: "anxiety_panic_primary_v2",
        uploadedAt: "2026-09-28",
      },
      {
        id: "mat-3",
        title: "Памятка для пациента: Дыхательные якоря и заземление",
        type: "handout",
        fileName: "patient_handout_grounding.pdf",
        fileSizeMb: 0.9,
        uploadedAt: "2026-09-28",
      },
    ],
    settings: {
      waitingRoom: false,
      breakoutRooms: true,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
  {
    id: "web-002",
    title: "Супервизорский практикум: Работа со сложными случаями ПТСР",
    description: "Закрытая группа для практикующих психотерапевтов. Отработка протоколов десенсибилизации в малых сессионных залах.",
    scheduledDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    scheduledTime: "18:30",
    durationMinutes: 120,
    roomName: "room-ptsd-supervision-group",
    speakerName: "Ведущий эксперт института",
    accessType: "practicum_breakout",
    status: "scheduled",
    registeredCount: 18,
    guestLink: "https://ida-psy.ru/live/ptsd-supervision-group",
    speakerLink: "https://web.ida-psy.ru/studio/room-ptsd-supervision-group",
    materials: [
      {
        id: "mat-4",
        title: "Клинический разбор кейса #402 (Анонимизировано)",
        type: "document",
        fileName: "case_402_ptsd_overview.pdf",
        fileSizeMb: 3.4,
        uploadedAt: "2026-09-29",
      },
    ],
    settings: {
      waitingRoom: true,
      breakoutRooms: true,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
  {
    id: "web-003",
    title: "Вводный вебинар: Интеграция ИИ-ассистента в клиническую практику",
    description: "Обзор функционала IDA Platform, ведение цифровых карт, авто-формирование протоколов и расшифровка аудио-сессий.",
    scheduledDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    scheduledTime: "19:00",
    durationMinutes: 105,
    roomName: "room-ida-intro-ai",
    speakerName: "Ведущий эксперт института",
    accessType: "open_200",
    status: "finished",
    registeredCount: 189,
    guestLink: "https://ida-psy.ru/live/ida-intro-ai",
    speakerLink: "https://web.ida-psy.ru/studio/room-ida-intro-ai",
    materials: [
      {
        id: "mat-5",
        title: "Слайды: ИИ в психотерапии — этика и автоматизация",
        type: "presentation",
        fileName: "ai_psychotherapy_slides.pdf",
        fileSizeMb: 22.1,
        uploadedAt: "2026-09-26",
      },
    ],
    recording: {
      id: "rec-003",
      webinarId: "web-003",
      webinarTitle: "Вводный вебинар: Интеграция ИИ-ассистента в клиническую практику",
      recordedAt: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
      durationMinutes: 105,
      fileSizeMb: 1420,
      s3Key: "recordings/2026-09-26/room-ida-intro-ai.mp4",
      videoUrl: "https://storage.yandexcloud.net/ps-recordings/room-ida-intro-ai.mp4",
      status: "ready",
      expiresAt: new Date(Date.now() + 86400000 * 11).toISOString().slice(0, 10),
      isArchivedForever: false,
      transcriptText: "Добрый вечер, коллеги! Сегодня мы обсуждаем переход к доказательной психологической практике с поддержкой ИИ-ассистентов...",
      aiSummary: {
        overview: "Эфир посвящен безопасному внедрению ИИ-инструментов в практику психолога, снижению рутинной нагрузки на документацию и ведению протоколов по стандарту APA/TCM.",
        keyPoints: [
          "ИИ не заменяет терапевтический альянс, а берет на себя протоколирование и транскрибацию.",
          "Безопасность персональных данных: изоляция клиентских карт в локальном защищенном контуре.",
          "Использование IDA Clinical Copilot ускоряет подготовку супервизорских отчетов в 3 раза.",
          "Экономика мероприятий: трансляции до 200 слушателей со свободным временем без скрытых платежей.",
        ],
        actionItems: [
          "Настроить персональные шаблоны первичного скрининга в терминале.",
          "Протестировать встроенную студию вебинаров с тестовым Ghost-чатом.",
          "Импортировать протоколы КПТ-3 в личную Базу Знаний.",
        ],
        termGlossary: [
          { term: "IDA TCM", definition: "Модуль классификации терапевтических случаев и подбора протоколов." },
          { term: "Breakout Rooms", definition: "Сессионные залы для отработки упражнений в парах и тройках." },
          { term: "Egress S3", definition: "Прямая запись потока с сервера WebRTC в облачный бакет без нагрузки на ПК спикера." },
        ],
      },
      trimSettings: {
        trimStartSeconds: 320, // 5 мин 20 сек
        trimEndSeconds: 5880,  // 98 мин
        cutIntervals: [
          {
            id: "cut-1",
            startSeconds: 2700, // 45 мин
            endSeconds: 3600,   // 60 мин
            label: "☕ Перерыв и кофе-брейк (15 мин)",
          },
        ],
        cleanDurationMinutes: 77,
      },
      monetization: {
        isPaid: true,
        priceRub: 1490,
        paymentUrl: "https://pay.yookassa.ru/sample-order-ai-webinar",
        accessDays: 90,
        salesCount: 28,
        watermarkEnabled: true,
        singleSessionEnforced: true,
        customOfferTitle: "Чистовая запись вебинара + протоколы КПТ-3 и ИИ-конспект",
      },
    },
    settings: {
      waitingRoom: false,
      breakoutRooms: false,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
];

const DEFAULT_SCHOOL_WEBINARS: WebinarItem[] = [
  {
    id: "sch-001",
    title: "Общешкольное собрание: адаптация 5-х классов, цифровая безопасность и режим дня",
    description: "Онлайн-собрание для родителей параллели 5-х классов. Разбор психологической адаптации при переходе в среднюю школу, профилактика стресса и правила безопасного интернета. ИИ-секретарь ведет автоматический протокол с вопросами родителей.",
    scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    scheduledTime: "18:30",
    durationMinutes: 75,
    roomName: "room-parents-5th-grade",
    speakerName: "Классный руководитель / Педагог-психолог",
    coHosts: ["Заместитель директора по ВР"],
    accessType: "open_200",
    status: "scheduled",
    registeredCount: 86,
    guestLink: "https://prevention-ai.ru/live/parents-5th-grade",
    speakerLink: "https://prevention-ai.ru/terminal/staging/?mode=webinar&entry=educator",
    materials: [
      {
        id: "mat-sch-1",
        title: "Памятка родителям: 7 правил поддержки пятиклассника",
        type: "handout",
        fileName: "parents_memo_adaptation_5th.pdf",
        fileSizeMb: 1.2,
        uploadedAt: "2026-09-28",
      },
      {
        id: "mat-sch-2",
        title: "Презентация: Безопасный интернет и цифровой режим подростка",
        type: "presentation",
        fileName: "digital_safety_school_2026.pdf",
        fileSizeMb: 8.5,
        uploadedAt: "2026-09-28",
      },
      {
        id: "mat-sch-3",
        title: "Бланк официального протокола родительского собрания",
        type: "protocol",
        fileName: "parent_meeting_protocol_template.docx",
        fileSizeMb: 0.4,
        uploadedAt: "2026-09-29",
      },
    ],
    settings: {
      waitingRoom: false,
      breakoutRooms: true,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
  {
    id: "sch-002",
    title: "Педагогический совет: Профилактика учебной неуспеваемости и итоги четверти",
    description: "Плановое онлайн-совещание педагогического коллектива и администрации. Анализ посещаемости, раннее выявление учебной дезадаптации, утверждение графика внеурочной работы.",
    scheduledDate: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10),
    scheduledTime: "15:00",
    durationMinutes: 90,
    roomName: "room-pedsovet-quarter",
    speakerName: "Заместитель директора по УВР",
    accessType: "closed_group",
    status: "scheduled",
    registeredCount: 34,
    guestLink: "https://prevention-ai.ru/live/pedsovet-quarter",
    speakerLink: "https://prevention-ai.ru/terminal/staging/?mode=webinar&entry=educator",
    materials: [
      {
        id: "mat-sch-4",
        title: "Проект решений Педагогического совета №2",
        type: "document",
        fileName: "pedsovet_resolution_draft.pdf",
        fileSizeMb: 0.8,
        uploadedAt: "2026-09-30",
      },
    ],
    settings: {
      waitingRoom: true,
      breakoutRooms: false,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
  {
    id: "sch-003",
    title: "Психолого-педагогический консилиум (ППк): междисциплинарный разбор рисков",
    description: "Закрытый консилиум: классные руководители, психолог и дефектолог. Согласование индивидуальных профилактических маршрутов и рекомендаций для педагогов.",
    scheduledDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    scheduledTime: "16:00",
    durationMinutes: 60,
    roomName: "room-ppk-confidential",
    speakerName: "Руководитель службы школьной медиации и профилактики",
    accessType: "closed_group",
    status: "finished",
    registeredCount: 12,
    guestLink: "https://prevention-ai.ru/live/ppk-confidential",
    speakerLink: "https://prevention-ai.ru/terminal/staging/?mode=webinar&entry=educator",
    materials: [],
    recording: {
      id: "rec-sch-001",
      webinarId: "sch-003",
      webinarTitle: "Психолого-педагогический консилиум (ППк): междисциплинарный разбор рисков",
      recordedAt: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
      durationMinutes: 58,
      fileSizeMb: 680,
      s3Key: "recordings/school/room-ppk-confidential.mp4",
      videoUrl: "https://storage.yandexcloud.net/ps-recordings/room-ppk-confidential.mp4",
      status: "ready",
      expiresAt: new Date(Date.now() + 86400000 * 11).toISOString().slice(0, 10),
      isArchivedForever: true,
      transcriptText: "Коллеги, открываем заседание ППк. На повестке дня — результаты мониторинга адаптации 5-х и 7-х классов...",
      aiSummary: {
        overview: "Консилиум утвердил план адресной психолого-педагогической поддержки учащихся с признаками учебной дезадаптации и буллинга.",
        keyPoints: [
          "Классным руководителям переданы алгоритмы реагирования на конфликты в малых группах.",
          "Для 3 учащихся согласованы индивидуальные профилактические маршруты (ИПР).",
          "Запланировано открытое родительское собрание с анонимным интерактивным опросом.",
        ],
        actionItems: [
          "Классным руководителям провести классные часы по сплочению коллектива до 15 октября.",
          "Психологу завершить индивидуальную диагностику по запросам родителей.",
        ],
        termGlossary: [
          { term: "ППк", definition: "Психолого-педагогический консилиум образовательной организации." },
          { term: "ИПР", definition: "Индивидуальный профилактический маршрут сопровождения учащегося." },
        ],
      },
    },
    settings: {
      waitingRoom: true,
      breakoutRooms: false,
      qaModeration: true,
      autoCloudRecording: true,
      aiSmartSummary: true,
    },
  },
];

export function getWebinarStorageKey(): string {
  if (getTerminalProductId() === "school") {
    return "prevention_school_webinars_v1";
  }
  return getTerminalEdition() === "intl" ? "ida_terminal_webinars_intl_v1" : "ida_terminal_webinars_v1";
}

export function getDefaultWebinars(): WebinarItem[] {
  const list = getTerminalProductId() === "school"
    ? DEFAULT_SCHOOL_WEBINARS
    : (getTerminalEdition() === "intl" ? DEFAULT_INTL_WEBINARS : DEFAULT_WEBINARS);
  return list.map((item) => {
    const links = generateWebinarLinks(item);
    return {
      ...item,
      guestLink: links.guestLink,
      speakerLink: links.speakerLink,
      coHostLink: links.coHostLink,
    };
  });
}

export function loadWebinars(): WebinarItem[] {
  const key = getWebinarStorageKey();
  const defaults = getDefaultWebinars();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (isDemoModeActive()) {
        saveWebinars(defaults);
        return defaults;
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (!item.speakerLink || item.speakerLink.includes("/studio/") || !item.speakerLink.includes("role=speaker")) {
          const fresh = generateWebinarLinks(item);
          return {
            ...item,
            guestLink: fresh.guestLink,
            speakerLink: fresh.speakerLink,
            coHostLink: fresh.coHostLink,
          };
        }
        return item;
      });
    }
    return isDemoModeActive() ? defaults : [];
  } catch {
    return isDemoModeActive() ? defaults : [];
  }
}

export function saveWebinars(items: WebinarItem[]): void {
  const key = getWebinarStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error("Failed to save webinars to localStorage", err);
  }
}

export function getStorageQuota(items: WebinarItem[]): StorageQuota {
  let usedMb = 0;
  let archivedCount = 0;

  for (const item of items) {
    if (item.recording && item.recording.status === "ready") {
      usedMb += item.recording.fileSizeMb;
      if (item.recording.isArchivedForever) {
        archivedCount++;
      }
    }
    for (const mat of item.materials) {
      usedMb += mat.fileSizeMb;
    }
  }

  return {
    usedMb: Math.round(usedMb),
    totalQuotaMb: 15360, // 15 GB
    freeRetentionDays: 14,
    archivedRecordingsCount: archivedCount,
    tier: archivedCount > 0 ? "pro_cloud_archive" : "standard_free",
  };
}

export function generateWebinarLinks(webinar: {
  roomName: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  speakerName: string;
  description?: string;
}, baseUrl?: string) {
  const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "https://ida-psy.ru");
  const baseTerminalUrl = `${origin}/terminal/staging/`;
  
  const baseParams = new URLSearchParams({
    mode: "webinar",
    room: webinar.roomName,
    title: webinar.title,
    time: `${webinar.scheduledDate}T${webinar.scheduledTime}`,
    speaker: webinar.speakerName,
  });
  if (webinar.roomName.toLowerCase().includes("demo")) {
    baseParams.set("demo", "1");
  }
  if (webinar.description) {
    baseParams.set("desc", webinar.description.slice(0, 160));
  }

  const guestParams = new URLSearchParams(baseParams);
  guestParams.set("role", "guest");
  
  const speakerParams = new URLSearchParams(baseParams);
  speakerParams.set("role", "speaker");

  const coHostParams = new URLSearchParams(baseParams);
  coHostParams.set("role", "cohost");

  return {
    guestLink: `${baseTerminalUrl}?${guestParams.toString()}`,
    speakerLink: `${baseTerminalUrl}?${speakerParams.toString()}`,
    coHostLink: `${baseTerminalUrl}?${coHostParams.toString()}`,
  };
}

export function addWebinar(webinar: Omit<WebinarItem, "id" | "registeredCount" | "guestLink" | "speakerLink" | "coHostLink">): WebinarItem {
  const items = loadWebinars();
  const newId = `web-${Date.now().toString(36)}`;
  const links = generateWebinarLinks({
    roomName: webinar.roomName,
    title: webinar.title,
    scheduledDate: webinar.scheduledDate,
    scheduledTime: webinar.scheduledTime,
    speakerName: webinar.speakerName,
    description: webinar.description,
  });
  const created: WebinarItem = {
    ...webinar,
    id: newId,
    registeredCount: 0,
    guestLink: links.guestLink,
    speakerLink: links.speakerLink,
    coHostLink: links.coHostLink,
  };
  items.unshift(created);
  saveWebinars(items);
  return created;
}

export function updateWebinar(webinar: WebinarItem): void {
  const items = loadWebinars();
  const index = items.findIndex((w) => w.id === webinar.id);
  if (index >= 0) {
    items[index] = webinar;
    saveWebinars(items);
  }
}

export function deleteWebinar(id: string): void {
  const items = loadWebinars().filter((w) => w.id !== id);
  saveWebinars(items);
}

export function deleteRecording(webinarId: string): void {
  const items = loadWebinars();
  const item = items.find((w) => w.id === webinarId);
  if (item && item.recording) {
    delete item.recording;
    saveWebinars(items);
  }
}

export function toggleArchiveRecording(webinarId: string): void {
  const items = loadWebinars();
  const item = items.find((w) => w.id === webinarId);
  if (item && item.recording) {
    item.recording.isArchivedForever = !item.recording.isArchivedForever;
    saveWebinars(items);
  }
}

export function updateRecordingTrim(webinarId: string, trimSettings: VideoTrimSettings): void {
  const items = loadWebinars();
  const item = items.find((w) => w.id === webinarId);
  if (item && item.recording) {
    item.recording.trimSettings = trimSettings;
    saveWebinars(items);
  }
}

export function updateRecordingMonetization(webinarId: string, monetization: RecordingMonetization): void {
  const items = loadWebinars();
  const item = items.find((w) => w.id === webinarId);
  if (item && item.recording) {
    item.recording.monetization = monetization;
    saveWebinars(items);
  }
}

export function calculateCleanDurationMinutes(totalDurationMinutes: number, trim?: VideoTrimSettings): number {
  if (!trim) return totalDurationMinutes;
  const totalSeconds = totalDurationMinutes * 60;
  const start = trim.trimStartSeconds || 0;
  const end = trim.trimEndSeconds && trim.trimEndSeconds > start ? trim.trimEndSeconds : totalSeconds;
  let activeSeconds = Math.max(0, end - start);
  if (trim.cutIntervals && trim.cutIntervals.length > 0) {
    for (const cut of trim.cutIntervals) {
      const cutEffectiveStart = Math.max(start, cut.startSeconds);
      const cutEffectiveEnd = Math.min(end, cut.endSeconds);
      if (cutEffectiveEnd > cutEffectiveStart) {
        activeSeconds -= (cutEffectiveEnd - cutEffectiveStart);
      }
    }
  }
  return Math.max(1, Math.round(activeSeconds / 60));
}

export function generateRecordingShareLink(recordingId: string, baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "https://academy.ida-psy.ru");
  const isAcademy = origin.includes("academy.ida-psy") || origin.includes("academy.");
  const path = isAcademy ? "/" : "/terminal/staging/";
  const params = new URLSearchParams({
    mode: "recording",
    id: recordingId,
  });
  return `${origin}${path}?${params.toString()}`;
}

export function findRecordingById(recordingId: string): { webinar: WebinarItem; recording: CloudRecording } | null {
  const items = loadWebinars();
  for (const w of items) {
    if (w.recording && w.recording.id === recordingId) {
      return { webinar: w, recording: w.recording };
    }
  }
  return null;
}

export function findWebinarByRoomName(roomName: string): WebinarItem | null {
  if (!roomName) return null;
  const items = loadWebinars();
  const normalized = roomName.trim().toLowerCase();
  for (const w of items) {
    if (w.roomName && w.roomName.trim().toLowerCase() === normalized) {
      return w;
    }
  }
  return null;
}

