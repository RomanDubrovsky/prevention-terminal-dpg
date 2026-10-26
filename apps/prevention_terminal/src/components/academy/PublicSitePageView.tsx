import React, { useState, useEffect, useMemo } from "react";
import {
  type SitePage,
  type SiteBlock,
  type SchoolSiteSettings,
  loadSitePages,
  loadSchoolSettings,
  getPageBySlug,
  interpolateLegalVariables,
} from "../../lib/site_pages_store.ts";
import { loadCreatorCourses, type CreatorCourse } from "../../lib/course_students_store.ts";
import { loadWebinars, type WebinarItem } from "../../lib/webinars_store.ts";

interface PublicSitePageViewProps {
  slug?: string;
  page?: SitePage;
  previewMode?: boolean;
  onOpenStudentLogin?: () => void;
  onOpenCreatorStudio?: () => void;
  onNavigateToPage?: (slug: string) => void;
}

export default function PublicSitePageView({
  slug = "main",
  page: directPage,
  previewMode = false,
  onOpenStudentLogin,
  onOpenCreatorStudio,
  onNavigateToPage,
}: PublicSitePageViewProps) {
  const [allPages, setAllPages] = useState<SitePage[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSiteSettings>(loadSchoolSettings());
  const [courses, setCourses] = useState<CreatorCourse[]>([]);
  const [webinars, setWebinars] = useState<WebinarItem[]>([]);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [showStudentCodeModal, setShowStudentCodeModal] = useState(false);
  const [studentInputCode, setStudentInputCode] = useState("");

  useEffect(() => {
    setAllPages(loadSitePages());
    setSchoolSettings(loadSchoolSettings());
    setCourses(loadCreatorCourses());
    setWebinars(loadWebinars());
  }, []);

  const currentPage: SitePage | undefined = useMemo(() => {
    if (directPage) return directPage;
    return getPageBySlug(slug) || allPages.find((p) => p.slug === "main") || allPages[0];
  }, [directPage, slug, allPages]);

  const navPages = useMemo(() => {
    return allPages.filter((p) => p.isPublished && p.slug !== "main" && p.folder !== "legal").slice(0, 5);
  }, [allPages]);

  const isDark = schoolSettings.theme === "dark";
  const primaryAccent = schoolSettings.primaryAccentColor || "#0f766e";

  const t = useMemo(() => {
    return isDark
      ? {
          bg: "#090d16",
          cardBg: "#0f172a",
          cardBorder: "rgba(255, 255, 255, 0.08)",
          cardHoverBg: "#1e293b",
          headerBg: "rgba(15, 23, 42, 0.95)",
          textPrimary: "#f8fafc",
          textSecondary: "#94a3b8",
          textMuted: "#64748b",
          accent: "#14b8a6",
          accentBg: "rgba(20, 184, 166, 0.12)",
          accentBorder: "rgba(20, 184, 166, 0.3)",
          badgeBg: "#1e293b",
          footerBg: "#020617",
          border: "rgba(255, 255, 255, 0.08)",
        }
      : {
          bg: "#f8fafc",
          cardBg: "#ffffff",
          cardBorder: "#e2e8f0",
          cardHoverBg: "#f1f5f9",
          headerBg: "rgba(255, 255, 255, 0.95)",
          textPrimary: "#0f172a",
          textSecondary: "#475569",
          textMuted: "#94a3b8",
          accent: primaryAccent,
          accentBg: "#f0fdfa",
          accentBorder: "#99f6e4",
          badgeBg: "#f1f5f9",
          footerBg: "#0f172a",
          border: "#e2e8f0",
        };
  }, [isDark, primaryAccent]);

  const handleNavigate = (targetSlug: string) => {
    if (onNavigateToPage) {
      onNavigateToPage(targetSlug);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("page", targetSlug);
      window.location.href = url.toString();
    }
  };

  const handleStudentLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInputCode.trim()) return;
    const cleanCode = studentInputCode.trim().toUpperCase();
    const url = new URL(window.location.href);
    url.searchParams.set("role", "student");
    url.searchParams.set("student", cleanCode);
    if (courses.length > 0) {
      url.searchParams.set("course", courses[0].id);
    }
    window.location.href = url.toString();
  };

  if (!currentPage) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: t.textSecondary, fontFamily: "sans-serif" }}>
        <h2>Страница не найдена</h2>
        <button
          type="button"
          onClick={() => handleNavigate("main")}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            borderRadius: 8,
            background: t.accent,
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Вернуться на главную
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* PREVIEW BANNER IF IN PREVIEW MODE */}
      {previewMode && (
        <div
          style={{
            background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
            color: "#ffffff",
            padding: "8px 16px",
            textAlign: "center",
            fontSize: "0.82rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <span>👁️ Режим предпросмотра: «{currentPage.title}» (/page={currentPage.slug})</span>
          <button
            type="button"
            onClick={() => window.open(`/?page=${currentPage.slug}`, "_blank")}
            style={{
              padding: "3px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.2)",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Открыть в новом окне ↗
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <header
        style={{
          height: 68,
          background: t.headerBg,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${t.border}`,
          position: "sticky",
          top: previewMode ? 36 : 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Brand */}
        <div
          onClick={() => handleNavigate("main")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: "1.6rem" }}>{schoolSettings.schoolLogoEmoji || "🏛️"}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.02rem", color: t.textPrimary, letterSpacing: "-0.01em" }}>
              {schoolSettings.schoolName}
            </div>
            <div style={{ fontSize: "0.72rem", color: t.textMuted, maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {schoolSettings.schoolTagline}
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {navPages.map((np) => (
            <button
              key={np.id}
              type="button"
              onClick={() => handleNavigate(np.slug)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: currentPage.slug === np.slug ? t.accentBg : "transparent",
                color: currentPage.slug === np.slug ? t.accent : t.textSecondary,
                fontSize: "0.85rem",
                fontWeight: currentPage.slug === np.slug ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {np.title.replace(/Кафедра |Направление /gi, "")}
            </button>
          ))}

          {/* Student Cabinet Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenStudentLogin) {
                onOpenStudentLogin();
              } else {
                setShowStudentCodeModal(true);
              }
            }}
            style={{
              marginLeft: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: `1.5px solid ${t.accent}`,
              background: t.accentBg,
              color: t.accent,
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>🔑 Вход для студентов</span>
          </button>
        </nav>
      </header>

      {/* MAIN CONTENT: BLOCKS LIST */}
      <main style={{ flex: 1, width: "100%", maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px 24px", boxSizing: "border-box" }}>
        {currentPage.blocks.filter((b) => !b.isHidden).map((block) => {
          return (
            <section key={block.id} style={{ marginBottom: 48, animation: "fadeIn 0.2s ease-out" }}>
              {/* BLOCK 1: HERO */}
              {block.type === "hero" && (
                <div
                  style={{
                    padding: "48px 36px",
                    borderRadius: 20,
                    background: isDark
                      ? "linear-gradient(135deg, rgba(15, 118, 110, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)"
                      : "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
                    border: `1.5px solid ${t.accentBorder}`,
                    boxShadow: isDark ? "none" : "0 8px 30px rgba(15, 118, 110, 0.08)",
                    textAlign: "center",
                  }}
                >
                  {block.config?.badgeText && (
                    <div style={{ display: "inline-block", marginBottom: 16 }}>
                      <span
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          background: t.accentBg,
                          color: t.accent,
                          fontSize: "0.82rem",
                          fontWeight: 800,
                          border: `1px solid ${t.accentBorder}`,
                        }}
                      >
                        {block.config.badgeText}
                      </span>
                    </div>
                  )}

                  <h1
                    style={{
                      fontSize: "2.2rem",
                      fontWeight: 900,
                      color: t.textPrimary,
                      margin: "0 0 16px 0",
                      lineHeight: 1.2,
                      letterSpacing: "-0.02em",
                      maxWidth: 860,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    {block.title}
                  </h1>

                  {block.subtitle && (
                    <p
                      style={{
                        fontSize: "1.1rem",
                        color: t.textSecondary,
                        lineHeight: 1.55,
                        maxWidth: 760,
                        margin: "0 auto 28px auto",
                      }}
                    >
                      {block.subtitle}
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {block.config?.buttonText && (
                      <a
                        href={block.config.buttonUrl || "#courses"}
                        style={{
                          padding: "14px 28px",
                          borderRadius: 10,
                          background: `linear-gradient(135deg, ${t.accent} 0%, #14b8a6 100%)`,
                          color: "#ffffff",
                          fontSize: "1.02rem",
                          fontWeight: 800,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)",
                        }}
                      >
                        {block.config.buttonText}
                      </a>
                    )}
                    {block.config?.secondaryButtonText && (
                      <a
                        href={block.config.secondaryButtonUrl || "#webinars"}
                        style={{
                          padding: "14px 24px",
                          borderRadius: 10,
                          background: t.cardBg,
                          color: t.textPrimary,
                          border: `1.5px solid ${t.border}`,
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {block.config.secondaryButtonText}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* BLOCK 2: DIRECTION INFO */}
              {block.type === "direction_info" && (
                <div>
                  <div style={{ textAlign: "center", marginBottom: 28 }}>
                    {block.config?.highlightBadge && (
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 12,
                          background: t.accentBg,
                          color: t.accent,
                          fontSize: "0.78rem",
                          fontWeight: 800,
                          marginBottom: 8,
                          display: "inline-block",
                        }}
                      >
                        {block.config.highlightBadge}
                      </span>
                    )}
                    <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0" }}>
                      {block.title}
                    </h2>
                    {block.subtitle && (
                      <p style={{ fontSize: "0.98rem", color: t.textSecondary, margin: 0, maxWidth: 680, marginLeft: "auto", marginRight: "auto" }}>
                        {block.subtitle}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                    {(block.config?.bullets || []).map((bullet) => (
                      <div
                        key={bullet.id}
                        style={{
                          padding: "20px 22px",
                          borderRadius: 14,
                          background: t.cardBg,
                          border: `1px solid ${t.cardBorder}`,
                          boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.03)",
                        }}
                      >
                        <div style={{ fontSize: "1.8rem", marginBottom: 12 }}>{bullet.icon || "💡"}</div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: t.textPrimary, margin: "0 0 8px 0" }}>
                          {bullet.title}
                        </h3>
                        <p style={{ fontSize: "0.88rem", color: t.textSecondary, lineHeight: 1.45, margin: 0 }}>
                          {bullet.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BLOCK 3: COURSES GRID */}
              {block.type === "courses_grid" && (
                <div id="courses">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 6px 0" }}>
                        {block.title || "Учебные курсы и программы"}
                      </h2>
                      {block.subtitle && (
                        <p style={{ fontSize: "0.95rem", color: t.textSecondary, margin: 0 }}>
                          {block.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {courses.length === 0 ? (
                    <div style={{ padding: 32, borderRadius: 14, background: t.cardBg, border: `1px solid ${t.cardBorder}`, textAlign: "center", color: t.textMuted }}>
                      📚 В каталоге пока нет опубликованных курсов. Создайте свой первый курс в Студии ведущего.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                      {courses
                        .filter((c) => {
                          if (!block.config?.topicFilter || block.config.topicFilter === "all") return true;
                          return c.topicTag?.toLowerCase() === block.config.topicFilter.toLowerCase();
                        })
                        .slice(0, block.config?.limitCount || 12)
                        .map((course) => (
                          <div
                            key={course.id}
                            style={{
                              padding: "22px 24px",
                              borderRadius: 16,
                              background: t.cardBg,
                              border: `1.5px solid ${t.cardBorder}`,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              boxShadow: isDark ? "none" : "0 4px 16px rgba(0,0,0,0.04)",
                              transition: "transform 0.15s ease",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <span style={{ padding: "3px 10px", borderRadius: 8, background: t.accentBg, color: t.accent, fontSize: "0.75rem", fontWeight: 700 }}>
                                  {course.topicTag || "Психология"}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: t.textMuted }}>
                                  {course.lessons.length} уроков
                                </span>
                              </div>

                              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0", lineHeight: 1.3 }}>
                                {course.title}
                              </h3>

                              <p style={{ fontSize: "0.85rem", color: t.textSecondary, lineHeight: 1.45, margin: "0 0 16px 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {course.description}
                              </p>
                            </div>

                            <div style={{ paddingTop: 16, borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: "0.72rem", color: t.textMuted }}>Стоимость:</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: t.accent }}>
                                  {course.priceRub ? `${course.priceRub.toLocaleString("ru-RU")} ₽` : "Бесплатно"}
                                </div>
                              </div>

                              <a
                                href={course.paymentUrl || `/?course=${course.id}&role=student`}
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: 8,
                                  background: t.accent,
                                  color: "#ffffff",
                                  fontSize: "0.85rem",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                {course.paymentUrl ? "Записаться →" : "Подробнее →"}
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* BLOCK 4: WEBINARS GRID */}
              {block.type === "webinars_grid" && (
                <div id="webinars">
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 6px 0" }}>
                      {block.title || "Живые вебинары и мастер-классы"}
                    </h2>
                    {block.subtitle && (
                      <p style={{ fontSize: "0.95rem", color: t.textSecondary, margin: 0 }}>
                        {block.subtitle}
                      </p>
                    )}
                  </div>

                  {webinars.length === 0 ? (
                    <div style={{ padding: 32, borderRadius: 14, background: t.cardBg, border: `1px solid ${t.cardBorder}`, textAlign: "center", color: t.textMuted }}>
                      🎙️ На ближайшие даты вебинары не запланированы.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
                      {webinars.slice(0, block.config?.limitCount || 4).map((webinar) => (
                        <div
                          key={webinar.id}
                          style={{
                            padding: "20px 22px",
                            borderRadius: 14,
                            background: t.cardBg,
                            border: `1px solid ${t.cardBorder}`,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: t.accent }}>
                                📅 {webinar.scheduledDate} в {webinar.scheduledTime}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: t.textMuted }}>
                                ⏱️ {webinar.durationMinutes} мин
                              </span>
                            </div>

                            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0", lineHeight: 1.3 }}>
                              {webinar.title}
                            </h3>

                            <p style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.4, margin: "0 0 14px 0" }}>
                              {webinar.description}
                            </p>
                          </div>

                          <div style={{ paddingTop: 14, borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: t.textPrimary }}>
                              {webinar.priceRub ? `${webinar.priceRub} ₽` : "Вход свободный"}
                            </div>

                            <a
                              href={`/?room=${webinar.roomName}&role=listener&title=${encodeURIComponent(webinar.title)}`}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 8,
                                background: t.accentBg,
                                color: t.accent,
                                border: `1px solid ${t.accentBorder}`,
                                fontSize: "0.82rem",
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              Подключиться →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* BLOCK 5: SPEAKERS TEAM */}
              {block.type === "speakers_team" && (
                <div>
                  <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0" }}>
                      {block.title}
                    </h2>
                    {block.subtitle && (
                      <p style={{ fontSize: "0.95rem", color: t.textSecondary, margin: 0, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
                        {block.subtitle}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                    {(block.config?.speakers || []).map((sp) => (
                      <div
                        key={sp.id}
                        style={{
                          padding: "24px 22px",
                          borderRadius: 16,
                          background: t.cardBg,
                          border: `1px solid ${t.cardBorder}`,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #0f766e, #14b8a6)",
                            color: "#ffffff",
                            fontSize: "1.8rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 16px auto",
                            fontWeight: 800,
                          }}
                        >
                          {sp.photoUrl ? <img src={sp.photoUrl} alt={sp.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : sp.name.charAt(0)}
                        </div>

                        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 4px 0" }}>
                          {sp.name}
                        </h3>

                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: t.accent, marginBottom: 12 }}>
                          {sp.role}
                        </div>

                        {sp.bio && (
                          <p style={{ fontSize: "0.84rem", color: t.textSecondary, lineHeight: 1.45, margin: 0 }}>
                            {sp.bio}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BLOCK 6: REVIEWS */}
              {block.type === "reviews_quotes" && (
                <div>
                  <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0" }}>
                      {block.title}
                    </h2>
                    {block.subtitle && (
                      <p style={{ fontSize: "0.95rem", color: t.textSecondary, margin: 0 }}>
                        {block.subtitle}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
                    {(block.config?.reviews || []).map((rev) => (
                      <div
                        key={rev.id}
                        style={{
                          padding: "22px 24px",
                          borderRadius: 16,
                          background: t.cardBg,
                          border: `1px solid ${t.cardBorder}`,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", gap: 2, marginBottom: 12, color: "#f59e0b" }}>
                            {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                              <span key={i}>★</span>
                            ))}
                          </div>

                          <p style={{ fontSize: "0.88rem", color: t.textPrimary, lineHeight: 1.5, margin: "0 0 16px 0", fontStyle: "italic" }}>
                            «{rev.text}»
                          </p>
                        </div>

                        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: t.textPrimary }}>
                            {rev.authorName}
                          </div>
                          {rev.authorRole && (
                            <div style={{ fontSize: "0.75rem", color: t.textMuted }}>
                              {rev.authorRole}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BLOCK 7: FAQ ACCORDION */}
              {block.type === "faq_accordion" && (
                <div style={{ maxWidth: 840, margin: "0 auto" }}>
                  <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <h2 style={{ fontSize: "1.65rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0" }}>
                      {block.title}
                    </h2>
                    {block.subtitle && (
                      <p style={{ fontSize: "0.95rem", color: t.textSecondary, margin: 0 }}>
                        {block.subtitle}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(block.config?.faqItems || []).map((item) => {
                      const isOpen = expandedFaqId === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            borderRadius: 12,
                            background: t.cardBg,
                            border: `1px solid ${isOpen ? t.accent : t.cardBorder}`,
                            overflow: "hidden",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedFaqId(isOpen ? null : item.id)}
                            style={{
                              width: "100%",
                              padding: "16px 20px",
                              border: "none",
                              background: "transparent",
                              color: t.textPrimary,
                              fontSize: "0.95rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              textAlign: "left",
                            }}
                          >
                            <span>{item.question}</span>
                            <span style={{ fontSize: "1.2rem", color: t.accent, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.15s" }}>
                              +
                            </span>
                          </button>

                          {isOpen && (
                            <div
                              style={{
                                padding: "0 20px 18px 20px",
                                fontSize: "0.88rem",
                                color: t.textSecondary,
                                lineHeight: 1.5,
                                borderTop: `1px solid ${t.border}`,
                                paddingTop: 12,
                              }}
                            >
                              {item.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BLOCK 8: TEXT / LEGAL DOCUMENT */}
              {block.type === "text_legal" && (
                <div
                  style={{
                    maxWidth: 860,
                    margin: "0 auto",
                    padding: "32px 36px",
                    borderRadius: 16,
                    background: t.cardBg,
                    border: `1px solid ${t.cardBorder}`,
                  }}
                >
                  <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: t.textPrimary, margin: "0 0 8px 0" }}>
                    {block.title}
                  </h1>
                  {block.subtitle && (
                    <div style={{ fontSize: "0.85rem", color: t.textMuted, marginBottom: 24 }}>
                      {interpolateLegalVariables(block.subtitle, schoolSettings)}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "0.92rem",
                      lineHeight: 1.65,
                      color: t.textSecondary,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {interpolateLegalVariables(block.content || "", schoolSettings)}
                  </div>
                </div>
              )}

              {/* BLOCK 9: CONTACT LEAD */}
              {block.type === "contact_lead" && (
                <div
                  style={{
                    padding: "36px 32px",
                    borderRadius: 20,
                    background: t.cardBg,
                    border: `1.5px solid ${t.accentBorder}`,
                    textAlign: "center",
                    maxWidth: 720,
                    margin: "0 auto",
                  }}
                >
                  <span style={{ fontSize: "2rem", display: "inline-block", marginBottom: 12 }}>💬</span>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px 0" }}>
                    {block.title}
                  </h2>
                  <p style={{ fontSize: "0.92rem", color: t.textSecondary, margin: "0 0 24px 0" }}>
                    {block.subtitle}
                  </p>

                  <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                    {block.config?.telegramUrl && (
                      <a
                        href={block.config.telegramUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "10px 20px",
                          borderRadius: 10,
                          background: "#0088cc",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        ✈️ Написать в Telegram
                      </a>
                    )}
                    {block.config?.phone && (
                      <a
                        href={`tel:${block.config.phone}`}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 10,
                          background: t.accentBg,
                          color: t.accent,
                          border: `1px solid ${t.accentBorder}`,
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        📞 {block.config.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>

      {/* FOOTER */}
      <footer
        style={{
          background: t.footerBg,
          color: "#94a3b8",
          padding: "40px 28px 32px 28px",
          borderTop: `1px solid ${t.border}`,
          marginTop: "auto",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "1.4rem" }}>{schoolSettings.schoolLogoEmoji || "🏛️"}</span>
              <span style={{ fontWeight: 800, fontSize: "1rem", color: "#f8fafc" }}>
                {schoolSettings.schoolName}
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", maxWidth: 360, lineHeight: 1.45, color: "#64748b" }}>
              {schoolSettings.schoolTagline}
            </div>
            {schoolSettings.inn && (
              <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: 8 }}>
                ИНН: {schoolSettings.inn} | ОГРН: {schoolSettings.ogrn || "—"}
              </div>
            )}
          </div>

          {/* Legal / Site Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>Документы и информация</span>
            <button
              type="button"
              onClick={() => handleNavigate("about")}
              style={{ background: "none", border: "none", color: "#94a3b8", textAlign: "left", cursor: "pointer", padding: 0 }}
            >
              Сведения об организации
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("oferta")}
              style={{ background: "none", border: "none", color: "#94a3b8", textAlign: "left", cursor: "pointer", padding: 0 }}
            >
              Публичная оферта
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("personaldata")}
              style={{ background: "none", border: "none", color: "#94a3b8", textAlign: "left", cursor: "pointer", padding: 0 }}
            >
              Политика конфиденциальности (152-ФЗ)
            </button>
          </div>

          {/* Student & Host entry */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowStudentCodeModal(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.15)",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🔑 Вход в кабинет студента
            </button>

            {onOpenCreatorStudio && (
              <button
                type="button"
                onClick={onOpenCreatorStudio}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "transparent",
                  color: "#64748b",
                  border: "none",
                  fontSize: "0.74rem",
                  cursor: "pointer",
                }}
              >
                ⚙️ Панель управления школой
              </button>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "28px auto 0 auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "0.72rem", color: "#475569", textAlign: "center" }}>
          © {new Date().getFullYear()} {schoolSettings.schoolName}. Все права защищены.
        </div>
      </footer>

      {/* STUDENT CODE LOGIN MODAL */}
      {showStudentCodeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowStudentCodeModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: t.cardBg,
              borderRadius: 18,
              padding: 28,
              border: `1.5px solid ${t.accent}`,
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: t.textPrimary }}>
                🔑 Вход в кабинет студента
              </h3>
              <button
                type="button"
                onClick={() => setShowStudentCodeModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: t.textMuted, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: t.textSecondary, lineHeight: 1.45, margin: "0 0 18px 0" }}>
              Введите ваш персональный код доступа (выдан при регистрации или оплате курса):
            </p>

            <form onSubmit={handleStudentLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="text"
                value={studentInputCode}
                onChange={(e) => setStudentInputCode(e.target.value)}
                placeholder="Например: STU-7492"
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: `1.5px solid ${t.border}`,
                  background: isDark ? "#090d16" : "#ffffff",
                  color: t.textPrimary,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: "0.05em",
                }}
                autoFocus
              />

              <button
                type="submit"
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: t.accent,
                  color: "#ffffff",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Войти в учебный класс →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
