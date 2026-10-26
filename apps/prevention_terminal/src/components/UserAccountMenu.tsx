import React, { useState, useRef, useEffect, useCallback } from "react";
import { t } from "../lib/i18n.ts";
import { isSubscriptionRequired, resetTerminalSubscription } from "../lib/terminal_subscription.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import { requestOpenSettings } from "../lib/workspace_navigation.ts";
import AiSubscriptionCheckout from "./AiSubscriptionCheckout.tsx";
import AccountDeleteSection from "./AccountDeleteSection.tsx";
import type { TerminalConfig } from "../lib/terminal_config.ts";

export interface UserAccountMenuProps {
  userEmail?: string;
  userName?: string;
  jobTitle?: string;
  orgName?: string;
  orgType?: string;
  terminalUserId?: string;
  terminalConfig?: TerminalConfig;
  specialistName?: string;
  onLogout?: () => void;
  onSwitchAccount?: () => void;
  onOpenSettings?: () => void;
  compact?: boolean;
  theme?: "light" | "dark" | "auto";
  educatorLite?: boolean;
}

export function getInitials(name?: string, email?: string, jobTitle?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const username = email.split("@")[0] || "";
    const clean = username.replace(/[^a-zA-Zа-яА-Я0-9]/g, " ").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (username.length >= 2) {
      return username.slice(0, 2).toUpperCase();
    }
    return username.toUpperCase() || "👤";
  }
  if (jobTitle && jobTitle.trim()) {
    const parts = jobTitle.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return jobTitle.slice(0, 2).toUpperCase();
  }
  return "СП";
}

