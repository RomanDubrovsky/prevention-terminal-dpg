import { useState } from "react";
import {
  SPECIALIST_CUSTOMIZABLE_MODULES,
  getDefaultNavModules,
  type NavCustomModuleDef,
} from "../lib/workspace_nav.ts";

interface CustomizeMenuModalProps {
  isOpen: boolean;
  isCommercial: boolean;
  currentModules: Record<string, boolean>;
  onClose: () => void;
  onSave: (modules: Record<string, boolean>) => Promise<void> | void;
}

export default function CustomizeMenuModal({
  isOpen,
  isCommercial,
  currentModules,
  onClose,
  onSave,
}: CustomizeMenuModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const defaults = getDefaultNavModules(isCommercial);
    const initial: Record<string, boolean> = {};
    for (const mod of SPECIALIST_CUSTOMIZABLE_MODULES) {
      if (currentModules[mod.id] !== undefined) {
        initial[mod.id] = currentModules[mod.id];
      } else {
        initial[mod.id] = defaults[mod.id] !== false;
      }
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultNavModules(isCommercial);
    setSelected(defaults);
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Фильтруем модули по направлению (не показываем заведомо чужие)
  const availableModules = SPECIALIST_CUSTOMIZABLE_MODULES.filter((m) => {
    if (isCommercial && m.schoolOnly) return false;
    if (!isCommercial && m.commercialOnly) return false;
    return true;
  });

  const mainModules = availableModules.filter((m) => m.category === "main");
  const purpleModules = availableModules.filter((m) => m.category === "purple");
  const reportModules = availableModules.filter((m) => m.category === "reports");

  const renderModuleGroup = (title: string, badgeText: string, modules: NavCustomModuleDef[]) => {
    if (modules.length === 0) return null;
    return (
      <div className="customize-menu-group" style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {title}
          </span>
          <span style={{ fontSize: "0.75rem", color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "10px" }}>
            {badgeText}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {modules.map((mod) => {
            const checked = selected[mod.id] !== false;
            return (
              <label
                key={mod.id}
                className="customize-menu-item"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: checked ? "#f8fafc" : "#ffffff",
                  border: `1px solid ${checked ? "#cbd5e1" : "#f1f5f9"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(mod.id)}
                  style={{
                    width: "18px",
                    height: "18px",
                    marginTop: "2px",
                    cursor: "pointer",
                    accentColor: "#7c3aed",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: checked ? "#0f172a" : "#64748b" }}>
                    {mod.label}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px", lineHeight: 1.35 }}>
                    {mod.description}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="customize-menu-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="customize-menu-modal"
        style={{
          width: "100%",
          maxWidth: "540px",
          maxHeight: "88vh",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(124, 58, 237, 0.12)",
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              ⚙️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
                Настройка разделов меню
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                {isCommercial
                  ? "Режим: Частная практика / Психологический центр (IDA Kit)"
                  : "Режим: Школьное / Государственное учреждение"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "20px 22px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: "#eff6ff",
              borderRadius: "8px",
              border: "1px solid #bfdbfe",
              fontSize: "0.82rem",
              color: "#1e40af",
              marginBottom: "16px",
              lineHeight: 1.4,
            }}
          >
            💡 Отключите разделы, которыми вы пока не пользуетесь, чтобы рабочая панель была компактной и не отвлекала. Вы всегда сможете вернуть их в любой момент.
          </div>

          {renderModuleGroup("Основные модули", "Кабинет", mainModules)}
          {renderModuleGroup("Рабочий инструментарий", "Фиолетовая панель", purpleModules)}
          {renderModuleGroup("Дополнительно", "Отчёты и биллинг", reportModules)}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid #f1f5f9",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={handleResetDefaults}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: "0.86rem",
              cursor: "pointer",
              padding: "6px 8px",
              textDecoration: "underline",
            }}
          >
            Сбросить по умолчанию
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={saving}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#7c3aed",
                color: "#ffffff",
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(124, 58, 237, 0.25)",
              }}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
