/**
 * Academy LMS Store: Students, Homework Submissions, Review Queue, and Course Management
 */

import { isDemoModeActive } from "./staging_demo_seed.ts";

export interface AcademyStudent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  enrolledCourse: string;
  enrolledAt: string;
  lastActiveAt: string;
  progressPercent: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  homeworkCompletedCount: number;
  status: "active" | "suspended" | "completed";
  notes?: string;
}

export interface AcademyHomeworkSubmission {
  id: string;
  lessonId: string;
  lessonTitle: string;
  moduleId: string | number;
  moduleTitle?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedAt: string;
  taskPrompt: string;
  studentAnswer: string;
  attachmentUrl?: string;
  status: "pending" | "approved" | "rejected";
  reviewerComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const STUDENTS_STORAGE_KEY = "ida_academy_lms_students_v1";
const HOMEWORK_STORAGE_KEY = "ida_academy_lms_homeworks_v1";

const DEFAULT_SEED_STUDENTS: AcademyStudent[] = [
  {
    id: "stud-01",
    name: "Анна Смирнова",
    email: "anna.smirnova@psy-mail.ru",
    phone: "+7 (916) 234-56-78",
    enrolledCourse: "Базовый курс психологического консультирования и КПТ",
    enrolledAt: "2026-09-15T10:00:00Z",
    lastActiveAt: "2026-10-10T14:20:00Z",
    progressPercent: 68,
    completedLessonsCount: 17,
    totalLessonsCount: 25,
    homeworkCompletedCount: 5,
    status: "active",
    notes: "Отлично сдаёт практические кейсы, активна на супервизиях",
  },
  {
    id: "stud-02",
    name: "Михаил Кузнецов",
    email: "kuznetsov.m@gmail.com",
    phone: "+7 (903) 112-90-44",
    enrolledCourse: "Базовый курс психологического консультирования и КПТ",
    enrolledAt: "2026-09-18T12:30:00Z",
    lastActiveAt: "2026-10-09T18:45:00Z",
    progressPercent: 44,
    completedLessonsCount: 11,
    totalLessonsCount: 25,
    homeworkCompletedCount: 3,
    status: "active",
    notes: "Сдал ДЗ по Модулю 4, ожидает проверки",
  },
  {
    id: "stud-03",
    name: "Екатерина Романова",
    email: "e.romanova.psy@yandex.ru",
    phone: "+7 (925) 778-01-23",
    enrolledCourse: "Базовый курс психологического консультирования и КПТ",
    enrolledAt: "2026-09-10T09:15:00Z",
    lastActiveAt: "2026-10-10T11:05:00Z",
    progressPercent: 88,
    completedLessonsCount: 22,
    totalLessonsCount: 25,
    homeworkCompletedCount: 7,
    status: "active",
    notes: "Готовится к итоговой аттестации и защите кейса",
  },
  {
    id: "stud-04",
    name: "Дмитрий Васильев",
    email: "d.vasiliev@inbox.ru",
    enrolledCourse: "Базовый курс психологического консультирования и КПТ",
    enrolledAt: "2026-08-20T14:00:00Z",
    lastActiveAt: "2026-09-28T16:10:00Z",
    progressPercent: 24,
    completedLessonsCount: 6,
    totalLessonsCount: 25,
    homeworkCompletedCount: 1,
    status: "suspended",
    notes: "Заморозка обучения по заявлению до 01.11.2026",
  },
];

const DEFAULT_SEED_HOMEWORKS: AcademyHomeworkSubmission[] = [
  {
    id: "hw-001",
    lessonId: "lesson-cbt-04",
    lessonTitle: "Анализ автоматических мыслей и протокол СМЭР",
    moduleId: 2,
    moduleTitle: "Модуль 2: Когнитивно-поведенческая терапия",
    studentId: "stud-02",
    studentName: "Михаил Кузнецов",
    studentEmail: "kuznetsov.m@gmail.com",
    submittedAt: "2026-10-09T18:45:00Z",
    taskPrompt: "Заполните протокол СМЭР для учебного кейса клиента с тревогой перед публичным выступлением (5 колонок + альтернативная мысль).",
    studentAnswer: `Ситуация: Начальник попросил выступить с отчетом в пятницу.
Мысль: "Я собьюсь, все увидят, что я некомпетентен, и меня уволят" (доверие 85%).
Эмоция: Тревога (8/10), напряжение в плечах, учащенный пульс.
Реакция тела: Дрожь в руках.
Альтернативная мысль: "Я готовился три дня и знаю цифры. Даже если я оговорюсь, это не значит некомпетентность — коллеги тоже иногда ошибаются." (доверие 70%).
Снижение тревоги: до 4/10.`,
    status: "pending",
  },
  {
    id: "hw-002",
    lessonId: "lesson-cbt-03",
    lessonTitle: "Формулирование терапевтического контракта и первая встреча",
    moduleId: 1,
    moduleTitle: "Модуль 1: Введение и первый контакт",
    studentId: "stud-01",
    studentName: "Анна Смирнова",
    studentEmail: "anna.smirnova@psy-mail.ru",
    submittedAt: "2026-10-08T15:20:00Z",
    taskPrompt: "Составьте перечень правил сеттинга (опоздания, отмены, конфиденциальность) понятным клиенту языком без психотерапевтического снобизма.",
    studentAnswer: `1. Длительность: Встречаемся ровно на 50 минут, начинаем вовремя.
2. Отмены: Предупреждаем за 24 часа. Если отмена день в день — встреча оплачивается.
3. Тайна: Всё, что обсуждается в кабинете, остаётся между нами (исключение — угроза жизни).
4. Правило прямого контакта: Если что-то не нравится или вызывает дискомфорт — сразу говорим прямо.`,
    status: "approved",
    reviewerComment: "Отличная живая формулировка! Никакого птичьего языка, всё предельно понятно обычному человеку.",
    reviewedAt: "2026-10-09T10:15:00Z",
    reviewedBy: "Ведущий преподаватель",
  },
];

export function getAcademyStudents(): AcademyStudent[] {
  try {
    const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (!raw) {
      if (isDemoModeActive()) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_STUDENTS));
        return DEFAULT_SEED_STUDENTS;
      }
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return isDemoModeActive() ? DEFAULT_SEED_STUDENTS : [];
  }
}