export default function UserAccountMenu(props: UserAccountMenuProps) {
  const {
    userEmail: propEmail,
    userName: propName,
    jobTitle,
    orgName,
    orgType,
    terminalUserId,
    terminalConfig,
    specialistName,
    onLogout,
    onSwitchAccount,
    onOpenSettings,
    compact = false,
    theme = "auto",
    educatorLite = false,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resettingSub, setResettingSub] = useState(false);
  const [resetSubMsg, setResetSubMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const email =
    propEmail ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("platform_email") || localStorage.getItem("terminal_contact_email") : "") ||
    "";
  const name =
    propName ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("platform_name") : "") ||
    "";
  const displayName = educatorLite
    ? t("Классный руководитель / Педагог", "Homeroom Teacher / Educator")
    : (name || jobTitle || t("Специалист", "Specialist"));

  const initials = getInitials(name, email, jobTitle);

  const subscriptionCommercial = isSubscriptionRequired(orgType);
  const { sub, active: subActive, reload: reloadSub } = useTerminalSubscription(terminalUserId, orgType);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleCopyEmail = useCallback(() => {
    if (!email) return;
    try {
      navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [email]);

  const handleDefaultSwitch = useCallback(() => {
    if (onSwitchAccount) {
      onSwitchAccount();
      return;
    }
    if (window.confirm(t("Выйти из этого аккаунта и войти под другим специалистом?", "Log out of this account and sign in as another specialist?"))) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("platform_access_token");
        localStorage.removeItem("platform_user_id");
        localStorage.removeItem("platform_email");
        localStorage.removeItem("platform_name");
      }
      window.location.reload();
    }
  }, [onSwitchAccount]);

  const handleDefaultLogout = useCallback(() => {
    if (onLogout) {
      onLogout();
      return;
    }
    if (window.confirm(t("Выйти из системы?", "Log out of the system?"))) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("platform_access_token");
        localStorage.removeItem("platform_user_id");
        localStorage.removeItem("platform_email");
        localStorage.removeItem("platform_name");
      }
      window.location.reload();
    }
  }, [onLogout]);

  const handleSettingsClick = useCallback(() => {
    setIsOpen(false);
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      requestOpenSettings();
    }
  }, [onOpenSettings]);

  const isDarkTheme = theme === "dark";

  return (
    <div className="terminal-user-account-menu-root" ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="terminal-account-trigger-btn"
        aria-label={t("Меню профиля и аккаунта", "Profile and account menu")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: isDarkTheme ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
          border: `1px solid ${isDarkTheme ? "rgba(255, 255, 255, 0.14)" : "#e2e8f0"}`,
          borderRadius: "9999px",
          padding: compact ? "2px" : "3px 10px 3px 3px",
          cursor: "pointer",
          color: isDarkTheme ? "#f1f5f9" : "#1e293b",
          transition: "all 0.15s ease",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ position: "relative", display: "inline-flex" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: isDarkTheme
                ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
                : "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
              color: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "0.8rem",
              letterSpacing: "0.02em",
              userSelect: "none",
            }}
          >
            {initials}
          </div>
          <span
            style={{
              position: "absolute",
              bottom: "0px",
              right: "0px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              border: `1.5px solid ${isDarkTheme ? "#1e293b" : "#ffffff"}`,
            }}
            title={t("В сети / Авторизован", "Online / Authorized")}
          />
        </div>

        {!compact && (
          <div className="terminal-account-trigger-text" style={{ display: "flex", flexDirection: "column", textAlign: "left", lineHeight: 1.2, maxWidth: "150px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: isDarkTheme ? "#f1f5f9" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayName}
            </span>
            {email && (
              <span style={{ fontSize: "0.72rem", color: isDarkTheme ? "#94a3b8" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {email}
              </span>
            )}
          </div>
        )}

        <span style={{ fontSize: "0.65rem", color: isDarkTheme ? "#94a3b8" : "#94a3b8", marginLeft: "2px" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label={t("Настройки аккаунта", "Account settings")}
          className="terminal-account-dropdown-card"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "320px",
            maxWidth: "calc(100vw - 24px)",
            backgroundColor: isDarkTheme ? "#1e293b" : "#ffffff",
            color: isDarkTheme ? "#f8fafc" : "#0f172a",
            borderRadius: "14px",
            border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`,
            boxShadow: "0 16px 36px -6px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.04)",
            padding: "16px",
            zIndex: 1300,
            animation: "fadeInDown 0.15s ease-out",
          }}
        >
          {/* Header: User Profile Card */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "14px", borderBottom: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.08)" : "#f1f5f9"}` }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: isDarkTheme
                  ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
                  : "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
                color: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "1rem",
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.92rem", color: isDarkTheme ? "#f8fafc" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {displayName}
              </div>
              {orgName && (
                <div style={{ fontSize: "0.75rem", color: isDarkTheme ? "#94a3b8" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>
                  🏢 {orgName}
                </div>
              )}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  marginTop: "4px",
                  background: isDarkTheme ? "rgba(255, 255, 255, 0.06)" : "#f8fafc",
                  color: isDarkTheme ? "#94a3b8" : "#475569",
                  border: `1px solid ${isDarkTheme ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0"}`,
                  padding: "2px 7px",
                  borderRadius: "6px",
                  fontSize: "0.7rem",
                  fontWeight: 500,
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                {t("Авторизован", "Authorized")}
              </div>
            </div>
          </div>

          {/* Email row with Copy button */}
          {email && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                margin: "12px 0 8px 0",
                background: isDarkTheme ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
                borderRadius: "8px",
                border: `1px solid ${isDarkTheme ? "rgba(255, 255, 255, 0.07)" : "#e2e8f0"}`,
                fontSize: "0.78rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>📧</span>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isDarkTheme ? "#cbd5e1" : "#334155", fontWeight: 500 }}>
                  {email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                style={{
                  background: copied ? (isDarkTheme ? "#064e3b" : "#f0fdf4") : "transparent",
                  color: copied ? (isDarkTheme ? "#6ee7b7" : "#166534") : (isDarkTheme ? "#94a3b8" : "#64748b"),
                  border: copied
                    ? `1px solid ${isDarkTheme ? "#059669" : "#86efac"}`
                    : `1px solid ${isDarkTheme ? "rgba(255,255,255,0.14)" : "#cbd5e1"}`,
                  borderRadius: "5px",
                  padding: "2px 8px",
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  marginLeft: "8px",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
                title={t("Скопировать адрес электронной почты", "Copy email address")}
              >
                {copied ? t("✓ Скопировано", "✓ Copied") : t("Копировать", "Copy")}
              </button>
            </div>
          )}

          {/* Subscription & Billing Section */}
          <div
            style={{
              margin: "10px 0",
              padding: "10px 12px",
              borderRadius: "10px",
              background: isDarkTheme ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
              border: `1px solid ${isDarkTheme ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: isDarkTheme ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t("Тариф и подписка", "Plan & Subscription")}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: "5px",
                  background: subActive
                    ? (isDarkTheme ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5")
                    : (isDarkTheme ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9"),
                  border: subActive
                    ? `1px solid ${isDarkTheme ? "rgba(16, 185, 129, 0.25)" : "#a7f3d0"}`
                    : `1px solid ${isDarkTheme ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0"}`,
                  color: subActive
                    ? (isDarkTheme ? "#6ee7b7" : "#065f46")
                    : (isDarkTheme ? "#94a3b8" : "#475569"),
                }}
              >
                {subActive ? (sub.is_trial ? t("Пробный AI", "Trial AI") : t("Pro активна", "Pro active")) : t("Базовый", "Basic")}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowSubModal(true);
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                background: isDarkTheme ? "#334155" : "#1e293b",
                color: "#f8fafc",
                border: "none",
                borderRadius: "7px",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "background 0.15s ease",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.1)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDarkTheme ? "#475569" : "#0f172a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = isDarkTheme ? "#334155" : "#1e293b")}
            >
              <span style={{ fontSize: "0.85rem" }}>💎</span>
              <span>{t("Подписки и биллинг", "Subscriptions & Billing")}</span>
            </button>
          </div>

          {/* Action List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "6px" }}>
            <button
              type="button"
              onClick={handleSettingsClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                background: "transparent",
                border: "none",
                borderRadius: "7px",
                color: isDarkTheme ? "#f1f5f9" : "#1e293b",
                fontSize: "0.83rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDarkTheme ? "rgba(255,255,255,0.06)" : "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>⚙️</span>
              <span>{t("Настройки кабинета", "Workspace Settings")}</span>
            </button>

            <div style={{ height: "1px", background: isDarkTheme ? "rgba(255,255,255,0.08)" : "#f1f5f9", margin: "4px 0" }} />

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleDefaultSwitch();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                background: "transparent",
                border: "none",
                borderRadius: "7px",
                color: isDarkTheme ? "#cbd5e1" : "#475569",
                fontSize: "0.83rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDarkTheme ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>🔄</span>
              <span>{t("Сменить аккаунт", "Switch Account")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowDeleteModal(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                background: "transparent",
                border: "none",
                borderRadius: "7px",
                color: isDarkTheme ? "#f87171" : "#b91c1c",
                fontSize: "0.83rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDarkTheme ? "rgba(239, 68, 68, 0.1)" : "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>🗑️</span>
              <span>{t("Удаление аккаунта и данных", "Delete Account and Data")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleDefaultLogout();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                background: "transparent",
                border: "none",
                borderRadius: "7px",
                color: isDarkTheme ? "#fca5a5" : "#991b1b",
                fontSize: "0.83rem",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDarkTheme ? "rgba(239, 68, 68, 0.1)" : "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>🚪</span>
              <span>{t("Выйти из системы", "Log Out")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Subscription & Billing Modal */}
      {showSubModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowSubModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDarkTheme ? "#1e293b" : "#ffffff",
              color: isDarkTheme ? "#f8fafc" : "#1e293b",
              borderRadius: "16px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`,
              padding: "1.5rem",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", color: isDarkTheme ? "#f8fafc" : "#0f172a" }}>
                  <span>💎</span>
                  {t("Подписки и биллинг", "Subscriptions & Billing")}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: isDarkTheme ? "#94a3b8" : "#64748b" }}>
                  {email ? `${t("Аккаунт:", "Account:")} ${email}` : t("Управление тарифом и доступом к ИИ", "Manage plan and AI access")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: isDarkTheme ? "#94a3b8" : "#64748b",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Current Status Box */}
            <div
              style={{
                background: subActive
                  ? (isDarkTheme ? "rgba(16, 185, 129, 0.08)" : "#ecfdf5")
                  : (isDarkTheme ? "rgba(255, 255, 255, 0.03)" : "#f8fafc"),
                border: `1px solid ${subActive ? (isDarkTheme ? "rgba(16, 185, 129, 0.25)" : "#a7f3d0") : (isDarkTheme ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0")}`,
                borderRadius: "10px",
                padding: "0.9rem 1.1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: subActive ? (isDarkTheme ? "#6ee7b7" : "#065f46") : (isDarkTheme ? "#f1f5f9" : "#1e293b") }}>
                    {subActive
                      ? sub.is_trial
                        ? `🎁 ${t("Пробный период активен", "Trial period active")}`
                        : `✓ ${t("Подписка Pro активна", "Pro subscription active")}`
                      : t("Базовый тариф (Free)", "Basic Plan (Free)")}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: isDarkTheme ? "#cbd5e1" : "#64748b", marginTop: "2px" }}>
                    {sub.message || (subActive ? t("Все функции ИИ, протоколы и видеокомната доступны.", "All AI features, protocols and video room available.") : t("Доступны базовые протоколы. Для автогенерации и супервизии подключите Pro.", "Basic protocols available. Activate Pro for auto-generation and supervision."))}
                  </div>
                </div>

                {/* Reset subscription button */}
                <button
                  type="button"
                  disabled={resettingSub}
                  onClick={async () => {
                    if (window.confirm(t("Сбросить подписку и вернуть базовый/пробный тариф?", "Reset subscription and restore basic/trial tier?"))) {
                      setResettingSub(true);
                      setResetSubMsg(null);
                      try {
                        const ok = await resetTerminalSubscription(terminalUserId);
                        if (ok) {
                          setResetSubMsg(t("✓ Подписка успешно сброшена", "✓ Subscription reset successfully"));
                          await reloadSub();
                        } else {
                          setResetSubMsg(t("Не удалось сбросить подписку", "Failed to reset subscription"));
                        }
                      } finally {
                        setResettingSub(false);
                      }
                    }
                  }}
                  style={{
                    background: "transparent",
                    color: isDarkTheme ? "#94a3b8" : "#64748b",
                    border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.12)" : "#cbd5e1"}`,
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    cursor: resettingSub ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                  title={t("Сброс активной подписки / квоты", "Reset active subscription / quota")}
                >
                  <span>🔄</span>
                  <span>{resettingSub ? t("Сброс…", "Resetting…") : t("Сбросить подписку", "Reset subscription")}</span>
                </button>
              </div>

              {resetSubMsg && (
                <div style={{ marginTop: "6px", fontSize: "0.75rem", color: resetSubMsg.startsWith("✓") ? (isDarkTheme ? "#6ee7b7" : "#15803d") : (isDarkTheme ? "#f87171" : "#b91c1c") }}>
                  {resetSubMsg}
                </div>
              )}
            </div>

            {/* Checkout / Extension form */}
            <AiSubscriptionCheckout
              terminalUserId={terminalUserId}
              compact
              context="user_account_menu"
              onDismiss={() => setShowSubModal(false)}
              onActivated={() => {
                reloadSub();
                setShowSubModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Account Deletion Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDeleteModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDarkTheme ? "#1e293b" : "#ffffff",
              color: isDarkTheme ? "#f8fafc" : "#1e293b",
              borderRadius: "16px",
              maxWidth: "740px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.12)" : "#e2e8f0"}`,
              padding: "1.5rem",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", color: isDarkTheme ? "#f8fafc" : "#0f172a" }}>
                <span>🗑️</span>
                {t("Удаление аккаунта и данных", "Delete Account and Data")}
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: isDarkTheme ? "#94a3b8" : "#64748b",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            <AccountDeleteSection
              terminalConfig={terminalConfig}
              terminalUserId={terminalUserId}
              specialistName={specialistName || name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
