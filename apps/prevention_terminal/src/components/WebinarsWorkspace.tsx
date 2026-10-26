import React, { useState, useMemo } from "react";
import {
  type WebinarItem,
  type AttachedMaterial,
  type CloudRecording,
  type VideoTrimSettings,
  type RecordingMonetization,
  loadWebinars,
  saveWebinars,
  getStorageQuota,
  addWebinar,
  updateWebinar,
  deleteWebinar,
  deleteRecording,
  toggleArchiveRecording,
  updateRecordingTrim,
  updateRecordingMonetization,
  calculateCleanDurationMinutes,
  generateWebinarLinks,
} from "../lib/webinars_store.ts";
import { DEFAULT_COURSE_URL, type TerminalConfig, type TerminalConfigInput } from "../lib/terminal_config.ts";
import { invoke } from "@tauri-apps/api/core";
import {
  type AvailableCourseItem,
  getAvailableCourses,
  saveAvailableCourse,
  deleteAvailableCourse,
  updateDefaultCourseUrl,
  resetCoursesToDefault,
  DEFAULT_PREVENTION_COURSE,
} from "../lib/academy_lms_store.ts";

import ModuleGuideModal from "./LazyModuleGuideModal.tsx";
import { isCommercialOrg } from "../lib/case_meta.ts";
import WebinarWaitingLobby from "./video/WebinarWaitingLobby.tsx";
import VideoSmartTrimModal from "./video/VideoSmartTrimModal.tsx";
import RecordingMonetizationModal from "./video/RecordingMonetizationModal.tsx";
import ProtectedRecordingPlayer from "./video/ProtectedRecordingPlayer.tsx";
import TildaEmbedCodeModal from "./video/TildaEmbedCodeModal.tsx";
import AttachRecordingToCourseModal from "./video/AttachRecordingToCourseModal.tsx";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

interface WebinarsWorkspaceProps {
  cfg: TerminalConfig;
  specialistName?: string;
  mode?: "organizer" | "learner";
  onLaunchStudio?: (roomName: string) => void;
  onConfigSaved?: (cfg: TerminalConfig) => void;
}

