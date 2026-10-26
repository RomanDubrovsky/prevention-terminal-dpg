import React, { useState, useEffect, useMemo } from "react";
import {
  type CreatorCourse,
  type CreatorLesson,
  type CreatorLessonMaterial,
  type CourseStudent,
  type AcademyEnvironment,
  DEFAULT_COURSES,
  getAcademyEnvironment,
  setAcademyEnvironment,
  loadCreatorCourses,
  loadCourseStudents,
} from "../../lib/course_students_store.ts";
import { ProtectedRecordingPlayer } from "../video/ProtectedRecordingPlayer.tsx";
import { t } from "../../lib/i18n.ts";

interface StudentCourseWorkspaceProps {
  initialCourseId?: string;
  initialLessonId?: string;
  studentCode?: string;
  onOpenPsychologistWorkspace?: () => void;
  onBackToAcademy?: () => void;
}

export default function StudentCourseWorkspace({
  initialCourseId = "course-1",
  initialLessonId,
  studentCode: propStudentCode,
  onOpenPsychologistWorkspace,
  onBackToAcademy,
}: StudentCourseWorkspaceProps) {
  // Theme state: light by default as requested, with persistence
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("ida_student_theme");
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const isDark = theme === "dark";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("ida_student_theme", next);
    } catch {}
  };

  // Student navigation mode: "classroom" (lesson view) | "my_courses" (enrolled courses) | "catalog" (all schools catalog) | "library" (all materials/PDFs)
  const [activeTab, setActiveTab] = useState<"classroom" | "my_courses" | "catalog" | "library">("classroom");

  // Catalog search and filter state
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSchoolFilter, setCatalogSchoolFilter] = useState("all");
  const [catalogTopicFilter, setCatalogTopicFilter] = useState("all");
  const [catalogAccessFilter, setCatalogAccessFilter] = useState<"all" | "free_intro" | "all_access">("all");

  // Current environment: "demo" (sandbox with sample courses) or "live" (production classroom by code)
  const [env, setEnv] = useState<AcademyEnvironment>(() => {
    if (propStudentCode) return "live";
    return getAcademyEnvironment("student");
  });

  const [activeCode, setActiveCode] = useState<string>(() => {
    if (propStudentCode) return propStudentCode;
    try {
      return localStorage.getItem("ida_student_active_code") || "";
    } catch {
      return "";
    }
  });

  const [inputCode, setInputCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [showCodeModal, setShowCodeModal] = useState(false);

  // 1. Load course data
  const [courses, setCourses] = useState<CreatorCourse[]>(() => {
    return loadCreatorCourses(env);
  });
  const [activeCourseId, setActiveCourseId] = useState<string>(initialCourseId);
  const [activeLessonId, setActiveLessonId] = useState<string>(initialLessonId || "");
  const [completedLessonIds, setCompletedLessonIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(env === "demo" ? "ida_student_completed_lessons_demo" : "ida_student_completed_lessons");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Homework answer state
  const [homeworkText, setHomeworkText] = useState("");
  const [homeworkSubmitted, setHomeworkSubmitted] = useState(false);
  const [homeworkHistory, setHomeworkHistory] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("ida_student_homework_answers");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Tab inside classroom lesson: notes | materials | homework
  const [classroomTab, setClassroomTab] = useState<"notes" | "materials" | "homework">("notes");
  const [libraryFilter, setLibraryFilter] = useState("");

  // Switch between demo and live environments
  const handleSwitchEnv = (nextEnv: AcademyEnvironment) => {
    setEnv(nextEnv);
    setAcademyEnvironment("student", nextEnv);
    setCodeError("");
    const loaded = loadCreatorCourses(nextEnv);
    setCourses(loaded.length > 0 ? loaded : (nextEnv === "demo" ? DEFAULT_COURSES : []));
    try {
      const saved = localStorage.getItem(nextEnv === "demo" ? "ida_student_completed_lessons_demo" : "ida_student_completed_lessons");
      setCompletedLessonIds(saved ? JSON.parse(saved) : {});
    } catch {}
  };

  // Reload courses when env changes
  useEffect(() => {
    const loaded = loadCreatorCourses(env);
    if (env === "demo") {
      setCourses(loaded.length > 0 ? loaded : DEFAULT_COURSES);
    } else {
      setCourses(loaded.length > 0 ? loaded : DEFAULT_COURSES);
    }
  }, [env]);

  // Student info from code (in live mode)
  const studentInfo: CourseStudent | null = useMemo(() => {
    if (!activeCode) return null;
    try {
      const all = loadCourseStudents();
      return all.find((s) => s.accessCode.trim().toLowerCase() === activeCode.trim().toLowerCase() || (s.email && s.email.trim().toLowerCase() === activeCode.trim().toLowerCase())) || null;
    } catch {
      return null;
    }
  }, [activeCode]);

  // Check if student has full unlocked access to a course
  const hasCourseAccess = useMemo(() => {
    if (env === "demo") return true;
    if (!activeCode) return false;
    if (studentInfo) {
      if (!studentInfo.courseIds || studentInfo.courseIds.length === 0) return true;
      return studentInfo.courseIds.includes(activeCourseId);
    }
    return Boolean(activeCode);
  }, [env, activeCode, studentInfo, activeCourseId]);

  // Verify and submit access code for live mode
  const handleApplyAccessCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputCode.trim();
    if (!clean) {
      setCodeError("Пожалуйста, введите код доступа или ваш Email");
      return;
    }

    try {
      const all = loadCourseStudents();
      const match = all.find((s) => s.accessCode.trim().toLowerCase() === clean.toLowerCase() || (s.email && s.email.trim().toLowerCase() === clean.toLowerCase()));
      if (match) {
        setActiveCode(match.accessCode);
        setCodeError("");
        setInputCode("");
        setShowCodeModal(false);
        localStorage.setItem("ida_student_active_code", match.accessCode);
        setEnv("live");
        setAcademyEnvironment("student", "live");
        if (match.courseIds && match.courseIds.length > 0) {
          setActiveCourseId(match.courseIds[0]);
        }
        return;
      }
    } catch {}

    // Allow direct access if clean matches a live course id or demo
    const liveCourses = loadCreatorCourses("live");
    const matchedCourse = liveCourses.find((c) => c.id === clean);
    if (matchedCourse) {
      setActiveCode(clean);
      setCodeError("");
      setInputCode("");
      setShowCodeModal(false);
      setEnv("live");
      setActiveCourseId(matchedCourse.id);
      return;
    }

    // Default friendly fallback: activate user with email
    if (clean.includes("@")) {
      setActiveCode(clean);
      setCodeError("");
      setInputCode("");
      setShowCodeModal(false);
      localStorage.setItem("ida_student_active_code", clean);
      return;
    }

    setCodeError("Код доступа не найден. Проверьте ввод или укажите Email, на который оформлен заказ.");
  };

  const handleLogoutCode = () => {
    setActiveCode("");
    try {
      localStorage.removeItem("ida_student_active_code");
    } catch {}
  };

  const activeCourse = useMemo(() => {
    if (env === "demo") {
      return courses.find((c) => c.id === activeCourseId) || courses[0] || DEFAULT_COURSES[0];
    }
    // Live mode
    if (studentInfo && studentInfo.courseIds && studentInfo.courseIds.length > 0) {
      return courses.find((c) => studentInfo.courseIds.includes(c.id)) || courses.find((c) => c.id === activeCourseId) || courses[0] || DEFAULT_COURSES[0];
    }
    return courses.find((c) => c.id === activeCourseId) || courses[0] || DEFAULT_COURSES[0];
  }, [courses, activeCourseId, env, studentInfo]);

  // Default to first lesson if not selected
  useEffect(() => {
    if (activeCourse && activeCourse.lessons && activeCourse.lessons.length > 0) {
      if (!activeLessonId || !activeCourse.lessons.some((l) => l.id === activeLessonId)) {
        setActiveLessonId(activeCourse.lessons[0].id);
      }
    }
  }, [activeCourse, activeLessonId]);

  const activeLesson = useMemo(() => {
    if (!activeCourse) return null;
    return activeCourse.lessons.find((l) => l.id === activeLessonId) || activeCourse.lessons[0] || null;
  }, [activeCourse, activeLessonId]);

  // Is current active lesson accessible by student?
  const isLessonAccessible = useMemo(() => {
    if (env === "demo") return true;
    if (hasCourseAccess) return true;
    if (!activeLesson) return false;
    // Introductory free lessons are accessible to anyone
    if (activeLesson.isFree || activeCourse?.lessons[0]?.id === activeLesson.id) return true;
    return false;
  }, [env, hasCourseAccess, activeLesson, activeCourse]);

  // Save progress
  const toggleLessonCompleted = (lessonId: string) => {
    const next = { ...completedLessonIds, [lessonId]: !completedLessonIds[lessonId] };
    setCompletedLessonIds(next);
    try {
      const key = env === "demo" ? "ida_student_completed_lessons_demo" : "ida_student_completed_lessons";
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  const handleNextLesson = () => {
    if (!activeCourse || !activeLesson) return;
    const idx = activeCourse.lessons.findIndex((l) => l.id === activeLesson.id);
    if (idx >= 0 && idx < activeCourse.lessons.length - 1) {
      toggleLessonCompleted(activeLesson.id);
      setActiveLessonId(activeCourse.lessons[idx + 1].id);
      setHomeworkText("");
      setHomeworkSubmitted(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevLesson = () => {
    if (!activeCourse || !activeLesson) return;
    const idx = activeCourse.lessons.findIndex((l) => l.id === activeLesson.id);
    if (idx > 0) {
      setActiveLessonId(activeCourse.lessons[idx - 1].id);
      setHomeworkText("");
      setHomeworkSubmitted(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmitHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeworkText.trim() || !activeLesson) return;
    const nextAnswers = { ...homeworkHistory, [activeLesson.id]: homeworkText.trim() };
    setHomeworkHistory(nextAnswers);
    try {
      localStorage.setItem("ida_student_homework_answers", JSON.stringify(nextAnswers));
    } catch {}
    setHomeworkSubmitted(true);
    toggleLessonCompleted(activeLesson.id);
  };

  const handleOpenWorkspace = () => {
    try {
      const savedEnrolled = localStorage.getItem("ida_my_enrolled_courses");
      const list = savedEnrolled ? JSON.parse(savedEnrolled) : [];
      if (activeCourse && !list.includes(activeCourse.id)) {
        list.push(activeCourse.id);
        localStorage.setItem("ida_my_enrolled_courses", JSON.stringify(list));
      }
    } catch {}

    if (onOpenPsychologistWorkspace) {
      onOpenPsychologistWorkspace();
    } else {
      window.location.href = "/?tab=academy";
    }
  };

  // Color Theme Tokens (Light theme tuned for readability, Dark theme available via toggle)
  const tColors = useMemo(() => {
    return isDark
      ? {
          bg: "#090d16",
          headerBg: "rgba(11, 18, 34, 0.95)",
          panelBg: "#0b1222",
          cardBg: "#131d31",
          cardHoverBg: "#1a263f",
          border: "rgba(255, 255, 255, 0.08)",
          borderSubtle: "rgba(255, 255, 255, 0.04)",
          textPrimary: "#f8fafc",
          textSecondary: "#94a3b8",
          textMuted: "#64748b",
          accent: "#14b8a6",
          accentHover: "#2dd4bf",
          accentBg: "rgba(20, 184, 166, 0.12)",
          accentBorder: "rgba(20, 184, 166, 0.3)",
          activeItemBg: "rgba(20, 184, 166, 0.16)",
          activeItemBorder: "#14b8a6",
          inputBg: "#0f172a",
          inputBorder: "rgba(255, 255, 255, 0.12)",
          badgeBg: "#1e293b",
          amberBg: "rgba(245, 158, 11, 0.12)",
          amberText: "#fbbf24",
          amberBorder: "rgba(245, 158, 11, 0.3)",
          greenBg: "rgba(16, 185, 129, 0.12)",
          greenText: "#34d399",
          greenBorder: "rgba(16, 185, 129, 0.3)",
        }
      : {
          bg: "#f8fafc",
          headerBg: "rgba(255, 255, 255, 0.95)",
          panelBg: "#ffffff",
          cardBg: "#ffffff",
          cardHoverBg: "#f1f5f9",
          border: "#e2e8f0",
          borderSubtle: "#f1f5f9",
          textPrimary: "#0f172a",
          textSecondary: "#475569",
          textMuted: "#94a3b8",
          accent: "#0f766e",
          accentHover: "#115e59",
          accentBg: "#f0fdfa",
          accentBorder: "#99f6e4",
          activeItemBg: "#f0fdfa",
          activeItemBorder: "#0f766e",
          inputBg: "#ffffff",
          inputBorder: "#cbd5e1",
          badgeBg: "#f1f5f9",
          amberBg: "#fffbeb",
          amberText: "#b45309",
          amberBorder: "#fde68a",
          greenBg: "#f0fdf4",
          greenText: "#15803d",
          greenBorder: "#86efac",
        };
  }, [isDark]);

  // Collect all downloadable materials across all courses
  const allLibraryMaterials = useMemo(() => {
    const list: {
      courseId: string;
      courseTitle: string;
      lessonId: string;
      lessonTitle: string;
      material: CreatorLessonMaterial;
      isFree: boolean;
    }[] = [];

    courses.forEach((c) => {
      c.lessons.forEach((l, idx) => {
        const isFree = Boolean(l.isFree || idx === 0);
        (l.materials || []).forEach((m) => {
          list.push({
            courseId: c.id,
            courseTitle: c.title,
            lessonId: l.id,
            lessonTitle: l.title,
            material: m,
            isFree,
          });
        });
      });
    });

    if (!libraryFilter.trim()) return list;
    const q = libraryFilter.toLowerCase();
    return list.filter(
      (item) =>
        item.material.title.toLowerCase().includes(q) ||
        item.courseTitle.toLowerCase().includes(q) ||
        item.lessonTitle.toLowerCase().includes(q)
    );
  }, [courses, libraryFilter]);

  // List of unique schools in current catalog
  const catalogSchools = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.schoolName) set.add(c.schoolName);
    });
    return Array.from(set);
  }, [courses]);

  // List of unique topics in current catalog
  const catalogTopics = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.topicTag) set.add(c.topicTag);
    });
    return Array.from(set);
  }, [courses]);

  // Filtered courses for the multi-school Catalog view
  const filteredCatalogCourses = useMemo(() => {
    return courses.filter((c) => {
      // School filter
      if (catalogSchoolFilter !== "all" && c.schoolName !== catalogSchoolFilter) {
        return false;
      }
      // Topic filter
      if (catalogTopicFilter !== "all" && c.topicTag !== catalogTopicFilter) {
        return false;
      }
      // Access filter
      if (catalogAccessFilter === "free_intro") {
        const hasFreeIntro = c.lessons.some((l, idx) => l.isFree || idx === 0);
        if (!hasFreeIntro) return false;
      }
      // Search query
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase();
        const inTitle = c.title.toLowerCase().includes(q);
        const inDesc = (c.description || "").toLowerCase().includes(q);
        const inAuthor = (c.authorName || "").toLowerCase().includes(q);
        const inSchool = (c.schoolName || "").toLowerCase().includes(q);
        const inTopic = (c.topicTag || "").toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inAuthor && !inSchool && !inTopic) return false;
      }
      return true;
    });
  }, [courses, catalogSchoolFilter, catalogTopicFilter, catalogAccessFilter, catalogSearch]);

  // Student's enrolled courses (or active courses)
  const myEnrolledCourses = useMemo(() => {
    if (env === "demo") return courses;
    if (studentInfo && studentInfo.courseIds && studentInfo.courseIds.length > 0) {
      return courses.filter((c) => studentInfo.courseIds.includes(c.id));
    }
    return courses.filter((c) => c.id === activeCourseId);
  }, [courses, env, studentInfo, activeCourseId]);

  const currentCourse = activeCourse || DEFAULT_COURSES[0];
  const currentLessonIndex = currentCourse.lessons.findIndex((l) => l.id === activeLesson?.id);
  const totalLessons = currentCourse.lessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((Object.keys(completedLessonIds).length / totalLessons) * 100) : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tColors.bg,
        color: tColors.textPrimary,
        display: "flex",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ─── LEFT SIDEBAR NAVIGATION ───────────────────────────── */}
      <aside
        style={{
          width: "260px",
          minWidth: "260px",
          flexShrink: 0,
          background: tColors.panelBg,
          borderRight: `1px solid ${tColors.border}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          height: "100vh",
          boxSizing: "border-box",
          zIndex: 110,
          boxShadow: isDark ? "4px 0 20px rgba(0,0,0,0.2)" : "2px 0 10px rgba(15,23,42,0.02)",
        }}
      >
        {/* Top Sidebar: Branding & Title */}
        <div style={{ padding: "20px 18px 16px 18px", borderBottom: `1px solid ${tColors.borderSubtle}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                boxShadow: "0 2px 10px rgba(20, 184, 166, 0.3)",
                flexShrink: 0,
              }}
            >
              🎓
            </span>
            <div>
              <div style={{ fontSize: "0.98rem", fontWeight: 800, color: tColors.textPrimary, lineHeight: 1.2 }}>
                Кабинет студента
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    background: env === "demo" ? tColors.amberBg : tColors.greenBg,
                    color: env === "demo" ? tColors.amberText : tColors.greenText,
                    border: `1px solid ${env === "demo" ? tColors.amberBorder : tColors.greenBorder}`,
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  {env === "demo" ? "🧪 Демо-класс" : "💼 Обучение"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Sidebar: Vertical Navigation Links */}
        <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: tColors.textMuted, padding: "0 8px 6px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            МЕНЮ КАБИНЕТА
          </div>

          {/* Tab 1: Класс (Уроки) */}
          <button
            type="button"
            onClick={() => setActiveTab("classroom")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderRadius: "10px",
              border: `1px solid ${activeTab === "classroom" ? tColors.activeItemBorder : "transparent"}`,
              background: activeTab === "classroom" ? tColors.activeItemBg : "transparent",
              color: activeTab === "classroom" ? tColors.accent : tColors.textPrimary,
              fontWeight: activeTab === "classroom" ? 700 : 500,
              fontSize: "0.88rem",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.1rem" }}>🎓</span>
              <span>Класс (Уроки)</span>
            </div>
            {activeTab === "classroom" && (
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: tColors.accent }} />
            )}
          </button>

          {/* Tab 2: Мои курсы */}
          <button
            type="button"
            onClick={() => setActiveTab("my_courses")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderRadius: "10px",
              border: `1px solid ${activeTab === "my_courses" ? tColors.activeItemBorder : "transparent"}`,
              background: activeTab === "my_courses" ? tColors.activeItemBg : "transparent",
              color: activeTab === "my_courses" ? tColors.accent : tColors.textPrimary,
              fontWeight: activeTab === "my_courses" ? 700 : 500,
              fontSize: "0.88rem",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.1rem" }}>📚</span>
              <span>Мои курсы</span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                background: activeTab === "my_courses" ? tColors.accent : (isDark ? "#1e293b" : "#e2e8f0"),
                color: activeTab === "my_courses" ? "#ffffff" : tColors.textSecondary,
                padding: "2px 7px",
                borderRadius: "10px",
              }}
            >
              {myEnrolledCourses.length}
            </span>
          </button>

          {/* Tab 3: Каталог всех школ */}
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderRadius: "10px",
              border: `1px solid ${activeTab === "catalog" ? tColors.activeItemBorder : "transparent"}`,
              background: activeTab === "catalog" ? tColors.activeItemBg : "transparent",
              color: activeTab === "catalog" ? tColors.accent : tColors.textPrimary,
              fontWeight: activeTab === "catalog" ? 700 : 500,
              fontSize: "0.88rem",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.1rem" }}>🌐</span>
              <span>Каталог всех школ</span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                background: activeTab === "catalog" ? tColors.accent : (isDark ? "#1e293b" : "#e2e8f0"),
                color: activeTab === "catalog" ? "#ffffff" : tColors.textSecondary,
                padding: "2px 7px",
                borderRadius: "10px",
              }}
            >
              {courses.length}
            </span>
          </button>

          {/* Tab 4: Библиотека файлов */}
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderRadius: "10px",
              border: `1px solid ${activeTab === "library" ? tColors.activeItemBorder : "transparent"}`,
              background: activeTab === "library" ? tColors.activeItemBg : "transparent",
              color: activeTab === "library" ? tColors.accent : tColors.textPrimary,
              fontWeight: activeTab === "library" ? 700 : 500,
              fontSize: "0.88rem",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.1rem" }}>📎</span>
              <span>Учебные материалы</span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                background: activeTab === "library" ? tColors.accent : (isDark ? "#1e293b" : "#e2e8f0"),
                color: activeTab === "library" ? "#ffffff" : tColors.textSecondary,
                padding: "2px 7px",
                borderRadius: "10px",
              }}
            >
              {allLibraryMaterials.length}
            </span>
          </button>

          {/* Current Active Course Quick Badge in sidebar */}
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "10px",
              background: isDark ? "#131d31" : "#f8fafc",
              border: `1px solid ${tColors.borderSubtle}`,
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: tColors.textMuted, marginBottom: "4px" }}>
              ТЕКУЩИЙ КУРС:
            </div>
            <div style={{ fontSize: "0.84rem", fontWeight: 700, color: tColors.textPrimary, lineHeight: 1.3, marginBottom: "6px" }}>
              {currentCourse.title}
            </div>
            <div style={{ fontSize: "0.75rem", color: tColors.textSecondary }}>
              Урок {currentLessonIndex + 1} из {totalLessons} ({progressPercent}%)
            </div>
          </div>
        </div>

        {/* Bottom Sidebar: Auth Status, Practice button & Theme toggle */}
        <div style={{ padding: "16px 14px", borderTop: `1px solid ${tColors.borderSubtle}`, display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Auth status if logged in */}
          {activeCode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: tColors.greenBg,
                border: `1px solid ${tColors.greenBorder}`,
                borderRadius: "8px",
                padding: "6px 10px",
              }}
            >
              <div style={{ fontSize: "0.78rem", color: tColors.greenText, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ✓ {studentInfo?.fullName || activeCode}
              </div>
              <button
                type="button"
                onClick={handleLogoutCode}
                style={{
                  background: "transparent",
                  border: "none",
                  color: tColors.textMuted,
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  padding: "0 2px",
                }}
                title="Сменить код доступа"
              >
                ✕
              </button>
            </div>
          )}

          {/* Practice workspace button */}
          <button
            type="button"
            onClick={handleOpenWorkspace}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "11px 12px",
              fontSize: "0.86rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)",
              transition: "all 0.15s ease",
            }}
            title="Перейти в интерактивный демо-кабинет психолога IDA"
          >
            <span>💼</span>
            <span>Кабинет психолога (демо)</span>
            <span style={{ opacity: 0.9 }}>→</span>
          </button>

          {/* Bottom controls: Theme & Catalog */}
          <div style={{ display: "flex", gap: "8px" }}>
            {onBackToAcademy && (
              <button
                type="button"
                onClick={onBackToAcademy}
                style={{
                  flex: 1,
                  background: tColors.cardBg,
                  border: `1px solid ${tColors.border}`,
                  color: tColors.textSecondary,
                  padding: "7px 10px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
                title="Вернуться к каталогу курсов"
              >
                <span>📚</span>
                <span>Каталог</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              style={{
                flex: onBackToAcademy ? "0 0 44px" : 1,
                background: tColors.cardBg,
                border: `1px solid ${tColors.border}`,
                color: tColors.textSecondary,
                padding: "7px 10px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
              title={isDark ? "Светлая тема" : "Тёмная тема"}
            >
              <span>{isDark ? "☀️" : "🌙"}</span>
              {!onBackToAcademy && <span>{isDark ? "Светлая" : "Тёмная"}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
        {/* Top Compact Header */}
        <header
          style={{
            background: tColors.headerBg,
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${tColors.border}`,
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 8px rgba(15,23,42,0.03)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.82rem", color: tColors.textSecondary, fontWeight: 600 }}>
                {activeTab === "classroom"
                  ? `Учебный курс: ${currentCourse.schoolName || "Академия IDA"}`
                  : activeTab === "my_courses"
                  ? "Личный кабинет"
                  : activeTab === "catalog"
                  ? "Единая образовательная платформа"
                  : "Учебные материалы"}
              </span>
            </div>
            <h1 style={{ margin: "2px 0 0 0", fontSize: "1.08rem", fontWeight: 800, color: tColors.textPrimary }}>
              {activeTab === "classroom"
                ? currentCourse.title
                : activeTab === "my_courses"
                ? "Мои обучающие программы"
                : activeTab === "catalog"
                ? "Каталог обучающих программ всех школ"
                : "Учебные материалы и файлы"}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <a
              href="https://academy.ida-psy.ru"
              style={{
                background: tColors.cardBg,
                border: `1px solid ${tColors.border}`,
                color: tColors.textPrimary,
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              title="Перейти на главную страницу Академии"
            >
              <span>🌐</span>
              <span>На сайт</span>
            </a>

            {activeTab === "classroom" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: tColors.accentBg,
                  border: `1px solid ${tColors.accentBorder}`,
                  borderRadius: "8px",
                  padding: "4px 10px",
                }}
              >
                <span style={{ fontSize: "0.78rem", color: tColors.accent, fontWeight: 700 }}>
                  Прогресс: {progressPercent}%
                </span>
              </div>
            )}

            {!activeCode ? (
              <button
                type="button"
                onClick={() => setShowCodeModal(true)}
                style={{
                  background: tColors.accentBg,
                  border: `1px solid ${tColors.accentBorder}`,
                  color: tColors.accent,
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>🔑</span>
                <span>Ввести код доступа</span>
              </button>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: tColors.greenBg,
                  border: `1px solid ${tColors.greenBorder}`,
                  color: tColors.greenText,
                  borderRadius: "8px",
                  padding: "5px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                <span>🟢</span>
                <span>{studentInfo?.fullName || activeCode}</span>
                <button
                  type="button"
                  onClick={handleLogoutCode}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: tColors.textMuted,
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "0 2px",
                    marginLeft: "4px",
                  }}
                  title="Выйти / сменить код"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ─── Informational Welcome Banner ─────────────────────────── */}
        {!activeCode && (
          <div
            style={{
              background: isDark ? "rgba(20, 184, 166, 0.08)" : "#f0fdfa",
              borderBottom: `1px solid ${tColors.accentBorder}`,
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.82rem",
              color: tColors.textPrimary,
            }}
          >
            <span style={{ fontSize: "1rem" }}>💡</span>
            <span>
              <strong>Открытые материалы:</strong> вводные уроки доступны бесплатно. Полный доступ ко всем урокам и сертификации активируется по персональному коду.
            </span>
          </div>
        )}

      {/* ─── Modal: Enter Access Code ───────────────────────────── */}
      {showCodeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowCodeModal(false)}
        >
          <div
            style={{
              background: tColors.cardBg,
              border: `1px solid ${tColors.border}`,
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.3rem" }}>🔑</span>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: tColors.textPrimary }}>
                  Вход в кабинет студента
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  color: tColors.textMuted,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.88rem", color: tColors.textSecondary, lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Введите ваш персональный код доступа из письма об оплате (например, <code style={{ color: tColors.accent, fontWeight: 700 }}>st-e9x1</code>) или Email, указанный при покупке.
            </p>

            <form onSubmit={handleApplyAccessCode}>
              <div style={{ marginBottom: "16px" }}>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setCodeError("");
                  }}
                  placeholder="Код доступа (например, st-e9x1) или Email"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: `1px solid ${codeError ? "#ef4444" : tColors.inputBorder}`,
                    background: tColors.inputBg,
                    color: tColors.textPrimary,
                    fontSize: "0.95rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {codeError && (
                  <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "6px 0 0 0", fontWeight: 500 }}>
                    ⚠️ {codeError}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    handleSwitchEnv("demo");
                    setShowCodeModal(false);
                  }}
                  style={{
                    background: "transparent",
                    border: `1px solid ${tColors.accentBorder}`,
                    color: tColors.accent,
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                  title="Открыть демонстрационные курсы без пароля и кодов"
                >
                  🎓 Смотреть демо без кода
                </button>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowCodeModal(false)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${tColors.border}`,
                      color: tColors.textSecondary,
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                    }}
                  >
                    Войти в мои курсы →
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── TAB 1: CLASSROOM (ACTIVE LESSON VIEW) ────────────────── */}
      {activeTab === "classroom" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            maxWidth: "1400px",
            width: "100%",
            margin: "0 auto",
            padding: "16px 12px",
            gap: "20px",
            boxSizing: "border-box",
            flexWrap: "wrap",
          }}
        >
          {/* Main Content Area (Video + Notes + Homework) */}
          <main style={{ flex: "1 1 320px", width: "100%", minWidth: 0, maxWidth: "100%" }}>
            {/* Locked Lesson Gate Warning if user has no access to this specific lesson */}
            {!isLessonAccessible ? (
              <div
                style={{
                  background: tColors.cardBg,
                  borderRadius: "16px",
                  padding: "36px 28px",
                  border: `1px solid ${tColors.border}`,
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: tColors.amberBg,
                    color: tColors.amberText,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.8rem",
                    margin: "0 auto 16px auto",
                  }}
                >
                  🔒
                </div>
                <h2 style={{ margin: "0 0 8px 0", fontSize: "1.3rem", fontWeight: 800, color: tColors.textPrimary }}>
                  Урок доступен по коду доступа
                </h2>
                <p style={{ margin: "0 auto 20px auto", maxWidth: "520px", color: tColors.textSecondary, fontSize: "0.92rem", lineHeight: 1.6 }}>
                  Этот урок входит в платную программу курса <strong>«{currentCourse.title}»</strong>. Для просмотра видео, конспекта и отправки домашних заданий активируйте ваш персональный код доступа из письма об оплате.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSwitchEnv("demo");
                    }}
                    style={{
                      background: "transparent",
                      border: `1.5px solid ${tColors.accentBorder}`,
                      color: tColors.accent,
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                    }}
                    title="Переключить на демонстрационный режим, где все уроки открыты без кода"
                  >
                    🎓 Открыть демо-доступ без кода
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCodeModal(true)}
                    style={{
                      background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 22px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(20, 184, 166, 0.3)",
                    }}
                  >
                    🔑 Ввести код доступа
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const firstFree = currentCourse.lessons.find((l, i) => l.isFree || i === 0);
                      if (firstFree) setActiveLessonId(firstFree.id);
                    }}
                    style={{
                      background: tColors.cardBg,
                      border: `1px solid ${tColors.border}`,
                      color: tColors.textSecondary,
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                    }}
                  >
                    ← Смотреть открытый урок
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Video Player Box */}
                {activeLesson?.videoUrl ? (
                  <div
                    style={{
                      background: "#000000",
                      borderRadius: "16px",
                      overflow: "hidden",
                      marginBottom: "20px",
                      border: `1px solid ${tColors.border}`,
                      boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.6)" : "0 4px 20px rgba(15,23,42,0.1)",
                      position: "relative",
                    }}
                  >
                    <video
                      src={activeLesson.videoUrl}
                      controls
                      controlsList="nodownload"
                      style={{ width: "100%", maxHeight: "540px", display: "block" }}
                    />
                    {/* Watermark Protection overlay */}
                    <div
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        background: "rgba(15, 23, 42, 0.75)",
                        backdropFilter: "blur(6px)",
                        color: "rgba(255, 255, 255, 0.8)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        pointerEvents: "none",
                        letterSpacing: "0.5px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      🛡️ IDA Protected · {studentInfo?.fullName || "Лицензионный просмотр"}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: tColors.cardBg,
                      borderRadius: "16px",
                      padding: "32px",
                      marginBottom: "20px",
                      border: `1px solid ${tColors.border}`,
                      textAlign: "center",
                      color: tColors.textSecondary,
                    }}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📖</div>
                    <h3 style={{ margin: "0 0 6px 0", color: tColors.textPrimary }}>Теоретический и практический урок</h3>
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>Видеозапись к данному уроку не прикреплена. Ознакомьтесь с конспектом и материалами ниже.</p>
                  </div>
                )}

                {/* Lesson Navigation Toolbar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "24px",
                    background: tColors.cardBg,
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: `1px solid ${tColors.border}`,
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => activeLesson && toggleLessonCompleted(activeLesson.id)}
                      style={{
                        background: activeLesson && completedLessonIds[activeLesson.id] ? tColors.greenBg : tColors.panelBg,
                        color: activeLesson && completedLessonIds[activeLesson.id] ? tColors.greenText : tColors.textSecondary,
                        border: `1px solid ${activeLesson && completedLessonIds[activeLesson.id] ? tColors.greenBorder : tColors.border}`,
                        padding: "7px 14px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{activeLesson && completedLessonIds[activeLesson.id] ? "✓" : "○"}</span>
                      <span>{activeLesson && completedLessonIds[activeLesson.id] ? "Пройден" : "Отметить пройденным"}</span>
                    </button>
                    {activeLesson?.duration && (
                      <span style={{ fontSize: "0.82rem", color: tColors.textMuted }}>
                        ⏱ {activeLesson.duration}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handlePrevLesson}
                      disabled={currentLessonIndex <= 0}
                      style={{
                        background: tColors.cardBg,
                        border: `1px solid ${tColors.border}`,
                        color: currentLessonIndex <= 0 ? tColors.textMuted : tColors.textPrimary,
                        padding: "7px 14px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: currentLessonIndex <= 0 ? "not-allowed" : "pointer",
                        opacity: currentLessonIndex <= 0 ? 0.5 : 1,
                      }}
                    >
                      ← Предыдущий урок
                    </button>
                    <button
                      type="button"
                      onClick={handleNextLesson}
                      disabled={currentLessonIndex >= totalLessons - 1}
                      style={{
                        background: currentLessonIndex >= totalLessons - 1 ? tColors.cardBg : tColors.accent,
                        border: `1px solid ${currentLessonIndex >= totalLessons - 1 ? tColors.border : tColors.accent}`,
                        color: currentLessonIndex >= totalLessons - 1 ? tColors.textMuted : "#ffffff",
                        padding: "7px 16px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: currentLessonIndex >= totalLessons - 1 ? "not-allowed" : "pointer",
                        opacity: currentLessonIndex >= totalLessons - 1 ? 0.5 : 1,
                      }}
                    >
                      Следующий урок →
                    </button>
                  </div>
                </div>

                {/* Structured Lesson Tabs (Notes / Materials / Homework) */}
                <div
                  style={{
                    background: tColors.cardBg,
                    borderRadius: "16px",
                    border: `1px solid ${tColors.border}`,
                    overflow: "hidden",
                    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(15,23,42,0.03)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      borderBottom: `1px solid ${tColors.border}`,
                      background: isDark ? "#0e1626" : "#f8fafc",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setClassroomTab("notes")}
                      style={{
                        flex: 1,
                        padding: "14px 16px",
                        border: "none",
                        background: classroomTab === "notes" ? tColors.cardBg : "transparent",
                        borderBottom: classroomTab === "notes" ? `2px solid ${tColors.accent}` : "2px solid transparent",
                        color: classroomTab === "notes" ? tColors.accent : tColors.textSecondary,
                        fontWeight: classroomTab === "notes" ? 700 : 500,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <span>📝</span>
                      <span>Конспект урока</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassroomTab("materials")}
                      style={{
                        flex: 1,
                        padding: "14px 16px",
                        border: "none",
                        background: classroomTab === "materials" ? tColors.cardBg : "transparent",
                        borderBottom: classroomTab === "materials" ? `2px solid ${tColors.accent}` : "2px solid transparent",
                        color: classroomTab === "materials" ? tColors.accent : tColors.textSecondary,
                        fontWeight: classroomTab === "materials" ? 700 : 500,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <span>📎</span>
                      <span>Материалы ({activeLesson?.materials?.length || 0})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassroomTab("homework")}
                      style={{
                        flex: 1,
                        padding: "14px 16px",
                        border: "none",
                        background: classroomTab === "homework" ? tColors.cardBg : "transparent",
                        borderBottom: classroomTab === "homework" ? `2px solid ${tColors.accent}` : "2px solid transparent",
                        color: classroomTab === "homework" ? tColors.accent : tColors.textSecondary,
                        fontWeight: classroomTab === "homework" ? 700 : 500,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <span>✍️</span>
                      <span>Домашнее задание</span>
                      {activeLesson && homeworkHistory[activeLesson.id] && (
                        <span style={{ fontSize: "0.72rem", background: tColors.greenBg, color: tColors.greenText, padding: "1px 6px", borderRadius: "10px", fontWeight: 700 }}>
                          Сдано
                        </span>
                      )}
                    </button>
                  </div>

                  <div style={{ padding: "24px" }}>
                    {/* Sub-Tab 1: Notes */}
                    {classroomTab === "notes" && (
                      <div style={{ lineHeight: 1.7, fontSize: "0.95rem", color: tColors.textPrimary }}>
                        {activeLesson?.notes ? (
                          <div style={{ whiteSpace: "pre-line" }}>
                            {activeLesson.notes}
                          </div>
                        ) : (
                          <p style={{ color: tColors.textMuted }}>К данному уроку нет текстового конспекта.</p>
                        )}
                      </div>
                    )}

                    {/* Sub-Tab 2: Materials */}
                    {classroomTab === "materials" && (
                      <div>
                        {activeLesson?.materials && activeLesson.materials.length > 0 ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
                            {activeLesson.materials.map((m) => (
                              <div
                                key={m.id}
                                style={{
                                  background: tColors.cardHoverBg,
                                  border: `1px solid ${tColors.border}`,
                                  borderRadius: "10px",
                                  padding: "14px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: tColors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    📄 {m.title}
                                  </div>
                                  {m.fileSize && (
                                    <div style={{ fontSize: "0.76rem", color: tColors.textMuted, marginTop: "2px" }}>
                                      Размер: {m.fileSize}
                                    </div>
                                  )}
                                </div>
                                <a
                                  href={m.url || "#"}
                                  download={m.title}
                                  onClick={(e) => {
                                    if (!m.url || m.url === "#") {
                                      e.preventDefault();
                                      alert(`Файл «${m.title}» готов к скачиванию в личном кабинете студента.`);
                                    }
                                  }}
                                  style={{
                                    background: tColors.cardBg,
                                    border: `1px solid ${tColors.border}`,
                                    color: tColors.accent,
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    flexShrink: 0,
                                  }}
                                >
                                  Скачать ↓
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: tColors.textMuted, margin: 0 }}>К данному уроку нет прикрепленных файлов.</p>
                        )}
                      </div>
                    )}

                    {/* Sub-Tab 3: Homework */}
                    {classroomTab === "homework" && (
                      <div>
                        {activeLesson?.assignment ? (
                          <div>
                            <div
                              style={{
                                background: isDark ? "rgba(20, 184, 166, 0.08)" : "#f0fdfa",
                                border: `1px solid ${tColors.accentBorder}`,
                                borderRadius: "10px",
                                padding: "16px",
                                marginBottom: "20px",
                              }}
                            >
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: tColors.accent, marginBottom: "4px" }}>
                                ЗАДАНИЕ К УРОКУ:
                              </div>
                              <div style={{ fontSize: "0.94rem", color: tColors.textPrimary, lineHeight: 1.5 }}>
                                {activeLesson.assignment}
                              </div>
                            </div>

                            <form onSubmit={handleSubmitHomework}>
                              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "8px", color: tColors.textPrimary }}>
                                Ваш ответ и практический отчет:
                              </label>
                              <textarea
                                value={homeworkText || (activeLesson ? homeworkHistory[activeLesson.id] || "" : "")}
                                onChange={(e) => {
                                  setHomeworkText(e.target.value);
                                  setHomeworkSubmitted(false);
                                }}
                                rows={6}
                                placeholder="Напишите ваш ответ, разбор ситуации или прикрепите ссылку на отчет..."
                                style={{
                                  width: "100%",
                                  padding: "12px 14px",
                                  borderRadius: "10px",
                                  border: `1px solid ${tColors.inputBorder}`,
                                  background: tColors.inputBg,
                                  color: tColors.textPrimary,
                                  fontSize: "0.92rem",
                                  lineHeight: 1.5,
                                  outline: "none",
                                  boxSizing: "border-box",
                                  marginBottom: "14px",
                                }}
                              />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                                <div>
                                  {homeworkSubmitted && (
                                    <span style={{ color: tColors.greenText, fontWeight: 700, fontSize: "0.88rem" }}>
                                      ✓ Ответ успешно отправлен преподавателю!
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="submit"
                                  style={{
                                    background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                                    color: "#ffffff",
                                    border: "none",
                                    padding: "9px 20px",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "0.88rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Отправить на проверку →
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <p style={{ color: tColors.textMuted, margin: 0 }}>В этом уроке нет обязательного домашнего задания.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>

          {/* Sidebar: Course Syllabus (Lessons Tree) */}
          <aside style={{ flex: "1 1 320px", width: "100%", minWidth: 0, maxWidth: "100%" }}>
            <div
              style={{
                background: tColors.cardBg,
                borderRadius: "16px",
                border: `1px solid ${tColors.border}`,
                padding: "20px",
                position: "sticky",
                top: "84px",
                boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(15,23,42,0.03)",
              }}
            >
              {/* Progress Summary */}
              <div style={{ marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: tColors.textSecondary }}>
                    ПРОГРЕСС КУРСА
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: tColors.accent }}>
                    {progressPercent}%
                  </span>
                </div>
                <div style={{ height: "6px", background: isDark ? "#1e293b" : "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPercent}%`,
                      background: "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)",
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              <h3 style={{ margin: "0 0 14px 0", fontSize: "0.95rem", fontWeight: 800, color: tColors.textPrimary }}>
                Программа курса ({currentCourse.lessons.length} уроков)
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {currentCourse.lessons.map((lesson, idx) => {
                  const isActive = lesson.id === activeLesson?.id;
                  const isDone = Boolean(completedLessonIds[lesson.id]);
                  const isLessonFree = Boolean(lesson.isFree || idx === 0);

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => {
                        setActiveLessonId(lesson.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      style={{
                        background: isActive ? tColors.activeItemBg : tColors.cardBg,
                        border: `1px solid ${isActive ? tColors.activeItemBorder : tColors.border}`,
                        borderRadius: "10px",
                        padding: "10px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: isDone ? tColors.greenBg : tColors.badgeBg,
                          color: isDone ? tColors.greenText : tColors.textMuted,
                          border: `1px solid ${isDone ? tColors.greenBorder : tColors.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? "✓" : idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.86rem",
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? tColors.accent : tColors.textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {lesson.title}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          {isLessonFree ? (
                            <span style={{ fontSize: "0.7rem", color: tColors.greenText, fontWeight: 700 }}>
                              🔓 Бесплатно
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.7rem", color: hasCourseAccess ? tColors.textMuted : tColors.amberText, fontWeight: 600 }}>
                              {hasCourseAccess ? "🔒 По коду" : "🔒 Закрыт"}
                            </span>
                          )}
                          {lesson.duration && (
                            <span style={{ fontSize: "0.7rem", color: tColors.textMuted }}>
                              • {lesson.duration}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Course switch prompt */}
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: `1px solid ${tColors.border}`,
                  textAlign: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("my_courses")}
                  style={{
                    background: tColors.cardHoverBg,
                    border: `1px solid ${tColors.border}`,
                    color: tColors.textSecondary,
                    padding: "7px 14px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  📚 Все мои курсы ({courses.length}) →
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ─── TAB 2: MY COURSES (ENROLLED COURSES) ───────────────────── */}
      {activeTab === "my_courses" && (
        <div
          style={{
            flex: 1,
            maxWidth: "1200px",
            width: "100%",
            margin: "0 auto",
            padding: "32px 24px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px 0", color: tColors.textPrimary }}>
                📚 Ваши обучающие программы ({myEnrolledCourses.length})
              </h2>
              <p style={{ margin: 0, fontSize: "0.92rem", color: tColors.textSecondary }}>
                Курсы, к которым у вас есть доступ по вашему персональному коду или Email.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("catalog")}
              style={{
                background: tColors.accentBg,
                color: tColors.accent,
                border: `1px solid ${tColors.accentBorder}`,
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🌐</span>
              <span>Открыть каталог всех школ ({courses.length}) →</span>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
            {myEnrolledCourses.map((c) => {
              const isSelected = c.id === activeCourseId;
              const lessonCount = c.lessons.length;
              const freeLessonsCount = c.lessons.filter((l, idx) => l.isFree || idx === 0).length;

              return (
                <div
                  key={c.id}
                  style={{
                    background: tColors.cardBg,
                    border: `1px solid ${isSelected ? tColors.activeItemBorder : tColors.border}`,
                    borderRadius: "16px",
                    padding: "24px",
                    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(15,23,42,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {c.schoolName && (
                          <span
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              background: isDark ? "#1e293b" : "#f1f5f9",
                              color: tColors.textSecondary,
                              padding: "3px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            🏫 {c.schoolName}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            background: tColors.accentBg,
                            color: tColors.accent,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: `1px solid ${tColors.accentBorder}`,
                          }}
                        >
                          {c.topicTag || "Психология"}
                        </span>
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: "0.74rem", fontWeight: 700, color: tColors.greenText, whiteSpace: "nowrap" }}>
                          ● Текущий курс
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: "0 0 8px 0", fontSize: "1.15rem", fontWeight: 800, color: tColors.textPrimary, lineHeight: 1.4 }}>
                      {c.title}
                    </h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: "0.88rem", color: tColors.textSecondary, lineHeight: 1.5 }}>
                      {c.description}
                    </p>

                    <div style={{ display: "flex", gap: "12px", fontSize: "0.82rem", color: tColors.textMuted, marginBottom: "16px", flexWrap: "wrap" }}>
                      <span>📖 {lessonCount} уроков</span>
                      <span>🔓 {freeLessonsCount} открытых</span>
                      {c.authorName && <span>👤 {c.authorName}</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${tColors.border}` }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCourseId(c.id);
                        if (c.lessons.length > 0) setActiveLessonId(c.lessons[0].id);
                        setActiveTab("classroom");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      style={{
                        flex: 1,
                        background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        cursor: "pointer",
                      }}
                    >
                      Перейти к урокам →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: GLOBAL MULTI-SCHOOL CATALOG ───────────────────────── */}
      {activeTab === "catalog" && (
        <div
          style={{
            flex: 1,
            maxWidth: "1200px",
            width: "100%",
            margin: "0 auto",
            padding: "32px 24px",
            boxSizing: "border-box",
          }}
        >
          {/* Catalog Header */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: tColors.accentBg, border: `1px solid ${tColors.accentBorder}`, color: tColors.accent, padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 700, marginBottom: "8px" }}>
              🌐 ЕДИНЫЙ КАТАЛОГ ПЛАТФОРМЫ
            </div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 6px 0", color: tColors.textPrimary }}>
              Каталог обучающих программ всех школ
            </h2>
            <p style={{ margin: 0, fontSize: "0.92rem", color: tColors.textSecondary }}>
              Все аккредитованные курсы от Академии IDA, Prevention School, Teenology и школ-партнеров. Вводные уроки открыты для ознакомления сразу.
            </p>
          </div>

          {/* Search & Filters Controls */}
          <div
            style={{
              background: tColors.cardBg,
              borderRadius: "16px",
              border: `1px solid ${tColors.border}`,
              padding: "20px",
              marginBottom: "28px",
              boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.15)" : "0 2px 10px rgba(15,23,42,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Top search input */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="🔍 Поиск по названию курса, автору, школе или методике..."
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${tColors.inputBorder}`,
                  background: tColors.inputBg,
                  color: tColors.textPrimary,
                  fontSize: "0.94rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch("")}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: tColors.textMuted,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Row 1: School Selector */}
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: tColors.textMuted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                🏫 Школа / Учебный центр:
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setCatalogSchoolFilter("all")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: catalogSchoolFilter === "all" ? 700 : 500,
                    border: `1px solid ${catalogSchoolFilter === "all" ? tColors.accentBorder : tColors.border}`,
                    background: catalogSchoolFilter === "all" ? tColors.accentBg : tColors.cardBg,
                    color: catalogSchoolFilter === "all" ? tColors.accent : tColors.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  Все школы ({courses.length})
                </button>
                {catalogSchools.map((sch) => {
                  const count = courses.filter((c) => c.schoolName === sch).length;
                  const isSelected = catalogSchoolFilter === sch;
                  return (
                    <button
                      key={sch}
                      type="button"
                      onClick={() => setCatalogSchoolFilter(sch)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.82rem",
                        fontWeight: isSelected ? 700 : 500,
                        border: `1px solid ${isSelected ? tColors.accentBorder : tColors.border}`,
                        background: isSelected ? tColors.accentBg : tColors.cardBg,
                        color: isSelected ? tColors.accent : tColors.textSecondary,
                        cursor: "pointer",
                      }}
                    >
                      {sch} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Row 2: Direction / Topic Selector & Access Filter */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: tColors.textMuted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🎯 Направление и специализация:
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setCatalogTopicFilter("all")}
                    style={{
                      padding: "5px 11px",
                      borderRadius: "7px",
                      fontSize: "0.8rem",
                      fontWeight: catalogTopicFilter === "all" ? 700 : 500,
                      border: `1px solid ${catalogTopicFilter === "all" ? tColors.accentBorder : tColors.border}`,
                      background: catalogTopicFilter === "all" ? tColors.accentBg : tColors.cardBg,
                      color: catalogTopicFilter === "all" ? tColors.accent : tColors.textSecondary,
                      cursor: "pointer",
                    }}
                  >
                    Все темы
                  </button>
                  {catalogTopics.map((top) => {
                    const count = courses.filter((c) => c.topicTag === top).length;
                    const isSelected = catalogTopicFilter === top;
                    return (
                      <button
                        key={top}
                        type="button"
                        onClick={() => setCatalogTopicFilter(top)}
                        style={{
                          padding: "5px 11px",
                          borderRadius: "7px",
                          fontSize: "0.8rem",
                          fontWeight: isSelected ? 700 : 500,
                          border: `1px solid ${isSelected ? tColors.accentBorder : tColors.border}`,
                          background: isSelected ? tColors.accentBg : tColors.cardBg,
                          color: isSelected ? tColors.accent : tColors.textSecondary,
                          cursor: "pointer",
                        }}
                      >
                        {top} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: tColors.textMuted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🔓 Доступность:
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setCatalogAccessFilter("all")}
                    style={{
                      padding: "5px 11px",
                      borderRadius: "7px",
                      fontSize: "0.8rem",
                      fontWeight: catalogAccessFilter === "all" ? 700 : 500,
                      border: `1px solid ${catalogAccessFilter === "all" ? tColors.accentBorder : tColors.border}`,
                      background: catalogAccessFilter === "all" ? tColors.accentBg : tColors.cardBg,
                      color: catalogAccessFilter === "all" ? tColors.accent : tColors.textSecondary,
                      cursor: "pointer",
                    }}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogAccessFilter("free_intro")}
                    style={{
                      padding: "5px 11px",
                      borderRadius: "7px",
                      fontSize: "0.8rem",
                      fontWeight: catalogAccessFilter === "free_intro" ? 700 : 500,
                      border: `1px solid ${catalogAccessFilter === "free_intro" ? tColors.greenBorder : tColors.border}`,
                      background: catalogAccessFilter === "free_intro" ? tColors.greenBg : tColors.cardBg,
                      color: catalogAccessFilter === "free_intro" ? tColors.greenText : tColors.textSecondary,
                      cursor: "pointer",
                    }}
                  >
                    🔓 С бесплатным уроком
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: tColors.textSecondary }}>
              Найдено программ: <strong style={{ color: tColors.textPrimary }}>{filteredCatalogCourses.length}</strong>
            </span>
            {(catalogSearch || catalogSchoolFilter !== "all" || catalogTopicFilter !== "all" || catalogAccessFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch("");
                  setCatalogSchoolFilter("all");
                  setCatalogTopicFilter("all");
                  setCatalogAccessFilter("all");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: tColors.accent,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>

          {/* Catalog Grid */}
          {filteredCatalogCourses.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "24px" }}>
              {filteredCatalogCourses.map((c) => {
                const lessonCount = c.lessons.length;
                const freeLessonsCount = c.lessons.filter((l, idx) => l.isFree || idx === 0).length;
                const isSelected = c.id === activeCourseId;

                return (
                  <div
                    key={c.id}
                    style={{
                      background: tColors.cardBg,
                      border: `1px solid ${isSelected ? tColors.activeItemBorder : tColors.border}`,
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(15,23,42,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              background: isDark ? "#1e293b" : "#f1f5f9",
                              color: tColors.textSecondary,
                              padding: "3px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            🏫 {c.schoolName || "Академия IDA"}
                          </span>
                          <span
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              background: tColors.accentBg,
                              color: tColors.accent,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              border: `1px solid ${tColors.accentBorder}`,
                            }}
                          >
                            {c.topicTag || "Психология"}
                          </span>
                        </div>
                        {freeLessonsCount > 0 && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              background: tColors.greenBg,
                              color: tColors.greenText,
                              border: `1px solid ${tColors.greenBorder}`,
                              padding: "2px 6px",
                              borderRadius: "5px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🔓 Вводный урок открыт
                          </span>
                        )}
                      </div>

                      {/* Course Title */}
                      <h3 style={{ margin: "0 0 8px 0", fontSize: "1.18rem", fontWeight: 800, color: tColors.textPrimary, lineHeight: 1.4 }}>
                        {c.title}
                      </h3>

                      {/* Description */}
                      <p style={{ margin: "0 0 16px 0", fontSize: "0.88rem", color: tColors.textSecondary, lineHeight: 1.5 }}>
                        {c.description}
                      </p>

                      {/* Author & Stats */}
                      <div style={{ background: isDark ? "#0f172a" : "#f8fafc", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px", border: `1px solid ${tColors.borderSubtle}` }}>
                        {c.authorName && (
                          <div style={{ fontSize: "0.84rem", fontWeight: 600, color: tColors.textPrimary, marginBottom: "4px" }}>
                            👤 Преподаватель: {c.authorName}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", color: tColors.textMuted }}>
                          <span>📖 {lessonCount} уроков</span>
                          <span>•</span>
                          <span>🧪 Практические задания</span>
                          <span>•</span>
                          <span>📄 Методички</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "10px", paddingTop: "14px", borderTop: `1px solid ${tColors.border}`, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCourseId(c.id);
                          if (c.lessons.length > 0) setActiveLessonId(c.lessons[0].id);
                          setActiveTab("classroom");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        style={{
                          flex: 1,
                          minWidth: "160px",
                          background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                          color: "#ffffff",
                          border: "none",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          fontWeight: 700,
                          fontSize: "0.86rem",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <span>▶</span>
                        <span>{freeLessonsCount > 0 ? "Смотреть урок 1 (Бесплатно)" : "Открыть курс"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                background: tColors.cardBg,
                borderRadius: "16px",
                border: `1px solid ${tColors.border}`,
                padding: "48px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔍</div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 700, color: tColors.textPrimary }}>
                По вашему запросу курсов не найдено
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "0.88rem", color: tColors.textSecondary }}>
                Попробуйте изменить поисковый запрос или сбросить фильтры по школам и направлениям.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch("");
                  setCatalogSchoolFilter("all");
                  setCatalogTopicFilter("all");
                  setCatalogAccessFilter("all");
                }}
                style={{
                  background: tColors.accentBg,
                  color: tColors.accent,
                  border: `1px solid ${tColors.accentBorder}`,
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                }}
              >
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: ALL MATERIALS & DOWNLOADS LIBRARY ───────────── */}
      {activeTab === "library" && (
        <div
          style={{
            flex: 1,
            maxWidth: "1200px",
            width: "100%",
            margin: "0 auto",
            padding: "32px 24px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px 0", color: tColors.textPrimary }}>
              📎 Учебные материалы курсов и файлы
            </h2>
            <p style={{ margin: 0, fontSize: "0.92rem", color: tColors.textSecondary }}>
              Все учебные бланки согласий, протоколы, чек-листы и презентации из ваших курсов в одном месте.
            </p>
          </div>

          {/* Search filter input */}
          <div style={{ marginBottom: "20px" }}>
            <input
              type="text"
              value={libraryFilter}
              onChange={(e) => setLibraryFilter(e.target.value)}
              placeholder="🔍 Поиск материалов по названию или курсу..."
              style={{
                width: "100%",
                maxWidth: "460px",
                padding: "10px 14px",
                borderRadius: "10px",
                border: `1px solid ${tColors.inputBorder}`,
                background: tColors.inputBg,
                color: tColors.textPrimary,
                fontSize: "0.92rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ background: tColors.cardBg, borderRadius: "16px", border: `1px solid ${tColors.border}`, overflow: "hidden" }}>
            {allLibraryMaterials.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {allLibraryMaterials.map((item, idx) => (
                  <div
                    key={`${item.courseId}-${item.lessonId}-${item.material.id}-${idx}`}
                    style={{
                      padding: "16px 20px",
                      borderBottom: idx < allLibraryMaterials.length - 1 ? `1px solid ${tColors.border}` : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.94rem", color: tColors.textPrimary, marginBottom: "3px" }}>
                        📄 {item.material.title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: tColors.textSecondary, display: "flex", gap: "10px" }}>
                        <span>📚 {item.courseTitle}</span>
                        <span>•</span>
                        <span>Урок: {item.lessonTitle}</span>
                        {item.material.fileSize && <span>• {item.material.fileSize}</span>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCourseId(item.courseId);
                          setActiveLessonId(item.lessonId);
                          setClassroomTab("materials");
                          setActiveTab("classroom");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        style={{
                          background: tColors.panelBg,
                          border: `1px solid ${tColors.border}`,
                          color: tColors.textSecondary,
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        К уроку →
                      </button>
                      <a
                        href={item.material.url || "#"}
                        download={item.material.title}
                        onClick={(e) => {
                          if (!item.material.url || item.material.url === "#") {
                            e.preventDefault();
                            alert(`Файл «${item.material.title}» готов к скачиванию.`);
                          }
                        }}
                        style={{
                          background: tColors.accent,
                          color: "#ffffff",
                          padding: "6px 14px",
                          borderRadius: "6px",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        Скачать ↓
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: tColors.textMuted }}>
                Материалы не найдены.
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
