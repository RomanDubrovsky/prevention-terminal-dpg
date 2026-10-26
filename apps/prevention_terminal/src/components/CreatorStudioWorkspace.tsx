import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  loadWebinars,
  saveWebinars,
  deleteWebinar as removeStoredWebinar,
  type WebinarItem,
  type CloudRecording,
  type VideoTrimSettings,
  type RecordingMonetization,
  updateRecordingTrim,
  updateRecordingMonetization,
  calculateCleanDurationMinutes,
  generateRecordingShareLink,
  generateWebinarLinks,
} from "../lib/webinars_store.ts";
import VideoSmartTrimModal from "./video/VideoSmartTrimModal.tsx";
import RecordingMonetizationModal from "./video/RecordingMonetizationModal.tsx";
import ProtectedRecordingPlayer from "./video/ProtectedRecordingPlayer.tsx";
import VideoProtectionModal, { type VideoProtectionSettings } from "./video/VideoProtectionModal.tsx";
import CertificateGeneratorModal from "./certificates/CertificateGeneratorModal.tsx";
import SupportFeedbackSection from "./SupportFeedbackSection.tsx";
import {
  AcademyAfishaGenerator,
  PSYCHOLOGY_TOPICS,
  getTopicDisplayLabel,
} from "./academy/AcademyAfishaWidget.tsx";
import SitePagesManager from "./academy/SitePagesManager.tsx";
import { downloadStandaloneHtmlFile } from "../lib/export_standalone_html.ts";
import { loadSchoolSettings, loadSitePages } from "../lib/site_pages_store.ts";
import { isDemoModeActive } from "../lib/staging_demo_seed.ts";
import UserAccountMenu from "./UserAccountMenu.tsx";
import {
  type CourseStudent,
  loadCourseStudents,
  saveCourseStudents,
  generateAccessCode,
  buildStudentLink,
  exportStudentsToExcel,
  downloadStudentsTemplateCsv,
  parseStudentsSpreadsheet,
  isStudentPaidForWebinar,
  getAcademyEnvironment,
  setAcademyEnvironment,
  loadCreatorCourses,
  saveCreatorCourses,
  resetCreatorCoursesDemo,
  importDemoCoursesToLive,
  DEFAULT_COURSES,
  type AcademyEnvironment,
} from "../lib/course_students_store.ts";

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

export interface DiskQuotaInfo {
  supported: boolean;
  freeBytes: number;
  totalBytes: number;
  freeGb: number;
  totalGb: number;
  isLowSpace: boolean; // < 2 GB
}

interface CreatorStudioWorkspaceProps {
  onLaunchStudio?: (roomName: string) => void;
  onNavigateToSpecialist?: () => void;
}

type StudioView =
  | { type: "overview" }
  | { type: "quick_live" }
  | { type: "webinar"; id: string }
  | { type: "course"; courseId: string; lessonId?: string }
  | { type: "students" }
  | { type: "afisha"; singleItemId?: string }
  | { type: "pages"; pageId?: string }
  | { type: "feedback" };

const COURSES_STORAGE_KEY = "ida_creator_courses_v3";
const WEBINARS_STORAGE_KEY = "ida_creator_webinars_v2";
const THEME_STORAGE_KEY = "ida_creator_theme";
const QUICK_ROOM_KEY = "ida_creator_quick_room";

export function TopicFieldEditor({
  value = "cbt_anxiety",
  onChange,
  theme: t,
  label = "Психологическое направление",
}: {
  value?: string;
  onChange: (val: string) => void;
  theme: any;
  label?: string;
}) {
  const isKnown = PSYCHOLOGY_TOPICS.some((tp) => tp.id !== "all" && tp.id === value);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isKnown && Boolean(value && value !== "all"));
  const [customText, setCustomText] = useState<string>(!isKnown && value ? value : "");

  useEffect(() => {
    const known = PSYCHOLOGY_TOPICS.some((tp) => tp.id !== "all" && tp.id === value);
    if (!known && value && value !== "all") {
      setIsCustomMode(true);
      setCustomText(value);
    } else if (known) {
      setIsCustomMode(false);
    }
  }, [value]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 5 }}>
        <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary }}>
          {label}
        </label>
        {isCustomMode && (
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false);
              onChange("cbt_anxiety");
            }}
            style={{
              background: "none",
              border: "none",
              color: t.accent,
              fontSize: "0.71rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ← Из готового списка
          </button>
        )}
      </div>

      {!isCustomMode ? (
        <select
          value={value || "cbt_anxiety"}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setIsCustomMode(true);
              const fallback = customText.trim() || "";
              onChange(fallback);
            } else {
              onChange(e.target.value);
            }
          }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            color: t.textPrimary,
            fontSize: "0.82rem",
          }}
        >
          {PSYCHOLOGY_TOPICS.filter((tp) => tp.id !== "all").map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.icon} {tp.label}
            </option>
          ))}
          <option value="__custom__">➕ Своё направление (добавить своё)...</option>
        </select>
      ) : (
        <input
          type="text"
          autoFocus
          value={customText}
          placeholder="Например: Схема-терапия, EMDR, Гештальт-терапия"
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: `1.5px solid ${t.accent}`,
            background: t.inputBg,
            color: t.textPrimary,
            fontSize: "0.82rem",
            boxSizing: "border-box",
          }}
        />
      )}

      <div style={{ fontSize: "0.69rem", color: t.textMuted, marginTop: 4, lineHeight: 1.25 }}>
        💡 Выберите из списка либо добавьте своё
      </div>
    </div>
  );
}

