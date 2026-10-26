import { useState, useEffect } from "react";
import type { WorkspaceNavItem } from "../lib/workspace_nav.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";
import { getMainLandingInfo } from "../lib/terminal_branding.ts";
import WorkspaceNavIcon from "./WorkspaceNavIcon.tsx";
import CustomizeMenuModal from "./CustomizeMenuModal.tsx";
import { t } from "../lib/i18n.ts";

interface WorkspaceSidebarProps {
  items: WorkspaceNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  cfg?: TerminalConfig;
  onUpdateModules?: (modules: Record<string, boolean>) => Promise<void> | void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const { items, activeId, onSelect, cfg, onUpdateModules, mobileOpen: propMobileOpen, onMobileClose } = props;
  const [expanded, setExpanded] = useState(false);
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [localMobileOpen, setLocalMobileOpen] = useState(false);

  const isMobileOpen = propMobileOpen !== undefined ? propMobileOpen : localMobileOpen;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const sync = () => setExpanded(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Слушатель глобальных событий для открытия/закрытия сайдбара на мобильных
  useEffect(() => {
    function handleOpenEvent() {
      setLocalMobileOpen(true);
    }
    function handleCloseEvent() {
      setLocalMobileOpen(false);
      if (onMobileClose) onMobileClose();
    }
    window.addEventListener("terminal:open-mobile-sidebar", handleOpenEvent);
    window.addEventListener("terminal:close-mobile-sidebar", handleCloseEvent);
    return () => {
      window.removeEventListener("terminal:open-mobile-sidebar", handleOpenEvent);
      window.removeEventListener("terminal:close-mobile-sidebar", handleCloseEvent);
    };
  }, [onMobileClose]);

  const handleClose = () => {
    setLocalMobileOpen(false);
    if (onMobileClose) onMobileClose();
  };

  const topItems = items.filter(
    (i) =>
      !i.purpleCluster &&
      i.tier !== "system" &&
      i.id !== "analytical_report" &&
      i.id !== "workload" &&
      i.id !== "academy" &&
      i.id !== "feedback" &&
      i.id !== "settings",
  );

  const purpleItems = items.filter((i) => i.purpleCluster);

  const reportItems = items.filter(
    (i) =>
      (i.id === "analytical_report" || i.id === "workload" || i.id === "academy") &&
      !i.purpleCluster,
  );

  const systemItems = items.filter(
    (i) =>
      i.tier === "system" ||
      i.id === "feedback" ||
      i.id === "settings",
  );

  const landingInfo = getMainLandingInfo();

  const renderItem = (item: WorkspaceNavItem) => (
    <div key={item.id} className="workspace-nav-block">
      <button
        type="button"
        className={`workspace-nav-item${activeId === item.id ? " active" : ""}${item.id === "settings" ? " workspace-nav-item--settings" : ""}${item.locked ? " workspace-nav-item--locked" : ""}${item.highlightCluster ? " workspace-nav-item--cluster" : ""}${item.aiCluster ? " workspace-nav-item--ai-cluster" : ""}`}
        title={item.locked ? `${item.label} — по подписке ИИ` : item.label}
        aria-disabled={item.locked || undefined}
        onClick={() => {
          onSelect(item.id);
          handleClose();
          if (window.matchMedia("(max-width: 900px)").matches) {
            setExpanded(false);
          }
        }}
      >
        <WorkspaceNavIcon id={item.icon} />
        <span className="workspace-nav-label">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span
            className="workspace-nav-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "18px",
              height: "18px",
              borderRadius: "9px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0 5px",
              marginLeft: "auto",
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label={`${item.badge} непрочитанных`}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
        {item.locked ? <span className="workspace-nav-lock" aria-hidden="true">🔒</span> : null}
      </button>
    </div>
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="workspace-sidebar-backdrop"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`workspace-sidebar${expanded ? " workspace-sidebar--expanded" : ""}${isMobileOpen ? " workspace-sidebar--mobile-open is-mobile-open" : ""}`}
        aria-label="Инструменты рабочего места"
      >
        {/* Шапка меню для мобильных устройств */}
        <div className="workspace-sidebar-mobile-head">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>🧭</span>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text, #1e293b)" }}>
              {t("Разделы кабинета", "Workspace Sections")}
            </span>
          </div>
          <button
            type="button"
            className="workspace-sidebar-mobile-close"
            onClick={handleClose}
            aria-label={t("Закрыть меню", "Close menu")}
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          className="workspace-sidebar-toggle"
          aria-label={expanded ? "Свернуть меню" : "Развернуть меню"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="workspace-sidebar-toggle-bars" aria-hidden="true" />
        </button>

        <nav className="workspace-nav">
          {topItems.map(renderItem)}

          {purpleItems.length > 0 && (
            <div className="workspace-nav-cluster workspace-nav-cluster--purple" style={{ position: "relative" }}>
              {onUpdateModules && (
                <button
                  type="button"
                  className="workspace-nav-cluster-gear"
                  title="Настроить разделы меню"
                  aria-label="Настроить разделы меню"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomizeModalOpen(true);
                  }}
                >
                  <WorkspaceNavIcon id="settings" className="workspace-nav-cluster-gear-icon" />
                </button>
              )}
              {purpleItems.map(renderItem)}
            </div>
          )}

          {reportItems.map(renderItem)}

          {systemItems.length > 0 && (
            <>
              <div key="nav-divider-system" className="workspace-nav-divider" role="separator" />
              {systemItems.map((item) => {
                if (item.id === "settings" && onUpdateModules) {
                  return (
                    <div key={item.id} className="workspace-nav-block workspace-nav-block--settings-row" style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        {renderItem(item)}
                      </div>
                      <button
                        type="button"
                        className="workspace-nav-settings-customize-btn"
                        title={t("Настроить видимость разделов меню", "Customize menu sections visibility")}
                        aria-label={t("Настроить разделы меню", "Customize menu sections")}
                        onClick={() => setCustomizeModalOpen(true)}
                      >
                        <WorkspaceNavIcon id="settings" className="workspace-nav-settings-customize-icon" />
                      </button>
                    </div>
                  );
                }
                return renderItem(item);
              })}
            </>
          )}
        </nav>

        {onUpdateModules && (
          <CustomizeMenuModal
            isOpen={customizeModalOpen}
            isCommercial={cfg?.org_type === "commercial"}
            currentModules={cfg?.enabled_modules || {}}
            onClose={() => setCustomizeModalOpen(false)}
            onSave={async (newMods) => {
              await onUpdateModules(newMods);
            }}
          />
        )}
      </aside>
    </>
  );
}
