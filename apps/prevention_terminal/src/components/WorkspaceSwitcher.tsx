import React, { useState, useEffect, useRef } from "react";
import { t } from "../lib/i18n.ts";

export type WorkspaceId = "school" | "commercial" | "corporate" | "educator" | "creator";

export interface WorkspaceOption {
  id: WorkspaceId;
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
}

export const WORKSPACE_OPTIONS: WorkspaceOption[] = [
  {
    id: "school",
    icon: "🏫",
    title: t("Школа", "School"),
    subtitle: t("Педагог-психолог: журналы, ИПР, диагностика и ФГОС", "Educational psychologist: journals, ISP, diagnostics"),
    badge: t("Образование", "Education"),
    badgeColor: "#0284c7",
  },
  {
    id: "commercial",
    icon: "💼",
    title: t("Частная практика", "Private Practice"),
    subtitle: t("Прием клиентов, учет сессий, биллинг и IDA Kit", "Client sessions, accounting, billing and IDA Kit"),
    badge: t("IDA Kit", "IDA Kit"),
    badgeColor: "#7c3aed",
  },
  {
    id: "educator",
    icon: "👨‍🏫",
    title: t("Кабинет педагога", "Educator Workspace"),
    subtitle: t("Классный руководитель: журнал наблюдений и собрания", "Homeroom teacher: observations log and parent meetings"),
    badge: t("Быстрый вход", "Fast track"),
    badgeColor: "#059669",
  },
  {
    id: "creator",
    icon: "🎓",
    title: t("Студия автора", "Creator Studio"),
    subtitle: t("Вебинары, трансляции, учебные курсы и студенты", "Webinars, live broadcasts, learning courses and students"),
    badge: t("Студия", "Studio"),
    badgeColor: "#ea580c",
  },
  {
    id: "corporate",
    icon: "🏢",
    title: t("Корпоративное здоровье", "Corporate Health"),
    subtitle: t("Психологическое здоровье сотрудников и команд", "Corporate psychological health and team well-being"),
    badge: t("B2B", "B2B"),
    badgeColor: "#0d9488",
  },
];

interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceId;
  onSwitchWorkspace: (workspace: WorkspaceId) => void;
  enabledWorkspaces?: string[];
  style?: React.CSSProperties;
}

export default function WorkspaceSwitcher({
  currentWorkspace,
  onSwitchWorkspace,
  enabledWorkspaces,
  style,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableOptions = React.useMemo(() => {
    if (!enabledWorkspaces || enabledWorkspaces.length === 0) return WORKSPACE_OPTIONS;
    const filtered = WORKSPACE_OPTIONS.filter((opt) => enabledWorkspaces.includes(opt.id));
    return filtered.length > 0 ? filtered : WORKSPACE_OPTIONS;
  }, [enabledWorkspaces]);

  // If only 1 application or none is enabled, do not display top dropdown switcher
  if (availableOptions.length <= 1) {
    return null;
  }

  const activeOption = availableOptions.find((opt) => opt.id === currentWorkspace) || availableOptions[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (ws: WorkspaceId) => {
    setIsOpen(false);
    if (ws !== currentWorkspace) {
      onSwitchWorkspace(ws);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-block",
        zIndex: 50,
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={t("Переключить рабочее пространство", "Switch workspace")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(241, 245, 249, 0.95)",
          color: "#0f172a",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          borderRadius: "10px",
          padding: "6px 12px",
          fontSize: "0.85rem",
          fontWeight: 650,
          cursor: "pointer",
          transition: "all 0.15s ease",
          boxShadow: isOpen ? "0 0 0 2px rgba(99, 102, 241, 0.3)" : "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <span style={{ fontSize: "1.05rem" }}>{activeOption.icon}</span>
        <span style={{ fontWeight: 700 }}>{activeOption.title}</span>
        {activeOption.badge && (
          <span
            style={{
              fontSize: "0.7rem",
              padding: "1px 6px",
              borderRadius: "6px",
              background: "rgba(99, 102, 241, 0.1)",
              color: activeOption.badgeColor || "#4f46e5",
              fontWeight: 700,
            }}
          >
            {activeOption.badge}
          </span>
        )}
        <span
          style={{
            fontSize: "0.65rem",
            color: "#64748b",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "320px",
            background: "#ffffff",
            border: "1px solid rgba(203, 213, 225, 0.8)",
            borderRadius: "14px",
            boxShadow: "0 14px 35px -6px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08)",
            padding: "8px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px 10px",
              borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
              marginBottom: "4px",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 750, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("Пространства платформы", "Platform Workspaces")}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
              {t("Быстрое переключение без выхода из аккаунта", "Instant switch without re-login")}
            </div>
          </div>

          {availableOptions.map((opt) => {
            const isSelected = opt.id === currentWorkspace;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                role="option"
                aria-selected={isSelected}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: isSelected ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
                  background: isSelected ? "rgba(99, 102, 241, 0.08)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(241, 245, 249, 0.8)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "1.25rem", lineHeight: 1.2, marginTop: "2px" }}>{opt.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <span style={{ fontWeight: isSelected ? 750 : 650, fontSize: "0.86rem", color: "#0f172a" }}>
                      {opt.title}
                    </span>
                    {isSelected ? (
                      <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 750 }}>
                        ✓ {t("Активно", "Active")}
                      </span>
                    ) : opt.badge ? (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: "rgba(226, 232, 240, 0.8)",
                          color: opt.badgeColor || "#64748b",
                          fontWeight: 650,
                        }}
                      >
                        {opt.badge}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      marginTop: "2px",
                      lineHeight: 1.3,
                    }}
                  >
                    {opt.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
