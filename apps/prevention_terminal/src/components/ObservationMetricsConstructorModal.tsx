import React, { useState } from "react";
import { t } from "../lib/i18n";
import {
  ObservationMetric,
  loadObservationMetrics,
  saveObservationMetrics,
  DEFAULT_STANDARD_METRICS,
} from "../lib/observation_metrics_store";

interface MetricsConstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMetricsChanged?: () => void;
}

export default function ObservationMetricsConstructorModal({
  isOpen,
  onClose,
  onMetricsChanged,
}: MetricsConstructorModalProps) {
  const [metrics, setMetrics] = useState<ObservationMetric[]>(() => loadObservationMetrics());
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleToggleEnable = (id: string) => {
    const updated = metrics.map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    );
    setMetrics(updated);
  };

  const handleAddCustomMetric = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!newTitle.trim()) {
      setErrorMsg(t("Введите название показателя", "Enter metric title"));
      return;
    }

    const newMetric: ObservationMetric = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || t("Дополнительный вариативный показатель школы", "Custom school metric"),
      isStandard: false,
      enabled: true,
    };

    const updated = [...metrics, newMetric];
    setMetrics(updated);
    setNewTitle("");
    setNewDesc("");
  };

  const handleDeleteCustomMetric = (id: string) => {
    const updated = metrics.filter((m) => m.id !== id);
    setMetrics(updated);
  };

  const handleResetDefaults = () => {
    if (confirm(t("Сбросить все показатели до базового стандарта ФГОС?", "Reset all metrics to default standard?"))) {
      setMetrics(DEFAULT_STANDARD_METRICS);
    }
  };

  const handleSave = () => {
    saveObservationMetrics(metrics);
    if (onMetricsChanged) onMetricsChanged();
    onClose();
  };

  return (
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
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              ⚙️ {t("Конструктор показателей наблюдения", "Observation Metrics Constructor")}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              {t("Базовые стандарты ФГОС + вариативные локальные критерии вашей школы", "Standard FGOES criteria + local school custom criteria")}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            ✖
          </button>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#334155" }}>
              {t("Текущие показатели карт наблюдений:", "Current active observation metrics:")}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {metrics.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: `1.5px solid ${m.enabled ? (m.isStandard ? "#cbd5e1" : "#818cf8") : "#f1f5f9"}`,
                    background: m.enabled ? (m.isStandard ? "#ffffff" : "#f5f3ff") : "#f8fafc",
                    opacity: m.enabled ? 1 : 0.6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => handleToggleEnable(m.id)}
                    style={{ marginTop: "3px", cursor: "pointer" }}
                    title={t("Включить / выключить данный показатель в картах", "Enable / disable this metric in forms")}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "14px", color: "#1e293b" }}>{m.title}</strong>
                      {m.isStandard ? (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#e2e8f0",
                            color: "#475569",
                            textTransform: "uppercase",
                          }}
                        >
                          {t("ФГОС Стандарт", "Standard")}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#ddd6fe",
                            color: "#5b21b6",
                            textTransform: "uppercase",
                          }}
                        >
                          {t("Вариативный (Школа)", "School Custom")}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>{m.description}</p>
                  </div>
                  {!m.isStandard && (
                    <button
                      onClick={() => handleDeleteCustomMetric(m.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "14px",
                        padding: "4px",
                      }}
                      title={t("Удалить этот локальный показатель", "Delete custom metric")}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddCustomMetric}
            style={{
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h4 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
              ➕ {t("Добавить свой (вариативный) показатель школы", "Add custom school metric")}
            </h4>
            {errorMsg && (
              <p style={{ color: "#dc2626", fontSize: "12px", margin: "0 0 8px" }}>{errorMsg}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                placeholder={t("Название показателя (напр.: Склонность к уходу из дома / Буллинг)", "Metric title (e.g. Bullying / Truancy)")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                }}
              />
              <input
                type="text"
                placeholder={t("Краткое пояснение для педагога (что оценивать)", "Short explanation for educators")}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                }}
              />
              <button
                type="submit"
                style={{
                  alignSelf: "flex-start",
                  background: "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {t("Добавить показатель", "Add Metric")}
              </button>
            </div>
          </form>
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <button
            onClick={handleResetDefaults}
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            🔄 {t("Сбросить к стандарту", "Reset to standard")}
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                background: "#e2e8f0",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              {t("Отмена", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              style={{
                background: "#166534",
                color: "#ffffff",
                border: "none",
                padding: "8px 20px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("Сохранить изменения", "Save Changes")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
