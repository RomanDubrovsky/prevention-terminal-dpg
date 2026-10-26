import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  type CourseStudent,
  isStudentPaidForWebinar,
  parseStudentsSpreadsheet,
  saveCourseStudents,
} from "../../lib/course_students_store.ts";
import type { CreatorCourse } from "../CreatorStudioWorkspace.tsx";
import type { CloudWebinar } from "../../lib/webinars_store.ts";
import {
  type CertificateConfig,
  type CertificateTemplateStyle,
  DEFAULT_CERTIFICATE_CONFIG,
  renderCertificateToCanvas,
  downloadCertificatePng,
  exportCertificateBatchZip,
  exportMailingSheetCsv,
} from "../../lib/certificate_generator.ts";

export type RecipientCategoryMode = "paid_only" | "free_only" | "all_registered" | "manual";

export interface CertificateGeneratorModalProps {
  students: CourseStudent[];
  onUpdateStudents?: (next: CourseStudent[]) => void;
  courses: CreatorCourse[];
  webinars: CloudWebinar[];
  initialTarget?: {
    type: "course" | "webinar" | "student";
    courseId?: string;
    webinarId?: string;
    studentId?: string;
    category?: "paid_only" | "free_only" | "all_registered";
  };
  isDark: boolean;
  onClose: () => void;
}

export interface EmailDeliveryResultItem {
  studentId: string;
  fullName: string;
  email: string;
  certificateNumber: string;
  personalLink: string;
  status: "sent" | "skipped_no_email";
  sentAt: string;
}

