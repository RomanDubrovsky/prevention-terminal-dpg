import { isDemoModeActive } from "./staging_demo_seed.ts";

export interface CreatorLessonMaterial {
  id: string;
  title: string;
  url?: string;
  fileSize?: string;
}

export interface CreatorCourseModule {
  id: string;
  title: string;
  description?: string;
}

export interface CreatorLessonProtection {
  isProtected: boolean;
  watermarkEnabled: boolean;
  noDownloadEnabled: boolean;
  singleSessionEnabled: boolean;
}

export interface CreatorLesson {
  id: string;
  moduleId?: string;
  title: string;
  videoUrl?: string;
  notes?: string;
  duration?: string;
  assignment?: string;
  materials?: CreatorLessonMaterial[];
  protection?: CreatorLessonProtection;
  isFree?: boolean;
}

export interface CreatorCourse {
  id: string;
  title: string;
  description: string;
  authorName?: string;
  schoolName?: string;
  topicTag?: string;
  priceRub?: number;
  paymentUrl?: string;
  publishToGlobalCatalog?: boolean;
  isFeatured?: boolean;
  status: "draft" | "published";
  createdAt: string;
  modules?: CreatorCourseModule[];
  lessons: CreatorLesson[];
}

export interface CourseStudent {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  telegram?: string;
  courseIds: string[];
  webinarIds?: string[];
  paidWebinarIds?: string[];
  participationType?: "paid_cert" | "free_reg";
  certificateSentAt?: string;
  status: "active" | "paused" | "completed";
  registeredAt: string; // YYYY-MM-DD
  accessCode: string;
  notes?: string;
}

const STUDENTS_STORAGE_KEY = "ida_course_students_v1";

const DEFAULT_STUDENTS: CourseStudent[] = [
  {
    id: "st-1",
    fullName: "Елена Смирнова",
    email: "elena.smirnova@example.com",
    phone: "+7 (916) 123-45-67",
    telegram: "@elena_psy",
    courseIds: ["course-1"],
    webinarIds: ["web-1", "web-2"],
    paidWebinarIds: ["web-1", "web-2"],
    participationType: "paid_cert",
    status: "active",
    registeredAt: "2026-10-10",
    accessCode: "st-e9x1",
    notes: "Оплачен пакет: Запись вебинара + именной сертификат и курс КПТ",
  },
  {
    id: "st-2",
    fullName: "Михаил Кузнецов",
    email: "mikhail.kuznetsov@example.com",
    phone: "+7 (921) 987-65-43",
    telegram: "@mkuznetsov",
    courseIds: ["course-1"],
    webinarIds: ["web-1", "web-2"],
    paidWebinarIds: ["web-1", "web-2"],
    participationType: "paid_cert",
    status: "active",
    registeredAt: "2026-10-12",
    accessCode: "st-m4b2",
    notes: "Оплатил доступ к записи вебинара и сертификат участника",
  },
  {
    id: "st-3",
    fullName: "Анна Васильева",
    email: "anna.vasilyeva@example.com",
    phone: "+7 (903) 555-12-34",
    telegram: "@anna_v_psy",
    courseIds: ["course-1"],
    webinarIds: ["web-1"],
    paidWebinarIds: [],
    participationType: "free_reg",
    status: "active",
    registeredAt: "2026-09-28",
    accessCode: "st-a7k5",
    notes: "Бесплатная регистрация на вебинар (без записи и сертификата)",
  },
  {
    id: "st-4",
    fullName: "Наталья Морозова",
    email: "natalia.morozova@psy-school.ru",
    phone: "+7 (915) 234-56-78",
    telegram: "@morozova_nat",
    courseIds: [],
    webinarIds: ["web-1", "web-2"],
    paidWebinarIds: ["web-1", "web-2"],
    participationType: "paid_cert",
    status: "active",
    registeredAt: "2026-10-14",
    accessCode: "st-n8p3",
    notes: "Платник вебинара: оплачены запись эфира + сертификат (1490 ₽)",
  },
  {
    id: "st-5",
    fullName: "Светлана Соколова",
    email: "svetlana.sokolova@edu-center.ru",
    phone: "+7 (926) 876-54-32",
    telegram: "@sveta_sokolova",
    courseIds: [],
    webinarIds: ["web-1", "web-2"],
    paidWebinarIds: ["web-1", "web-2"],
    participationType: "paid_cert",
    status: "active",
    registeredAt: "2026-10-15",
    accessCode: "st-s2v9",
    notes: "Платник вебинара: оплачены запись эфира + сертификат (1490 ₽)",
  },
  {
    id: "st-6",
    fullName: "Дмитрий Волков",
    email: "d.volkov@mail.ru",
    phone: "+7 (905) 333-22-11",
    telegram: "@volkov_d",
    courseIds: [],
    webinarIds: ["web-1", "web-2"],
    paidWebinarIds: [],
    participationType: "free_reg",
    status: "active",
    registeredAt: "2026-10-15",
    accessCode: "st-d5w4",
    notes: "Предварительная бесплатная регистрация на эфир",
  },
];