export function saveAcademyStudent(student: AcademyStudent): void {
  try {
    const list = getAcademyStudents();
    const idx = list.findIndex((s) => s.id === student.id);
    if (idx >= 0) {
      list[idx] = student;
    } else {
      list.unshift(student);
    }
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to save student:", err);
  }
}

export function updateStudentStatus(studentId: string, status: AcademyStudent["status"]): void {
  try {
    const list = getAcademyStudents();
    const st = list.find((s) => s.id === studentId);
    if (st) {
      st.status = status;
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.error("Failed to update student status:", err);
  }
}

export function getHomeworkSubmissions(): AcademyHomeworkSubmission[] {
  try {
    const raw = localStorage.getItem(HOMEWORK_STORAGE_KEY);
    if (!raw) {
      if (isDemoModeActive()) {
        localStorage.setItem(HOMEWORK_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_HOMEWORKS));
        return DEFAULT_SEED_HOMEWORKS;
      }
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return isDemoModeActive() ? DEFAULT_SEED_HOMEWORKS : [];
  }
}

export function submitHomework(submission: Omit<AcademyHomeworkSubmission, "id" | "submittedAt" | "status">): AcademyHomeworkSubmission {
  const newSub: AcademyHomeworkSubmission = {
    ...submission,
    id: "hw-" + Date.now(),
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
  try {
    const list = getHomeworkSubmissions();
    // Replace if already submitted for same student & lesson, else prepend
    const existingIdx = list.findIndex(
      (h) => h.studentEmail === submission.studentEmail && h.lessonId === submission.lessonId
    );
    if (existingIdx >= 0) {
      list[existingIdx] = newSub;
    } else {
      list.unshift(newSub);
    }
    localStorage.setItem(HOMEWORK_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to submit homework:", err);
  }
  return newSub;
}

export function reviewHomework(
  homeworkId: string,
  decision: "approved" | "rejected",
  comment: string,
  reviewerName = "Преподаватель"
): void {
  try {
    const list = getHomeworkSubmissions();
    const item = list.find((h) => h.id === homeworkId);
    if (item) {
      item.status = decision;
      item.reviewerComment = comment;
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = reviewerName;
      localStorage.setItem(HOMEWORK_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.error("Failed to review homework:", err);
  }
}

export function getHomeworkForLessonAndStudent(lessonId: string, studentEmail: string): AcademyHomeworkSubmission | undefined {
  const list = getHomeworkSubmissions();
  return list.find((h) => h.lessonId === lessonId && (h.studentEmail === studentEmail || !studentEmail));
}

export interface AvailableCourseItem {
  id: string;
  title: string;
  description: string;
  url: string;
  lessonsCount?: number;
  badge?: string;
  isDefault?: boolean;
  isFree?: boolean;
  isPermanent?: boolean;
}

export const DEFAULT_PREVENTION_COURSE: AvailableCourseItem = {
  id: "main_prevention_course",
  title: "Базовый курс: Практическая психотерапия и превенция",
  description: "21 структурированная видеолекция, клинические протоколы, интерактивный плеер, проверочные тесты и конспекты для специалиста.",
  url: "https://prevention-ai.ru/course/",
  lessonsCount: 21,
  badge: "🎁 Бесплатно навсегда",
  isDefault: true,
  isFree: true,
  isPermanent: true,
};

const COURSES_STORAGE_KEY = "ida_academy_courses_list_v1";

export function getAvailableCourses(cfg?: { default_course_url?: string | null } | null): AvailableCourseItem[] {
  const effectiveDefaultUrl = cfg?.default_course_url?.trim() || DEFAULT_PREVENTION_COURSE.url;
  try {
    const raw = localStorage.getItem(COURSES_STORAGE_KEY);
    if (!raw) {
      const initial: AvailableCourseItem[] = [
        {
          ...DEFAULT_PREVENTION_COURSE,
          url: effectiveDefaultUrl,
        },
      ];
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    let list: AvailableCourseItem[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) {
      const fallback: AvailableCourseItem[] = [
        {
          ...DEFAULT_PREVENTION_COURSE,
          url: effectiveDefaultUrl,
        },
      ];
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }

    // Гарантия: базовый курс автора всегда присутствует среди доступных курсов
    const defIdx = list.findIndex((c) => c.isDefault || c.id === DEFAULT_PREVENTION_COURSE.id);
    if (defIdx === -1) {
      list.unshift({
        ...DEFAULT_PREVENTION_COURSE,
        url: effectiveDefaultUrl,
      });
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(list));
    } else {
      // Обновляем бейдж и свойства бесплатного постоянного курса
      list[defIdx].isFree = true;
      list[defIdx].isPermanent = true;
      if (!list[defIdx].badge || list[defIdx].badge === "Основной курс") {
        list[defIdx].badge = "🎁 Бесплатно навсегда";
      }
      if (cfg?.default_course_url && cfg.default_course_url.trim()) {
        if (list[defIdx].url !== cfg.default_course_url.trim()) {
          list[defIdx].url = cfg.default_course_url.trim();
          localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(list));
        }
      }
    }

    return list;
  } catch {
    return [
      {
        ...DEFAULT_PREVENTION_COURSE,
        url: effectiveDefaultUrl,
      },
    ];
  }
}

export function saveAvailableCourse(course: AvailableCourseItem): void {
  try {
    const list = getAvailableCourses();
    const idx = list.findIndex((c) => c.id === course.id);
    if (idx >= 0) {
      list[idx] = course;
    } else {
      list.push(course);
    }
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to save course:", err);
  }
}

export function deleteAvailableCourse(courseId: string): void {
  // Защита: базовый курс платформы всегда остается в кабинете
  if (courseId === DEFAULT_PREVENTION_COURSE.id) {
    return;
  }
  try {
    const list = getAvailableCourses();
    const filtered = list.filter((c) => c.id !== courseId);
    // Дополнительная гарантия: базовый курс автора всегда присутствует среди прочих
    const hasDefault = filtered.some((c) => c.isDefault || c.id === DEFAULT_PREVENTION_COURSE.id);
    if (!hasDefault) {
      filtered.unshift({ ...DEFAULT_PREVENTION_COURSE });
    }
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete course:", err);
  }
}

export function updateDefaultCourseUrl(newUrl: string): void {
  const cleanUrl = newUrl.trim() || DEFAULT_PREVENTION_COURSE.url;
  try {
    const list = getAvailableCourses();
    const def = list.find((c) => c.isDefault || c.id === DEFAULT_PREVENTION_COURSE.id);
    if (def) {
      def.url = cleanUrl;
      def.isFree = true;
      def.isPermanent = true;
    } else {
      list.unshift({
        ...DEFAULT_PREVENTION_COURSE,
        url: cleanUrl,
      });
    }
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to update default course url:", err);
  }
}

export function resetCoursesToDefault(defaultUrl?: string): AvailableCourseItem[] {
  const resetList: AvailableCourseItem[] = [
    {
      ...DEFAULT_PREVENTION_COURSE,
      url: defaultUrl?.trim() || DEFAULT_PREVENTION_COURSE.url,
    },
  ];
  try {
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(resetList));
  } catch (err) {
    console.error("Failed to reset courses:", err);
  }
  return resetList;
}

