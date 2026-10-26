import React from "react";
import WorkspaceNavIcon from "./WorkspaceNavIcon.tsx";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";
import { t } from "../lib/i18n.ts";

interface MobileBottomNavProps {
  activeView: SpecialistWorkspaceView | string;
  onSelect: (view: SpecialistWorkspaceView) => void;
  onOpenAllModules: () => void;
  inboxBadge?: number;
  isCommercial?: boolean;
}

export default function MobileBottomNav({
  activeView,
  onSelect,
  onOpenAllModules,
  inboxBadge = 0,
  isCommercial = false,
}: MobileBottomNavProps) {
  // Определяем быстрые 4 действия + кнопку "Все разделы"
  const items = [
    {
      id: "dashboard" as SpecialistWorkspaceView,
      icon: "dashboard",
      label: t("Сводка", "Dashboard"),
    },
    {
      id: (isCommercial ? "ida_clients" : "case_workspace") as SpecialistWorkspaceView,
      icon: isCommercial ? "users" : "cases",
      label: isCommercial ? t("Клиенты", "Clients") : t("Случаи", "Cases"),
    },
    {
      id: "calendar" as SpecialistWorkspaceView,
      icon: "calendar",
      label: t("Календарь", "Calendar"),
    },
    {
      id: "ai_consultant" as SpecialistWorkspaceView,
      icon: "ai",
      label: t("ИИ Помощник", "AI Assist"),
      highlight: true,
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Быстрая навигация">
      {items.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav-item${isActive ? " active" : ""}${item.highlight ? " mobile-bottom-nav-item--highlight" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <div className="mobile-bottom-nav-icon-wrap">
              <WorkspaceNavIcon id={item.icon} />
            </div>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        className="mobile-bottom-nav-item mobile-bottom-nav-item--more"
        onClick={onOpenAllModules}
        title={t("Все разделы кабинета", "All sections")}
      >
        <div className="mobile-bottom-nav-icon-wrap">
          <WorkspaceNavIcon id="menu" />
          {inboxBadge > 0 && (
            <span className="mobile-bottom-nav-badge">
              {inboxBadge > 99 ? "99+" : inboxBadge}
            </span>
          )}
        </div>
        <span className="mobile-bottom-nav-label">{t("Меню", "Menu")}</span>
      </button>
    </nav>
  );
}