export default function WebinarsWorkspace({
  cfg,
  specialistName,
  mode = "organizer",
  onLaunchStudio,
  onConfigSaved,
}: WebinarsWorkspaceProps) {
  const isLearner = mode === "learner";
  const isIntl = getTerminalEdition() === "intl";
  const isEducator =
    cfg?.workspace_preset === "educator_lite" ||
    cfg?.job_title?.toLowerCase().includes("педагог") ||
    cfg?.job_title?.toLowerCase().includes("учитель") ||
    cfg?.job_title?.toLowerCase().includes("классный") ||
    Boolean(specialistName?.toLowerCase().includes("педагог")) ||
    Boolean(specialistName?.toLowerCase().includes("классный")) ||
    Boolean(specialistName?.toLowerCase().includes("учитель"));
  const defaultSpecialist = specialistName || (isIntl ? "IDA Specialist" : "Специалист IDA");
  const [webinars, setWebinars] = useState<WebinarItem[]>(() => loadWebinars());
  const [activeTab, setActiveTab] = useState<"schedule" | "recordings" | "materials" | "courses" | "tools">(
    mode === "learner" ? "courses" : "schedule"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "scheduled" | "live" | "finished">("all");

  // Courses (LMS & "Моё обучение")
  const [courses, setCourses] = useState<AvailableCourseItem[]>(() => getAvailableCourses(cfg));
  const [editingCourse, setEditingCourse] = useState<AvailableCourseItem | null>(null);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseFormTitle, setCourseFormTitle] = useState("");
  const [courseFormUrl, setCourseFormUrl] = useState("");
  const [courseFormDesc, setCourseFormDesc] = useState("");
  const [courseSaving, setCourseSaving] = useState(false);

  const handleOpenEditCourse = (course: AvailableCourseItem) => {
    setEditingCourse(course);
    setCourseFormTitle(course.title);
    setCourseFormUrl(course.url);
    setCourseFormDesc(course.description || "");
    setIsAddingCourse(false);
  };

  const handleOpenAddCourse = () => {
    setEditingCourse(null);
    setCourseFormTitle("");
    setCourseFormUrl("https://");
    setCourseFormDesc("");
    setIsAddingCourse(true);
  };

  const handleSaveCourseForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = courseFormUrl.trim();
    if (!cleanUrl) return;
    setCourseSaving(true);
    try {
      if (isAddingCourse) {
        const newCourse: AvailableCourseItem = {
          id: "course_" + Date.now(),
          title: courseFormTitle.trim() || t("Дополнительный курс", "Additional Course"),
          description: courseFormDesc.trim(),
          url: cleanUrl,
        };
        saveAvailableCourse(newCourse);
      } else if (editingCourse) {
        const updated: AvailableCourseItem = {
          ...editingCourse,
          title: courseFormTitle.trim() || editingCourse.title,
          description: courseFormDesc.trim(),
          url: cleanUrl,
        };
        saveAvailableCourse(updated);
        if (editingCourse.isDefault || editingCourse.id === DEFAULT_PREVENTION_COURSE.id) {
          updateDefaultCourseUrl(cleanUrl);
          try {
            const terminalInput: TerminalConfigInput = {
              edition: cfg.edition,
              mode: cfg.mode,
              workspace_preset: cfg.workspace_preset,
              org_type: cfg.org_type,
              manager_scope: cfg.manager_scope,
              job_title: cfg.job_title,
              child_invite_code: cfg.child_invite_code,
              parent_invite_code: cfg.parent_invite_code,
              parent_invite_in: cfg.parent_invite_in,
              child_invite_in: cfg.child_invite_in,
              consumer_app: cfg.consumer_app,
              enabled_modules: cfg.enabled_modules,
              registry_enabled: cfg.registry_enabled,
              default_course_url: cleanUrl,
            };
            const nextCfg = await invoke<TerminalConfig>("terminal_save_config", { input: terminalInput });
            onConfigSaved?.(nextCfg);
          } catch (err) {
            console.warn("Could not save to terminal config:", err);
          }
        }
      }
      setCourses(getAvailableCourses(cfg));
      setEditingCourse(null);
      setIsAddingCourse(false);
    } finally {
      setCourseSaving(false);
    }
  };

  const handleResetCourseToDefault = async () => {
    const defaultUrl = DEFAULT_COURSE_URL;
    const resetList = resetCoursesToDefault(defaultUrl);
    setCourses(resetList);
    try {
      const terminalInput: TerminalConfigInput = {
        edition: cfg.edition,
        mode: cfg.mode,
        workspace_preset: cfg.workspace_preset,
        org_type: cfg.org_type,
        manager_scope: cfg.manager_scope,
        job_title: cfg.job_title,
        child_invite_code: cfg.child_invite_code,
        parent_invite_code: cfg.parent_invite_code,
        parent_invite_in: cfg.parent_invite_in,
        child_invite_in: cfg.child_invite_in,
        consumer_app: cfg.consumer_app,
        enabled_modules: cfg.enabled_modules,
        registry_enabled: cfg.registry_enabled,
        default_course_url: defaultUrl,
      };
      const nextCfg = await invoke<TerminalConfig>("terminal_save_config", { input: terminalInput });
      onConfigSaved?.(nextCfg);
    } catch (err) {
      console.warn("Could not save reset to terminal config:", err);
    }
    setEditingCourse(null);
  };

  const handleDeleteCourse = (id: string) => {
    deleteAvailableCourse(id);
    setCourses(getAvailableCourses(cfg));
  };

  // Modals
  const [showGuide, setShowGuide] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdWebinarSuccess, setCreatedWebinarSuccess] = useState<WebinarItem | null>(null);
  const [previewLobbyWebinar, setPreviewLobbyWebinar] = useState<WebinarItem | null>(null);
  const [editingWebinar, setEditingWebinar] = useState<WebinarItem | null>(null);
  const [viewingSummaryRec, setViewingSummaryRec] = useState<CloudRecording | null>(null);
  const [trimmingRec, setTrimmingRec] = useState<CloudRecording | null>(null);
  const [monetizingRec, setMonetizingRec] = useState<CloudRecording | null>(null);
  const [previewingPlayerRecId, setPreviewingPlayerRecId] = useState<string | null>(null);
  const [tildaEmbedRec, setTildaEmbedRec] = useState<CloudRecording | null>(null);
  const [courseAttachRec, setCourseAttachRec] = useState<CloudRecording | null>(null);
  const [showUploadMaterialModal, setShowUploadMaterialModal] = useState(false);
  const [showArchivePaywallModal, setShowArchivePaywallModal] = useState<{ webinar: WebinarItem; rec: CloudRecording } | null>(null);
  const [selectedWebinarForMaterial, setSelectedWebinarForMaterial] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleSaveTrim = (settings: VideoTrimSettings) => {
    if (!trimmingRec) return;
    updateRecordingTrim(trimmingRec.webinarId, settings);
    setWebinars(loadWebinars());
    setTrimmingRec(null);
  };

  const handleSaveMonetization = (monetization: RecordingMonetization) => {
    if (!monetizingRec) return;
    updateRecordingMonetization(monetizingRec.webinarId, monetization);
    setWebinars(loadWebinars());
    setMonetizingRec(null);
  };
  const [bannerHidden, setBannerHidden] = useState(() => {
    try {
      return localStorage.getItem("terminal_webinar_ecosystem_banner_hidden") === "true";
    } catch {
      return false;
    }
  });

  const dismissBanner = (neverShowAgain = true) => {
    setBannerHidden(true);
    if (neverShowAgain) {
      try {
        localStorage.setItem("terminal_webinar_ecosystem_banner_hidden", "true");
      } catch {}
    }
  };

  // Form State for Create/Edit
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState("19:00");
  const [formDuration, setFormDuration] = useState(90);
  const [formAccessType, setFormAccessType] = useState<"open_200" | "closed_group" | "practicum_breakout">("open_200");
  const [formBreakout, setFormBreakout] = useState(false);
  const [formWaitingRoom, setFormWaitingRoom] = useState(false);
  const [formQa, setFormQa] = useState(true);
  const [formRecording, setFormRecording] = useState(true);

  // Material Form
  const [matTitle, setMatTitle] = useState("");
  const [matType, setMatType] = useState<"presentation" | "handout" | "protocol" | "document">("presentation");
  const [matFileName, setMatFileName] = useState("");
  const [matKbTag, setMatKbTag] = useState("");

  const quota = useMemo(() => getStorageQuota(webinars), [webinars]);

  const filteredWebinars = useMemo(() => {
    return webinars.filter((w) => {
      const matchSearch =
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === "all" || w.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [webinars, searchQuery, filterStatus]);

  const allRecordings = useMemo(() => {
    return webinars.filter((w) => w.recording).map((w) => ({ webinar: w, rec: w.recording! }));
  }, [webinars]);

  const allMaterials = useMemo(() => {
    const list: { webinar: WebinarItem; material: AttachedMaterial }[] = [];
    for (const w of webinars) {
      for (const m of w.materials) {
        list.push({ webinar: w, material: m });
      }
    }
    return list;
  }, [webinars]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleOpenCreateModal = (item?: WebinarItem) => {
    if (item) {
      setEditingWebinar(item);
      setFormTitle(item.title);
      setFormDesc(item.description);
      setFormDate(item.scheduledDate);
      setFormTime(item.scheduledTime);
      setFormDuration(item.durationMinutes);
      setFormAccessType(item.accessType);
      setFormBreakout(item.settings.breakoutRooms);
      setFormWaitingRoom(item.settings.waitingRoom);
      setFormQa(item.settings.qaModeration);
      setFormRecording(item.settings.autoCloudRecording);
    } else {
      setEditingWebinar(null);
      setFormTitle("");
      setFormDesc("");
      setFormDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
      setFormTime("19:00");
      setFormDuration(90);
      setFormAccessType("open_200");
      setFormBreakout(false);
      setFormWaitingRoom(false);
      setFormQa(true);
      setFormRecording(true);
    }
    setShowCreateModal(true);
  };

  const handleSaveWebinar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingWebinar) {
      const updated: WebinarItem = {
        ...editingWebinar,
        title: formTitle.trim(),
        description: formDesc.trim(),
        scheduledDate: formDate,
        scheduledTime: formTime,
        durationMinutes: Number(formDuration) || 90,
        accessType: formAccessType,
        settings: {
          ...editingWebinar.settings,
          breakoutRooms: formBreakout,
          waitingRoom: formWaitingRoom,
          qaModeration: formQa,
          autoCloudRecording: formRecording,
        },
      };
      const freshLinks = generateWebinarLinks({
        roomName: updated.roomName,
        title: updated.title,
        scheduledDate: updated.scheduledDate,
        scheduledTime: updated.scheduledTime,
        speakerName: updated.speakerName,
        description: updated.description,
      });
      updated.guestLink = freshLinks.guestLink;
      updated.speakerLink = freshLinks.speakerLink;
      updated.coHostLink = freshLinks.coHostLink;

      updateWebinar(updated);
      setWebinars(loadWebinars());
      setCreatedWebinarSuccess(updated);
    } else {
      const roomSlug = `room-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
      const created = addWebinar({
        title: formTitle.trim(),
        description: formDesc.trim(),
        scheduledDate: formDate,
        scheduledTime: formTime,
        durationMinutes: Number(formDuration) || 90,
        roomName: roomSlug,
        speakerName: defaultSpecialist,
        accessType: formAccessType,
        status: "scheduled",
        materials: [],
        settings: {
          breakoutRooms: formBreakout,
          waitingRoom: formWaitingRoom,
          qaModeration: formQa,
          autoCloudRecording: formRecording,
          aiSmartSummary: true,
        },
      });
      setWebinars(loadWebinars());
      setCreatedWebinarSuccess(created);
    }

    setShowCreateModal(false);
  };

  const handleDeleteWebinar = (id: string) => {
    if (window.confirm(t("Удалить этот вебинар и связанные ссылки?", "Delete this webinar and its links?"))) {
      deleteWebinar(id);
      setWebinars(loadWebinars());
    }
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim() || !selectedWebinarForMaterial) return;

    const w = webinars.find((item) => item.id === selectedWebinarForMaterial);
    if (!w) return;

    const newMat: AttachedMaterial = {
      id: `mat-${Date.now()}`,
      title: matTitle.trim(),
      type: matType,
      fileName: matFileName.trim() || "document.pdf",
      fileSizeMb: parseFloat((Math.random() * 8 + 1.2).toFixed(1)),
      kbProtocolTag: matKbTag.trim() || undefined,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };

    w.materials.push(newMat);
    updateWebinar(w);
    setWebinars(loadWebinars());
    setShowUploadMaterialModal(false);
    setMatTitle("");
    setMatFileName("");
    setMatKbTag("");
  };

  const handleDeleteMaterial = (webinarId: string, materialId: string) => {
    const w = webinars.find((item) => item.id === webinarId);
    if (w) {
      w.materials = w.materials.filter((m) => m.id !== materialId);
      updateWebinar(w);
      setWebinars(loadWebinars());
    }
  };

  const handleDeleteRec = (webinarId: string) => {
    if (
      window.confirm(
        t(
          "Удалить исходный видеофайл MP4 из облачного хранилища S3?\n\nВидеофайл будет удален для освобождения места в облаке. Текстовый ИИ-конспект, таймкоды и ключевые тезисы навсегда останутся в вашей базе знаний.",
          "Delete the original MP4 video file from S3 cloud storage?\n\nThe video will be removed to free storage space. AI notes, summary and timestamps will remain preserved."
        )
      )
    ) {
      deleteRecording(webinarId);
      setWebinars(loadWebinars());
    }
  };

  const handleToggleArchive = (webinar: WebinarItem, rec: CloudRecording) => {
    if (rec.isArchivedForever) {
      toggleArchiveRecording(webinar.id);
      setWebinars(loadWebinars());
    } else {
      setShowArchivePaywallModal({ webinar, rec });
    }
  };

  const getRecordingRetentionStatus = (rec: CloudRecording) => {
    if (rec.isArchivedForever) {
      return {
        status: "archived",
        label: t("⭐ Вечный видеоархив", "⭐ Permanent Video Archive"),
        sublabel: t("Бессрочно в защищенном S3", "Permanent retention in secure S3"),
        color: "#92400e",
        bg: "#fef3c7",
        border: "#fde68a",
        daysLeft: 999,
      };
    }

    const now = Date.now();
    let expireTime: number;
    if (rec.expiresAt && !isNaN(Date.parse(rec.expiresAt))) {
      expireTime = Date.parse(rec.expiresAt);
    } else if (rec.recordedAt && !isNaN(Date.parse(rec.recordedAt))) {
      expireTime = Date.parse(rec.recordedAt) + 14 * 86400000;
    } else {
      expireTime = now + 14 * 86400000;
    }

    const diffMs = expireTime - now;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

    if (diffMs <= 0) {
      return {
        status: "expired",
        label: t("⌛ Срок хранения истек", "⌛ Retention Period Expired"),
        sublabel: t("MP4 удален по ротации, ИИ-конспект сохранен", "MP4 rotated out, AI notes preserved"),
        color: "#64748b",
        bg: "#f1f5f9",
        border: "#cbd5e1",
        daysLeft: 0,
      };
    }

    if (daysLeft <= 3) {
      return {
        status: "urgent",
        label: t(`🚨 Удаление через ${hoursLeft > 48 ? `${daysLeft} дн.` : `${hoursLeft} ч.`}`, `🚨 Deletion in ${hoursLeft > 48 ? `${daysLeft} d.` : `${hoursLeft} h.`}`),
        sublabel: t("Скачайте MP4 на диск или перелейте в VK/YouTube", "Download MP4 to disk or external storage"),
        color: "#b91c1c",
        bg: "#fef2f2",
        border: "#fecaca",
        daysLeft,
      };
    }

    if (daysLeft <= 7) {
      return {
        status: "warning",
        label: t(`⚠️ До авто-удаления: ${daysLeft} дн.`, `⚠️ Auto-deletion in: ${daysLeft} d.`),
        sublabel: t("Рекомендуем скачать MP4", "Recommended to download MP4"),
        color: "#b45309",
        bg: "#fffbeb",
        border: "#fde68a",
        daysLeft,
      };
    }

    return {
      status: "ok",
      label: t(`🟢 Хранение в S3: еще ${daysLeft} дн.`, `🟢 S3 Storage: ${daysLeft} days left`),
      sublabel: t("Бесплатный период (14 дн.)", "Free period (14 days)"),
      color: "#047857",
      bg: "#ecfdf5",
      border: "#a7f3d0",
      daysLeft,
    };
  };

  const handleInstantLive = () => {
    const instantRoom = `webinar-instant-${Date.now().toString(36)}`;
    const timeStr = new Date().toLocaleTimeString(isIntl ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
    const newWeb = addWebinar({
      title: t(`Прямой эфир (${timeStr})`, `Live Broadcast (${timeStr})`),
      description: t(
        "Вебинарная студия для проведения мастер-класса, группового разбора или лекции.",
        "Live webinar studio for masterclasses, case reviews, or lectures."
      ),
      scheduledDate: new Date().toISOString().slice(0, 10),
      scheduledTime: timeStr,
      durationMinutes: 90,
      roomName: instantRoom,
      speakerName: defaultSpecialist,
      accessType: "open_200",
      status: "live",
      materials: [],
      settings: {
        waitingRoom: false,
        breakoutRooms: true,
        qaModeration: true,
        autoCloudRecording: true,
        aiSmartSummary: true,
      },
    });
    setWebinars(loadWebinars());

    if (onLaunchStudio) {
      onLaunchStudio(instantRoom);
    } else {
      window.open(newWeb.speakerLink, "_blank");
    }
  };

  // Quota percentage
  const quotaPercent = Math.min(100, Math.round((quota.usedMb / quota.totalQuotaMb) * 100));

  return (
    <div className="webinars-workspace" style={{ padding: "20px 24px", height: "100%", overflowY: "auto", background: "var(--bg-main, #f8fafc)" }}>
      {/* Top Banner & Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f766e 0%, #115e59 50%, #1e293b 100%)",
          borderRadius: "16px",
          padding: "24px 28px",
          color: "#fff",
          marginBottom: "24px",
          boxShadow: "0 10px 25px -5px rgba(15, 118, 110, 0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, marginBottom: "10px", backdropFilter: "blur(4px)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 8px #10b981" }} />
                {isEducator
                  ? t("👨‍👩‍👧‍👦 Родительские собрания и классные часы онлайн", "👨‍👩‍👧‍👦 Online Parent Meetings & Homeroom Sessions")
                  : isLearner
                  ? t("🎓 Профессиональное обучение и архив практических разборов", "🎓 Professional Learning & Practice Archives")
                  : t("🎙️ Защищенные прямые эфиры и онлайн-консультации", "🎙️ Protected Live Broadcasting & Consultations")}
              </div>
              <h1 style={{ margin: "0 0 8px 0", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                {isEducator
                  ? t("Родительские собрания и онлайн-встречи", "Online Parent Meetings & Homeroom Events")
                  : isLearner
                  ? t("Моё обучение: Вебинары, записи и методики", "My Learning: Webinars, Recordings & Methodology")
                  : t("Кабинет прямых эфиров и онлайн-встреч", "Webinar & Studio Dashboard")}
              </h1>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.95rem", maxWidth: "680px", lineHeight: 1.5 }}>
                {isEducator
                  ? t(
                      "Проведение онлайн-собраний с родителями, классных часов и дистанционных консультаций без ограничений по времени.",
                      "Host online parent meetings, homeroom hours and remote consultations with no time limits."
                    )
                  : isLearner
                  ? t(
                      "Расписание доступных профессиональных эфиров, архив практических разборов с ИИ-конспектами и методические материалы для работы.",
                      "Available live broadcasts, practice case archives with AI notes, and clinical protocol handouts."
                    )
                  : t(
                      "Расписание эфиров, подключение спикера, интеграция с Базой Знаний IDA, сессионные залы и автоматическая запись трансляций в защищенное хранилище.",
                      "Broadcast scheduling, speaker connection, IDA Knowledge Base integration, breakout rooms, and automated recording to secure storage."
                    )}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {isLearner ? (
                <>
                  <a
                    href="https://academy.ida-psy.ru/?mode=webinar"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("Отдельный кабинет для создания курсов и вебинаров", "Separate studio for creating courses and webinars")}
                    style={{
                      background: "rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span>🎙️</span> {t("Студия автора / LMS ↗", "Author Studio / LMS ↗")}
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    title={t("Справка по обучению и записям", "Learning and recordings help")}
                    style={{
                      background: "rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span>❓</span> {t("Справка", "Help")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleInstantLive}
                    title={t(
                      "Быстрый запуск встречи с инструментами спикера и ссылками для родителей / слушателей",
                      "Launch instant live meeting with speaker tools and attendee links"
                    )}
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                      transition: "transform 0.1s ease",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>🔴</span> {isEducator ? t("Начать собрание", "Start Meeting") : t("Запустить эфир", "Launch Live Studio")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    style={{
                      background: "#fff",
                      color: "#0f766e",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                    }}
                  >
                    <span>➕</span> {isEducator ? t("Запланировать собрание", "Schedule Meeting") : t("Запланировать встречу", "Schedule Meeting")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    title={t("Справка и руководство по вебинарной платформе", "Webinar platform guide & docs")}
                    style={{
                      background: "rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span>❓</span> {t("Справка", "Help")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {!isLearner && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginTop: "24px",
                paddingTop: "20px",
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <div style={{ background: "rgba(255,255,255,0.08)", padding: "12px 16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  {isEducator ? t("Лимит времени", "Time Limit") : t("Лимит зала", "Room Capacity")}
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "4px" }}>
                  {isEducator ? t("Без ограничений", "No time limits") : t("До 200 слушателей", "Up to 200 attendees")}{" "}
                  <span style={{ fontSize: "0.8rem", color: "#a5b4fc", fontWeight: 500 }}>
                    ({isEducator ? t("до 200 участников", "up to 200") : t("Без лимита времени", "No time limits")})
                  </span>
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.08)", padding: "12px 16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  {isEducator ? t("Вход для родителей", "Parent Access") : t("Подключение", "Connection")}
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{isEducator ? t("По ссылке в 1 клик", "1-click direct link") : (isIntl ? "live.ida-psy.pro" : "live.ida-psy.ru")}</span>
                  <span style={{ fontSize: "0.75rem", color: "#34d399", background: "rgba(52, 211, 153, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                    {isEducator ? t("Без паролей", "No passwords") : t("21 мс", "21 ms")}
                  </span>
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.08)", padding: "12px 16px", borderRadius: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {isEducator ? t("Хранилище записей", "Recordings storage") : t("S3 Облако (14 дн.)", "S3 Cloud (14 days)")}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600 }}>
                    {quota.usedMb} {t("МБ", "MB")} / {(quota.totalQuotaMb / 1024).toFixed(0)} {t("ГБ", "GB")}
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.2)", borderRadius: "3px", marginTop: "8px", overflow: "hidden" }}>
                  <div style={{ width: `${quotaPercent}%`, height: "100%", background: quotaPercent > 80 ? "#ef4444" : "#38bdf8", borderRadius: "3px" }} />
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.08)", padding: "12px 16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  {isEducator ? t("ИИ-Конспект встречи", "AI Meeting Notes") : t("ИИ-Конспекты и Саммари", "AI Summaries & Notes")}
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "4px", color: "#a7f3d0" }}>
                  {t("Авто-анализ активен ✨", "Auto-analysis active ✨")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Copied Link Toast */}
      {copiedLink && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#10b981",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>✓</span> {t("Скопировано в буфер:", "Copied to clipboard:")} {copiedLink}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px" }}>
        {/* For learner: Courses tab is first */}
        {isLearner && (
          <button
            type="button"
            onClick={() => setActiveTab("courses")}
            style={{
              background: "none",
              border: "none",
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              color: activeTab === "courses" ? "#0f766e" : "#64748b",
              borderBottom: activeTab === "courses" ? "3px solid #0f766e" : "3px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🎓</span> {t("Доступные курсы", "Available Courses")} ({courses.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            color: activeTab === "schedule" ? "#0f766e" : "#64748b",
            borderBottom: activeTab === "schedule" ? "3px solid #0f766e" : "3px solid transparent",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📅</span> {isEducator ? t("Собрания и встречи", "Meetings & Sessions") : isLearner ? t("Вебинары и эфиры", "Webinars & Broadcasts") : t("Расписание и встречи", "Schedule & Meetings")} ({webinars.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recordings")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            color: activeTab === "recordings" ? "#0f766e" : "#64748b",
            borderBottom: activeTab === "recordings" ? "3px solid #0f766e" : "3px solid transparent",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📁</span> {isEducator ? t("Записи и конспекты", "Recordings & Notes") : isLearner ? t("Архив записей и ИИ-конспекты", "Recordings & AI Notes") : t("Записи и конспекты", "Recordings & Summaries")} ({allRecordings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("materials")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            color: activeTab === "materials" ? "#0f766e" : "#64748b",
            borderBottom: activeTab === "materials" ? "3px solid #0f766e" : "3px solid transparent",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📑</span> {isEducator ? t("Памятки для родителей", "Parent Handouts") : isLearner ? t("Методики и протоколы", "Protocols & Materials") : t("Документы и памятки", "Documents & Handouts")} ({allMaterials.length})
        </button>

        {/* For specialist (non-educator): Courses & Tools tabs */}
        {!isLearner && !isEducator && (
          <button
            type="button"
            onClick={() => setActiveTab("courses")}
            style={{
              background: "none",
              border: "none",
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              color: activeTab === "courses" ? "#0f766e" : "#64748b",
              borderBottom: activeTab === "courses" ? "3px solid #0f766e" : "3px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🎓</span> {t("Доступные курсы", "Available Courses")} ({courses.length})
          </button>
        )}

        {!isLearner && !isEducator && (
          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            style={{
              background: "none",
              border: "none",
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              color: activeTab === "tools" ? "#0f766e" : "#64748b",
              borderBottom: activeTab === "tools" ? "3px solid #0f766e" : "3px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🛠️</span> {t("Инструменты залов и Радар", "Breakout Tools & Radar")}
          </button>
        )}
      </div>

      {/* TAB 1: SCHEDULE & WEBINARS */}
      {activeTab === "schedule" && (
        <div>
          {/* Main Course Promo Banner for Learner */}
          {isLearner && courses.length > 0 && (() => {
            const mainCourse = courses.find((c) => c.isDefault) || courses[0];
            return (
              <div
                style={{
                  background: "linear-gradient(135deg, #0f766e 0%, #115e59 50%, #1e293b 100%)",
                  borderRadius: "14px",
                  padding: "20px 24px",
                  color: "#fff",
                  marginBottom: "24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  boxShadow: "0 8px 20px -4px rgba(15, 118, 110, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <div style={{ maxWidth: "680px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.18)", padding: "3px 10px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>🎓</span> {t("Доступный курс обучения", "Available Learning Course")}
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "1.25rem", fontWeight: 700 }}>
                    {mainCourse.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#ccfbf1", lineHeight: 1.45 }}>
                    {mainCourse.description}
                  </p>
                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "14px", fontSize: "0.82rem", color: "#99f6e4", flexWrap: "wrap" }}>
                    <span>✓ {mainCourse.lessonsCount || 21} {t("видеолекций", "video lessons")}</span>
                    <span>✓ {t("Интерактивный плеер", "Interactive player")}</span>
                    <span>✓ {t("Конспекты и тесты", "Notes & quizzes")}</span>
                    <span style={{ color: "#5eead4", wordBreak: "break-all" }}>🔗 {mainCourse.url}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={mainCourse.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "#10b981",
                      color: "#fff",
                      textDecoration: "none",
                      padding: "12px 22px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                    }}
                  >
                    <span>▶</span> {t("Перейти к курсу ↗", "Open Course ↗")}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleOpenEditCourse(mainCourse)}
                    title={t("Изменить ссылку на курс или заменить на другую программу", "Change course URL or replace program")}
                    style={{
                      background: "rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span>⚙️</span> {t("Заменить ссылку", "Change URL")}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Viral Co-Host Onboarding Banner */}
          {!isLearner && (
            <div
              style={{
                background: "linear-gradient(90deg, #eff6ff 0%, #f5f3ff 100%)",
                border: "1px solid #dbeafe",
                borderRadius: "10px",
                padding: "12px 18px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.3rem" }}>💡</span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e40af" }}>
                    {t("Приглашаете со-ведущих или коллег на вебинар?", "Inviting co-hosts or colleagues to your webinar?")}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#3b82f6" }}>
                    {t(
                      "Отправьте им ссылку для со-ведущего — они войдут в студию через веб-терминал с полным доступом к залам и презентациям, а после эфира сразу смогут запустить свой вебинар.",
                      "Send them the co-host link — they will join via the web terminal with full access to breakout rooms and presentations, and can launch their own webinars right after."
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + {t("Создать свой вебинар", "Create your webinar")}
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["all", "scheduled", "live", "finished"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  style={{
                    background: filterStatus === st ? "#0f766e" : "#fff",
                    color: filterStatus === st ? "#fff" : "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {st === "all" && t("Все", "All")}
                  {st === "scheduled" && t("Предстоящие", "Upcoming")}
                  {st === "live" && t("В эфире 🔴", "Live 🔴")}
                  {st === "finished" && t("Завершенные", "Completed")}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder={t("🔍 Поиск вебинара или темы...", "🔍 Search webinar or topic...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                width: "280px",
                background: "#fff",
              }}
            />
          </div>

          {/* Webinar Cards List */}
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredWebinars.length === 0 ? (
              <div style={{ background: "#fff", padding: "40px 24px", borderRadius: "12px", textAlign: "center", border: "1px dashed #cbd5e1", color: "#64748b" }}>
                <p style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 8px 0", color: "#1e293b" }}>
                  {isLearner
                    ? t("Пока нет запланированных прямых эфиров", "No scheduled live webinars yet")
                    : t("Вебинары не найдены", "No webinars found")}
                </p>
                <p style={{ margin: "0 auto", maxWidth: "540px", fontSize: "0.92rem", lineHeight: 1.5, color: "#475569" }}>
                  {isLearner
                    ? t(
                        "Вам уже доступен базовый курс «Практическая психотерапия и превенция» (21 видеолекция, конспекты и тесты). Он всегда открыт в вашем кабинете бесплатно.",
                        "The core course 'Practical Psychotherapy and Prevention' (21 video lectures, notes and tests) is already available to you. It is always open in your cabinet for free."
                      )
                    : t("Запланируйте ваш первый открытый вебинар или практикум.", "Schedule your first open webinar or supervision practicum.")}
                </p>
                {isLearner ? (
                  <div style={{ marginTop: "18px", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                    <a
                      href="https://prevention-ai.ru/course/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "#10b981",
                        color: "#fff",
                        textDecoration: "none",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "0.92rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      <span>▶</span> {t("Открыть бесплатный курс ↗", "Open Free Course ↗")}
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab("courses")}
                      style={{
                        background: "#f1f5f9",
                        color: "#0d9488",
                        border: "1px solid #cbd5e1",
                        padding: "10px 18px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                      }}
                    >
                      🎓 {t("Все доступные курсы", "All Available Courses")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    style={{
                      marginTop: "16px",
                      background: "#0f766e",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ➕ {t("Запланировать", "Schedule")}
                  </button>
                )}
              </div>
            ) : (
              filteredWebinars.map((w) => {
                const isLive = w.status === "live";
                const isFinished = w.status === "finished";

                return (
                  <div
                    key={w.id}
                    style={{
                      background: "#fff",
                      borderRadius: "12px",
                      border: isLive ? "2px solid #ef4444" : "1px solid #e2e8f0",
                      padding: "20px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          {isLive && (
                            <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} /> {t("ПРЯМОЙ ЭФИР", "LIVE")}
                            </span>
                          )}
                          {w.status === "scheduled" && (
                            <span style={{ background: "#ccfbf1", color: "#0d9488", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>
                              📅 {t("Запланирован", "Scheduled")}
                            </span>
                          )}
                          {isFinished && (
                            <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>
                              ✓ {t("Завершен", "Completed")}
                            </span>
                          )}

                          <span style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 500 }}>
                            {w.accessType === "open_200" && t("🌐 Открытый (до 200 мест)", "🌐 Public (up to 200 attendees)")}
                            {w.accessType === "closed_group" && t("🔒 Закрытая группа (Зал ожидания)", "🔒 Closed Group (Waiting Room)")}
                            {w.accessType === "practicum_breakout" && t("👥 Практикум (Сессионные залы)", "👥 Practicum (Breakout Rooms)")}
                          </span>

                          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
                            🕒 {w.scheduledDate} {t("в", "at")} {w.scheduledTime} ({w.durationMinutes} {t("мин", "min")})
                          </span>
                        </div>

                        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>
                          {w.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b", lineHeight: 1.4 }}>
                          {w.description}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {isLearner ? (
                          <button
                            type="button"
                            onClick={() => {
                              window.open(w.guestLink || w.speakerLink, "_blank");
                            }}
                            style={{
                              background: isLive ? "#ef4444" : "#0f766e",
                              color: "#fff",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span>{isLive ? "🔴" : "▶️"}</span> {isLive ? t("Смотреть трансляцию", "Watch Live") : t("Подключиться к эфиру", "Join Broadcast")}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (onLaunchStudio) {
                                  onLaunchStudio(w.roomName);
                                } else {
                                  window.open(w.speakerLink, "_blank");
                                }
                              }}
                              style={{
                                background: isLive ? "#ef4444" : "#0f766e",
                                color: "#fff",
                                border: "none",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <span>🎙️</span> {isLive ? t("Войти в эфир", "Join Live") : t("Студия спикера", "Speaker Studio")}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenCreateModal(w)}
                              style={{
                                background: "#f1f5f9",
                                color: "#475569",
                                border: "1px solid #cbd5e1",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                              title={t("Редактировать", "Edit")}
                            >
                              ✏️
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteWebinar(w.id)}
                              style={{
                                background: "#fef2f2",
                                color: "#ef4444",
                                border: "1px solid #fecaca",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                              title={t("Удалить", "Delete")}
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Links and Materials Bar */}
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #f1f5f9",
                        borderRadius: "8px",
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        {/* Guest Link */}
                        <div style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "#047857", fontWeight: 600 }}>{t("👥 Ссылка для входа:", "👥 Attendee Link:")}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const links = generateWebinarLinks(w);
                              handleCopy(links.guestLink, t("Ссылка для гостей (Web)", "Guest Link (Web)"));
                            }}
                            style={{
                              background: copiedLink?.includes("Guest") || copiedLink?.includes("гостей") ? "#10b981" : "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              color: copiedLink?.includes("Guest") || copiedLink?.includes("гостей") ? "#fff" : "#065f46",
                              padding: "3px 10px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {copiedLink?.includes("Guest") || copiedLink?.includes("гостей")
                              ? t("✓ Скопировано!", "✓ Copied!")
                              : t("Скопировать ссылку 📋", "Copy link 📋")}
                          </button>
                        </div>

                        {/* Speaker Link */}
                        {!isLearner && (
                          <div style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ color: "#0d9488", fontWeight: 600 }}>{t("🎙️ Ссылка для спикера:", "🎙️ Speaker Link:")}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const links = generateWebinarLinks(w);
                                handleCopy(links.speakerLink, t("Ссылка для со-ведущего (Терминал)", "Co-host Link (Terminal)"));
                              }}
                              style={{
                                background: copiedLink?.includes("со-ведущего") || copiedLink?.includes("Co-host") ? "#14b8a6" : "#ccfbf1",
                                color: copiedLink?.includes("со-ведущего") || copiedLink?.includes("Co-host") ? "#fff" : "#0d9488",
                                border: "1px solid #99f6e4",
                                padding: "3px 10px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              {copiedLink?.includes("со-ведущего") || copiedLink?.includes("Co-host")
                                ? t("✓ Скопировано!", "✓ Copied!")
                                : t("Скопировать для спикера 🔗", "Copy for speaker 🔗")}
                            </button>
                          </div>
                        )}

                        {/* Live Waiting Screen Preview Button */}
                        <button
                          type="button"
                          onClick={() => setPreviewLobbyWebinar(w)}
                          style={{
                            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                            border: "1px solid #475569",
                            color: "#f8fafc",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          title={t("Открыть живой экран с обратным отсчетом времени", "Open live waiting screen with countdown")}
                        >
                          <span>🔴 {t("Живой экран ожидания", "Live Waiting Screen")}</span>
                          <span style={{ fontSize: "0.7rem", background: "rgba(239,68,68,0.2)", color: "#f87171", padding: "1px 5px", borderRadius: "10px" }}>Live</span>
                        </button>

                        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                          {t("👥 Регистраций: ", "👥 Registered: ")}
                          <strong style={{ color: "#1e293b" }}>{w.registeredCount}</strong>
                        </div>
                      </div>

                      {/* Attached Materials Badges */}
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>{t("Материалы:", "Materials:")}</span>
                        {w.materials.length === 0 ? (
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{t("нет файлов", "no files")}</span>
                        ) : (
                          w.materials.map((m) => (
                            <span
                              key={m.id}
                              style={{
                                background: "#fff",
                                border: "1px solid #cbd5e1",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                color: "#334155",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title={`${m.title} (${m.fileSizeMb} ${t("МБ", "MB")})`}
                            >
                              <span>{m.type === "presentation" ? "📊" : m.type === "protocol" ? "📋" : "📄"}</span>
                              {m.fileName}
                            </span>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWebinarForMaterial(w.id);
                            setShowUploadMaterialModal(true);
                          }}
                          style={{
                            background: "#ccfbf1",
                            color: "#0d9488",
                            border: "none",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          + {t("Документ", "Document")}
                        </button>
                      </div>
                    </div>

                    {/* Recording Summary Snippet if finished */}
                    {w.recording && (
                      <div
                        style={{
                          background: "rgba(16, 185, 129, 0.06)",
                          borderLeft: "4px solid #10b981",
                          borderRadius: "4px",
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "1.2rem" }}>📼</span>
                          <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#065f46" }}>
                              {t("Облачная запись сохранена в S3", "Cloud recording stored in S3")} ({w.recording.fileSizeMb} {t("МБ", "MB")}, {w.recording.durationMinutes} {t("мин", "min")})
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#047857" }}>
                              {w.recording.aiSummary ? t("✨ ИИ-конспект и глоссарий сформированы", "✨ AI notes & glossary generated") : t("Идет обработка транскрипта...", "Processing transcript...")} • {t("Доступна до", "Available until")} {w.recording.expiresAt}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => setViewingSummaryRec(w.recording!)}
                            style={{
                              background: "#059669",
                              color: "#fff",
                              border: "none",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              cursor: "pointer",
                            }}
                          >
                            📝 {t("Открыть ИИ-конспект", "Open AI Notes")}
                          </button>
                          <a
                            href={w.recording.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: "#fff",
                              color: "#065f46",
                              border: "1px solid #a7f3d0",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            ⬇️ {t("Скачать MP4", "Download MP4")}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLOUD RECORDINGS & S3 */}
      {activeTab === "recordings" && (
        <div>
          {/* Storage Retention & Transparency Banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
              border: "1px solid #bfdbfe",
              borderRadius: "14px",
              padding: "20px 24px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "18px",
            }}
          >
            <div style={{ maxWidth: "680px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "1.2rem" }}>📁</span>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e3a8a" }}>
                  {isLearner
                    ? t("Архив видеозаписей и практических разборов с ИИ-конспектами", "Video & Practice Archive with AI Summaries")
                    : t("Облачное видеохранилище S3 (LiveKit Server Egress)", "S3 Cloud Video Storage (LiveKit Server Egress)")}
                </h3>
                <span style={{ fontSize: "0.75rem", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                  {isLearner ? t("Доступ к записям", "Recordings Access") : t("14 дней бесплатно", "14 days free")}
                </span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "#334155", lineHeight: 1.5 }}>
                {isLearner
                  ? t(
                      "Все записи обучающих встреч и клинических разборов доступны для просмотра в плеере или скачивания на свой компьютер. ИИ-конспекты позволяют быстро повторить ключевые интервенции.",
                      "All educational recordings and clinical case reviews are available in player or for download. AI summaries allow quick review of key interventions."
                    )
                  : t(
                      "Все записи эфиров бесплатно хранятся в облаке 14 дней. Этого времени достаточно, чтобы отправить запись участникам или скачать исходник себе на диск.",
                      "All broadcast recordings are stored for free in the cloud for 14 days. Plenty of time to share with attendees or download locally."
                    )}
              </p>
              {!isLearner && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "0.8rem", color: "#475569" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    💡 <strong>{t("Умный монтаж (Smart Trim):", "Smart Trim:")}</strong> {t("вырезайте заминки и перерывы без рендера", "trim pauses and coffee-breaks with zero rendering")}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    💰 <strong>{t("Прямая касса и водяной знак:", "Direct Paywall & Watermark:")}</strong> {t("продавайте запись на свою кассу без комиссий с защитой от пиратов", "sell recordings with 0% platform fee and anti-piracy watermark")}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    ✨ <strong>{t("ИИ-конспекты и тезисы:", "AI summaries & notes:")}</strong> {t("сохраняются в кабинете навсегда", "preserved permanently in your workspace")}
                  </span>
                </div>
              )}
            </div>

            <div style={{ textAlign: "right", background: "#fff", padding: "12px 18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>{t("Занято в S3:", "Used in S3:")}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b", marginTop: "2px" }}>
                {quota.usedMb} {t("МБ", "MB")} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#94a3b8" }}>/ {(quota.totalQuotaMb / 1024).toFixed(0)} {t("ГБ", "GB")}</span>
              </div>
              <div style={{ width: "180px", height: "6px", background: "#e2e8f0", borderRadius: "3px", marginTop: "6px", overflow: "hidden" }}>
                <div style={{ width: `${quotaPercent}%`, height: "100%", background: "#3b82f6" }} />
              </div>
            </div>
          </div>

          {/* Recordings List */}
          <div style={{ display: "grid", gap: "14px" }}>
            {allRecordings.length === 0 ? (
              <div style={{ background: "#fff", padding: "40px", borderRadius: "12px", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1" }}>
                <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>{t("Записей пока нет", "No recordings yet")}</p>
                <p style={{ fontSize: "0.9rem", margin: "4px 0 0 0" }}>{t("Все проведенные эфиры автоматически сохраняются сюда в формате MP4.", "All completed live sessions are automatically archived here in MP4 format.")}</p>
              </div>
            ) : (
              allRecordings.map(({ webinar, rec }) => {
                const ret = getRecordingRetentionStatus(rec);
                return (
                  <div
                    key={rec.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "18px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, color: "#475569" }}>
                          📅 {rec.recordedAt}
                        </span>
                        <span style={{ fontSize: "0.75rem", background: "#ccfbf1", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, color: "#0d9488" }}>
                          ⏱️ {rec.durationMinutes} {t("мин", "min")}
                        </span>
                        <span style={{ fontSize: "0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, color: "#334155" }}>
                          💾 {rec.fileSizeMb} {t("МБ", "MB")}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            background: ret.bg,
                            color: ret.color,
                            border: `1px solid ${ret.border}`,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 700,
                          }}
                        >
                          {ret.label}
                        </span>
                        {rec.trimSettings && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              background: "#ecfdf5",
                              color: "#047857",
                              border: "1px solid #a7f3d0",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: 700,
                            }}
                          >
                            ✂️ {t("Чистовая: ", "Clean: ")}{calculateCleanDurationMinutes(rec.durationMinutes, rec.trimSettings)} {t("мин", "min")} (-{rec.durationMinutes - calculateCleanDurationMinutes(rec.durationMinutes, rec.trimSettings)} {t("мин пауз", "min cut")})
                          </span>
                        )}
                        {rec.monetization?.isPaid && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1px solid #bfdbfe",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: 700,
                            }}
                          >
                            💰 {rec.monetization.priceRub} ₽ {rec.monetization.watermarkEnabled ? "🛡️" : ""}
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
                        {rec.webinarTitle}
                      </h4>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {t("S3 ключ:", "S3 Key:")} <code style={{ color: "#475569" }}>{rec.s3Key}</code> • {ret.sublabel}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      {!isLearner && (
                        <>
                          <button
                            type="button"
                            onClick={() => setTrimmingRec(rec)}
                            title={t("Виртуальный монтаж: обрезка краев и вырезание пауз без ожидания рендера", "Virtual trim: cut off intro/outro and mid-stream pauses with zero rendering wait")}
                            style={{
                              background: "#f0fdf4",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                          >
                            ✂️ {t("Монтаж", "Trim")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setMonetizingRec(rec)}
                            title={t("Настройка платного доступа: прямая ссылка на вашу кассу и защита от складчин", "Configure paid access: direct payment link to your merchant account and anti-piracy watermark")}
                            style={{
                              background: rec.monetization?.isPaid ? "#eff6ff" : "#f8fafc",
                              color: rec.monetization?.isPaid ? "#1d4ed8" : "#334155",
                              border: `1px solid ${rec.monetization?.isPaid ? "#5eead4" : "#cbd5e1"}`,
                              padding: "8px 14px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                          >
                            💰 {rec.monetization?.isPaid ? t("Продажа", "Paid") : t("Продавать", "Sell")}
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setPreviewingPlayerRecId(rec.id)}
                        title={t("Открыть кинотеатральный плеер для зрителей (с автопропуском пауз и защитой)", "Open spectator cinema player (with pause auto-skipping and watermark)")}
                        style={{
                          background: "#0f172a",
                          color: "#e2e8f0",
                          border: "1px solid #334155",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                        }}
                      >
                        👁️ {t("Плеер", "Player")}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewingSummaryRec(rec)}
                        style={{
                          background: "#f8fafc",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                        }}
                      >
                        📝 {t("ИИ-Конспект", "AI Notes")}
                      </button>

                      {!isLearner && (
                        <>
                          <button
                            type="button"
                            onClick={() => setTildaEmbedRec(rec)}
                            title={t("Получить код плеера для вставки на Тильду или сайт (HTML/iframe)", "Get embed iframe code for Tilda or site")}
                            style={{
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1px solid #bfdbfe",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                          >
                            📋 {t("Тильда", "Tilda")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setCourseAttachRec(rec)}
                            title={t("Превратить эту запись в урок курса Академии IDA", "Convert this recording into an IDA Academy course lesson")}
                            style={{
                              background: "#f5f3ff",
                              color: "#6d28d9",
                              border: "1px solid #ddd6fe",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                          >
                            🎓 {t("В курс", "To Course")}
                          </button>
                        </>
                      )}

                      <a
                        href={rec.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "#0f766e",
                          color: "#fff",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
                        }}
                      >
                        ⬇️ {t("Скачать MP4", "Download MP4")}
                      </a>

                      {!isLearner && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(webinar, rec)}
                            style={{
                              background: rec.isArchivedForever ? "#fef3c7" : "#fff",
                              color: rec.isArchivedForever ? "#92400e" : "#475569",
                              border: "1px solid #cbd5e1",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                            title={rec.isArchivedForever ? t("Снять статус вечного архива", "Disable permanent archive") : t("Подключить бессрочный видеоархив", "Enable permanent video archive")}
                          >
                            {rec.isArchivedForever ? t("⭐ В архиве", "⭐ Archived") : t("⭐ В архив (390 ₽/мес)", "⭐ Archive ($5/mo)")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRec(webinar.id)}
                            style={{
                              background: "#fff",
                              color: "#ef4444",
                              border: "1px solid #fecaca",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                            title={t("Удалить файл из S3", "Delete file from S3")}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ATTACHED MATERIALS & DOCUMENTS */}
      {activeTab === "materials" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
              {t("Сопутствующие документы, презентации и методики", "Handouts, presentations and clinical protocols")}
            </h3>
            {!isLearner && (
              <button
                type="button"
                onClick={() => {
                  if (webinars.length > 0) {
                    setSelectedWebinarForMaterial(webinars[0].id);
                  }
                  setShowUploadMaterialModal(true);
                }}
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ➕ {t("Загрузить материал", "Upload Handout")}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {allMaterials.length === 0 ? (
              <div style={{ background: "#fff", padding: "40px", borderRadius: "12px", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1" }}>
                <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>{t("Материалов пока нет", "No materials yet")}</p>
                <p style={{ fontSize: "0.9rem", margin: "4px 0 0 0" }}>{t("Прикрепляйте презентации, памятки и протоколы из Базы Знаний к вашим эфирам.", "Attach presentations, protocols and clinical guides to your broadcasts.")}</p>
              </div>
            ) : (
              allMaterials.map(({ webinar, material }) => (
                <div
                  key={material.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "8px",
                        background: material.type === "presentation" ? "#ccfbf1" : material.type === "protocol" ? "#dcfce7" : "#f1f5f9",
                        color: material.type === "presentation" ? "#0d9488" : material.type === "protocol" ? "#15803d" : "#475569",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.3rem",
                      }}
                    >
                      {material.type === "presentation" ? "📊" : material.type === "protocol" ? "📋" : "📄"}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                        {material.title}
                      </h4>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <span>{t("Файл:", "File:")} <strong>{material.fileName}</strong> ({material.fileSizeMb} {t("МБ", "MB")})</span>
                        <span>{t("Привязан к:", "Linked to:")} <strong style={{ color: "#0f766e" }}>{webinar.title}</strong></span>
                        {material.kbProtocolTag && (
                          <span style={{ color: "#059669", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" }}>
                            {t("База Знаний:", "KB Tag:")} {material.kbProtocolTag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleCopy(`${isIntl ? "https://ida-psy.pro" : "https://ida-psy.ru"}/docs/${material.id}`, t("Ссылка на документ", "Document Link"))}
                      style={{
                        background: "#f1f5f9",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      🔗 {t("Ссылка", "Link")}
                    </button>
                    {!isLearner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(webinar.id, material.id)}
                        style={{
                          background: "#fff",
                          color: "#ef4444",
                          border: "1px solid #fecaca",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                        title={t("Удалить материал", "Delete material")}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: COURSES & LMS PROGRAMS */}
      {activeTab === "courses" && (
        <div>
          {/* Top Controls Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "20px",
              background: "#fff",
              padding: "16px 20px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>
                {t("🎓 Доступные курсы и обучающие программы", "🎓 Available Courses & LMS Programs")}
              </h2>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                {t(
                  "Видеолекции, интерактивные плееры, конспекты и тесты. Ссылка по умолчанию для терминала: https://prevention-ai.ru/course/",
                  "Video lectures, interactive players, notes and tests. Default terminal course: https://prevention-ai.ru/course/"
                )}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleOpenAddCourse}
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                }}
              >
                <span>+</span> {t("Добавить курс", "Add Course")}
              </button>
              <button
                type="button"
                onClick={handleResetCourseToDefault}
                title={t("Сбросить ссылки к базовому курсу платформы", "Reset links to platform default course")}
                style={{
                  background: "#f8fafc",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ↺ {t("Курс по умолчанию", "Reset to Default")}
              </button>
            </div>
          </div>

          {/* Courses Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {courses.map((course) => (
              <div
                key={course.id}
                style={{
                  background: "#fff",
                  border: course.isDefault ? "2px solid #14b8a6" : "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: course.isDefault ? "0 8px 24px -4px rgba(99, 102, 241, 0.15)" : "0 2px 6px rgba(0,0,0,0.04)",
                  position: "relative",
                  transition: "box-shadow 0.2s ease, transform 0.2s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "1.6rem" }}>🎓</span>
                      <span
                        style={{
                          background: (course.isDefault || course.isFree) ? "#ecfdf5" : "#f1f5f9",
                          color: (course.isDefault || course.isFree) ? "#047857" : "#475569",
                          border: (course.isDefault || course.isFree) ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {(course.isDefault || course.isFree)
                          ? t("🎁 Бесплатно навсегда", "🎁 Free Forever")
                          : (course.badge || t("Курс", "Course"))}
                      </span>
                    </div>

                    {course.lessonsCount ? (
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#10b981", background: "#ecfdf5", padding: "3px 8px", borderRadius: "6px" }}>
                        {course.lessonsCount} {t("лекций", "lessons")}
                      </span>
                    ) : null}
                  </div>

                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.35 }}>
                    {course.title}
                  </h3>

                  <p style={{ margin: "0 0 14px 0", fontSize: "0.87rem", color: "#64748b", lineHeight: 1.5 }}>
                    {course.description || t("Практическая учебная программа с интерактивными материалами.", "Practical training program with interactive materials.")}
                  </p>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "0.8rem",
                      color: "#334155",
                      wordBreak: "break-all",
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      🔗 {course.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(course.url)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        padding: "2px 6px",
                        color: "#0f766e",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                      title={t("Скопировать ссылку", "Copy link")}
                    >
                      {t("Копия", "Copy")}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      background: "#10b981",
                      color: "#fff",
                      textDecoration: "none",
                      padding: "9px 14px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <span>▶</span> {(course.isDefault || course.isFree) ? t("Открыть курс ↗ (Бесплатно)", "Open Course ↗ (Free)") : t("Открыть курс ↗", "Open Course ↗")}
                  </a>

                  <button
                    type="button"
                    onClick={() => handleOpenEditCourse(course)}
                    style={{
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                    title={t("Изменить ссылку или название", "Edit URL or Title")}
                  >
                    ⚙️ {t("Изменить", "Edit")}
                  </button>

                  {!course.isDefault && !course.isPermanent && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(course.id)}
                      style={{
                        background: "#fee2e2",
                        color: "#dc2626",
                        border: "1px solid #fecaca",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                      title={t("Удалить курс из списка", "Delete course")}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STUDIO TOOLS & RADAR */}
      {activeTab === "tools" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Card 1: Breakout Rooms Setup */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>👥</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
                  {t("Сессионные залы (Breakout)", "Breakout Rooms")}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {t("Практика в парах и тройках", "Peer practice in dyads & triads")}
                </div>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
              {t(
                "Позволяет спикеру автоматически распределить до 200 слушателей по отдельным комнатам для отработки упражнений с таймером и вызовом преподавателя.",
                "Enables speakers to automatically distribute up to 200 attendees into private rooms for exercises with timers and speaker summons."
              )}
            </p>
            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", color: "#334155", border: "1px solid #f1f5f9" }}>
              {t("✓ Автоматическое деление по 2 или 3 человека", "✓ Automatic splitting into pairs or groups of three")}<br />
              {t("✓ Таймер сессии с предупреждением за 2 минуты", "✓ Session timer with 2-minute countdown warnings")}<br />
              {t("✓ Трансляция голоса ведущего во все залы одновременно", "✓ Host broadcast audio transmitted to all rooms simultaneously")}
            </div>
          </div>

          {/* Card 2: Waiting Room & Privacy */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>🔒</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
                  {t("Зал ожидания и Модерация", "Waiting Room & Moderation")}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {t("Фейсконтроль и безопасность", "Access control & attendee safety")}
                </div>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
              {t(
                "Исключает посторонних на закрытых терапевтических группах и супервизиях. Спикер или со-ведущий видит список ожидающих и пускает проверенных участников.",
                "Prevents uninvited participants in closed therapeutic and supervision groups. Host reviews pending attendees before admitting."
              )}
            </p>
            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", color: "#334155", border: "1px solid #f1f5f9" }}>
              {t("✓ Индивидуальный или групповой допуск в 1 клик", "✓ 1-click individual or bulk admission")}<br />
              {t("✓ Бан нецелевых пользователей (AI Bouncer)", "✓ Banning unauthorized users (AI Bouncer)")}<br />
              {t("✓ Вкладка Q&A с голосованием за вопросы (Upvotes)", "✓ Dedicated Q&A queue with upvoting")}
            </div>
          </div>

          {/* Card 3: Ping & Latency Radar */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>📡</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
                  {t("Радар сетевой задержки", "Network Latency Radar")}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {t("Тест связи перед эфиром", "Pre-flight connection test")}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 10px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "6px", color: "#065f46" }}>
                <span>{t("IDA LiveKit Server (Global S3/WebRTC):", "IDA LiveKit Server (Global S3/WebRTC):")}</span>
                <strong>{t("19-24 мс (Отлично)", "19-24 ms (Excellent)")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 10px", background: "#f8fafc", borderRadius: "6px", color: "#64748b" }}>
                <span>{t("Зарубежные сервисы видеосвязи:", "Legacy external gateways:")}</span>
                <span>{t("85-140 мс", "85-140 ms")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "6px 10px", background: "#f8fafc", borderRadius: "6px", color: "#64748b" }}>
                <span>{t("Традиционные вебинар-платформы:", "Legacy webinar platforms:")}</span>
                <span>{t("45-70 мс", "45-70 ms")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ecosystem Discovery Footer Banner (disabled) */}
      {false && !bannerHidden && (
        <div
          style={{
            position: "relative",
            marginTop: "32px",
            background: "linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)",
            border: "1px solid #99f6e4",
            borderRadius: "14px",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <button
            type="button"
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "transparent",
              border: "none",
              color: "#14b8a6",
              fontSize: "18px",
              lineHeight: 1,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px",
              opacity: 0.75,
            }}
            onClick={() => dismissBanner(true)}
            title={t("Закрыть и больше не показывать", "Close and don't show again")}
            aria-label={t("Закрыть", "Close")}
          >
            ✕
          </button>
          <div style={{ maxWidth: "700px", paddingRight: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(99, 102, 241, 0.15)", color: "#0d9488", padding: "2px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>
              <span>🌟</span> {t("Платформа для психологов нового поколения", "Next-Gen Platform for Mental Health Professionals")}
            </div>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
              {t("Изучите другие профессиональные инструменты IDA Psy для психологов", "Explore other professional IDA Psy tools")}
            </h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", lineHeight: 1.4 }}>
              {t(
                "Электронный Реестр клиентов (ФЗ-152), ИИ-ассистент Clinical Copilot для автопротоколирования сессий, интерактивная База Знаний и доказательные методики психотерапии.",
                "Electronic Client Registry (GDPR/HIPAA compliant), Clinical Copilot AI for session documentation, interactive Knowledge Base, and evidence-based psychotherapy protocols."
              )}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <a
              href={isIntl ? "https://ida-psy.pro/#capabilities" : "https://ida-psy.ru/#capabilities"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#0f766e",
                color: "#fff",
                textDecoration: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
              }}
            >
              {t("Изучите инструменты платформы →", "Explore platform tools →")}
            </a>
            <button
              type="button"
              className="btn btn-outline"
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                borderColor: "#99f6e4",
                color: "#0d9488",
                fontSize: "12px",
                cursor: "pointer",
                padding: "8px 14px",
                borderRadius: "8px",
              }}
              onClick={() => dismissBanner(true)}
            >
              {t("Больше не показывать", "Don't show again")}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT WEBINAR */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#1e293b" }}>
                {editingWebinar ? t("Редактирование вебинара", "Edit Webinar") : t("Запланировать новый вебинар", "Schedule New Webinar")}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWebinar} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  {t("Тема / Название вебинара *", "Topic / Webinar Title *")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("Например: Разбор протоколов КПТ при тревожных расстройствах", "e.g., CBT Clinical Protocols for Anxiety Disorders")}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  {t("Краткое описание и программа", "Brief Description & Agenda")}
                </label>
                <textarea
                  rows={3}
                  placeholder={t("О чем будет эфир, для кого полезно...", "Session overview, target audience, key takeaways...")}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    {t("Дата", "Date")}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    {t("Время", "Time")}
                  </label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    {t("Длительность", "Duration")}
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                  >
                    <option value={45}>{t("45 минут", "45 minutes")}</option>
                    <option value={60}>{t("1 час", "1 hour")}</option>
                    <option value={90}>{t("1.5 часа", "1.5 hours")}</option>
                    <option value={120}>{t("2 часа", "2 hours")}</option>
                    <option value={180}>{t("3 часа", "3 hours")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  {t("Формат и тип доступа", "Access Format & Room Type")}
                </label>
                <select
                  value={formAccessType}
                  onChange={(e) => setFormAccessType(e.target.value as any)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                >
                  <option value="open_200">{t("🌐 Открытый вебинар (до 200 слушателей, без лимита)", "🌐 Public Webinar (up to 200 attendees, unlimited)")}</option>
                  <option value="closed_group">{t("🔒 Закрытая группа / Супервизия (с Залом ожидания)", "🔒 Closed Group / Supervision (with Waiting Room)")}</option>
                  <option value="practicum_breakout">{t("👥 Практикум с отработкой (Сессионные залы Breakout)", "👥 Practicum with Exercises (Breakout Rooms)")}</option>
                </select>
              </div>

              {/* Toggles */}
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", display: "grid", gap: "10px", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={formRecording} onChange={(e) => setFormRecording(e.target.checked)} />
                  <span><strong>{t("Облачная запись в S3:", "S3 Cloud Recording:")}</strong> {t("Автоматическое сохранение MP4 + генерация ИИ-конспекта", "Automatic MP4 archive + AI notes generation")}</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={formBreakout} onChange={(e) => setFormBreakout(e.target.checked)} />
                  <span><strong>{t("Сессионные залы:", "Breakout Rooms:")}</strong> {t("Возможность делить слушателей на пары и тройки", "Split participants into pairs and triads")}</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={formWaitingRoom} onChange={(e) => setFormWaitingRoom(e.target.checked)} />
                  <span><strong>{t("Зал ожидания:", "Waiting Room:")}</strong> {t("Ручной допуск слушателей спикером", "Manual attendee admission by host")}</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                  <input type="checkbox" checked={formQa} onChange={(e) => setFormQa(e.target.checked)} />
                  <span><strong>{t("Вкладка Q&A:", "Q&A Tab:")}</strong> {t("Модерация вопросов с голосованием слушателей", "Audience questions with upvoting")}</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "10px 18px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
                >
                  {t("Отмена", "Cancel")}
                </button>
                <button
                  type="submit"
                  style={{ background: "#0f766e", color: "#fff", border: "none", padding: "10px 22px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
                >
                  {editingWebinar ? t("Сохранить изменения", "Save Changes") : t("Создать вебинар", "Create Webinar")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AI SUMMARY & GLOSSARY */}
      {viewingSummaryRec && viewingSummaryRec.aiSummary && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "0.8rem", background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                  ✨ {t("Сформировано ИИ IDA Clinical Copilot", "Generated by IDA Clinical Copilot")}
                </span>
                <h2 style={{ margin: "6px 0 0 0", fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}>
                  {t("Умный ИИ-конспект: ", "AI Clinical Notes: ")}{viewingSummaryRec.webinarTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingSummaryRec(null)}
                style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 6px 0", color: "#0f766e", fontSize: "0.95rem" }}>📌 {t("Краткое резюме эфира", "Session Executive Summary")}</h4>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: 1.5 }}>
                  {viewingSummaryRec.aiSummary.overview}
                </p>
              </div>

              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "#1e293b", fontSize: "0.95rem" }}>💡 {t("Ключевые инсайты и тезисы:", "Key Insights & Takeaways:")}</h4>
                <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "6px" }}>
                  {viewingSummaryRec.aiSummary.keyPoints.map((point, idx) => (
                    <li key={idx} style={{ fontSize: "0.85rem", color: "#334155", lineHeight: 1.4 }}>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "#1e293b", fontSize: "0.95rem" }}>📖 {t("Словарь терминов эфира:", "Session Terminology & Glossary:")}</h4>
                <div style={{ display: "grid", gap: "6px" }}>
                  {viewingSummaryRec.aiSummary.termGlossary.map((item, idx) => (
                    <div key={idx} style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: "6px", fontSize: "0.85rem" }}>
                      <strong style={{ color: "#0d9488" }}>{item.term}:</strong>{" "}
                      <span style={{ color: "#475569" }}>{item.definition}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {t("Слушатели могут забрать этот конспект в свой личный Кабинет IDA", "Attendees can save this summary to their personal IDA Cabinet")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleCopy(
                      `${viewingSummaryRec.webinarTitle}\n\n${viewingSummaryRec.aiSummary?.overview}\n\n${t("Тезисы:", "Takeaways:")}\n` +
                        viewingSummaryRec.aiSummary?.keyPoints.join("\n"),
                      t("Текст конспекта", "AI Notes"),
                    );
                  }}
                  style={{
                    background: "#0f766e",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  📋 {t("Экспорт в буфер", "Export to Clipboard")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD MATERIAL */}
      {showUploadMaterialModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>
                {t("Добавить сопутствующий документ", "Attach Document / Handout")}
              </h2>
              <button
                type="button"
                onClick={() => setShowUploadMaterialModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMaterial} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  {t("Вебинар *", "Webinar *")}
                </label>
                <select
                  required
                  value={selectedWebinarForMaterial}
                  onChange={(e) => setSelectedWebinarForMaterial(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                >
                  {webinars.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} ({w.scheduledDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  {t("Название материала для слушателей *", "Handout title for participants *")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("Например: Слайды презентации к лекции #2", "e.g., Presentation Slides for Lecture #2")}
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    {t("Тип документа", "Document Type")}
                  </label>
                  <select
                    value={matType}
                    onChange={(e) => setMatType(e.target.value as any)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                  >
                    <option value="presentation">{t("📊 Презентация / Слайды", "📊 Presentation / Slides")}</option>
                    <option value="handout">{t("📄 Памятка / Чек-лист", "📄 Handout / Checklist")}</option>
                    <option value="protocol">{t("📋 Протокол Базы Знаний", "📋 Knowledge Base Protocol")}</option>
                    <option value="document">{t("📑 Статья / Кейс", "📑 Article / Case Report")}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    {t("Имя файла", "File Name")}
                  </label>
                  <input
                    type="text"
                    placeholder="presentation_slides.pdf"
                    value={matFileName}
                    onChange={(e) => setMatFileName(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  {t("Тег протокола в Базе Знаний (опционально)", "Knowledge Base Protocol Tag (Optional)")}
                </label>
                <input
                  type="text"
                  placeholder="anxiety_panic_primary_v2"
                  value={matKbTag}
                  onChange={(e) => setMatKbTag(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowUploadMaterialModal(false)}
                  style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
                >
                  {t("Отмена", "Cancel")}
                </button>
                <button
                  type="submit"
                  style={{ background: "#0f766e", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
                >
                  {t("Прикрепить документ", "Attach Handout")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVE PAYWALL & VIDEO RETENTION MODAL */}
      {showArchivePaywallModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowArchivePaywallModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700, marginBottom: "8px" }}>
                  ⭐ {t("Бессрочное хранение видео", "Permanent Video Archiving")}
                </div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#1e293b" }}>
                  {t("Хранение видеозаписей и Вечный архив", "Video Storage & Permanent Archive")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowArchivePaywallModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 20px 0", fontSize: "0.9rem", color: "#64748b", lineHeight: 1.5 }}>
              {t(
                `Исходная запись вебинара «${showArchivePaywallModal.rec.webinarTitle}» (размер ${showArchivePaywallModal.rec.fileSizeMb} МБ) бесплатно хранится в облаке 14 дней. Выберите удобный способ сохранения:`,
                `The recording for "${showArchivePaywallModal.rec.webinarTitle}" (${showArchivePaywallModal.rec.fileSizeMb} MB) is stored for free in the cloud for 14 days. Choose your preferred storage option:`
              )}
            </p>

            {/* Option 1: Free Download */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: "12px",
                padding: "16px 18px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "1.2rem" }}>🟢</span>
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#166534" }}>
                  {t("Вариант 1: Скачать MP4 бесплатно (Рекомендуется)", "Option 1: Download MP4 for Free (Recommended)")}
                </h4>
              </div>
              <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#15803d", lineHeight: 1.5 }}>
                {t(
                  "Скачайте файл на свой компьютер, загрузите в закрытую группу VK, закрытый плейлист YouTube или на Яндекс.Диск. Текстовый ИИ-конспект, таймкоды и стенограмма останутся в вашем кабинете навсегда бесплатно.",
                  "Download the file to your computer or upload to private YouTube/Cloud drive. Text notes, timecodes, and transcripts stay in your account forever free."
                )}
              </p>
              <a
                href={showArchivePaywallModal.rec.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowArchivePaywallModal(null)}
                style={{
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                ⬇️ {t("Скачать видеофайл MP4 на компьютер", "Download MP4 Video to Computer")}
              </a>
            </div>

            {/* Option 2: S3 Cloud Archive */}
            <div
              style={{
                background: "#f8fafc",
                border: "1.5px solid #cbd5e1",
                borderRadius: "12px",
                padding: "16px 18px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "1.2rem" }}>🔒</span>
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                  {t("Вариант 2: Тариф «Вечный архив» — 299 ₽ / мес", "Option 2: Permanent Video Cloud — $4 / month")}
                </h4>
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
                {t(
                  "Подходит для авторских курсов, супервизий и обучающих программ с мгновенным плеером без внешних сервисов:",
                  "Ideal for author courses, supervision and training programs with instant playback without external services:"
                )}
              </p>
              <ul style={{ margin: "0 0 14px 0", paddingLeft: "20px", fontSize: "0.82rem", color: "#334155", display: "grid", gap: "5px" }}>
                <li>💾 <strong>{t("Включено 15 ГБ в S3:", "15 GB S3 storage included:")}</strong> {t("хватает на 15–20 больших лекций по 60 мин или до 60–80 уроков курса (2–3 полных курса)", "enough for 15–20 full 60-min lectures or 60–80 course lessons (2–3 full courses)")}</li>
                <li>🛡️ <strong>{t("100% сохранность ваших записей:", "100% Data Safety Guarantee:")}</strong> {t("при превышении лимита видео не удаляются; доступно расширение (+10 ГБ за 99 ₽/мес)", "files are never deleted if quota is exceeded; expandable for $1.5/mo per +10 GB")}</li>
                <li>🔒 <strong>{t("Конфиденциальность и плеер с DRM:", "Protected player & Watermark:")}</strong> {t("видео защищено водяным знаком от сливов на складчины", "embedded player protected with floating watermark against piracy")}</li>
                <li>⚡ <strong>{t("Мгновенный старт (S3 Range):", "Instant Range Streaming:")}</strong> {t("никаких задержек буферизации для ваших студентов", "zero buffering delay for students via HTTP 206")}</li>
              </ul>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a
                  href={isIntl ? "https://ida-psy.pro/?entry=creator" : "https://web.academy.ida-psy.ru/?entry=creator"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#0f766e",
                    color: "#fff",
                    border: "none",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  ⭐️ {t("Подключить Вечный архив (299 ₽/мес)", "Activate Permanent Cloud ($4/mo)")}
                </a>
                <a
                  href={isIntl ? "https://ida-psy.pro/#pricing" : "https://ida-psy.ru/#pricing"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#fff",
                    color: "#0f766e",
                    border: "1px solid #99f6e4",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {t("В тарифе Практик Pro (2 990 ₽)", "Included in Practicum Pro Plan")}
                </a>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowArchivePaywallModal(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {t("Закрыть", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WEBINAR CREATED SUCCESS & LINKS */}
      {createdWebinarSuccess && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "24px 28px",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                }}
              >
                ✓
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
                  {t("Вебинар успешно запланирован!", "Webinar scheduled successfully!")}
                </h3>
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  {t("Ссылки для участников и экран ожидания сформированы", "Attendee links and live waiting lobby created")}
                </div>
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>{createdWebinarSuccess.title}</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "4px" }}>
                🗓️ {createdWebinarSuccess.scheduledDate} {t("в", "at")} {createdWebinarSuccess.scheduledTime} • {t("Длительность:", "Duration:")} {createdWebinarSuccess.durationMinutes} {t("мин.", "min.")}
              </div>
            </div>

            {/* Links Section */}
            <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
              {/* Guest Link */}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
                    {t("👥 Ссылка для слушателей и гостей:", "👥 Link for attendees & guests:")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdWebinarSuccess.guestLink, t("Ссылка для слушателей", "Link for attendees"))}
                    style={{
                      background: copiedLink?.includes("слушателей") || copiedLink?.includes("attendees") ? "#10b981" : "#166534",
                      color: "#fff",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedLink?.includes("слушателей") || copiedLink?.includes("attendees") ? t("✓ Скопировано!", "✓ Copied!") : t("Скопировать 📋", "Copy 📋")}
                  </button>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#15803d", marginBottom: "6px" }}>
                  {t(
                    "При переходе гости увидят живой экран ожидания с обратным отсчетом, названием и временем начала.",
                    "Guests will see a live countdown waiting screen with topic and start time."
                  )}
                </div>
                <input
                  readOnly
                  value={createdWebinarSuccess.guestLink}
                  style={{
                    width: "100%",
                    fontSize: "0.78rem",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155",
                    fontFamily: "monospace",
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>

              {/* Speaker Link */}
              <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#3730a3" }}>
                    {t("🎙️ Ссылка для спикера / со-ведущего:", "🎙️ Co-host / Speaker link:")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdWebinarSuccess.speakerLink, t("Ссылка для спикера", "Link for speaker"))}
                    style={{
                      background: copiedLink?.includes("спикера") || copiedLink?.includes("speaker") ? "#10b981" : "#0d9488",
                      color: "#fff",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedLink?.includes("спикера") || copiedLink?.includes("speaker") ? t("✓ Скопировано!", "✓ Copied!") : t("Скопировать 🔗", "Copy 🔗")}
                  </button>
                </div>
                <input
                  readOnly
                  value={createdWebinarSuccess.speakerLink}
                  style={{
                    width: "100%",
                    fontSize: "0.78rem",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#334155",
                    fontFamily: "monospace",
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  const w = createdWebinarSuccess;
                  setCreatedWebinarSuccess(null);
                  setPreviewLobbyWebinar(w);
                }}
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>👁️ {t("Посмотреть экран ожидания", "Preview waiting screen")}</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatedWebinarSuccess(null)}
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {t("Отлично, закрыть", "Done, close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PREVIEW OF WEBINAR WAITING LOBBY */}
      {previewLobbyWebinar && (
        <WebinarWaitingLobby
          roomName={previewLobbyWebinar.roomName}
          title={previewLobbyWebinar.title}
          scheduledTime={`${previewLobbyWebinar.scheduledDate}T${previewLobbyWebinar.scheduledTime}`}
          speakerName={previewLobbyWebinar.speakerName}
          description={previewLobbyWebinar.description}
          role="speaker"
          onJoinRoom={() => {
            const room = previewLobbyWebinar.roomName;
            setPreviewLobbyWebinar(null);
            onLaunchStudio?.(room);
          }}
          onBack={() => setPreviewLobbyWebinar(null)}
        />
      )}

      {/* MODAL: SMART TRIM & PAUSE CUTTING */}
      {trimmingRec && (
        <VideoSmartTrimModal
          recording={trimmingRec}
          onSave={handleSaveTrim}
          onClose={() => setTrimmingRec(null)}
        />
      )}

      {/* MODAL: MONETIZATION & PAID ACCESS */}
      {monetizingRec && (
        <RecordingMonetizationModal
          recording={monetizingRec}
          onSave={handleSaveMonetization}
          onClose={() => setMonetizingRec(null)}
          onPreviewPlayer={(recId) => {
            setMonetizingRec(null);
            setPreviewingPlayerRecId(recId);
          }}
        />
      )}

      {/* FULLSCREEN PROTECTED RECORDING PLAYER */}
      {previewingPlayerRecId && (
        <ProtectedRecordingPlayer
          recordingId={previewingPlayerRecId}
          onClose={() => setPreviewingPlayerRecId(null)}
        />
      )}

      {/* MODAL: TILDA EMBED CODE */}
      {tildaEmbedRec && (
        <TildaEmbedCodeModal
          rec={tildaEmbedRec}
          onClose={() => setTildaEmbedRec(null)}
        />
      )}

      {/* MODAL: ATTACH TO ACADEMY COURSE */}
      {courseAttachRec && (
        <AttachRecordingToCourseModal
          rec={courseAttachRec}
          onClose={() => setCourseAttachRec(null)}
        />
      )}

      {/* MODAL: EDIT / ADD COURSE */}
      {(editingCourse || isAddingCourse) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => {
            if (!courseSaving) {
              setEditingCourse(null);
              setIsAddingCourse(false);
            }
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              maxWidth: "520px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.4rem" }}>🎓</span>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>
                  {isAddingCourse
                    ? t("Добавить обучающий курс", "Add Learning Course")
                    : t("Настройка курса и ссылки", "Configure Course & URL")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCourse(null);
                  setIsAddingCourse(false);
                }}
                disabled={courseSaving}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCourseForm}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  {t("Название курса / программы:", "Course Title:")}
                </label>
                <input
                  type="text"
                  value={courseFormTitle}
                  onChange={(e) => setCourseFormTitle(e.target.value)}
                  placeholder={t("Например: Базовый курс практической психотерапии", "E.g. Practical Psychotherapy Course")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  {t("Ссылка на курс (URL):", "Course URL:")}
                </label>
                <input
                  type="url"
                  value={courseFormUrl}
                  onChange={(e) => setCourseFormUrl(e.target.value)}
                  placeholder="https://prevention-ai.ru/course/"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                  required
                />
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
                  {t(
                    "Ссылка по умолчанию для вновь созданного терминала: https://prevention-ai.ru/course/",
                    "Default URL for newly created terminal: https://prevention-ai.ru/course/"
                  )}
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  {t("Краткое описание:", "Short Description:")}
                </label>
                <textarea
                  value={courseFormDesc}
                  onChange={(e) => setCourseFormDesc(e.target.value)}
                  rows={3}
                  placeholder={t("Количество лекций, протоколы, конспекты...", "Number of lessons, clinical protocols, notes...")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              {editingCourse?.isDefault && (
                <div style={{ marginBottom: "16px", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.82rem", color: "#166534", marginBottom: "6px" }}>
                    {t(
                      "Это основной курс рабочего места. Изменение этой ссылки сохранит её в настройках терминала и в LMS.",
                      "This is the workspace default course. Changing this URL persists it to terminal config and LMS."
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCourseFormUrl(DEFAULT_COURSE_URL);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#15803d",
                      textDecoration: "underline",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    {t("Подставить https://prevention-ai.ru/course/", "Use https://prevention-ai.ru/course/")}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCourse(null);
                    setIsAddingCourse(false);
                  }}
                  disabled={courseSaving}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  {t("Отмена", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={courseSaving}
                  style={{
                    background: "#0f766e",
                    color: "#fff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                  }}
                >
                  {courseSaving ? t("Сохранение...", "Saving...") : t("Сохранить", "Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGuide && (
        <ModuleGuideModal
          moduleId="webinars"
          isCommercial={isCommercialOrg(cfg)}
          isOpen={showGuide}
          onClose={() => setShowGuide(false)}
        />
      )}
    </div>
  );
}