export function isStudentPaidForWebinar(student: CourseStudent, webinarId?: string): boolean {
  if (webinarId && Array.isArray(student.paidWebinarIds) && student.paidWebinarIds.includes(webinarId)) {
    return true;
  }
  if (student.participationType === "paid_cert") {
    return true;
  }
  if (student.participationType === "free_reg") {
    return false;
  }
  const notesLower = (student.notes || "").toLowerCase();
  if (
    notesLower.includes("не оплат") ||
    notesLower.includes("бесплатн") ||
    notesLower.includes("без записи") ||
    notesLower.includes("только эфир")
  ) {
    return false;
  }
  if (
    notesLower.includes("оплат") ||
    notesLower.includes("платник") ||
    notesLower.includes("сертификат") ||
    notesLower.includes("пакет") ||
    notesLower.includes("тариф")
  ) {
    return true;
  }
  return false;
}

export function generateAccessCode(): string {
  return "st-" + Math.random().toString(36).substring(2, 7);
}

export function loadCourseStudents(): CourseStudent[] {
  try {
    const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (!raw) {
      if (isDemoModeActive()) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(DEFAULT_STUDENTS));
        return DEFAULT_STUDENTS;
      }
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Backfill participationType on legacy default records if missing
      return parsed.map((s: CourseStudent) => {
        if (!s.participationType) {
          const paid = isStudentPaidForWebinar(s);
          return {
            ...s,
            participationType: paid ? "paid_cert" : "free_reg",
            webinarIds: s.webinarIds || ["web-1", "web-2"],
            paidWebinarIds: s.paidWebinarIds || (paid ? ["web-1", "web-2"] : []),
          };
        }
        return s;
      });
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to load students registry from localStorage", err);
  }
  return isDemoModeActive() ? DEFAULT_STUDENTS : [];
}

export function saveCourseStudents(students: CourseStudent[]): void {
  try {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
  } catch (err) {
    console.error("Failed to save students registry to localStorage", err);
  }
}

export function buildStudentLink(
  student: CourseStudent,
  courseId?: string,
  baseOrigin?: string
): string {
  const origin =
    baseOrigin ||
    (typeof window !== "undefined" && window.location.origin.includes("academy.ida-psy")
      ? window.location.origin
      : "https://academy.ida-psy.ru");
  const cid = courseId || student.courseIds[0] || "course-1";
  return `${origin}/?course=${encodeURIComponent(cid)}&student=${encodeURIComponent(student.accessCode)}&role=student`;
}