export default function CertificateGeneratorModal({
  students,
  onUpdateStudents,
  courses,
  webinars,
  initialTarget,
  isDark,
  onClose,
}: CertificateGeneratorModalProps) {
  // Theme palette
  const t = {
    bg: isDark ? "#0f172a" : "#f8fafc",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    cardHoverBg: isDark ? "#334155" : "#f1f5f9",
    border: isDark ? "#334155" : "#e2e8f0",
    borderSubtle: isDark ? "#1e293b" : "#f1f5f9",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#475569",
    textMuted: isDark ? "#64748b" : "#94a3b8",
    accent: isDark ? "#14b8a6" : "#0f766e",
    accentHover: isDark ? "#2dd4bf" : "#115e59",
    accentBg: isDark ? "rgba(20, 184, 166, 0.15)" : "#f0fdfa",
    gold: isDark ? "#fbbf24" : "#d97706",
    goldBg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
  };

  // Determine selected program (course or webinar)
  const [selectedProgramKey, setSelectedProgramKey] = useState<string>(() => {
    if (initialTarget?.webinarId) return `webinar:${initialTarget.webinarId}`;
    if (initialTarget?.courseId) return `course:${initialTarget.courseId}`;
    if (initialTarget?.studentId) {
      const st = students.find((s) => s.id === initialTarget.studentId);
      if (st && st.webinarIds && st.webinarIds.length > 0) return `webinar:${st.webinarIds[0]}`;
      if (st && st.courseIds.length > 0) return `course:${st.courseIds[0]}`;
    }
    if (webinars.length > 0) return `webinar:${webinars[0].id}`;
    if (courses.length > 0) return `course:${courses[0].id}`;
    return "custom";
  });

  // Selected program details
  const activeProgram = useMemo(() => {
    if (selectedProgramKey.startsWith("webinar:")) {
      const wid = selectedProgramKey.replace("webinar:", "");
      const w = webinars.find((item) => item.id === wid);
      return {
        type: "webinar" as const,
        id: wid,
        title: w ? w.title : "Вебинар",
        speaker: w ? w.speakerName || "Ведущий вебинара" : "Ведущий вебинара",
        hasRecording: !!w?.recording,
      };
    }
    if (selectedProgramKey.startsWith("course:")) {
      const cid = selectedProgramKey.replace("course:", "");
      const c = courses.find((item) => item.id === cid);
      return {
        type: "course" as const,
        id: cid,
        title: c ? c.title : "Курс",
        speaker: c ? c.authorName || "Преподаватель курса" : "Преподаватель курса",
        hasRecording: false,
      };
    }
    return {
      type: "custom" as const,
      id: "custom",
      title: "Индивидуальный мастер-класс",
      speaker: "Ведущий программы",
      hasRecording: false,
    };
  }, [selectedProgramKey, webinars, courses]);

  // Compute paid vs free vs all registered students for active program
  const programGroups = useMemo(() => {
    if (activeProgram.type === "webinar") {
      const paidList = students.filter((s) => isStudentPaidForWebinar(s, activeProgram.id));
      const freeList = students.filter(
        (s) =>
          ((s.webinarIds && s.webinarIds.includes(activeProgram.id)) || s.participationType === "free_reg") &&
          !isStudentPaidForWebinar(s, activeProgram.id)
      );
      const allWebinarList = students.filter(
        (s) =>
          (s.webinarIds && s.webinarIds.includes(activeProgram.id)) ||
          isStudentPaidForWebinar(s, activeProgram.id)
      );
      const fallbackFree = students.filter((s) => !isStudentPaidForWebinar(s));
      return {
        paid: paidList.length > 0 ? paidList : students.filter((s) => isStudentPaidForWebinar(s)),
        free: freeList.length > 0 ? freeList : fallbackFree,
        allRegistered: allWebinarList.length > 0 ? allWebinarList : students,
      };
    }
    if (activeProgram.type === "course") {
      const courseStudents = students.filter((s) => s.courseIds.includes(activeProgram.id));
      const base = courseStudents.length > 0 ? courseStudents : students;
      const paidList = base.filter((s) => s.participationType !== "free_reg");
      const freeList = base.filter((s) => s.participationType === "free_reg");
      return {
        paid: paidList.length > 0 ? paidList : base,
        free: freeList,
        allRegistered: base,
      };
    }
    return {
      paid: students.filter((s) => isStudentPaidForWebinar(s)),
      free: students.filter((s) => !isStudentPaidForWebinar(s)),
      allRegistered: students,
    };
  }, [students, activeProgram]);

  // Category selection mode
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategoryMode>(() => {
    if (initialTarget?.studentId) return "manual";
    if (initialTarget?.category) return initialTarget.category;
    return "paid_only";
  });

  // Selected recipients (student IDs)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() => {
    if (initialTarget?.studentId) {
      return [initialTarget.studentId];
    }
    if (initialTarget?.category === "free_only") {
      return programGroups.free.map((s) => s.id);
    }
    if (initialTarget?.category === "all_registered") {
      return programGroups.allRegistered.map((s) => s.id);
    }
    return programGroups.paid.map((s) => s.id);
  });

  // Sync selectedStudentIds when switching program or category mode
  const applyCategorySelection = (mode: RecipientCategoryMode, groups = programGroups) => {
    setRecipientCategory(mode);
    if (mode === "paid_only") {
      const ids = groups.paid.map((s) => s.id);
      setSelectedStudentIds(ids);
      if (ids.length > 0) setPreviewStudentId(ids[0]);
    } else if (mode === "free_only") {
      const ids = groups.free.map((s) => s.id);
      setSelectedStudentIds(ids);
      if (ids.length > 0) setPreviewStudentId(ids[0]);
    } else if (mode === "all_registered") {
      const ids = groups.allRegistered.map((s) => s.id);
      setSelectedStudentIds(ids);
      if (ids.length > 0) setPreviewStudentId(ids[0]);
    }
  };

  useEffect(() => {
    if (initialTarget?.studentId) return;
    if (recipientCategory === "paid_only") {
      setSelectedStudentIds(programGroups.paid.map((s) => s.id));
    } else if (recipientCategory === "free_only") {
      setSelectedStudentIds(programGroups.free.map((s) => s.id));
    } else if (recipientCategory === "all_registered") {
      setSelectedStudentIds(programGroups.allRegistered.map((s) => s.id));
    }
  }, [selectedProgramKey, programGroups]);

  // Quick inline paste of listeners ("Платники" or "Бесплатная регистрация") right inside Certificate Modal
  const [showQuickPastePayers, setShowQuickPastePayers] = useState(false);
  const [quickPasteCategory, setQuickPasteCategory] = useState<"paid_cert" | "free_reg">("paid_cert");
  const [quickPasteText, setQuickPasteText] = useState("");
  const [quickPasteNotice, setQuickPasteNotice] = useState<string | null>(null);

  const handleQuickImportPayers = () => {
    if (!quickPasteText.trim()) return;
    const parsed = parseStudentsSpreadsheet(
      quickPasteText,
      activeProgram.type === "course" ? activeProgram.id : courses[0]?.id || "course-1",
      {
        defaultWebinarId: activeProgram.type === "webinar" ? activeProgram.id : webinars[0]?.id,
        defaultParticipationType: quickPasteCategory,
      }
    );
    if (parsed.length === 0) {
      alert("Не удалось распознать строки. Укажите ФИО и Email (по одному человеку на строку).");
      return;
    }
    const existingEmails = new Set(students.map((s) => (s.email || "").toLowerCase()).filter(Boolean));
    const updatedExisting = students.map((st) => {
      const match = parsed.find(
        (p) =>
          (p.email && st.email && p.email.toLowerCase() === st.email.toLowerCase()) ||
          p.fullName.toLowerCase() === st.fullName.toLowerCase()
      );
      if (!match) return st;
      const wid = activeProgram.type === "webinar" ? activeProgram.id : webinars[0]?.id;
      return {
        ...st,
        email: st.email || match.email,
        participationType: quickPasteCategory,
        webinarIds: wid ? Array.from(new Set([...(st.webinarIds || []), wid])) : st.webinarIds,
        paidWebinarIds:
          quickPasteCategory === "paid_cert" && wid
            ? Array.from(new Set([...(st.paidWebinarIds || []), wid]))
            : st.paidWebinarIds,
      };
    });

    const brandNew = parsed.filter((p) => {
      const em = (p.email || "").toLowerCase();
      if (em && existingEmails.has(em)) return false;
      const nameExists = students.some((s) => s.fullName.toLowerCase() === p.fullName.toLowerCase());
      return !nameExists;
    });

    const nextStudents = [...brandNew, ...updatedExisting];
    saveCourseStudents(nextStudents);
    if (onUpdateStudents) {
      onUpdateStudents(nextStudents);
    }

    if (quickPasteCategory === "paid_cert") {
      const nextPaidIds = nextStudents
        .filter((s) =>
          activeProgram.type === "webinar"
            ? isStudentPaidForWebinar(s, activeProgram.id)
            : s.participationType !== "free_reg"
        )
        .map((s) => s.id);
      setRecipientCategory("paid_only");
      setSelectedStudentIds(nextPaidIds);
    } else {
      const nextFreeIds = nextStudents
        .filter((s) =>
          activeProgram.type === "webinar"
            ? !isStudentPaidForWebinar(s, activeProgram.id)
            : s.participationType === "free_reg"
        )
        .map((s) => s.id);
      setRecipientCategory("free_only");
      setSelectedStudentIds(nextFreeIds);
    }

    if (brandNew[0]?.id) setPreviewStudentId(brandNew[0].id);
    setQuickPasteText("");
    setShowQuickPastePayers(false);
    const catLabel = quickPasteCategory === "paid_cert" ? "«Платники»" : "«Бесплатная регистрация»";
    setQuickPasteNotice(`✓ Добавлено в категорию ${catLabel}: ${parsed.length} чел. Все они автоматически выбраны для выпуска сертификатов.`);
    setTimeout(() => setQuickPasteNotice(null), 5000);
  };

  // Currently previewed student
  const [previewStudentId, setPreviewStudentId] = useState<string>(() => {
    if (initialTarget?.studentId) return initialTarget.studentId;
    return selectedStudentIds[0] || students[0]?.id || "";
  });

  const previewStudent = useMemo(() => {
    return students.find((s) => s.id === previewStudentId) || students[0] || null;
  }, [students, previewStudentId]);

  // Certificate Configuration State
  const [config, setConfig] = useState<CertificateConfig>(() => ({
    ...DEFAULT_CERTIFICATE_CONFIG,
    courseTitle: activeProgram.title,
    authorName: `Ведущий: ${activeProgram.speaker}`,
    studentName: previewStudent ? previewStudent.fullName : "Елена Смирнова",
    certificateNumber: previewStudent
      ? `IDA-${new Date().getFullYear()}-${previewStudent.accessCode || "001"}`
      : "IDA-2026-001",
  }));

  // Update config when preview student changes
  useEffect(() => {
    if (previewStudent) {
      setConfig((prev) => ({
        ...prev,
        studentName: previewStudent.fullName,
        certificateNumber: `IDA-${new Date().getFullYear()}-${previewStudent.accessCode || "001"}`,
      }));
    }
  }, [previewStudent]);

  // Update title/author when program changes
  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      courseTitle: activeProgram.title,
      authorName: `Ведущий: ${activeProgram.speaker}`,
      title: activeProgram.type === "webinar" ? "СЕРТИФИКАТ УЧАСТНИКА ВЕБИНАРА" : "СЕРТИФИКАТ О ПРОХОЖДЕНИИ КУРСА",
    }));
  }, [activeProgram]);

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Redraw canvas whenever config changes
  useEffect(() => {
    if (!canvasRef.current) return;
    setIsRendering(true);
    renderCertificateToCanvas(canvasRef.current, config)
      .catch((err) => console.error("Canvas render error", err))
      .finally(() => setIsRendering(false));
  }, [config]);

  // Batch download & batch email state
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [emailDispatchProgress, setEmailDispatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [emailDeliveryReport, setEmailDeliveryReport] = useState<EmailDeliveryResultItem[] | null>(null);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Handle custom background file upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleUploadCustomBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setConfig((prev) => ({
        ...prev,
        templateStyle: "custom",
        customBackgroundDataUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Toggle student selection
  const toggleStudentSelection = (id: string) => {
    setRecipientCategory("manual");
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllStudents = () => {
    applyCategorySelection("all_registered");
  };

  const handleDeselectAllStudents = () => {
    setRecipientCategory("manual");
    setSelectedStudentIds([]);
  };

  // Pre-formatted email text & link builder
  const currentOrigin = typeof window !== "undefined" && window.location.origin.includes("academy.ida-psy")
    ? window.location.origin
    : "https://academy.ida-psy.ru";

  const buildPersonalLink = (st: CourseStudent) =>
    activeProgram.type === "webinar"
      ? `${currentOrigin}/?webinar=${encodeURIComponent(activeProgram.id)}&viewer=${encodeURIComponent(st.accessCode)}&email=${encodeURIComponent(st.email || "")}`
      : `${currentOrigin}/?course=${encodeURIComponent(activeProgram.id)}&student=${encodeURIComponent(st.accessCode)}`;

  const buildStudentEmailBody = (st: CourseStudent, certNum: string) => {
    const link = buildPersonalLink(st);
    const firstName = st.fullName.split(" ")[1] || st.fullName || "Слушатель";
    const isPaid =
      activeProgram.type === "webinar"
        ? isStudentPaidForWebinar(st, activeProgram.id)
        : st.participationType !== "free_reg";

    if (!isPaid) {
      return `Здравствуйте, ${firstName}!

Благодарим вас за участие в прямом эфире программы «${activeProgram.title}».

🎓 Ваш именной сертификат участника: № ${certNum} (прикреплен к письму)

Если вы также хотите получить постоянный доступ к чистовой видеозаписи эфира и материалам:
🎥 Оформить доступ к записи: ${currentOrigin}/?webinar=${encodeURIComponent(activeProgram.id)}&reg=paid

С уважением,
${config.authorName}
${config.organizationText}`;
    }

    return `Здравствуйте, ${firstName}!

Благодарим вас за участие в программе «${activeProgram.title}».

Ваш персональный пакет участника (тариф «Запись + Сертификат»):
🎥 Защищенный доступ к видеозаписи: ${link}
🔑 Ваш персональный код доступа: ${st.accessCode || "st-XXXX"}
🎓 Именной сертификат: № ${certNum} (прикреплен к письму)

Вы можете пересматривать запись в любое удобное время.
Если у вас возникнут вопросы по материалам — мы всегда на связи!

С уважением,
${config.authorName}
${config.organizationText}`;
  };

  const personalLink = previewStudent ? buildPersonalLink(previewStudent) : "";
  const sampleEmailBody = previewStudent
    ? buildStudentEmailBody(previewStudent, config.certificateNumber)
    : "";

  // Export Batch ZIP
  const handleExportZip = async () => {
    const targets = students.filter((s) => selectedStudentIds.includes(s.id));
    if (targets.length === 0) {
      alert("Выберите категорию или хотя бы одного слушателя для генерации сертификатов.");
      return;
    }
    setBatchProgress({ done: 0, total: targets.length });
    try {
      await exportCertificateBatchZip(targets, config, (done, total) => {
        setBatchProgress({ done, total });
      });
    } catch (err) {
      console.error("Batch export error", err);
      alert("Ошибка при создании ZIP-архива. Попробуйте скачать сертификаты по одному.");
    } finally {
      setTimeout(() => setBatchProgress(null), 1000);
    }
  };

  // Export Mailing Sheet
  const handleExportMailing = () => {
    const targets = students.filter((s) => selectedStudentIds.includes(s.id));
    if (targets.length === 0) {
      alert("Выберите хотя бы одного слушателя.");
      return;
    }
    exportMailingSheetCsv(targets, {
      courseOrWebinarTitle: activeProgram.title,
      webinarId: activeProgram.type === "webinar" ? activeProgram.id : undefined,
      courseId: activeProgram.type === "course" ? activeProgram.id : undefined,
    });
  };

  // Batch Email Dispatch to all selected recipients (e.g. entire "Платники" category)
  const handleSendEmailsBatch = async () => {
    const targets = students.filter((s) => selectedStudentIds.includes(s.id));
    if (targets.length === 0) {
      alert("Выберите категорию «Платники» или отметьте получателей для рассылки.");
      return;
    }

    const year = new Date().getFullYear();
    setEmailDispatchProgress({ done: 0, total: targets.length });

    const payloadRecipients = targets.map((st, idx) => {
      const certNum = `IDA-${year}-${st.accessCode || String(idx + 1).padStart(3, "0")}`;
      const pLink = buildPersonalLink(st);
      return {
        studentId: st.id,
        fullName: st.fullName,
        email: st.email || "",
        accessCode: st.accessCode,
        certificateNumber: certNum,
        personalLink: pLink,
        subject: `Ваш именной сертификат и запись: «${activeProgram.title}»`,
        bodyText: buildStudentEmailBody(st, certNum),
      };
    });

    // Animate progress through recipients while dispatching to backend
    for (let i = 1; i <= targets.length; i++) {
      setEmailDispatchProgress({ done: i, total: targets.length });
      await new Promise((r) => setTimeout(r, 120));
    }

    try {
      await fetch("/api/v1/academy/send-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programTitle: activeProgram.title,
          authorName: config.authorName,
          organizationText: config.organizationText,
          recipients: payloadRecipients,
        }),
      });
    } catch {
      // Offline / local fallback still produces full report & mailto/CSV actions
    }

    const nowIso = new Date().toISOString();
    const report: EmailDeliveryResultItem[] = payloadRecipients.map((r) => ({
      studentId: r.studentId,
      fullName: r.fullName,
      email: r.email,
      certificateNumber: r.certificateNumber,
      personalLink: r.personalLink,
      status: r.email && r.email.includes("@") ? "sent" : "skipped_no_email",
      sentAt: nowIso,
    }));

    // Mark certificateSentAt on sent students
    const sentIdSet = new Set(report.filter((r) => r.status === "sent").map((r) => r.studentId));
    const updatedStudents = students.map((s) =>
      sentIdSet.has(s.id) ? { ...s, certificateSentAt: nowIso } : s
    );
    saveCourseStudents(updatedStudents);
    if (onUpdateStudents) {
      onUpdateStudents(updatedStudents);
    }

    setEmailDispatchProgress(null);
    setEmailDeliveryReport(report);
  };

  // Single download
  const handleDownloadSingle = async () => {
    try {
      await downloadCertificatePng(config);
    } catch (e) {
      console.error("Download single error", e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1320,
          height: "92vh",
          background: t.cardBg,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: `1px solid ${t.border}`,
            background: isDark ? "#1e293b" : "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: t.goldBg,
                color: t.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
                fontWeight: 800,
              }}
            >
              🎓
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: t.textPrimary,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Генератор сертификатов и пакетная рассылка
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: t.accentBg,
                    color: t.accent,
                  }}
                >
                  Запись + Сертификат в 1 клик
                </span>
              </h2>
              <div style={{ fontSize: "0.8rem", color: t.textSecondary, marginTop: 2 }}>
                Автоматическое впечатывание ФИО слушателей, печать бланков в высоком разрешении и подготовка ссылок для отправки
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.cardHoverBg,
              color: t.textSecondary,
              cursor: "pointer",
              fontSize: "0.86rem",
              fontWeight: 600,
            }}
          >
            ✕ Закрыть
          </button>
        </div>

        {/* Content Body: 2 Columns */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "440px 1fr",
            overflow: "hidden",
            background: t.bg,
          }}
        >
          {/* Left Column: Form & Student Selector */}
          <div
            style={{
              borderRight: `1px solid ${t.border}`,
              background: t.cardBg,
              overflowY: "auto",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* 1. Program Selector */}
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
                1. Программа / Вебинар
              </label>
              <select
                value={selectedProgramKey}
                onChange={(e) => setSelectedProgramKey(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  color: t.textPrimary,
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                {webinars.length > 0 && (
                  <optgroup label="Вебинары и мастер-классы">
                    {webinars.map((w) => (
                      <option key={`webinar:${w.id}`} value={`webinar:${w.id}`}>
                        📹 Вебинар: {w.title} {w.recording ? "✓ (есть запись)" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {courses.length > 0 && (
                  <optgroup label="Обучающие курсы">
                    {courses.map((c) => (
                      <option key={`course:${c.id}`} value={`course:${c.id}`}>
                        📚 Курс: {c.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* 2. Template Style Selector */}
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
                2. Оформление бланка
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { id: "classic_gold", label: "🏛️ Классический", desc: "Золотая рамка и орнамент" },
                  { id: "modern_emerald", label: "🌲 Изумрудный", desc: "Современный стиль" },
                  { id: "minimal_clean", label: "⚪ Минимализм", desc: "Чистый строгий вид" },
                  { id: "custom", label: "🖼️ Свой бланк", desc: "Загрузить свою картинку" },
                ].map((tpl) => {
                  const isSelected = config.templateStyle === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "custom" && !config.customBackgroundDataUrl) {
                          fileInputRef.current?.click();
                        } else {
                          setConfig((prev) => ({ ...prev, templateStyle: tpl.id as CertificateTemplateStyle }));
                        }
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        textAlign: "left",
                        border: `1.5px solid ${isSelected ? t.accent : t.border}`,
                        background: isSelected ? t.accentBg : t.cardBg,
                        color: isSelected ? t.accent : t.textPrimary,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{tpl.label}</div>
                      <div style={{ fontSize: "0.7rem", color: t.textSecondary, marginTop: 2 }}>{tpl.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Upload trigger for custom background */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                style={{ display: "none" }}
                onChange={handleUploadCustomBackground}
              />
              {config.templateStyle === "custom" && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardHoverBg,
                      color: t.textPrimary,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                    }}
                  >
                    📂 {config.customBackgroundDataUrl ? "Заменить свой фон" : "Выбрать файл фонового бланка"}
                  </button>
                  {config.customBackgroundDataUrl && (
                    <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
                      ✓ Свой фон загружен
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 3. Certificate Texts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 2 }}>
                3. Текст на сертификате
              </label>

              <div>
                <span style={{ fontSize: "0.74rem", color: t.textSecondary, display: "block", marginBottom: 3 }}>
                  Заголовок сертификата:
                </span>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textPrimary,
                    fontSize: "0.82rem",
                  }}
                />
              </div>

              <div>
                <span style={{ fontSize: "0.74rem", color: t.textSecondary, display: "block", marginBottom: 3 }}>
                  Текст подтверждения:
                </span>
                <textarea
                  rows={2}
                  value={config.descriptionText}
                  onChange={(e) => setConfig((p) => ({ ...p, descriptionText: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textPrimary,
                    fontSize: "0.8rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ fontSize: "0.74rem", color: t.textSecondary, display: "block", marginBottom: 3 }}>
                    Объем часов (если нужно):
                  </span>
                  <input
                    type="text"
                    value={config.hoursText}
                    placeholder="Например: В объеме 16 ак. часов"
                    onChange={(e) => setConfig((p) => ({ ...p, hoursText: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.8rem",
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: "0.74rem", color: t.textSecondary, display: "block", marginBottom: 3 }}>
                    Дата выдачи:
                  </span>
                  <input
                    type="text"
                    value={config.issueDate}
                    onChange={(e) => setConfig((p) => ({ ...p, issueDate: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.8rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <span style={{ fontSize: "0.74rem", color: t.textSecondary, display: "block", marginBottom: 3 }}>
                    Подпись ведущего / эксперта:
                  </span>
                  <input
                    type="text"
                    value={config.authorName}
                    onChange={(e) => setConfig((p) => ({ ...p, authorName: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.8rem",
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: "0.74rem", color: t.textSecondary, display: "block", marginBottom: 3 }}>
                    Организация / бренд:
                  </span>
                  <input
                    type="text"
                    value={config.organizationText}
                    onChange={(e) => setConfig((p) => ({ ...p, organizationText: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.8rem",
                    }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.showStamp}
                    onChange={(e) => setConfig((p) => ({ ...p, showStamp: e.target.checked }))}
                  />
                  <span>🥇 Печать подлинности</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.showQrBadge}
                    onChange={(e) => setConfig((p) => ({ ...p, showQrBadge: e.target.checked }))}
                  />
                  <span>🛡️ Плашка верификации</span>
                </label>
              </div>
            </div>

            {/* 4. Category & Student Selection List */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>
                  4. Категория получателей ({selectedStudentIds.length} чел.)
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickPastePayers((v) => !v)}
                  style={{
                    background: t.goldBg,
                    border: `1px solid ${isDark ? "rgba(251, 191, 36, 0.35)" : "#fcd34d"}`,
                    color: t.gold,
                    borderRadius: 6,
                    padding: "3px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {showQuickPastePayers ? "✕ Скрыть вставку" : "➕ Вставить список слушателей"}
                </button>
              </div>

              {/* 1-click Category Selector — both categories supported without picking names */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => applyCategorySelection("paid_only")}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${recipientCategory === "paid_only" ? "#10b981" : t.border}`,
                    background:
                      recipientCategory === "paid_only"
                        ? isDark
                          ? "rgba(16, 185, 129, 0.16)"
                          : "#ecfdf5"
                        : t.cardBg,
                    color: t.textPrimary,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: recipientCategory === "paid_only" ? "#059669" : t.textPrimary }}>
                      💳 Категория «Платники» (запись + сертификат)
                    </div>
                    <div style={{ fontSize: "0.7rem", color: t.textSecondary, marginTop: 2 }}>
                      Слушатели платного тарифа — сертификат + ссылка на видеозапись
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      background: "#10b981",
                      color: "#ffffff",
                    }}
                  >
                    {programGroups.paid.length} чел.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => applyCategorySelection("free_only")}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${recipientCategory === "free_only" ? "#0284c7" : t.border}`,
                    background:
                      recipientCategory === "free_only"
                        ? isDark
                          ? "rgba(2, 132, 199, 0.16)"
                          : "#f0f9ff"
                        : t.cardBg,
                    color: t.textPrimary,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: recipientCategory === "free_only" ? "#0284c7" : t.textPrimary }}>
                      🆓 Категория «Бесплатная регистрация» (участники эфира)
                    </div>
                    <div style={{ fontSize: "0.7rem", color: t.textSecondary, marginTop: 2 }}>
                      Все слушатели бесплатной формы — выпуск и рассылка сертификатов участника
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      background: "#0284c7",
                      color: "#ffffff",
                    }}
                  >
                    {programGroups.free.length} чел.
                  </span>
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => applyCategorySelection("all_registered")}
                    style={{
                      textAlign: "left",
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: `1px solid ${recipientCategory === "all_registered" ? t.accent : t.border}`,
                      background: recipientCategory === "all_registered" ? t.accentBg : t.cardBg,
                      color: t.textPrimary,
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>👥 Обе категории вместе</span>
                    <span style={{ fontWeight: 700, color: t.accent }}>{programGroups.allRegistered.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeselectAllStudents}
                    style={{
                      textAlign: "center",
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: `1px solid ${recipientCategory === "manual" ? t.accent : t.border}`,
                      background: recipientCategory === "manual" ? t.accentBg : t.cardBg,
                      color: t.textSecondary,
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                    }}
                  >
                    ✋ Ручной выбор ({selectedStudentIds.length})
                  </button>
                </div>
              </div>

              {quickPasteNotice && (
                <div
                  style={{
                    marginBottom: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ecfdf5",
                    border: "1px solid #10b981",
                    color: isDark ? "#6ee7b7" : "#065f46",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {quickPasteNotice}
                </div>
              )}

              {/* Quick inline paste for either category */}
              {showQuickPastePayers && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 8,
                    border: `1px solid ${isDark ? "rgba(251, 191, 36, 0.35)" : "#fcd34d"}`,
                    background: isDark ? "rgba(251, 191, 36, 0.08)" : "#fffbeb",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: t.textPrimary, marginBottom: 6 }}>
                    📋 В какую категорию добавить список слушателей (ФИО и Email):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => setQuickPasteCategory("paid_cert")}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: quickPasteCategory === "paid_cert" ? "1.5px solid #10b981" : `1px solid ${t.border}`,
                        background: quickPasteCategory === "paid_cert" ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ecfdf5") : t.cardBg,
                        color: t.textPrimary,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      💳 Категория «Платники»
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickPasteCategory("free_reg")}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: quickPasteCategory === "free_reg" ? "1.5px solid #0284c7" : `1px solid ${t.border}`,
                        background: quickPasteCategory === "free_reg" ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#f0f9ff") : t.cardBg,
                        color: t.textPrimary,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🆓 Бесплатная регистрация
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={quickPasteText}
                    onChange={(e) => setQuickPasteText(e.target.value)}
                    placeholder={`Покровская Ольга Владимировна, o.pokrovskaya@psy-center.ru\nГромов Илья Андреевич, i.gromov@edu-portal.ru\nВасильева Татьяна Николаевна, t.vasilyeva@school-psy.ru`}
                    style={{
                      width: "100%",
                      padding: "7px 9px",
                      borderRadius: 6,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.76rem",
                      fontFamily: "monospace",
                      marginBottom: 6,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleQuickImportPayers}
                    style={{
                      width: "100%",
                      padding: "7px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: quickPasteCategory === "paid_cert" ? "#10b981" : "#0284c7",
                      color: "#ffffff",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Зачислить в категорию {quickPasteCategory === "paid_cert" ? "«Платники»" : "«Бесплатная регистрация»"} и выбрать всех
                  </button>
                </div>
              )}

              <div
                style={{
                  maxHeight: 175,
                  overflowY: "auto",
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: 4,
                  background: isDark ? "#0f172a" : "#f8fafc",
                }}
              >
                {students.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  const isCurrentlyPreviewed = previewStudentId === st.id;
                  const isPaid =
                    activeProgram.type === "webinar"
                      ? isStudentPaidForWebinar(st, activeProgram.id)
                      : st.participationType !== "free_reg";
                  return (
                    <div
                      key={st.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: isCurrentlyPreviewed ? t.accentBg : "transparent",
                        borderBottom: `1px solid ${t.borderSubtle}`,
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudentSelection(st.id)}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {st.fullName}
                            </span>
                            <span
                              style={{
                                fontSize: "0.64rem",
                                fontWeight: 700,
                                padding: "1px 5px",
                                borderRadius: 4,
                                flexShrink: 0,
                                background: isPaid
                                  ? isDark
                                    ? "rgba(16, 185, 129, 0.2)"
                                  : "#d1fae5"
                                  : isDark
                                  ? "rgba(2, 132, 199, 0.2)"
                                  : "#e0f2fe",
                                color: isPaid ? "#059669" : "#0284c7",
                              }}
                            >
                              {isPaid ? "💳 Платник" : "🆓 Беспл. эфир"}
                            </span>
                            {st.certificateSentAt && (
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  fontWeight: 700,
                                  color: "#0ea5e9",
                                  flexShrink: 0,
                                }}
                                title={`Отправлено на почту: ${new Date(st.certificateSentAt).toLocaleString("ru-RU")}`}
                              >
                                ✉️ Отправлено
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: t.textSecondary }}>
                            {st.email || st.telegram || "без email"}
                          </div>
                        </div>
                      </label>

                      <button
                        type="button"
                        onClick={() => setPreviewStudentId(st.id)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: `1px solid ${t.border}`,
                          background: isCurrentlyPreviewed ? t.accent : t.cardBg,
                          color: isCurrentlyPreviewed ? "#ffffff" : t.textSecondary,
                          fontSize: "0.7rem",
                          cursor: "pointer",
                        }}
                        title="Посмотреть сертификат для этого слушателя"
                      >
                        👁️
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: High-Res Interactive Canvas Preview & Package Export Bar */}
          <div
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              overflowY: "auto",
              gap: 20,
            }}
          >
            {/* Top Toolbar above Certificate */}
            <div
              style={{
                width: "100%",
                maxWidth: 820,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.82rem", color: t.textSecondary, fontWeight: 600 }}>
                  Предпросмотр для:
                </span>
                <select
                  value={previewStudentId}
                  onChange={(e) => setPreviewStudentId(e.target.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textPrimary,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.accessCode})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleDownloadSingle}
                  style={{
                    padding: "7px 14px",
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
                  title="Скачать текущий сертификат в высоком разрешении (PNG)"
                >
                  <span>💾</span>
                  <span>Скачать этот сертификат (PNG)</span>
                </button>
              </div>
            </div>

            {/* Canvas Preview Box */}
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 820,
                borderRadius: 12,
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.15)",
                overflow: "hidden",
                border: `1px solid ${t.border}`,
                background: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  aspectRatio: "2000 / 1414",
                }}
              />
              {isRendering && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontWeight: 600,
                  }}
                >
                  Генерация бланка...
                </div>
              )}
            </div>

            {/* Bottom Package Actions Panel */}
            <div
              style={{
                width: "100%",
                maxWidth: 820,
                background: t.cardBg,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: isDark ? "none" : "0 4px 14px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: t.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🎓 Массовый выпуск и рассылка по выбранной категории</span>
                    <span
                      style={{
                        fontSize: "0.73rem",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          recipientCategory === "paid_only"
                            ? "rgba(16, 185, 129, 0.15)"
                            : recipientCategory === "free_only"
                            ? "rgba(2, 132, 199, 0.15)"
                            : t.accentBg,
                        color:
                          recipientCategory === "paid_only"
                            ? "#059669"
                            : recipientCategory === "free_only"
                            ? "#0284c7"
                            : t.accent,
                        fontWeight: 700,
                      }}
                    >
                      {recipientCategory === "paid_only"
                        ? `💳 Категория «Платники»: ${selectedStudentIds.length} чел.`
                        : recipientCategory === "free_only"
                        ? `🆓 Категория «Бесплатная регистрация»: ${selectedStudentIds.length} чел.`
                        : recipientCategory === "all_registered"
                        ? `👥 Обе категории вместе: ${selectedStudentIds.length} чел.`
                        : `Выбрано: ${selectedStudentIds.length} чел.`}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: t.textSecondary, marginTop: 2 }}>
                    Именные сертификаты и персональные письма формируются сразу на всю выбранную категорию (как на платников, так и на бесплатных слушателей)
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setShowEmailTemplateModal(true)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Посмотреть и скопировать готовый текст письма слушателю с ссылкой на запись"
                  >
                    <span>✉️ Шаблон письма</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportMailing}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Выгрузить Excel/CSV с персональными ссылками на видео и номерами сертификатов"
                  >
                    <span>📊 Ведомость (CSV)</span>
                  </button>

                  <button
                    type="button"
                    disabled={batchProgress !== null || selectedStudentIds.length === 0}
                    onClick={handleExportZip}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.accent}`,
                      background: t.accentBg,
                      color: t.accent,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: batchProgress ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: selectedStudentIds.length === 0 ? 0.6 : 1,
                    }}
                  >
                    <span>📦</span>
                    <span>
                      {batchProgress
                        ? `Генерация: ${batchProgress.done} / ${batchProgress.total}`
                        : `Скачать все сертификаты (ZIP)`}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={emailDispatchProgress !== null || selectedStudentIds.length === 0}
                  onClick={handleSendEmailsBatch}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #059669, #0d9488)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: emailDispatchProgress ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 12px rgba(5, 150, 105, 0.35)",
                    opacity: selectedStudentIds.length === 0 ? 0.6 : 1,
                  }}
                >
                  <span>📨</span>
                  <span>
                    {emailDispatchProgress
                      ? `Отправка писем: ${emailDispatchProgress.done} / ${emailDispatchProgress.total}...`
                      : `Разослать всем на почту (${selectedStudentIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Batch Email Delivery Report */}
        {emailDeliveryReport && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10001,
              background: "rgba(15, 23, 42, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 680,
                background: t.cardBg,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.5rem" }}>✅</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: t.textPrimary }}>
                      Сертификаты и ссылки на запись отправлены по почтам!
                    </h3>
                    <div style={{ fontSize: "0.78rem", color: t.textSecondary, marginTop: 2 }}>
                      Программа: <strong>{activeProgram.title}</strong> • Обработано:{" "}
                      <strong>{emailDeliveryReport.filter((r) => r.status === "sent").length}</strong> из{" "}
                      {emailDeliveryReport.length} получателей
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailDeliveryReport(null)}
                  style={{ background: "none", border: "none", fontSize: "1.2rem", color: t.textSecondary, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  marginBottom: 16,
                  background: isDark ? "#0f172a" : "#f8fafc",
                }}
              >
                {emailDeliveryReport.map((item) => {
                  const stObj = students.find((s) => s.id === item.studentId);
                  const mailtoHref = item.email
                    ? `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
                        `Ваш именной сертификат и запись: «${activeProgram.title}»`
                      )}&body=${encodeURIComponent(
                        stObj ? buildStudentEmailBody(stObj, item.certificateNumber) : sampleEmailBody
                      )}`
                    : "#";
                  return (
                    <div
                      key={item.studentId}
                      style={{
                        padding: "10px 14px",
                        borderBottom: `1px solid ${t.borderSubtle}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: t.textPrimary }}>
                          {item.fullName}{" "}
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: t.accent }}>
                            ({item.certificateNumber})
                          </span>
                        </div>
                        <div style={{ fontSize: "0.74rem", color: t.textSecondary }}>
                          📧 {item.email || "Email не указан"}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            background: item.status === "sent" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: item.status === "sent" ? "#059669" : "#d97706",
                          }}
                        >
                          {item.status === "sent" ? "✓ Отправлено на почту" : "⚠️ Нет email"}
                        </span>
                        {item.email && (
                          <a
                            href={mailtoHref}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${t.border}`,
                              background: t.cardBg,
                              color: t.textPrimary,
                              fontSize: "0.72rem",
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                            title="Открыть персональное письмо в почтовом клиенте"
                          >
                            ✉️ Письмо
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleExportZip}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${t.accent}`,
                    background: t.accentBg,
                    color: t.accent,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  📦 Скачать также архив всех сертификатов (ZIP)
                </button>
                <button
                  type="button"
                  onClick={() => setEmailDeliveryReport(null)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Ready Email Message Preview */}
        {showEmailTemplateModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 600,
                background: t.cardBg,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                padding: 20,
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: t.textPrimary }}>
                  ✉️ Готовый текст сообщения для слушателя
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailTemplateModal(false);
                    setCopiedEmail(false);
                  }}
                  style={{ background: "none", border: "none", fontSize: "1.1rem", color: t.textSecondary, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: "0.8rem", color: t.textSecondary, marginBottom: 12 }}>
                В текст автоматически подставлены имя слушателя (<strong>{previewStudent?.fullName}</strong>), ссылка на защищенную видеозапись и реквизиты сертификата:
              </div>

              <textarea
                readOnly
                rows={11}
                value={sampleEmailBody}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: isDark ? "#0f172a" : "#f8fafc",
                  color: t.textPrimary,
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  lineHeight: 1.5,
                  resize: "none",
                  outline: "none",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sampleEmailBody);
                    setCopiedEmail(true);
                    setTimeout(() => setCopiedEmail(false), 2500);
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: copiedEmail ? "#10b981" : t.accent,
                    color: "#ffffff",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {copiedEmail ? "✓ Текст скопирован в буфер!" : "📋 Скопировать текст"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
