import React, { useState, useEffect, useMemo } from "react";
import {
  type SitePage,
  type SiteBlock,
  type SiteBlockType,
  type PageFolder,
  type SchoolSiteSettings,
  loadSitePages,
  saveSitePages,
  loadSchoolSettings,
  saveSchoolSettings,
  createDefaultPage,
  createBlock,
  DEFAULT_SITE_PAGES,
  DEFAULT_SCHOOL_SETTINGS,
} from "../../lib/site_pages_store.ts";
import { downloadStandaloneHtmlFile } from "../../lib/export_standalone_html.ts";
import PublicSitePageView from "./PublicSitePageView.tsx";

interface SitePagesManagerProps {
  isDark?: boolean;
}

const FOLDER_NAMES: Record<PageFolder, { label: string; icon: string }> = {
  general: { label: "Общие страницы", icon: "📁" },
  directions: { label: "Направления и методы", icon: "🎓" },
  events: { label: "Мероприятия и вебинары", icon: "🎙️" },
  legal: { label: "Юридические документы", icon: "📜" },
};

const BLOCK_TYPE_INFO: Record<SiteBlockType, { label: string; icon: string; desc: string }> = {
  hero: { label: "Главный баннер (Hero)", icon: "🖼️", desc: "Экран с крупным заголовком, описанием и кнопкой записи" },
  direction_info: { label: "О направлении / методе", icon: "💡", desc: "Преимущества и ключевые тезисы обучения" },
  courses_grid: { label: "Витрина курсов", icon: "📚", desc: "Сетка карточек курсов с ценами и записью" },
  webinars_grid: { label: "Расписание вебинаров", icon: "🎙️", desc: "Ближайшие живые эфиры и мастер-классы" },
  speakers_team: { label: "Преподаватели и спикеры", icon: "👥", desc: "Карточки преподавателей и экспертов" },
  reviews_quotes: { label: "Отзывы выпускников", icon: "⭐", desc: "Цитаты и оценки реальных студентов" },
  faq_accordion: { label: "Вопросы и ответы (FAQ)", icon: "❓", desc: "Раскрывающийся список частых вопросов" },
  text_legal: { label: "Текст / Документ (152-ФЗ, Оферта)", icon: "📜", desc: "Форматированный текст с автоподстановкой реквизитов" },
  contact_lead: { label: "Контакты и запись", icon: "📞", desc: "Кнопки Telegram, телефон и режим работы" },
};