function csvCell(raw: string | number | null | undefined): string {
  const v = String(raw ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

export function exportStudentsToExcel(
  students: CourseStudent[],
  courseTitlesMap: Record<string, string>,
  filename?: string
): void {
  const headers = [
    "ФИО студента",
    "Email",
    "Телефон",
    "Telegram",
    "Доступ к курсам (программы)",
    "Кол-во курсов",
    "Статус доступа",
    "Код доступа",
    "Персональная ссылка на вход",
    "Дата добавления",
    "Заметки преподавателя",
  ];

  const lines = [headers.map(csvCell).join(";")];

  for (const s of students) {
    const assignedTitles = (s.courseIds || [])
      .map((id) => courseTitlesMap[id] || id)
      .filter(Boolean);

    const courseNamesText =
      assignedTitles.length > 0
        ? assignedTitles.join(", ")
        : "— (доступ не назначен)";

    const statusLabel =
      s.status === "active"
        ? "🟢 Активен"
        : s.status === "paused"
        ? "⏸ Приостановлен"
        : "✓ Завершен";

    const link = buildStudentLink(s);

    const row = [
      s.fullName,
      s.email,
      s.phone || "",
      s.telegram || "",
      courseNamesText,
      assignedTitles.length,
      statusLabel,
      s.accessCode,
      link,
      s.registeredAt,
      s.notes || "",
    ];
    lines.push(row.map(csvCell).join(";"));
  }

  // UTF-8 BOM so Excel opens Cyrillic without garbled characters
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const finalName = filename || `baza-studentov-${dateStr}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadStudentsTemplateCsv(): void {
  const headers = ["ФИО", "Email", "Телефон", "Telegram", "Курс", "Статус", "Заметки"];
  const sampleRows = [
    [
      "Иванова Ольга Сергеевна",
      "olga.ivanova@gmail.com",
      "+7 (916) 111-22-33",
      "@olga_psy",
      "Практикум КПТ",
      "Активен",
      "Оплачено 10.10.2026",
    ],
    [
      "Смирнов Алексей Викторович",
      "alex.smirnov@yandex.ru",
      "+7 (925) 444-55-66",
      "@alex_smirnov",
      "Практикум КПТ",
      "Активен",
      "Поток 2",
    ],
  ];

  const lines = [
    headers.map(csvCell).join(";"),
    ...sampleRows.map((r) => r.map(csvCell).join(";")),
  ];

  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "obrazets-tablicy-studentov.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function detectDelimiter(text: string): ";" | "," | "\t" {
  const firstLine = text.split(/\r?\n/)[0] || "";
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (inQuotes) continue;
    if (ch === ";") semi++;
    if (ch === ",") comma++;
    if (ch === "\t") tab++;
  }
  if (tab > semi && tab > comma) return "\t";
  if (semi >= comma && semi > 0) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export interface ParsedStudentRow {
  fullName: string;
  email: string;
  phone?: string;
  telegram?: string;
  courseName?: string;
  status: "active" | "paused" | "completed";
  notes?: string;
}

export function parseStudentsSpreadsheet(
  rawText: string,
  defaultCourseId?: string,
  availableCourses?: { id: string; title: string }[],
  defaultWebinarId?: string,
  defaultParticipationType?: "paid_cert" | "free_reg"
): { students: CourseStudent[]; errors: string[] } {
  const text = rawText.replace(/^\uFEFF/, "").trim();
  if (!text) return { students: [], errors: ["Файл или текст пуст"] };

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 1) return { students: [], errors: ["Нет строк с данными"] };

  const delimiter = detectDelimiter(text);
  const headerCells = parseCsvLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/[\s_.-]+/g, "")
  );

  let colName = -1;
  let colEmail = -1;
  let colPhone = -1;
  let colTg = -1;
  let colCourse = -1;
  let colStatus = -1;
  let colNotes = -1;

  headerCells.forEach((header, idx) => {
    if (
      header.includes("фио") ||
      header.includes("имя") ||
      header.includes("студент") ||
      header.includes("слушател") ||
      header.includes("пользователь") ||
      header.includes("fullname") ||
      header.includes("name") ||
      header.includes("fio") ||
      header.includes("клиент")
    ) {
      if (colName === -1) colName = idx;
    } else if (
      header.includes("email") ||
      header.includes("почта") ||
      header.includes("эл.адрес") ||
      header.includes("электронн") ||
      header.includes("mail")
    ) {
      if (colEmail === -1) colEmail = idx;
    } else if (
      header.includes("телефон") ||
      header.includes("phone") ||
      header.includes("тел") ||
      header.includes("номер") ||
      header.includes("mobile")
    ) {
      if (colPhone === -1) colPhone = idx;
    } else if (
      header.includes("telegram") ||
      header.includes("тг") ||
      header.includes("tg") ||
      header.includes("телеграм")
    ) {
      if (colTg === -1) colTg = idx;
    } else if (
      header.includes("курс") ||
      header.includes("course") ||
      header.includes("программа") ||
      header.includes("тренинг") ||
      header.includes("групп") ||
      header.includes("продукт") ||
      header.includes("предложен") ||
      header.includes("заказ")
    ) {
      if (colCourse === -1) colCourse = idx;
    } else if (
      header.includes("статус") ||
      header.includes("status") ||
      header.includes("состояни")
    ) {
      if (colStatus === -1) colStatus = idx;
    } else if (
      header.includes("заметк") ||
      header.includes("коммент") ||
      header.includes("note") ||
      header.includes("примечан") ||
      header.includes("тариф") ||
      header.includes("оплат") ||
      header.includes("город") ||
      header.includes("тег")
    ) {
      if (colNotes === -1) colNotes = idx;
    }
  });

  // Check if first row actually contains an email address (@) — if so, it's data, not a header!
  const firstRowHasEmail = lines[0].includes("@");
  const hasRecognizedHeader = !firstRowHasEmail && (colName !== -1 || colEmail !== -1);
  const startIdx = hasRecognizedHeader ? 1 : 0;
  if (!hasRecognizedHeader) {
    colName = 0;
    colEmail = 1;
    colPhone = 2;
    colTg = 3;
    colCourse = 4;
  }

  const today = new Date().toISOString().substring(0, 10);
  const students: CourseStudent[] = [];
  const errors: string[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const row = parseCsvLine(rawLine, delimiter);
    let fullName = (row[colName] || "").trim();
    let email = (colEmail !== -1 ? row[colEmail] : "")?.trim() || "";
    const phone = colPhone !== -1 ? row[colPhone]?.trim() : "";
    const tg = colTg !== -1 ? row[colTg]?.trim() : "";
    const rawStatus = colStatus !== -1 ? row[colStatus]?.toLowerCase() : "";
    const notes = colNotes !== -1 ? row[colNotes]?.trim() : "";

    // Smart fallback if user pasted "Иванова Мария maria@mail.ru" in a single column or reversed order
    if (!email && fullName.includes("@")) {
      const emailMatch = fullName.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        email = emailMatch[1];
        fullName = fullName.replace(emailMatch[0], "").replace(/[-—:;()<>]+/g, " ").trim();
      }
    } else if (fullName.includes("@") && !email.includes("@")) {
      const tmp = fullName;
      fullName = email;
      email = tmp;
    }

    if (!fullName && !email) continue;

    let status: "active" | "paused" | "completed" = "active";
    if (rawStatus.includes("приостанов") || rawStatus.includes("pause") || rawStatus.includes("блок") || rawStatus.includes("закрыт")) {
      status = "paused";
    } else if (rawStatus.includes("заверш") || rawStatus.includes("complete") || rawStatus.includes("окончен")) {
      status = "completed";
    }

    let courseIds: string[] = [];
    const courseCell = colCourse !== -1 ? row[colCourse]?.trim() : "";

    if (courseCell && availableCourses && availableCourses.length > 0) {
      const segments = courseCell.split(/[,;\n\r|]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const matchedIds = new Set<string>();

      for (const seg of segments) {
        if (!seg || seg.startsWith("—") || seg.startsWith("-")) continue;
        for (const c of availableCourses) {
          const cTitle = c.title.toLowerCase();
          if (c.id === seg || cTitle.includes(seg) || seg.includes(cTitle)) {
            matchedIds.add(c.id);
          }
        }
      }

      courseIds = Array.from(matchedIds);
    }

    if (courseIds.length === 0 && defaultCourseId) {
      courseIds = [defaultCourseId];
    }

    const rowTextLower = rawLine.toLowerCase();
    let participationType: "paid_cert" | "free_reg" = defaultParticipationType || "paid_cert";
    if (!defaultParticipationType) {
      if (rowTextLower.includes("бесплат") || rowTextLower.includes("только эфир") || rowTextLower.includes("free")) {
        participationType = "free_reg";
      } else {
        participationType = "paid_cert";
      }
    }

    const webinarIds = defaultWebinarId ? [defaultWebinarId] : ["web-1", "web-2"];
    const paidWebinarIds =
      participationType === "paid_cert"
        ? defaultWebinarId
          ? [defaultWebinarId]
          : ["web-1", "web-2"]
        : [];

    students.push({
      id: "st-" + Math.random().toString(36).substring(2, 8),
      fullName: fullName || (email ? email.split("@")[0] : "Слушатель вебинара"),
      email: email || "",
      phone: phone || undefined,
      telegram: tg || undefined,
      courseIds,
      webinarIds,
      paidWebinarIds,
      participationType,
      status,
      registeredAt: today,
      accessCode: generateAccessCode(),
      notes:
        notes ||
        (participationType === "paid_cert"
          ? "Платник вебинара (оплачены запись + сертификат)"
          : "Бесплатная регистрация на эфир"),
    });
  }

  return { students, errors };
}

export type AcademyEnvironment = "demo" | "live";

export const DEFAULT_COURSES: CreatorCourse[] = [
  {
    id: "course-1",
    title: "Основы психологического консультирования",
    description: "Базовый практический курс для специалистов помогающих профессий: от первого контакта до завершения работы.",
    authorName: "Елена Разумовская, к.пс.н.",
    schoolName: "Школа практической психологии",
    topicTag: "Основы консультирования",
    priceRub: 9900,
    status: "published",
    createdAt: new Date().toISOString().slice(0, 10),
    modules: [
      { id: "mod-1", title: "Модуль 1. Первый контакт и диагностика", description: "Теоретические основы и первичное интервью" },
      { id: "mod-2", title: "Модуль 2. Практические интервенции", description: "Техники саморегуляции и алгоритмы работы" },
    ],
    lessons: [
      {
        id: "les-1",
        moduleId: "mod-1",
        title: "Урок 1. Первый контакт и заключение контракта",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        duration: "25 мин",
        isFree: true,
        notes: "## Правила первой сессии\n\nПрояснение ожиданий клиента, рамки конфиденциальности и сеттинг.\n\n### Ключевые тезисы:\n1. **Установление доверительного контакта**\n2. Обсуждение регулярности и оплаты\n3. Зоны ответственности клиента и специалиста\n\n> Контакт важнее любой диагностической схемы на первом этапе.",
        assignment: "Сформулируйте памятку первичного контракта для вашего направления работы (3-4 ключевых пункта).",
        materials: [
          { id: "m-1", title: "Бланк информированного согласия.pdf", fileSize: "180 КБ", url: "#" },
          { id: "m-2", title: "Чек-лист первичного интервью.docx", fileSize: "95 КБ", url: "#" },
        ],
      },
      {
        id: "les-2",
        moduleId: "mod-1",
        title: "Урок 2. Формулирование запроса и гипотез",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        duration: "35 мин",
        isFree: false,
        notes: "## От жалобы к реальному терапевтическому запросу\n\nВыявление автоматических мыслей, триггеров и вторичных выгод.\n\n- Определение мишени работы\n- Проверка реалистичности цели\n- Согласование критериев завершения",
        assignment: "Разберите кейс клиента с жалобой «У меня нет сил ни на что» и переведите её в рабочий контракт.",
        materials: [
          { id: "m-3", title: "Таблица фиксации автоматических мыслей.pdf", fileSize: "220 КБ", url: "#" },
        ],
      },
      {
        id: "les-3",
        moduleId: "mod-2",
        title: "Урок 3. Инструменты саморегуляции и итог",
        duration: "30 мин",
        isFree: false,
        notes: "## Инструменты саморегуляции\n\nПодбор практик саморегуляции, поведенческие эксперименты и домашние задания для клиента между встречами.\n\n- Дыхательные техники\n- Прогрессивная мышечная релаксация\n- Фиксация эмоционального фона",
        assignment: "Составьте план из 2 упражнений для снятия острого эмоционального напряжения.",
        materials: [
          { id: "m-4", title: "Памятка техник заземления и дыхания.pdf", fileSize: "140 КБ", url: "#" },
        ],
      },
    ],
  },
  {
    id: "course-2",
    title: "Практикум: Работа с тревогой и паникой (КПТ протоколы)",
    description: "Пошаговый курс с интерактивными протоколами, разбором реальных клинических ситуаций и домашними заданиями.",
    authorName: "Михаил Романов, клинический психолог",
    schoolName: "Академия IDA",
    topicTag: "КПТ и Тревога",
    priceRub: 14500,
    status: "published",
    createdAt: new Date().toISOString().slice(0, 10),
    modules: [
      { id: "mod-c2-1", title: "Модуль 1. Психообразование и модель тревоги", description: "КПТ-концептуализация тревожных состояний" },
      { id: "mod-c2-2", title: "Модуль 2. Экспозиция и поведенческие эксперименты", description: "Интервенции и преодоление охранительного поведения" },
    ],
    lessons: [
      {
        id: "les-c2-1",
        moduleId: "mod-c2-1",
        title: "Урок 1. Цикл тревоги и охранительное поведение",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        duration: "28 мин",
        isFree: true,
        notes: "## Модель формирования тревоги\n\nКак охранительное поведение и избегание подкрепляют страх. Физиологический компонент тревоги (симпатическая нервная система).\n\n### Главные шаги:\n1. Фиксация автоматических мыслей-катастрофизаций\n2. Отслеживание телесных реакций\n3. Ступенчатая десенсибилизация",
        assignment: "Заполните дневник ABC для ситуации внезапного приступа тревоги.",
        materials: [
          { id: "m-c2-1", title: "Протокол работы с ПА.pdf", fileSize: "310 КБ", url: "#" },
          { id: "m-c2-2", title: "Дневник мыслей при панике.docx", fileSize: "115 КБ", url: "#" },
        ],
      },
      {
        id: "les-c2-2",
        moduleId: "mod-c2-2",
        title: "Урок 2. Интероцептивная экспозиция и закрепление",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        duration: "32 мин",
        isFree: false,
        notes: "## Проведение интероцептивной экспозиции\n\nТехника гипервентиляции, вращения и соломинки для привыкания к телесным симптомам без катастрофизации.",
        assignment: "Составьте иерархию ситуаций избегания для клиента с агорафобией.",
        materials: [
          { id: "m-c2-3", title: "Иерархия экспозиций (Шаблон).pdf", fileSize: "190 КБ", url: "#" },
        ],
      },
    ],
  },
  {
    id: "course-3",
    title: "Кризисная помощь и экстренная стабилизация",
    description: "Алгоритмы работы в острых стрессовых состояниях, при утратах, панических атаках и суицидальном риске.",
    authorName: "Сергей Волков, кризисный психолог",
    schoolName: "Prevention School",
    topicTag: "Кризисная помощь",
    priceRub: 12900,
    status: "published",
    createdAt: new Date().toISOString().slice(0, 10),
    modules: [
      { id: "mod-c3-1", title: "Модуль 1. Протоколы первого часа в кризисе", description: "Оценка риска и стабилизация дыхания/тела" },
      { id: "mod-c3-2", title: "Модуль 2. Работа с травматическим опытом", description: "Интеграция переживания и маршрутизация" },
    ],
    lessons: [
      {
        id: "les-c3-1",
        moduleId: "mod-c3-1",
        title: "Урок 1. Протокол безопасности и первая психологическая помощь",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        duration: "30 мин",
        isFree: true,
        notes: "## Принципы Психологической Первой Помощи (ППП)\n\nБезопасность, спокойствие, связь с близкими, самоэффективность и надежда.\n\n### Алгоритм:\n1. Физическая безопасность и контакт взглядом\n2. Заземление (техника 5-4-3-2-1)\n3. Не давать ложных обещаний, фиксировать факты",
        assignment: "Составьте алгоритм экстренного реагирования для психологического кабинета.",
        materials: [
          { id: "m-c3-1", title: "Памятка экстренной стабилизации.pdf", fileSize: "250 КБ", url: "#" },
          { id: "m-c3-2", title: "Шкала оценки суицидального риска C-SSRS.pdf", fileSize: "180 КБ", url: "#" },
        ],
      },
      {
        id: "les-c3-2",
        moduleId: "mod-c3-2",
        title: "Урок 2. Маршрутизация и сопровождение в кризисе",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
        duration: "35 мин",
        isFree: false,
        notes: "## Взаимодействие с медициной и соцслужбами\n\nКогда необходимо привлекать психиатра, правила информирования родственников.",
        assignment: "Разработайте карту маршрутизации клиента в вашем регионе.",
        materials: [
          { id: "m-c3-3", title: "Шаблон плана безопасности клиента.docx", fileSize: "90 КБ", url: "#" },
        ],
      },
    ],
  },
  {
    id: "course-4",
    title: "Психологическое консультирование подростков и родителей",
    description: "Практический курс по установлению контакта с подростками, работе с буллингом, сепарацией и родительской тревогой.",
    authorName: "Ольга Дроздова, подростковый психолог",
    schoolName: "Teenology Lab",
    topicTag: "Детско-родительские",
    priceRub: 11900,
    status: "published",
    createdAt: new Date().toISOString().slice(0, 10),
    modules: [
      { id: "mod-c4-1", title: "Модуль 1. Доверительный контакт с подростком", description: "Преодоление сопротивления и закрытости" },
      { id: "mod-c4-2", title: "Модуль 2. Триада: Подросток - Родитель - Специалист", description: "Совместные сессии и границы" },
    ],
    lessons: [
      {
        id: "les-c4-1",
        moduleId: "mod-c4-1",
        title: "Урок 1. Специфика подросткового контакта: как не стать «очередным взрослым»",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
        duration: "32 мин",
        isFree: true,
        notes: "## Особенности установления контакта с подростком\n\nКонфиденциальность: что остаётся между специалистом и подростком, а о чём обязательно информируются родители (угроза жизни и здоровью).\n\n- Валидация эмоций без поучений\n- Метафоры и разговор на равных\n- Контракт на работу",
        assignment: "Сформулируйте правила конфиденциальности, понятные 14-летнему подростку.",
        materials: [
          { id: "m-c4-1", title: "Гайд по первой встрече с подростком.pdf", fileSize: "290 КБ", url: "#" },
        ],
      },
      {
        id: "les-c4-2",
        moduleId: "mod-c4-2",
        title: "Урок 2. Работа с родительской виной и тревогой",
        duration: "28 мин",
        isFree: false,
        notes: "## Сессия с родителями\n\nКак снизить гиперопеку и тревожность родителей без обвинений.",
        assignment: "Подготовьте схему обратной связи родителям по итогам 3 встреч с подростком.",
        materials: [
          { id: "m-c4-2", title: "Опросник детско-родительских отношений.docx", fileSize: "120 КБ", url: "#" },
        ],
      },
    ],
  },
  {
    id: "course-5",
    title: "Нейропсихологическая диагностика и коррекция",
    description: "Инструменты оценки высших психических функций (внимание, память, исполнительный контроль) и развивающие протоколы.",
    authorName: "Андрей Белов, нейропсихолог",
    schoolName: "Институт Нейропедагогики",
    topicTag: "Нейропсихология",
    priceRub: 16000,
    status: "published",
    createdAt: new Date().toISOString().slice(0, 10),
    modules: [
      { id: "mod-c5-1", title: "Модуль 1. Диагностический нейропсихологический комплекс", description: "Пробы Лурия и современные методики" },
    ],
    lessons: [
      {
        id: "les-c5-1",
        moduleId: "mod-c5-1",
        title: "Урок 1. Основы синдромного анализа и пробы Лурия",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        duration: "38 мин",
        isFree: true,
        notes: "## Нейропсихологический осмотр\n\nОценка праксиса, гнозиса, памяти и регуляторных функций (III блок мозга).\n\n- Графические пробы\n- Реципрокная координация\n- Проба Хэда",
        assignment: "Опишите протокол проведения пробы «кулак-ребро-ладонь».",
        materials: [
          { id: "m-c5-1", title: "Альбом нейропсихологических проб.pdf", fileSize: "1.4 МБ", url: "#" },
        ],
      },
    ],
  },
];

const COURSES_STORAGE_KEY_LEGACY = "ida_creator_courses_v3";
const COURSES_STORAGE_KEY_DEMO = "ida_creator_courses_demo_v3";
const COURSES_STORAGE_KEY_LIVE = "ida_creator_courses_live_v3";

export function getAcademyEnvironment(role: "creator" | "student" = "creator"): AcademyEnvironment {
  if (typeof window === "undefined") return "demo";
  try {
    const sp = new URLSearchParams(window.location.search);
    const envParam = sp.get("env")?.toLowerCase();
    if (envParam === "live") return "live";
    if (envParam === "demo") return "demo";
    if (sp.get("live") === "1") return "live";
    if (sp.get("demo") === "1" || sp.get("entry") === "demo") return "demo";

    if (role === "student") {
      if (sp.get("student") || sp.get("code")) return "live";
      const savedStudent = localStorage.getItem("ida_student_mode");
      if (savedStudent === "live") return "live";
      if (savedStudent === "demo") return "demo";
      return "demo"; // Для студента по умолчанию всегда рабочий демо-класс, чтобы ничего не зависало
    }

    const savedCreator = localStorage.getItem("ida_creator_mode");
    if (savedCreator === "live") return "live";
    if (savedCreator === "demo") return "demo";
    const hasToken = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("platform_access_token"));
    if (hasToken && !sp.has("demo") && sp.get("entry") !== "demo") return "live";
    return "demo";
  } catch {
    return "demo";
  }
}

export function setAcademyEnvironment(role: "creator" | "student", env: AcademyEnvironment): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(role === "creator" ? "ida_creator_mode" : "ida_student_mode", env);
  } catch {}
}

export function loadCreatorCourses(env?: AcademyEnvironment): CreatorCourse[] {
  if (typeof window === "undefined") return DEFAULT_COURSES;
  const targetEnv = env || getAcademyEnvironment("creator");
  try {
    if (targetEnv === "demo") {
      const raw = localStorage.getItem(COURSES_STORAGE_KEY_DEMO) || localStorage.getItem(COURSES_STORAGE_KEY_LEGACY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as CreatorCourse[];
      }
      // If demo has no courses, seed DEFAULT_COURSES
      saveCreatorCourses(DEFAULT_COURSES, "demo");
      return DEFAULT_COURSES;
    } else {
      // Live environment
      const raw = localStorage.getItem(COURSES_STORAGE_KEY_LIVE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as CreatorCourse[];
      }
      return [];
    }
  } catch {
    return targetEnv === "demo" ? DEFAULT_COURSES : [];
  }
}

export function saveCreatorCourses(courses: CreatorCourse[], env?: AcademyEnvironment): void {
  if (typeof window === "undefined") return;
  const targetEnv = env || getAcademyEnvironment("creator");
  try {
    const key = targetEnv === "demo" ? COURSES_STORAGE_KEY_DEMO : COURSES_STORAGE_KEY_LIVE;
    localStorage.setItem(key, JSON.stringify(courses));
    if (targetEnv === "demo") {
      // Also sync legacy key for backward compatibility
      localStorage.setItem(COURSES_STORAGE_KEY_LEGACY, JSON.stringify(courses));
    }
  } catch {}
}

export function resetCreatorCoursesDemo(): CreatorCourse[] {
  saveCreatorCourses(DEFAULT_COURSES, "demo");
  return DEFAULT_COURSES;
}

export function importDemoCoursesToLive(): CreatorCourse[] {
  const currentLive = loadCreatorCourses("live");
  const merged = [...currentLive];
  for (const demoCourse of DEFAULT_COURSES) {
    const exists = merged.some((c) => c.title === demoCourse.title);
    if (!exists) {
      merged.push({
        ...demoCourse,
        id: `course-live-${Date.now().toString(36)}`,
        status: "draft",
      });
    }
  }
  saveCreatorCourses(merged, "live");
  return merged;
}