// Inline markdown renderer helper
function renderInlineMarkdown(text: string, t: any): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2] && match[3]) {
      parts.push(
        <a
          key={`l-${match.index}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.accent, textDecoration: "underline", fontWeight: 600 }}
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      parts.push(<strong key={`b-${match.index}`}>{match[4]}</strong>);
    } else if (match[5]) {
      parts.push(<em key={`i-${match.index}`}>{match[5]}</em>);
    } else if (match[6]) {
      parts.push(
        <code
          key={`c-${match.index}`}
          style={{
            padding: "2px 5px",
            borderRadius: 4,
            background: t.cardHoverBg,
            border: `1px solid ${t.border}`,
            fontSize: "0.85em",
            fontFamily: "monospace",
          }}
        >
          {match[6]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// Markdown notes block renderer
function renderMarkdownNotes(text: string, t: any): React.ReactNode {
  if (!text || !text.trim()) {
    return (
      <div style={{ color: t.textMuted, fontStyle: "italic", padding: "16px 0", fontSize: "0.88rem" }}>
        Конспект урока пока пуст. Перейдите во вкладку «✍️ Редактор текста», чтобы добавить тезисы или иллюстрации.
      </div>
    );
  }

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    if (isNumberedList) {
      elements.push(
        <ol key={`ol-${elements.length}`} style={{ margin: "8px 0 12px 20px", padding: 0, color: t.textPrimary, lineHeight: 1.6 }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{renderInlineMarkdown(item, t)}</li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: "8px 0 12px 20px", padding: 0, color: t.textPrimary, lineHeight: 1.6 }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{renderInlineMarkdown(item, t)}</li>
          ))}
        </ul>
      );
    }
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Image: ![alt](url)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      flushList();
      const alt = imgMatch[1] || "Иллюстрация к уроку";
      const src = imgMatch[2];
      elements.push(
        <div key={`img-${i}`} style={{ margin: "16px 0", textAlign: "center" }}>
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              maxHeight: 460,
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              display: "inline-block",
            }}
          />
          {alt && (
            <div style={{ fontSize: "0.78rem", color: t.textMuted, marginTop: 6, fontStyle: "italic" }}>
              {alt}
            </div>
          )}
        </div>
      );
      continue;
    }

    // HR
    if (line === "---" || line === "***") {
      flushList();
      elements.push(<hr key={`hr-${i}`} style={{ border: "none", borderTop: `1px solid ${t.border}`, margin: "16px 0" }} />);
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} style={{ fontSize: "1.05rem", fontWeight: 700, margin: "14px 0 6px 0", color: t.textPrimary }}>
          {renderInlineMarkdown(line.slice(4), t)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} style={{ fontSize: "1.2rem", fontWeight: 800, margin: "18px 0 8px 0", color: t.accent, borderBottom: `1px solid ${t.borderSubtle}`, paddingBottom: 4 }}>
          {renderInlineMarkdown(line.slice(3), t)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} style={{ fontSize: "1.35rem", fontWeight: 800, margin: "20px 0 10px 0", color: t.textPrimary }}>
          {renderInlineMarkdown(line.slice(2), t)}
        </h1>
      );
      continue;
    }

    // Quotes
    if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`quote-${i}`}
          style={{
            margin: "12px 0",
            padding: "8px 14px",
            borderLeft: `4px solid ${t.accent}`,
            background: t.cardHoverBg,
            borderRadius: "0 8px 8px 0",
            color: t.textSecondary,
            fontStyle: "italic",
            fontSize: "0.9rem",
          }}
        >
          {renderInlineMarkdown(line.slice(2), t)}
        </blockquote>
      );
      continue;
    }

    // Lists
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      listItems.push(line.slice(2));
      continue;
    }

    const numMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numMatch) {
      if (!isNumberedList && listItems.length > 0) flushList();
      isNumberedList = true;
      listItems.push(numMatch[1]);
      continue;
    }

    if (!line) {
      flushList();
      continue;
    }

    flushList();
    elements.push(
      <p key={`p-${i}`} style={{ margin: "8px 0", lineHeight: 1.6, fontSize: "0.9rem", color: t.textPrimary }}>
        {renderInlineMarkdown(line, t)}
      </p>
    );
  }

  flushList();
  return <div style={{ lineHeight: 1.6 }}>{elements}</div>;
}

const toolbarBtnStyle = (t: any): React.CSSProperties => ({
  padding: "4px 8px",
  borderRadius: 4,
  border: `1px solid ${t.borderSubtle}`,
  background: t.cardBg,
  color: t.textPrimary,
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const DEFAULT_COURSES: CreatorCourse[] = [
  {
    id: "course-1",
    title: "Основы психологического консультирования",
    description: "Базовый практический курс для специалистов помогающих профессий: от первого контакта до завершения работы.",
    authorName: "Преподаватель курса",
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
        notes: "## Правила первой сессии\n\nПрояснение ожиданий клиента, рамки конфиденциальности и сеттинг.\n\n### Ключевые тезисы:\n1. **Установление доверительного контакта**\n2. Обсуждение регулярности и оплаты\n3. Зоны ответственности клиента и специалиста\n\n> Контакт важнее любой диагностической схемы на первом этапе.",
        assignment: "Сформулируйте памятку первичного контракта для вашего направления работы (3-4 ключевых пункта).",
        materials: [
          { id: "m-1", title: "Бланк информированного согласия.pdf", fileSize: "180 КБ" },
          { id: "m-2", title: "Чек-лист первичного интервью.docx", fileSize: "95 КБ" },
        ],
      },
      {
        id: "les-2",
        moduleId: "mod-1",
        title: "Урок 2. Формулирование запроса и гипотез",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        duration: "35 мин",
        notes: "## От жалобы к реальному терапевтическому запросу\n\nВыявление автоматических мыслей, триггеров и вторичных выгод.\n\n- Определение мишени работы\n- Проверка реалистичности цели\n- Согласование критериев завершения",
        assignment: "Разберите кейс клиента с жалобой «У меня нет сил ни на что» и переведите её в рабочий контракт.",
        materials: [
          { id: "m-3", title: "Таблица фиксации автоматических мыслей.pdf", fileSize: "220 КБ" },
        ],
      },
      {
        id: "les-3",
        moduleId: "mod-2",
        title: "Урок 3. Инструменты саморегуляции и итог",
        duration: "30 мин",
        notes: "## Инструменты саморегуляции\n\nПодбор практик саморегуляции, поведенческие эксперименты и домашние задания для клиента между встречами.\n\n- Дыхательные техники\n- Прогрессивная мышечная релаксация\n- Фиксация эмоционального фона",
        assignment: "Составьте план из 2 упражнений для снятия острого эмоционального напряжения.",
      },
    ],
  },
];

function parseInitialStudioState(): { tab: "overview" | "webinars" | "courses" | "students" | "afisha" | "pages" | "feedback"; view: StudioView } {
  if (typeof window !== "undefined") {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tab") || sp.get("studio_tab");
    if (t === "feedback" || t === "support" || t === "help") {
      return { tab: "feedback", view: { type: "feedback" } };
    }
    if (t === "pages" || t === "site" || t === "builder") {
      return { tab: "pages", view: { type: "pages" } };
    }
    if (t === "afisha" || t === "widget") {
      const singleId = sp.get("item") || undefined;
      return { tab: "afisha", view: { type: "afisha", singleItemId: singleId } };
    }
    if (t === "courses" || t === "lms") {
      const courseId = sp.get("course") || "";
      return { tab: "courses", view: { type: "course", courseId } };
    }
    if (t === "students" || t === "crm") {
      return { tab: "students", view: { type: "students" } };
    }
    if (t === "webinars" || t === "stream" || t === "live") {
      return { tab: "webinars", view: { type: "webinar", id: "" } };
    }
    if (t === "quick_live") {
      return { tab: "webinars", view: { type: "quick_live" } };
    }
  }
  return { tab: "overview", view: { type: "overview" } };
}

export default function CreatorStudioWorkspace({
  onLaunchStudio,
  onNavigateToSpecialist,
}: CreatorStudioWorkspaceProps) {
  // Theme state: light by default
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  };

  // Quick live room
  const [quickRoomName, setQuickRoomName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(QUICK_ROOM_KEY);
      if (saved) return saved;
    } catch {}
    const fresh = `ida-live-${Math.random().toString(36).substring(2, 8)}`;
    try {
      localStorage.setItem(QUICK_ROOM_KEY, fresh);
    } catch {}
    return fresh;
  });

  const generateNewQuickRoom = () => {
    const fresh = `ida-live-${Math.random().toString(36).substring(2, 8)}`;
    setQuickRoomName(fresh);
    try {
      localStorage.setItem(QUICK_ROOM_KEY, fresh);
    } catch {}
  };

  // Navigation / View State
  const initialStudio = useMemo(() => parseInitialStudioState(), []);
  const [activeTab, setActiveTab] = useState<"overview" | "webinars" | "courses" | "students" | "afisha" | "pages" | "feedback">(initialStudio.tab);
  const [selectedView, setSelectedView] = useState<StudioView>(initialStudio.view);

  // Sync state if user navigates with browser back/forward buttons or URL changes
  useEffect(() => {
    const handlePopState = () => {
      const next = parseInitialStudioState();
      setActiveTab(next.tab);
      setSelectedView(next.view);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToStudioTab = useCallback(
    (
      tab: "overview" | "webinars" | "courses" | "students" | "afisha" | "pages" | "feedback",
      view?: StudioView,
      extraParams?: Record<string, string | undefined>
    ) => {
      setActiveTab(tab);
      if (view) {
        setSelectedView(view);
      } else {
        if (tab === "overview") setSelectedView({ type: "overview" });
        else if (tab === "webinars") setSelectedView({ type: "webinar", id: "" });
        else if (tab === "courses") setSelectedView({ type: "course", courseId: "" });
        else if (tab === "students") setSelectedView({ type: "students" });
        else if (tab === "afisha") setSelectedView({ type: "afisha" });
        else if (tab === "pages") setSelectedView({ type: "pages" });
        else if (tab === "feedback") setSelectedView({ type: "feedback" });
      }

      if (typeof window !== "undefined" && window.history && window.location) {
        try {
          const url = new URL(window.location.href);
          if (tab === "overview") {
            url.searchParams.delete("tab");
            url.searchParams.delete("studio_tab");
          } else {
            url.searchParams.set("tab", tab);
          }

          if (tab !== "courses") url.searchParams.delete("course");
          if (tab !== "afisha") url.searchParams.delete("item");

          if (extraParams) {
            for (const [k, v] of Object.entries(extraParams)) {
              if (v !== undefined && v !== "") {
                url.searchParams.set(k, v);
              } else {
                url.searchParams.delete(k);
              }
            }
          }

          window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash);
        } catch {}
      }
    },
    []
  );

  const [webinarFilter, setWebinarFilter] = useState<"all" | "scheduled" | "records">("all");

  // Students Registry State
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [studentFilterCourseId, setStudentFilterCourseId] = useState<string>("all");
  const [studentFilterStatus, setStudentFilterStatus] = useState<"all" | "active" | "paused" | "completed">("all");
  const [editingStudent, setEditingStudent] = useState<CourseStudent | null>(null);
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importTargetCourseId, setImportTargetCourseId] = useState<string>("");
  const [importReport, setImportReport] = useState<{ added: number; updated: number } | null>(null);

  // Student Form fields
  const [studentFormFullName, setStudentFormFullName] = useState<string>("");
  const [studentFormEmail, setStudentFormEmail] = useState<string>("");
  const [studentFormPhone, setStudentFormPhone] = useState<string>("");
  const [studentFormTelegram, setStudentFormTelegram] = useState<string>("");
  const [studentFormCourseIds, setStudentFormCourseIds] = useState<string[]>([]);
  const [studentFormStatus, setStudentFormStatus] = useState<"active" | "paused" | "completed">("active");
  const [studentFormNotes, setStudentFormNotes] = useState<string>("");

  // Webinars State
  const [webinars, setWebinars] = useState<WebinarItem[]>([]);
  const [copiedLinkNotice, setCopiedLinkNotice] = useState<string | null>(null);
  const [showQuickLinkBox, setShowQuickLinkBox] = useState<boolean>(false);
  const [quickLinkRole, setQuickLinkRole] = useState<"listener" | "student" | "speaker">("listener");

  // Modals State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newWebinarTitle, setNewWebinarTitle] = useState("");
  const [newWebinarDate, setNewWebinarDate] = useState("");
  const [newWebinarTime, setNewWebinarTime] = useState("19:00");
  const [newWebinarDesc, setNewWebinarDesc] = useState("");

  // Courses State
  const [courses, setCourses] = useState<CreatorCourse[]>([]);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({ "course-1": true });
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCourseAuthor, setNewCourseAuthor] = useState("");

  // Module Modal State
  const [showAddModuleModalForCourse, setShowAddModuleModalForCourse] = useState<string | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDesc, setNewModuleDesc] = useState("");

  // Add Lesson Modal
  const [showAddLessonModalForCourse, setShowAddLessonModalForCourse] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState("");
  const [newLessonDuration, setNewLessonDuration] = useState("20 мин");
  const [newLessonNotes, setNewLessonNotes] = useState("");
  const [newLessonModuleId, setNewLessonModuleId] = useState<string>("");

  // Rich Notes & Materials state
  const [notesMode, setNotesMode] = useState<"editor" | "preview">("editor");
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const notesImageInputRef = useRef<HTMLInputElement | null>(null);
  const lessonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Video trimming state in right panel
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(3600);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Smart Trimming, Monetization & Video Protection Modals
  const [trimmingRecording, setTrimmingRecording] = useState<CloudRecording | null>(null);
  const [monetizingRecording, setMonetizingRecording] = useState<CloudRecording | null>(null);
  const [previewingPlayerRecId, setPreviewingPlayerRecId] = useState<string | null>(null);
  const [protectionModalTarget, setProtectionModalTarget] = useState<{
    type: "lesson" | "webinar";
    lessonId?: string;
    courseId?: string;
    webinarId?: string;
    title: string;
    settings: VideoProtectionSettings;
  } | null>(null);
  const [certificateModalTarget, setCertificateModalTarget] = useState<{
    type: "course" | "webinar" | "student";
    courseId?: string;
    webinarId?: string;
    studentId?: string;
    category?: "paid_only" | "free_only" | "all_registered";
  } | null>(null);

  // Lesson Watermark Coordinates (smooth floating animation)
  const [lessonWatermarkPos, setLessonWatermarkPos] = useState<{ top: number; left: number }>({ top: 18, left: 22 });

  useEffect(() => {
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 60) + 12;
      const left = Math.floor(Math.random() * 55) + 12;
      setLessonWatermarkPos({ top, left });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Attach recording to course modal
  const [recordingToCourseWebinar, setRecordingToCourseWebinar] = useState<WebinarItem | null>(null);
  const [targetCourseId, setTargetCourseId] = useState<string>("");
  const [targetLessonTitle, setTargetLessonTitle] = useState<string>("");

  // Local-First Storage & Backup State
  const [diskQuota, setDiskQuota] = useState<DiskQuotaInfo>({
    supported: false,
    freeBytes: 50 * 1024 * 1024 * 1024,
    totalBytes: 100 * 1024 * 1024 * 1024,
    freeGb: 50,
    totalGb: 100,
    isLowSpace: false,
  });
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [showAfishaHelpModal, setShowAfishaHelpModal] = useState<boolean>(false);
  const [showStoragePromoModal, setShowStoragePromoModal] = useState<boolean>(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Storage Source of Truth Mode: "local_only" (only on author's PC) vs "cloud_sync" (synced with Academy server)
  const [storageSourceMode, setStorageSourceMode] = useState<"local_only" | "cloud_sync">(() => {
    try {
      const saved = localStorage.getItem("ida_creator_storage_source_mode_v1");
      return saved === "cloud_sync" ? "cloud_sync" : "local_only";
    } catch {
      return "local_only";
    }
  });
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem("ida_creator_last_cloud_sync_v1");
    } catch {
      return null;
    }
  });
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Webinar Recording Target & Registration Preview in Schedule Modal
  const [newWebinarRecordMode, setNewWebinarRecordMode] = useState<"local" | "cloud">("local");
  const [newWebinarAutoCloudFallback, setNewWebinarAutoCloudFallback] = useState<boolean>(true);
  const [newWebinarPaidCertPrice, setNewWebinarPaidCertPrice] = useState<number>(990);
  const [previewLobbyTab, setPreviewLobbyTab] = useState<"free" | "paid">("free");
  const [showStudentPagePreviewModal, setShowStudentPagePreviewModal] = useState<{
    title: string;
    date: string;
    time: string;
    desc: string;
    priceRub: number;
    webinarId?: string;
  } | null>(null);

  // Check Disk Quota function (Local-First storage check)
  const checkDiskQuota = async () => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        const free = Math.max(0, quota - usage);
        const freeGb = parseFloat((free / (1024 * 1024 * 1024)).toFixed(1));
        const totalGb = parseFloat((quota / (1024 * 1024 * 1024)).toFixed(1));
        setDiskQuota({
          supported: true,
          freeBytes: free,
          totalBytes: quota,
          freeGb,
          totalGb,
          isLowSpace: free < 2 * 1024 * 1024 * 1024, // less than 2 GB
        });
        return;
      } catch (e) {
        console.warn("Storage estimate error", e);
      }
    }
    setDiskQuota({
      supported: false,
      freeBytes: 50 * 1024 * 1024 * 1024,
      totalBytes: 100 * 1024 * 1024 * 1024,
      freeGb: 50,
      totalGb: 100,
      isLowSpace: false,
    });
  };

  useEffect(() => {
    checkDiskQuota();
  }, []);

  // Feedback notifications
  const triggerCopyFeedback = (id: string, textToCopy: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedLinkNotice(id);
      setTimeout(() => setCopiedLinkNotice(null), 3000);
    } else {
      prompt("Скопируйте ссылку:", textToCopy);
    }
  };

  // Academy Environment: demo sandbox vs live production studio
  const [env, setEnv] = useState<AcademyEnvironment>(() => getAcademyEnvironment("creator"));

  const handleSwitchEnv = (nextEnv: AcademyEnvironment) => {
    setEnv(nextEnv);
    setAcademyEnvironment("creator", nextEnv);
    // Reload courses for new environment
    const loadedCourses = loadCreatorCourses(nextEnv);
    setCourses(loadedCourses);
  };

  const handleResetDemoCourses = () => {
    if (confirm("Сбросить демо-курсы к исходным материалам Академии?")) {
      const reset = resetCreatorCoursesDemo();
      setCourses(reset);
    }
  };

  const handleImportDemoToLive = () => {
    const imported = importDemoCoursesToLive();
    setCourses(imported);
    alert("Шаблоны курсов успешно скопированы в рабочий каталог!");
  };

  // Load Webinars
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WEBINARS_STORAGE_KEY);
      if (stored) {
        setWebinars(JSON.parse(stored));
      } else {
        const existing = loadWebinars();
        if (existing && existing.length > 0) {
          setWebinars(existing);
          localStorage.setItem(WEBINARS_STORAGE_KEY, JSON.stringify(existing));
        } else if (isDemoModeActive()) {
          const defaults: WebinarItem[] = [
            {
              id: "web-demo-1",
              title: "Практический мастер-класс: Работа со стрессом и выгоранием",
              description: "Разбор клиентских кейсов, техники заземления и практический алгоритм восстановления ресурса.",
              scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
              scheduledTime: "19:00",
              durationMinutes: 90,
              roomName: "room-stress-masterclass",
              speakerName: "Ведущий эфира",
              accessType: "open_200",
              status: "scheduled",
              registeredCount: 38,
              guestLink: "",
              speakerLink: "",
              materials: [],
              settings: {
                waitingRoom: false,
                breakoutRooms: false,
                qaModeration: true,
                autoCloudRecording: true,
                aiSmartSummary: true,
              },
            },
            {
              id: "web-demo-rec-1",
              title: "Клинический разбор кейса: Тревожно-фобические расстройства",
              description: "Полная запись практического разбора со студентами и ответов на вопросы.",
              scheduledDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
              scheduledTime: "18:00",
              durationMinutes: 54,
              roomName: "room-anxiety-case",
              speakerName: "Ведущий эфира",
              accessType: "open_200",
              status: "finished",
              registeredCount: 45,
              guestLink: "",
              speakerLink: "",
              materials: [],
              recording: {
                id: "rec-anxiety-1",
                webinarId: "web-demo-rec-1",
                webinarTitle: "Клинический разбор кейса: Тревожно-фобические расстройства",
                recordedAt: new Date(Date.now() - 86400000).toISOString(),
                durationMinutes: 54,
                fileSizeMb: 420,
                s3Key: "recordings/anxiety-case.mp4",
                videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                status: "ready",
                expiresAt: new Date(Date.now() + 86400000 * 13).toISOString(),
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
          setWebinars(defaults);
          localStorage.setItem(WEBINARS_STORAGE_KEY, JSON.stringify(defaults));
        } else {
          setWebinars([]);
          localStorage.setItem(WEBINARS_STORAGE_KEY, JSON.stringify([]));
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Load Courses for active environment
  useEffect(() => {
    try {
      const loaded = loadCreatorCourses(env);
      setCourses(loaded);
    } catch {
      setCourses([]);
    }
  }, [env]);

  const saveWebinarsList = (list: WebinarItem[]) => {
    setWebinars(list);
    try {
      localStorage.setItem(WEBINARS_STORAGE_KEY, JSON.stringify(list));
      saveWebinars(list);
    } catch {}
  };

  const saveCoursesList = (list: CreatorCourse[]) => {
    setCourses(list);
    saveCreatorCourses(list, env);
  };

  // Load Students
  useEffect(() => {
    try {
      const list = loadCourseStudents();
      setStudents(list);
    } catch {}
  }, []);

  const saveStudentsList = (list: CourseStudent[]) => {
    setStudents(list);
    saveCourseStudents(list);
  };

  // Full Studio Backup & Restore (Local-First philosophy)
  const handleExportBackup = () => {
    try {
      const totalLessons = courses.reduce((acc, c) => acc + (c.lessons?.length || 0), 0);
      const backupData = {
        app: "IDA-Prevention-Creator-Studio",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        courses,
        webinars,
        students,
        stats: {
          coursesCount: courses.length,
          lessonsCount: totalLessons,
          webinarsCount: webinars.length,
          studentsCount: students.length,
        },
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `ida_creator_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupNotice(`✓ Резервная копия скачана: ${courses.length} курсов, ${webinars.length} вебинаров, ${students.length} студентов!`);
      setTimeout(() => setBackupNotice(null), 5000);
    } catch (err: any) {
      alert("Ошибка при выгрузке резервной копии: " + (err?.message || "неизвестная ошибка"));
    }
  };

  const handleExportStandaloneHtmlSite = () => {
    try {
      const settings = loadSchoolSettings();
      const sitePages = loadSitePages();
      downloadStandaloneHtmlFile({
        settings,
        courses,
        webinars,
        pages: sitePages,
      });
      setBackupNotice("✓ Автономный HTML-сайт школы успешно выгружен! Файл можно открыть без интернета или развернуть на любом хостинге.");
      setTimeout(() => setBackupNotice(null), 6000);
    } catch (err: any) {
      alert("Ошибка при выгрузке HTML-сайта: " + (err?.message || "неизвестная ошибка"));
    }
  };

  const handleImportBackupFile = (eOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = eOrFile instanceof File ? eOrFile : eOrFile.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Неверный формат файла резервной копии");
        }
        let cCount = courses.length;
        let wCount = webinars.length;
        let sCount = students.length;

        if (Array.isArray(parsed.courses)) {
          setCourses(parsed.courses);
          saveCoursesList(parsed.courses);
          cCount = parsed.courses.length;
        }
        if (Array.isArray(parsed.webinars)) {
          setWebinars(parsed.webinars);
          saveWebinarsList(parsed.webinars);
          wCount = parsed.webinars.length;
        }
        if (Array.isArray(parsed.students)) {
          setStudents(parsed.students);
          saveStudentsList(parsed.students);
          sCount = parsed.students.length;
        }

        setBackupNotice(`✓ Кабинет успешно восстановлен: курсов — ${cCount}, вебинаров — ${wCount}, студентов — ${sCount}!`);
        setTimeout(() => setBackupNotice(null), 6000);
      } catch (err: any) {
        alert("Ошибка при чтении файла резервной копии: " + (err?.message || "повреждённый файл"));
      }
    };
    reader.readAsText(file);
    if (!(eOrFile instanceof File) && eOrFile.target) {
      eOrFile.target.value = "";
    }
  };

  const handleChangeStorageSourceMode = (mode: "local_only" | "cloud_sync") => {
    setStorageSourceMode(mode);
    try {
      localStorage.setItem("ida_creator_storage_source_mode_v1", mode);
    } catch {}
    if (mode === "local_only") {
      setBackupNotice("💻 Включён приватный локальный режим: данные хранятся только на вашем компьютере.");
    } else {
      setBackupNotice("☁️ Включён режим синхронизации с сервером Академии.");
    }
    setTimeout(() => setBackupNotice(null), 5000);
  };

  const handlePushToServer = async () => {
    setIsSyncingCloud(true);
    try {
      const nowIso = new Date().toISOString();
      const snapshotPayload = {
        app: "IDA-Prevention-Creator-Studio",
        version: "1.0",
        syncedAt: nowIso,
        courses,
        webinars,
        students,
      };
      // Save server snapshot in local cloud cache + attempt POST to Academy API
      try {
        localStorage.setItem("ida_creator_cloud_snapshot_v1", JSON.stringify(snapshotPayload));
      } catch {}
      try {
        await fetch("/api/academy/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshotPayload),
        });
      } catch {
        // Fallback when running standalone or offline
      }
      const formattedTime = new Date(nowIso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastCloudSyncAt(formattedTime);
      try {
        localStorage.setItem("ida_creator_last_cloud_sync_v1", formattedTime);
      } catch {}
      setBackupNotice(
        `☁️ Выгружено на сервер Академии: курсов — ${courses.length}, вебинаров — ${webinars.length}, слушателей — ${students.length}!`
      );
      setTimeout(() => setBackupNotice(null), 6000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handlePullFromServer = async () => {
    setIsSyncingCloud(true);
    try {
      let cloudData: any = null;
      try {
        const resp = await fetch("/api/academy/snapshot", { method: "GET" });
        if (resp.ok) {
          const json = await resp.json();
          if (json && (Array.isArray(json.courses) || Array.isArray(json.webinars))) {
            cloudData = json;
          }
        }
      } catch {}

      if (!cloudData) {
        try {
          const cached = localStorage.getItem("ida_creator_cloud_snapshot_v1");
          if (cached) cloudData = JSON.parse(cached);
        } catch {}
      }

      if (!cloudData) {
        setBackupNotice("ℹ️ На сервере пока нет сохранённого слепка вашей школы. Сначала нажмите «Выгрузить базу на сервер».");
        setTimeout(() => setBackupNotice(null), 5000);
        return;
      }

      let cCount = courses.length;
      let wCount = webinars.length;
      let sCount = students.length;

      if (Array.isArray(cloudData.courses)) {
        saveCoursesList(cloudData.courses);
        cCount = cloudData.courses.length;
      }
      if (Array.isArray(cloudData.webinars)) {
        saveWebinarsList(cloudData.webinars);
        wCount = cloudData.webinars.length;
      }
      if (Array.isArray(cloudData.students)) {
        saveStudentsList(cloudData.students);
        sCount = cloudData.students.length;
      }

      const formattedTime = new Date().toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastCloudSyncAt(formattedTime);
      try {
        localStorage.setItem("ida_creator_last_cloud_sync_v1", formattedTime);
      } catch {}

      setBackupNotice(`⬇️ Данные загружены с сервера: курсов — ${cCount}, вебинаров — ${wCount}, слушателей — ${sCount}!`);
      setTimeout(() => setBackupNotice(null), 6000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleUpdateWebinarStorageMode = (webinarId: string, mode: "local" | "cloud") => {
    const updated = webinars.map((w) => {
      if (w.id === webinarId) {
        return {
          ...w,
          recordingStorageMode: mode,
          settings: {
            ...w.settings,
            recordingStorageMode: mode,
          },
        };
      }
      return w;
    });
    saveWebinarsList(updated);
  };

  const courseTitlesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of courses) {
      map[c.id] = c.title;
    }
    return map;
  }, [courses]);

  const openAddStudentModal = () => {
    setEditingStudent(null);
    setStudentFormFullName("");
    setStudentFormEmail("");
    setStudentFormPhone("");
    setStudentFormTelegram("");
    setStudentFormCourseIds(courses.length > 0 ? [courses[0].id] : []);
    setStudentFormStatus("active");
    setStudentFormNotes("");
    setShowStudentModal(true);
  };

  const openEditStudentModal = (student: CourseStudent) => {
    setEditingStudent(student);
    setStudentFormFullName(student.fullName);
    setStudentFormEmail(student.email || "");
    setStudentFormPhone(student.phone || "");
    setStudentFormTelegram(student.telegram || "");
    setStudentFormCourseIds(student.courseIds || []);
    setStudentFormStatus(student.status || "active");
    setStudentFormNotes(student.notes || "");
    setShowStudentModal(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormFullName.trim()) return;

    if (editingStudent) {
      const updated = students.map((s) => {
        if (s.id === editingStudent.id) {
          return {
            ...s,
            fullName: studentFormFullName.trim(),
            email: studentFormEmail.trim() || undefined,
            phone: studentFormPhone.trim() || undefined,
            telegram: studentFormTelegram.trim() || undefined,
            courseIds: studentFormCourseIds,
            status: studentFormStatus,
            notes: studentFormNotes.trim() || undefined,
          };
        }
        return s;
      });
      saveStudentsList(updated);
    } else {
      const newSt: CourseStudent = {
        id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fullName: studentFormFullName.trim(),
        email: studentFormEmail.trim() || undefined,
        phone: studentFormPhone.trim() || undefined,
        telegram: studentFormTelegram.trim() || undefined,
        courseIds: studentFormCourseIds,
        status: studentFormStatus,
        registeredAt: new Date().toISOString().slice(0, 10),
        accessCode: generateAccessCode(),
        notes: studentFormNotes.trim() || undefined,
      };
      saveStudentsList([newSt, ...students]);
    }
    setShowStudentModal(false);
    setEditingStudent(null);
  };

  const handleDeleteStudent = (studentId: string, fullName: string) => {
    if (window.confirm(`Удалить студента «${fullName}» из базы?`)) {
      const updated = students.filter((s) => s.id !== studentId);
      saveStudentsList(updated);
    }
  };

  const handleToggleStudentStatus = (student: CourseStudent) => {
    const nextStatus = student.status === "active" ? "paused" : "active";
    const updated = students.map((s) => (s.id === student.id ? { ...s, status: nextStatus } : s));
    saveStudentsList(updated);
  };

  const handleToggleStudentCourse = (student: CourseStudent, courseId: string) => {
    const exists = student.courseIds.includes(courseId);
    const newCourseIds = exists
      ? student.courseIds.filter((id) => id !== courseId)
      : [...student.courseIds, courseId];
    const updated = students.map((s) => (s.id === student.id ? { ...s, courseIds: newCourseIds } : s));
    saveStudentsList(updated);
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (studentFilterCourseId !== "all") {
        if (!s.courseIds.includes(studentFilterCourseId)) return false;
      }
      if (studentFilterStatus !== "all") {
        if (s.status !== studentFilterStatus) return false;
      }
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const inName = s.fullName.toLowerCase().includes(q);
        const inEmail = (s.email || "").toLowerCase().includes(q);
        const inPhone = (s.phone || "").toLowerCase().includes(q);
        const inTg = (s.telegram || "").toLowerCase().includes(q);
        const inNotes = (s.notes || "").toLowerCase().includes(q);
        if (!inName && !inEmail && !inPhone && !inTg && !inNotes) return false;
      }
      return true;
    });
  }, [students, studentFilterCourseId, studentFilterStatus, studentSearch]);

  const handleExportStudents = (targetCourseId?: string) => {
    const listToExport = targetCourseId
      ? students.filter((s) => s.courseIds.includes(targetCourseId))
      : filteredStudents;

    const dateStr = new Date().toISOString().slice(0, 10);
    let fileName = `baza-vseh-studentov-${dateStr}.csv`;

    const effectiveCourseId = targetCourseId || (studentFilterCourseId !== "all" ? studentFilterCourseId : undefined);
    if (effectiveCourseId) {
      const c = courses.find((item) => item.id === effectiveCourseId);
      const safeTitle = c ? c.title.replace(/[^\wа-яА-ЯёЁ0-9_-]/g, "_").slice(0, 30) : effectiveCourseId;
      fileName = `baza-studentov-${safeTitle}-${dateStr}.csv`;
    }

    exportStudentsToExcel(listToExport, courseTitlesMap, fileName);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    const result = parseStudentsSpreadsheet(
      importText,
      importTargetCourseId || undefined,
      courses.map((c) => ({ id: c.id, title: c.title }))
    );
    if (!result.students || result.students.length === 0) {
      alert("Не удалось распознать строки. Проверьте формат данных (ФИО, Email, Телефон, Telegram, Курс).");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    const existingMap = new Map<string, CourseStudent>();
    for (const s of students) {
      if (s.email) existingMap.set(s.email.toLowerCase(), s);
    }

    const nextList = [...students];
    for (const p of result.students) {
      if (p.email && existingMap.has(p.email.toLowerCase())) {
        const ex = existingMap.get(p.email.toLowerCase())!;
        const mergedCourses = Array.from(new Set([...ex.courseIds, ...p.courseIds]));
        const idx = nextList.findIndex((item) => item.id === ex.id);
        if (idx !== -1) {
          nextList[idx] = {
            ...ex,
            fullName: p.fullName || ex.fullName,
            phone: p.phone || ex.phone,
            telegram: p.telegram || ex.telegram,
            courseIds: mergedCourses,
          };
          updatedCount++;
        }
      } else {
        nextList.unshift(p);
        addedCount++;
      }
    }

    saveStudentsList(nextList);
    setImportReport({ added: addedCount, updated: updatedCount });
    setTimeout(() => {
      setShowImportModal(false);
      setImportText("");
      setImportReport(null);
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // Helper links
  const getOrigin = () => {
    return typeof window !== "undefined" ? window.location.origin : "https://academy.ida-psy.ru";
  };

  const getGuestLinkForRoom = (room: string) => {
    return `${getOrigin()}/?room=${encodeURIComponent(room)}&mode=webinar&role=listener`;
  };

  const getSpeakerLinkForRoom = (room: string) => {
    return `${getOrigin()}/?room=${encodeURIComponent(room)}&mode=webinar&role=speaker`;
  };

  const getCourseStudentLinkForRoom = (room: string) => {
    return `${getOrigin()}/?room=${encodeURIComponent(room)}&mode=course&role=student`;
  };

  const getQuickLinkByRole = (room: string, roleType: "listener" | "student" | "speaker") => {
    if (roleType === "student") return getCourseStudentLinkForRoom(room);
    if (roleType === "speaker") return getSpeakerLinkForRoom(room);
    return getGuestLinkForRoom(room);
  };

  const handleStartBroadcast = (roomName: string, mode: "webinar" | "course" = "webinar") => {
    if (onLaunchStudio) {
      onLaunchStudio(roomName);
    } else {
      window.location.href = `${getOrigin()}/?room=${encodeURIComponent(roomName)}&mode=${mode}&role=author`;
    }
  };

  const handleDeleteWebinar = (id: string) => {
    if (window.confirm("Удалить этот вебинар?")) {
      const next = webinars.filter((w) => w.id !== id);
      saveWebinarsList(next);
      try {
        removeStoredWebinar(id);
      } catch {}
      if (selectedView.type === "webinar" && selectedView.id === id) {
        setSelectedView({ type: "quick_live" });
      }
    }
  };

  const handleCreateWebinar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebinarTitle.trim()) return;

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const roomName = `room-${Date.now().toString(36)}-${randomSuffix}`;
    const dateVal = newWebinarDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const newW: WebinarItem = {
      id: `web-${Date.now()}`,
      title: newWebinarTitle.trim(),
      description: newWebinarDesc.trim() || "Онлайн-эфир",
      scheduledDate: dateVal,
      scheduledTime: newWebinarTime || "19:00",
      durationMinutes: 90,
      roomName,
      speakerName: "Ведущий",
      accessType: "open_200",
      status: "scheduled",
      registeredCount: 0,
      guestLink: "",
      speakerLink: "",
      materials: [],
      priceRub: newWebinarPaidCertPrice,
      recordingStorageMode: newWebinarRecordMode,
      autoCloudFallback: newWebinarAutoCloudFallback,
      settings: {
        waitingRoom: false,
        breakoutRooms: false,
        qaModeration: true,
        autoCloudRecording: newWebinarRecordMode === "cloud",
        aiSmartSummary: true,
        recordingStorageMode: newWebinarRecordMode,
        autoCloudFallback: newWebinarAutoCloudFallback,
      },
    };

    const next = [newW, ...webinars];
    saveWebinarsList(next);
    setShowScheduleModal(false);
    setNewWebinarTitle("");
    setNewWebinarDesc("");
    setSelectedView({ type: "webinar", id: newW.id });
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    const newC: CreatorCourse = {
      id: `course-${Date.now()}`,
      title: newCourseTitle.trim(),
      description: newCourseDesc.trim(),
      authorName: newCourseAuthor.trim() || "Преподаватель",
      status: "draft",
      createdAt: new Date().toISOString().slice(0, 10),
      lessons: [],
    };

    const next = [newC, ...courses];
    saveCoursesList(next);
    setExpandedCourseIds((prev) => ({ ...prev, [newC.id]: true }));
    setShowCreateCourseModal(false);
    setNewCourseTitle("");
    setNewCourseDesc("");
    setNewCourseAuthor("");
    setSelectedView({ type: "course", courseId: newC.id });
  };

  const handleDeleteCourse = (courseId: string) => {
    if (window.confirm("Удалить этот курс и все его уроки?")) {
      const next = courses.filter((c) => c.id !== courseId);
      saveCoursesList(next);
      if (selectedView.type === "course" && selectedView.courseId === courseId) {
        setSelectedView({ type: "quick_live" });
      }
    }
  };

  const handleAddModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddModuleModalForCourse || !newModuleTitle.trim()) return;
    const courseId = showAddModuleModalForCourse;
    const newMod: CreatorCourseModule = {
      id: `mod-${Date.now()}`,
      title: newModuleTitle.trim(),
      description: newModuleDesc.trim() || undefined,
    };
    const updated = courses.map((c) => {
      if (c.id === courseId) {
        return {
          ...c,
          modules: [...(c.modules || []), newMod],
        };
      }
      return c;
    });
    saveCoursesList(updated);
    setShowAddModuleModalForCourse(null);
    setNewModuleTitle("");
    setNewModuleDesc("");
  };

  const handleDeleteModule = (courseId: string, moduleId: string) => {
    if (window.confirm("Удалить этот модуль? Все уроки из него сохранятся и перейдут в общий список.")) {
      const updated = courses.map((c) => {
        if (c.id === courseId) {
          return {
            ...c,
            modules: (c.modules || []).filter((m) => m.id !== moduleId),
            lessons: c.lessons.map((l) => (l.moduleId === moduleId ? { ...l, moduleId: undefined } : l)),
          };
        }
        return c;
      });
      saveCoursesList(updated);
    }
  };

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddLessonModalForCourse || !newLessonTitle.trim()) return;

    const courseId = showAddLessonModalForCourse;
    const lesson: CreatorLesson = {
      id: `les-${Date.now()}`,
      moduleId: newLessonModuleId ? newLessonModuleId : undefined,
      title: newLessonTitle.trim(),
      videoUrl: newLessonVideoUrl.trim() || undefined,
      notes: newLessonNotes.trim() || undefined,
      duration: newLessonDuration.trim() || undefined,
      materials: [],
    };

    const updated = courses.map((c) => {
      if (c.id === courseId) {
        return { ...c, lessons: [...c.lessons, lesson] };
      }
      return c;
    });

    saveCoursesList(updated);
    setShowAddLessonModalForCourse(null);
    setNewLessonTitle("");
    setNewLessonVideoUrl("");
    setNewLessonNotes("");
    setNewLessonDuration("20 мин");
    setNewLessonModuleId("");
    setSelectedView({ type: "course", courseId, lessonId: lesson.id });
  };

  const insertIntoNotes = (prefix: string, suffix: string = "", placeholder: string = "") => {
    const textarea = notesTextareaRef.current;
    if (!textarea || !selectedCourse || !selectedLesson) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = selectedLesson.notes || "";
    const selectedText = currentValue.substring(start, end) || placeholder;
    const nextValue =
      currentValue.substring(0, start) + prefix + selectedText + suffix + currentValue.substring(end);

    const updated = courses.map((c) => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, notes: nextValue } : l)),
        };
      }
      return c;
    });
    saveCoursesList(updated);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleUploadNotesImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        insertIntoNotes(`\n\n![${file.name}](${base64Url})\n\n`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleInsertImageUrl = () => {
    const url = prompt("Введите ссылку на изображение (https://...):");
    if (url && url.trim()) {
      const alt = prompt("Подпись к картинке (необязательно):") || "Иллюстрация";
      insertIntoNotes(`\n\n![${alt}](${url.trim()})\n\n`);
    }
  };

  const handleAttachLessonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCourse || !selectedLesson) return;

    const sizeKb = Math.round(file.size / 1024);
    const formattedSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} МБ` : `${sizeKb} КБ`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newMaterial: CreatorLessonMaterial = {
        id: `mat-${Date.now()}`,
        title: file.name,
        fileSize: formattedSize,
        url: dataUrl,
      };

      const currentMaterials = selectedLesson.materials || [];
      const updated = courses.map((c) => {
        if (c.id === selectedCourse.id) {
          return {
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === selectedLesson.id ? { ...l, materials: [...currentMaterials, newMaterial] } : l
            ),
          };
        }
        return c;
      });
      saveCoursesList(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAttachFileByUrl = () => {
    if (!selectedCourse || !selectedLesson) return;
    const title = prompt("Введите название материала (например: Методическое пособие.pdf):");
    if (!title || !title.trim()) return;
    const url = prompt("Введите ссылку на файл (Яндекс.Диск, Google Drive, облако и т.д.):");
    if (!url || !url.trim()) return;

    const newMaterial: CreatorLessonMaterial = {
      id: `mat-${Date.now()}`,
      title: title.trim(),
      fileSize: "Внешняя ссылка",
      url: url.trim(),
    };

    const currentMaterials = selectedLesson.materials || [];
    const updated = courses.map((c) => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          lessons: c.lessons.map((l) =>
            l.id === selectedLesson.id ? { ...l, materials: [...currentMaterials, newMaterial] } : l
          ),
        };
      }
      return c;
    });
    saveCoursesList(updated);
  };

  const handleDeleteLessonMaterial = (materialId: string) => {
    if (!selectedCourse || !selectedLesson) return;
    const updated = courses.map((c) => {
      if (c.id === selectedCourse.id) {
        return {
          ...c,
          lessons: c.lessons.map((l) =>
            l.id === selectedLesson.id
              ? { ...l, materials: (l.materials || []).filter((m) => m.id !== materialId) }
              : l
          ),
        };
      }
      return c;
    });
    saveCoursesList(updated);
  };

  const handleMoveLesson = (courseId: string, index: number, direction: "up" | "down") => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= course.lessons.length) return;

    const lessons = [...course.lessons];
    const [moved] = lessons.splice(index, 1);
    lessons.splice(newIndex, 0, moved);

    const updated = courses.map((c) => (c.id === courseId ? { ...c, lessons } : c));
    saveCoursesList(updated);
  };

  const handleDeleteLesson = (courseId: string, lessonId: string) => {
    if (window.confirm("Удалить этот урок?")) {
      const updated = courses.map((c) => {
        if (c.id === courseId) {
          return { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) };
        }
        return c;
      });
      saveCoursesList(updated);
      if (selectedView.type === "course" && selectedView.lessonId === lessonId) {
        setSelectedView({ type: "course", courseId });
      }
    }
  };

  const handleToggleCourseStatus = (courseId: string) => {
    const updated = courses.map((c) => {
      if (c.id === courseId) {
        const nextStatus = c.status === "published" ? "draft" : "published";
        return { ...c, status: nextStatus as "draft" | "published" };
      }
      return c;
    });
    saveCoursesList(updated);
  };

  // Convert webinar recording to a course lesson
  const handleAttachRecordingToCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingToCourseWebinar || !targetCourseId || !targetLessonTitle.trim()) return;

    const videoUrl = recordingToCourseWebinar.recording?.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    const duration = `${recordingToCourseWebinar.recording?.durationMinutes || recordingToCourseWebinar.durationMinutes} мин`;

    const newLesson: CreatorLesson = {
      id: `les-rec-${Date.now()}`,
      title: targetLessonTitle.trim(),
      videoUrl,
      duration,
      notes: `Запись вебинара «${recordingToCourseWebinar.title}» от ${recordingToCourseWebinar.scheduledDate}.\n\nКраткое описание: ${recordingToCourseWebinar.description}`,
    };

    const updated = courses.map((c) => {
      if (c.id === targetCourseId) {
        return { ...c, lessons: [...c.lessons, newLesson] };
      }
      return c;
    });

    saveCoursesList(updated);
    setExpandedCourseIds((prev) => ({ ...prev, [targetCourseId]: true }));
    navigateToStudioTab("courses", { type: "course", courseId: targetCourseId, lessonId: newLesson.id }, { course: targetCourseId });
    setRecordingToCourseWebinar(null);
    setTargetLessonTitle("");
  };

  const handleSaveSmartTrim = (settings: VideoTrimSettings) => {
    if (!trimmingRecording) return;
    updateRecordingTrim(trimmingRecording.webinarId, settings);
    const reloaded = loadWebinars();
    setWebinars(reloaded);
    setTrimmingRecording(null);
    setTrimNotice("Чистовая версия сохранена (паузы и интервалы вырезаны)!");
    setTimeout(() => setTrimNotice(null), 4000);
  };

  const handleSaveMonetization = (monetization: RecordingMonetization) => {
    if (!monetizingRecording) return;
    updateRecordingMonetization(monetizingRecording.webinarId, monetization);
    const reloaded = loadWebinars();
    setWebinars(reloaded);
    setMonetizingRecording(null);
  };

  const handleSaveVideoProtection = (settings: VideoProtectionSettings) => {
    if (!protectionModalTarget) return;

    if (protectionModalTarget.type === "lesson" && protectionModalTarget.courseId && protectionModalTarget.lessonId) {
      const courseId = protectionModalTarget.courseId;
      const lessonId = protectionModalTarget.lessonId;
      const updated = courses.map((c) => {
        if (c.id === courseId) {
          return {
            ...c,
            lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, protection: settings } : l)),
          };
        }
        return c;
      });
      saveCoursesList(updated);
    } else if (protectionModalTarget.type === "webinar" && protectionModalTarget.webinarId) {
      const webinarId = protectionModalTarget.webinarId;
      const targetWebinar = webinars.find((w) => w.id === webinarId);
      if (targetWebinar?.recording) {
        const curMonetization = targetWebinar.recording.monetization || {
          isPaid: false,
          priceRub: 1490,
          accessDays: 90,
          salesCount: 0,
          watermarkEnabled: true,
          singleSessionEnforced: true,
        };
        updateRecordingMonetization(webinarId, {
          ...curMonetization,
          watermarkEnabled: settings.watermarkEnabled,
          singleSessionEnforced: settings.singleSessionEnabled,
        });
        setWebinars(loadWebinars());
      }
    }

    setProtectionModalTarget(null);
  };

  // Filtered webinars
  const filteredWebinars = useMemo(() => {
    if (webinarFilter === "scheduled") {
      return webinars.filter((w) => w.status === "scheduled" || w.status === "live");
    }
    if (webinarFilter === "records") {
      return webinars.filter((w) => w.recording || w.status === "finished");
    }
    return webinars;
  }, [webinars, webinarFilter]);

  // Selected item references
  const selectedWebinar = useMemo(() => {
    if (selectedView.type === "webinar") {
      return webinars.find((w) => w.id === selectedView.id) || null;
    }
    return null;
  }, [selectedView, webinars]);

  const selectedCourse = useMemo(() => {
    if (selectedView.type === "course") {
      return courses.find((c) => c.id === selectedView.courseId) || null;
    }
    return null;
  }, [selectedView, courses]);

  const selectedLesson = useMemo(() => {
    if (selectedView.type === "course" && selectedView.lessonId && selectedCourse) {
      return selectedCourse.lessons.find((l) => l.id === selectedView.lessonId) || null;
    }
    return null;
  }, [selectedView, selectedCourse]);

  // Theme styling tokens
  const isDark = theme === "dark";
  const t = useMemo(() => {
    return isDark
      ? {
          bg: "#090d16",
          headerBg: "#0f172a",
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
          liveRed: "#ef4444",
          badgeBg: "#1e293b",
        }
      : {
          bg: "#f8fafc",
          headerBg: "#ffffff",
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
          liveRed: "#dc2626",
          badgeBg: "#f1f5f9",
        };
  }, [isDark]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: t.bg,
        color: t.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          height: 56,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: t.headerBg,
          borderBottom: `1px solid ${t.border}`,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="https://academy.ida-psy.ru"
            style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 10 }}
            title="Перейти на главную страницу Академии"
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: "#ffffff",
                fontSize: "0.92rem",
                boxShadow: "0 2px 4px rgba(15,118,110,0.25)",
              }}
            >
              А
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontWeight: 700, fontSize: "1.05rem", color: t.textPrimary }}>
                  Академия
                </span>
                <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f766e" }}>
                  IDA
                </span>
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#0f766e",
                    background: isDark ? "rgba(15,118,110,0.25)" : "#ccfbf1",
                    border: "1px solid #99f6e4",
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >
                  Beta
                </span>
                <span style={{ fontSize: "0.82rem", color: t.textMuted, marginLeft: 6 }}>
                  • Студия курсов
                </span>
              </div>
            </div>
          </a>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          

          {/* Backup Button */}
          <button
            type="button"
            onClick={() => {
              checkDiskQuota();
              setShowBackupModal(true);
            }}
            title="Офлайн-режим и резервная копия данных"
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: `1px solid ${diskQuota.isLowSpace ? "rgba(239, 68, 68, 0.4)" : t.border}`,
              background: diskQuota.isLowSpace ? (isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2") : t.cardBg,
              color: diskQuota.isLowSpace ? (isDark ? "#fca5a5" : "#dc2626") : t.textSecondary,
              fontSize: "0.78rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>💾</span>
            <span>Бэкап</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? "Светлая тема" : "Тёмная тема"}
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              color: t.textSecondary,
              fontSize: "0.78rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{isDark ? "☀️" : "🌙"}</span>
          </button>

          {typeof localStorage !== "undefined" && localStorage.getItem("platform_email") && (
            <UserAccountMenu
              userEmail={localStorage.getItem("platform_email") || undefined}
              userName={localStorage.getItem("platform_name") || undefined}
              jobTitle="Ведущий / Автор курсов"
              theme={isDark ? "dark" : "light"}
                            onLogout={() => {
                if (window.confirm("Выйти из аккаунта ведущего?")) {
                  localStorage.removeItem("platform_access_token");
                  localStorage.removeItem("platform_user_id");
                  localStorage.removeItem("platform_email");
                  localStorage.removeItem("platform_name");
                  window.location.reload();
                }
              }}
              onSwitchAccount={() => {
                if (window.confirm("Сменить аккаунт ведущего?")) {
                  localStorage.removeItem("platform_access_token");
                  localStorage.removeItem("platform_user_id");
                  localStorage.removeItem("platform_email");
                  localStorage.removeItem("platform_name");
                  window.location.reload();
                }
              }}
            />
          )}
        </div>
      </header>

      {/* Main Two-Panel Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: "calc(100vh - 60px)" }}>
        {/* ========================================================= */}
        {/* LEFT PANEL: NAVIGATION, DIRECTORY, LISTS */}
        {/* ========================================================= */}
        <aside
          style={{
            width: 290,
            minWidth: 260,
            maxWidth: 320,
            background: t.panelBg,
            borderRight: `1px solid ${t.border}`,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Navigation Menu List */}
          <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {/* 0. Обзор и возможности */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("overview", { type: "overview" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: selectedView.type === "overview" ? t.accentBg : "transparent",
                color: selectedView.type === "overview" ? t.accent : t.textPrimary,
                fontWeight: selectedView.type === "overview" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>🏠</span>
              <span>О платформе</span>
            </button>

            {/* 1. Быстрый эфир */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("webinars", { type: "quick_live" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: selectedView.type === "quick_live" ? t.accentBg : "transparent",
                color: selectedView.type === "quick_live" ? t.accent : t.textPrimary,
                fontWeight: selectedView.type === "quick_live" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>⚡</span>
              <span>Быстрый эфир</span>
            </button>

            {/* 2. Вебинары и эфиры */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("webinars", { type: "webinar", id: "" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: selectedView.type === "webinar" ? t.accentBg : "transparent",
                color: selectedView.type === "webinar" ? t.accent : t.textPrimary,
                fontWeight: selectedView.type === "webinar" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1rem" }}>🎙️</span>
                <span>Вебинары и эфиры</span>
              </span>
              {webinars.length > 0 && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: t.textMuted,
                    fontWeight: 500,
                  }}
                >
                  {webinars.length}
                </span>
              )}
            </button>

            {/* 3. Учебные курсы */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("courses", { type: "course", courseId: "" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: selectedView.type === "course" ? t.accentBg : "transparent",
                color: selectedView.type === "course" ? t.accent : t.textPrimary,
                fontWeight: selectedView.type === "course" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1rem" }}>📚</span>
                <span>Учебные курсы</span>
              </span>
              {courses.length > 0 && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: t.textMuted,
                    fontWeight: 500,
                  }}
                >
                  {courses.length}
                </span>
              )}
            </button>

            {/* 4. Студенты и группы */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("students", { type: "students" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "students" && selectedView.type === "students" ? t.accentBg : "transparent",
                color: activeTab === "students" && selectedView.type === "students" ? t.accent : t.textPrimary,
                fontWeight: activeTab === "students" && selectedView.type === "students" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1rem" }}>👥</span>
                <span>Студенты и группы</span>
              </span>
              {students.length > 0 && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: t.textMuted,
                    fontWeight: 500,
                  }}
                >
                  {students.length}
                </span>
              )}
            </button>

            {/* 5. Витрина для сайта */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("afisha", { type: "afisha" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "afisha" && selectedView.type === "afisha" ? t.accentBg : "transparent",
                color: activeTab === "afisha" && selectedView.type === "afisha" ? t.accent : t.textPrimary,
                fontWeight: activeTab === "afisha" && selectedView.type === "afisha" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>✨</span>
              <span>Витрина для сайта</span>
            </button>

            {/* 6. Страницы сайта (CMS) */}
            <button
              type="button"
              onClick={() => {
                navigateToStudioTab("pages", { type: "pages" });
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "pages" && selectedView.type === "pages" ? t.accentBg : "transparent",
                color: activeTab === "pages" && selectedView.type === "pages" ? t.accent : t.textPrimary,
                fontWeight: activeTab === "pages" && selectedView.type === "pages" ? 600 : 400,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ fontSize: "1rem" }}>🌐</span>
              <span>Страницы школы (CMS)</span>
            </button>

            {/* Bottom Actions: Psychologist Demo & Feedback */}
            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${t.borderSubtle}`, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Back to main website */}
              <a
                href="https://academy.ida-psy.ru"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  color: t.textSecondary,
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxSizing: "border-box",
                  transition: "all 0.12s ease",
                }}
                title="Перейти на главную страницу Академии"
              >
                <span>🌐</span>
                <span>На сайт Академии</span>
              </a>

              {/* Prominent Psychologist Workspace (Demo) Button */}
              {onNavigateToSpecialist ? (
                <button
                  type="button"
                  onClick={onNavigateToSpecialist}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                  title="Открыть демонстрационный кабинет психолога"
                >
                  <span style={{ fontSize: "1.1rem" }}>💼</span>
                  <span>Кабинет психолога (демо)</span>
                  <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>→</span>
                </button>
              ) : (
                <a
                  href="https://ida-psy.ru/terminal/staging/?demo=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxSizing: "border-box",
                    boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                  title="Открыть демонстрационный кабинет психолога"
                >
                  <span style={{ fontSize: "1.1rem" }}>💼</span>
                  <span>Кабинет психолога (демо)</span>
                  <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>→</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  navigateToStudioTab("feedback", { type: "feedback" });
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: activeTab === "feedback" && selectedView.type === "feedback" ? t.accentBg : "transparent",
                  color: activeTab === "feedback" && selectedView.type === "feedback" ? t.accent : t.textMuted,
                  fontWeight: activeTab === "feedback" && selectedView.type === "feedback" ? 600 : 400,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  transition: "all 0.12s ease",
                }}
              >
                <span style={{ fontSize: "0.95rem" }}>💬</span>
                <span>Обратная связь</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* RIGHT PANEL: MAIN WORKSPACE & MANIPULATIONS */}
        {/* ========================================================= */}
        <main
          style={{
            flex: 1,
            background: t.bg,
            overflowY: "auto",
            padding: "28px 36px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ======================================================= */}
          {/* VIEW 0: FOUNDER OVERVIEW & VALUE PROPOSITION            */}
          {/* ======================================================= */}
          {selectedView.type === "overview" && (
            <div style={{ maxWidth: 980, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Hero Banner */}
              <div
                style={{
                  padding: "32px 36px",
                  borderRadius: 20,
                  background: isDark
                    ? "linear-gradient(135deg, rgba(15, 118, 110, 0.3) 0%, rgba(30, 41, 59, 0.8) 100%)"
                    : "linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 50%, #ffffff 100%)",
                  border: `1.5px solid ${t.accentBorder}`,
                  boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 28px rgba(15, 118, 110, 0.08)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, color: t.accent, fontSize: "0.78rem", fontWeight: 700, marginBottom: 14 }}>
                  <span>🚀</span> Платформа онлайн-школ и вебинаров нового поколения
                </div>
                <h1 style={{ fontSize: "1.85rem", fontWeight: 900, margin: "0 0 10px 0", color: t.textPrimary, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                  Запустите свою школу психологии без посредников и комиссий
                </h1>
                <p style={{ margin: "0 0 24px 0", fontSize: "1rem", color: t.textSecondary, lineHeight: 1.6, maxWidth: 780 }}>
                  Это ваш личный кабинет основателя. Создавайте курсы, проводите защищённые вебинары без Zoom и принимайте оплату напрямую на свой счёт. Студенты занимаются в удобном кабинете без лишних паролей.
                </p>

                {/* Fast Action Buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigateToStudioTab("courses", { type: "course", courseId: "" });
                    }}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                      color: "#ffffff",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(15, 118, 110, 0.35)",
                    }}
                  >
                    <span>📚 Создать первый курс</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigateToStudioTab("webinars", { type: "quick_live" });
                    }}
                    style={{
                      padding: "12px 22px",
                      borderRadius: 10,
                      border: `1.5px solid ${t.accentBorder}`,
                      background: t.cardBg,
                      color: t.accent,
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>⚡ Начать быстрый эфир</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigateToStudioTab("afisha", { type: "afisha" });
                    }}
                    style={{
                      padding: "12px 20px",
                      borderRadius: 10,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textSecondary,
                      fontSize: "0.92rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>✨ Витрина для вашего сайта</span>
                  </button>
                </div>
              </div>

              {/* 3 Core Founder Pillars */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
                {/* Pillar 1: Direct Acquiring */}
                <div
                  style={{
                    padding: "24px",
                    borderRadius: 16,
                    background: t.cardBg,
                    border: `1.5px solid ${t.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? "rgba(34, 197, 94, 0.15)" : "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                    💳
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: t.textPrimary }}>
                      100% денег вам · 0% комиссии
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.86rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Оплату привязываете вы сами через прямые ссылки на ваш банк или эквайринг (ЮKassa, Т-Банк, СБП, Prodamus, Точка и др.) к каждому образовательному продукту. Платформа IDA не имеет никакого отношения к этим деньгам, не выступает платёжным агентом и не удерживает средства.
                    </p>
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 8, fontSize: "0.78rem", fontWeight: 700, color: isDark ? "#4ade80" : "#16a34a" }}>
                    ✓ 100% денег сразу поступают на ваш банковский счёт
                  </div>
                </div>

                {/* Pillar 2: Security & Piracy Protection */}
                <div
                  style={{
                    padding: "24px",
                    borderRadius: 16,
                    background: t.cardBg,
                    border: `1.5px solid ${t.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? "rgba(99, 102, 241, 0.15)" : "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                    🛡️
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: t.textPrimary }}>
                      Защита от складчин и копирования
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.86rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Динамический водяной знак с email и телефоном ученика плавает поверх видео. Блокировка прямого скачивания медиафайлов и ограничение параллельных сессий.
                    </p>
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 8, fontSize: "0.78rem", fontWeight: 700, color: isDark ? "#818cf8" : "#4f46e5" }}>
                    ✓ Персональный трекинг утечек
                  </div>
                </div>

                {/* Pillar 3: No-Zoom Webinars */}
                <div
                  style={{
                    padding: "24px",
                    borderRadius: 16,
                    background: t.cardBg,
                    border: `1.5px solid ${t.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? "rgba(20, 184, 166, 0.15)" : "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                    🎙️
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: t.textPrimary }}>
                      Вебинары и эфиры без Zoom
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.86rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Встроенная вебинарная комната WebRTC прямо в браузере. Эфиры до 4 часов непрерывно, без зарубежных карт, без установки приложений студентами и без сбоев VPN.
                    </p>
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 8, fontSize: "0.78rem", fontWeight: 700, color: t.accent }}>
                    ✓ Вход по ссылке с телефона и ноутбука
                  </div>
                </div>
              </div>

              {/* Transparent FAQ / "В чём подвох? Почему базовый тариф бесплатный?" */}
              <div
                style={{
                  padding: "26px 30px",
                  borderRadius: 16,
                  background: isDark ? "rgba(30, 41, 59, 0.5)" : "#f8fafc",
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.3rem" }}>💡</span>
                    <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary }}>
                      Главные вопросы основателя школы:
                    </h2>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        checkDiskQuota();
                        setShowBackupModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.cardBg,
                        color: t.accent,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📥 Скачать копию школы (.json)</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                      1. Где хранятся мои тяжёлые видеофайлы?
                    </div>
                    <div style={{ fontSize: "0.83rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Вы можете использовать <strong>любой внешний источник</strong>: VK Видео, Rutube, Kinescope, Telegram, свой сервер или подключить <strong>готовое защищённое хранилище IDA CDN</strong> (без настроек и хостингов). Плеер автоматически накладывает водяные знаки и защищает от скачивания.
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStoragePromoModal(true)}
                      style={{
                        marginTop: 6,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        color: t.accent,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "underline",
                      }}
                    >
                      ☁️ Условия и тарифы хранилища IDA CDN →
                    </button>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                      2. Что будет, если я очищу браузер или сменю ноутбук?
                    </div>
                    <div style={{ fontSize: "0.83rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Ваша школа в полной безопасности. Вы можете в 1 клик <strong>скачать полный архив школы</strong> на диск (кнопка вверху) или синхронизировать его с сервером. Восстановление на новом компьютере занимает 2 секунды через импорт файла.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                      3. Как ученики заходят на курс без паролей?
                    </div>
                    <div style={{ fontSize: "0.83rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      После оплаты ученик получает персональную ссылку или персональный код доступа. Он открывает её со смартфона или ноутбука без регистрации, ввода паролей и подтверждений почты — сразу к просмотру уроков.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                      4. Как устроена оплата и почему комиссия платформы 0%?
                    </div>
                    <div style={{ fontSize: "0.83rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Оплату привязываете вы сами через прямые ссылки на ваш банк или интернет-эквайринг (ЮKassa, Т-Банк, СБП, Prodamus) к каждому курсу или вебинару. Платформа IDA не имеет отношения к этим деньгам, не выступает посредником и не задерживает выплаты. Все 100% средств студентов поступают напрямую на ваш счёт.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                      5. На чём зарабатывает IDA?
                    </div>
                    <div style={{ fontSize: "0.83rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Платформа зарабатывает на прозрачной инфраструктуре: <strong>выделенном видеохранилище IDA CDN</strong> для школ, которым лень настраивать свои S3, ИИ-транскрибации вебинаров в конспекты, официальной сертификации и тарифах для институтов.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                      6. Сколько человек выдержит вебинар?
                    </div>
                    <div style={{ fontSize: "0.83rem", color: t.textSecondary, lineHeight: 1.55 }}>
                      Встроенная комната WebRTC оптимизирована для интерактивных супервизий и практикумов. Для больших эфиров на сотни зрителей доступна трансляция и автозапись сразу в облако.
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflow Stepper */}
              <div
                style={{
                  padding: "24px 28px",
                  borderRadius: 16,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                }}
              >
                <h3 style={{ margin: "0 0 16px 0", fontSize: "1.05rem", fontWeight: 850, color: t.textPrimary }}>
                  Как запустить свою школу за 3 простых шага:
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 15, background: t.accentBg, border: `1px solid ${t.accentBorder}`, color: t.accent, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.85rem" }}>
                      1
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: t.textPrimary, marginBottom: 2 }}>
                        Создайте курс или вебинар
                      </div>
                      <div style={{ fontSize: "0.8rem", color: t.textSecondary, lineHeight: 1.45 }}>
                        Добавьте уроки, домашние задания, прикрепите видео или запланируйте живую встречу.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 15, background: t.accentBg, border: `1px solid ${t.accentBorder}`, color: t.accent, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.85rem" }}>
                      2
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: t.textPrimary, marginBottom: 2 }}>
                        Настройте витрину и оплату
                      </div>
                      <div style={{ fontSize: "0.8rem", color: t.textSecondary, lineHeight: 1.45 }}>
                        Во вкладке «Витрина» задайте название школы, подключите ЮKassa/Prodamus и привяжите домен.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 15, background: t.accentBg, border: `1px solid ${t.accentBorder}`, color: t.accent, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.85rem" }}>
                      3
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: t.textPrimary, marginBottom: 2 }}>
                        Отправьте ссылку ученикам
                      </div>
                      <div style={{ fontSize: "0.8rem", color: t.textSecondary, lineHeight: 1.45 }}>
                        Ученики открывают защищённый плеер или вебинарную комнату с компьютера или смартфона — без логинов и паролей.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW A: QUICK EXPRESS LIVE ROOM (СЕЙЧАС) */}
          {/* ======================================================= */}
          {selectedView.type === "quick_live" && (
            <div style={{ maxWidth: 840, width: "100%", margin: "0 auto" }}>
              {/* Top Banner */}
              <div
                style={{
                  padding: "24px 28px",
                  borderRadius: 16,
                  background: isDark
                    ? "linear-gradient(135deg, rgba(15, 118, 110, 0.25) 0%, rgba(20, 184, 166, 0.08) 100%)"
                    : "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
                  border: `1.5px solid ${t.accentBorder}`,
                  marginBottom: 24,
                  boxShadow: isDark ? "none" : "0 4px 20px rgba(15, 118, 110, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: "1.4rem" }}>⚡</span>
                  <h1 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                    Мгновенный эфир прямо сейчас
                  </h1>
                </div>
                <p style={{ margin: "0 0 20px 0", fontSize: "0.92rem", color: t.textSecondary, lineHeight: 1.5 }}>
                  Без предварительного планирования даты и времени. Создайте видеокомнату за одну секунду, скопируйте ссылку и отправьте студенту. Он войдёт сразу, без регистрации и логинов.
                </p>

                {/* Primary Launch Action */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                  <button
                    type="button"
                    onClick={() => handleStartBroadcast(quickRoomName)}
                    style={{
                      padding: "14px 28px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                      color: "#ffffff",
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      boxShadow: "0 4px 14px rgba(15, 118, 110, 0.35)",
                    }}
                  >
                    <span>▶ Войти в эфир как ведущий</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerCopyFeedback("quick", getQuickLinkByRole(quickRoomName, quickLinkRole));
                      setShowQuickLinkBox(true);
                    }}
                    style={{
                      padding: "14px 24px",
                      borderRadius: 10,
                      border: `1.5px solid ${t.accentBorder}`,
                      background: copiedLinkNotice === "quick" ? t.accent : t.cardBg,
                      color: copiedLinkNotice === "quick" ? "#ffffff" : t.accent,
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{copiedLinkNotice === "quick" ? "✓ Ссылка скопирована!" : "📋 Скопировать ссылку"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      generateNewQuickRoom();
                      setShowQuickLinkBox(false);
                    }}
                    title="Сгенерировать другую случайную комнату"
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textSecondary,
                      fontSize: "0.86rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🔄 Новая комната
                  </button>
                </div>
              </div>

              {/* Direct Link Box — показывается только после клика на копирование, чтобы не занимать место */}
              {showQuickLinkBox && (
                <div
                  style={{
                    padding: "18px 22px",
                    borderRadius: 12,
                    background: t.cardBg,
                    border: `1.5px solid ${t.accent}`,
                    marginBottom: 24,
                    boxShadow: "0 4px 16px rgba(15, 118, 110, 0.12)",
                    animation: "fadeIn 0.2s ease-out",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1rem" }}>📋</span>
                      <span style={{ fontSize: "0.86rem", fontWeight: 800, color: t.accent }}>
                        Ссылка для подключения (скопирована в буфер):
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickLinkBox(false)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textMuted,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                      title="Скрыть блок ссылки"
                    >
                      ✕ Скрыть
                    </button>
                  </div>

                  {/* Роли для подключения */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textMuted }}>
                      Права участника:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickLinkRole("listener");
                        triggerCopyFeedback("quick_input", getQuickLinkByRole(quickRoomName, "listener"));
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: quickLinkRole === "listener" ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                        background: quickLinkRole === "listener" ? t.accentBg : t.cardBg,
                        color: quickLinkRole === "listener" ? t.accent : t.textSecondary,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      👥 Слушатель (вебинар)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickLinkRole("student");
                        triggerCopyFeedback("quick_input", getQuickLinkByRole(quickRoomName, "student"));
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: quickLinkRole === "student" ? `1.5px solid #2563eb` : `1px solid ${t.border}`,
                        background: quickLinkRole === "student" ? "rgba(37, 99, 235, 0.12)" : t.cardBg,
                        color: quickLinkRole === "student" ? "#2563eb" : t.textSecondary,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🎓 Студент (курс / показ работ)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickLinkRole("speaker");
                        triggerCopyFeedback("quick_input", getQuickLinkByRole(quickRoomName, "speaker"));
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: quickLinkRole === "speaker" ? `1.5px solid #7c3aed` : `1px solid ${t.border}`,
                        background: quickLinkRole === "speaker" ? "rgba(124, 58, 237, 0.12)" : t.cardBg,
                        color: quickLinkRole === "speaker" ? "#7c3aed" : t.textSecondary,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🎙️ Со-ведущий
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="text"
                      readOnly
                      value={getQuickLinkByRole(quickRoomName, quickLinkRole)}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: `1px solid ${t.inputBorder}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.88rem",
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => triggerCopyFeedback("quick_input", getQuickLinkByRole(quickRoomName, quickLinkRole))}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: t.accent,
                        color: "#ffffff",
                        fontSize: "0.86rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copiedLinkNotice === "quick_input" ? "✓ Скопировано" : "Копировать"}
                    </button>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: t.textMuted, marginTop: 8 }}>
                    💡 Отправьте эту ссылку в Telegram, WhatsApp или по почте. Вход с любого устройства прямо через браузер без скачивания приложений.
                  </div>
                </div>
              )}

              {/* 3 Practical Features of Quick Express */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div style={{ padding: "18px 20px", borderRadius: 12, background: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>⚡</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 4 }}>
                    Без регистрации
                  </div>
                  <div style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.4 }}>
                    Студенту не нужны пароли и скачивание приложений — всё работает в браузере.
                  </div>
                </div>

                <div style={{ padding: "18px 20px", borderRadius: 12, background: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>🔒</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 4 }}>
                    Защищённый эфир
                  </div>
                  <div style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.4 }}>
                    Шифрование видеотрансляции, чистый звук без задержек и демонстрация экрана.
                  </div>
                </div>

                <div style={{ padding: "18px 20px", borderRadius: 12, background: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>💻</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 4 }}>
                    Запись на жесткий диск
                  </div>
                  <div style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.4 }}>
                    Видео сохраняется прямо на ваш компьютер. Платформа не забирает мастер-файлы, это бесплатно и конфиденциально.
                  </div>
                </div>
              </div>

              {/* Local-First Storage Bar */}
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 20px",
                  borderRadius: 12,
                  background: isDark ? "rgba(15, 118, 110, 0.12)" : "#f0fdfa",
                  border: `1px solid ${t.accentBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.2rem" }}>🛡️</span>
                  <div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: t.textPrimary }}>
                      Автономность Local-First: данные и видео остаются у вас
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary }}>
                      {diskQuota.supported
                        ? `Свободно на диске вашего ПК: ~${diskQuota.freeGb} ГБ (с избытком хватит на десятки видеозаписей).`
                        : "Локальное хранилище готово к сохранению материалов."}{" "}
                      ИИ Gemini подключается по запросу, не забирая ваши мастер-данные.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    checkDiskQuota();
                    setShowBackupModal(true);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.accent,
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  📥 Скачать резервную копию
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW B0: WEBINARS CATALOG & DIRECTORY (ВСЕ ВЕБИНАРЫ)    */}
          {/* ======================================================= */}
          {selectedView.type === "webinar" && (!selectedWebinar || !selectedView.id) && (
            <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <h1
                    style={{
                      fontSize: "1.45rem",
                      fontWeight: 800,
                      color: t.textPrimary,
                      margin: "0 0 6px 0",
                      letterSpacing: "-0.02em",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span>🎙️ Вебинары и прямые эфиры</span>
                    <span
                      style={{
                        fontSize: "0.76rem",
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: t.accentBadgeBg,
                        color: t.accent,
                        fontWeight: 700,
                      }}
                    >
                      {filteredWebinars.length} {filteredWebinars.length === 1 ? "эфир" : "эфиров"}
                    </span>
                  </h1>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: t.textSecondary }}>
                    Планируйте онлайн-встречи, проводите защищённые трансляции и публикуйте записи для студентов.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedView({ type: "quick_live" })}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>⚡ Мгновенный эфир</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)",
                    }}
                  >
                    <span>+ Запланировать вебинар</span>
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                {[
                  { id: "all", label: `Все эфиры (${webinars.length})` },
                  { id: "scheduled", label: `Предстоящие (${webinars.filter((w) => w.status === "scheduled" || w.status === "live").length})` },
                  { id: "records", label: `Записи (${webinars.filter((w) => w.recording || w.status === "finished").length})` },
                ].map((f) => {
                  const active = webinarFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setWebinarFilter(f.id as any)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: `1.5px solid ${active ? t.accent : t.border}`,
                        background: active ? t.accentBg : t.cardBg,
                        color: active ? t.accent : t.textSecondary,
                        fontSize: "0.82rem",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Webinars Cards Grid */}
              {filteredWebinars.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: t.textMuted, background: t.cardBg, borderRadius: 14, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>🎙️</div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: t.textPrimary, marginBottom: 6 }}>
                    В этом разделе пока нет вебинаров
                  </div>
                  <div style={{ fontSize: "0.84rem", maxWidth: 440, margin: "0 auto 18px auto" }}>
                    Запланируйте трансляцию, укажите дату и тему, или создайте быстрый эфир прямо сейчас.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Запланировать первый вебинар
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {filteredWebinars.map((w) => {
                    const isDone = Boolean(w.recording || w.status === "finished");
                    return (
                      <div
                        key={w.id}
                        style={{
                          borderRadius: 14,
                          background: t.cardBg,
                          border: `1px solid ${t.border}`,
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.03)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: isDone
                                  ? isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe"
                                  : isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7",
                                color: isDone
                                  ? isDark ? "#93c5fd" : "#1d4ed8"
                                  : isDark ? "#6ee7b7" : "#15803d",
                              }}
                            >
                              {isDone ? "🎬 Запись сохранена" : "🗓 Запланирован"}
                            </span>
                            <span style={{ fontSize: "0.76rem", color: t.textMuted }}>
                              {w.scheduledDate} {w.scheduledTime ? `в ${w.scheduledTime}` : ""}
                            </span>
                          </div>

                          <h3
                            onClick={() => setSelectedView({ type: "webinar", id: w.id })}
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 700,
                              color: t.textPrimary,
                              margin: "0 0 8px 0",
                              cursor: "pointer",
                              lineHeight: 1.35,
                            }}
                          >
                            {w.title}
                          </h3>

                          {w.description && (
                            <p style={{ fontSize: "0.82rem", color: t.textSecondary, margin: "0 0 14px 0", lineHeight: 1.45, maxHeight: 60, overflow: "hidden" }}>
                              {w.description}
                            </p>
                          )}

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: "0.76rem", color: t.textMuted, marginBottom: 16 }}>
                            <span>⏱ {w.durationMinutes || 60} мин</span>
                            <span>👥 {w.registeredCount || 0} участников</span>
                            <span>💳 {w.priceRub ? `${w.priceRub} ₽` : "Бесплатно"}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${t.borderSubtle}`, paddingTop: 14, gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedView({ type: "webinar", id: w.id })}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: `1px solid ${t.accent}`,
                              background: t.accentBg,
                              color: t.accent,
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Настроить и эфир →
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartBroadcast(w.roomName)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: t.accent,
                              color: "#ffffff",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            title="Войти в комнату эфира"
                          >
                            ▶ В эфир
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWebinar(w.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: "#ef4444",
                              fontSize: "0.82rem",
                              cursor: "pointer",
                            }}
                            title="Удалить"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW B: SELECTED WEBINAR (ЭФИР + ОБРЕЗКА + ЗАПИСЬ) */}
          {/* ======================================================= */}
          {selectedView.type === "webinar" && selectedWebinar && (
            <div style={{ maxWidth: 880, width: "100%", margin: "0 auto" }}>
              {/* Back & Fast Schedule Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setSelectedView({ type: "webinar", id: "" })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>← Все вебинары</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Запланировать вебинар
                </button>
              </div>

              {/* Webinar Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  paddingBottom: 20,
                  marginBottom: 24,
                  borderBottom: `1px solid ${t.border}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: selectedWebinar.recording || selectedWebinar.status === "finished"
                          ? isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe"
                          : isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7",
                        color: selectedWebinar.recording || selectedWebinar.status === "finished"
                          ? (isDark ? "#93c5fd" : "#1d4ed8")
                          : (isDark ? "#6ee7b7" : "#15803d"),
                      }}
                    >
                      {selectedWebinar.recording || selectedWebinar.status === "finished" ? "🎬 Запись сохранена" : "🗓 Запланирован"}
                    </span>
                    <span style={{ fontSize: "0.84rem", color: t.textMuted }}>
                      Дата: {selectedWebinar.scheduledDate} в {selectedWebinar.scheduledTime} ({selectedWebinar.durationMinutes} мин)
                    </span>
                  </div>

                  <h1 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 6px 0", color: t.textPrimary }}>
                    {selectedWebinar.title}
                  </h1>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: t.textSecondary, maxWidth: 640 }}>
                    {selectedWebinar.description}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteWebinar(selectedWebinar.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      background: "transparent",
                      color: isDark ? "#fca5a5" : "#dc2626",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Удалить
                  </button>
                </div>
              </div>

              {/* Action Bar: Start Broadcast & Copy Link */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 24,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 4 }}>
                    Эфирная комната: <code style={{ color: t.accent }}>{selectedWebinar.roomName}</code>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: t.textSecondary }}>
                    Зарегистрировано слушателей: <b>{selectedWebinar.registeredCount}</b>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleStartBroadcast(selectedWebinar.roomName)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>▶ Войти в эфир</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerCopyFeedback(selectedWebinar.id, getGuestLinkForRoom(selectedWebinar.roomName))}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: copiedLinkNotice === selectedWebinar.id ? t.accent : t.cardHoverBg,
                      color: copiedLinkNotice === selectedWebinar.id ? "#ffffff" : t.textPrimary,
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{copiedLinkNotice === selectedWebinar.id ? "✓ Ссылка скопирована!" : "👥 Ссылка для слушателей"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerCopyFeedback(`${selectedWebinar.id}-speaker`, getSpeakerLinkForRoom(selectedWebinar.roomName))}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: copiedLinkNotice === `${selectedWebinar.id}-speaker` ? "#7c3aed" : t.cardHoverBg,
                      color: copiedLinkNotice === `${selectedWebinar.id}-speaker` ? "#ffffff" : t.textPrimary,
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Ссылка для спикера или со-ведущего с правом показа экрана и микрофоном"
                  >
                    <span>{copiedLinkNotice === `${selectedWebinar.id}-speaker` ? "✓ Ссылка скопирована!" : "🎙️ Ссылка со-ведущего"}</span>
                  </button>
                </div>
              </div>

              {/* Webinar Listeners, 2 Registration Forms & Batch Certificates for BOTH Categories */}
              {(() => {
                const paidWebinarStudents = students.filter((s) => isStudentPaidForWebinar(s, selectedWebinar.id));
                const paidCount =
                  paidWebinarStudents.length > 0
                    ? paidWebinarStudents.length
                    : students.filter((s) => isStudentPaidForWebinar(s)).length;
                const freeWebinarStudents = students.filter(
                  (s) =>
                    ((s.webinarIds && s.webinarIds.includes(selectedWebinar.id)) || s.participationType === "free_reg") &&
                    !isStudentPaidForWebinar(s, selectedWebinar.id)
                );
                const freeRegCount =
                  freeWebinarStudents.length > 0
                    ? freeWebinarStudents.length
                    : students.filter((s) => !isStudentPaidForWebinar(s)).length;
                const baseLink = selectedWebinar.guestLink || generateWebinarLinks(selectedWebinar).guestLink;
                const freeFormLink = `${baseLink}${baseLink.includes("?") ? "&" : "?"}reg=free`;
                const paidFormLink = `${baseLink}${baseLink.includes("?") ? "&" : "?"}reg=paid`;

                return (
                  <div
                    style={{
                      padding: "20px 24px",
                      borderRadius: 14,
                      background: isDark
                        ? "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.92) 100%)"
                        : "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)",
                      border: `1.5px solid ${isDark ? "rgba(251, 191, 36, 0.35)" : "#fcd34d"}`,
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
                      <div style={{ flex: "1 1 380px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: "1.25rem" }}>🎓</span>
                          <span style={{ fontWeight: 800, fontSize: "1.02rem", color: t.textPrimary }}>
                            Сертификаты слушателям вебинара и рассылка по обеим категориям
                          </span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
                          При входе в вебинарную комнату слушателям доступны <b>две формы регистрации</b>: бесплатная регистрация на эфир и платный тариф «Запись + Сертификат». Вы можете в 1 клик выпустить и разослать именные сертификаты отдельно на категорию <b>«Платники»</b>, отдельно на <b>«Бесплатную регистрацию»</b> или сразу на обе категории.
                        </div>

                        {/* Category counters */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                          <div
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              background: isDark ? "rgba(16, 185, 129, 0.16)" : "#ecfdf5",
                              border: "1px solid #10b981",
                              fontSize: "0.78rem",
                              color: isDark ? "#6ee7b7" : "#065f46",
                              fontWeight: 700,
                            }}
                          >
                            💳 Категория «Платники» (запись + сертификат): <b>{paidCount} чел.</b>
                          </div>
                          <div
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              background: isDark ? "rgba(2, 132, 199, 0.16)" : "#f0f9ff",
                              border: "1px solid #0284c7",
                              fontSize: "0.78rem",
                              color: isDark ? "#7dd3fc" : "#0369a1",
                              fontWeight: 700,
                            }}
                          >
                            🆓 Бесплатная регистрация (эфир): <b>{freeRegCount} чел.</b>
                          </div>
                        </div>

                        {/* Direct links to the 2 registration forms */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => triggerCopyFeedback(`${selectedWebinar.id}-reg-free`, freeFormLink)}
                            style={{
                              padding: "6px 11px",
                              borderRadius: 8,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: t.textPrimary,
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                            title="Скопировать ссылку на форму бесплатной регистрации на прямой эфир"
                          >
                            <span>
                              {copiedLinkNotice === `${selectedWebinar.id}-reg-free`
                                ? "✓ Ссылка скопирована!"
                                : "🔗 Форма 1: Бесплатная регистрация (?reg=free)"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerCopyFeedback(`${selectedWebinar.id}-reg-paid`, paidFormLink)}
                            style={{
                              padding: "6px 11px",
                              borderRadius: 8,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: t.textPrimary,
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                            title="Скопировать ссылку на форму регистрации тарифа «Запись + Сертификат»"
                          >
                            <span>
                              {copiedLinkNotice === `${selectedWebinar.id}-reg-paid`
                                ? "✓ Ссылка скопирована!"
                                : "🔗 Форма 2: Тариф «Запись + Сертификат» (?reg=paid)"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPreviewLobbyTab("free");
                              setShowStudentPagePreviewModal({
                                title: selectedWebinar.title,
                                date: selectedWebinar.scheduledDate,
                                time: selectedWebinar.scheduledTime,
                                desc: selectedWebinar.description || "Онлайн-эфир с разбором практических примеров и ответами на вопросы.",
                                priceRub: selectedWebinar.priceRub || 990,
                                webinarId: selectedWebinar.id,
                              });
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: `1.5px solid ${t.accent}`,
                              background: t.accentBg,
                              color: t.accent,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                            title="Открыть наглядный предпросмотр страницы регистрации и посмотреть обе формы глазами слушателя"
                          >
                            <span>👁️ Посмотреть, как выглядит страница для студентов</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 295 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setCertificateModalTarget({
                              type: "webinar",
                              webinarId: selectedWebinar.id,
                              category: "paid_only",
                            })
                          }
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #d97706, #b45309)",
                            color: "#ffffff",
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)",
                          }}
                        >
                          <span>💳</span>
                          <span>Сертификаты категории «Платники» + Почта</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCertificateModalTarget({
                              type: "webinar",
                              webinarId: selectedWebinar.id,
                              category: "free_only",
                            })
                          }
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #0284c7, #0369a1)",
                            color: "#ffffff",
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                          }}
                        >
                          <span>🆓</span>
                          <span>Сертификаты «Бесплатная регистрация» + Почта</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCertificateModalTarget({
                              type: "webinar",
                              webinarId: selectedWebinar.id,
                              category: "all_registered",
                            })
                          }
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: `1px solid ${t.border}`,
                            background: t.cardBg,
                            color: t.textPrimary,
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                        >
                          👥 Выпустить и разослать на обе категории сразу
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Afisha & Global Cross-Promo Section for Webinar */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: isDark
                    ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%)"
                    : "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
                  border: `1.5px solid ${t.accentBorder}`,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: t.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🌐 Витрина для вашего сайта и общая афиша школ</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 2 }}>
                      Покажите вебинар на витрине своего сайта и в общей афише дружественных школ для привлечения новых слушателей.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigateToStudioTab("afisha", { type: "afisha", singleItemId: selectedWebinar.id }, { item: selectedWebinar.id });
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>✨ Код виджета для сайта</span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "start" }}>
                  <TopicFieldEditor
                    value={selectedWebinar.topicTag || "cbt_anxiety"}
                    onChange={(newTag) => {
                      const updated = webinars.map((w) =>
                        w.id === selectedWebinar.id ? { ...w, topicTag: newTag } : w
                      );
                      saveWebinarsList(updated);
                    }}
                    theme={t}
                  />

                  <div>
                    <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary, marginBottom: 5 }}>
                      Название школы / центра
                    </label>
                    <input
                      type="text"
                      value={selectedWebinar.schoolName || ""}
                      placeholder="Например: Академия КПТ"
                      onChange={(e) => {
                        const updated = webinars.map((w) =>
                          w.id === selectedWebinar.id ? { ...w, schoolName: e.target.value } : w
                        );
                        saveWebinarsList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary, marginBottom: 5 }}>
                      Стоимость участия (₽, 0 = Бесплатно)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={selectedWebinar.priceRub ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        const updated = webinars.map((w) =>
                          w.id === selectedWebinar.id ? { ...w, priceRub: val } : w
                        );
                        saveWebinarsList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary, marginBottom: 5 }}>
                      Ссылка на прямую оплату вебинара (ваш банк / эквайринг)
                    </label>
                    <input
                      type="url"
                      placeholder="https://yookassa.ru/... или https://tinkoff.ru/... или ссылка СБП / Prodamus"
                      value={selectedWebinar.paymentUrl ?? ""}
                      onChange={(e) => {
                        const updated = webinars.map((w) =>
                          w.id === selectedWebinar.id ? { ...w, paymentUrl: e.target.value.trim() } : w
                        );
                        saveWebinarsList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ marginTop: 5, fontSize: "0.72rem", color: t.textSecondary, lineHeight: 1.45 }}>
                      💡 <strong>Прямая оплата:</strong> Ссылку на оплату формируете вы в личном кабинете своего банка (ЮKassa, Т-Банк, СБП, Prodamus). Платформа IDA не имеет отношения к этим деньгам, комиссия 0% — средства идут напрямую на ваш счёт.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", fontWeight: 700, color: t.textPrimary, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedWebinar.publishToGlobalCatalog !== false}
                        onChange={(e) => {
                          const updated = webinars.map((w) =>
                            w.id === selectedWebinar.id ? { ...w, publishToGlobalCatalog: e.target.checked } : w
                          );
                          saveWebinarsList(updated);
                        }}
                      />
                      <span>🌐 Выложить в общую витрину платформы</span>
                    </label>
                    <div style={{ marginLeft: 22, fontSize: "0.72rem", color: t.textSecondary }}>
                      Вебинар появится в открытом каталоге Академии для всех пользователей и специалистов.
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", fontWeight: 600, color: t.textSecondary, cursor: "pointer", marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedWebinar.isFeatured)}
                        onChange={(e) => {
                          const updated = webinars.map((w) =>
                            w.id === selectedWebinar.id ? { ...w, isFeatured: e.target.checked } : w
                          );
                          saveWebinarsList(updated);
                        }}
                      />
                      <span>🔥 Отметить как «Хит сезона»</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Video Recording & Manipulation Section */}
              <div
                style={{
                  padding: "24px 28px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px 0", color: t.textPrimary }}>
                      🎬 Видеозапись вебинара
                    </h2>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: t.textSecondary }}>
                      Предпросмотр, обрезка лишнего хронометража и экспорт в курс.
                    </p>
                  </div>

                  {selectedWebinar.recording?.videoUrl && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => setTrimmingRecording(selectedWebinar.recording || null)}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 8,
                          border: `1px solid ${selectedWebinar.recording?.trimSettings?.cutIntervals && selectedWebinar.recording.trimSettings.cutIntervals.length > 0 ? (isDark ? "#34d399" : "#059669") : t.border}`,
                          background: selectedWebinar.recording?.trimSettings?.cutIntervals && selectedWebinar.recording.trimSettings.cutIntervals.length > 0 ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5") : t.cardBg,
                          color: selectedWebinar.recording?.trimSettings?.cutIntervals && selectedWebinar.recording.trimSettings.cutIntervals.length > 0 ? (isDark ? "#34d399" : "#059669") : t.textPrimary,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Умная вырезка пауз, кофе-брейков и технических заминок"
                      >
                        <span>✂️ Редактор (кофе-брейки)</span>
                        {selectedWebinar.recording?.trimSettings?.cutIntervals && selectedWebinar.recording.trimSettings.cutIntervals.length > 0 && (
                          <span style={{ fontSize: "0.7rem", padding: "1px 5px", borderRadius: 4, background: isDark ? "#065f46" : "#a7f3d0", color: isDark ? "#ecfdf5" : "#065f46" }}>
                            {selectedWebinar.recording.trimSettings.cutIntervals.length} вырезок
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMonetizingRecording(selectedWebinar.recording || null)}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 8,
                          border: `1px solid ${selectedWebinar.recording?.monetization?.isPaid ? (isDark ? "#fbbf24" : "#d97706") : t.border}`,
                          background: selectedWebinar.recording?.monetization?.isPaid ? (isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb") : t.cardBg,
                          color: selectedWebinar.recording?.monetization?.isPaid ? (isDark ? "#fbbf24" : "#b45309") : t.textPrimary,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Платная продажа отдельной записи без курса"
                      >
                        <span>💳 Продажа записи</span>
                        {selectedWebinar.recording?.monetization?.isPaid && (
                          <span style={{ fontSize: "0.7rem", padding: "1px 5px", borderRadius: 4, background: isDark ? "#78350f" : "#fde68a", color: isDark ? "#fef3c7" : "#92400e" }}>
                            {selectedWebinar.recording.monetization.priceRub} ₽
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const mon = selectedWebinar.recording?.monetization;
                          setProtectionModalTarget({
                            type: "webinar",
                            webinarId: selectedWebinar.id,
                            title: selectedWebinar.title,
                            settings: {
                              isProtected: !!(mon?.watermarkEnabled || mon?.singleSessionEnforced),
                              watermarkEnabled: mon?.watermarkEnabled ?? true,
                              singleSessionEnabled: mon?.singleSessionEnforced ?? true,
                              disableDownload: true,
                            },
                          });
                        }}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 8,
                          border: `1px solid ${selectedWebinar.recording?.monetization?.watermarkEnabled ? (isDark ? "#a78bfa" : "#7c3aed") : t.border}`,
                          background: selectedWebinar.recording?.monetization?.watermarkEnabled ? (isDark ? "rgba(124, 58, 237, 0.15)" : "#f5f3ff") : t.cardBg,
                          color: selectedWebinar.recording?.monetization?.watermarkEnabled ? (isDark ? "#c4b5fd" : "#6d28d9") : t.textPrimary,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Защита видео от сливов и складчин (водяной знак, запрет скачивания)"
                      >
                        <span>🛡️ Защитить видео</span>
                        {selectedWebinar.recording?.monetization?.watermarkEnabled && (
                          <span style={{ fontSize: "0.7rem", padding: "1px 5px", borderRadius: 4, background: isDark ? "#4c1d95" : "#ddd6fe", color: isDark ? "#ede9fe" : "#5b21b6" }}>
                            ВКЛ
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewingPlayerRecId(selectedWebinar.id)}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          background: t.cardBg,
                          color: t.accent,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Предпросмотр защищенного плеера для покупателей"
                      >
                        <span>👁️ Плеер</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCertificateModalTarget({ type: "webinar", webinarId: selectedWebinar.id })}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 8,
                          border: `1px solid ${isDark ? "#fbbf24" : "#d97706"}`,
                          background: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
                          color: isDark ? "#fbbf24" : "#b45309",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Выдать сертификаты участникам вебинара и сформировать пакет (запись + сертификат)"
                      >
                        <span>🎓 Пакет: Сертификаты</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRecordingToCourseWebinar(selectedWebinar);
                          setTargetCourseId(courses[0]?.id || "");
                          setTargetLessonTitle(selectedWebinar.title);
                        }}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 8,
                          border: `1px solid ${t.accentBorder}`,
                          background: t.accentBg,
                          color: t.accent,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>↗ В курс</span>
                      </button>

                      <a
                        href={selectedWebinar.recording.videoUrl}
                        download={`webinar-${selectedWebinar.id}.mp4`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          background: t.cardHoverBg,
                          color: t.textSecondary,
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>💾 MP4</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Recording Storage Mode Bar */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: t.cardHoverBg,
                    border: `1px solid ${t.borderSubtle}`,
                    marginBottom: 16,
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: t.textPrimary }}>
                      Режим сохранения:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateWebinarStorageMode(selectedWebinar.id, "local")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${(selectedWebinar.recordingStorageMode || "local") === "local" ? t.accent : t.border}`,
                        background: (selectedWebinar.recordingStorageMode || "local") === "local" ? t.accentBg : t.cardBg,
                        color: (selectedWebinar.recordingStorageMode || "local") === "local" ? t.accent : t.textSecondary,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      💻 На диск автора (Локально)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateWebinarStorageMode(selectedWebinar.id, "cloud")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${selectedWebinar.recordingStorageMode === "cloud" ? t.accent : t.border}`,
                        background: selectedWebinar.recordingStorageMode === "cloud" ? t.accentBg : t.cardBg,
                        color: selectedWebinar.recordingStorageMode === "cloud" ? t.accent : t.textSecondary,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ☁️ В облако IDA
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {diskQuota.supported && (
                      <span
                        style={{
                          fontSize: "0.76rem",
                          color: diskQuota.isLowSpace ? "#dc2626" : t.textMuted,
                          fontWeight: 600,
                        }}
                      >
                        🖥️ Диск: {diskQuota.freeGb} ГБ свободно
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "0.74rem",
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: (selectedWebinar.autoCloudFallback !== false)
                          ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7")
                          : (isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"),
                        color: (selectedWebinar.autoCloudFallback !== false)
                          ? (isDark ? "#6ee7b7" : "#15803d")
                          : t.textMuted,
                        fontWeight: 700,
                      }}
                      title="Если на компьютере заканчивается память (< 2 ГБ), видео автоматически продолжит сохраняться в облако"
                    >
                      🛡️ Авто-сброс в облако: {(selectedWebinar.autoCloudFallback !== false) ? "ВКЛ" : "ВЫКЛ"}
                    </span>
                  </div>
                </div>

                {/* Video Player */}
                {selectedWebinar.recording?.videoUrl ? (
                  <div>
                    <div
                      style={{
                        position: "relative",
                        background: "#000000",
                        borderRadius: 10,
                        overflow: "hidden",
                        marginBottom: 16,
                      }}
                    >
                      <video
                        ref={videoRef}
                        controls
                        src={selectedWebinar.recording.videoUrl}
                        style={{ width: "100%", maxHeight: 420, display: "block" }}
                      />
                    </div>

                    {/* Video Trimming Controls */}
                    <div
                      style={{
                        padding: "16px 18px",
                        borderRadius: 10,
                        background: t.cardHoverBg,
                        border: `1px solid ${t.borderSubtle}`,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: t.textPrimary, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>✂️ Обрезка видео (отсечь ожидание в начале и пустой хвост)</span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.78rem", color: t.textSecondary, marginBottom: 4 }}>
                            Отрезать в начале (секунды):
                          </label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="number"
                              min={0}
                              value={trimStartSeconds}
                              onChange={(e) => setTrimStartSeconds(Number(e.target.value))}
                              style={{
                                width: 90,
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: `1px solid ${t.inputBorder}`,
                                background: t.inputBg,
                                color: t.textPrimary,
                                fontSize: "0.85rem",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (videoRef.current) {
                                  setTrimStartSeconds(Math.floor(videoRef.current.currentTime));
                                }
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg,
                                color: t.textSecondary,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              Взять текущее время плеера
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.78rem", color: t.textSecondary, marginBottom: 4 }}>
                            Отрезать в конце (секунды):
                          </label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="number"
                              min={0}
                              value={trimEndSeconds}
                              onChange={(e) => setTrimEndSeconds(Number(e.target.value))}
                              style={{
                                width: 90,
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: `1px solid ${t.inputBorder}`,
                                background: t.inputBg,
                                color: t.textPrimary,
                                fontSize: "0.85rem",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (videoRef.current) {
                                  setTrimEndSeconds(Math.floor(videoRef.current.currentTime));
                                }
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg,
                                color: t.textSecondary,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              Взять текущее время плеера
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTrimNotice("Метки обрезки сохранены! При экспорте в курс видео начнется с указанной секунды.");
                            setTimeout(() => setTrimNotice(null), 4000);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 6,
                            border: "none",
                            background: t.accent,
                            color: "#ffffff",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Сохранить обрезку
                        </button>

                        {trimNotice && (
                          <span style={{ fontSize: "0.8rem", color: isDark ? "#6ee7b7" : "#0f766e", fontWeight: 600 }}>
                            ✓ {trimNotice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "36px 20px",
                      borderRadius: 10,
                      background: t.cardHoverBg,
                      border: `1px dashed ${t.border}`,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎥</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 4 }}>
                      Запись ещё не сформирована
                    </div>
                    <div style={{ fontSize: "0.82rem", color: t.textSecondary, maxWidth: 480, margin: "0 auto 16px auto", lineHeight: 1.45 }}>
                      Видеозапись появится здесь автоматически после того, как вы завершите прямой эфир.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = webinars.map((w) => {
                          if (w.id === selectedWebinar.id) {
                            return {
                              ...w,
                              recording: {
                                id: `rec-${Date.now()}`,
                                webinarId: w.id,
                                webinarTitle: w.title,
                                recordedAt: new Date().toISOString(),
                                durationMinutes: 60,
                                fileSizeMb: 350,
                                s3Key: "records/demo.mp4",
                                videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                status: "ready" as const,
                                expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
                              },
                            };
                          }
                          return w;
                        });
                        saveWebinarsList(updated);
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.cardBg,
                        color: t.accent,
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + Прикрепить тестовую видеозапись
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW C0: COURSES CATALOG & DIRECTORY (ВСЕ КУРСЫ)        */}
          {/* ======================================================= */}
          {selectedView.type === "course" && (!selectedCourse || !selectedView.courseId) && (
            <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <h1
                    style={{
                      fontSize: "1.45rem",
                      fontWeight: 800,
                      color: t.textPrimary,
                      margin: "0 0 6px 0",
                      letterSpacing: "-0.02em",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span>📚 Учебные курсы школы</span>
                    <span
                      style={{
                        fontSize: "0.76rem",
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: t.accentBadgeBg,
                        color: t.accent,
                        fontWeight: 700,
                      }}
                    >
                      {courses.length} {courses.length === 1 ? "курс" : "курсов"}
                    </span>
                  </h1>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: t.textSecondary }}>
                    Создавайте обучающие программы, наполняйте их уроками, конспектами и видеоматериалами.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(true)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 12px rgba(15, 118, 110, 0.25)",
                  }}
                >
                  <span>+ Создать курс</span>
                </button>
              </div>

              {/* Courses Cards Grid */}
              {courses.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: t.textMuted, background: t.cardBg, borderRadius: 14, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>📚</div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: t.textPrimary, marginBottom: 6 }}>
                    Курсы пока не созданы
                  </div>
                  <div style={{ fontSize: "0.84rem", maxWidth: 440, margin: "0 auto 18px auto" }}>
                    Добавьте первый учебный курс школы, определите его программу и наполните уроками.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCourseModal(true)}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Создать курс
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {courses.map((c) => {
                    const totalLessons = c.lessons?.length || 0;
                    const totalModules = c.modules?.length || 0;
                    return (
                      <div
                        key={c.id}
                        style={{
                          borderRadius: 14,
                          background: t.cardBg,
                          border: `1px solid ${t.border}`,
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.03)",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: isDark ? "rgba(20, 184, 166, 0.2)" : "#ccfbf1",
                                color: isDark ? "#5eead4" : "#0f766e",
                              }}
                            >
                              {PSYCHOLOGY_TOPICS.find((tp) => tp.id === c.topicTag)?.label || "Курс"}
                            </span>
                            <span style={{ fontSize: "0.76rem", color: t.textMuted }}>
                              {c.authorName ? `Ведущий: ${c.authorName}` : ""}
                            </span>
                          </div>

                          <h3
                            onClick={() => setSelectedView({ type: "course", courseId: c.id })}
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 700,
                              color: t.textPrimary,
                              margin: "0 0 8px 0",
                              cursor: "pointer",
                              lineHeight: 1.35,
                            }}
                          >
                            {c.title}
                          </h3>

                          {c.description && (
                            <p style={{ fontSize: "0.82rem", color: t.textSecondary, margin: "0 0 14px 0", lineHeight: 1.45, maxHeight: 60, overflow: "hidden" }}>
                              {c.description}
                            </p>
                          )}

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: "0.76rem", color: t.textMuted, marginBottom: 16 }}>
                            <span>📖 Уроков: {totalLessons}</span>
                            {totalModules > 0 && <span>🗂 Модулей: {totalModules}</span>}
                            <span>💳 {c.priceRub ? `${c.priceRub} ₽` : "Бесплатно"}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${t.borderSubtle}`, paddingTop: 14, gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedView({ type: "course", courseId: c.id })}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: `1px solid ${t.accent}`,
                              background: t.accentBg,
                              color: t.accent,
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Редактировать →
                          </button>
                          <a
                            href={`/?role=student&course=${c.id}&env=${isDemoModeActive() ? "demo" : "live"}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: `1px solid #bfdbfe`,
                              background: isDark ? "rgba(37, 99, 235, 0.2)" : "#eff6ff",
                              color: "#2563eb",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Открыть этот курс в студенческом интерфейсе"
                          >
                            <span>👁️</span>
                            <span>Студент</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddLessonModalForCourse(c.id);
                            }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: t.textPrimary,
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Добавить урок"
                          >
                            + Урок
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(c.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: "#ef4444",
                              fontSize: "0.82rem",
                              cursor: "pointer",
                            }}
                            title="Удалить"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW C: SELECTED COURSE OVERVIEW */}
          {/* ======================================================= */}
          {selectedView.type === "course" && selectedCourse && !selectedView.lessonId && (
            <div style={{ maxWidth: 880, width: "100%", margin: "0 auto" }}>
              {/* Back & Fast Create Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setSelectedView({ type: "course", courseId: "" })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>← Все курсы</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Создать курс
                </button>
              </div>

              {/* Course Top Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  paddingBottom: 20,
                  marginBottom: 24,
                  borderBottom: `1px solid ${t.border}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleCourseStatus(selectedCourse.id)}
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background: selectedCourse.status === "published"
                          ? isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7"
                          : t.badgeBg,
                        color: selectedCourse.status === "published"
                          ? (isDark ? "#6ee7b7" : "#15803d")
                          : t.textMuted,
                      }}
                    >
                      {selectedCourse.status === "published" ? "✓ Опубликован (нажмите, чтобы скрыть)" : "Черновик (нажмите, чтобы опубликовать)"}
                    </button>
                    <span style={{ fontSize: "0.82rem", color: t.textMuted }}>
                      Создан: {selectedCourse.createdAt} · Автор: {selectedCourse.authorName || "Преподаватель"}
                    </span>
                  </div>

                  <h1 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 8px 0", color: t.textPrimary }}>
                    {selectedCourse.title}
                  </h1>
                  <p style={{ margin: 0, fontSize: "0.92rem", color: t.textSecondary, maxWidth: 640 }}>
                    {selectedCourse.description}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <a
                    href={`/?role=student&course=${selectedCourse.id}&env=${isDemoModeActive() ? "demo" : "live"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#ffffff",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                    }}
                    title="Открыть этот курс в студенческом кабинете (как его видят ваши студенты)"
                  >
                    <span>👁️</span>
                    <span>Как видит студент ↗</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigateToStudioTab("students", { type: "students" });
                      setStudentFilterCourseId(selectedCourse.id);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.accent,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Открыть список слушателей этого курса"
                  >
                    <span>👥</span>
                    <span>Слушатели ({students.filter((s) => s.courseIds.includes(selectedCourse.id)).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportStudents(selectedCourse.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Скачать список слушателей этого курса в Excel"
                  >
                    <span>📊</span>
                    <span>В Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCertificateModalTarget({ type: "course", courseId: selectedCourse.id })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${isDark ? "#fbbf24" : "#d97706"}`,
                      background: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
                      color: isDark ? "#fbbf24" : "#b45309",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Сгенерировать сертификаты для выпускников этого курса"
                  >
                    <span>🎓</span>
                    <span>Сертификаты</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerCopyFeedback(`course-${selectedCourse.id}`, `${getOrigin()}/?course=${selectedCourse.id}`)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: copiedLinkNotice === `course-${selectedCourse.id}` ? t.accent : t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedLinkNotice === `course-${selectedCourse.id}` ? "✓ Ссылка скопирована" : "📋 Ссылка на курс"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCourse(selectedCourse.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      background: "transparent",
                      color: isDark ? "#fca5a5" : "#dc2626",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Afisha & Global Cross-Promo Section for Course */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: isDark
                    ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%)"
                    : "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
                  border: `1.5px solid ${t.accentBorder}`,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: t.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🌐 Витрина для вашего сайта и общая афиша школ</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 2 }}>
                      Разместите курс на витрине своего сайта и в общей афише дружественных школ для привлечения новых студентов.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigateToStudioTab("afisha", { type: "afisha", singleItemId: selectedCourse.id }, { item: selectedCourse.id });
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>✨ Код виджета для сайта</span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "start" }}>
                  <TopicFieldEditor
                    value={selectedCourse.topicTag || "cbt_anxiety"}
                    onChange={(newTag) => {
                      const updated = courses.map((c) =>
                        c.id === selectedCourse.id ? { ...c, topicTag: newTag } : c
                      );
                      saveCoursesList(updated);
                    }}
                    theme={t}
                  />

                  <div>
                    <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary, marginBottom: 5 }}>
                      Название школы / центра
                    </label>
                    <input
                      type="text"
                      value={selectedCourse.schoolName || ""}
                      placeholder="Например: Академия КПТ"
                      onChange={(e) => {
                        const updated = courses.map((c) =>
                          c.id === selectedCourse.id ? { ...c, schoolName: e.target.value } : c
                        );
                        saveCoursesList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary, marginBottom: 5 }}>
                      Стоимость курса (₽, 0 = Бесплатно)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={selectedCourse.priceRub ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        const updated = courses.map((c) =>
                          c.id === selectedCourse.id ? { ...c, priceRub: val } : c
                        );
                        saveCoursesList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 700, color: t.textSecondary, marginBottom: 5 }}>
                      Ссылка на прямую оплату курса (ваш банк / интернет-эквайринг)
                    </label>
                    <input
                      type="url"
                      placeholder="https://yookassa.ru/... или https://tinkoff.ru/... или платёжная ссылка Prodamus / СБП"
                      value={selectedCourse.paymentUrl ?? ""}
                      onChange={(e) => {
                        const updated = courses.map((c) =>
                          c.id === selectedCourse.id ? { ...c, paymentUrl: e.target.value.trim() } : c
                        );
                        saveCoursesList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ marginTop: 5, fontSize: "0.72rem", color: t.textSecondary, lineHeight: 1.45 }}>
                      💡 <strong>Прямая оплата:</strong> Ссылку на оплату генерируете вы сами в личном кабинете своего банка (ЮKassa, Т-Банк, СБП, Prodamus). Платформа IDA не имеет никакого отношения к этим деньгам, комиссия 0% — средства приходят напрямую на ваш счёт.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", fontWeight: 700, color: t.textPrimary, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedCourse.publishToGlobalCatalog !== false}
                        onChange={(e) => {
                          const updated = courses.map((c) =>
                            c.id === selectedCourse.id ? { ...c, publishToGlobalCatalog: e.target.checked } : c
                          );
                          saveCoursesList(updated);
                        }}
                      />
                      <span>🌐 Выложить в общую витрину платформы</span>
                    </label>
                    <div style={{ marginLeft: 22, fontSize: "0.72rem", color: t.textSecondary }}>
                      Курс появится в открытом каталоге Академии для всех пользователей и специалистов.
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem", fontWeight: 600, color: t.textSecondary, cursor: "pointer", marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedCourse.isFeatured)}
                        onChange={(e) => {
                          const updated = courses.map((c) =>
                            c.id === selectedCourse.id ? { ...c, isFeatured: e.target.checked } : c
                          );
                          saveCoursesList(updated);
                        }}
                      />
                      <span>🔥 Отметить как «Хит сезона»</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Course Lessons Structure */}
              <div
                style={{
                  padding: "24px 28px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px 0", color: t.textPrimary }}>
                      Программа курса ({selectedCourse.lessons.length} {selectedCourse.lessons.length === 1 ? "урок" : selectedCourse.lessons.length < 5 ? "урока" : "уроков"}{selectedCourse.modules && selectedCourse.modules.length > 0 ? `, ${selectedCourse.modules.length} ${selectedCourse.modules.length === 1 ? "модуль" : "модуля"}` : ""})
                    </h2>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: t.textSecondary }}>
                      Нажимайте на урок для редактирования видео, конспекта и практического задания.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowAddModuleModalForCourse(selectedCourse.id)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: `1px solid ${t.border}`,
                        background: t.cardHoverBg,
                        color: t.textPrimary,
                        fontSize: "0.84rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      + Добавить модуль
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewLessonModuleId("");
                        setShowAddLessonModalForCourse(selectedCourse.id);
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: t.accent,
                        color: "#ffffff",
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + Добавить урок
                    </button>
                  </div>
                </div>

                {selectedCourse.lessons.length === 0 && (!selectedCourse.modules || selectedCourse.modules.length === 0) ? (
                  <div
                    style={{
                      padding: "36px 20px",
                      borderRadius: 10,
                      background: t.cardHoverBg,
                      border: `1px dashed ${t.border}`,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>📚</div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 4 }}>
                      В этом курсе пока нет уроков
                    </div>
                    <div style={{ fontSize: "0.82rem", color: t.textSecondary, marginBottom: 12 }}>
                      Нажмите кнопку выше, чтобы добавить первый видеоурок или текстовую лекцию.
                    </div>
                  </div>
                ) : selectedCourse.modules && selectedCourse.modules.length > 0 ? (
                  /* Course structured by modules */
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {selectedCourse.modules.map((module, mIdx) => {
                      const moduleLessons = selectedCourse.lessons.filter((l) => l.moduleId === module.id);
                      return (
                        <div
                          key={module.id}
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${t.border}`,
                            background: t.cardHoverBg,
                            overflow: "hidden",
                          }}
                        >
                          {/* Module Header */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 16px",
                              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                              borderBottom: `1px solid ${t.borderSubtle}`,
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: "1rem" }}>📁</span>
                                <span style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary }}>
                                  Модуль {mIdx + 1}: {module.title}
                                </span>
                                <span style={{ fontSize: "0.74rem", color: t.textMuted }}>
                                  ({moduleLessons.length} {moduleLessons.length === 1 ? "урок" : moduleLessons.length < 5 ? "урока" : "уроков"})
                                </span>
                              </div>
                              {module.description && (
                                <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 2, marginLeft: 26 }}>
                                  {module.description}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewLessonModuleId(module.id);
                                  setShowAddLessonModalForCourse(selectedCourse.id);
                                }}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: `1px solid ${t.border}`,
                                  background: t.cardBg,
                                  color: t.accent,
                                  fontSize: "0.76rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                + Урок в модуль
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteModule(selectedCourse.id, module.id)}
                                title="Удалить модуль"
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "transparent",
                                  color: isDark ? "#fca5a5" : "#dc2626",
                                  fontSize: "0.78rem",
                                  cursor: "pointer",
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Module Lessons List */}
                          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {moduleLessons.length === 0 ? (
                              <div style={{ padding: "12px", textAlign: "center", fontSize: "0.78rem", color: t.textMuted }}>
                                В этом модуле пока нет уроков. Нажмите «+ Урок в модуль», чтобы добавить.
                              </div>
                            ) : (
                              moduleLessons.map((lesson) => {
                                const globalIdx = selectedCourse.lessons.findIndex((l) => l.id === lesson.id);
                                return (
                                  <div
                                    key={lesson.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: "10px 14px",
                                      borderRadius: 6,
                                      background: t.cardBg,
                                      border: `1px solid ${t.borderSubtle}`,
                                    }}
                                  >
                                    <div
                                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
                                      onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id, lessonId: lesson.id })}
                                    >
                                      <span style={{ fontSize: "1rem" }}>{lesson.videoUrl ? "🎬" : "📄"}</span>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: "0.88rem", color: t.textPrimary }}>
                                          {lesson.title}
                                        </div>
                                        <div style={{ fontSize: "0.74rem", color: t.textMuted, display: "flex", gap: 10 }}>
                                          <span>⏱ {lesson.duration || "20 мин"}</span>
                                          {lesson.notes && <span>📝 Конспект</span>}
                                          {lesson.assignment && <span>💡 Задание</span>}
                                          {lesson.materials && lesson.materials.length > 0 && <span>📎 {lesson.materials.length} файла</span>}
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <button
                                        type="button"
                                        disabled={globalIdx === 0}
                                        onClick={() => handleMoveLesson(selectedCourse.id, globalIdx, "up")}
                                        style={{
                                          padding: "3px 7px",
                                          borderRadius: 4,
                                          border: `1px solid ${t.border}`,
                                          background: t.cardHoverBg,
                                          color: globalIdx === 0 ? t.textMuted : t.textPrimary,
                                          cursor: globalIdx === 0 ? "default" : "pointer",
                                          fontSize: "0.72rem",
                                        }}
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        disabled={globalIdx === selectedCourse.lessons.length - 1}
                                        onClick={() => handleMoveLesson(selectedCourse.id, globalIdx, "down")}
                                        style={{
                                          padding: "3px 7px",
                                          borderRadius: 4,
                                          border: `1px solid ${t.border}`,
                                          background: t.cardHoverBg,
                                          color: globalIdx === selectedCourse.lessons.length - 1 ? t.textMuted : t.textPrimary,
                                          cursor: globalIdx === selectedCourse.lessons.length - 1 ? "default" : "pointer",
                                          fontSize: "0.72rem",
                                        }}
                                      >
                                        ▼
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id, lessonId: lesson.id })}
                                        style={{
                                          padding: "4px 10px",
                                          borderRadius: 6,
                                          border: `1px solid ${t.border}`,
                                          background: t.cardBg,
                                          color: t.accent,
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                      >
                                        Редактировать
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLesson(selectedCourse.id, lesson.id)}
                                        style={{
                                          padding: "4px 8px",
                                          borderRadius: 6,
                                          border: "none",
                                          background: "transparent",
                                          color: isDark ? "#fca5a5" : "#dc2626",
                                          fontSize: "0.75rem",
                                          cursor: "pointer",
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Unassigned lessons */}
                    {(() => {
                      const unassigned = selectedCourse.lessons.filter(
                        (l) => !l.moduleId || !selectedCourse.modules?.some((m) => m.id === l.moduleId)
                      );
                      if (unassigned.length === 0) return null;
                      return (
                        <div
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${t.border}`,
                            background: t.cardHoverBg,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 16px",
                              background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                              borderBottom: `1px solid ${t.borderSubtle}`,
                              fontWeight: 700,
                              fontSize: "0.88rem",
                              color: t.textSecondary,
                            }}
                          >
                            📌 Общие уроки (без привязки к модулю)
                          </div>
                          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {unassigned.map((lesson) => {
                              const globalIdx = selectedCourse.lessons.findIndex((l) => l.id === lesson.id);
                              return (
                                <div
                                  key={lesson.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "10px 14px",
                                    borderRadius: 6,
                                    background: t.cardBg,
                                    border: `1px solid ${t.borderSubtle}`,
                                  }}
                                >
                                  <div
                                    style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
                                    onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id, lessonId: lesson.id })}
                                  >
                                    <span style={{ fontSize: "1rem" }}>{lesson.videoUrl ? "🎬" : "📄"}</span>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: "0.88rem", color: t.textPrimary }}>
                                        {lesson.title}
                                      </div>
                                      <div style={{ fontSize: "0.74rem", color: t.textMuted, display: "flex", gap: 10 }}>
                                        <span>⏱ {lesson.duration || "20 мин"}</span>
                                        {lesson.notes && <span>📝 Конспект</span>}
                                        {lesson.assignment && <span>💡 Задание</span>}
                                        {lesson.materials && lesson.materials.length > 0 && <span>📎 {lesson.materials.length} файла</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <button
                                      type="button"
                                      disabled={globalIdx === 0}
                                      onClick={() => handleMoveLesson(selectedCourse.id, globalIdx, "up")}
                                      style={{
                                        padding: "3px 7px",
                                        borderRadius: 4,
                                        border: `1px solid ${t.border}`,
                                        background: t.cardHoverBg,
                                        color: globalIdx === 0 ? t.textMuted : t.textPrimary,
                                        cursor: globalIdx === 0 ? "default" : "pointer",
                                        fontSize: "0.72rem",
                                      }}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={globalIdx === selectedCourse.lessons.length - 1}
                                      onClick={() => handleMoveLesson(selectedCourse.id, globalIdx, "down")}
                                      style={{
                                        padding: "3px 7px",
                                        borderRadius: 4,
                                        border: `1px solid ${t.border}`,
                                        background: t.cardHoverBg,
                                        color: globalIdx === selectedCourse.lessons.length - 1 ? t.textMuted : t.textPrimary,
                                        cursor: globalIdx === selectedCourse.lessons.length - 1 ? "default" : "pointer",
                                        fontSize: "0.72rem",
                                      }}
                                    >
                                      ▼
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id, lessonId: lesson.id })}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        border: `1px solid ${t.border}`,
                                        background: t.cardBg,
                                        color: t.accent,
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Редактировать
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLesson(selectedCourse.id, lesson.id)}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: "transparent",
                                        color: isDark ? "#fca5a5" : "#dc2626",
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* Standard linear lessons list when no modules are used */
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedCourse.lessons.map((lesson, idx) => (
                      <div
                        key={lesson.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          borderRadius: 8,
                          background: t.cardHoverBg,
                          border: `1px solid ${t.borderSubtle}`,
                        }}
                      >
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flex: 1 }}
                          onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id, lessonId: lesson.id })}
                        >
                          <span style={{ fontSize: "1.1rem" }}>{lesson.videoUrl ? "🎬" : "📄"}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: t.textPrimary }}>
                              {idx + 1}. {lesson.title}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: t.textMuted, display: "flex", gap: 10 }}>
                              <span>⏱ {lesson.duration || "20 мин"}</span>
                              {lesson.notes && <span>📝 Конспект</span>}
                              {lesson.assignment && <span>💡 Задание</span>}
                              {lesson.materials && lesson.materials.length > 0 && <span>📎 {lesson.materials.length} файла</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveLesson(selectedCourse.id, idx, "up")}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: idx === 0 ? t.textMuted : t.textPrimary,
                              cursor: idx === 0 ? "default" : "pointer",
                              fontSize: "0.75rem",
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === selectedCourse.lessons.length - 1}
                            onClick={() => handleMoveLesson(selectedCourse.id, idx, "down")}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: idx === selectedCourse.lessons.length - 1 ? t.textMuted : t.textPrimary,
                              cursor: idx === selectedCourse.lessons.length - 1 ? "default" : "pointer",
                              fontSize: "0.75rem",
                            }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id, lessonId: lesson.id })}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: t.accent,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(selectedCourse.id, lesson.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "transparent",
                              color: isDark ? "#fca5a5" : "#dc2626",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW D: SELECTED LESSON EDITOR */}
          {/* ======================================================= */}
          {selectedView.type === "course" && selectedCourse && selectedLesson && (
            <div style={{ maxWidth: 880, width: "100%", margin: "0 auto" }}>
              {/* Breadcrumb Navigation */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id })}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: t.accent,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ← Назад к структуре курса
                </button>
                <span style={{ color: t.textMuted }}>/</span>
                <span style={{ fontSize: "0.82rem", color: t.textMuted }}>
                  {selectedCourse.title}
                </span>
              </div>

              {/* Lesson Title & Duration */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                      НАЗВАНИЕ УРОКА:
                    </label>
                    <input
                      type="text"
                      value={selectedLesson.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = courses.map((c) => {
                          if (c.id === selectedCourse.id) {
                            return {
                              ...c,
                              lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, title: val } : l)),
                            };
                          }
                          return c;
                        });
                        saveCoursesList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.inputBorder}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.95rem",
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>
                      ДЛИТЕЛЬНОСТЬ:
                    </label>
                    <input
                      type="text"
                      value={selectedLesson.duration || ""}
                      placeholder="25 мин"
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = courses.map((c) => {
                          if (c.id === selectedCourse.id) {
                            return {
                              ...c,
                              lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, duration: val } : l)),
                            };
                          }
                          return c;
                        });
                        saveCoursesList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.inputBorder}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.95rem",
                      }}
                    />
                  </div>
                </div>

                {/* Module selection for lesson */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.borderSubtle}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textMuted }}>
                    МОДУЛЬ:
                  </label>
                  <select
                    value={selectedLesson.moduleId || ""}
                    onChange={(e) => {
                      const val = e.target.value || undefined;
                      const updated = courses.map((c) => {
                        if (c.id === selectedCourse.id) {
                          return {
                            ...c,
                            lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, moduleId: val } : l)),
                          };
                        }
                        return c;
                      });
                      saveCoursesList(updated);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.85rem",
                      minWidth: 260,
                    }}
                  >
                    <option value="">— Без модуля (общий урок) —</option>
                    {(selectedCourse.modules || []).map((m, idx) => (
                      <option key={m.id} value={m.id}>
                        Модуль {idx + 1}: {m.title}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddModuleModalForCourse(selectedCourse.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardHoverBg,
                      color: t.accent,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Создать новый модуль
                  </button>
                </div>
              </div>

              {/* Lesson Video Section */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary }}>
                    🎬 Видеоматериал к уроку
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {selectedLesson.videoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setProtectionModalTarget({
                            type: "lesson",
                            courseId: selectedCourse.id,
                            lessonId: selectedLesson.id,
                            title: selectedLesson.title,
                            settings: selectedLesson.protection || {
                              isProtected: false,
                              watermarkEnabled: true,
                              singleSessionEnabled: true,
                              disableDownload: true,
                            },
                          });
                        }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          border: `1px solid ${selectedLesson.protection?.isProtected ? (isDark ? "#a78bfa" : "#7c3aed") : t.border}`,
                          background: selectedLesson.protection?.isProtected ? (isDark ? "rgba(124, 58, 237, 0.15)" : "#f5f3ff") : t.cardBg,
                          color: selectedLesson.protection?.isProtected ? (isDark ? "#c4b5fd" : "#6d28d9") : t.textPrimary,
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        title="Защитить видеоурок от скачивания и складчин (водяной знак, 1 поток)"
                      >
                        <span>🛡️ {selectedLesson.protection?.isProtected ? "Защита активна" : "Защитить видео"}</span>
                        {selectedLesson.protection?.isProtected && (
                          <span style={{ fontSize: "0.68rem", padding: "1px 5px", borderRadius: 4, background: isDark ? "#4c1d95" : "#ddd6fe", color: isDark ? "#ede9fe" : "#5b21b6" }}>
                            ВКЛ
                          </span>
                        )}
                      </button>
                    )}

                    {selectedLesson.videoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = courses.map((c) => {
                            if (c.id === selectedCourse.id) {
                              return {
                                ...c,
                                lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, videoUrl: undefined } : l)),
                              };
                            }
                            return c;
                          });
                          saveCoursesList(updated);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: isDark ? "#fca5a5" : "#dc2626",
                          fontSize: "0.76rem",
                          cursor: "pointer",
                        }}
                      >
                        Открепить видео
                      </button>
                    )}
                  </div>
                </div>

                {selectedLesson.videoUrl ? (
                  <div>
                    <div
                      style={{
                        position: "relative",
                        background: "#000000",
                        borderRadius: 8,
                        overflow: "hidden",
                        marginBottom: 10,
                      }}
                      onContextMenu={(e) => {
                        if (selectedLesson.protection?.isProtected) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <video
                        controls
                        controlsList={selectedLesson.protection?.isProtected ? "nodownload" : undefined}
                        disablePictureInPicture={selectedLesson.protection?.isProtected}
                        src={selectedLesson.videoUrl}
                        style={{ width: "100%", maxHeight: 380, display: "block" }}
                      />

                      {/* Floating Dynamic Watermark if protected */}
                      {selectedLesson.protection?.isProtected && selectedLesson.protection.watermarkEnabled && (
                        <div
                          style={{
                            position: "absolute",
                            top: `${lessonWatermarkPos.top}%`,
                            left: `${lessonWatermarkPos.left}%`,
                            transform: "rotate(-12deg)",
                            pointerEvents: "none",
                            userSelect: "none",
                            transition: "all 3.5s ease-in-out",
                            background: "rgba(0, 0, 0, 0.45)",
                            color: "rgba(255, 255, 255, 0.45)",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: "0.76rem",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            border: "1px dashed rgba(255, 255, 255, 0.2)",
                            zIndex: 10,
                          }}
                        >
                          student@ida-psy.ru • ID-7832
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.76rem", color: t.textMuted }}>
                      <span>Источник: <code>{selectedLesson.videoUrl}</code></span>
                      {selectedLesson.protection?.isProtected && (
                        <span style={{ color: isDark ? "#c4b5fd" : "#6d28d9", fontWeight: 600 }}>
                          🛡️ Защищено: водяной знак + запрет скачивания
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <label style={{ fontSize: "0.76rem", fontWeight: 700, color: t.textSecondary }}>
                          Ссылка на видеоматериал (MP4 / Облако / Прямой поток):
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowStoragePromoModal(true)}
                          style={{
                            border: "none",
                            background: isDark ? "rgba(99, 102, 241, 0.15)" : "#eef2ff",
                            color: t.accent,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          ☁️ Подключить защищённое облако IDA CDN
                        </button>
                      </div>
                      <div style={{ fontSize: "0.73rem", color: t.textMuted, lineHeight: 1.4 }}>
                        Поддерживаются любые прямые ссылки: S3-хранилища, VK Видео, Rutube, Telegram CDN, Kinescope, свой сервер или безлимитное облако IDA CDN. Плеер автоматически защитит воспроизведение.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <input
                        type="text"
                        placeholder="https://.../video.mp4 или прямая ссылка на видео"
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = courses.map((c) => {
                            if (c.id === selectedCourse.id) {
                              return {
                                ...c,
                                lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, videoUrl: val } : l)),
                              };
                            }
                            return c;
                          });
                          saveCoursesList(updated);
                        }}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${t.inputBorder}`,
                          background: t.inputBg,
                          color: t.textPrimary,
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>

                    {/* Quick attach from webinars */}
                    {webinars.filter((w) => w.recording?.videoUrl).length > 0 && (
                      <div style={{ fontSize: "0.76rem", color: t.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>Быстро выбрать запись:</span>
                        {webinars.filter((w) => w.recording?.videoUrl).map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              const updated = courses.map((c) => {
                                if (c.id === selectedCourse.id) {
                                  return {
                                    ...c,
                                    lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, videoUrl: w.recording?.videoUrl } : l)),
                                  };
                                }
                                return c;
                              });
                              saveCoursesList(updated);
                            }}
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: `1px solid ${t.border}`,
                              background: t.cardHoverBg,
                              color: t.accent,
                              fontSize: "0.72rem",
                              cursor: "pointer",
                            }}
                          >
                            + {w.title.slice(0, 24)}…
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lesson Notes Section (Rich Editor + Formatting Toolbar + Preview) */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📝 Конспект и тезисы лекции</span>
                      <span style={{ fontSize: "0.74rem", fontWeight: 500, color: t.textMuted }}>
                        (поддерживает заголовки, списки, цитаты и иллюстрации)
                      </span>
                    </div>
                  </div>

                  {/* Switch Editor / Preview */}
                  <div style={{ display: "flex", background: t.cardHoverBg, padding: 3, borderRadius: 8, border: `1px solid ${t.borderSubtle}` }}>
                    <button
                      type="button"
                      onClick={() => setNotesMode("editor")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: notesMode === "editor" ? t.accent : "transparent",
                        color: notesMode === "editor" ? "#ffffff" : t.textSecondary,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✍️ Редактор
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesMode("preview")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: notesMode === "preview" ? t.accent : "transparent",
                        color: notesMode === "preview" ? "#ffffff" : t.textSecondary,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      👁️ Предпросмотр
                    </button>
                  </div>
                </div>

                {notesMode === "editor" ? (
                  <div>
                    {/* Formatting Toolbar */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 10px",
                        borderRadius: "8px 8px 0 0",
                        background: t.cardHoverBg,
                        border: `1px solid ${t.inputBorder}`,
                        borderBottom: "none",
                      }}
                    >
                      <button
                        type="button"
                        title="Жирный шрифт"
                        onClick={() => insertIntoNotes("**", "**", "жирный текст")}
                        style={toolbarBtnStyle(t)}
                      >
                        <b>B</b>
                      </button>
                      <button
                        type="button"
                        title="Курсив"
                        onClick={() => insertIntoNotes("*", "*", "курсив")}
                        style={toolbarBtnStyle(t)}
                      >
                        <i>I</i>
                      </button>
                      <div style={{ width: 1, height: 16, background: t.borderSubtle, margin: "0 2px" }} />
                      <button
                        type="button"
                        title="Заголовок H2"
                        onClick={() => insertIntoNotes("\n## ", "\n", "Заголовок раздела")}
                        style={toolbarBtnStyle(t)}
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        title="Подзаголовок H3"
                        onClick={() => insertIntoNotes("\n### ", "\n", "Подзаголовок")}
                        style={toolbarBtnStyle(t)}
                      >
                        H3
                      </button>
                      <div style={{ width: 1, height: 16, background: t.borderSubtle, margin: "0 2px" }} />
                      <button
                        type="button"
                        title="Маркированный список"
                        onClick={() => insertIntoNotes("\n- ", "\n", "Пункт списка")}
                        style={toolbarBtnStyle(t)}
                      >
                        • Список
                      </button>
                      <button
                        type="button"
                        title="Нумерованный список"
                        onClick={() => insertIntoNotes("\n1. ", "\n", "Первый пункт")}
                        style={toolbarBtnStyle(t)}
                      >
                        1. Список
                      </button>
                      <button
                        type="button"
                        title="Цитата / Важная мысль"
                        onClick={() => insertIntoNotes("\n> ", "\n", "Важная мысль или цитата...")}
                        style={toolbarBtnStyle(t)}
                      >
                        ❞ Цитата
                      </button>
                      <button
                        type="button"
                        title="Разделительная черта"
                        onClick={() => insertIntoNotes("\n---\n", "", "")}
                        style={toolbarBtnStyle(t)}
                      >
                        ──
                      </button>
                      <div style={{ width: 1, height: 16, background: t.borderSubtle, margin: "0 2px" }} />
                      <button
                        type="button"
                        title="Ссылка"
                        onClick={() => insertIntoNotes("[", "](https://example.com)", "текст ссылки")}
                        style={toolbarBtnStyle(t)}
                      >
                        🔗 Ссылка
                      </button>
                      <button
                        type="button"
                        title="Загрузить картинку с компьютера в конспект"
                        onClick={() => notesImageInputRef.current?.click()}
                        style={toolbarBtnStyle(t)}
                      >
                        🖼️ Фото с диска
                      </button>
                      <button
                        type="button"
                        title="Вставить картинку по ссылке"
                        onClick={handleInsertImageUrl}
                        style={toolbarBtnStyle(t)}
                      >
                        🌐 Фото по URL
                      </button>
                      <input
                        ref={notesImageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleUploadNotesImage}
                      />
                    </div>

                    <textarea
                      ref={notesTextareaRef}
                      rows={12}
                      value={selectedLesson.notes || ""}
                      placeholder="Напишите подробный конспект урока. Используйте кнопки форматирования выше для оформления текста, цитат и вставки иллюстраций..."
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = courses.map((c) => {
                          if (c.id === selectedCourse.id) {
                            return {
                              ...c,
                              lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, notes: val } : l)),
                            };
                          }
                          return c;
                        });
                        saveCoursesList(updated);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "0 0 8px 8px",
                        border: `1px solid ${t.inputBorder}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      minHeight: 220,
                      padding: "16px 20px",
                      borderRadius: 8,
                      border: `1px solid ${t.borderSubtle}`,
                      background: t.inputBg,
                      overflowY: "auto",
                    }}
                  >
                    {renderMarkdownNotes(selectedLesson.notes || "", t)}
                  </div>
                )}
              </div>

              {/* Lesson Materials & Attachments Section */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary }}>
                      📎 Прикрепленные материалы и файлы к уроку
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary }}>
                      Шпаргалки, PDF-презентации, бланки тестов и раздаточные материалы для студентов.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => lessonFileInputRef.current?.click()}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: t.cardHoverBg,
                        color: t.textPrimary,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📎 Загрузить файл с компьютера</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAttachFileByUrl}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: t.cardHoverBg,
                        color: t.textSecondary,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      🌐 По ссылке
                    </button>
                    <input
                      ref={lessonFileInputRef}
                      type="file"
                      style={{ display: "none" }}
                      onChange={handleAttachLessonFile}
                    />
                  </div>
                </div>

                {(!selectedLesson.materials || selectedLesson.materials.length === 0) ? (
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: 8,
                      background: t.cardHoverBg,
                      border: `1px dashed ${t.borderSubtle}`,
                      textAlign: "center",
                      fontSize: "0.82rem",
                      color: t.textMuted,
                    }}
                  >
                    К этому уроку еще не прикреплены файлы. Нажмите «Загрузить файл с компьютера» или прикрепите внешнюю ссылку.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedLesson.materials.map((mat) => (
                      <div
                        key={mat.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: t.cardHoverBg,
                          border: `1px solid ${t.borderSubtle}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: "1.2rem" }}>
                            {mat.type === "pdf" || mat.title.toLowerCase().endsWith(".pdf") ? "📕" : mat.type === "image" ? "🖼️" : "📄"}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem", color: t.textPrimary }}>
                              {mat.title}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: t.textMuted }}>
                              {mat.fileSize || "Файл"} {mat.url && mat.url.startsWith("http") ? `· ${mat.url}` : ""}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {mat.url && (
                            <a
                              href={mat.url}
                              target="_blank"
                              rel="noreferrer"
                              download={mat.title}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: t.cardBg,
                                border: `1px solid ${t.border}`,
                                color: t.accent,
                                fontSize: "0.76rem",
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              ⬇️ Скачать
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteLessonMaterial(mat.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "transparent",
                              border: "none",
                              color: isDark ? "#fca5a5" : "#dc2626",
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                            title="Удалить файл"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Practical Assignment Section */}
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 20,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 8 }}>
                  💡 Практическое задание для студента
                </div>
                <textarea
                  rows={3}
                  value={selectedLesson.assignment || ""}
                  placeholder="Сформулируйте конкретное задание для отработки навыка (например: заполнить бланк, провести опрос, записать наблюдения)..."
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = courses.map((c) => {
                      if (c.id === selectedCourse.id) {
                        return {
                          ...c,
                          lessons: c.lessons.map((l) => (l.id === selectedLesson.id ? { ...l, assignment: val } : l)),
                        };
                      }
                      return c;
                    });
                    saveCoursesList(updated);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Back to Course Action */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setSelectedView({ type: "course", courseId: selectedCourse.id })}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✓ Завершить редактирование урока
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW E: STUDENTS & ACCESS REGISTRY (РЕЕСТР ДОСТУПА)   */}
          {/* ======================================================= */}
          {selectedView.type === "students" && (
            <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto" }}>
              {/* Header section */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <h1
                    style={{
                      fontSize: "1.45rem",
                      fontWeight: 800,
                      color: t.textPrimary,
                      margin: "0 0 6px 0",
                      letterSpacing: "-0.02em",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span>👥 Управление доступом студентов</span>
                    <span
                      style={{
                        fontSize: "0.76rem",
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: t.accentBadgeBg,
                        color: t.accent,
                        fontWeight: 700,
                      }}
                    >
                      {filteredStudents.length} из {students.length}
                    </span>
                  </h1>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: t.textSecondary }}>
                    Экономичная база слушателей: назначение курсов, генерация персональных ссылок в 1 клик, импорт и экспорт в Excel.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a
                    href={`${typeof window !== "undefined" ? window.location.origin : "https://academy.ida-psy.ru"}/?role=student&env=demo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${isDark ? "#38bdf8" : "#0284c7"}`,
                      background: isDark ? "rgba(2, 132, 199, 0.15)" : "#f0f9ff",
                      color: isDark ? "#38bdf8" : "#0369a1",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Открыть учебный кабинет студента в демонстрационном режиме (без ввода кода)"
                  >
                    <span>🎓 Демо-класс без кода</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => downloadStudentsTemplateCsv()}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textSecondary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Скачать образец таблицы для заполнения списка студентов"
                  >
                    <span>📄 Шаблон Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportTargetCourseId(courses[0]?.id || "");
                      setShowImportModal(true);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>📥 Импорт из Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportStudents()}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>📊 Выгрузить в Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      checkDiskQuota();
                      setShowBackupModal(true);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Полная резервная копия кабинета (курсы + студенты) для переноса на другой ПК"
                  >
                    <span>💾 Бэкап / Перенос</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCertificateModalTarget({ type: "student" })}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${isDark ? "#fbbf24" : "#d97706"}`,
                      background: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
                      color: isDark ? "#fbbf24" : "#b45309",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Генерация именных сертификатов и пакетов рассылки (запись + сертификат)"
                  >
                    <span>🎓 Выдать сертификаты</span>
                  </button>

                  <button
                    type="button"
                    onClick={openAddStudentModal}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: t.accent,
                      color: "#ffffff",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 8px rgba(15, 118, 110, 0.25)",
                    }}
                  >
                    <span>+</span>
                    <span>Новый студент</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: t.cardBg,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>
                    Всего в базе
                  </div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: t.textPrimary }}>
                    {students.length}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: t.textSecondary, marginTop: 4 }}>
                    Уникальных слушателей
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: t.cardBg,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>
                    Активный доступ
                  </div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: isDark ? "#6ee7b7" : "#059669" }}>
                    {students.filter((s) => s.status === "active").length}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: t.textSecondary, marginTop: 4 }}>
                    Имеют доступ к материалам
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: t.cardBg,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>
                    Приостановлено
                  </div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: isDark ? "#fcd34d" : "#d97706" }}>
                    {students.filter((s) => s.status === "paused").length}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: t.textSecondary, marginTop: 4 }}>
                    Временно заблокирован вход
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: t.cardBg,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: t.textMuted, marginBottom: 4 }}>
                    Курсов охвачено
                  </div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: t.accent }}>
                    {courses.length}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: t.textSecondary, marginTop: 4 }}>
                    Доступных программ
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: t.cardBg,
                  border: `1px solid ${t.border}`,
                  marginBottom: 16,
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="🔍 Поиск по ФИО, Email, Телефону или Telegram..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: t.textMuted, whiteSpace: "nowrap" }}>Курс:</span>
                  <select
                    value={studentFilterCourseId}
                    onChange={(e) => setStudentFilterCourseId(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.84rem",
                    }}
                  >
                    <option value="all">Все курсы ({students.length})</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({students.filter((s) => s.courseIds.includes(c.id)).length})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: t.textMuted, whiteSpace: "nowrap" }}>Статус:</span>
                  <select
                    value={studentFilterStatus}
                    onChange={(e) => setStudentFilterStatus(e.target.value as any)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.84rem",
                    }}
                  >
                    <option value="all">Все статусы</option>
                    <option value="active">🟢 Активен</option>
                    <option value="paused">⏸ Приостановлен</option>
                    <option value="completed">✓ Завершен</option>
                  </select>
                </div>

                {(studentSearch || studentFilterCourseId !== "all" || studentFilterStatus !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearch("");
                      setStudentFilterCourseId("all");
                      setStudentFilterStatus("all");
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardHoverBg,
                      color: t.textSecondary,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>

              {/* Students Table */}
              <div
                style={{
                  background: t.cardBg,
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  overflow: "hidden",
                  boxShadow: isDark ? "none" : "0 2px 10px rgba(0,0,0,0.04)",
                }}
              >
                {filteredStudents.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: t.textMuted }}>
                    <div style={{ fontSize: "2rem", marginBottom: 10 }}>👥</div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 6 }}>
                      Студенты не найдены
                    </div>
                    <div style={{ fontSize: "0.84rem", maxWidth: 440, margin: "0 auto 16px auto" }}>
                      По выбранным условиям фильтрации записей нет. Измените параметры поиска или добавьте студентов.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <button
                        type="button"
                        onClick={openAddStudentModal}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: t.accent,
                          color: "#ffffff",
                          fontSize: "0.84rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        + Добавить студента
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportTargetCourseId(courses[0]?.id || "");
                          setShowImportModal(true);
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: `1px solid ${t.border}`,
                          background: t.cardBg,
                          color: t.textPrimary,
                          fontSize: "0.84rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Импортировать из Excel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.84rem" }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: `1.5px solid ${t.border}`,
                            background: t.cardHoverBg,
                            color: t.textMuted,
                            fontWeight: 700,
                            fontSize: "0.74rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          <th style={{ padding: "12px 16px" }}>Студент / Контакты</th>
                          <th style={{ padding: "12px 16px" }}>Назначенные курсы</th>
                          <th style={{ padding: "12px 16px" }}>Статус доступа</th>
                          <th style={{ padding: "12px 16px" }}>Код / Регистрация</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((st) => {
                          const activeCourses = courses.filter((c) => st.courseIds.includes(c.id));
                          const firstCourseId = st.courseIds[0] || courses[0]?.id;
                          const studentLink = buildStudentLink(st, firstCourseId);

                          return (
                            <tr
                              key={st.id}
                              style={{
                                borderBottom: `1px solid ${t.borderSubtle}`,
                                transition: "background 0.15s ease",
                              }}
                            >
                              {/* Student name & contact */}
                              <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, marginBottom: 4 }}>
                                  {st.fullName}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.78rem", color: t.textSecondary }}>
                                  {st.email && (
                                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <span>✉️</span> {st.email}
                                    </span>
                                  )}
                                  {st.phone && (
                                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <span>📞</span> {st.phone}
                                    </span>
                                  )}
                                  {st.telegram && (
                                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <span>✈️</span> {st.telegram}
                                    </span>
                                  )}
                                  {st.notes && (
                                    <span style={{ fontSize: "0.74rem", color: t.textMuted, fontStyle: "italic", marginTop: 2 }}>
                                      💬 {st.notes}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Courses badges */}
                              <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 320 }}>
                                  {courses.map((c) => {
                                    const hasAccess = st.courseIds.includes(c.id);
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleToggleStudentCourse(st, c.id)}
                                        style={{
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                          border: `1px solid ${hasAccess ? t.accentBorder : t.borderSubtle}`,
                                          background: hasAccess ? t.accentBadgeBg : "transparent",
                                          color: hasAccess ? t.accent : t.textMuted,
                                          fontSize: "0.74rem",
                                          fontWeight: hasAccess ? 700 : 500,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                        title={hasAccess ? "Кликните, чтобы отозвать доступ" : "Кликните, чтобы открыть доступ"}
                                      >
                                        <span>{hasAccess ? "✓" : "+"}</span>
                                        <span>{c.title}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* Status toggle */}
                              <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStudentStatus(st)}
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    background:
                                      st.status === "active"
                                        ? isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7"
                                        : st.status === "paused"
                                        ? isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7"
                                        : isDark ? "rgba(107, 114, 128, 0.2)" : "#f3f4f6",
                                    color:
                                      st.status === "active"
                                        ? isDark ? "#6ee7b7" : "#15803d"
                                        : st.status === "paused"
                                        ? isDark ? "#fcd34d" : "#b45309"
                                        : isDark ? "#9ca3af" : "#4b5563",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                  title="Нажмите, чтобы переключить (Активен / Приостановлен)"
                                >
                                  <span>{st.status === "active" ? "🟢" : st.status === "paused" ? "⏸" : "✓"}</span>
                                  <span>
                                    {st.status === "active" ? "Активен" : st.status === "paused" ? "Приостановлен" : "Завершен"}
                                  </span>
                                </button>
                              </td>

                              {/* Access code & date */}
                              <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.86rem", color: t.textPrimary }}>
                                  {st.accessCode || "—"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: t.textMuted, marginTop: 2 }}>
                                  С {st.registeredAt || "—"}
                                </div>
                              </td>

                              {/* Actions */}
                              <td style={{ padding: "14px 16px", verticalAlign: "top", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                  <button
                                    type="button"
                                    onClick={() => setCertificateModalTarget({ type: "student", studentId: st.id })}
                                    style={{
                                      padding: "5px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${isDark ? "#fbbf24" : "#d97706"}`,
                                      background: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
                                      color: isDark ? "#fbbf24" : "#b45309",
                                      fontSize: "0.76rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                    title="Сгенерировать сертификат для этого студента"
                                  >
                                    <span>🎓</span>
                                    <span>Сертификат</span>
                                  </button>

                                  <a
                                    href={studentLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: "5px 9px",
                                      borderRadius: 6,
                                      border: `1px solid ${t.border}`,
                                      background: t.cardBg,
                                      color: t.accent,
                                      fontSize: "0.76rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      textDecoration: "none",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                    title="Открыть учебный кабинет глазами этого студента (в новой вкладке)"
                                  >
                                    <span>👁️ Войти</span>
                                  </a>

                                  <button
                                    type="button"
                                    onClick={() => triggerCopyFeedback(`stu-${st.id}`, studentLink)}
                                    style={{
                                      padding: "5px 9px",
                                      borderRadius: 6,
                                      border: `1px solid ${t.border}`,
                                      background: copiedLinkNotice === `stu-${st.id}` ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7") : t.cardBg,
                                      color: copiedLinkNotice === `stu-${st.id}` ? (isDark ? "#6ee7b7" : "#15803d") : t.textPrimary,
                                      fontSize: "0.76rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                    title="Скопировать персональную ссылку для студента"
                                  >
                                    {copiedLinkNotice === `stu-${st.id}` ? "✓ Скопировано" : "📋 Ссылка"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openEditStudentModal(st)}
                                    style={{
                                      padding: "5px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${t.border}`,
                                      background: t.cardBg,
                                      color: t.textSecondary,
                                      fontSize: "0.76rem",
                                      cursor: "pointer",
                                    }}
                                    title="Редактировать контакты"
                                  >
                                    ✏️
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStudent(st.id, st.fullName)}
                                    style={{
                                      padding: "5px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${t.border}`,
                                      background: t.cardBg,
                                      color: "#ef4444",
                                      fontSize: "0.76rem",
                                      cursor: "pointer",
                                    }}
                                    title="Удалить студента"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW F: AFISHA & WIDGET GENERATOR (ВИТРИНА ДЛЯ САЙТА)   */}
          {/* ======================================================= */}
          {selectedView.type === "afisha" && (
            <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto" }}>
              <AcademyAfishaGenerator
                key={selectedView.singleItemId || "school-all"}
                defaultSchoolName={
                  courses.find((c) => c.schoolName)?.schoolName ||
                  webinars.find((w) => w.schoolName)?.schoolName ||
                  "Академия практической психологии"
                }
                initialMode={selectedView.singleItemId ? "single" : "school"}
                initialSingleItemId={selectedView.singleItemId || ""}
                theme={isDark ? "dark" : "light"}
                onOpenStudentCourse={(courseId, studentCode) => {
                  const url = studentCode
                    ? `${getOrigin()}/?course=${encodeURIComponent(courseId)}&student=${encodeURIComponent(studentCode)}`
                    : `${getOrigin()}/?course=${encodeURIComponent(courseId)}`;
                  window.open(url, "_blank");
                }}
                onOpenPsychologistWorkspace={() => {
                  if (onNavigateToSpecialist) {
                    onNavigateToSpecialist();
                  } else {
                    window.open("https://ida-psy.ru/terminal/staging/?demo=1", "_blank");
                  }
                }}
              />
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW G: SITE PAGES CMS & BUILDER                        */}
          {/* ======================================================= */}
          {selectedView.type === "pages" && (
            <div style={{ maxWidth: 1280, width: "100%", margin: "0 auto", height: "100%", display: "flex", flexDirection: "column" }}>
              <SitePagesManager isDark={isDark} />
            </div>
          )}

          {/* ======================================================= */}
          {/* VIEW H: SUPPORT & FEEDBACK                             */}
          {/* ======================================================= */}
          {selectedView.type === "feedback" && (
            <div style={{ maxWidth: 840, width: "100%", margin: "0 auto" }}>
              <SupportFeedbackSection terminalUserId="academy_creator" />
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: SCHEDULE WEBINAR */}
      {/* ========================================================= */}
      {showScheduleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "92vh",
              overflowY: "auto",
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "24px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                🎙️ Запланировать вебинар
              </h2>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWebinar}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Тема вебинара:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Разбор кризисных ситуаций в консультировании"
                  value={newWebinarTitle}
                  onChange={(e) => setNewWebinarTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Дата проведения:
                  </label>
                  <input
                    type="date"
                    value={newWebinarDate}
                    onChange={(e) => setNewWebinarDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Время начала:
                  </label>
                  <input
                    type="time"
                    value={newWebinarTime}
                    onChange={(e) => setNewWebinarTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    💳 Тариф «Запись + Сертификат» (₽):
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={newWebinarPaidCertPrice}
                    onChange={(e) => setNewWebinarPaidCertPrice(Math.max(0, Number(e.target.value) || 0))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Краткое описание для слушателей:
                </label>
                <textarea
                  rows={2}
                  placeholder="О чём будет эфир, что подготовить участникам..."
                  value={newWebinarDesc}
                  onChange={(e) => setNewWebinarDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* ===================================================================== */}
              {/* INTERACTIVE STUDENT REGISTRATION PAGE PREVIEW (2 FORMS EXPLAINED)     */}
              {/* ===================================================================== */}
              <div
                style={{
                  marginBottom: 16,
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: isDark ? "rgba(15, 23, 42, 0.75)" : "#f8fafc",
                  border: `1.5px solid ${t.accentBorder}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: "0.86rem", fontWeight: 800, color: t.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👁️ Как страницу регистрации увидят ваши слушатели</span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: t.accentBg,
                      color: t.accent,
                      fontWeight: 700,
                    }}
                  >
                    Интерактивный макет (2 формы в 1 окне)
                  </span>
                </div>

                <div style={{ fontSize: "0.78rem", color: t.textSecondary, lineHeight: 1.45, marginBottom: 12 }}>
                  После создания вебинара система автоматически формирует <b>публичную страницу ожидания и регистрации</b>. На ней работают сразу <b>два варианта записи</b> (вы можете давать общую ссылку или прямую ссылку на нужную вкладку):
                </div>

                {/* Mock Browser Frame showing the Student Lobby */}
                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
                    background: isDark ? "#0f172a" : "#ffffff",
                    overflow: "hidden",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                  }}
                >
                  {/* Browser Address Bar */}
                  <div
                    style={{
                      padding: "7px 12px",
                      background: isDark ? "#1e293b" : "#f1f5f9",
                      borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: "0.72rem",
                      color: t.textMuted,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                      <span style={{ marginLeft: 6, fontFamily: "monospace", color: t.textSecondary }}>
                        https://academy.ida-psy.ru/?mode=webinar&amp;reg={previewLobbyTab}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: previewLobbyTab === "paid" ? "#10b981" : "#0284c7" }}>
                      {previewLobbyTab === "paid" ? "Форма 2: Платники (?reg=paid)" : "Форма 1: Бесплатно (?reg=free)"}
                    </span>
                  </div>

                  {/* Student Page Body */}
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "rgba(99, 102, 241, 0.14)",
                          color: "#6366f1",
                        }}
                      >
                        📅 Эфир: {newWebinarDate || "Завтра"} в {newWebinarTime || "19:00"} МСК
                      </span>
                      <span style={{ fontSize: "0.7rem", color: t.textMuted }}>⏱️ Зал ожидания и регистрация</span>
                    </div>

                    <div style={{ fontSize: "0.96rem", fontWeight: 800, color: t.textPrimary, marginBottom: 4 }}>
                      {newWebinarTitle.trim() || "Разбор кризисных ситуаций в консультировании"}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: t.textSecondary, marginBottom: 12 }}>
                      {newWebinarDesc.trim() || "Онлайн-эфир с разбором практических примеров и ответами на вопросы участников."}
                    </div>

                    {/* Switchable 2 Registration Form Tabs (Click to test!) */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textSecondary, marginBottom: 6 }}>
                        👇 Нажмите на вкладку ниже, чтобы посмотреть обе формы глазами студента:
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setPreviewLobbyTab("free")}
                          style={{
                            padding: "9px 10px",
                            borderRadius: 9,
                            border: previewLobbyTab === "free" ? "2px solid #0284c7" : `1px solid ${t.border}`,
                            background: previewLobbyTab === "free" ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#e0f2fe") : t.cardBg,
                            color: t.textPrimary,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: "0.78rem", color: previewLobbyTab === "free" ? (isDark ? "#38bdf8" : "#0369a1") : t.textPrimary }}>
                            🆓 Бесплатно (только эфир)
                          </div>
                          <div style={{ fontSize: "0.68rem", color: t.textSecondary, marginTop: 2 }}>
                            Участие онлайн без записи и сертификата
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewLobbyTab("paid")}
                          style={{
                            padding: "9px 10px",
                            borderRadius: 9,
                            border: previewLobbyTab === "paid" ? "2px solid #10b981" : `1px solid ${t.border}`,
                            background: previewLobbyTab === "paid" ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5") : t.cardBg,
                            color: t.textPrimary,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: "0.78rem", color: previewLobbyTab === "paid" ? (isDark ? "#34d399" : "#047857") : t.textPrimary }}>
                            💳 Запись + Сертификат ({newWebinarPaidCertPrice} ₽)
                          </div>
                          <div style={{ fontSize: "0.68rem", color: t.textSecondary, marginTop: 2 }}>
                            Эфир + видеозапись + именной сертификат
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Simulated Form Body */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 9,
                        background: previewLobbyTab === "paid"
                          ? (isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5")
                          : (isDark ? "rgba(2, 132, 199, 0.08)" : "#f0f9ff"),
                        border: `1px solid ${previewLobbyTab === "paid" ? "#10b981" : "#0284c7"}`,
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: isDark ? "#0f172a" : "#ffffff",
                            border: `1px solid ${t.border}`,
                            color: t.textMuted,
                            fontSize: "0.73rem",
                          }}
                        >
                          👤 ФИО (для пропуска и сертификата)
                        </div>
                        <div
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: isDark ? "#0f172a" : "#ffffff",
                            border: `1px solid ${t.border}`,
                            color: t.textMuted,
                            fontSize: "0.73rem",
                          }}
                        >
                          ✉️ Email (куда придёт ссылка и сертификат)
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontSize: "0.72rem", color: t.textSecondary }}>
                          {previewLobbyTab === "paid" ? (
                            <>
                              Попадает в базу с тегом <b style={{ color: "#10b981" }}>💳 Категория «Платники»</b> — по ним в 1 клик выпускаются и рассылаются сертификаты.
                            </>
                          ) : (
                            <>
                              Попадает в базу с тегом <b style={{ color: "#0284c7" }}>🆓 Бесплатная регистрация</b> — для подсчёта числа зрителей (им тоже можно выдать сертификаты).
                            </>
                          )}
                        </div>
                        <span
                          style={{
                            padding: "5px 12px",
                            borderRadius: 6,
                            background: previewLobbyTab === "paid" ? "#059669" : "#0284c7",
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "0.73rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {previewLobbyTab === "paid"
                            ? `Оплатить ${newWebinarPaidCertPrice} ₽ и записаться →`
                            : "Зарегистрироваться бесплатно →"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recording Storage Mode */}
              <div
                style={{
                  marginBottom: 20,
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: t.cardHoverBg,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: "0.84rem", fontWeight: 700, color: t.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🎬 Куда сохранять видеозапись эфира</span>
                  </div>
                  {diskQuota.supported && (
                    <span
                      style={{
                        fontSize: "0.74rem",
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: diskQuota.isLowSpace ? "#ef4444" : (isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7"),
                        color: diskQuota.isLowSpace ? "#ffffff" : (isDark ? "#6ee7b7" : "#15803d"),
                        fontWeight: 700,
                      }}
                    >
                      {diskQuota.isLowSpace ? `⚠️ Мало места: ~${diskQuota.freeGb} ГБ` : `🖥️ Свободно: ~${diskQuota.freeGb} ГБ`}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {/* Option 1: Local Disk */}
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${newWebinarRecordMode === "local" ? t.accent : t.border}`,
                      background: newWebinarRecordMode === "local" ? t.accentBg : t.cardBg,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input
                        type="radio"
                        name="recordingMode"
                        checked={newWebinarRecordMode === "local"}
                        onChange={() => setNewWebinarRecordMode("local")}
                        style={{ accentColor: t.accent }}
                      />
                      <span style={{ fontWeight: 700, fontSize: "0.82rem", color: t.textPrimary }}>
                        💻 На компьютер
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.3 }}>
                      Локально на диск автора. Бесплатно, без ограничений по размеру.
                    </span>
                  </label>

                  {/* Option 2: Cloud */}
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${newWebinarRecordMode === "cloud" ? t.accent : t.border}`,
                      background: newWebinarRecordMode === "cloud" ? t.accentBg : t.cardBg,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input
                        type="radio"
                        name="recordingMode"
                        checked={newWebinarRecordMode === "cloud"}
                        onChange={() => setNewWebinarRecordMode("cloud")}
                        style={{ accentColor: t.accent }}
                      />
                      <span style={{ fontWeight: 700, fontSize: "0.82rem", color: t.textPrimary }}>
                        ☁️ В облако IDA CDN
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.3 }}>
                      Быстрый защищённый архив с прямым просмотром студентами.
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowStoragePromoModal(true);
                      }}
                      style={{
                        alignSelf: "flex-start",
                        marginTop: 4,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        color: t.accent,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Тарифы и условия →
                    </button>
                  </label>
                </div>

                {/* Auto Cloud Fallback toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.78rem", color: t.textSecondary }}>
                  <input
                    type="checkbox"
                    checked={newWebinarAutoCloudFallback}
                    onChange={(e) => setNewWebinarAutoCloudFallback(e.target.checked)}
                    style={{ accentColor: t.accent }}
                  />
                  <span>
                    🛡️ Аварийное переключение в облако, если во время эфира закончится место на диске (&lt; 2 ГБ)
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Создать вебинар
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CREATE COURSE */}
      {/* ========================================================= */}
      {showCreateCourseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowCreateCourseModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "24px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                📚 Создать новый курс
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Название курса:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Психологическая помощь при утрате"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Преподаватель / Автор:
                </label>
                <input
                  type="text"
                  placeholder="Имя преподавателя или название центра"
                  value={newCourseAuthor}
                  onChange={(e) => setNewCourseAuthor(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Краткое описание курса:
                </label>
                <textarea
                  rows={3}
                  placeholder="Чему научатся студенты, для кого предназначен курс..."
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Создать курс
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD LESSON */}
      {/* ========================================================= */}
      {showAddLessonModalForCourse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowAddLessonModalForCourse(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "24px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                ➕ Добавить урок в курс
              </h2>
              <button
                type="button"
                onClick={() => setShowAddLessonModalForCourse(null)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLesson}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Тема урока:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Урок 1. Основы работы с сопротивлением"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Module selection in add lesson modal */}
              {(() => {
                const targetCourse = courses.find((c) => c.id === showAddLessonModalForCourse);
                if (!targetCourse?.modules || targetCourse.modules.length === 0) return null;
                return (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                      Модуль курса:
                    </label>
                    <select
                      value={newLessonModuleId}
                      onChange={(e) => setNewLessonModuleId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: `1px solid ${t.inputBorder}`,
                        background: t.inputBg,
                        color: t.textPrimary,
                        fontSize: "0.9rem",
                      }}
                    >
                      <option value="">— Без модуля (общий урок) —</option>
                      {targetCourse.modules.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          Модуль {idx + 1}: {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Длительность:
                  </label>
                  <input
                    type="text"
                    value={newLessonDuration}
                    onChange={(e) => setNewLessonDuration(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary }}>
                      Ссылка на видео (MP4 / облако):
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowStoragePromoModal(true)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: t.accent,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Облако IDA CDN
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="https://.../video.mp4"
                    value={newLessonVideoUrl}
                    onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Краткий конспект / тезисы:
                </label>
                <textarea
                  rows={3}
                  placeholder="Основные пункты урока..."
                  value={newLessonNotes}
                  onChange={(e) => setNewLessonNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddLessonModalForCourse(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Добавить урок
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: ADD MODULE */}
      {/* ========================================================= */}
      {showAddModuleModalForCourse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowAddModuleModalForCourse(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "24px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                📁 Добавить модуль в курс
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModuleModalForCourse(null)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddModule}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Название модуля:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Модуль 1. Основы диагностики и сессии"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Краткое описание модуля (необязательно):
                </label>
                <textarea
                  rows={3}
                  placeholder="Какие темы и навыки изучаются в этом модуле..."
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModuleModalForCourse(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Создать модуль
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: ATTACH RECORDING TO COURSE */}
      {/* ========================================================= */}
      {recordingToCourseWebinar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setRecordingToCourseWebinar(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "24px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                ↗ Отправить запись вебинара в курс
              </h2>
              <button
                type="button"
                onClick={() => setRecordingToCourseWebinar(null)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAttachRecordingToCourse}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  В какой курс добавить урок:
                </label>
                <select
                  required
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Название нового урока в курсе:
                </label>
                <input
                  type="text"
                  required
                  value={targetLessonTitle}
                  onChange={(e) => setTargetLessonTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRecordingToCourseWebinar(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Добавить в курс
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT STUDENT                                 */}
      {/* ========================================================= */}
      {showStudentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: 16,
          }}
          onClick={() => setShowStudentModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                {editingStudent ? "✏️ Редактировать студента" : "👤 Добавить студента"}
              </h2>
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  ФИО студента *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Иванова Анна Сергеевна"
                  value={studentFormFullName}
                  onChange={(e) => setStudentFormFullName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Email:
                  </label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={studentFormEmail}
                    onChange={(e) => setStudentFormEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.88rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Телефон:
                  </label>
                  <input
                    type="tel"
                    placeholder="+7 (999) 000-00-00"
                    value={studentFormPhone}
                    onChange={(e) => setStudentFormPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.88rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Telegram username:
                  </label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={studentFormTelegram}
                    onChange={(e) => setStudentFormTelegram(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.88rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                    Статус доступа:
                  </label>
                  <select
                    value={studentFormStatus}
                    onChange={(e) => setStudentFormStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.88rem",
                    }}
                  >
                    <option value="active">🟢 Активен (открыт)</option>
                    <option value="paused">⏸ Приостановлен</option>
                    <option value="completed">✓ Завершен</option>
                  </select>
                </div>
              </div>

              {/* Course assignments */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>
                  Назначить курсы:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto", padding: "6px 8px", background: t.cardHoverBg, borderRadius: 8, border: `1px solid ${t.borderSubtle}` }}>
                  {courses.map((c) => {
                    const checked = studentFormCourseIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: "0.84rem",
                          color: t.textPrimary,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStudentFormCourseIds([...studentFormCourseIds, c.id]);
                            } else {
                              setStudentFormCourseIds(studentFormCourseIds.filter((id) => id !== c.id));
                            }
                          }}
                        />
                        <span>{c.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Заметка / Комментарий (виден только автору):
                </label>
                <input
                  type="text"
                  placeholder="Оплатил тариф Pro, группа 4..."
                  value={studentFormNotes}
                  onChange={(e) => setStudentFormNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {editingStudent ? "Сохранить изменения" : "Добавить студента"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: IMPORT STUDENTS FROM EXCEL / CSV                   */}
      {/* ========================================================= */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: 16,
          }}
          onClick={() => setShowImportModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                  📥 Импорт базы студентов (Excel / CSV)
                </h2>
                <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 4 }}>
                  Загрузите файл CSV/Excel или вставьте скопированные строки (Ctrl+V). Поддерживаются прямые выгрузки из любых учебных платформ (колонки «Купленные тренинги», «Группы»), Excel и Google Таблиц.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Collapsible Explainer: How table auto-detection & fallback structure works */}
            <details
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: t.cardHoverBg,
                border: `1px solid ${t.border}`,
                fontSize: "0.82rem",
                color: t.textSecondary,
                lineHeight: 1.5,
                marginBottom: 16,
                cursor: "pointer",
              }}
            >
              <summary style={{ fontWeight: 700, color: t.accent, userSelect: "none" }}>
                💡 Как устроено автоопределение и эталонная структура таблицы
              </summary>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, cursor: "default" }}>
                <div>
                  <strong>• Автораспознавание:</strong> Система сама определит столбцы с ФИО, Email, телефоном и курсом в любом порядке из стандартной выгрузки вашей текущей платформы.
                </div>
                <div>
                  <strong>• Эталонная структура колонок:</strong> Если файл нестандартный или не распознался автоматически, приведите таблицу к такому порядку столбцов (или скачайте образец по кнопке справа ниже):
                  <div style={{ marginTop: 4, padding: "6px 8px", background: t.inputBg, borderRadius: 6, fontFamily: "monospace", fontSize: "0.76rem", border: `1px solid ${t.borderSubtle}`, color: t.textPrimary }}>
                    ФИО ; Email ; Телефон ; Telegram ; Курс ; Статус ; Заметки
                  </div>
                </div>
                <div>
                  <strong>• Вставка из Excel / Google Таблиц:</strong> Выделите нужные строки в вашей таблице, нажмите <code>Ctrl+C</code> и вставьте в текстовое поле ниже через <code>Ctrl+V</code>.
                </div>
              </div>
            </details>

            <form onSubmit={handleImportSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Курс для назначения импортированным студентам:
                </label>
                <select
                  value={importTargetCourseId}
                  onChange={(e) => setImportTargetCourseId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                  }}
                >
                  <option value="">Автоопределение из файла / Без привязки (если в файле есть колонка с курсом)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Принудительно назначить: {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  Быстрая загрузка файла (.csv или .txt, включая экспорт из других платформ):
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  style={{ fontSize: "0.84rem", color: t.textPrimary }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: t.textSecondary }}>
                    Или вставьте данные прямо из таблицы:
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadStudentsTemplateCsv()}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: t.accent,
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Скачать образец CSV
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder={`Пример (поддерживаются таблицы с колонками ФИО, Email, Телефон, Курс/Тренинг):\nИванова Анна; ania@mail.ru; +7 999 111-22-33; Практикум КПТ\nПетров Дмитрий; petrov@gmail.com; +7 916 222-33-44; Основы консультирования\n\n💡 Для быстрой миграции: выгрузите пользователей из вашей текущей платформы в CSV и выберите файл выше.`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.82rem",
                    fontFamily: "monospace",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {importReport && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7",
                    color: isDark ? "#6ee7b7" : "#15803d",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    marginBottom: 16,
                  }}
                >
                  ✓ Успешно импортировано! Новых студентов: {importReport.added}, обновлено: {importReport.updated}.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!importText.trim()}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: importText.trim() ? t.accent : t.border,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: importText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Импортировать в базу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно резервной копии и автономности (Local-First) */}
      {showBackupModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBackupModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "92vh",
              overflowY: "auto",
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              color: t.textPrimary,
            }}
          >
            {/* Заголовок */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.5rem" }}>💾</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.18rem", fontWeight: 800, color: t.textPrimary }}>
                    Хранение данных, сервер и резервная копия
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: t.textSecondary, marginTop: 2 }}>
                    Вы сами решаете, где хранятся курсы. Всё прозрачно: без абонентской платы и без скрытых условий.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.3rem",
                  cursor: "pointer",
                  color: t.textSecondary,
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Зелёная плашка стоимости: 100% бесплатно */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                background: isDark ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5",
                border: isDark ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid #a7f3d0",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
                <span style={{ fontSize: "1.35rem" }}>🎁</span>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: isDark ? "#6ee7b7" : "#047857" }}>
                    Стоимость хранения: 0 ₽ (Бесплатно навсегда)
                  </div>
                  <div style={{ fontSize: "0.76rem", color: t.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                    И сохранение на вашем ПК, и синхронизация с сервером Академии, и скачивание резервных копий — бесплатны. Никаких платных тарифов за хранилище или списаний за гигабайты.
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#10b981",
                  color: "#ffffff",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                ✓ Входит в платформу
              </span>
            </div>

            {/* Выбор источника правды: Только на компьютере vs Синхронизация с сервером */}
            <div
              style={{
                padding: "16px",
                borderRadius: 14,
                background: isDark ? "rgba(15, 23, 42, 0.7)" : "#f8fafc",
                border: `1px solid ${t.border}`,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: t.textPrimary }}>
                  🔄 Где хранить базу вашей школы (Источник правды):
                </div>
                <span style={{ fontSize: "0.74rem", color: t.textMuted }}>
                  Выбор можно переключить в любой момент
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {/* Вариант 1: Только у меня на ПК */}
                <div
                  onClick={() => handleChangeStorageSourceMode("local_only")}
                  style={{
                    padding: "14px",
                    borderRadius: 12,
                    border: storageSourceMode === "local_only" ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
                    background: storageSourceMode === "local_only" ? (isDark ? "rgba(99, 102, 241, 0.14)" : "#eef2ff") : t.cardBg,
                    color: t.textPrimary,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 6 }}>
                        💻 Только у меня на ПК
                      </span>
                      {storageSourceMode === "local_only" ? (
                        <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 6, background: t.accent, color: "#fff", fontWeight: 700 }}>
                          ✓ Активно
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.7rem", color: t.textMuted }}>Выбрать</span>
                      )}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: t.textSecondary, marginBottom: 10, lineHeight: 1.4 }}>
                      Главный источник правды — браузер вашего компьютера и сохранённый JSON-файл на диске (C:, D: или флешке). На сервер данные не передаются.
                    </div>

                    <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`, paddingTop: 8, fontSize: "0.74rem", lineHeight: 1.45 }}>
                      <div style={{ color: isDark ? "#86efac" : "#15803d", marginBottom: 5 }}>
                        <b>🟢 100% сохранность и защита от закрытия платформы:</b> Ваши курсы, уроки и материалы принадлежат только вам. Даже если сервис завтра исчезнет, вся школа останется у вас на компьютере. Работает офлайн без интернета.
                      </div>
                      <div style={{ color: isDark ? "#fca5a5" : "#b91c1c" }}>
                        <b>⚠️ Ограничение:</b> Нет автоматической синхронизации со смартфоном или вторым ноутбуком. При поломке ПК восстановление происходит из скачанного файла бэкапа.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px dashed ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem" }}>
                    <span style={{ color: t.textMuted }}>Стоимость:</span>
                    <span style={{ fontWeight: 800, color: isDark ? "#6ee7b7" : "#047857" }}>0 ₽ (Бесплатно навсегда)</span>
                  </div>
                </div>

                {/* Вариант 2: Выгружать на сервер */}
                <div
                  onClick={() => handleChangeStorageSourceMode("cloud_sync")}
                  style={{
                    padding: "14px",
                    borderRadius: 12,
                    border: storageSourceMode === "cloud_sync" ? "2px solid #10b981" : `1px solid ${t.border}`,
                    background: storageSourceMode === "cloud_sync" ? (isDark ? "rgba(16, 185, 129, 0.16)" : "#ecfdf5") : t.cardBg,
                    color: t.textPrimary,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 6 }}>
                        ☁️ Выгружать на сервер
                      </span>
                      {storageSourceMode === "cloud_sync" ? (
                        <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 6, background: "#10b981", color: "#fff", fontWeight: 700 }}>
                          ✓ Активно
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 700 }}>Рекомендуется</span>
                      )}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: t.textSecondary, marginBottom: 10, lineHeight: 1.4 }}>
                      Копия курсов и кодов доступа хранится на сервере для входа с любого устройства, но вы в любой момент можете забрать бэкап и сайт себе.
                    </div>

                    <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`, paddingTop: 8, fontSize: "0.74rem", lineHeight: 1.45 }}>
                      <div style={{ color: isDark ? "#86efac" : "#15803d", marginBottom: 5 }}>
                        <b>🟢 Двойная страховка и удобство:</b> Доступ с любого ноутбука или телефона. При этом нет привязки к сервису — вы в 1 клик скачиваете резервную копию и автономный HTML-сайт на свой ПК или флешку.
                      </div>
                      <div style={{ color: t.textMuted }}>
                        <b>ℹ️ Особенность:</b> Для мгновенной передачи свежих уроков на другие устройства нужен интернет (но создавать курсы можно и офлайн).
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px dashed ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.74rem" }}>
                    <span style={{ color: t.textMuted }}>Стоимость:</span>
                    <span style={{ fontWeight: 800, color: isDark ? "#6ee7b7" : "#047857" }}>0 ₽ (Включено в платформу)</span>
                  </div>
                </div>
              </div>

              {/* Ручное управление синхронизацией с сервером */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={handlePushToServer}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #10b981",
                    background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ecfdf5",
                    color: isDark ? "#6ee7b7" : "#047857",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: isSyncingCloud ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span>☁️</span> {isSyncingCloud ? "Синхронизация..." : "Выгрузить мою базу на сервер"}
                </button>

                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={handlePullFromServer}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textPrimary,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: isSyncingCloud ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <span>⬇️</span> Загрузить с сервера ко мне
                </button>
              </div>

              {lastCloudSyncAt && (
                <div style={{ fontSize: "0.73rem", color: t.textMuted, marginTop: 8, textAlign: "right" }}>
                  Последний обмен с сервером: <b>{lastCloudSyncAt}</b>
                </div>
              )}
            </div>

            {/* Реальная оценка требуемого места и выбор места сохранения */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: isDark ? "rgba(30, 41, 59, 0.6)" : "#f8fafc",
                border: `1px solid ${t.border}`,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.15rem" }}>📊</span>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem", color: t.textPrimary }}>
                      Сколько места потребуется вашему проекту:
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: 6, background: isDark ? "#334155" : "#e2e8f0", color: t.textSecondary, fontWeight: 700 }}>
                  Затраты места: минимальные
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div style={{ padding: "10px 12px", borderRadius: 8, background: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: t.textPrimary, marginBottom: 4 }}>
                    📄 База школы (курсы, тесты, настройки):
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: t.accent, marginBottom: 2 }}>
                    ~1–5 МБ
                  </div>
                  <div style={{ fontSize: "0.72rem", color: t.textSecondary, lineHeight: 1.35 }}>
                    Меньше одной фотографии. Поместится на любой диск (C:, D:), внешнюю флешку или облачный диск.
                  </div>
                </div>

                <div style={{ padding: "10px 12px", borderRadius: 8, background: t.cardBg, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: t.textPrimary, marginBottom: 4 }}>
                    🎬 Видеозаписи вебинаров (если на свой ПК):
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: isDark ? "#6ee7b7" : "#047857", marginBottom: 2 }}>
                    ~200–500 МБ / час
                  </div>
                  <div style={{ fontSize: "0.72rem", color: t.textSecondary, lineHeight: 1.35 }}>
                    Нужно только если вы включаете локальную запись вебинаров в браузере. Вы сами выбираете, на какой диск её сохранять.
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  color: t.textSecondary,
                  lineHeight: 1.45,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
                  border: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  💾 <b>Куда сохранять?</b> При скачивании бэкапа (.JSON) или сайта (.HTML) браузер предлагает выбрать любую папку: <b>диск C:, D:, внешний SSD или флешку</b>.
                </div>
                {diskQuota && diskQuota.supported && (
                  <div style={{ fontSize: "0.72rem", color: t.textMuted }}>
                    Свободно на текущем системном диске: <b>~{diskQuota.freeGb} ГБ</b> (запас огромный)
                  </div>
                )}
              </div>
            </div>

            {/* Блок автономной работы и установки приложения (PWA) */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: isDark ? "rgba(20, 184, 166, 0.12)" : "#f0fdfa",
                border: isDark ? "1px solid rgba(20, 184, 166, 0.3)" : "1px solid #ccfbf1",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 800, color: isDark ? "#5eead4" : "#0f766e", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>⚡ Работа при слабом интернете &amp; Установка на ПК</span>
                </div>
                <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 999, background: "#0d9488", color: "#ffffff", fontWeight: 700 }}>
                  PWA Ready
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: t.textSecondary, lineHeight: 1.45, marginBottom: 10 }}>
                Терминал Академии сохраняет все уроки, тесты и списки студентов в браузере. Вы можете работать без сети или при плохом интернете — все изменения сохранятся. Для быстрого доступа установите Академию как отдельное приложение:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if ((window as any).deferredPrompt) {
                      (window as any).deferredPrompt.prompt();
                    } else {
                      alert("Чтобы установить приложение на компьютер или телефон:\n\n1. В браузере (Chrome / Edge / Safari / Яндекс) нажмите значок «Установить» в адресной строке справа (или в меню браузера: «Установить приложение / Добавить на главный экран»).\n\n2. Приложение откроется в отдельном окне без адресной строки и будет мгновенно запускаться даже без интернета.");
                    }
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0d9488",
                    color: "#ffffff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>📲</span> Установить как приложение (Windows / Mac / Android / iOS)
                </button>
              </div>
            </div>

            {/* Текущее наполнение кабинета */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div style={{ padding: "10px", borderRadius: 8, background: isDark ? "#1e293b" : "#f8fafc", textAlign: "center", border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: t.accent }}>{courses.length}</div>
                <div style={{ fontSize: "0.74rem", color: t.textSecondary }}>Курсов</div>
              </div>
              <div style={{ padding: "10px", borderRadius: 8, background: isDark ? "#1e293b" : "#f8fafc", textAlign: "center", border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: t.accent }}>{courses.reduce((acc, c) => acc + (c.lessons?.length || 0), 0)}</div>
                <div style={{ fontSize: "0.74rem", color: t.textSecondary }}>Уроков</div>
              </div>
              <div style={{ padding: "10px", borderRadius: 8, background: isDark ? "#1e293b" : "#f8fafc", textAlign: "center", border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: t.accent }}>{webinars.length}</div>
                <div style={{ fontSize: "0.74rem", color: t.textSecondary }}>Вебинаров</div>
              </div>
              <div style={{ padding: "10px", borderRadius: 8, background: isDark ? "#1e293b" : "#f8fafc", textAlign: "center", border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: t.accent }}>{students.length}</div>
                <div style={{ fontSize: "0.74rem", color: t.textSecondary }}>Слушателей</div>
              </div>
            </div>

            {/* Результат бэкапа / восстановления / синхронизации */}
            {backupNotice && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: isDark ? "rgba(16, 185, 129, 0.2)" : "#dcfce7",
                  color: isDark ? "#6ee7b7" : "#15803d",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                {backupNotice}
              </div>
            )}

            {/* Скрытый инпут для загрузки бэкапа */}
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleImportBackupFile}
            />

            {/* Кнопки полной независимости: Автономный HTML-сайт и Бэкап */}
            <div
              style={{
                padding: "16px",
                borderRadius: 12,
                background: isDark ? "rgba(99, 102, 241, 0.08)" : "#f5f3ff",
                border: isDark ? "1px solid rgba(99, 102, 241, 0.25)" : "1px solid #ddd6fe",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: "1.2rem" }}>🛡️</span>
                <div style={{ fontSize: "0.9rem", fontWeight: 800, color: t.textPrimary }}>
                  Ваша полная независимость: Автономный сайт и база школы
                </div>
              </div>
              <div style={{ fontSize: "0.76rem", color: t.textSecondary, lineHeight: 1.45, marginBottom: 14 }}>
                Главный страх создателя онлайн-школы — потерять наработки, если платформа закроется или станет недоступной. 
                Мы гарантируем <b>нулевую зависимость</b>: вы можете в любой момент выгрузить готовый автономный сайт и базу школы, сохранить на любой свой диск или флешку и при необходимости запустить на собственном сервере.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Кнопка выгрузки автономного HTML-сайта */}
                <button
                  type="button"
                  onClick={handleExportStandaloneHtmlSite}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: "#059669",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                  }}
                >
                  <span>🌐</span> Скачать автономный HTML-сайт школы (.html для любого хостинга)
                </button>

                {/* Кнопка скачивания бэкапа JSON */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  style={{
                    width: "100%",
                    padding: "11px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                  }}
                >
                  <span>📥</span> Скачать полную базу школы (.JSON на диск C:, D: или флешку)
                </button>

                {/* Кнопка восстановления */}
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textPrimary,
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span>📤</span> Восстановить базу школы из скачанного файла (.JSON)
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  color: t.textSecondary,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* МОДАЛЬНОЕ ОКНО: КАК СТРАНИЦУ РЕГИСТРАЦИИ ВЕБИНАРА ВИДЯТ СЛУШАТЕЛИ (2 ФОРМЫ) */}
      {/* ========================================================================= */}
      {showStudentPagePreviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStudentPagePreviewModal(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 740,
              maxHeight: "92vh",
              overflowY: "auto",
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
              color: t.textPrimary,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary }}>
                  👁️ Страница регистрации и ожидания глазами студента
                </h3>
                <div style={{ fontSize: "0.82rem", color: t.textSecondary, marginTop: 2 }}>
                  Посмотрите, как работают обе формы записи на вебинар («Бесплатно на эфир» и «Платники: Запись + Сертификат»)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentPagePreviewModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.3rem",
                  cursor: "pointer",
                  color: t.textSecondary,
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Пояснение как это устроено */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: isDark ? "rgba(2, 132, 199, 0.14)" : "#f0f9ff",
                  border: "1px solid #0284c7",
                  fontSize: "0.78rem",
                }}
              >
                <div style={{ fontWeight: 800, color: isDark ? "#38bdf8" : "#0369a1", marginBottom: 4 }}>
                  🆓 Форма 1: Бесплатная регистрация (?reg=free)
                </div>
                <div style={{ color: t.textSecondary, lineHeight: 1.4 }}>
                  Слушатель записывается заранее, чтобы вы видели общее количество участников эфира. В базу он попадает со статусом <b>«🆓 Бесплатно (эфир)»</b>.
                </div>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: isDark ? "rgba(16, 185, 129, 0.14)" : "#ecfdf5",
                  border: "1px solid #10b981",
                  fontSize: "0.78rem",
                }}
              >
                <div style={{ fontWeight: 800, color: isDark ? "#34d399" : "#047857", marginBottom: 4 }}>
                  💳 Форма 2: Тариф «Запись + Сертификат» (?reg=paid)
                </div>
                <div style={{ color: t.textSecondary, lineHeight: 1.4 }}>
                  Слушатель оформляет полный пакет ({showStudentPagePreviewModal.priceRub} ₽). В базу он попадает в категорию <b>«💳 Платники»</b> — по ним в 1 клик выпускаются и рассылаются сертификаты.
                </div>
              </div>
            </div>

            {/* Макет экрана студента */}
            <div
              style={{
                borderRadius: 14,
                border: `1.5px solid ${isDark ? "#334155" : "#cbd5e1"}`,
                background: "#0f172a",
                color: "#f8fafc",
                overflow: "hidden",
                boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  padding: "8px 14px",
                  background: "#1e293b",
                  borderBottom: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                }}
              >
                <span>🌐 Зал ожидания и регистрации вебинара (вид для слушателя)</span>
                <span style={{ fontFamily: "monospace", color: "#cbd5e1" }}>
                  ?mode=webinar&amp;reg={previewLobbyTab}
                </span>
              </div>

              <div style={{ padding: "20px 22px" }}>
                <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: "rgba(99, 102, 241, 0.2)", color: "#a5b4fc", fontSize: "0.75rem", fontWeight: 700, marginBottom: 10 }}>
                  📅 Начало эфира: {showStudentPagePreviewModal.date} в {showStudentPagePreviewModal.time} (МСК)
                </div>

                <h4 style={{ margin: "0 0 6px 0", fontSize: "1.18rem", fontWeight: 800, color: "#ffffff" }}>
                  {showStudentPagePreviewModal.title}
                </h4>
                <p style={{ margin: "0 0 16px 0", fontSize: "0.84rem", color: "#cbd5e1", lineHeight: 1.45 }}>
                  {showStudentPagePreviewModal.desc}
                </p>

                {/* Переключатель 2 форм */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>
                    Выберите формат участия (нажмите для проверки формы):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setPreviewLobbyTab("free")}
                      style={{
                        padding: "12px",
                        borderRadius: 10,
                        border: previewLobbyTab === "free" ? "2px solid #38bdf8" : "1px solid #334155",
                        background: previewLobbyTab === "free" ? "rgba(2, 132, 199, 0.22)" : "#1e293b",
                        color: "#ffffff",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "0.86rem", color: previewLobbyTab === "free" ? "#38bdf8" : "#f8fafc" }}>
                        🆓 Бесплатно (только прямой эфир)
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 4 }}>
                        Участие в прямом эфире и чате без видеозаписи и без сертификата
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewLobbyTab("paid")}
                      style={{
                        padding: "12px",
                        borderRadius: 10,
                        border: previewLobbyTab === "paid" ? "2px solid #10b981" : "1px solid #334155",
                        background: previewLobbyTab === "paid" ? "rgba(16, 185, 129, 0.22)" : "#1e293b",
                        color: "#ffffff",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "0.86rem", color: previewLobbyTab === "paid" ? "#34d399" : "#f8fafc" }}>
                        💳 Запись эфира + Сертификат ({showStudentPagePreviewModal.priceRub} ₽)
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 4 }}>
                        Прямой эфир + бессрочный доступ к видеозаписи + именной сертификат на почту
                      </div>
                    </button>
                  </div>
                </div>

                {/* Поля ввода формы */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "#1e293b",
                    border: `1px solid ${previewLobbyTab === "paid" ? "#10b981" : "#0284c7"}`,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: 4 }}>
                        Ваше ФИО (как указать в сертификате):
                      </div>
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", fontSize: "0.82rem" }}>
                        Иванова Мария Сергеевна
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: 4 }}>
                        Ваш Email (для ссылки на вход и сертификата):
                      </div>
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", fontSize: "0.82rem" }}>
                        maria.ivanova@psy-school.ru
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ fontSize: "0.76rem", color: "#cbd5e1" }}>
                      {previewLobbyTab === "paid"
                        ? "✓ После отправки слушатель получает персональный код доступа и попадает в список «💳 Платники»."
                        : "✓ После отправки слушатель получает персональный код на эфир и попадает в список «🆓 Бесплатно»."}
                    </div>
                    <div
                      style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        background: previewLobbyTab === "paid" ? "#10b981" : "#0284c7",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "0.82rem",
                      }}
                    >
                      {previewLobbyTab === "paid"
                        ? `Оплатить ${showStudentPagePreviewModal.priceRub} ₽ и получить пропуск →`
                        : "Зарегистрироваться бесплатно →"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              {showStudentPagePreviewModal.webinarId ? (
                <button
                  type="button"
                  onClick={() => {
                    const w = webinars.find((item) => item.id === showStudentPagePreviewModal.webinarId);
                    if (w) {
                      const url = `${getWebinarShareUrl(w, "listener")}&reg=${previewLobbyTab}`;
                      window.open(url, "_blank");
                    }
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.accent}`,
                    background: t.accentBg,
                    color: t.accent,
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔗 Открыть живую страницу в новой вкладке ({previewLobbyTab === "paid" ? "?reg=paid" : "?reg=free"})
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setShowStudentPagePreviewModal(null)}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: t.accent,
                  color: "#ffffff",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Понятно, закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Trim Modal (Cut Pauses / Coffee Breaks) */}
      {trimmingRecording && (
        <VideoSmartTrimModal
          recording={trimmingRecording}
          isDark={isDark}
          onSave={handleSaveSmartTrim}
          onClose={() => setTrimmingRecording(null)}
        />
      )}

      {/* Recording Monetization Modal (Paid Recording Sales) */}
      {monetizingRecording && (
        <RecordingMonetizationModal
          recording={monetizingRecording}
          isDark={isDark}
          onSave={handleSaveMonetization}
          onClose={() => setMonetizingRecording(null)}
        />
      )}

      {/* Protected Recording Player Preview Modal */}
      {previewingPlayerRecId && (
        <ProtectedRecordingPlayer
          recordingId={previewingPlayerRecId}
          viewerEmail="buyer-demo@example.com"
          viewerName="Демо-покупатель"
          onClose={() => setPreviewingPlayerRecId(null)}
        />
      )}

      {/* Video Protection Settings Modal (Plain-Language Explanation) */}
      {protectionModalTarget && (
        <VideoProtectionModal
          title={protectionModalTarget.title}
          targetType={protectionModalTarget.type}
          currentSettings={protectionModalTarget.settings}
          isDark={isDark}
          onSave={handleSaveVideoProtection}
          onClose={() => setProtectionModalTarget(null)}
        />
      )}

      {/* Certificate Generator & Batch Packaging Modal */}
      {certificateModalTarget && (
        <CertificateGeneratorModal
          students={students}
          onUpdateStudents={saveStudentsList}
          courses={courses}
          webinars={webinars}
          initialTarget={certificateModalTarget}
          isDark={isDark}
          onClose={() => setCertificateModalTarget(null)}
        />
      )}
      {/* Afisha Help Modal */}
      {showAfishaHelpModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowAfishaHelpModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflowY: "auto",
              background: t.cardBg,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
              padding: "26px 30px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.4rem" }}>🏫</span>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                  Как работает витрина школы и вход для студентов
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAfishaHelpModal(false)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: "0.88rem", color: t.textSecondary, lineHeight: 1.55 }}>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}` }}>
                <div style={{ fontWeight: 700, color: t.accent, marginBottom: 4, fontSize: "0.92rem" }}>
                  💡 Главная суть: полноценная онлайн-школа без абонентской платы
                </div>
                <div style={{ color: t.textPrimary, fontSize: "0.85rem" }}>
                  Витрина объединяет все ваши курсы, эфиры, записи и личный кабинет студента в единую систему. Вам не нужны сторонние платные платформы.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: t.textPrimary, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📱 Вариант 1: У вас НЕТ своего сайта (только Telegram, канал или соцсети)</span>
                </div>
                <div>
                  Вам не нужно создавать сайт на Tilda или заказывать разработку. У вашей школы уже есть готовая публичная страница по прямой ссылке на платформе IDA вида <code>https://academy.ida-psy.ru/?mode=afisha&amp;school=название-школы</code>.
                  <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", fontSize: "0.82rem", lineHeight: 1.5 }}>
                    <strong>Как она примерно выглядит для клиента и студента:</strong>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      <li><strong>Шапка школы:</strong> название вашей школы/автора, контакты и способы прямой оплаты (ЮKassa, СБП, Т-Касса, Prodamus).</li>
                      <li><strong>Витрина курсов и вебинаров:</strong> каталог с карточками программ, описанием, тарифами и быстрой записью.</li>
                      <li><strong>Кнопка «🔑 Вход в кабинет студента»:</strong> ученик вводит персональный код (например, <code>st-e9x1</code>) или Email и сразу попадает к своим урокам и записям.</li>
                    </ul>
                    Вы просто копируете готовую прямую ссылку и размещаете её в описании профиля, в шапке Telegram-канала или в Taplink. Студент открывает ссылку с любого устройства, видит ваши курсы и входит в личный кабинет.
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: t.textPrimary, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>💻 Вариант 2: У вас ЕСТЬ свой сайт (Tilda, WordPress, Bitrix)</span>
                </div>
                <div>
                  Скопируйте готовый HTML-код виджета и вставьте его на свой сайт (на Тильде это стандартный блок <strong>T123 «HTML-код»</strong>). На вашем сайте сразу появится красивое расписание, карточки курсов и кнопка входа для учеников.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: t.textPrimary, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🔑 Как студент заходит в купленный курс?</span>
                </div>
                <div>
                  При записи на курс студент получает персональный код доступа (например, <code>st-e9x1</code>) или логинится по своему Email. Нажав кнопку «🔑 Вход в кабинет студента», он вводит код и сразу попадает к своим урокам и материалам.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: t.textPrimary, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>💳 Как принимаются оплаты?</span>
                </div>
                <div>
                  <strong>Оплату привязываете вы сами</strong> через прямые ссылки на ваш банк или интернет-эквайринг (ЮKassa, Т-Банк, СБП, Prodamus, Точка и др.) индивидуально к каждому образовательному продукту (в редакторе курса, вебинара или записи).
                  <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", fontSize: "0.82rem", lineHeight: 1.5 }}>
                    <strong>Важно: платформа IDA не имеет отношения к этим деньгам:</strong>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      <li>Платформа не выступает платёжным агентом и не хранит ваши деньги.</li>
                      <li>Комиссия платформы — <strong>0%</strong> (вы оплачиваете только тариф вашего банка/эквайринга).</li>
                      <li>100% средств студентов зачисляются моментально и напрямую на ваш расчётный счёт или карту.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setShowAfishaHelpModal(false)}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: t.accent,
                  color: "#ffffff",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* МОДАЛЬНОЕ ОКНО: ЗАЩИЩЁННОЕ ВИДЕОХРАНИЛИЩЕ IDA CDN (ТАРИФЫ И УСЛОВИЯ)        */}
      {/* ========================================================================= */}
      {showStoragePromoModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowStoragePromoModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              background: t.cardBg,
              borderRadius: 18,
              border: `1px solid ${t.border}`,
              padding: "26px 30px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                  }}
                >
                  ☁️
                </span>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: t.textPrimary }}>
                    Защищённое видеохранилище IDA Fast CDN
                  </h2>
                  <div style={{ fontSize: "0.78rem", color: t.textMuted }}>
                    Для школ и экспертов, которым нужно готовое решение без возни с серверами
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStoragePromoModal(false)}
                style={{ border: "none", background: "transparent", color: t.textMuted, fontSize: "1.3rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Intro banner */}
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 12,
                background: isDark ? "rgba(14, 165, 233, 0.12)" : "#f0f9ff",
                border: `1px solid ${isDark ? "rgba(14, 165, 233, 0.3)" : "#bae6fd"}`,
                marginBottom: 20,
                fontSize: "0.85rem",
                lineHeight: 1.55,
                color: t.textSecondary,
              }}
            >
              <div style={{ fontWeight: 700, color: isDark ? "#38bdf8" : "#0284c7", marginBottom: 4 }}>
                🎯 Свобода выбора: своё облако бесплатно или наше под ключ
              </div>
              <div>
                Вам <strong>не обязательно</strong> платить нам за хранилище: платформа IDA всегда бесплатно воспроизводит видео из любых ваших ссылок (VK Видео, Rutube, Kinescope, Telegram CDN, своё S3). Но если вам некогда разбираться с настройками хостингов — подключите официальное облако IDA CDN.
              </div>
            </div>

            {/* 3 Key Benefits */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
              <div style={{ padding: "12px 14px", borderRadius: 10, background: t.cardHoverBg, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>⚡</div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: t.textPrimary, marginBottom: 2 }}>
                  Молниеносный CDN
                </div>
                <div style={{ fontSize: "0.76rem", color: t.textMuted, lineHeight: 1.4 }}>
                  Серверы в РФ и Европе. Видео стартует без задержек у любого студента даже при слабом интернете.
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: t.cardHoverBg, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>🛡️</div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: t.textPrimary, marginBottom: 2 }}>
                  Защита от сливов
                </div>
                <div style={{ fontSize: "0.76rem", color: t.textMuted, lineHeight: 1.4 }}>
                  Динамический водяной знак (ФИО и телефон студента) + защита от прямого скачивания через браузер.
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: t.cardHoverBg, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>🎥</div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: t.textPrimary, marginBottom: 2 }}>
                  Автозапись эфиров
                </div>
                <div style={{ fontSize: "0.76rem", color: t.textMuted, lineHeight: 1.4 }}>
                  Записи вебинаров сохраняются прямо в облако без риска переполнить диск вашего ноутбука.
                </div>
              </div>
            </div>

            {/* Pricing Tiers */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: t.textPrimary, marginBottom: 10 }}>
                Тарифы на видеохранилище IDA CDN:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                {/* Tier 1 */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${t.border}`,
                    background: t.cardBg,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Старт
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: t.textPrimary, marginTop: 4 }}>
                      490 ₽ <span style={{ fontSize: "0.76rem", fontWeight: 500, color: t.textMuted }}>/ мес</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 8, lineHeight: 1.45 }}>
                      • <b>50 ГБ</b> защищённого места (~70 часов уроков)<br />
                      • Встроенный плеер с водяными знаками<br />
                      • Трафик до 500 ГБ/мес
                    </div>
                  </div>
                </div>

                {/* Tier 2: Popular */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `2px solid #3b82f6`,
                    background: isDark ? "rgba(59, 130, 246, 0.08)" : "#eff6ff",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: -10,
                      right: 12,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "#3b82f6",
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                    }}
                  >
                    ХИТ ШКОЛ
                  </span>
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Школа Про
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: t.textPrimary, marginTop: 4 }}>
                      1 290 ₽ <span style={{ fontSize: "0.76rem", fontWeight: 500, color: t.textMuted }}>/ мес</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 8, lineHeight: 1.45 }}>
                      • <b>250 ГБ</b> защищённого места (~350 часов уроков)<br />
                      • Прямая автозапись вебинаров в облако<br />
                      • Безлимитный CDN-трафик для студентов
                    </div>
                  </div>
                </div>

                {/* Tier 3: Business */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: `1.5px solid ${t.border}`,
                    background: t.cardBg,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Институт
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: t.textPrimary, marginTop: 4 }}>
                      2 990 ₽ <span style={{ fontSize: "0.76rem", fontWeight: 500, color: t.textMuted }}>/ мес</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 8, lineHeight: 1.45 }}>
                      • <b>1 000 ГБ (1 ТБ)</b> места<br />
                      • Приоритетный HLS-стриминг<br />
                      • Выделенный S3-бакет с вашим доменом
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How to connect banner / contact */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 18px",
                borderRadius: 12,
                background: t.accentBg,
                border: `1px solid ${t.accentBorder}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: t.accent }}>
                  🚀 Хотите активировать облако IDA CDN за 5 минут?
                </div>
                <div style={{ fontSize: "0.78rem", color: t.textPrimary, marginTop: 2 }}>
                  Напишите в службу заботы: мы выделим вам ключ доступа и покажем, как заливать видео прямо из браузера.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href="https://t.me/ida_support_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#0088cc",
                    color: "#ffffff",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ✈️ Подключить в Telegram
                </a>
                <button
                  type="button"
                  onClick={() => setShowStoragePromoModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