export default function SitePagesManager({ isDark = false }: SitePagesManagerProps) {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("page-main");
  const [settings, setSettings] = useState<SchoolSiteSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [previewPage, setPreviewPage] = useState<SitePage | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  // New page form
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageFolder, setNewPageFolder] = useState<PageFolder>("directions");

  useEffect(() => {
    const loadedPages = loadSitePages();
    setPages(loadedPages);
    setSettings(loadSchoolSettings());
    if (loadedPages.length > 0 && !loadedPages.some((p) => p.id === selectedPageId)) {
      setSelectedPageId(loadedPages[0].id);
    }
  }, []);

  const selectedPage = useMemo(() => {
    return pages.find((p) => p.id === selectedPageId) || pages[0];
  }, [pages, selectedPageId]);

  const updatePages = (updated: SitePage[]) => {
    setPages(updated);
    saveSitePages(updated);
  };

  const updateSettings = (updated: SchoolSiteSettings) => {
    setSettings(updated);
    saveSchoolSettings(updated);
  };

  const t = useMemo(() => {
    return isDark
      ? {
          bg: "#0f172a",
          panelBg: "#090d16",
          cardBg: "#1e293b",
          cardBorder: "rgba(255, 255, 255, 0.1)",
          cardHoverBg: "#334155",
          textPrimary: "#f8fafc",
          textSecondary: "#94a3b8",
          textMuted: "#64748b",
          accent: "#14b8a6",
          accentBg: "rgba(20, 184, 166, 0.12)",
          accentBorder: "rgba(20, 184, 166, 0.3)",
          inputBg: "#0f172a",
          inputBorder: "rgba(255, 255, 255, 0.15)",
          border: "rgba(255, 255, 255, 0.08)",
        }
      : {
          bg: "#f8fafc",
          panelBg: "#ffffff",
          cardBg: "#ffffff",
          cardBorder: "#e2e8f0",
          cardHoverBg: "#f1f5f9",
          textPrimary: "#0f172a",
          textSecondary: "#475569",
          textMuted: "#94a3b8",
          accent: "#0f766e",
          accentBg: "#f0fdfa",
          accentBorder: "#99f6e4",
          inputBg: "#ffffff",
          inputBorder: "#cbd5e1",
          border: "#e2e8f0",
        };
  }, [isDark]);

  const handleCreatePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;
    const cleanSlug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || `page-${Date.now()}`;
    const newPage = createDefaultPage(newPageTitle.trim(), cleanSlug, newPageFolder);
    const updated = [...pages, newPage];
    updatePages(updated);
    setSelectedPageId(newPage.id);
    setShowCreatePageModal(false);
    setNewPageTitle("");
    setNewPageSlug("");
  };

  const handleDeletePage = (pageId: string, title: string) => {
    if (pageId === "page-main") {
      alert("Главную страницу нельзя удалить.");
      return;
    }
    if (window.confirm(`Удалить страницу «${title}»?`)) {
      const updated = pages.filter((p) => p.id !== pageId);
      updatePages(updated);
      setSelectedPageId(updated[0]?.id || "page-main");
    }
  };

  const handleUpdateCurrentPage = (fields: Partial<SitePage>) => {
    if (!selectedPage) return;
    const updated = pages.map((p) => {
      if (p.id === selectedPage.id) {
        return { ...p, ...fields, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    updatePages(updated);
  };

  const handleAddBlock = (type: SiteBlockType) => {
    if (!selectedPage) return;
    const newBlock = createBlock(type);
    const updatedBlocks = [...selectedPage.blocks, newBlock];
    handleUpdateCurrentPage({ blocks: updatedBlocks });
    setShowAddBlockModal(false);
  };

  const handleUpdateBlock = (blockId: string, fields: Partial<SiteBlock>) => {
    if (!selectedPage) return;
    const updatedBlocks = selectedPage.blocks.map((b) => {
      if (b.id === blockId) {
        return { ...b, ...fields };
      }
      return b;
    });
    handleUpdateCurrentPage({ blocks: updatedBlocks });
  };

  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    if (!selectedPage) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedPage.blocks.length) return;
    const blocksCopy = [...selectedPage.blocks];
    const [moved] = blocksCopy.splice(index, 1);
    blocksCopy.splice(newIndex, 0, moved);
    handleUpdateCurrentPage({ blocks: blocksCopy });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!selectedPage) return;
    if (window.confirm("Удалить этот блок со страницы?")) {
      const updatedBlocks = selectedPage.blocks.filter((b) => b.id !== blockId);
      handleUpdateCurrentPage({ blocks: updatedBlocks });
    }
  };

  const handleResetToPresets = () => {
    if (window.confirm("Восстановить все стандартные страницы института (Главная, Программы, Преподаватели, Оферта, 152-ФЗ, Согласие)? Все текущие правки будут заменены стандартным набором.")) {
      updatePages(DEFAULT_SITE_PAGES);
      updateSettings(DEFAULT_SCHOOL_SETTINGS);
      setSelectedPageId("page-main");
    }
  };

  const handleCopyLink = (pageSlug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://academy.ida-psy.ru";
    const fullUrl = pageSlug === "main" ? `${origin}/` : `${origin}/?page=${pageSlug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopyNotice(`✓ Ссылка скопирована: ${fullUrl}`);
    setTimeout(() => setCopyNotice(null), 3500);
  };

  const handleCopyEmbedCode = (pageSlug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://academy.ida-psy.ru";
    const embedUrl = pageSlug === "main" ? `${origin}/` : `${origin}/?page=${pageSlug}`;
    const code = `<iframe src="${embedUrl}" width="100%" height="900" frameborder="0" style="border:none; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.08);" allow="camera; microphone; fullscreen; payment"></iframe>`;
    navigator.clipboard.writeText(code);
    setCopyNotice("✓ HTML-код для вставки скопирован (Tilda блок T123 / WordPress)!");
    setTimeout(() => setCopyNotice(null), 3500);
  };

  const handleExportHtmlSite = () => {
    try {
      const curSettings = loadSchoolSettings();
      const curPages = loadSitePages();
      downloadStandaloneHtmlFile({
        settings: curSettings,
        pages: curPages,
      });
      setCopyNotice("✓ Автономный HTML-сайт школы скачан в «Загрузки»!");
      setTimeout(() => setCopyNotice(null), 4000);
    } catch (e: any) {
      alert("Ошибка при выгрузке HTML-сайта: " + (e?.message || e));
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: "calc(100vh - 80px)", background: t.bg }}>
      {/* ========================================================= */}
      {/* LEFT COLUMN: PAGES FOLDER TREE */}
      {/* ========================================================= */}
      <aside
        style={{
          width: 320,
          minWidth: 280,
          background: t.panelBg,
          borderRight: `1px solid ${t.border}`,
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
        }}
      >
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: t.textPrimary }}>
              🌐 Страницы сайта
            </div>
            <div style={{ fontSize: "0.72rem", color: t.textMuted }}>
              Конструктор сайта школы
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              onClick={handleExportHtmlSite}
              title="Скачать автономный HTML-сайт школы для размещения на любом хостинге (Tilda, Beget, GitHub Pages, свой сервер)"
              style={{
                padding: "6px 9px",
                borderRadius: 8,
                border: "1px solid #10b981",
                background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
                color: isDark ? "#6ee7b7" : "#047857",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>🌐</span> HTML
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Настройки бренда, реквизитов и документов"
              style={{
                padding: "6px 9px",
                borderRadius: 8,
                border: `1px solid ${t.accentBorder}`,
                background: t.accentBg,
                color: t.accent,
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Add Page Button */}
        <button
          type="button"
          onClick={() => {
            setNewPageTitle("");
            setNewPageSlug("");
            setShowCreatePageModal(true);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: t.accent,
            color: "#ffffff",
            fontSize: "0.85rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: "0 2px 8px rgba(15, 118, 110, 0.2)",
          }}
        >
          <span>+ Создать страницу</span>
        </button>

        {/* Folder Groups */}
        {(["general", "directions", "events", "legal"] as PageFolder[]).map((folderKey) => {
          const folderInfo = FOLDER_NAMES[folderKey];
          const folderPages = pages.filter((p) => p.folder === folderKey);
          if (folderPages.length === 0) return null;

          return (
            <div key={folderKey} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: t.textMuted,
                  letterSpacing: "0.04em",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{folderInfo.icon}</span>
                <span>{folderInfo.label}</span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.7 }}>{folderPages.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {folderPages.map((page) => {
                  const isSelected = page.id === selectedPageId;
                  return (
                    <div
                      key={page.id}
                      onClick={() => setSelectedPageId(page.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: isSelected ? t.accentBg : "transparent",
                        border: `1px solid ${isSelected ? t.accentBorder : "transparent"}`,
                        color: isSelected ? t.accent : t.textPrimary,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <div style={{ fontSize: "0.84rem", fontWeight: isSelected ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {page.title}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: isSelected ? t.accent : t.textMuted }}>
                          /{page.slug}
                        </div>
                      </div>

                      {page.badge && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: isSelected ? t.accent : t.border,
                            color: isSelected ? "#ffffff" : t.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {page.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Reset Presets Footer */}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
          <button
            type="button"
            onClick={handleResetToPresets}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              background: "transparent",
              border: `1px dashed ${t.border}`,
              color: t.textMuted,
              fontSize: "0.72rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            🔄 Восстановить шаблоны страниц
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN COLUMN: CURRENT PAGE EDITOR & BLOCKS BUILDER */}
      {/* ========================================================= */}
      <main style={{ flex: 1, padding: "24px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {copyNotice && (
          <div
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: t.accentBg,
              color: t.accent,
              border: `1.5px solid ${t.accent}`,
              fontWeight: 700,
              fontSize: "0.85rem",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            {copyNotice}
          </div>
        )}

        {/* User Guidance Banner */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 14,
            background: isDark ? "rgba(15, 118, 110, 0.15)" : "#f0fdfa",
            border: `1px solid ${t.accentBorder}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>⚡</span>
          <div style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
            <strong style={{ color: t.accent, display: "block", marginBottom: 3, fontSize: "0.92rem" }}>
              Страницы создаются в 1 клик и автоматически связаны с вашим Терминалом
            </strong>
            <span style={{ color: t.textSecondary }}>
              Любая созданная страница (направление, визитка, вебинар, оферта) сразу готова к работе. 
              Все формы и кнопки записи на ваших страницах автоматически используют встроенный ИИ-ассистент: 
              клиент может описать запрос своими словами или выбрать быструю запись. Все заявки мгновенно 
              поступают во вкладку <strong>«📥 Входящие»</strong> вашего терминала и в 1 клик превращаются в кейс клиента.
            </span>
          </div>
        </div>

        {selectedPage && (
          <>
            {/* Top Page Bar */}
            <div
              style={{
                padding: "20px 24px",
                borderRadius: 16,
                background: t.cardBg,
                border: `1.5px solid ${t.cardBorder}`,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.4rem" }}>📄</span>
                  <div>
                    <input
                      type="text"
                      value={selectedPage.title}
                      onChange={(e) => handleUpdateCurrentPage({ title: e.target.value })}
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        color: t.textPrimary,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        width: "100%",
                        minWidth: 260,
                      }}
                      placeholder="Название страницы"
                    />
                    <div style={{ fontSize: "0.78rem", color: t.textMuted, display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <span>URL: /{selectedPage.slug}</span>
                      <span>•</span>
                      <span>Обновлено: {new Date(selectedPage.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setPreviewPage(selectedPage)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${t.accentBorder}`,
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
                    <span>👁️ Предпросмотр</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(selectedPage.slug)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>🔗 Ссылка</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyEmbedCode(selectedPage.slug)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.cardBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>📋 Код виджета</span>
                  </button>

                  {selectedPage.id !== "page-main" && (
                    <button
                      type="button"
                      onClick={() => handleDeletePage(selectedPage.id, selectedPage.title)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.08)",
                        color: "#ef4444",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🗑️ Удалить
                    </button>
                  )}
                </div>
              </div>

              {/* URL & Folder Slug edit line */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                    URL-адрес (Slug):
                  </label>
                  <input
                    type="text"
                    value={selectedPage.slug}
                    disabled={selectedPage.id === "page-main"}
                    onChange={(e) => handleUpdateCurrentPage({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                    Папка / Категория:
                  </label>
                  <select
                    value={selectedPage.folder}
                    onChange={(e) => handleUpdateCurrentPage({ folder: e.target.value as PageFolder })}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="general">📁 Общие страницы</option>
                    <option value="directions">🎓 Направления и методы</option>
                    <option value="events">🎙️ Мероприятия и вебинары</option>
                    <option value="legal">📜 Юридические документы</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                    Бейдж на кнопке:
                  </label>
                  <input
                    type="text"
                    value={selectedPage.badge || ""}
                    onChange={(e) => handleUpdateCurrentPage({ badge: e.target.value })}
                    placeholder="Например: 🔥 Популярное"
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${t.inputBorder}`,
                      background: t.inputBg,
                      color: t.textPrimary,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Blocks Header & Add Block Button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary, margin: 0 }}>
                  🧱 Блоки страницы ({selectedPage.blocks.length})
                </h2>
                <div style={{ fontSize: "0.75rem", color: t.textMuted }}>
                  Меняйте местами, редактируйте тексты и добавляйте новые секции
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddBlockModal(true)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: t.accent,
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(15, 118, 110, 0.2)",
                }}
              >
                <span>+ Добавить блок</span>
              </button>
            </div>

            {/* Blocks List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {selectedPage.blocks.map((block, idx) => {
                const blockInfo = BLOCK_TYPE_INFO[block.type] || { label: block.type, icon: "📦", desc: "" };
                return (
                  <div
                    key={block.id}
                    style={{
                      borderRadius: 14,
                      background: t.cardBg,
                      border: `1.5px solid ${t.cardBorder}`,
                      padding: "18px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      opacity: block.isHidden ? 0.6 : 1,
                    }}
                  >
                    {/* Block Card Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "1.2rem" }}>{blockInfo.icon}</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "0.92rem", color: t.textPrimary }}>
                            {blockInfo.label}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: t.textMuted }}>
                            {blockInfo.desc}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Up, Down, Hide, Delete */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(idx, "up")}
                          disabled={idx === 0}
                          title="Переместить выше"
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: `1px solid ${t.border}`,
                            background: t.inputBg,
                            color: t.textSecondary,
                            cursor: idx === 0 ? "not-allowed" : "pointer",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(idx, "down")}
                          disabled={idx === selectedPage.blocks.length - 1}
                          title="Переместить ниже"
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: `1px solid ${t.border}`,
                            background: t.inputBg,
                            color: t.textSecondary,
                            cursor: idx === selectedPage.blocks.length - 1 ? "not-allowed" : "pointer",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBlock(block.id, { isHidden: !block.isHidden })}
                          title={block.isHidden ? "Показать блок" : "Скрыть блок"}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: `1px solid ${t.border}`,
                            background: block.isHidden ? t.accentBg : t.inputBg,
                            color: block.isHidden ? t.accent : t.textSecondary,
                            cursor: "pointer",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          {block.isHidden ? "👁️ Скрыт" : "👁️ Виден"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          title="Удалить блок"
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            background: "rgba(239, 68, 68, 0.08)",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Block Fields Form */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                          Заголовок блока:
                        </label>
                        <input
                          type="text"
                          value={block.title || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { title: e.target.value })}
                          placeholder="Заголовок секции"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1px solid ${t.inputBorder}`,
                            background: t.inputBg,
                            color: t.textPrimary,
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                          Подзаголовок / пояснение:
                        </label>
                        <input
                          type="text"
                          value={block.subtitle || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { subtitle: e.target.value })}
                          placeholder="Краткое пояснение"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1px solid ${t.inputBorder}`,
                            background: t.inputBg,
                            color: t.textPrimary,
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>

                    {/* Specific Config Fields */}
                    {block.type === "hero" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 6 }}>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                            Текст кнопки действия:
                          </label>
                          <input
                            type="text"
                            value={block.config?.buttonText || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { config: { ...block.config, buttonText: e.target.value } })}
                            placeholder="Например: 📚 Записаться на курс"
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                            Ссылка кнопки:
                          </label>
                          <input
                            type="text"
                            value={block.config?.buttonUrl || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { config: { ...block.config, buttonUrl: e.target.value } })}
                            placeholder="#courses или ссылка на оплату"
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                            Бейдж сверху:
                          </label>
                          <input
                            type="text"
                            value={block.config?.badgeText || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { config: { ...block.config, badgeText: e.target.value } })}
                            placeholder="Например: ✨ Набор открыт"
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box" }}
                          />
                        </div>
                      </div>
                    )}

                    {block.type === "text_legal" && (
                      <div>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                          Содержимое документа (поддерживаются переменные: {`{{school_name}}`}, {`{{inn}}`}, {`{{email}}`}, {`{{date}}`}):
                        </label>
                        <textarea
                          rows={8}
                          value={block.content || ""}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: `1px solid ${t.inputBorder}`,
                            background: t.inputBg,
                            color: t.textPrimary,
                            fontSize: "0.82rem",
                            lineHeight: 1.45,
                            fontFamily: "monospace",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    )}

                    {block.type === "contact_lead" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 6 }}>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                            Ссылка на Telegram:
                          </label>
                          <input
                            type="text"
                            value={block.config?.telegramUrl || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { config: { ...block.config, telegramUrl: e.target.value } })}
                            placeholder="https://t.me/psy_institute"
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                            Телефон:
                          </label>
                          <input
                            type="text"
                            value={block.config?.phone || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { config: { ...block.config, phone: e.target.value } })}
                            placeholder="+7 (495) 123-45-67"
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 4 }}>
                            Электронная почта:
                          </label>
                          <input
                            type="text"
                            value={block.config?.email || ""}
                            onChange={(e) => handleUpdateBlock(block.id, { config: { ...block.config, email: e.target.value } })}
                            placeholder="info@psy-institute.ru"
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: ADD BLOCK MODAL */}
      {/* ========================================================= */}
      {showAddBlockModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowAddBlockModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              background: t.panelBg,
              borderRadius: 18,
              padding: 24,
              border: `1.5px solid ${t.accent}`,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary }}>
                🧱 Выберите блок для добавления
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBlockModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: t.textMuted, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {(Object.keys(BLOCK_TYPE_INFO) as SiteBlockType[]).map((blockType) => {
                const info = BLOCK_TYPE_INFO[blockType];
                return (
                  <div
                    key={blockType}
                    onClick={() => handleAddBlock(blockType)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: t.cardBg,
                      border: `1px solid ${t.border}`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{info.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.88rem", color: t.textPrimary, marginBottom: 2 }}>
                        {info.label}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.35 }}>
                        {info.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CREATE PAGE MODAL */}
      {/* ========================================================= */}
      {showCreatePageModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowCreatePageModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: t.panelBg,
              borderRadius: 18,
              padding: 24,
              border: `1.5px solid ${t.accent}`,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary }}>
                + Создать новую страницу
              </h3>
              <button
                type="button"
                onClick={() => setShowCreatePageModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: t.textMuted, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePageSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  Название страницы (для меню и шапки):
                </label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => {
                    setNewPageTitle(e.target.value);
                    if (!newPageSlug) {
                      setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                    }
                  }}
                  placeholder="Например: Кафедра КПТ и кризисной помощи"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  URL-адрес (Slug):
                </label>
                <input
                  type="text"
                  value={newPageSlug}
                  onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="Например: kpt или crisis"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  Раздел (папка):
                </label>
                <select
                  value={newPageFolder}
                  onChange={(e) => setNewPageFolder(e.target.value as PageFolder)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${t.inputBorder}`,
                    background: t.inputBg,
                    color: t.textPrimary,
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="directions">🎓 Направления и методы</option>
                  <option value="events">🎙️ Мероприятия и вебинары</option>
                  <option value="general">📁 Общие страницы</option>
                  <option value="legal">📜 Юридические документы</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreatePageModal(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: t.cardBg,
                    color: t.textSecondary,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Создать страницу →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: SCHOOL BRAND & REQUISITES SETTINGS */}
      {/* ========================================================= */}
      {showSettingsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              background: t.panelBg,
              borderRadius: 18,
              padding: 24,
              border: `1.5px solid ${t.accent}`,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: t.textPrimary }}>
                ⚙️ Реквизиты и бренд института
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", color: t.textMuted, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", color: t.textSecondary, lineHeight: 1.45, margin: "0 0 16px 0" }}>
              Эти данные автоматически подставляются в шапку сайта, подвал и юридические документы (Оферта, 152-ФЗ, Сведения об организации).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  Название института / школы:
                </label>
                <input
                  type="text"
                  value={settings.schoolName}
                  onChange={(e) => updateSettings({ ...settings, schoolName: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  Слоган / краткое описание:
                </label>
                <input
                  type="text"
                  value={settings.schoolTagline}
                  onChange={(e) => updateSettings({ ...settings, schoolTagline: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                    ИНН организации:
                  </label>
                  <input
                    type="text"
                    value={settings.inn || ""}
                    onChange={(e) => updateSettings({ ...settings, inn: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                    ОГРН:
                  </label>
                  <input
                    type="text"
                    value={settings.ogrn || ""}
                    onChange={(e) => updateSettings({ ...settings, ogrn: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                    Email:
                  </label>
                  <input
                    type="text"
                    value={settings.contactEmail}
                    onChange={(e) => updateSettings({ ...settings, contactEmail: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                    Телефон:
                  </label>
                  <input
                    type="text"
                    value={settings.contactPhone || ""}
                    onChange={(e) => updateSettings({ ...settings, contactPhone: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Custom Domain Section */}
              <div style={{ padding: "12px 14px", borderRadius: 10, background: t.cardBg, border: `1px solid ${t.border}` }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  🌐 Собственный домен сайта школы (опционально):
                </label>
                <input
                  type="text"
                  value={settings.customDomain || ""}
                  onChange={(e) => updateSettings({ ...settings, customDomain: e.target.value })}
                  placeholder="Например: school.psy-practice.ru"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.85rem", boxSizing: "border-box", marginBottom: 6 }}
                />
                <div style={{ fontSize: "0.74rem", color: t.textMuted, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <div style={{ fontWeight: 600, color: t.textPrimary }}>
                    📋 Как привязать свой адрес у вашего регистратора (Reg.ru, Beget, Timeweb и др.):
                  </div>
                  <div style={{ padding: "8px 10px", background: "rgba(148, 163, 184, 0.08)", borderRadius: 8, border: `1px solid ${t.border}` }}>
                    <div><strong>Вариант 1 (Рекомендуется — поддомен):</strong> например, <code>school.psy-center.ru</code></div>
                    <div style={{ marginTop: 2, color: t.textSecondary }}>
                      Добавьте <strong>CNAME-запись</strong>: имя (хост) <code>school</code> ➔ значение <code>academy.ida-psy.ru</code>
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "rgba(148, 163, 184, 0.08)", borderRadius: 8, border: `1px solid ${t.border}` }}>
                    <div><strong>Вариант 2 (Основной домен):</strong> например, <code>psy-center.ru</code></div>
                    <div style={{ marginTop: 2, color: t.textSecondary }}>
                      Добавьте две <strong>А-записи</strong> с IP нашего сервера:
                      <br />• Имя <code>@</code> (или пустое) ➔ IP <code>130.61.210.24</code>
                      <br />• Имя <code>www</code> ➔ IP <code>130.61.210.24</code>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: t.textMuted, marginTop: 2 }}>
                    ⏱️ Обновление DNS занимает от 15 минут до 2–4 часов. Безопасный защищённый протокол (SSL / HTTPS) подключается на сервере автоматически после подтверждения записи.
                  </div>
                </div>
              </div>

              {/* Payment Gateway & Bank Compliance Section */}
              <div style={{ padding: "12px 14px", borderRadius: 10, background: t.cardBg, border: `1px solid ${t.border}` }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: t.textPrimary, display: "block", marginBottom: 4 }}>
                  💳 Приём оплат и эквайринг (проверка банком):
                </label>
                <select
                  value={settings.paymentGateway || "ЮKassa / СБП (Прямой расчётный счёт)"}
                  onChange={(e) => updateSettings({ ...settings, paymentGateway: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.textPrimary, fontSize: "0.82rem", boxSizing: "border-box", marginBottom: 6 }}
                >
                  <option value="ЮKassa / СБП (Прямой расчётный счёт)">💳 ЮKassa / СБП (Прямой расчётный счёт организации/ИП)</option>
                  <option value="Prodamus (Платёжная страница)">💳 Prodamus (Платёжная страница онлайн-школы)</option>
                  <option value="Т-Касса / Т-Банк (Интернет-эквайринг)">💳 Т-Касса / Т-Банк (Интернет-эквайринг)</option>
                  <option value="Robokassa / CloudPayments">💳 Robokassa / CloudPayments</option>
                  <option value="">Не указывать провайдера</option>
                </select>
                <div style={{ fontSize: "0.72rem", color: t.textMuted, lineHeight: 1.45, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div>
                    💡 <strong>Как это работает:</strong> Укажите платёжный сервис или банк, через который вы принимаете оплату. Это название отображается в публичной оферте школы и на витрине курсов для успешного прохождения проверки службой безопасности банка.
                  </div>
                  <div>
                    🔗 Прямую ссылку на оплату (ЮKassa, Prodamus, платёжную форму вашего банка) вы указываете в карточке каждого конкретного курса или вебинара — деньги поступают сразу на ваш расчётный счёт без комиссий платформы.
                  </div>
                  <div style={{ marginTop: 2 }}>
                    🛡️ <strong>Для модерации банка:</strong> банк требует наличие ИНН/ОГРН, контактов, ссылок на <em>Публичную оферту</em> (раздел «Оферта») и <em>Политику конфиденциальности (152-ФЗ)</em>. В конструкторе эти страницы уже созданы и активны.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: t.accent,
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  ✓ Сохранить реквизиты
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: FULLSCREEN LIVE PREVIEW */}
      {/* ========================================================= */}
      {previewPage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#000000",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top Bar with Close button */}
          <div
            style={{
              height: 48,
              background: "#0f172a",
              padding: "0 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              color: "#ffffff",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 8 }}>
              <span>👁️ Предпросмотр страницы:</span>
              <span style={{ color: "#2dd4bf" }}>{previewPage.title} (/{previewPage.slug})</span>
            </div>

            <button
              type="button"
              onClick={() => setPreviewPage(null)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "#ffffff",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✕ Закрыть предпросмотр
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <PublicSitePageView page={previewPage} previewMode={true} />
          </div>
        </div>
      )}
    </div>
  );
}
