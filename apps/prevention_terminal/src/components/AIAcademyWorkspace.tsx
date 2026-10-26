import React, { useState, useMemo } from "react";
import { t } from "../lib/i18n.ts";
import { getCustomAcademyLessons, deleteCustomAcademyLesson, type AcademyCustomLesson } from "../lib/academy_store.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { loadWebinars, type WebinarItem, type CloudRecording, type AttachedMaterial } from "../lib/webinars_store.ts";
import LayeredFormulationSimulator from "./academy/LayeredFormulationSimulator.tsx";

interface AIAcademyWorkspaceProps {
  aiSubscriptionActive?: boolean;
  initialQuery?: string;
  cfg?: TerminalConfig;
  specialistName?: string;
  onLaunchStudio?: (roomName: string) => void;
  onNavigateToSpecialist?: (view: string) => void;
  defaultSubTab?: "courses" | "webinars" | "formulation";
}

export default function AIAcademyWorkspace({
  cfg,
  onNavigateToSpecialist,
  defaultSubTab,
}: AIAcademyWorkspaceProps): React.ReactElement {
  const isAuthorRole =
    cfg?.role === "manager" ||
    cfg?.role === "author" ||
    cfg?.role === "host" ||
    cfg?.role === "speaker" ||
    (typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("role") === "author" ||
        new URLSearchParams(window.location.search).get("mode") === "author"));

  const [workspaceMode, setWorkspaceMode] = useState<"courses" | "webinars" | "formulation">(() => {
    if (defaultSubTab) return defaultSubTab;
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const tab = sp.get("academy_tab") || sp.get("tab");
      if (tab === "webinars" || tab === "events") return "webinars";
      if (tab === "courses") return "courses";
      if (tab === "formulation") return "formulation";
    }
    return "courses";
  });

  const [isExplainerOpen, setIsExplainerOpen] = useState(false);

  const [customLessons, setCustomLessons] = useState<AcademyCustomLesson[]>(() => getCustomAcademyLessons());
  const [selectedCustomLesson, setSelectedCustomLesson] = useState<AcademyCustomLesson | null>(null);
  const [selectedWebinarRecording, setSelectedWebinarRecording] = useState<CloudRecording | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

  const refreshCustomLessons = () => {
    setCustomLessons(getCustomAcademyLessons());
  };

  const webinarsList: WebinarItem[] = loadWebinars();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "var(--bg-main, #f8fafc)", overflow: "hidden" }}>
      {/* ─── Top Header & Navigation Bar ──────────────────────── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 28px",
          background: "var(--bg-card, #ffffff)",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          flexShrink: 0,
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.3rem" }}>🎓</span>
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground, #0f172a)" }}>
                {t("Академия и обучение", "Academy & Learning")}
              </h1>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--muted-foreground, #64748b)" }}>
              {t(
                "Доступные обучающие курсы, видеозаписи и методические материалы",
                "Available courses, video recordings, and learning materials"
              )}
            </p>
          </div>

          {/* Mode Switcher */}
          <div
            style={{
              display: "flex",
              background: "var(--bg-card-alt, #f1f5f9)",
              padding: "3px",
              borderRadius: "10px",
              gap: "2px",
              marginLeft: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setWorkspaceMode("courses")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                fontWeight: workspaceMode === "courses" ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                background: workspaceMode === "courses" ? "var(--bg-card, #ffffff)" : "transparent",
                color: workspaceMode === "courses" ? "#4f46e5" : "var(--muted-foreground, #64748b)",
                boxShadow: workspaceMode === "courses" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span>📚</span>
              <span>{t("Учебные курсы", "Courses")}</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceMode("webinars")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                fontWeight: workspaceMode === "webinars" ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                background: workspaceMode === "webinars" ? "var(--bg-card, #ffffff)" : "transparent",
                color: workspaceMode === "webinars" ? "#4f46e5" : "var(--muted-foreground, #64748b)",
                boxShadow: workspaceMode === "webinars" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span>🎥</span>
              <span>{t("Вебинары и материалы", "Webinars & Materials")}</span>
              {webinarsList.length > 0 && (
                <span
                  style={{
                    background: workspaceMode === "webinars" ? "#e0e7ff" : "#e2e8f0",
                    color: workspaceMode === "webinars" ? "#4338ca" : "#64748b",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "10px",
                  }}
                >
                  {webinarsList.length}
                </span>
              )}
            </button>

            

            <button
              type="button"
              onClick={() => setWorkspaceMode("formulation")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                fontWeight: workspaceMode === "formulation" ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                background: workspaceMode === "formulation" ? "var(--bg-card, #ffffff)" : "transparent",
                color: workspaceMode === "formulation" ? "#4f46e5" : "var(--muted-foreground, #64748b)",
                boxShadow: workspaceMode === "formulation" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span>🕵️‍♂️</span>
              <span>{t("Детектив формулировки", "Formulation Detective")}</span>
            </button>
          </div>
        </div>

        {/* Right Action buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <a
            href="https://prevention-ai.ru/academy/public/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#eef2ff",
              color: "#4338ca",
              textDecoration: "none",
              border: "1px solid #c7d2fe",
              padding: "8px 13px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.82rem",
              transition: "all 0.15s ease",
            }}
            title={t("Открыть публичную витрину и афишу курсов", "Open public courses showcase")}
          >
            <span>🌐</span>
            <span>{t("Публичная афиша ↗", "Public Showcase ↗")}</span>
          </a>
          <button
            type="button"
            onClick={() => setIsExplainerOpen(!isExplainerOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: isExplainerOpen ? "#e0e7ff" : "var(--bg-card-alt, #f1f5f9)",
              color: isExplainerOpen ? "#4338ca" : "var(--foreground, #334155)",
              border: "1px solid var(--border-color, #cbd5e1)",
              padding: "8px 12px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
            title={t("Пояснение: откуда берутся курсы и как выложить свои", "How courses get here and how to publish your own")}
          >
            <span>ℹ️</span>
            <span>{t("Откуда берутся курсы?", "About Catalog & Sources")}</span>
            <span style={{ fontSize: "0.7rem" }}>{isExplainerOpen ? "▲" : "▼"}</span>
          </button>

          {isAuthorRole && (
            <a
              href="https://academy.ida-psy.ru/?mode=webinar"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#7c3aed",
                color: "#ffffff",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.82rem",
                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.2)",
              }}
              title={t("Отдельный кабинет для создания курсов и вебинаров", "Separate studio for creating courses and webinars")}
            >
              <span>🎙️</span>
              <span>{t("Студия автора LMS ↗", "Author Studio LMS ↗")}</span>
            </a>
          )}

          {onNavigateToSpecialist && (
            <button
              type="button"
              onClick={() => onNavigateToSpecialist("dashboard")}
              style={{
                background: "transparent",
                color: "var(--muted-foreground, #64748b)",
                border: "1px solid var(--border-color, #cbd5e1)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              ← {t("К работе", "Back to Work")}
            </button>
          )}
        </div>
      </header>

      {/* ─── EXPLAINER BLOCK (ПОД КАТОМ) ───────────────────────── */}
      {isExplainerOpen && (
        <div
          style={{
            background: "linear-gradient(180deg, #f8faff 0%, #ffffff 100%)",
            borderBottom: "2px solid #e0e7ff",
            padding: "20px 28px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>💡</span>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#1e1b4b" }}>
                  {t("Как устроена Академия: источники материалов и публикация", "How the Academy Works: Sources & Publishing")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExplainerOpen(false)}
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", fontSize: "0.88rem", color: "#334155", lineHeight: 1.55 }}>
              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ fontWeight: 800, color: "#4338ca", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🌐</span>
                  <span>1. Общая витрина платформы</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#475569" }}>
                  Единый каталог сертифицированных открытых курсов и профессиональных вебинаров. Здесь размещен флагманский курс Романа Дубровского («Психология здоровья и разработка профилактических программ»), а также материалы авторов, открытые для всей платформы.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ fontWeight: 800, color: "#059669", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🏢</span>
                  <span>2. Внутренние курсы организации</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#475569" }}>
                  Программы, уроки и записи вебинаров, созданные преподавателями вашего центра. Если курс предназначен только для внутренних сотрудников вашей школы, он доступен только вам.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ fontWeight: 800, color: "#7c3aed", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🎙️</span>
                  <span>3. Как автору выложить материал в витрину?</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#475569" }}>
                  Откройте <strong>«Студию автора LMS»</strong> и в настройках курса или вебинара включите галочку <strong>«🌐 Опубликовать в общую витрину платформы»</strong>. Материал мгновенно появится в общем открытом доступе для всех специалистов.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT CONTAINER ───────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* ======================================================== */}
        {/* 1. COURSES TAB                                           */}
        {/* ======================================================== */}
        {workspaceMode === "courses" && (
          <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
            {/* Banner linking to Showcase */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(79, 70, 229, 0.06)",
                border: "1px solid rgba(79, 70, 229, 0.2)",
                borderRadius: "14px",
                padding: "12px 20px",
                marginBottom: "24px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.2rem" }}>🌐</span>
                <span style={{ fontSize: "0.88rem", color: "#312e81", fontWeight: 600 }}>
                  {t(
                    "Ищете больше открытых программ и вебинаров? В общей витрине платформы собраны все доступные материалы.",
                    "Looking for more programs? Explore the platform showcase."
                  )}
                </span>
              </div>
              <a
                href="https://prevention-ai.ru/academy/public/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  textDecoration: "none",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {t("Открыть публичную афишу ↗", "Open Public Showcase ↗")}
              </a>
            </div>

            {/* Featured Course Card */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e293b 100%)",
                borderRadius: "20px",
                padding: "36px 40px",
                color: "#ffffff",
                boxShadow: "0 12px 36px rgba(30, 27, 75, 0.25)",
                display: "grid",
                gridTemplateColumns: "1fr 340px",
                gap: "36px",
                alignItems: "center",
                marginBottom: "40px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.2)",
                      backdropFilter: "blur(8px)",
                      color: "#ffffff",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      padding: "4px 12px",
                      borderRadius: "999px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    ✨ {t("Основной курс в записи", "Featured Video Course")}
                  </span>
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.25)",
                      color: "#6ee7b7",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    ✓ {t("Свободный доступ", "Open Access")}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                    21 {t("видеолекция", "video lectures")} • 160 ч.
                  </span>
                </div>

                <h2 style={{ fontSize: "1.9rem", fontWeight: 900, lineHeight: 1.25, margin: "0 0 12px 0", letterSpacing: "-0.01em" }}>
                  {t(
                    "Психология здоровья и разработка профилактических программ",
                    "Health Psychology and Prevention Program Design"
                  )}
                </h2>

                <p style={{ fontSize: "0.98rem", color: "#e2e8f0", lineHeight: 1.6, margin: "0 0 24px 0", maxWidth: "680px" }}>
                  {t(
                    "Фундаментальный авторский видеокурс Романа Дубровского. От биомедицинской и холистической моделей здоровья до методологии проектирования доказательных профилактических программ для подростков и молодежи.",
                    "Fundamental video course by Roman Dubrovsky. From biomedical and holistic models of health to designing evidence-based prevention programs for youth."
                  )}
                </p>

                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                  <a
                    href="https://prevention-ai.ru/academy/course/player.html#00"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "#ffffff",
                      color: "#1e1b4b",
                      padding: "12px 24px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      textDecoration: "none",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                    }}
                  >
                    <span>▶️</span>
                    <span>{t("Смотреть курс (21 занятие)", "Watch Course (21 Lessons)")}</span>
                  </a>
                </div>
              </div>

              {/* Course Features Box */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "16px",
                  padding: "24px",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: "14px", color: "#f8fafc" }}>
                  {t("В программе курса:", "In this course:")}
                </div>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.86rem", color: "#cbd5e1", lineHeight: 1.8 }}>
                  <li>{t("21 полная видеолекция в HD (VK Видео)", "21 full video lectures in HD")}</li>
                  <li>{t("Подробные авторские конспекты к урокам", "Detailed lecture summaries")}</li>
                  <li>{t("Точные стенограммы и презентации", "Transcripts and presentations")}</li>
                  <li>{t("Методология доказательной профилактики", "Evidence-based methodology")}</li>
                  <li>{t("Алгоритм проектирования программ", "Program design algorithms")}</li>
                </ul>
              </div>
            </div>

            {/* Custom Lessons Section (if any created) */}
            {customLessons.length > 0 && (
              <div style={{ marginTop: "32px" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 16px 0", color: "var(--foreground, #0f172a)" }}>
                  {t("Авторские уроки и мастер-классы", "Custom Lessons & Masterclasses")} ({customLessons.length})
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                  {customLessons.map((cl) => (
                    <div
                      key={cl.id}
                      style={{
                        background: "var(--bg-card, #ffffff)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                        borderRadius: "14px",
                        padding: "20px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "#6d28d9",
                              background: "#f5f3ff",
                              padding: "3px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            🎬 {cl.tag || t("Урок", "Lesson")}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            {new Date(cl.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                        </div>

                        <h4 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground, #0f172a)" }}>
                          {cl.title}
                        </h4>

                        <div style={{ fontSize: "0.82rem", color: "var(--muted-foreground, #64748b)", marginBottom: "14px" }}>
                          {cl.moduleTitle}
                        </div>

                        {cl.summaryText && (
                          <p
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--muted-foreground, #475569)",
                              lineHeight: 1.5,
                              margin: "0 0 16px 0",
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {cl.summaryText}
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--border-color, #f1f5f9)" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomLesson(cl)}
                          style={{
                            flex: 1,
                            background: "#4f46e5",
                            color: "#ffffff",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                          }}
                        >
                          ▶ {t("Открыть урок", "Open Lesson")}
                        </button>

                        {isAuthorRole && (
                          <button
                            type="button"
                            onClick={() => {
                              deleteCustomAcademyLesson(cl.id);
                              refreshCustomLessons();
                            }}
                            title={t("Удалить урок", "Delete")}
                            style={{
                              background: "transparent",
                              color: "#ef4444",
                              border: "1px solid #fee2e2",
                              padding: "8px 10px",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
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
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. WEBINARS & MATERIALS TAB                               */}
        {/* ======================================================== */}
        {workspaceMode === "webinars" && (
          <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
            {/* Banner linking to Showcase */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(79, 70, 229, 0.06)",
                border: "1px solid rgba(79, 70, 229, 0.2)",
                borderRadius: "14px",
                padding: "12px 20px",
                marginBottom: "24px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.2rem" }}>🌐</span>
                <span style={{ fontSize: "0.88rem", color: "#312e81", fontWeight: 600 }}>
                  {t(
                    "Смотрите также вебинары и авторские курсы в общей открытой витрине платформы.",
                    "Explore all public webinars and courses in the platform showcase."
                  )}
                </span>
              </div>
              <a
                href="https://prevention-ai.ru/academy/public/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  textDecoration: "none",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {t("Открыть публичную афишу ↗", "Open Public Showcase ↗")}
              </a>
            </div>

            {/* Header of webinars section */}
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--foreground, #0f172a)" }}>
                {t("Вебинары, разборы и методические материалы", "Webinars, Case Reviews & Materials")}
              </h2>
              <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--muted-foreground, #64748b)" }}>
                {t(
                  "Расписание профессиональных онлайн-эфиров, видеозаписи прошедших встреч и методические материалы для работы.",
                  "Schedule of live sessions, video recordings of past reviews, and practical materials."
                )}
              </p>
            </div>

            {/* Webinars list */}
            {webinarsList.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  background: "var(--bg-card, #ffffff)",
                  borderRadius: "16px",
                  border: "1px dashed var(--border-color, #cbd5e1)",
                  color: "var(--muted-foreground, #64748b)",
                }}
              >
                <div style={{ fontSize: "2.2rem", marginBottom: "8px" }}>🎥</div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  {t("Нет доступных вебинаров", "No webinars available")}
                </div>
                <p style={{ fontSize: "0.85rem", margin: "6px 0 0 0" }}>
                  {t("Новые эфиры и материалы появятся здесь согласно расписанию.", "New broadcasts and materials will appear here.")}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {webinarsList.map((webinar) => {
                  const isLive = webinar.status === "live";
                  const isFinished = webinar.status === "finished";
                  const hasRecording = Boolean(webinar.recording);
                  const isExpandedSummary = expandedSummaryId === webinar.id;

                  return (
                    <div
                      key={webinar.id}
                      style={{
                        background: "var(--bg-card, #ffffff)",
                        border: isLive ? "2px solid #ef4444" : "1px solid var(--border-color, #e2e8f0)",
                        borderRadius: "16px",
                        padding: "24px 28px",
                        boxShadow: isLive ? "0 4px 20px rgba(239, 68, 68, 0.15)" : "0 2px 8px rgba(0,0,0,0.03)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Top status bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          {isLive ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                fontWeight: 800,
                              }}
                            >
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#dc2626" }} />
                              {t("Прямой эфир", "Live Now")}
                            </span>
                          ) : isFinished ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: hasRecording ? "#ecfdf5" : "#f1f5f9",
                                color: hasRecording ? "#059669" : "#64748b",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              ✓ {hasRecording ? t("Завершен • Запись доступна", "Finished • Recording Available") : t("Завершен", "Finished")}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "#eff6ff",
                                color: "#2563eb",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              📅 {t("Запланирован", "Scheduled")}
                            </span>
                          )}

                          <span style={{ fontSize: "0.82rem", color: "var(--muted-foreground, #64748b)" }}>
                            {webinar.scheduledDate} • {webinar.scheduledTime} ({webinar.durationMinutes} мин.)
                          </span>
                        </div>

                        {webinar.priceRub && webinar.priceRub > 0 ? (
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "3px 8px", borderRadius: "6px" }}>
                            💳 {webinar.priceRub} ₽
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "3px 8px", borderRadius: "6px" }}>
                            ✓ {t("Бесплатно", "Free")}
                          </span>
                        )}
                      </div>

                      {/* Title & speaker */}
                      <h3 style={{ margin: "0 0 8px 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground, #0f172a)" }}>
                        {webinar.title}
                      </h3>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#4f46e5" }}>
                          👤 {webinar.speakerName}
                        </span>
                        {webinar.topicTag && (
                          <span style={{ fontSize: "0.78rem", background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: "6px" }}>
                            🏷️ {webinar.topicTag}
                          </span>
                        )}
                      </div>

                      <p style={{ margin: "0 0 18px 0", fontSize: "0.92rem", color: "var(--muted-foreground, #475569)", lineHeight: 1.55 }}>
                        {webinar.description}
                      </p>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", paddingTop: "14px", borderTop: "1px solid var(--border-color, #f1f5f9)" }}>
                        {hasRecording && webinar.recording && (
                          <button
                            type="button"
                            onClick={() => setSelectedWebinarRecording(webinar.recording!)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              background: "#059669",
                              color: "#ffffff",
                              border: "none",
                              padding: "10px 18px",
                              borderRadius: "8px",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.2)",
                            }}
                          >
                            <span>▶</span>
                            <span>{t("Смотреть видеозапись", "Watch Recording")}</span>
                          </button>
                        )}

                        {hasRecording && webinar.recording?.aiSummary && (
                          <button
                            type="button"
                            onClick={() => setExpandedSummaryId(isExpandedSummary ? null : webinar.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              background: isExpandedSummary ? "#e0e7ff" : "var(--bg-card-alt, #f1f5f9)",
                              color: isExpandedSummary ? "#4338ca" : "var(--foreground, #334155)",
                              border: "1px solid var(--border-color, #cbd5e1)",
                              padding: "10px 16px",
                              borderRadius: "8px",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                            }}
                          >
                            <span>💡</span>
                            <span>{isExpandedSummary ? t("Скрыть ИИ-Конспект", "Hide Summary") : t("ИИ-Конспект встречи", "AI Summary")}</span>
                          </button>
                        )}
                      </div>

                      {/* AI Summary expanded */}
                      {isExpandedSummary && webinar.recording?.aiSummary && (
                        <div style={{ marginTop: "16px", padding: "16px 20px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.9rem", lineHeight: 1.6 }}>
                          <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#1e293b", marginBottom: "6px" }}>
                            💡 {t("Ключевые выводы и конспект встречи:", "Key Highlights & Summary:")}
                          </div>
                          <p style={{ margin: "0 0 10px 0", color: "#475569" }}>
                            {webinar.recording.aiSummary.overview}
                          </p>
                          {webinar.recording.aiSummary.keyPoints && (
                            <ul style={{ margin: 0, paddingLeft: "18px", color: "#334155" }}>
                              {webinar.recording.aiSummary.keyPoints.map((kp, idx) => (
                                <li key={idx} style={{ marginBottom: "4px" }}>{kp}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. SHOWCASE / PLATFORM MARKETPLACE TAB                    */}
                {/* ======================================================== */}
        {/* 3. LAYERED FORMULATION SIMULATOR                          */}
        {/* ======================================================== */}
        {workspaceMode === "formulation" && (
          <LayeredFormulationSimulator />
        )}
      </div>

      {/* ─── MODAL: CUSTOM LESSON DETAIL ───────────────────────── */}
      {selectedCustomLesson && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setSelectedCustomLesson(null)}
        >
          <div
            style={{
              background: "var(--bg-card, #ffffff)",
              borderRadius: "16px",
              maxWidth: "720px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", background: "#f5f3ff", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                  🎬 {selectedCustomLesson.tag || "Урок"}
                </span>
                <h3 style={{ margin: "8px 0 2px 0", fontSize: "1.3rem", fontWeight: 800 }}>
                  {selectedCustomLesson.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomLesson(null)}
                style={{ background: "transparent", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            {selectedCustomLesson.summaryText && (
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {selectedCustomLesson.summaryText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: WEBINAR RECORDING PLAYER & SUMMARY ─────────── */}
      {selectedWebinarRecording && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setSelectedWebinarRecording(null)}
        >
          <div
            style={{
              background: "var(--bg-card, #ffffff)",
              borderRadius: "16px",
              maxWidth: "860px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "28px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", background: "#ecfdf5", color: "#059669", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                  🎥 {t("Видеозапись встречи", "Video Recording")}
                </span>
                <h3 style={{ margin: "8px 0 2px 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground, #0f172a)" }}>
                  {selectedWebinarRecording.webinarTitle}
                </h3>
                <div style={{ fontSize: "0.82rem", color: "var(--muted-foreground, #64748b)" }}>
                  {selectedWebinarRecording.durationMinutes ? `${selectedWebinarRecording.durationMinutes} мин • ` : ""}
                  {new Date(selectedWebinarRecording.recordedAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWebinarRecording(null)}
                style={{ background: "transparent", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#94a3b8", padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            {selectedWebinarRecording.videoUrl && (
              <div style={{ marginBottom: "20px", borderRadius: "12px", overflow: "hidden", background: "#000" }}>
                <video
                  controls
                  playsInline
                  src={selectedWebinarRecording.videoUrl}
                  style={{ width: "100%", maxHeight: "480px", display: "block" }}
                >
                  <p>{t("Ваш браузер не поддерживает встроенное видео.", "Your browser does not support HTML5 video.")}</p>
                </video>
              </div>
            )}

            {selectedWebinarRecording.aiSummary && (
              <div style={{ background: "#f8fafc", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.9rem", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#1e293b", marginBottom: "8px" }}>
                  💡 {t("ИИ-Конспект и ключевые мысли встречи", "AI Summary & Highlights")}
                </div>
                <p style={{ margin: "0 0 12px 0", color: "#475569" }}>
                  {selectedWebinarRecording.aiSummary.overview}
                </p>
                {selectedWebinarRecording.aiSummary.keyPoints && selectedWebinarRecording.aiSummary.keyPoints.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                      {t("Ключевые тезисы:", "Key Points:")}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", color: "#334155" }}>
                      {selectedWebinarRecording.aiSummary.keyPoints.map((kp, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
