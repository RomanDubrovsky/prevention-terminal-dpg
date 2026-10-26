export interface AcademyCustomLesson {
  id: string;
  moduleId: string | number;
  moduleTitle: string;
  title: string;
  tag: string;
  videoUrl?: string;
  recordingId?: string;
  summaryText?: string;
  homeworkTask?: string;
  isStopLesson?: boolean;
  dripDaysAfterStart?: number;
  timecodes?: { time: string; title: string; seconds: number }[];
  materials?: { name: string; url: string; size?: string }[];
  createdAt: string;
}

const STORAGE_KEY = "ida_academy_custom_lessons_v1";

export function getCustomAcademyLessons(): AcademyCustomLesson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomAcademyLesson(lesson: AcademyCustomLesson): void {
  try {
    const list = getCustomAcademyLessons();
    const existingIdx = list.findIndex((l) => l.id === lesson.id);
    if (existingIdx >= 0) {
      list[existingIdx] = lesson;
    } else {
      list.unshift(lesson);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to save academy custom lesson:", err);
  }
}

export function deleteCustomAcademyLesson(id: string): void {
  try {
    const list = getCustomAcademyLessons().filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Failed to delete academy custom lesson:", err);
  }
}
